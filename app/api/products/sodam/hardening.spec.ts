import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Route-level hardening tests (W4-F1 + LOWs, retested on the no-login build
 * 2026-10-23 — see ~/workspace/mini-apps/test-findings/sodam-retest-01.md).
 * Same in-memory Prisma fake pattern as route.spec.ts, extended with the
 * entry update + sync-cursor surface these tests need. The fake's entry
 * create throws a Prisma-shaped error for personName "BOOM" to simulate the
 * real DB error reaching the route — the response must stay generic.
 */

type Row = Record<string, unknown> & { id: string };

const PRISMA_LEAK =
  'Invalid `prisma.sodamEntry.create()` invocation:\n\nError occurred during query execution: ' +
  'ConnectorError(ConnectorError { kind: QueryError(Error { kind: ToSql(4), cause: Some(Error { kind: ConversionError("Unable to fit integer value \'2147483648\' into an INT4 (32-bit signed integer).") }) }) })';

const fake = vi.hoisted(() => {
  let seq = 0;
  const nextId = (p: string) => `${p}_${(seq += 1)}`;
  const tables: Record<string, Row[]> = {
    books: [],
    events: [],
    entries: [],
    people: [],
    returns: [],
    cursors: [],
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

  function entryRow(data: Record<string, unknown>): Row {
    if (data.personName === 'BOOM') throw new Error(PRISMA_LEAK);
    const row: Row = { id: nextId('ent'), createdAt: new Date(), updatedAt: new Date(), ...data };
    tables.entries.push(row);
    return row;
  }

  const entry = {
    findUnique: async (args: { where: Record<string, unknown> }) =>
      tables.entries.find((e) => match(e, args.where)) ?? null,
    findFirst: async (args: { where?: Record<string, unknown> }) => {
      const found = pick(tables.entries, args)[0];
      if (!found) return null;
      const ev = tables.events.find((e) => e.id === found.eventId);
      return { ...found, event: ev };
    },
    aggregate: async (args: { where?: Record<string, unknown> }) => aggregate(tables.entries, args),
  };

  const txEntry = {
    create: async (args: { data: Record<string, unknown> }) => entryRow(args.data),
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = tables.entries.find((e) => e.id === args.where.id);
      if (!row) throw new Error('Not found');
      Object.assign(row, args.data);
      return row;
    },
    aggregate: entry.aggregate,
  };

  const person = {
    count: async (args: { where?: Record<string, unknown> }) => pick(tables.people, args).length,
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
    findMany: async (args: { where?: Record<string, unknown>; take?: number }) =>
      pick(tables.people, args),
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

  const syncCursor = {
    findUnique: async (args: { where: Record<string, unknown> }) =>
      tables.cursors.find((c) => match(c, args.where)) ?? null,
    create: async (args: { data: Record<string, unknown> }) => {
      const row: Row = { id: nextId('cur'), createdAt: new Date(), ...args.data };
      tables.cursors.push(row);
      return row;
    },
  };

  const prisma = {
    sodamBook: book,
    sodamEvent: event,
    sodamEntry: entry,
    sodamPerson: person,
    sodamReturnItem: returnItem,
    sodamSyncCursor: syncCursor,
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({ sodamPerson: person, sodamEntry: txEntry, sodamReturnItem: returnItem }),
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

import { PATCH, POST } from './[[...path]]/route';

const FORBIDDEN = ['prisma', 'sodamEntry', 'INT4', 'ConversionError'];
const INT4_MAX = 2_147_483_647;

function req(method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request('http://test/api/products/sodam', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

beforeEach(() => fake.reset());

async function makeBookWithEvent() {
  const created = await POST(req('POST', { name: 'Sổ test' }), ctx(['books']));
  const book = (await created.json()) as { id: string; inviteCode: string };
  const auth = { 'x-book-code': book.inviteCode };
  const evRes = await POST(
    req('POST', { title: 'Cưới', kind: 'CUOI', role: 'HOSTED' }, auth),
    ctx(['books', book.id, 'events']),
  );
  const event = (await evRes.json()) as { id: string };
  return { book, event, auth };
}

function postEntry(bookId: string, eventId: string, auth: Record<string, string>, body: unknown) {
  return POST(req('POST', body, auth), ctx(['books', bookId, 'events', eventId, 'entries']));
}

describe('W4-F1 — amountVnd Int4 ceiling on every write path', () => {
  it('POST entry: 2147483647 → 200; 2147483648 → Vietnamese 400, no internals', async () => {
    const { book, event, auth } = await makeBookWithEvent();

    const ok = await postEntry(book.id, event.id, auth, {
      personName: 'Bác Tư',
      amountVnd: INT4_MAX,
    });
    expect(ok.status).toBe(200);

    const over = await postEntry(book.id, event.id, auth, {
      personName: 'Bác Tư',
      amountVnd: INT4_MAX + 1,
    });
    expect(over.status).toBe(400);
    const text = await over.text();
    for (const f of FORBIDDEN) expect(text).not.toContain(f);
    expect((JSON.parse(text) as { error: { message: string } }).error.message).toMatch(
      /vượt quá|tối đa/,
    );
  });

  it('PATCH entry: amountVnd 2147483648 → 400 (was a leaked 500 on the live build)', async () => {
    const { book, event, auth } = await makeBookWithEvent();
    const created = await postEntry(book.id, event.id, auth, {
      personName: 'Bác Tư',
      amountVnd: 500_000,
    });
    const entry = (await created.json()) as { id: string };

    const res = await PATCH(
      req('PATCH', { amountVnd: INT4_MAX + 1 }, auth),
      ctx(['books', book.id, 'events', event.id, 'entries', entry.id]),
    );
    expect(res.status).toBe(400);
    const text = await res.text();
    for (const f of FORBIDDEN) expect(text).not.toContain(f);
  });

  it('POST entry batch: a row over the ceiling → 400', async () => {
    const { book, event, auth } = await makeBookWithEvent();
    const res = await POST(
      req('POST', { rows: [{ personName: 'Bác Tư', amountVnd: INT4_MAX + 1 }] }, auth),
      ctx(['books', book.id, 'events', event.id, 'entries', 'batch']),
    );
    expect(res.status).toBe(400);
  });

  it('PATCH return: amountVnd over the ceiling → 400 (doneAmountVnd is Int4 too)', async () => {
    const { book, auth } = await makeBookWithEvent();
    const res = await PATCH(
      req('PATCH', { status: 'DONE', amountVnd: INT4_MAX + 1 }, auth),
      ctx(['books', book.id, 'returns', 'ret_whatever']),
    );
    expect(res.status).toBe(400);
  });

  it('offline sync: a queued createEntry over the ceiling → 400, not a leaked 500', async () => {
    const { book, event, auth } = await makeBookWithEvent();
    const res = await POST(
      req(
        'POST',
        {
          mutations: [
            {
              clientMutationId: 'mut-over-1',
              type: 'createEntry',
              payload: { eventId: event.id, personName: 'Bác Tư', amountVnd: INT4_MAX + 1 },
            },
          ],
        },
        auth,
      ),
      ctx(['books', book.id, 'sync']),
    );
    expect(res.status).toBe(400);
    const text = await res.text();
    for (const f of FORBIDDEN) expect(text).not.toContain(f);
  });

  it('a raw Prisma-shaped error from the DB layer surfaces as a generic Vietnamese 500', async () => {
    const { book, event, auth } = await makeBookWithEvent();
    const res = await postEntry(book.id, event.id, auth, {
      personName: 'BOOM',
      amountVnd: 500_000,
    });
    expect(res.status).toBe(500);
    const text = await res.text();
    for (const f of FORBIDDEN) expect(text).not.toContain(f);
    expect((JSON.parse(text) as { error: { message: string } }).error.message).toMatch(
      /máy chủ|thử lại/,
    );
  });
});

describe('W4 LOW — text length caps', () => {
  it('book name: 200 chars → 200; 201 chars → 400', async () => {
    const ok = await POST(req('POST', { name: 'a'.repeat(200) }), ctx(['books']));
    expect(ok.status).toBe(200);
    const over = await POST(req('POST', { name: 'a'.repeat(201) }), ctx(['books']));
    expect(over.status).toBe(400);
  });

  it('event title: 200 chars → 200; 201 and 10.007 chars → 400', async () => {
    const created = await POST(req('POST', { name: 'Sổ test' }), ctx(['books']));
    const book = (await created.json()) as { id: string; inviteCode: string };
    const auth = { 'x-book-code': book.inviteCode };
    const mk = (title: string) =>
      POST(
        req('POST', { title, kind: 'CUOI', role: 'HOSTED' }, auth),
        ctx(['books', book.id, 'events']),
      );
    expect((await mk('a'.repeat(200))).status).toBe(200);
    expect((await mk('a'.repeat(201))).status).toBe(400);
    expect((await mk('a'.repeat(10_007))).status).toBe(400);
  });

  it('entry personName 201 chars → 400; entry note 1001 chars → 400; note 1000 → 200', async () => {
    const { book, event, auth } = await makeBookWithEvent();
    const longName = await postEntry(book.id, event.id, auth, {
      personName: 'a'.repeat(201),
      amountVnd: 1000,
    });
    expect(longName.status).toBe(400);

    const longNote = await postEntry(book.id, event.id, auth, {
      personName: 'Bác Tư',
      amountVnd: 1000,
      note: 'a'.repeat(1001),
    });
    expect(longNote.status).toBe(400);

    const okNote = await postEntry(book.id, event.id, auth, {
      personName: 'Bác Tư',
      amountVnd: 1000,
      note: 'a'.repeat(1000),
    });
    expect(okNote.status).toBe(200);
  });
});
