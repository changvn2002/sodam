import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Route-level tests for the no-login API. Prisma is replaced with a small
 * in-memory fake so the REAL route dispatch + service code runs end to end:
 * create book → (code is the only credential) → event → entry → dashboard.
 * The point of this suite: nothing in the book flow answers 401 anymore,
 * and a missing/wrong invite code answers 404 — never data.
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

import { GET, POST } from './[[...path]]/route';

function req(method: string, path: string[], body?: unknown, headers: Record<string, string> = {}) {
  return new Request('http://test/api/products/sodam', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

beforeEach(() => fake.reset());

describe('sodam API — no login', () => {
  it('status endpoint is public (no credential at all)', async () => {
    const res = await GET(req('GET', []), ctx([]));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { product: { slug: string } };
    expect(data.product.slug).toBe('sodam');
  });

  it('create book → join by code → /books/mine resolves it, all without any auth header', async () => {
    const created = await POST(req('POST', ['books'], { name: 'Sổ cưới 2026' }), ctx(['books']));
    expect(created.status).toBe(200);
    const book = (await created.json()) as { id: string; inviteCode: string };
    expect(book.inviteCode).toHaveLength(12);

    const mine = await POST(
      req('POST', ['books', 'mine'], { codes: [book.inviteCode] }),
      ctx(['books', 'mine']),
    );
    expect(mine.status).toBe(200);
    const list = (await mine.json()) as Array<{ id: string }>;
    expect(list.map((b) => b.id)).toEqual([book.id]);

    const joined = await POST(
      req('POST', ['books', 'join'], { inviteCode: book.inviteCode.toLowerCase() }),
      ctx(['books', 'join']),
    );
    expect(joined.status).toBe(200);

    const badJoin = await POST(
      req('POST', ['books', 'join'], { inviteCode: 'MA-SAI-HOAN-TOAN' }),
      ctx(['books', 'join']),
    );
    expect(badJoin.status).toBe(404);
  });

  it('book flow (event → entry → dashboard totals) works with only the book code — never 401', async () => {
    const created = await POST(req('POST', ['books'], { name: 'Sổ nhà' }), ctx(['books']));
    const book = (await created.json()) as { id: string; inviteCode: string };
    const auth = { 'x-book-code': book.inviteCode };

    // No code at all → 404 Book not found (the old behavior was 401 login).
    const noCode = await GET(
      req('GET', ['books', book.id, 'dashboard']),
      ctx(['books', book.id, 'dashboard']),
    );
    expect(noCode.status).toBe(404);

    // Wrong code → same 404, no data leak, still not 401.
    const wrongCode = await GET(
      req('GET', ['books', book.id, 'dashboard'], undefined, { 'x-book-code': 'SAI123456789' }),
      ctx(['books', book.id, 'dashboard']),
    );
    expect(wrongCode.status).toBe(404);

    const evRes = await POST(
      req(
        'POST',
        ['books', book.id, 'events'],
        { title: 'Cưới', kind: 'CUOI', role: 'HOSTED' },
        auth,
      ),
      ctx(['books', book.id, 'events']),
    );
    expect(evRes.status).toBe(200);
    const event = (await evRes.json()) as { id: string };

    const entryRes = await POST(
      req(
        'POST',
        ['books', book.id, 'events', event.id, 'entries'],
        { personName: 'Bác Tư', amountVnd: 1_000_000 },
        auth,
      ),
      ctx(['books', book.id, 'events', event.id, 'entries']),
    );
    expect(entryRes.status).toBe(200);

    const dashRes = await GET(
      req('GET', ['books', book.id, 'dashboard'], undefined, auth),
      ctx(['books', book.id, 'dashboard']),
    );
    expect(dashRes.status).toBe(200);
    const dash = (await dashRes.json()) as {
      totals: { receivedGrossVnd: number; people: number };
      openReturnCount: number;
    };
    expect(dash.totals.receivedGrossVnd).toBe(1_000_000);
    expect(dash.totals.people).toBe(1);
    // HOSTED entry must have created a pending return obligation.
    expect(dash.openReturnCount).toBe(1);
  });

  it('removed auth routes do not exist in this route tree (login is gone, not just unused)', async () => {
    const res = await POST(
      req('POST', ['login'], { email: 'a@b.c', password: 'whatever1' }),
      ctx(['login']),
    );
    expect(res.status).toBe(404);
  });
});
