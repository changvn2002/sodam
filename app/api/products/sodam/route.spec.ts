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
    throttles: [],
    relations: [],
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

  function withReturnIncludes(row: Row | null, include?: Record<string, unknown>): Row | null {
    if (!row || !include) return row;
    const out: Row = { ...row };
    if (include.person) {
      out.person = tables.people.find((p) => p.id === row.personId) ?? null;
    }
    if (include.fromEvent) {
      out.fromEvent = tables.events.find((e) => e.id === row.fromEventId) ?? null;
    }
    return out;
  }

  const returnItem = {
    findMany: async (args: {
      where?: Record<string, unknown>;
      take?: number;
      include?: Record<string, unknown>;
    }) => pick(tables.returns, args).map((r) => withReturnIncludes(r, args.include)!),
    findFirst: async (args: {
      where?: Record<string, unknown>;
      include?: Record<string, unknown>;
    }) => withReturnIncludes(pick(tables.returns, args)[0] ?? null, args.include),
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
    update: async (args: {
      where: { id: string };
      data: Record<string, unknown>;
      include?: Record<string, unknown>;
    }) => {
      const row = tables.returns.find((r) => r.id === args.where.id);
      if (!row) throw new Error('Not found');
      Object.assign(row, args.data);
      return withReturnIncludes(row, args.include);
    },
    delete: async (args: { where: { id: string } }) => {
      tables.returns = tables.returns.filter((r) => r.id !== args.where.id);
      return {};
    },
  };

  const relation = {
    findMany: async (args: { where?: Record<string, unknown>; take?: number }) =>
      pick(tables.relations, args),
    findFirst: async (args: { where?: Record<string, unknown> }) =>
      pick(tables.relations, args)[0] ?? null,
    create: async (args: { data: Record<string, unknown> }) => {
      const row: Row = {
        id: nextId('rel'),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data,
      };
      tables.relations.push(row);
      return row;
    },
    delete: async (args: { where: { id: string } }) => {
      tables.relations = tables.relations.filter((r) => r.id !== args.where.id);
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
    sodamPersonRelation: relation,
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

import { DELETE, GET, PATCH, POST } from './[[...path]]/route';
import { hashInviteCode } from '@/lib/server/invite-code';

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
    expect(book.inviteCode).toHaveLength(16);

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

describe('SEC-08 — hashed invite codes + join throttling', () => {
  const join = (inviteCode: string, ip?: string) =>
    POST(
      req('POST', ['books', 'join'], { inviteCode }, ip ? { 'x-forwarded-for': ip } : {}),
      ctx(['books', 'join']),
    );

  const seedLegacyBook = async (code: string) =>
    fake.prisma.sodamBook.create({
      data: { name: 'Sổ cũ', inviteCode: code, inviteCodeHash: null },
    } as never) as Promise<{ id: string }>;

  const storedBook = async (id: string) =>
    fake.prisma.sodamBook.findUnique({ where: { id } } as never) as Promise<{
      inviteCode: string | null;
      inviteCodeHash: string | null;
    } | null>;

  it('(ii) new book: row stores hash only (inviteCode null), response carries the plaintext code; wrong code → 404', async () => {
    const created = await POST(req('POST', ['books'], { name: 'Sổ mới' }), ctx(['books']));
    expect(created.status).toBe(200);
    const book = (await created.json()) as { id: string; inviteCode: string };
    expect(book.inviteCode).toHaveLength(16);

    const row = await storedBook(book.id);
    expect(row?.inviteCode).toBeNull();
    expect(row?.inviteCodeHash).toBe(hashInviteCode(book.inviteCode));

    const ok = await join(book.inviteCode);
    expect(ok.status).toBe(200);
    const joined = (await ok.json()) as { id: string; inviteCode: string };
    expect(joined.id).toBe(book.id);
    expect(joined.inviteCode).toBe(book.inviteCode);

    const wrong = await join('SAI-MA-HOAN-TOAN-99');
    expect(wrong.status).toBe(404);
  });

  it('(i) legacy plaintext book: join succeeds, row upgrades to hash + null plaintext, second join uses the hash path', async () => {
    const legacy = await seedLegacyBook('LEGACYCODE1');
    const first = await join('legacycode1');
    expect(first.status).toBe(200);

    const row = await storedBook(legacy.id);
    expect(row?.inviteCode).toBeNull();
    expect(row?.inviteCodeHash).toBe(hashInviteCode('LEGACYCODE1'));

    const second = await join('LEGACYCODE1');
    expect(second.status).toBe(200);
    const joined = (await second.json()) as { id: string };
    expect(joined.id).toBe(legacy.id);
  });

  it('(iii) /books/mine resolves both hash-only and legacy books, and upgrades the legacy row', async () => {
    const created = await POST(req('POST', ['books'], { name: 'Sổ mới' }), ctx(['books']));
    const fresh = (await created.json()) as { id: string; inviteCode: string };
    const legacy = await seedLegacyBook('LEGACYCODE2');

    const mine = await POST(
      req('POST', ['books', 'mine'], { codes: [fresh.inviteCode, 'legacycode2'] }),
      ctx(['books', 'mine']),
    );
    expect(mine.status).toBe(200);
    const list = (await mine.json()) as Array<{ id: string; inviteCode: string }>;
    expect(list.map((b) => b.id).sort()).toEqual([fresh.id, legacy.id].sort());
    // Each book comes back with the very code the client presented for it.
    expect(list.find((b) => b.id === fresh.id)?.inviteCode).toBe(fresh.inviteCode);
    expect(list.find((b) => b.id === legacy.id)?.inviteCode).toBe('LEGACYCODE2');

    const row = await storedBook(legacy.id);
    expect(row?.inviteCode).toBeNull();
    expect(row?.inviteCodeHash).toBe(hashInviteCode('LEGACYCODE2'));
  });

  it('(iv-a) throttle ip-scope: 10 failed joins from one IP → the 11th is 429 even for a different code', async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await join(`WRONGCODE${String(i).padStart(4, '0')}`, '1.2.3.4');
      expect(res.status).toBe(404);
    }
    const blocked = await join('ANYCODEWHATEVER1', '1.2.3.4');
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { message: string };
    expect(body.message).toContain('15 phút');
  });

  it('(iv-b) throttle code-scope: the same wrong code from many IPs is blocked at the limit', async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await join('SAMWRONGCODE123', `10.0.0.${i + 1}`);
      expect(res.status).toBe(404);
    }
    const blocked = await join('SAMWRONGCODE123', '10.9.9.9');
    expect(blocked.status).toBe(429);
  });

  it('(iv-c) a successful join resets the failure counters for that IP and code', async () => {
    const created = await POST(req('POST', ['books'], { name: 'Sổ reset' }), ctx(['books']));
    const book = (await created.json()) as { id: string; inviteCode: string };
    const ip = '5.6.7.8';
    for (let i = 0; i < 9; i += 1) {
      expect((await join(`BADRESET${i}XXXXXXX`, ip)).status).toBe(404);
    }
    expect((await join(book.inviteCode, ip)).status).toBe(200);
    // Without the reset, the counter would sit at 9 and the 2nd failure
    // below would already trip the 429. Ten fresh failures must all be 404.
    for (let i = 0; i < 10; i += 1) {
      expect((await join(`POSTRESET${i}XXXXX`, ip)).status).toBe(404);
    }
    expect((await join('POSTRESETFINALXX', ip)).status).toBe(429);
  });

  it('(v) dashboard via a legacy code upgrades the row and returns the verified code (never null)', async () => {
    const legacy = await seedLegacyBook('LEGACYDASH1');
    const res = await GET(
      req('GET', ['books', legacy.id, 'dashboard'], undefined, { 'x-book-code': 'LEGACYDASH1' }),
      ctx(['books', legacy.id, 'dashboard']),
    );
    expect(res.status).toBe(200);
    const dash = (await res.json()) as { book: { inviteCode: string } };
    expect(dash.book.inviteCode).toBe('LEGACYDASH1');

    const row = await storedBook(legacy.id);
    expect(row?.inviteCode).toBeNull();
    expect(row?.inviteCodeHash).toBe(hashInviteCode('LEGACYDASH1'));
  });

  it('(vi) markReturn OPEN reopens a DONE return (doneAmountVnd back to null)', async () => {
    const created = await POST(req('POST', ['books'], { name: 'Sổ trả lễ' }), ctx(['books']));
    const book = (await created.json()) as { id: string; inviteCode: string };
    const auth = { 'x-book-code': book.inviteCode };

    const evRes = await POST(
      req(
        'POST',
        ['books', book.id, 'events'],
        { title: 'Cưới', kind: 'CUOI', role: 'HOSTED' },
        auth,
      ),
      ctx(['books', book.id, 'events']),
    );
    const event = (await evRes.json()) as { id: string };
    await POST(
      req(
        'POST',
        ['books', book.id, 'events', event.id, 'entries'],
        { personName: 'Cô Ba', amountVnd: 700_000 },
        auth,
      ),
      ctx(['books', book.id, 'events', event.id, 'entries']),
    );

    const listRes = await GET(
      req('GET', ['books', book.id, 'returns'], undefined, auth),
      ctx(['books', book.id, 'returns']),
    );
    expect(listRes.status).toBe(200);
    const returns = (await listRes.json()) as Array<{ id: string; status: string }>;
    expect(returns).toHaveLength(1);
    const returnId = returns[0]!.id;

    const doneRes = await PATCH(
      req(
        'PATCH',
        ['books', book.id, 'returns', returnId],
        { status: 'DONE', amountVnd: 700_000 },
        auth,
      ),
      ctx(['books', book.id, 'returns', returnId]),
    );
    expect(doneRes.status).toBe(200);
    const done = (await doneRes.json()) as { status: string; doneAmountVnd: number | null };
    expect(done.status).toBe('DONE');
    expect(done.doneAmountVnd).toBe(700_000);

    const openRes = await PATCH(
      req('PATCH', ['books', book.id, 'returns', returnId], { status: 'OPEN' }, auth),
      ctx(['books', book.id, 'returns', returnId]),
    );
    expect(openRes.status).toBe(200);
    const reopened = (await openRes.json()) as {
      status: string;
      doneAmountVnd: number | null;
      doneAt: string | null;
      returnedAmountVnd: number | null;
    };
    expect(reopened.status).toBe('OPEN');
    expect(reopened.doneAmountVnd).toBeNull();
    expect(reopened.doneAt).toBeNull();
    expect(reopened.returnedAmountVnd).toBeNull();
  });
});

