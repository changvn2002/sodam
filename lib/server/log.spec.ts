import { describe, expect, it, vi } from 'vitest';
import { hashIpForLog, logSecurityEvent } from './log';

/**
 * SEC-13: security-event logging must be ONE structured JSON line, carry a
 * timestamp + event + route, and must NEVER contain the raw IP or any
 * invite-code material — only the truncated SHA-256 `ipHash`.
 */
describe('logSecurityEvent (SEC-13)', () => {
  it('emits one JSON line with ts/level/event/route and a hashed, truncated IP', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      logSecurityEvent('join_throttled', { route: '/books/join', ip: '1.2.3.4' });
      expect(spy).toHaveBeenCalledTimes(1);
      const line = spy.mock.calls[0]![0] as string;
      expect(line).not.toContain('1.2.3.4');
      const parsed = JSON.parse(line) as Record<string, string>;
      expect(parsed.level).toBe('security');
      expect(parsed.event).toBe('join_throttled');
      expect(parsed.route).toBe('/books/join');
      expect(parsed.ipHash).toBe(hashIpForLog('1.2.3.4'));
      expect(parsed.ipHash).toHaveLength(16);
      expect(() => new Date(parsed.ts!).toISOString()).not.toThrow();
      expect(parsed.ts).toBe(new Date(parsed.ts!).toISOString());
    } finally {
      spy.mockRestore();
    }
  });

  it('omits ipHash entirely when no IP is known, and never logs code material', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      logSecurityEvent('invite_code_rotated', {
        route: '/books/:bookId/rotate-code',
        bookId: 'book_1',
      });
      const line = spy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(line) as Record<string, string>;
      expect(parsed.ipHash).toBeUndefined();
      expect(parsed.bookId).toBe('book_1');
      expect(line).not.toContain('inviteCode');
    } finally {
      spy.mockRestore();
    }
  });
});
