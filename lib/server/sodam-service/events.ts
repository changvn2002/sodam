import type { SodamEventKind, SodamEventRole } from '@prisma/client';
import { prisma } from '../prisma';
import { notFound } from '../errors';
import { attachEventTotals, requireBookAccess } from './internal';

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