describe('relations — delete (integration add-on, LAYOUT-SPEC §6)', () => {
  async function bookWithRelation() {
    const created = await POST(req('POST', ['books'], { name: 'Sổ họ' }), ctx(['books']));
    const book = (await created.json()) as { id: string; inviteCode: string };
    const auth = { 'x-book-code': book.inviteCode };
    const mkPerson = async (displayName: string) => {
      const res = await POST(
        req('POST', ['books', book.id, 'people'], { displayName }, auth),
        ctx(['books', book.id, 'people']),
      );
      expect(res.status).toBe(200);
      return ((await res.json()) as { id: string }).id;
    };
    const fromId = await mkPerson('Ông Nội');
    const toId = await mkPerson('Bố');
    const relRes = await POST(
      req(
        'POST',
        ['books', book.id, 'relations'],
        { fromPersonId: fromId, toPersonId: toId, type: 'PARENT' },
        auth,
      ),
      ctx(['books', book.id, 'relations']),
    );
    expect(relRes.status).toBe(200);
    const rel = (await relRes.json()) as { id: string };
    return { book, auth, relId: rel.id };
  }

  it('deletes a relation with the book code; list is empty afterwards', async () => {
    const { book, auth, relId } = await bookWithRelation();
    const del = await DELETE(
      req('DELETE', ['books', book.id, 'relations', relId], undefined, auth),
      ctx(['books', book.id, 'relations', relId]),
    );
    expect(del.status).toBe(200);
    const list = await GET(
      req('GET', ['books', book.id, 'relations'], undefined, auth),
      ctx(['books', book.id, 'relations']),
    );
    expect(((await list.json()) as unknown[]).length).toBe(0);
  });

  it('wrong code → 404 and the relation survives; another book cannot delete it', async () => {
    const { book, auth, relId } = await bookWithRelation();
    const wrong = await DELETE(
      req('DELETE', ['books', book.id, 'relations', relId], undefined, {
        'x-book-code': 'SAI123456789',
      }),
      ctx(['books', book.id, 'relations', relId]),
    );
    expect(wrong.status).toBe(404);

    const other = await POST(req('POST', ['books'], { name: 'Sổ khác' }), ctx(['books']));
    const otherBook = (await other.json()) as { id: string; inviteCode: string };
    const cross = await DELETE(
      req('DELETE', ['books', otherBook.id, 'relations', relId], undefined, {
        'x-book-code': otherBook.inviteCode,
      }),
      ctx(['books', otherBook.id, 'relations', relId]),
    );
    expect(cross.status).toBe(404);

    const list = await GET(
      req('GET', ['books', book.id, 'relations'], undefined, auth),
      ctx(['books', book.id, 'relations']),
    );
    expect(((await list.json()) as unknown[]).length).toBe(1);
  });
});

