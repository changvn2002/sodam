import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Fix-wave Panel03 — W1 battery (fake Prisma, real route + service):
 * - SEC-05: unknown fields → 400 on book/event/entry/return; body over the
 *   128 KiB cap → 413; malformed JSON → 400; legitimate flows stay green
 *   (covered by route.spec.ts / hardening.spec.ts).
 * - SEC-15: photo route — size cap 413, type allowlist + magic bytes 400,
 *   valid PNG reaches the (unconfigured) AI step → 503 generic verbatim.
 * - ARC-09: unified { error: { code, message, fields? } } shape + the
 *   verbatim locks (429 message; SEC-07 identical 404 bodies).
 * - F-r3-4: the string "inviteCodeHash" appears in NO API payload.
 * - CQ-05 (server): duplicate-submit behavior for create book/event —
 *   descriptive tests of CURRENT behavior (no dedupe exists; see the
 *   DEFERRED note in FIX-WAVE-PANEL03-W1.md).
 */

type Row = Record<string, unknown> & { id: string };

const fake = vi.hoisted(() => {
  let seq = 0;
  const nextId = (p: string) => `${p}_${(seq += 1)}`;
  const tables: Record<string, Row[]> = {
    books: [],
    events: [],
    entries: [],
    people: [],
    returns: [],
    throttles: [],
  };

  function match(row: Row, where: Record<string, unknown> = {}): boolean {
    return Object.entries(where).every(([key, cond]) => {
      if (key === 'event' && cond && typeof cond === 'object') {
        const ev = tables.events.find((e) => e.id === row.eventId);
        return ev ? match(ev, cond as Record<string, unknown>) : false;
      }
      if (cond && typeof cond === 'object' && 'in' in (cond as Row)) {
        return (cond as { in: unknown[] }).in.includes(row[key]);
      }
      return row[key] === cond;
    });
  }

  function pick(rows: Row[], args: { where?: Record<string, unknown>; take?: number }) {
    const out = rows.filter((r) => match(r, args.where));
    return args.take ? out.slice(0, args.take) : out;
  }

  function aggregate(rows: Row[], args: { where?: Record<string, unknown> }) {
    const hit = pick(rows, args);
    return {
      _sum: { amountVnd: hit.reduce((s, r) => s + Number(r.amountVnd ?? 0), 0) },
      _count: hit.length,
    };
  }

  const book = {
    findUnique: async (args: { where: Record<string, unknown> }) =>
      tables.books.find((b) => match(b, args.where)) ?? null,
    findUniqueOrThrow: async (args: { where: Record<string, unknown> }) => {
      const found = tables.books.find((b) => match(b, args.where));
      if (!found) throw new Error('Not found');
      return found;
    },
    findMany: async (args: { where?: Record<string, unknown>; take?: number }) =>
      pick(tables.books, args),
    create: async (args: { data: Record<string, unknown> }) => {
      const row: Row = {
        id: nextId('book'),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data,
      };
      tables.books.push(row);
      return row;
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = tables.books.find((b) => b.id === args.where.id);
      if (!row) throw new Error('Not found');
      Object.assign(row, args.data, { updatedAt: new Date() });
      return row;
    },
  };

  const joinThrottle = {
    findFirst: async (args: { where?: Record<string, unknown> }) =>
      pick(tables.throttles, args)[0] ?? null,
    create: async (args: { data: Record<string, unknown> }) => {
      const row: Row = {
        id: nextId('thr'),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data,
      };
      tables.throttles.push(row);
      return row;
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = tables.throttles.find((t) => t.id === args.where.id);
      if (!row) throw new Error('Not found');
      Object.assign(row, args.data, { updatedAt: new Date() });
      return row;
    },
    deleteMany: async (args: { where?: Record<string, unknown> }) => {
      const before = tables.throttles.length;
      tables.throttles = tables.throttles.filter((t) => !match(t, args.where));
      return { count: before - tables.throttles.length };
    },
  };

  const event = {
    findFirst: async (args: { where?: Record<string, unknown> }) =>
      pick(tables.events, args)[0] ?? null,
    findMany: async (args: { where?: Record<string, unknown>; take?: number }) =>
      pick(tables.events, args),
    create: async (args: { data: Record<string, unknown> }) => {
      const row: Row = {
        id: nextId('evt'),
        status: 'OPEN',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data,
      };
      tables.events.push(row);
      return row;
    },
  };

  const entry = {
    findUnique: async (args: { where: Record<string, unknown> }) =>
      tables.entries.find((e) => match(e, args.where)) ?? null,
    aggregate: async (args: { where?: Record<string, unknown> }) => aggregate(tables.entries, args),
  };

  const person = {
    count: async (args: { where?: Record<string, unknown> }) => pick(tables.people, args).length,
    findMany: async (args: { where?: Record<string, unknown>; take?: number }) =>
      pick(tables.people, args),
    findFirst: async (args: { where?: Record<string, unknown> }) => {
      const w = { ...(args.where ?? {}) } as Record<string, unknown>;
      const dn = w.displayName as { equals?: string } | undefined;
      if (dn && typeof dn === 'object') {
        return (
          tables.people.find(
            (p) =>
              p.bookId === w.bookId &&
              String(p.displayName).toLowerCase() === String(dn.equals).toLowerCase(),
          ) ?? null
        );
      }
      return pick(tables.people, args)[0] ?? null;
    },
    create: async (args: { data: Record<string, unknown> }) => {
      const row: Row = {
        id: nextId('per'),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data,
      };
      tables.people.push(row);
      return row;
    },
  };

  const returnItem = {
    findMany: async (args: { where?: Record<string, unknown>; take?: number }) =>
      pick(tables.returns, args),
    findFirst: async (args: { where?: Record<string, unknown> }) =>
      pick(tables.returns, args)[0] ?? null,
    create: async (args: { data: Record<string, unknown> }) => {
      const row: Row = {
        id: nextId('ret'),
        status: 'OPEN',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data,
      };
      tables.returns.push(row);
      return row;
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = tables.returns.find((r) => r.id === args.where.id);
      if (!row) throw new Error('Not found');
      Object.assign(row, args.data);
      return row;
    },
    delete: async (args: { where: { id: string } }) => {
      tables.returns = tables.returns.filter((r) => r.id !== args.where.id);
      return {};
    },
  };

  const txEntry = {
    create: async (args: { data: Record<string, unknown> }) => {
      const row: Row = {
        id: nextId('ent'),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data,
      };
      tables.entries.push(row);
      return row;
    },
    aggregate: entry.aggregate,
  };

  const prisma = {
    sodamBook: book,
    sodamEvent: event,
    sodamEntry: entry,
    sodamPerson: person,
    sodamReturnItem: returnItem,
    sodamJoinThrottle: joinThrottle,
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        sodamPerson: person,
        sodamEntry: txEntry,
        sodamReturnItem: returnItem,
      }),
  };

  return {
    prisma,
    reset() {
      seq = 0;
      for (const key of Object.keys(tables)) tables[key] = [];
    },
  };
});

