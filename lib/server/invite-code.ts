import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Book access codes for the no-login model. The invite code IS the credential:
 * whoever holds it (typed in, or via a share link) can open the book.
 *
 * New codes are 12 characters from a 32-symbol unambiguous alphabet
 * (no 0/O/1/I/L), drawn from crypto.randomBytes → 12 × 5 = 60 bits of
 * entropy. Legacy 6-char codes issued before the no-login refactor keep
 * working — comparison is exact after normalization.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 12;

export function generateInviteCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return code;
}

/** Trim + uppercase so codes typed by hand (any case, stray spaces) match. */
export function normalizeInviteCode(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toUpperCase() : '';
}

/**
 * Constant-time comparison. Both sides are hashed first so the compare never
 * leaks length or prefix and timingSafeEqual always sees equal-size buffers.
 */
export function inviteCodesMatch(provided: unknown, actual: string): boolean {
  const a = createHash('sha256').update(normalizeInviteCode(provided)).digest();
  const b = createHash('sha256').update(normalizeInviteCode(actual)).digest();
  return timingSafeEqual(a, b);
}
