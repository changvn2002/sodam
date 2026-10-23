import { prisma } from '../prisma';
import { HttpError, notFound } from '../errors';
import {
  JOIN_THROTTLE_LIMIT,
  JOIN_THROTTLE_WINDOW_MS,
  generateInviteCode,
  hashInviteCode,
  inviteCodesMatch,
  normalizeInviteCode,
} from '../invite-code';
import { logSecurityEvent } from '../log';
import {
  inviteHashMatches,
  publicBook,
  requireBookAccess,
  upgradeBookToHashedCode,
} from './internal';

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
  const out: Array<Omit<(typeof byHash)[number], 'inviteCodeHash'> & { inviteCode: string }> = [];
  for (const book of byHash) {
    if (seen.has(book.id)) continue;
    seen.add(book.id);
    const matched = normalized.find((c) => hashInviteCode(c) === book.inviteCodeHash);
    out.push({ ...publicBook(book), inviteCode: matched ?? '' });
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
    out.push({ ...publicBook(book), inviteCode: matched });
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
    return { ...publicBook(created), inviteCode: code };
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
    // SEC-13: sự kiện bảo mật có cấu trúc — chỉ IP dạng băm rút gọn,
    // không mã mời, không hash mã mời (xem lib/server/log.ts).
    logSecurityEvent('join_throttled', { route: '/books/join', ip });
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
    return { ...publicBook(byHash), inviteCode: normalized };
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
    return { ...publicBook(upgraded), inviteCode: normalized };
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
    // SEC-13: đổi mã mời là sự kiện bảo mật — ghi log có cấu trúc (không
    // ghi mã cũ/mới hay hash của chúng; bookId không phải credential).
    logSecurityEvent('invite_code_rotated', { route: '/books/:bookId/rotate-code', bookId });
    return { ...publicBook(updated), inviteCode: next };
  }
  throw new Error('Could not allocate a unique invite code');
}