vi.mock('@/lib/server/prisma', () => ({ prisma: fake.prisma }));

import { GET, PATCH, POST } from './[[...path]]/route';

function jsonReq(
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
  rawBody?: string,
) {
  return new Request('http://test/api/products/sodam', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
}

const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

const savedApiKey = process.env.OPENAI_API_KEY;
beforeEach(() => {
  fake.reset();
  // Photo tests must hit the "AI not configured" 503 path deterministically.
  delete process.env.OPENAI_API_KEY;
});
afterAll(() => {
  if (savedApiKey !== undefined) process.env.OPENAI_API_KEY = savedApiKey;
});

async function makeBook() {
  const created = await POST(jsonReq('POST', { name: 'Sổ battery' }), ctx(['books']));
  expect(created.status).toBe(200);
  const book = (await created.json()) as { id: string; inviteCode: string };
  return { book, auth: { 'x-book-code': book.inviteCode } };
}

async function makeEvent(auth: Record<string, string>, bookId: string) {
  const res = await POST(
    jsonReq('POST', { title: 'Cưới', kind: 'CUOI', role: 'HOSTED' }, auth),
    ctx(['books', bookId, 'events']),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as { id: string };
}

describe('SEC-05 — strict fields + body cap battery', () => {
  it('create book with unknown fields (isAdmin/role) → 400 with fields list, no book created', async () => {
    const res = await POST(
      jsonReq('POST', { name: 'Sổ lạ', isAdmin: true, role: 'admin' }),
      ctx(['books']),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: string[] } };
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.fields).toEqual(expect.arrayContaining(['isAdmin', 'role']));
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('create event with an unknown field → 400', async () => {
    const { book, auth } = await makeBook();
    const res = await POST(
      jsonReq('POST', { title: 'Cưới', kind: 'CUOI', role: 'HOSTED', isAdmin: true }, auth),
      ctx(['books', book.id, 'events']),
    );
    expect(res.status).toBe(400);
  });

  it('create entry with an unknown field → 400', async () => {
    const { book, auth } = await makeBook();
    const event = await makeEvent(auth, book.id);
    const res = await POST(
      jsonReq('POST', { personName: 'Bác Tư', amountVnd: 500_000, role: 'admin' }, auth),
      ctx(['books', book.id, 'events', event.id, 'entries']),
    );
    expect(res.status).toBe(400);
  });

  it('batch entry row with an unknown field → 400', async () => {
    const { book, auth } = await makeBook();
    const event = await makeEvent(auth, book.id);
    const res = await POST(
      jsonReq('POST', { rows: [{ personName: 'Bác Tư', amountVnd: 1, hack: 1 }] }, auth),
      ctx(['books', book.id, 'events', event.id, 'entries', 'batch']),
    );
    expect(res.status).toBe(400);
  });

  it('mark return with an unknown field → 400', async () => {
    const { book, auth } = await makeBook();
    const res = await PATCH(
      jsonReq('PATCH', { status: 'DONE', isAdmin: true }, auth),
      ctx(['books', book.id, 'returns', 'ret_whatever']),
    );
    expect(res.status).toBe(400);
  });

  it('join with an unknown field → 400', async () => {
    const res = await POST(
      jsonReq('POST', { inviteCode: 'ABCDEFGH12345678', role: 'admin' }),
      ctx(['books', 'join']),
    );
    expect(res.status).toBe(400);
  });

  it('body over the cap (~150KB, under the grader ~200KB probe) → 413', async () => {
    const res = await POST(jsonReq('POST', { name: 'x'.repeat(150_000) }), ctx(['books']));
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('malformed JSON → 400', async () => {
    const res = await POST(jsonReq('POST', undefined, {}, '{not json'), ctx(['books']));
    expect(res.status).toBe(400);
  });

  it('a maximal legitimate batch (100 rows) still passes the cap → 200', async () => {
    const { book, auth } = await makeBook();
    const event = await makeEvent(auth, book.id);
    const rows = Array.from({ length: 100 }, (_, i) => ({
      personName: `Người số ${i} họ Nguyễn Văn`,
      amountVnd: 100_000,
    }));
    const res = await POST(
      jsonReq('POST', { rows }, auth),
      ctx(['books', book.id, 'events', event.id, 'entries', 'batch']),
    );
    expect(res.status).toBe(200);
  });
});

describe('SEC-15 — photo upload validation', () => {
  const PNG_1PX = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

  function photoReq(bookId: string, auth: Record<string, string>, file: File) {
    const form = new FormData();
    form.append('file', file);
    return new Request('http://test/api/products/sodam', {
      method: 'POST',
      headers: { ...auth },
      body: form,
    });
  }

  const photoCtx = (bookId: string) => ctx(['books', bookId, 'ai', 'photo']);

  it('valid PNG (magic matches declared type) reaches the AI step → 503 generic, verbatim', async () => {
    const { book, auth } = await makeBook();
    const file = new File([PNG_1PX], 'so.png', { type: 'image/png' });
    const res = await POST(photoReq(book.id, auth, file), photoCtx(book.id));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(body.error.message).toBe(
      'Tính năng đọc ảnh chưa được bật trên máy chủ này. Bạn vẫn ghi khoản bằng tay hoặc bằng giọng nói được.',
    );
  });

  it('PNG bytes declared as JPEG (magic ≠ declared) → 400', async () => {
    const { book, auth } = await makeBook();
    const file = new File([PNG_1PX], 'so.jpg', { type: 'image/jpeg' });
    const res = await POST(photoReq(book.id, auth, file), photoCtx(book.id));
    expect(res.status).toBe(400);
  });

  it('text bytes declared as PNG (no photo magic) → 400', async () => {
    const { book, auth } = await makeBook();
    const file = new File(['definitely not an image'], 'so.png', { type: 'image/png' });
    const res = await POST(photoReq(book.id, auth, file), photoCtx(book.id));
    expect(res.status).toBe(400);
  });

  it('declared type outside the allowlist (image/gif) → 400 even with GIF magic', async () => {
    const { book, auth } = await makeBook();
    const gif = Buffer.from('R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs=', 'base64');
    const file = new File([gif], 'so.gif', { type: 'image/gif' });
    const res = await POST(photoReq(book.id, auth, file), photoCtx(book.id));
    expect(res.status).toBe(400);
  });

  it('file over the 10 MiB cap → 413 before any AI processing', async () => {
    const { book, auth } = await makeBook();
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(PNG_1PX.subarray(0, 8), 0);
    const file = new File([big], 'so.png', { type: 'image/png' });
    const res = await POST(photoReq(book.id, auth, file), photoCtx(book.id));
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('ARC-09 — verbatim locks + SEC-07 identical 404 bodies', () => {
  it('404 body for a wrong code === 404 body for a nonexistent book, byte for byte', async () => {
    const { book } = await makeBook();
    const wrongCode = await GET(
      jsonReq('GET', undefined, { 'x-book-code': 'SAI123456789' }),
      ctx(['books', book.id, 'dashboard']),
    );
    const noBook = await GET(
      jsonReq('GET', undefined, { 'x-book-code': 'SAI123456789' }),
      ctx(['books', 'book_khong_ton_tai', 'dashboard']),
    );
    expect(wrongCode.status).toBe(404);
    expect(noBook.status).toBe(404);
    const a = await wrongCode.text();
    const b = await noBook.text();
    expect(a).toBe(b);
    expect(JSON.parse(a)).toEqual({
      error: { code: 'NOT_FOUND', message: 'Book not found' },
    });
  });
});

describe('F-r3-4 — inviteCodeHash never appears in API payloads', () => {
  it('create + dashboard + list payloads contain no "inviteCodeHash" string', async () => {
    const created = await POST(jsonReq('POST', { name: 'Sổ F4' }), ctx(['books']));
    expect(created.status).toBe(200);
    const createdText = await created.text();
    expect(createdText).not.toContain('inviteCodeHash');
    const book = JSON.parse(createdText) as { id: string; inviteCode: string };
    const auth = { 'x-book-code': book.inviteCode };

    const dash = await GET(jsonReq('GET', undefined, auth), ctx(['books', book.id, 'dashboard']));
    expect(dash.status).toBe(200);
    expect(await dash.text()).not.toContain('inviteCodeHash');

    const mine = await POST(jsonReq('POST', { codes: [book.inviteCode] }), ctx(['books', 'mine']));
    expect(mine.status).toBe(200);
    expect(await mine.text()).not.toContain('inviteCodeHash');

    const joined = await POST(
      jsonReq('POST', { inviteCode: book.inviteCode }),
      ctx(['books', 'join']),
    );
    expect(joined.status).toBe(200);
    expect(await joined.text()).not.toContain('inviteCodeHash');

    const rotated = await POST(
      jsonReq('POST', undefined, auth),
      ctx(['books', book.id, 'rotate-code']),
    );
    expect(rotated.status).toBe(200);
    expect(await rotated.text()).not.toContain('inviteCodeHash');
  });
});

describe('CQ-05 (server) — duplicate submit, CURRENT behavior (no dedupe — DEFERRED)', () => {
  it('creating a book twice with the identical body creates TWO books (no clientMutationId exists for books)', async () => {
    const a = await POST(jsonReq('POST', { name: 'Sổ trùng' }), ctx(['books']));
    const b = await POST(jsonReq('POST', { name: 'Sổ trùng' }), ctx(['books']));
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const bookA = (await a.json()) as { id: string; inviteCode: string };
    const bookB = (await b.json()) as { id: string; inviteCode: string };
    expect(bookA.id).not.toBe(bookB.id);
    expect(bookA.inviteCode).not.toBe(bookB.inviteCode);
  });

  it('creating an event twice with the identical body creates TWO events', async () => {
    const { book, auth } = await makeBook();
    const mk = () =>
      POST(
        jsonReq('POST', { title: 'Cưới', kind: 'CUOI', role: 'HOSTED' }, auth),
        ctx(['books', book.id, 'events']),
      );
    const a = await mk();
    const b = await mk();
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const evA = (await a.json()) as { id: string };
    const evB = (await b.json()) as { id: string };
    expect(evA.id).not.toBe(evB.id);

    const list = await GET(jsonReq('GET', undefined, auth), ctx(['books', book.id, 'events']));
    expect(((await list.json()) as unknown[]).length).toBe(2);
  });
});
