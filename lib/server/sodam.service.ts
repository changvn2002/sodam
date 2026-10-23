import type {
  Prisma,
  SodamEntrySource,
  SodamEventKind,
  SodamEventRole,
  SodamRelationType,
  SodamReturnStatus,
} from '@prisma/client';
import { prisma } from './prisma';
import { badRequest, notFound } from './errors';
import { INT4_MAX, INT4_MAX_MESSAGE } from './http';
import { generateInviteCode, inviteCodesMatch, normalizeInviteCode } from './invite-code';
import { sodamEventKindLabelVi } from './sodam-event-kinds';

/**
 * Port of the host's NestJS `SodamService` (server/src/products/sodam/sodam.service.ts).
 * Business logic is unchanged; Nest exceptions became HttpError and the
 * injected PrismaService became the standalone Prisma client.
 *
 * Access model (no-login): there are no accounts. Every book-scoped function
 * takes the book's invite code — presented by the client from its local
 * registry — and `requireBookAccess` verifies it before any data is touched.
 * A wrong/missing code answers 404 "Book not found", exactly like a book
 * that does not exist, so codes cannot be probed by book id.
 */

type Tx = Prisma.TransactionClient;

/**
 * Last line of defense for amounts written to Int4 columns. Route handlers
 * validate with `reqIntMin0`, but CSV import and offline sync call the
 * service directly with `Number(...)` conversions — an out-of-range (or
 * NaN) amount must become a friendly 400 here, never a raw DB error.
 */
function assertAmountVnd(amountVnd: number) {
  if (
    !Number.isFinite(amountVnd) ||
    Math.round(amountVnd) < 0 ||
    Math.round(amountVnd) > INT4_MAX
  ) {
    throw badRequest(INT4_MAX_MESSAGE);
  }
}

export async function requireBookAccess(bookId: string, code: string) {
  const book = await prisma.sodamBook.findUnique({
    where: { id: bookId },
    select: { id: true, inviteCode: true },
  });
  if (!book || !inviteCodesMatch(code, book.inviteCode)) {
    throw notFound('Book not found');
  }
  return book;
}

/**
 * "My books" without accounts: the client keeps the codes of the books it
 * created or joined on this device and sends them here to resolve the list.
 */
