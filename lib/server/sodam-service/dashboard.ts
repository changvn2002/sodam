import { prisma } from '../prisma';
import { normalizeInviteCode } from '../invite-code';
import { attachEventTotals, publicBook, requireBookAccess } from './internal';

export async function dashboard(bookId: string, code: string) {
  await requireBookAccess(bookId, code);
  const rawBook = await prisma.sodamBook.findUniqueOrThrow({ where: { id: bookId } });
  // SEC-08: v2 books store inviteCode = null — the payload must still carry
  // the verified code the client presented, never null.
  const book = publicBook(
    rawBook.inviteCode ? rawBook : { ...rawBook, inviteCode: normalizeInviteCode(code) },
  );
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