describe('DATA-04(ii) — rotate invite code + SEC-12 no-store', () => {
  it('rotate: old code dies immediately, new code works, row stores hash only', async () => {
    const created = await POST(req('POST', ['books'], { name: 'Sổ đổi mã' }), ctx(['books']));
    const book = (await created.json()) as { id: string; inviteCode: string };
    const oldCode = book.inviteCode;

    const rotated = await POST(
      req('POST', ['books', book.id, 'rotate-code'], undefined, { 'x-book-code': oldCode }),
      ctx(['books', book.id, 'rotate-code']),
    );
    expect(rotated.status).toBe(200);
    const after = (await rotated.json()) as { id: string; inviteCode: string };
    expect(after.id).toBe(book.id);
    expect(after.inviteCode).toHaveLength(16);
    expect(after.inviteCode).not.toBe(oldCode);

    // Old code is dead everywhere: join AND book-scoped access.
    const joinOld = await POST(
      req('POST', ['books', 'join'], { inviteCode: oldCode }),
      ctx(['books', 'join']),
    );
    expect(joinOld.status).toBe(404);
    const dashOld = await GET(
      req('GET', ['books', book.id, 'dashboard'], undefined, { 'x-book-code': oldCode }),
      ctx(['books', book.id, 'dashboard']),
    );
    expect(dashOld.status).toBe(404);

    // New code opens the book.
    const joinNew = await POST(
      req('POST', ['books', 'join'], { inviteCode: after.inviteCode }),
      ctx(['books', 'join']),
    );
    expect(joinNew.status).toBe(200);

    // /books/mine with the new code resolves the book and shows the stored
    // row carries a hash of the NEW code and no plaintext at all.
    const mine = await POST(
      req('POST', ['books', 'mine'], { codes: [after.inviteCode] }),
      ctx(['books', 'mine']),
    );
    const list = (await mine.json()) as Array<{
      id: string;
      inviteCode: string;
      inviteCodeHash: string | null;
    }>;
    const row = list.find((b) => b.id === book.id);
    expect(row).toBeDefined();
    expect(row!.inviteCodeHash).toBe(hashInviteCode(after.inviteCode));
  });

  it('rotate with a wrong code → 404 and the current code keeps working', async () => {
    const created = await POST(req('POST', ['books'], { name: 'Sổ giữ mã' }), ctx(['books']));
    const book = (await created.json()) as { id: string; inviteCode: string };

    const attempt = await POST(
      req('POST', ['books', book.id, 'rotate-code'], undefined, {
        'x-book-code': 'MA-SAI-HOAN-TOAN-1',
      }),
      ctx(['books', book.id, 'rotate-code']),
    );
    expect(attempt.status).toBe(404);

    const dash = await GET(
      req('GET', ['books', book.id, 'dashboard'], undefined, { 'x-book-code': book.inviteCode }),
      ctx(['books', book.id, 'dashboard']),
    );
    expect(dash.status).toBe(200);
  });

  it('SEC-12(12.3): data routes and error responses carry Cache-Control: no-store', async () => {
    const created = await POST(req('POST', ['books'], { name: 'Sổ no-store' }), ctx(['books']));
    const book = (await created.json()) as { id: string; inviteCode: string };
    expect(created.headers.get('cache-control')).toBe('no-store');

    const dash = await GET(
      req('GET', ['books', book.id, 'dashboard'], undefined, { 'x-book-code': book.inviteCode }),
      ctx(['books', book.id, 'dashboard']),
    );
    expect(dash.headers.get('cache-control')).toBe('no-store');

    const denied = await GET(
      req('GET', ['books', book.id, 'dashboard'], undefined, { 'x-book-code': 'SAI' }),
      ctx(['books', book.id, 'dashboard']),
    );
    expect(denied.status).toBe(404);
    expect(denied.headers.get('cache-control')).toBe('no-store');
  });
});