export async function listBooksByCodes(codes: string[]) {
  const normalized = [...new Set(codes.map(normalizeInviteCode).filter(Boolean))].slice(0, 50);
  if (normalized.length === 0) return [];
  return prisma.sodamBook.findMany({
    where: { inviteCode: { in: normalized } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
}

export async function createBook(name: string) {
  // Codes are random; retry a few times on the (astronomically unlikely)
  // unique collision instead of failing the create.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const existing = await prisma.sodamBook.findUnique({ where: { inviteCode: code } });
    if (existing) continue;
    return prisma.sodamBook.create({ data: { name: name.trim(), inviteCode: code } });
  }
  throw new Error('Could not allocate a unique invite code');
}

export async function joinBook(code: string) {
  const book = await prisma.sodamBook.findUnique({
    where: { inviteCode: normalizeInviteCode(code) },
  });
  if (!book) throw notFound('Invite code not found');
  return book;
}

export async function dashboard(bookId: string, code: string) {
  await requireBookAccess(bookId, code);
  const book = await prisma.sodamBook.findUniqueOrThrow({ where: { id: bookId } });
  const [openEvent, openReturns, recentEvents, peopleCount, hostedAgg, attendedAgg, doneReturns] =
    await Promise.all([
      prisma.sodamEvent.findFirst({
        where: { bookId, status: 'OPEN' },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.sodamReturnItem.findMany({
        where: { bookId, status: 'OPEN' },
        select: { suggestedAmountVnd: true },
      }),
      prisma.sodamEvent.findMany({
        where: { bookId },
        orderBy: { occurredOn: 'desc' },
        take: 5,
      }),
      prisma.sodamPerson.count({ where: { bookId } }),
      prisma.sodamEntry.aggregate({
        where: { event: { bookId, role: 'HOSTED' } },
        _sum: { amountVnd: true },
      }),
      prisma.sodamEntry.aggregate({
        where: { event: { bookId, role: 'ATTENDED' } },
        _sum: { amountVnd: true },
      }),
      prisma.sodamReturnItem.findMany({
        where: { bookId, status: 'DONE' },
        select: { suggestedAmountVnd: true, doneAmountVnd: true },
      }),
    ]);

  const receivedGrossVnd = hostedAgg._sum.amountVnd ?? 0;
  const settledVnd = doneReturns.reduce((s, r) => s + (r.suggestedAmountVnd ?? 0), 0);
  const overGivenVnd = doneReturns.reduce((s, r) => {
    const got = r.suggestedAmountVnd ?? 0;
    const paid = r.doneAmountVnd ?? got;
    return s + Math.max(0, paid - got);
  }, 0);
  const returnedPaidVnd = doneReturns.reduce(
    (s, r) => s + (r.doneAmountVnd ?? r.suggestedAmountVnd ?? 0),
    0,
  );
  const pendingReturnVnd = openReturns.reduce((s, r) => s + (r.suggestedAmountVnd ?? 0), 0);
  const attendedVnd = attendedAgg._sum.amountVnd ?? 0;

  const recentWithTotals = await attachEventTotals(recentEvents);

  return {
    book,
    openEvent: openEvent ? (await attachEventTotals([openEvent]))[0] : null,
    openReturnCount: openReturns.length,
    recentEvents: recentWithTotals,
    totals: {
      /** Tiền khách đã mừng (gốc). */
      receivedGrossVnd,
      /** Còn lại sau khi trừ đúng số đã trả lễ (theo số khách đã mừng, không theo số mình đi). */
      receivedVnd: Math.max(0, receivedGrossVnd - settledVnd),
      /** Tổng nghĩa vụ đã tất toán (= số khách đã mừng trên các khoản DONE). */
      settledVnd,
      /** Tổng mình đã đưa khi trả lễ (có thể > settled). */
      returnedPaidVnd,
      /** Phần đi nhiều hơn số khách đã mừng. */
      overGivenVnd,
      /** Còn phải trả (OPEN). */
      pendingReturnVnd,
      /** Đi đám ATTENDED + tiền đã trả lễ. */
      givenVnd: attendedVnd + returnedPaidVnd,
      people: peopleCount,
    },
  };
}

export async function listEvents(bookId: string, code: string) {
  await requireBookAccess(bookId, code);
  const events = await prisma.sodamEvent.findMany({
    where: { bookId },
    orderBy: { occurredOn: 'desc' },
    take: 50,
  });
  return attachEventTotals(events);
}

export async function createEvent(
  bookId: string,
  code: string,
  input: {
    title: string;
    kind: SodamEventKind;
    role: SodamEventRole;
    occurredOn?: string;
    note?: string;
  },
) {
  await requireBookAccess(bookId, code);
  return prisma.sodamEvent.create({
    data: {
      bookId,
      title: input.title.trim(),
      kind: input.kind,
      role: input.role,
      note: input.note?.trim() ?? '',
      occurredOn: input.occurredOn ? new Date(input.occurredOn) : new Date(),
    },
  });
}

export async function getEvent(bookId: string, eventId: string, code: string) {
  await requireBookAccess(bookId, code);
  const event = await prisma.sodamEvent.findFirst({
    where: { id: eventId, bookId },
  });
  if (!event) throw notFound('Event not found');
  const entries = await prisma.sodamEntry.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const returns = await prisma.sodamReturnItem.findMany({
    where: { bookId, fromEventId: eventId },
  });
  const byPerson = new Map(returns.map((r) => [r.personId, r]));
  const enriched = entries.map((e) => {
    const ret = e.personId ? byPerson.get(e.personId) : undefined;
    return {
      ...e,
      returnItem: ret
        ? {
            id: ret.id,
            status: ret.status,
            receivedAmountVnd: ret.suggestedAmountVnd,
            returnedAmountVnd: ret.doneAmountVnd,
            overGivenVnd: Math.max(0, (ret.doneAmountVnd ?? 0) - (ret.suggestedAmountVnd ?? 0)),
          }
        : null,
    };
  });
  const [withTotals] = await attachEventTotals([event]);
  const settledOnEvent = returns
    .filter((r) => r.status === 'DONE')
    .reduce((s, r) => s + (r.suggestedAmountVnd ?? 0), 0);
  const overOnEvent = returns
    .filter((r) => r.status === 'DONE')
    .reduce((s, r) => s + Math.max(0, (r.doneAmountVnd ?? 0) - (r.suggestedAmountVnd ?? 0)), 0);
  return {
    ...withTotals,
    entries: enriched,
    settledVnd: settledOnEvent,
    netTotalVnd: Math.max(0, (withTotals.totalAmountVnd ?? 0) - settledOnEvent),
    overGivenVnd: overOnEvent,
  };
}

export async function closeEvent(bookId: string, eventId: string, code: string) {
  await requireBookAccess(bookId, code);
  const event = await prisma.sodamEvent.findFirst({ where: { id: eventId, bookId } });
  if (!event) throw notFound('Event not found');
  return prisma.sodamEvent.update({
    where: { id: eventId },
    data: { status: 'CLOSED' },
  });
}

export async function createEntry(
  bookId: string,
  eventId: string,
  code: string,
  input: {
    personName: string;
    amountVnd: number;
    source?: SodamEntrySource;
    note?: string;
    rawText?: string;
    clientMutationId?: string;
  },
) {
  await requireBookAccess(bookId, code);
  const event = await prisma.sodamEvent.findFirst({ where: { id: eventId, bookId } });
  if (!event) throw notFound('Event not found');
  assertAmountVnd(input.amountVnd);

  if (input.clientMutationId) {
    const existing = await prisma.sodamEntry.findUnique({
      where: { clientMutationId: input.clientMutationId },
    });
    if (existing) return existing;
  }

  return prisma.$transaction(async (tx) => {
    const person = await ensurePersonTx(tx, bookId, input.personName);
    const entry = await tx.sodamEntry.create({
      data: {
        eventId,
        personId: person.id,
        personName: input.personName.trim(),
        amountVnd: Math.max(0, Math.round(input.amountVnd)),
        source: input.source ?? 'MANUAL',
        note: input.note?.trim() ?? '',
        rawText: input.rawText,
        clientMutationId: input.clientMutationId,
      },
    });
    if (event.role === 'HOSTED') {
      await syncReturnForPersonEventTx(tx, bookId, person.id, eventId);
    }
    return entry;
  });
}

export async function updateEntry(
  bookId: string,
  eventId: string,
  entryId: string,
  code: string,
  input: Partial<{ personName: string; amountVnd: number; note: string }>,
) {
  await requireBookAccess(bookId, code);
  const entry = await prisma.sodamEntry.findFirst({
    where: { id: entryId, eventId, event: { bookId } },
    include: { event: true },
  });
  if (!entry) throw notFound('Entry not found');
  if (input.amountVnd != null) assertAmountVnd(input.amountVnd);
  const updated = await prisma.$transaction(async (tx) => {
    let personId = entry.personId;
    if (input.personName != null) {
      const person = await ensurePersonTx(tx, bookId, input.personName);
      personId = person.id;
    }
    const row = await tx.sodamEntry.update({
      where: { id: entryId },
      data: {
        ...(input.personName != null ? { personName: input.personName.trim(), personId } : {}),
        ...(input.amountVnd != null ? { amountVnd: Math.round(input.amountVnd) } : {}),
        ...(input.note != null ? { note: input.note } : {}),
      },
    });
    if (entry.event.role === 'HOSTED' && personId) {
      await syncReturnForPersonEventTx(tx, bookId, personId, eventId);
      if (entry.personId && entry.personId !== personId) {
        await syncReturnForPersonEventTx(tx, bookId, entry.personId, eventId);
      }
    }
    return row;
  });
  return updated;
}

export async function deleteEntry(bookId: string, eventId: string, entryId: string, code: string) {
  await requireBookAccess(bookId, code);
  const entry = await prisma.sodamEntry.findFirst({
    where: { id: entryId, eventId, event: { bookId } },
    include: { event: true },
  });
  if (!entry) throw notFound('Entry not found');
  await prisma.$transaction(async (tx) => {
    await tx.sodamEntry.delete({ where: { id: entryId } });
    if (entry.event.role === 'HOSTED' && entry.personId) {
      await syncReturnForPersonEventTx(tx, bookId, entry.personId, eventId);
    }
  });
  return { ok: true };
}

export async function batchEntries(
  bookId: string,
  eventId: string,
  code: string,
  rows: Array<{ personName: string; amountVnd: number }>,
) {
  const out = [];
  for (const row of rows.slice(0, 100)) {
    out.push(
      await createEntry(bookId, eventId, code, {
        personName: row.personName,
        amountVnd: row.amountVnd,
        source: 'PHOTO',
      }),
    );
  }
  return out;
}

export async function listPeople(bookId: string, code: string) {
  await requireBookAccess(bookId, code);
  return prisma.sodamPerson.findMany({
    where: { bookId },
    orderBy: { displayName: 'asc' },
    take: 200,
  });
}

export async function searchPeople(bookId: string, code: string, q: string) {
  await requireBookAccess(bookId, code);
  const people = await prisma.sodamPerson.findMany({
    where: {
      bookId,
      displayName: { contains: q.trim(), mode: 'insensitive' },
    },
    take: 20,
  });
  const result = [];
  for (const person of people) {
    const history = await prisma.sodamEntry.findMany({
      where: { personId: person.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    result.push({ ...person, history });
  }
  return result;
}

export async function upsertPerson(
  bookId: string,
  code: string,
  input: { id?: string; displayName: string; note?: string },
) {
  await requireBookAccess(bookId, code);
  if (input.id) {
    const person = await prisma.sodamPerson.findFirst({
      where: { id: input.id, bookId },
    });
    if (!person) throw notFound('Person not found');
    return prisma.sodamPerson.update({
      where: { id: input.id },
      data: {
        displayName: input.displayName.trim(),
        note: input.note ?? person.note,
      },
    });
  }
  return prisma.$transaction((tx) => ensurePersonTx(tx, bookId, input.displayName, input.note));
}

export async function listRelations(bookId: string, code: string) {
  await requireBookAccess(bookId, code);
  const people = await prisma.sodamPerson.findMany({
    where: { bookId },
    select: { id: true },
    take: 500,
  });
  const ids = people.map((p) => p.id);
  return prisma.sodamPersonRelation.findMany({
    where: { fromPersonId: { in: ids } },
    take: 200,
  });
}

export async function createRelation(
  bookId: string,
  code: string,
  input: { fromPersonId: string; toPersonId: string; type: SodamRelationType },
) {
  await requireBookAccess(bookId, code);
  const [from, to] = await Promise.all([
    prisma.sodamPerson.findFirst({ where: { id: input.fromPersonId, bookId } }),
    prisma.sodamPerson.findFirst({ where: { id: input.toPersonId, bookId } }),
  ]);
  if (!from || !to) throw notFound('Person not found');
  return prisma.sodamPersonRelation.create({
    data: {
      fromPersonId: input.fromPersonId,
      toPersonId: input.toPersonId,
      type: input.type,
    },
  });
}

export async function tree(bookId: string, code: string) {
  const [people, relations] = await Promise.all([
    listPeople(bookId, code),
    listRelations(bookId, code),
  ]);
  return { people, relations };
}

export async function listReturns(bookId: string, code: string, status?: SodamReturnStatus) {
  await requireBookAccess(bookId, code);
  const rows = await prisma.sodamReturnItem.findMany({
    where: { bookId, ...(status ? { status } : {}) },
    include: { person: true, fromEvent: true },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  return rows.map((r) => {
    const received = r.suggestedAmountVnd ?? 0;
    const returned = r.doneAmountVnd;
    return {
      ...r,
      personName: r.person.displayName,
      fromEventTitle: r.fromEvent.title,
      receivedAmountVnd: received,
      returnedAmountVnd: returned,
      overGivenVnd: returned != null ? Math.max(0, returned - received) : null,
    };
  });
}

export async function markReturn(
  bookId: string,
  returnId: string,
  code: string,
  input: { status: 'DONE' | 'SKIPPED'; amountVnd?: number },
) {
  await requireBookAccess(bookId, code);
  const item = await prisma.sodamReturnItem.findFirst({
    where: { id: returnId, bookId },
    include: { person: true },
  });
  if (!item) throw notFound('Return item not found');
  if (input.amountVnd != null) assertAmountVnd(input.amountVnd);
  const received = item.suggestedAmountVnd ?? 0;
  const paid =
    input.status === 'DONE' ? Math.max(0, Math.round(input.amountVnd ?? received)) : null;
  const updated = await prisma.sodamReturnItem.update({
    where: { id: returnId },
    data: {
      status: input.status,
      doneAmountVnd: paid,
      doneAt: input.status === 'DONE' ? new Date() : null,
    },
    include: { person: true, fromEvent: true },
  });
  return {
    ...updated,
    personName: updated.person.displayName,
    fromEventTitle: updated.fromEvent.title,
    receivedAmountVnd: received,
    returnedAmountVnd: updated.doneAmountVnd,
    overGivenVnd:
      updated.doneAmountVnd != null ? Math.max(0, updated.doneAmountVnd - received) : null,
  };
}

export async function exportCsv(bookId: string, code: string) {
  await requireBookAccess(bookId, code);
  const events = await prisma.sodamEvent.findMany({
    where: { bookId },
    take: 50,
    include: { entries: { take: 200 } },
  });
  const lines = ['eventTitle,eventRole,personName,amountVnd,source,eventKindLabel'];
  for (const event of events) {
    for (const entry of event.entries) {
      lines.push(
        [
          event.title,
          event.role,
          entry.personName,
          String(entry.amountVnd),
          entry.source,
          sodamEventKindLabelVi(event.kind),
        ]
          .map((v) => (v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v))
          .join(','),
      );
    }
  }
  return { csv: lines.join('\n') };
}

export async function importCsv(bookId: string, code: string, csv: string) {
  await requireBookAccess(bookId, code);
  let event = await prisma.sodamEvent.findFirst({
    where: { bookId, status: 'OPEN' },
    orderBy: { updatedAt: 'desc' },
  });
  if (!event) {
    event = await createEvent(bookId, code, {
      title: 'Import CSV',
      kind: 'KHAC',
      role: 'HOSTED',
    });
  }
  const lines = csv.trim().split(/\r?\n/).slice(1);
  let imported = 0;
  for (const line of lines.slice(0, 100)) {
    const cols = parseCsvLine(line);
    if (cols.length < 4) continue;
    const personName = cols[2] ?? '';
    const amountVnd = Number(cols[3]);
    // Skip rows whose amount cannot fit the Int4 column instead of
    // aborting the whole import on the DB error (same skip semantics as
    // the non-finite check that was already here).
    if (!personName || !Number.isFinite(amountVnd) || amountVnd < 0 || amountVnd > INT4_MAX) {
      continue;
    }
    await createEntry(bookId, event.id, code, {
      personName,
      amountVnd,
      source: 'MANUAL',
    });
    imported += 1;
  }
  return { imported };
}

/**
 * Offline sync — FAITHFUL to the original design: only `createEntry`
 * mutations are applied; other mutation types are recorded as seen
 * (SodamSyncCursor) and acknowledged. See README "Known limitations".
 */
export async function sync(
  bookId: string,
  code: string,
  mutations: Array<{ clientMutationId: string; type: string; payload: Record<string, unknown> }>,
) {
  await requireBookAccess(bookId, code);
  const applied: string[] = [];
  for (const m of mutations.slice(0, 50)) {
    const seen = await prisma.sodamSyncCursor.findUnique({
      where: { clientMutationId: m.clientMutationId },
    });
    if (seen) {
      applied.push(m.clientMutationId);
      continue;
    }
    if (m.type === 'createEntry' && m.payload.eventId && m.payload.personName != null) {
      await createEntry(bookId, String(m.payload.eventId), code, {
        personName: String(m.payload.personName),
        amountVnd: Number(m.payload.amountVnd ?? 0),
        source: (m.payload.source as SodamEntrySource) ?? 'MANUAL',
        clientMutationId: m.clientMutationId,
      });
    }
    await prisma.sodamSyncCursor.create({
      data: { bookId, clientMutationId: m.clientMutationId },
    });
    applied.push(m.clientMutationId);
  }
  return { applied };
}

async function attachEventTotals<T extends { id: string }>(events: T[]) {
  const result = [];
  for (const event of events) {
    const agg = await prisma.sodamEntry.aggregate({
      where: { eventId: event.id },
      _sum: { amountVnd: true },
      _count: true,
    });
    result.push({
      ...event,
      entryCount: agg._count,
      totalAmountVnd: agg._sum.amountVnd ?? 0,
    });
  }
  return result;
}

async function ensurePersonTx(tx: Tx, bookId: string, displayName: string, note = '') {
  const name = displayName.trim();
  const existing = await tx.sodamPerson.findFirst({
    where: { bookId, displayName: { equals: name, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return tx.sodamPerson.create({
    data: { bookId, displayName: name, note: note ?? '' },
  });
}

async function syncReturnForPersonEventTx(
  tx: Tx,
  bookId: string,
  personId: string,
  fromEventId: string,
) {
  const agg = await tx.sodamEntry.aggregate({
    where: { eventId: fromEventId, personId },
    _sum: { amountVnd: true },
    _count: true,
  });
  const total = agg._sum.amountVnd ?? 0;
  const existing = await tx.sodamReturnItem.findFirst({
    where: { bookId, personId, fromEventId },
    orderBy: { createdAt: 'desc' },
  });

  if (agg._count === 0 || total <= 0) {
    if (existing && existing.status === 'OPEN') {
      await tx.sodamReturnItem.delete({ where: { id: existing.id } });
    }
    return null;
  }

  if (existing) {
    if (existing.status !== 'OPEN') {
      // Đã trả/bỏ qua — giữ lịch sử, không mở lại nghĩa vụ từ cùng đám.
      return existing;
    }
    return tx.sodamReturnItem.update({
      where: { id: existing.id },
      data: { suggestedAmountVnd: total, fromEventId },
    });
  }

  return tx.sodamReturnItem.create({
    data: {
      bookId,
      personId,
      fromEventId,
      suggestedAmountVnd: total,
      status: 'OPEN',
    },
  });
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
