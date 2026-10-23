import { prisma } from '../prisma';
import { notFound } from '../errors';
import { ensurePersonTx, requireBookAccess } from './internal';

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
