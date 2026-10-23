import type { SodamRelationType } from '@prisma/client';
import { prisma } from '../prisma';
import { notFound } from '../errors';
import { requireBookAccess } from './internal';
import { listPeople } from './people';

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

/**
 * Xoá một quan hệ khỏi cây họ (bổ sung ở vòng tích hợp đợt redesign —
 * LAYOUT-SPEC §6 yêu cầu mỗi quan hệ có thao tác xoá kèm xác nhận ở UI).
 * Quan hệ chỉ bị xoá khi người bắt đầu của nó thuộc đúng sổ đang mở:
 * quan hệ của sổ khác trả 404 như không tồn tại, nhất quán với phần còn lại.
 */
export async function deleteRelation(bookId: string, relationId: string, code: string) {
  await requireBookAccess(bookId, code);
  const people = await prisma.sodamPerson.findMany({
    where: { bookId },
    select: { id: true },
    take: 500,
  });
  const ids = people.map((p) => p.id);
  const rel = await prisma.sodamPersonRelation.findFirst({
    where: { id: relationId, fromPersonId: { in: ids } },
  });
  if (!rel) throw notFound('Relation not found');
  await prisma.sodamPersonRelation.delete({ where: { id: relationId } });
  return { ok: true as const };
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
