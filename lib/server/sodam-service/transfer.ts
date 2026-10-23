import type { SodamEntrySource } from '@prisma/client';
import { prisma } from '../prisma';
import { INT4_MAX } from '../http';
import { sodamEventKindLabelVi } from '../sodam-event-kinds';
import { parseCsvLine, requireBookAccess } from './internal';
import { createEvent } from './events';
import { createEntry } from './entries';

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
