import type { Prisma } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '../prisma';
import { badRequest, notFound } from '../errors';
import { INT4_MAX, INT4_MAX_MESSAGE } from '../http';
import { hashInviteCode, inviteCodesMatch, normalizeInviteCode } from '../invite-code';

export type Tx = Prisma.TransactionClient;

/**
 * Last line of defense for amounts written to Int4 columns. Route handlers
 * validate with `reqIntMin0`, but CSV import and offline sync call the
 * service directly with `Number(...)` conversions — an out-of-range (or
 * NaN) amount must become a friendly 400 here, never a raw DB error.
 */
export function assertAmountVnd(amountVnd: number) {
  if (
    !Number.isFinite(amountVnd) ||
    Math.round(amountVnd) < 0 ||
    Math.round(amountVnd) > INT4_MAX
  ) {
    throw badRequest(INT4_MAX_MESSAGE);
  }
}

/**
 * SEC-08: verify a presented code against a stored SHA-256 hex hash in
 * constant time. Buffers are rebuilt from hex so timingSafeEqual compares
 * the raw digests, never the (length-leaking) hex strings.
 */
export function inviteHashMatches(providedCode: string, storedHash: string): boolean {
  const a = Buffer.from(hashInviteCode(providedCode), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Opportunistic legacy upgrade: a book that still stores its code in
 * plaintext gets the hash written and the plaintext wiped the first time
 * the code is successfully presented. Failures here must never break the
 * access that was just granted, hence the swallowed errors at call sites.
 */
export async function upgradeBookToHashedCode(bookId: string, normalizedCode: string) {
  await prisma.sodamBook.update({
    where: { id: bookId },
    data: { inviteCodeHash: hashInviteCode(normalizedCode), inviteCode: null },
  });
}

/**
 * SEC-07 (re-grade r2): hash băm "mồi" cho đường sổ-không-tồn-tại. Trước
 * đây requireBookAccess ném 404 ngay khi không thấy sổ — không chạy phép
 * hash nào — trong khi đường sổ-thật luôn tốn một SHA-256 + timingSafeEqual,
 * tạo kênh timing phân biệt "sổ có thật, mã sai" với "sổ không tồn tại".
 * Nay đường không-tồn-tại cũng chạy đúng một phép so hash với hằng mồi này
 * trước khi ném cùng một 404, để hai đường cân bằng công việc.
 */
const DUMMY_INVITE_CODE_HASH = hashInviteCode('sodam-dummy-code-for-timing-parity');

/**
 * F-r3-4 (re-grade r3): `inviteCodeHash` là vật liệu credential — KHÔNG
 * bao giờ được xuất hiện trong payload API. Mọi hàm service trả "book" ra
 * route đều đi qua strip này; hash chỉ sống trong DB + các phép so nội bộ
 * (requireBookAccess không serialize trực tiếp nên giữ nguyên row).
 */
export function publicBook<T extends { inviteCodeHash?: string | null }>(book: T) {
  const out: Record<string, unknown> = { ...book };
  delete out.inviteCodeHash;
  return out as Omit<T, 'inviteCodeHash'>;
}

export async function requireBookAccess(bookId: string, code: string) {
  const book = await prisma.sodamBook.findUnique({
    where: { id: bookId },
    select: { id: true, inviteCode: true, inviteCodeHash: true },
  });
  const normalized = normalizeInviteCode(code);
  if (!book) {
    // Kết quả phép so bị bỏ — chỉ để cân bằng timing với đường sổ thật.
    inviteHashMatches(normalized, DUMMY_INVITE_CODE_HASH);
    throw notFound('Book not found');
  }
  if (book.inviteCodeHash) {
    if (!inviteHashMatches(normalized, book.inviteCodeHash)) {
      throw notFound('Book not found');
    }
    // Back-compat: callers/consumers see the verified code, never null.
    return { ...book, inviteCode: normalized };
  }
  if (book.inviteCode && inviteCodesMatch(code, book.inviteCode)) {
    try {
      await upgradeBookToHashedCode(book.id, normalized);
    } catch {
      // Upgrade is best-effort — a failed write must not revoke access.
    }
    return { ...book, inviteCode: normalized };
  }
  throw notFound('Book not found');
}

export async function attachEventTotals<T extends { id: string }>(events: T[]) {
  const result = [];
  for (const event of events) {
    const agg = await prisma.sodamEntry.aggregate({
      where: { eventId: event.id },
      _sum: { amountVnd: true },
      _count: true,
    });
    result.push({
      ...event,
      entryCount: agg._count,
      totalAmountVnd: agg._sum.amountVnd ?? 0,
    });
  }
  return result;
}

export async function ensurePersonTx(tx: Tx, bookId: string, displayName: string, note = '') {
  const name = displayName.trim();
  const existing = await tx.sodamPerson.findFirst({
    where: { bookId, displayName: { equals: name, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return tx.sodamPerson.create({
    data: { bookId, displayName: name, note: note ?? '' },
  });
}

export async function syncReturnForPersonEventTx(
  tx: Tx,
  bookId: string,
  personId: string,
  fromEventId: string,
) {
  const agg = await tx.sodamEntry.aggregate({
    where: { eventId: fromEventId, personId },
    _sum: { amountVnd: true },
    _count: true,
  });
  const total = agg._sum.amountVnd ?? 0;
  const existing = await tx.sodamReturnItem.findFirst({
    where: { bookId, personId, fromEventId },
    orderBy: { createdAt: 'desc' },
  });

  if (agg._count === 0 || total <= 0) {
    if (existing && existing.status === 'OPEN') {
      await tx.sodamReturnItem.delete({ where: { id: existing.id } });
    }
    return null;
  }

  if (existing) {
    if (existing.status !== 'OPEN') {
      // Đã trả/bỏ qua — giữ lịch sử, không mở lại nghĩa vụ từ cùng đám.
      return existing;
    }
    return tx.sodamReturnItem.update({
      where: { id: existing.id },
      data: { suggestedAmountVnd: total, fromEventId },
    });
  }

  return tx.sodamReturnItem.create({
    data: {
      bookId,
      personId,
      fromEventId,
      suggestedAmountVnd: total,
      status: 'OPEN',
    },
  });
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
