import { describe, expect, it } from 'vitest';
import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  generateInviteCode,
  hashInviteCode,
  inviteCodesMatch,
  normalizeInviteCode,
} from './invite-code';

describe('invite code (no-login book access)', () => {
  it('generates 16-char codes from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      // No 0/O/1/I/L — codes get read aloud and typed by hand in families.
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
    }
  });

  it('SEC-08 entropy: length × log2(real alphabet size) ≈ 79.27 bits (≥ 64)', () => {
    expect(INVITE_CODE_ALPHABET).toHaveLength(31);
    expect(INVITE_CODE_LENGTH).toBe(16);
    const bits = INVITE_CODE_LENGTH * Math.log2(INVITE_CODE_ALPHABET.length);
    expect(bits).toBeGreaterThanOrEqual(64);
    expect(bits).toBeCloseTo(79.27, 1);
  });

  it('does not repeat codes in practice (79-bit space)', () => {
    const seen = new Set(Array.from({ length: 2000 }, () => generateInviteCode()));
    expect(seen.size).toBe(2000);
  });

  it('normalizes case and surrounding spaces', () => {
    expect(normalizeInviteCode('  ab3k9z  ')).toBe('AB3K9Z');
    expect(normalizeInviteCode(undefined)).toBe('');
    expect(normalizeInviteCode(42)).toBe('');
  });

  it('hashInviteCode is a stable sha256 hex of the normalized code', () => {
    const code = generateInviteCode();
    const hash = hashInviteCode(code);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Stable across calls and insensitive to case / stray spaces.
    expect(hashInviteCode(code)).toBe(hash);
    expect(hashInviteCode(code.toLowerCase())).toBe(hash);
    expect(hashInviteCode(` ${code} `)).toBe(hash);
    // Different codes hash differently; the hash never equals the code.
    expect(hashInviteCode(generateInviteCode())).not.toBe(hash);
    expect(hash).not.toContain(code);
    expect(hashInviteCode(undefined)).toBe(hashInviteCode(''));
  });

  it('matches the right code regardless of typed case; rejects wrong/empty', () => {
    const code = generateInviteCode();
    expect(inviteCodesMatch(code, code)).toBe(true);
    expect(inviteCodesMatch(code.toLowerCase(), code)).toBe(true);
    expect(inviteCodesMatch(` ${code} `, code)).toBe(true);
    expect(inviteCodesMatch('SAI-MA-NAY-123', code)).toBe(false);
    expect(inviteCodesMatch('', code)).toBe(false);
    expect(inviteCodesMatch(undefined, code)).toBe(false);
    // Legacy 6-char codes issued before the refactor still match themselves.
    expect(inviteCodesMatch('a1b2c3', 'A1B2C3')).toBe(true);
  });
});
