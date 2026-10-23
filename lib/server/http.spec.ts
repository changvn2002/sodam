import { describe, expect, it } from 'vitest';
import { HttpError } from './errors';
import { handle, INT4_MAX, optIntMin0, optString, reqIntMin0, reqString } from './http';

/**
 * Hardening tests (W4-F1 retest on the no-login build, 2026-10-23):
 * - integer inputs that land in Int4 columns need an upper bound — the old
 *   `reqIntMin0` let 2147483648 through to Postgres, which answered 500;
 * - string inputs need length caps — a 10.007-char event title was stored
 *   verbatim;
 * - `handle()` must never serialize a raw ORM/DB error to the client.
 */

const FORBIDDEN = ['prisma', 'sodamEntry', 'INT4', 'ConversionError'];

describe('reqIntMin0 — Int4 ceiling', () => {
  it('accepts the exact Int4 max (2147483647)', () => {
    expect(reqIntMin0({ amountVnd: INT4_MAX }, 'amountVnd')).toBe(2_147_483_647);
  });

  it('rejects Int4 max + 1 with a Vietnamese 400', () => {
    try {
      reqIntMin0({ amountVnd: INT4_MAX + 1 }, 'amountVnd');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(400);
      // Friendly Vietnamese message, no internals.
      expect((err as Error).message).toMatch(/vượt quá|tối đa/);
      for (const f of FORBIDDEN) expect((err as Error).message).not.toContain(f);
    }
  });

  it('still rejects negatives, non-integers and non-numbers like before', () => {
    expect(() => reqIntMin0({ amountVnd: -1 }, 'amountVnd')).toThrow(HttpError);
    expect(() => reqIntMin0({ amountVnd: 1.5 }, 'amountVnd')).toThrow(HttpError);
    expect(() => reqIntMin0({ amountVnd: '500' }, 'amountVnd')).toThrow(HttpError);
    expect(() => reqIntMin0({}, 'amountVnd')).toThrow(HttpError);
  });

  it('optIntMin0: undefined passes through, overflow is rejected', () => {
    expect(optIntMin0({}, 'amountVnd')).toBeUndefined();
    expect(optIntMin0({ amountVnd: 0 }, 'amountVnd')).toBe(0);
    expect(() => optIntMin0({ amountVnd: INT4_MAX + 1 }, 'amountVnd')).toThrow(HttpError);
  });
});

describe('reqString / optString — length caps', () => {
  it('accepts a string exactly at the cap and rejects cap + 1 with a Vietnamese 400', () => {
    expect(reqString({ title: 'a'.repeat(200) }, 'title', 1, 200)).toHaveLength(200);
    try {
      reqString({ title: 'a'.repeat(201) }, 'title', 1, 200);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(400);
      expect((err as Error).message).toMatch(/quá dài|tối đa/);
    }
  });

  it('without a cap argument, long strings still pass (CSV import relies on this)', () => {
    expect(reqString({ csv: 'x'.repeat(50_000) }, 'csv', 0)).toHaveLength(50_000);
  });

  it('optString: null passes through, over-cap is rejected', () => {
    expect(optString({}, 'note', 1000)).toBeUndefined();
    expect(optString({ note: 'ok' }, 'note', 1000)).toBe('ok');
    expect(() => optString({ note: 'a'.repeat(1001) }, 'note', 1000)).toThrow(HttpError);
  });
});

describe('handle() — error serialization', () => {
  it('never leaks a raw Prisma/DB error: unexpected errors become a generic Vietnamese 500', async () => {
    const prismaLike = new Error(
      'Invalid `prisma.sodamEntry.create()` invocation:\n\nError occurred during query execution: ' +
        'ConnectorError(ConnectorError { kind: QueryError(Error { kind: ToSql(4), cause: Some(Error { kind: ConversionError("Unable to fit integer value \'2147483648\' into an INT4 (32-bit signed integer).") }) }) })',
    );
    const res = await handle(async () => {
      throw prismaLike;
    });
    expect(res.status).toBe(500);
    const text = await res.text();
    for (const f of FORBIDDEN) expect(text).not.toContain(f);
    const body = JSON.parse(text) as { message: string };
    expect(body.message).toMatch(/máy chủ|thử lại/);
  });

  it('HttpError keeps its own status + message (client-facing errors stay specific)', async () => {
    const res = await handle(async () => {
      throw new HttpError(404, 'Book not found');
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: 'Book not found' });
  });

  it('successful handlers still return their payload as JSON', async () => {
    const res = await handle(async () => ({ ok: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
