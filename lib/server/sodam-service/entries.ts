import type { SodamEntrySource } from '@prisma/client';
import { prisma } from '../prisma';
import { notFound } from '../errors';
import {
  assertAmountVnd,
  ensurePersonTx,
  requireBookAccess,
  syncReturnForPersonEventTx,
} from './internal';

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
