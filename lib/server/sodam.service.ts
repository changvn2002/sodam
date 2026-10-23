import type {
  Prisma,
  SodamEntrySource,
  SodamEventKind,
  SodamEventRole,
  SodamRelationType,
  SodamReturnStatus,
} from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from './prisma';
import { HttpError, badRequest, notFound } from './errors';
import { INT4_MAX, INT4_MAX_MESSAGE } from './http';
import {
  JOIN_THROTTLE_LIMIT,
  JOIN_THROTTLE_WINDOW_MS,
  generateInviteCode,
  hashInviteCode,
  inviteCodesMatch,
  normalizeInviteCode,
} from './invite-code';
import { sodamEventKindLabelVi } from './sodam-event-kinds';

/**
 * Port of the host's NestJS `SodamService` (server/src/products/sodam/sodam.service.ts).
 * Business logic is unchanged; Nest exceptions became HttpError and the
 * injected PrismaService became the standalone Prisma client.
 *
 * Access model (no-login): there are no accounts. Every book-scoped function
 * takes the book's invite code — presented by the client from its local
 * registry — and `requireBookAccess` verifies it before any data is touched.
 * A wrong/missing code answers 404 "Book not found", exactly like a book
 * that does not exist, so codes cannot be probed by book id.
 */

type Tx = Prisma.TransactionClient;

/**
 * Last line of defense for amounts written to Int4 columns. Route handlers
 * validate with `reqIntMin0`, but CSV import and offline sync call the
 * service directly with `Number(...)` conversions — an out-of-range (or
 * NaN) amount must become a friendly 400 here, never a raw DB error.
 */
