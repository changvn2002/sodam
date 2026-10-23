import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * CQ-09 — property-style test cho bất biến cộng dồn tiền bạc.
 *
 * Tầng kiểm chứng: SERVICE (lib/server/sodam.service.ts) chạy thật trên
 * một fake Prisma in-memory (mẫu fake của route.spec.ts, mở rộng cho
 * entry findMany/findFirst/update/delete) — tức là kiểm bất biến ở đúng
 * tầng tính tổng (dashboard / attachEventTotals / sync nghĩa vụ trả lễ),
 * không phải ở tầng helper trình bày.
 *
 * Tính chất (property): với MỌI dãy thao tác ghi/sửa/xoá khoản và trả lễ
 * sinh ngẫu nhiên có seed cố định (deterministic — cùng seed, cùng dãy,
 * fail là tái hiện được), các đẳng thức sau phải luôn đúng:
 *   (1) tổng theo sự kiện (listEvents/getEvent) == tổng mô hình độc lập;
 *   (2) tổng theo người == tổng theo sự kiện == tổng dashboard
 *       (receivedGrossVnd cho HOSTED, givenVnd phần ATTENDED);
 *   (3) nghĩa vụ trả lễ OPEN theo (người × đám HOSTED) == tổng khoản của
 *       người đó ở đám đó; pendingReturnVnd == tổng các OPEN;
 *   (4) sau khi trả lễ: settledVnd == Σ suggested của DONE,
 *       returnedPaidVnd == Σ đã trả, overGivenVnd == Σ max(0, trả−gốc),
 *       receivedVnd == max(0, gross − settled) và không tổng nào âm.
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
      if (cond && typeof cond === 'object' && 'equals' in (cond as Row) && key === 'displayName') {
        return (
          String(row[key]).toLowerCase() ===
          String((cond as { equals: unknown }).equals).toLowerCase()
        );
      }
      return row[key] === cond;
    });
  }

  function pick(
    rows: Row[],
    args: { where?: Record<string, unknown>; take?: number; orderBy?: Record<string, string> },
  ) {
    let out = rows.filter((r) => match(r, args.where));
    const ob = args.orderBy ? Object.entries(args.orderBy)[0] : undefined;
    if (ob) {
      const [field, dir] = ob;
      out = [...out].sort((a, b) => {
        const av = a[field] instanceof Date ? (a[field] as Date).getTime() : Number(a[field] ?? 0);
        const bv = b[field] instanceof Date ? (b[field] as Date).getTime() : Number(b[field] ?? 0);
        return dir === 'desc' ? bv - av : av - bv;
      });
    }
    return args.take ? out.slice(0, args.take) : out;
  }

  function aggregate(rows: Row[], args: { where?: Record<string, unknown> }) {
    const hit = pick(rows, args);
    return {
      _sum: { amountVnd: hit.reduce((s, r) => s + Number(r.amountVnd ?? 0), 0) },
      _count: hit.length,
    };
  }

  function withIncludes(row: Row | null, include?: Record<string, unknown>): Row | null {
    if (!row || !include) return row;
    const out: Row = { ...row };
    if (include.person) out.person = tables.people.find((p) => p.id === row.personId) ?? null;
    if (include.fromEvent)
      out.fromEvent = tables.events.find((e) => e.id === row.fromEventId) ?? null;
    if (include.event) out.event = tables.events.find((e) => e.id === row.eventId) ?? null;
    return out;
  }

  const book = {
    findUnique: async (args: { where: Record<string, unknown> }) =>
      tables.books.find((b) => match(b, args.where)) ?? null,
    findUniqueOrThrow: async (args: { where: Record<string, unknown> }) => {
      const found = tables.books.find((b) => match(b, args.where));
      if (!found) throw new Error('Not found');
      return found;
    },
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

  const event = {
    findFirst: async (args: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, string>;
    }) => pick(tables.events, args)[0] ?? null,
    findMany: async (args: {
      where?: Record<string, unknown>;
      take?: number;
      orderBy?: Record<string, string>;
    }) => pick(tables.events, args),
    create: async (args: { data: Record<string, unknown> }) => {
      const row: Row = {
        id: nextId('evt'),
        status: 'OPEN',
        createdAt: new Date(),
        updatedAt: new Date(),
        occurredOn: new Date(),
        ...args.data,
      };
      tables.events.push(row);
      return row;
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = tables.events.find((e) => e.id === args.where.id);
      if (!row) throw new Error('Not found');
      Object.assign(row, args.data, { updatedAt: new Date() });
      return row;
    },
  };

  const entry = {
    findUnique: async (args: { where: Record<string, unknown> }) =>
      tables.entries.find((e) => match(e, args.where)) ?? null,
    findMany: async (args: {
      where?: Record<string, unknown>;
      take?: number;
      orderBy?: Record<string, string>;
    }) => pick(tables.entries, args),
    findFirst: async (args: {
      where?: Record<string, unknown>;
      include?: Record<string, unknown>;
    }) => withIncludes(pick(tables.entries, args)[0] ?? null, args.include),
    aggregate: async (args: { where?: Record<string, unknown> }) => aggregate(tables.entries, args),
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
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = tables.entries.find((e) => e.id === args.where.id);
      if (!row) throw new Error('Not found');
      Object.assign(row, args.data, { updatedAt: new Date() });
      return row;
    },
    delete: async (args: { where: { id: string } }) => {
      tables.entries = tables.entries.filter((e) => e.id !== args.where.id);
      return {};
    },
  };

  const person = {
    count: async (args: { where?: Record<string, unknown> }) => pick(tables.people, args).length,
    findMany: async (args: { where?: Record<string, unknown>; take?: number }) =>
      pick(tables.people, args),
    findFirst: async (args: { where?: Record<string, unknown> }) =>
      pick(tables.people, args)[0] ?? null,
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
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = tables.people.find((p) => p.id === args.where.id);
      if (!row) throw new Error('Not found');
      Object.assign(row, args.data, { updatedAt: new Date() });
      return row;
    },
  };

  const returnItem = {
    findMany: async (args: {
      where?: Record<string, unknown>;
      take?: number;
      include?: Record<string, unknown>;
    }) => pick(tables.returns, args).map((r) => withIncludes(r, args.include)!),
    findFirst: async (args: {
      where?: Record<string, unknown>;
      include?: Record<string, unknown>;
    }) => withIncludes(pick(tables.returns, args)[0] ?? null, args.include),
    create: async (args: { data: Record<string, unknown> }) => {
      const row: Row = {
        id: nextId('ret'),
        status: 'OPEN',
        doneAmountVnd: null,
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
      Object.assign(row, args.data, { updatedAt: new Date() });
      return withIncludes(row, args.include);
    },
    delete: async (args: { where: { id: string } }) => {
      tables.returns = tables.returns.filter((r) => r.id !== args.where.id);
      return {};
    },
  };

  const prisma = {
    sodamBook: book,
    sodamEvent: event,
    sodamEntry: entry,
    sodamPerson: person,
    sodamReturnItem: returnItem,
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({ sodamPerson: person, sodamEntry: entry, sodamReturnItem: returnItem }),
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

import {
  createBook,
  createEntry,
  createEvent,
  dashboard,
  deleteEntry,
  getEvent,
  listEvents,
  listReturns,
  markReturn,
  updateEntry,
} from './sodam.service';

/** RNG xác định (mulberry32) — cùng seed luôn cho cùng dãy thao tác. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PEOPLE = [
  'Bác Hai Nguyễn Văn Thành',
  'Cô Ba Trần Thị Hoa',
  'Anh Tuấn Phạm Văn',
  'Chị Bảy Phạm Thu Hằng',
  'Ông Bà Ngoại',
  'Nhà Bác Bảy',
  'Em Út Lê Minh',
  'Dì Năm Võ Thị Sáu',
];
const KINDS = ['CUOI', 'GIO', 'MA', 'MUNG_THO', 'TAN_GIA'] as const;
const amount = (rnd: () => number) => (1 + Math.floor(rnd() * 100)) * 50_000; // 50k … 5.000k

beforeEach(() => fake.reset());

describe('CQ-09 — bất biến cộng dồn tiền (property-style, seed cố định)', () => {
  it('300 vòng ghi/sửa/xoá trên một đám HOSTED: tổng sự kiện + nghĩa vụ trả lễ luôn khớp mô hình', async () => {
    const rnd = mulberry32(20261023);
    const book = await createBook('Sổ bất biến');
    const ev = await createEvent(book.id, book.inviteCode, {
      title: 'Cưới kiểm chứng',
      kind: 'CUOI',
      role: 'HOSTED',
    });
    // Mô hình độc lập: personKey -> { entryId, amount }
    const model = new Map<string, { entryId: string; amount: number }>();
    const modelTotal = () => [...model.values()].reduce((s, v) => s + v.amount, 0);

    for (let i = 0; i < 300; i += 1) {
      const roll = rnd();
      const name = PEOPLE[Math.floor(rnd() * PEOPLE.length)];
      const key = name.toLowerCase();
      const existing = model.get(key);
      if (roll < 0.55 || !existing) {
        const amt = amount(rnd);
        if (existing) {
          await updateEntry(book.id, ev.id, existing.entryId, book.inviteCode, { amountVnd: amt });
          existing.amount = amt;
        } else {
          const created = await createEntry(book.id, ev.id, book.inviteCode, {
            personName: name,
            amountVnd: amt,
          });
          model.set(key, { entryId: created.id, amount: amt });
        }
      } else if (roll < 0.8) {
        const amt = amount(rnd);
        await updateEntry(book.id, ev.id, existing.entryId, book.inviteCode, { amountVnd: amt });
        existing.amount = amt;
      } else {
        await deleteEntry(book.id, ev.id, existing.entryId, book.inviteCode);
        model.delete(key);
      }

      // Bất biến sau MỖI thao tác:
      const [listed] = await listEvents(book.id, book.inviteCode);
      expect(listed.totalAmountVnd).toBe(modelTotal());
      const open = await listReturns(book.id, book.inviteCode, 'OPEN');
      const openSum = open.reduce((s, r) => s + r.receivedAmountVnd, 0);
      expect(openSum).toBe(modelTotal());
      // Mỗi nghĩa vụ OPEN = đúng tổng khoản của người đó ở đám này.
      for (const r of open) {
        const m = [...model.entries()].find(([, v]) => v.amount === r.receivedAmountVnd);
        expect(m).toBeDefined();
      }
      expect(open.length).toBe(model.size);
    }
  });

  it('25 kịch bản nhiều đám (HOSTED + ATTENDED) + trả lễ: tổng theo người == theo sự kiện == dashboard, không tổng âm', async () => {
    for (let scenario = 0; scenario < 25; scenario += 1) {
      fake.reset();
      const rnd = mulberry32(1000 + scenario);
      const book = await createBook(`Sổ kịch bản ${scenario}`);
      const nEvents = 2 + Math.floor(rnd() * 3);
      const events: Array<{ id: string; role: 'HOSTED' | 'ATTENDED' }> = [];
      // Mô hình: eventId -> Map personKey -> amount (tổng theo người trong đám)
      const model = new Map<string, Map<string, number>>();
      let gross = 0;
      let attended = 0;

      for (let e = 0; e < nEvents; e += 1) {
        const role = e === 0 ? 'HOSTED' : rnd() < 0.5 ? 'HOSTED' : 'ATTENDED';
        const ev = await createEvent(book.id, book.inviteCode, {
          title: `Đám ${e}`,
          kind: KINDS[Math.floor(rnd() * KINDS.length)],
          role,
        });
        events.push({ id: ev.id, role });
        model.set(ev.id, new Map());
        const nEntries = 1 + Math.floor(rnd() * 8);
        for (let n = 0; n < nEntries; n += 1) {
          const name = PEOPLE[Math.floor(rnd() * PEOPLE.length)];
          const amt = amount(rnd);
          await createEntry(book.id, ev.id, book.inviteCode, { personName: name, amountVnd: amt });
          const perPerson = model.get(ev.id)!;
          perPerson.set(name.toLowerCase(), (perPerson.get(name.toLowerCase()) ?? 0) + amt);
        }
      }

      // (1)+(2): tổng theo sự kiện và tổng dashboard khớp mô hình.
      const listed = await listEvents(book.id, book.inviteCode);
      for (const ev of events) {
        const perPerson = model.get(ev.id)!;
        const expected = [...perPerson.values()].reduce((s, v) => s + v, 0);
        expect(listed.find((l) => l.id === ev.id)?.totalAmountVnd).toBe(expected);
        const detail = await getEvent(book.id, ev.id, book.inviteCode);
        expect(detail.totalAmountVnd).toBe(expected);
        if (ev.role === 'HOSTED') gross += expected;
        else attended += expected;
      }
      const dash = await dashboard(book.id, book.inviteCode);
      expect(dash.totals.receivedGrossVnd).toBe(gross);
      expect(dash.totals.givenVnd).toBe(attended); // chưa trả lễ nào
      expect(dash.totals.pendingReturnVnd).toBe(gross);
      expect(dash.totals.settledVnd).toBe(0);

      // (3): nghĩa vụ OPEN theo (người × đám HOSTED) khớp mô hình từng ô.
      const openBefore = await listReturns(book.id, book.inviteCode, 'OPEN');
      for (const r of openBefore) {
        const perPerson = model.get(r.fromEventId);
        expect(perPerson).toBeDefined();
        const person = await fake.prisma.sodamPerson.findFirst({ where: { id: r.personId } });
        const expected = perPerson!.get(String(person?.displayName).toLowerCase());
        expect(r.receivedAmountVnd).toBe(expected);
      }

      // (4): trả lễ ngẫu nhiên (DONE trả đúng/dư/thiếu, SKIPPED) rồi đối chiếu.
      let settled = 0;
      let returnedPaid = 0;
      let over = 0;
      let pending = gross;
      for (const r of openBefore) {
        const roll = rnd();
        if (roll < 0.45) {
          const delta = [0, 100_000, -50_000][Math.floor(rnd() * 3)];
          const paid = Math.max(0, r.receivedAmountVnd + delta);
          await markReturn(book.id, r.id, book.inviteCode, { status: 'DONE', amountVnd: paid });
          settled += r.receivedAmountVnd;
          returnedPaid += paid;
          over += Math.max(0, paid - r.receivedAmountVnd);
          pending -= r.receivedAmountVnd;
        } else if (roll < 0.6) {
          await markReturn(book.id, r.id, book.inviteCode, { status: 'SKIPPED' });
          pending -= r.receivedAmountVnd;
        }
      }
      const after = await dashboard(book.id, book.inviteCode);
      expect(after.totals.settledVnd).toBe(settled);
      expect(after.totals.returnedPaidVnd).toBe(returnedPaid);
      expect(after.totals.overGivenVnd).toBe(over);
      expect(after.totals.pendingReturnVnd).toBe(pending);
      // balance = received − settled, không bao giờ âm; given = attended + đã trả.
      expect(after.totals.receivedVnd).toBe(Math.max(0, gross - settled));
      expect(after.totals.givenVnd).toBe(attended + returnedPaid);
      for (const v of Object.values(after.totals)) {
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
