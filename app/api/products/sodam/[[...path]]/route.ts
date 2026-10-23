import type {
  SodamEntrySource,
  SodamEventKind,
  SodamEventRole,
  SodamRelationType,
} from '@prisma/client';
import * as ai from '@/lib/server/ai.service';
import { badRequest, notFound } from '@/lib/server/errors';
import {
  handle,
  optEnum,
  optIntMin0,
  optString,
  readJson,
  reqEnum,
  reqIntMin0,
  reqString,
} from '@/lib/server/http';
import * as sodam from '@/lib/server/sodam.service';
import { SODAM_EVENT_KINDS } from '@/lib/server/sodam-event-kinds';

/**
 * Route handlers replacing the host's NestJS `SodamController`
 * (server/src/products/sodam/sodam.controller.ts). Same paths, same payloads,
 * same response shapes. No accounts: book-scoped endpoints authorize with
 * the book's invite code, sent by the client in the `x-book-code` header
 * (see lib/server/invite-code.ts). A wrong code answers 404, like the
 * host's membership guard did for non-members.
 */

const EVENT_ROLES = ['HOSTED', 'ATTENDED'] as const;
const ENTRY_SOURCES = ['VOICE', 'PHOTO', 'MANUAL'] as const;
const RELATION_TYPES = ['SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'OTHER'] as const;
const RETURN_STATUSES = ['OPEN', 'DONE', 'SKIPPED'] as const;

type Ctx = { params: Promise<{ path?: string[] }> };

async function dispatch(req: Request, segments: string[]) {
  const method = req.method;
  const [head, bookId, sub, third, fourth] = segments;

  // GET /api/products/sodam — public status (product info + whether AI is configured)
  if (segments.length === 0 && method === 'GET') {
    return { product: { name: 'Sổ Đám', slug: 'sodam' }, aiConfigured: ai.aiConfigured() };
  }

  if (head !== 'books') throw notFound('Route not found');

  // /books — create a new book (no credential needed: creating grants one)
  if (segments.length === 1 && method === 'POST') {
    const body = await readJson(req);
    return sodam.createBook(reqString(body, 'name', 1, 200));
  }

  // /books/mine — resolve the books this device knows, by their codes.
  // NOTE: for 2-segment paths the second segment sits in `bookId`, not `sub`.
  if (segments.length === 2 && bookId === 'mine' && method === 'POST') {
    const body = await readJson(req);
    const codes = Array.isArray(body.codes)
      ? body.codes.filter((c): c is string => typeof c === 'string')
      : [];
    return sodam.listBooksByCodes(codes);
  }

  // /books/join — open a book by its invite code (SEC-08: throttled per IP)
  if (segments.length === 2 && bookId === 'join' && method === 'POST') {
    const body = await readJson(req);
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '';
    return sodam.joinBook(reqString(body, 'inviteCode', 3, 64), ip);
  }

  // Every route below is scoped to one book: the invite code is the key.
  const code = req.headers.get('x-book-code') ?? '';

  if (!bookId) throw notFound('Route not found');

  // /books/:bookId/dashboard
  if (segments.length === 3 && sub === 'dashboard' && method === 'GET') {
    return sodam.dashboard(bookId, code);
  }

  // /books/:bookId/rotate-code — đổi mã mời, mã cũ chết ngay (DATA-04(ii)).
  // Credential hiện tại đi qua header x-book-code như mọi route cấp sổ.
  if (segments.length === 3 && sub === 'rotate-code' && method === 'POST') {
    return sodam.rotateInviteCode(bookId, code);
  }

  // /books/:bookId/events
  if (segments.length === 3 && sub === 'events') {
    if (method === 'GET') return sodam.listEvents(bookId, code);
    if (method === 'POST') {
      const body = await readJson(req);
      return sodam.createEvent(bookId, code, {
        title: reqString(body, 'title', 1, 200),
        kind: reqEnum<SodamEventKind>(body, 'kind', SODAM_EVENT_KINDS),
        role: reqEnum<SodamEventRole>(body, 'role', EVENT_ROLES),
        occurredOn: optString(body, 'occurredOn', 100),
        note: optString(body, 'note', 1000),
      });
    }
  }

  // /books/:bookId/events/:eventId[/close|/entries[/batch|/:entryId]]
  if (segments.length >= 4 && sub === 'events') {
    const eventId = third;
    if (segments.length === 4 && method === 'GET') {
      return sodam.getEvent(bookId, eventId, code);
    }
    if (segments.length === 5 && fourth === 'close' && method === 'POST') {
      return sodam.closeEvent(bookId, eventId, code);
    }
    if (segments.length === 5 && fourth === 'entries' && method === 'POST') {
      const body = await readJson(req);
      return sodam.createEntry(bookId, eventId, code, {
        personName: reqString(body, 'personName', 1, 200),
        amountVnd: reqIntMin0(body, 'amountVnd'),
        source: optEnum<SodamEntrySource>(body, 'source', ENTRY_SOURCES),
        note: optString(body, 'note', 1000),
        rawText: optString(body, 'rawText', 2000),
        clientMutationId: optString(body, 'clientMutationId', 200),
      });
    }
    if (segments.length === 6 && fourth === 'entries' && third !== undefined) {
      const entryId = segments[5];
      if (entryId === 'batch' && method === 'POST') {
        const body = await readJson(req);
        const rowsRaw = body.rows;
        if (!Array.isArray(rowsRaw)) throw badRequest('rows must be an array');
        const rows = rowsRaw.map((r) => {
          const row = (r ?? {}) as Record<string, unknown>;
          return {
            personName: reqString(row, 'personName', 1, 200),
            amountVnd: reqIntMin0(row, 'amountVnd'),
          };
        });
        return sodam.batchEntries(bookId, eventId, code, rows);
      }
      if (method === 'PATCH') {
        const body = await readJson(req);
        return sodam.updateEntry(bookId, eventId, entryId, code, {
          personName: optString(body, 'personName', 200),
          amountVnd: optIntMin0(body, 'amountVnd'),
          note: optString(body, 'note', 1000),
        });
      }
      if (method === 'DELETE') {
        return sodam.deleteEntry(bookId, eventId, entryId, code);
      }
    }
  }

  // /books/:bookId/people[/search]
  if (segments.length === 3 && sub === 'people') {
    if (method === 'GET') return sodam.listPeople(bookId, code);
    if (method === 'POST') {
      const body = await readJson(req);
      return sodam.upsertPerson(bookId, code, {
        id: optString(body, 'id', 100),
        displayName: reqString(body, 'displayName', 1, 200),
        note: optString(body, 'note', 1000),
      });
    }
  }
  if (segments.length === 4 && sub === 'people' && third === 'search' && method === 'GET') {
    const q = new URL(req.url).searchParams.get('q') ?? '';
    return sodam.searchPeople(bookId, code, q);
  }

  // /books/:bookId/relations[/:relationId]
  if (segments.length === 3 && sub === 'relations') {
    if (method === 'GET') return sodam.listRelations(bookId, code);
    if (method === 'POST') {
      const body = await readJson(req);
      return sodam.createRelation(bookId, code, {
        fromPersonId: reqString(body, 'fromPersonId', 1, 100),
        toPersonId: reqString(body, 'toPersonId', 1, 100),
        type: reqEnum<SodamRelationType>(body, 'type', RELATION_TYPES),
      });
    }
  }
  if (segments.length === 4 && sub === 'relations' && method === 'DELETE') {
    return sodam.deleteRelation(bookId, third, code);
  }

  // /books/:bookId/tree
  if (segments.length === 3 && sub === 'tree' && method === 'GET') {
    return sodam.tree(bookId, code);
  }

  // /books/:bookId/returns[/:returnId]
  if (segments.length === 3 && sub === 'returns' && method === 'GET') {
    const status = new URL(req.url).searchParams.get('status') ?? undefined;
    if (status && !RETURN_STATUSES.includes(status as (typeof RETURN_STATUSES)[number])) {
      throw badRequest(`status must be one of: ${RETURN_STATUSES.join(', ')}`);
    }
    return sodam.listReturns(bookId, code, status as 'OPEN' | 'DONE' | 'SKIPPED' | undefined);
  }
  if (segments.length === 4 && sub === 'returns' && method === 'PATCH') {
    const body = await readJson(req);
    return sodam.markReturn(bookId, third, code, {
      status: reqEnum(body, 'status', ['DONE', 'SKIPPED', 'OPEN'] as const),
      amountVnd: optIntMin0(body, 'amountVnd'),
    });
  }

  // /books/:bookId/export.csv + /import.csv
  if (segments.length === 3 && sub === 'export.csv' && method === 'GET') {
    return sodam.exportCsv(bookId, code);
  }
  if (segments.length === 3 && sub === 'import.csv' && method === 'POST') {
    const body = await readJson(req);
    return sodam.importCsv(bookId, code, reqString(body, 'csv', 0, 200_000));
  }

  // /books/:bookId/ai/*
  if (segments.length === 4 && sub === 'ai' && method === 'POST') {
    const body = third === 'photo' ? null : await readJson(req);
    if (third === 'parse') {
      return ai.parseUtterance(bookId, code, reqString(body!, 'text', 1, 2000));
    }
    if (third === 'suggest-amount') {
      return ai.suggestAmount(bookId, code, reqString(body!, 'personId', 1, 100));
    }
    if (third === 'photo') {
      const form = await req.formData().catch(() => null);
      const file = form?.get('file');
      if (!(file instanceof File)) return { candidates: [] };
      const buffer = Buffer.from(await file.arrayBuffer());
      return ai.photoCandidates(bookId, code, buffer.toString('base64'), file.type || 'image/jpeg');
    }
  }

  // /books/:bookId/sync
  if (segments.length === 3 && sub === 'sync' && method === 'POST') {
    const body = await readJson(req);
    if (!Array.isArray(body.mutations)) throw badRequest('mutations must be an array');
    const mutations = body.mutations.map((m) => {
      const mut = (m ?? {}) as Record<string, unknown>;
      if (typeof mut.clientMutationId !== 'string' || typeof mut.type !== 'string') {
        throw badRequest('each mutation needs clientMutationId and type strings');
      }
      return {
        clientMutationId: mut.clientMutationId,
        type: mut.type,
        payload: (mut.payload ?? {}) as Record<string, unknown>,
      };
    });
    return sodam.sync(bookId, code, mutations);
  }

  throw notFound('Route not found');
}

export async function GET(req: Request, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return handle(() => dispatch(req, path));
}

export async function POST(req: Request, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return handle(() => dispatch(req, path));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return handle(() => dispatch(req, path));
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return handle(() => dispatch(req, path));
}