function assertAmountVnd(amountVnd: number) {
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
function inviteHashMatches(providedCode: string, storedHash: string): boolean {
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
async function upgradeBookToHashedCode(bookId: string, normalizedCode: string) {
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

/**
 * "My books" without accounts: the client keeps the codes of the books it
 * created or joined on this device and sends them here to resolve the list.
 */
export async function listBooksByCodes(codes: string[]) {
  const normalized = [...new Set(codes.map(normalizeInviteCode).filter(Boolean))].slice(0, 50);
  if (normalized.length === 0) return [];
  const hashes = normalized.map((c) => hashInviteCode(c));
  const [byHash, legacy] = await Promise.all([
    prisma.sodamBook.findMany({
      where: { inviteCodeHash: { in: hashes } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    prisma.sodamBook.findMany({
      where: { inviteCode: { in: normalized } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
  ]);
  const seen = new Set<string>();
  const out: Array<(typeof byHash)[number] & { inviteCode: string }> = [];
  for (const book of byHash) {
    if (seen.has(book.id)) continue;
    seen.add(book.id);
    const matched = normalized.find((c) => hashInviteCode(c) === book.inviteCodeHash);
    out.push({ ...book, inviteCode: matched ?? '' });
  }
  for (const book of legacy) {
    if (seen.has(book.id)) continue;
    seen.add(book.id);
    const matched =
      normalized.find((c) => c === book.inviteCode) ?? normalizeInviteCode(book.inviteCode);
    // Opportunistic upgrade for every legacy book this device can open.
    try {
      await upgradeBookToHashedCode(book.id, matched);
    } catch {
      // Best-effort only — listing must not fail on a failed upgrade write.
    }
    out.push({ ...book, inviteCode: matched, inviteCodeHash: hashInviteCode(matched) });
  }
  return out
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 50);
}

export async function createBook(name: string) {
  // Codes are random; retry a few times on the (astronomically unlikely)
  // unique collision instead of failing the create. SEC-08: collisions are
  // checked against the HASH and only the hash is stored — the plaintext
  // exists solely in this response, which the client saves on its device.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const codeHash = hashInviteCode(code);
    const existing = await prisma.sodamBook.findUnique({
      where: { inviteCodeHash: codeHash },
    });
    if (existing) continue;
    const created = await prisma.sodamBook.create({
      data: { name: name.trim(), inviteCode: null, inviteCodeHash: codeHash },
    });
    return { ...created, inviteCode: code };
  }
  throw new Error('Could not allocate a unique invite code');
}

// --- SEC-08 join throttling -------------------------------------------------

async function readJoinThrottle(scope: string, key: string) {
  const row = await prisma.sodamJoinThrottle.findFirst({ where: { scope, key } });
  if (!row) return null;
  const expired = Date.now() - new Date(row.windowStart).getTime() >= JOIN_THROTTLE_WINDOW_MS;
  return expired ? null : row;
}

async function assertJoinNotThrottled(ip: string, codeHash: string) {
  const rows = await Promise.all([
    ip ? readJoinThrottle('ip', ip) : Promise.resolve(null),
    readJoinThrottle('code', codeHash),
  ]);
  if (rows.some((r) => r && r.count >= JOIN_THROTTLE_LIMIT)) {
    throw new HttpError(429, 'Bạn đã thử mở sổ quá nhiều lần. Đợi khoảng 15 phút rồi thử lại.');
  }
}

async function recordJoinFailure(scope: string, key: string) {
  const existing = await prisma.sodamJoinThrottle.findFirst({ where: { scope, key } });
  const now = new Date();
  if (!existing) {
    await prisma.sodamJoinThrottle.create({
      data: { scope, key, count: 1, windowStart: now },
    });
    return;
  }
  const expired =
    now.getTime() - new Date(existing.windowStart).getTime() >= JOIN_THROTTLE_WINDOW_MS;
  await prisma.sodamJoinThrottle.update({
    where: { id: existing.id },
    data: expired ? { count: 1, windowStart: now } : { count: existing.count + 1 },
  });
}

async function clearJoinFailures(ip: string, codeHash: string) {
  await Promise.all([
    ip
      ? prisma.sodamJoinThrottle.deleteMany({ where: { scope: 'ip', key: ip } })
      : Promise.resolve(null),
    prisma.sodamJoinThrottle.deleteMany({ where: { scope: 'code', key: codeHash } }),
  ]);
}

export async function joinBook(code: string, ip = '') {
  const normalized = normalizeInviteCode(code);
  const codeHash = hashInviteCode(normalized);
  // Throttle BEFORE any lookup: a blocked caller learns nothing, not even
  // whether the code they are trying right now happens to be valid.
  await assertJoinNotThrottled(ip, codeHash);

  const byHash = await prisma.sodamBook.findUnique({
    where: { inviteCodeHash: codeHash },
  });
  if (byHash && inviteHashMatches(normalized, byHash.inviteCodeHash ?? '')) {
    await clearJoinFailures(ip, codeHash);
    return { ...byHash, inviteCode: normalized };
  }

  const legacy = await prisma.sodamBook.findUnique({
    where: { inviteCode: normalized },
  });
  if (legacy?.inviteCode && inviteCodesMatch(normalized, legacy.inviteCode)) {
    const upgraded = await prisma.sodamBook.update({
      where: { id: legacy.id },
      data: { inviteCodeHash: codeHash, inviteCode: null },
    });
    await clearJoinFailures(ip, codeHash);
    return { ...upgraded, inviteCode: normalized };
  }

  if (ip) await recordJoinFailure('ip', ip);
  await recordJoinFailure('code', codeHash);
  throw notFound('Invite code not found');
}

/**
 * Đổi mã mời (DATA-04(ii) / SEC-12.5 — re-grade r2): mã mời là credential
 * duy nhất của sổ, nên khi mã bị lộ (ảnh chụp, link gửi nhầm) chủ sổ phải
 * thu hồi được. Đổi mã = thay hash trong MỘT update nguyên tử: mã cũ chết
 * ngay tại thời điểm ghi (không cửa sổ hai mã cùng sống), mã mới chỉ tồn
 * tại dạng hash trong DB — plaintext chỉ có trong response này, đúng kỷ
 * luật SEC-08 như lúc tạo sổ. Người gọi phải trình mã hiện tại qua
 * requireBookAccess — không có mã đúng thì không đổi được (404 như mọi
 * đường sai mã khác).
 */
export async function rotateInviteCode(bookId: string, code: string) {
  await requireBookAccess(bookId, code);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const next = generateInviteCode();
    const nextHash = hashInviteCode(next);
    const clash = await prisma.sodamBook.findUnique({
      where: { inviteCodeHash: nextHash },
      select: { id: true },
    });
    if (clash) continue;
    const updated = await prisma.sodamBook.update({
      where: { id: bookId },
      data: { inviteCodeHash: nextHash, inviteCode: null },
    });
    return { ...updated, inviteCode: next };
  }
  throw new Error('Could not allocate a unique invite code');
}

export async function dashboard(bookId: string, code: string) {
  await requireBookAccess(bookId, code);
  const rawBook = await prisma.sodamBook.findUniqueOrThrow({ where: { id: bookId } });
  // SEC-08: v2 books store inviteCode = null — the payload must still carry
  // the verified code the client presented, never null.
  const book = rawBook.inviteCode ? rawBook : { ...rawBook, inviteCode: normalizeInviteCode(code) };
  const [openEvent, openReturns, recentEvents, peopleCount, hostedAgg, attendedAgg, doneReturns] =
    await Promise.all([
      prisma.sodamEvent.findFirst({
        where: { bookId, status: 'OPEN' },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.sodamReturnItem.findMany({
        where: { bookId, status: 'OPEN' },
        select: { suggestedAmountVnd: true },
      }),
      prisma.sodamEvent.findMany({
        where: { bookId },
        orderBy: { occurredOn: 'desc' },
        take: 5,
      }),
      prisma.sodamPerson.count({ where: { bookId } }),
      prisma.sodamEntry.aggregate({
        where: { event: { bookId, role: 'HOSTED' } },
        _sum: { amountVnd: true },
      }),
      prisma.sodamEntry.aggregate({
        where: { event: { bookId, role: 'ATTENDED' } },
        _sum: { amountVnd: true },
      }),
      prisma.sodamReturnItem.findMany({
        where: { bookId, status: 'DONE' },
        select: { suggestedAmountVnd: true, doneAmountVnd: true },
      }),
    ]);

  const receivedGrossVnd = hostedAgg._sum.amountVnd ?? 0;
  const settledVnd = doneReturns.reduce((s, r) => s + (r.suggestedAmountVnd ?? 0), 0);
  const overGivenVnd = doneReturns.reduce((s, r) => {
    const got = r.suggestedAmountVnd ?? 0;
    const paid = r.doneAmountVnd ?? got;
    return s + Math.max(0, paid - got);
  }, 0);
  const returnedPaidVnd = doneReturns.reduce(
    (s, r) => s + (r.doneAmountVnd ?? r.suggestedAmountVnd ?? 0),
    0,
  );
  const pendingReturnVnd = openReturns.reduce((s, r) => s + (r.suggestedAmountVnd ?? 0), 0);
  const attendedVnd = attendedAgg._sum.amountVnd ?? 0;

  const recentWithTotals = await attachEventTotals(recentEvents);

  return {
    book,
    openEvent: openEvent ? (await attachEventTotals([openEvent]))[0] : null,
    openReturnCount: openReturns.length,
    recentEvents: recentWithTotals,
    totals: {
      /** Tiền khách đã mừng (gốc). */
      receivedGrossVnd,
      /** Còn lại sau khi trừ đúng số đã trả lễ (theo số khách đã mừng, không theo số mình đi). */
      receivedVnd: Math.max(0, receivedGrossVnd - settledVnd),
      /** Tổng nghĩa vụ đã tất toán (= số khách đã mừng trên các khoản DONE). */
      settledVnd,
      /** Tổng mình đã đưa khi trả lễ (có thể > settled). */
      returnedPaidVnd,
      /** Phần đi nhiều hơn số khách đã mừng. */
      overGivenVnd,
      /** Còn phải trả (OPEN). */
      pendingReturnVnd,
      /** Đi đám ATTENDED + tiền đã trả lễ. */
      givenVnd: attendedVnd + returnedPaidVnd,
      people: peopleCount,
    },
  };
}

export async function listEvents(bookId: string, code: string) {
  await requireBookAccess(bookId, code);
  const events = await prisma.sodamEvent.findMany({
    where: { bookId },
    orderBy: { occurredOn: 'desc' },
    take: 50,
  });
  return attachEventTotals(events);
}

export async function createEvent(
  bookId: string,
  code: string,
  input: {
    title: string;
    kind: SodamEventKind;
    role: SodamEventRole;
    occurredOn?: string;
    note?: string;
  },
) {
  await requireBookAccess(bookId, code);
  return prisma.sodamEvent.create({
    data: {
      bookId,
      title: input.title.trim(),
      kind: input.kind,
      role: input.role,
      note: input.note?.trim() ?? '',
      occurredOn: input.occurredOn ? new Date(input.occurredOn) : new Date(),
    },
  });
}

export async function getEvent(bookId: string, eventId: string, code: string) {
  await requireBookAccess(bookId, code);
  const event = await prisma.sodamEvent.findFirst({
    where: { id: eventId, bookId },
  });
  if (!event) throw notFound('Event not found');
  const entries = await prisma.sodamEntry.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const returns = await prisma.sodamReturnItem.findMany({
    where: { bookId, fromEventId: eventId },
  });
  const byPerson = new Map(returns.map((r) => [r.personId, r]));
  const enriched = entries.map((e) => {
    const ret = e.personId ? byPerson.get(e.personId) : undefined;
    return {
      ...e,
      returnItem: ret
        ? {
            id: ret.id,
            status: ret.status,
            receivedAmountVnd: ret.suggestedAmountVnd,
            returnedAmountVnd: ret.doneAmountVnd,
            overGivenVnd: Math.max(0, (ret.doneAmountVnd ?? 0) - (ret.suggestedAmountVnd ?? 0)),
          }
        : null,
    };
  });
  const [withTotals] = await attachEventTotals([event]);
  const settledOnEvent = returns
    .filter((r) => r.status === 'DONE')
    .reduce((s, r) => s + (r.suggestedAmountVnd ?? 0), 0);
  const overOnEvent = returns
    .filter((r) => r.status === 'DONE')
    .reduce((s, r) => s + Math.max(0, (r.doneAmountVnd ?? 0) - (r.suggestedAmountVnd ?? 0)), 0);
  return {
    ...withTotals,
    entries: enriched,
    settledVnd: settledOnEvent,
    netTotalVnd: Math.max(0, (withTotals.totalAmountVnd ?? 0) - settledOnEvent),
    overGivenVnd: overOnEvent,
  };
}

export async function closeEvent(bookId: string, eventId: string, code: string) {
  await requireBookAccess(bookId, code);
  const event = await prisma.sodamEvent.findFirst({ where: { id: eventId, bookId } });
  if (!event) throw notFound('Event not found');
  return prisma.sodamEvent.update({
    where: { id: eventId },
    data: { status: 'CLOSED' },
  });
}

export async function createEntry(
  bookId: string,
  eventId: string,
  code: string,
  input: {
    personName: string;
    amountVnd: number;
    source?: SodamEntrySource;
    note?: string;
    rawText?: string;
    clientMutationId?: string;
  },
) {
  await requireBookAccess(bookId, code);
  const event = await prisma.sodamEvent.findFirst({ where: { id: eventId, bookId } });
  if (!event) throw notFound('Event not found');
  assertAmountVnd(input.amountVnd);

  if (input.clientMutationId) {
    const existing = await prisma.sodamEntry.findUnique({
      where: { clientMutationId: input.clientMutationId },
    });
    if (existing) return existing;
  }

  return prisma.$transaction(async (tx) => {
    const person = await ensurePersonTx(tx, bookId, input.personName);
    const entry = await tx.sodamEntry.create({
      data: {
        eventId,
        personId: person.id,
        personName: input.personName.trim(),
        amountVnd: Math.max(0, Math.round(input.amountVnd)),
        source: input.source ?? 'MANUAL',
        note: input.note?.trim() ?? '',
        rawText: input.rawText,
        clientMutationId: input.clientMutationId,
      },
    });
    if (event.role === 'HOSTED') {
      await syncReturnForPersonEventTx(tx, bookId, person.id, eventId);
    }
    return entry;
  });
}

export async function updateEntry(
  bookId: string,
  eventId: string,
  entryId: string,
  code: string,
  input: Partial<{ personName: string; amountVnd: number; note: string }>,
) {
  await requireBookAccess(bookId, code);
  const entry = await prisma.sodamEntry.findFirst({
    where: { id: entryId, eventId, event: { bookId } },
    include: { event: true },
  });
  if (!entry) throw notFound('Entry not found');
  if (input.amountVnd != null) assertAmountVnd(input.amountVnd);
  const updated = await prisma.$transaction(async (tx) => {
    let personId = entry.personId;
    if (input.personName != null) {
      const person = await ensurePersonTx(tx, bookId, input.personName);
      personId = person.id;
    }
    const row = await tx.sodamEntry.update({
      where: { id: entryId },
      data: {
        ...(input.personName != null ? { personName: input.personName.trim(), personId } : {}),
        ...(input.amountVnd != null ? { amountVnd: Math.round(input.amountVnd) } : {}),
        ...(input.note != null ? { note: input.note } : {}),
      },
    });
    if (entry.event.role === 'HOSTED' && personId) {
      await syncReturnForPersonEventTx(tx, bookId, personId, eventId);
      if (entry.personId && entry.personId !== personId) {
        await syncReturnForPersonEventTx(tx, bookId, entry.personId, eventId);
      }
    }
    return row;
  });
  return updated;
}

export async function deleteEntry(bookId: string, eventId: string, entryId: string, code: string) {
  await requireBookAccess(bookId, code);
  const entry = await prisma.sodamEntry.findFirst({
    where: { id: entryId, eventId, event: { bookId } },
    include: { event: true },
  });
  if (!entry) throw notFound('Entry not found');
  await prisma.$transaction(async (tx) => {
    await tx.sodamEntry.delete({ where: { id: entryId } });
    if (entry.event.role === 'HOSTED' && entry.personId) {
      await syncReturnForPersonEventTx(tx, bookId, entry.personId, eventId);
    }
  });
  return { ok: true };
}

export async function batchEntries(
  bookId: string,
  eventId: string,
  code: string,
  rows: Array<{ personName: string; amountVnd: number }>,
) {
  const out = [];
  for (const row of rows.slice(0, 100)) {
    out.push(
      await createEntry(bookId, eventId, code, {
        personName: row.personName,
        amountVnd: row.amountVnd,
        source: 'PHOTO',
      }),
    );
  }
  return out;
}

export async function listPeople(bookId: string, code: string) {
  await requireBookAccess(bookId, code);
  return prisma.sodamPerson.findMany({
    where: { bookId },
    orderBy: { displayName: 'asc' },
    take: 200,
  });
}

export async function searchPeople(bookId: string, code: string, q: string) {
  await requireBookAccess(bookId, code);
  const people = await prisma.sodamPerson.findMany({
    where: {
      bookId,
      displayName: { contains: q.trim(), mode: 'insensitive' },
    },
    take: 20,
  });
  const result = [];
  for (const person of people) {
    const history = await prisma.sodamEntry.findMany({
      where: { personId: person.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    result.push({ ...person, history });
  }
  return result;
}

export async function upsertPerson(
  bookId: string,
  code: string,
  input: { id?: string; displayName: string; note?: string },
) {
  await requireBookAccess(bookId, code);
  if (input.id) {
    const person = await prisma.sodamPerson.findFirst({
      where: { id: input.id, bookId },
    });
    if (!person) throw notFound('Person not found');
    return prisma.sodamPerson.update({
      where: { id: input.id },
      data: {
        displayName: input.displayName.trim(),
        note: input.note ?? person.note,
      },
    });
  }
  return prisma.$transaction((tx) => ensurePersonTx(tx, bookId, input.displayName, input.note));
}

export async function listRelations(bookId: string, code: string) {
  await requireBookAccess(bookId, code);
  const people = await prisma.sodamPerson.findMany({
    where: { bookId },
    select: { id: true },
    take: 500,
  });
  const ids = people.map((p) => p.id);
  return prisma.sodamPersonRelation.findMany({
    where: { fromPersonId: { in: ids } },
    take: 200,
  });
}

/**
 * Xoá một quan hệ khỏi cây họ (bổ sung ở vòng tích hợp đợt redesign —
 * LAYOUT-SPEC §6 yêu cầu mỗi quan hệ có thao tác xoá kèm xác nhận ở UI).
 * Quan hệ chỉ bị xoá khi người bắt đầu của nó thuộc đúng sổ đang mở:
 * quan hệ của sổ khác trả 404 như không tồn tại, nhất quán với phần còn lại.
 */
export async function deleteRelation(bookId: string, relationId: string, code: string) {
  await requireBookAccess(bookId, code);
  const people = await prisma.sodamPerson.findMany({
    where: { bookId },
    select: { id: true },
    take: 500,
  });
  const ids = people.map((p) => p.id);
  const rel = await prisma.sodamPersonRelation.findFirst({
    where: { id: relationId, fromPersonId: { in: ids } },
  });
  if (!rel) throw notFound('Relation not found');
  await prisma.sodamPersonRelation.delete({ where: { id: relationId } });
  return { ok: true as const };
}

export async function createRelation(
  bookId: string,
  code: string,
  input: { fromPersonId: string; toPersonId: string; type: SodamRelationType },
) {
  await requireBookAccess(bookId, code);
  const [from, to] = await Promise.all([
    prisma.sodamPerson.findFirst({ where: { id: input.fromPersonId, bookId } }),
    prisma.sodamPerson.findFirst({ where: { id: input.toPersonId, bookId } }),
  ]);
  if (!from || !to) throw notFound('Person not found');
  return prisma.sodamPersonRelation.create({
    data: {
      fromPersonId: input.fromPersonId,
      toPersonId: input.toPersonId,
      type: input.type,
    },
  });
}

export async function tree(bookId: string, code: string) {
  const [people, relations] = await Promise.all([
    listPeople(bookId, code),
    listRelations(bookId, code),
  ]);
  return { people, relations };
}

export async function listReturns(bookId: string, code: string, status?: SodamReturnStatus) {
  await requireBookAccess(bookId, code);
  const rows = await prisma.sodamReturnItem.findMany({
    where: { bookId, ...(status ? { status } : {}) },
    include: { person: true, fromEvent: true },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  return rows.map((r) => {
    const received = r.suggestedAmountVnd ?? 0;
    const returned = r.doneAmountVnd;
    return {
      ...r,
      personName: r.person.displayName,
      fromEventTitle: r.fromEvent.title,
      receivedAmountVnd: received,
      returnedAmountVnd: returned,
      overGivenVnd: returned != null ? Math.max(0, returned - received) : null,
    };
  });
}

export async function markReturn(
  bookId: string,
  returnId: string,
  code: string,
  input: { status: 'DONE' | 'SKIPPED' | 'OPEN'; amountVnd?: number },
) {
  await requireBookAccess(bookId, code);
  const item = await prisma.sodamReturnItem.findFirst({
    where: { id: returnId, bookId },
    include: { person: true },
  });
  if (!item) throw notFound('Return item not found');
  // Reopening (OPEN) clears the settlement entirely and ignores amountVnd.
  if (input.status !== 'OPEN' && input.amountVnd != null) assertAmountVnd(input.amountVnd);
  const received = item.suggestedAmountVnd ?? 0;
  const paid =
    input.status === 'DONE' ? Math.max(0, Math.round(input.amountVnd ?? received)) : null;
  const updated = await prisma.sodamReturnItem.update({
    where: { id: returnId },
    data: {
      status: input.status,
      doneAmountVnd: paid,
      doneAt: input.status === 'DONE' ? new Date() : null,
    },
    include: { person: true, fromEvent: true },
  });
  return {
    ...updated,
    personName: updated.person.displayName,
    fromEventTitle: updated.fromEvent.title,
    receivedAmountVnd: received,
    returnedAmountVnd: updated.doneAmountVnd,
    overGivenVnd:
      updated.doneAmountVnd != null ? Math.max(0, updated.doneAmountVnd - received) : null,
  };
}

export async function exportCsv(bookId: string, code: string) {
  await requireBookAccess(bookId, code);
  const events = await prisma.sodamEvent.findMany({
    where: { bookId },
    take: 50,
    include: { entries: { take: 200 } },
  });
  const lines = ['eventTitle,eventRole,personName,amountVnd,source,eventKindLabel'];
  for (const event of events) {
    for (const entry of event.entries) {
      lines.push(
        [
          event.title,
          event.role,
          entry.personName,
          String(entry.amountVnd),
          entry.source,
          sodamEventKindLabelVi(event.kind),
        ]
          .map((v) => (v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v))
          .join(','),
      );
    }
  }
  return { csv: lines.join('\n') };
}

export async function importCsv(bookId: string, code: string, csv: string) {
  await requireBookAccess(bookId, code);
  let event = await prisma.sodamEvent.findFirst({
    where: { bookId, status: 'OPEN' },
    orderBy: { updatedAt: 'desc' },
  });
  if (!event) {
    event = await createEvent(bookId, code, {
      title: 'Import CSV',
      kind: 'KHAC',
      role: 'HOSTED',
    });
  }
  const lines = csv.trim().split(/\r?\n/).slice(1);
  let imported = 0;
  for (const line of lines.slice(0, 100)) {
    const cols = parseCsvLine(line);
    if (cols.length < 4) continue;
    const personName = cols[2] ?? '';
    const amountVnd = Number(cols[3]);
    // Skip rows whose amount cannot fit the Int4 column instead of
    // aborting the whole import on the DB error (same skip semantics as
    // the non-finite check that was already here).
    if (!personName || !Number.isFinite(amountVnd) || amountVnd < 0 || amountVnd > INT4_MAX) {
      continue;
    }
    await createEntry(bookId, event.id, code, {
      personName,
      amountVnd,
      source: 'MANUAL',
    });
    imported += 1;
  }
  return { imported };
}

/**
 * Offline sync — FAITHFUL to the original design: only `createEntry`
 * mutations are applied; other mutation types are recorded as seen
 * (SodamSyncCursor) and acknowledged. See README "Known limitations".
 */
export async function sync(
  bookId: string,
  code: string,
  mutations: Array<{ clientMutationId: string; type: string; payload: Record<string, unknown> }>,
) {
  await requireBookAccess(bookId, code);
  const applied: string[] = [];
  for (const m of mutations.slice(0, 50)) {
    const seen = await prisma.sodamSyncCursor.findUnique({
      where: { clientMutationId: m.clientMutationId },
    });
    if (seen) {
      applied.push(m.clientMutationId);
      continue;
    }
    if (m.type === 'createEntry' && m.payload.eventId && m.payload.personName != null) {
      await createEntry(bookId, String(m.payload.eventId), code, {
        personName: String(m.payload.personName),
        amountVnd: Number(m.payload.amountVnd ?? 0),
        source: (m.payload.source as SodamEntrySource) ?? 'MANUAL',
        clientMutationId: m.clientMutationId,
      });
    }
    await prisma.sodamSyncCursor.create({
      data: { bookId, clientMutationId: m.clientMutationId },
    });
    applied.push(m.clientMutationId);
  }
  return { applied };
}

async function attachEventTotals<T extends { id: string }>(events: T[]) {
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

async function ensurePersonTx(tx: Tx, bookId: string, displayName: string, note = '') {
  const name = displayName.trim();
  const existing = await tx.sodamPerson.findFirst({
    where: { bookId, displayName: { equals: name, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return tx.sodamPerson.create({
    data: { bookId, displayName: name, note: note ?? '' },
  });
}

async function syncReturnForPersonEventTx(
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

function parseCsvLine(line: string): string[] {
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
