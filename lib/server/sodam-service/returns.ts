import type { SodamReturnStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { notFound } from '../errors';
import { assertAmountVnd, requireBookAccess } from './internal';

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
  input: { status: 'DONE' | 'SKIPPED' | 'OPEN'; amountVnd?: number },
) {
  await requireBookAccess(bookId, code);
  const item = await prisma.sodamReturnItem.findFirst({
    where: { id: returnId, bookId },
    include: { person: true },
  });
  if (!item) throw notFound('Return item not found');
  // Reopening (OPEN) clears the settlement entirely and ignores amountVnd.
  if (input.status !== 'OPEN' && input.amountVnd != null) assertAmountVnd(input.amountVnd);
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
