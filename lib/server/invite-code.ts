import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Book access codes for the no-login model. The invite code IS the credential:
 * whoever holds it (typed in, or via a share link) can open the book.
 *
 * SEC-08 v2 (new books only): codes are 16 characters from a 31-symbol
 * unambiguous alphabet (no 0/O/1/I/L), drawn from crypto.randomBytes with
 * rejection sampling — only bytes < 248 (= 31 × 8, the largest multiple of
 * 31 that fits in a byte) are accepted and mapped with % 31, so every symbol
 * is equally likely (no modulo bias). Entropy = 16 × log2(31) ≈ 79.27 bits.
 *
 * The plaintext code is NEVER stored for v2 books: only its SHA-256 hash
 * (`inviteCodeHash`) lands in the database, so a database leak does not
 * hand out working credentials. Legacy books still carry a plaintext
 * `inviteCode`; they verify through `inviteCodesMatch` and are upgraded to
 * the hashed form opportunistically on first successful use.
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ALPHABET = INVITE_CODE_ALPHABET;
export const INVITE_CODE_LENGTH = 16;

/** Largest multiple of the alphabet size (31) that fits in one byte: 31 × 8. */
const REJECTION_LIMIT = 248;

/** Join throttling (SEC-08): failed-join budget per scope before a 429. */
export const JOIN_THROTTLE_LIMIT = 10;
export const JOIN_THROTTLE_WINDOW_MS = 15 * 60 * 1000;

export function generateInviteCode(): string {
  let code = '';
  while (code.length < INVITE_CODE_LENGTH) {
    const bytes = randomBytes(INVITE_CODE_LENGTH * 2);
    for (const byte of bytes) {
      if (code.length >= INVITE_CODE_LENGTH) break;
      // Rejection sampling: bytes >= 248 would skew the distribution
      // toward the first symbols of the alphabet — discard them.
      if (byte >= REJECTION_LIMIT) continue;
      code += ALPHABET[byte % ALPHABET.length];
    }
  }
  return code;
}

/** Trim + uppercase so codes typed by hand (any case, stray spaces) match. */
export function normalizeInviteCode(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toUpperCase() : '';
}

/** SHA-256 hex of the normalized code — the only form stored for v2 books. */
export function hashInviteCode(code: unknown): string {
  return createHash('sha256').update(normalizeInviteCode(code)).digest('hex');
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
