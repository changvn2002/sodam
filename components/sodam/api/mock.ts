import type {
  SodamApi,
  SodamBook,
  SodamEntry,
  SodamEvent,
  SodamPerson,
  SodamRelation,
  SodamReturnItem,
  SodamSyncMutation,
} from './types';
import { parseVietnameseGiftLine } from '../lib/parse-money';

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}

type Store = {
  books: SodamBook[];
  events: SodamEvent[];
  entries: SodamEntry[];
  people: SodamPerson[];
  relations: SodamRelation[];
  returns: SodamReturnItem[];
  appliedMutations: Set<string>;
};

function createStore(): Store {
  const bookId = id('book');
  const book: SodamBook = {
    id: bookId,
    name: 'Sổ nhà demo',
    inviteCode: 'DEMO01',
    createdAt: now(),
    updatedAt: now(),
  };
  return {
    books: [book],
    events: [],
    entries: [],
    people: [],
    relations: [],
    returns: [],
    appliedMutations: new Set(),
  };
}

let store = createStore();

export function resetSodamMockStore() {
  store = createStore();
}

export function createMockSodamApi(): SodamApi {
  return {
    async status() {
      return { product: { name: 'Sổ Đám', slug: 'sodam' }, aiConfigured: true };
    },
    async listBooks() {
      // Mock data lives in this tab's memory — the codes argument only
      // matters for the HTTP layer, which resolves codes server-side.
      return store.books.map((b) => ({ ...b }));
    },
    async createBook(name) {
      const book: SodamBook = {
        id: id('book'),
        name,
        inviteCode: id('inv').slice(-6).toUpperCase(),
        createdAt: now(),
        updatedAt: now(),
      };
      store.books.push(book);
      return book;
    },
    async joinBook(inviteCode) {
      const book = store.books.find((b) => b.inviteCode === inviteCode);
      if (!book) throw new Error('Không tìm thấy sổ.');
      return { ...book };
    },
    async dashboard(bookId) {
      const book = mustBook(bookId);
      const events = store.events.filter((e) => e.bookId === bookId);
      const openEvent = events.find((e) => e.status === 'OPEN') ?? null;
      const entries = store.entries.filter((e) => events.some((ev) => ev.id === e.eventId));
      const receivedGross = entries
        .filter((e) => events.find((ev) => ev.id === e.eventId)?.role === 'HOSTED')
        .reduce((s, e) => s + e.amountVnd, 0);
      const attended = entries
        .filter((e) => events.find((ev) => ev.id === e.eventId)?.role === 'ATTENDED')
        .reduce((s, e) => s + e.amountVnd, 0);
      const bookReturns = store.returns.filter((r) => r.bookId === bookId);
      const done = bookReturns.filter((r) => r.status === 'DONE');
      const open = bookReturns.filter((r) => r.status === 'OPEN');
      const settledVnd = done.reduce((s, r) => s + (r.suggestedAmountVnd ?? 0), 0);
      const returnedPaidVnd = done.reduce(
        (s, r) => s + (r.doneAmountVnd ?? r.suggestedAmountVnd ?? 0),
        0,
      );
      const overGivenVnd = done.reduce((s, r) => {
        const got = r.suggestedAmountVnd ?? 0;
        const paid = r.doneAmountVnd ?? got;
        return s + Math.max(0, paid - got);
      }, 0);
      const pendingReturnVnd = open.reduce((s, r) => s + (r.suggestedAmountVnd ?? 0), 0);
      return {
        book,
        openEvent: openEvent ? withEventTotals(openEvent) : null,
        openReturnCount: open.length,
        recentEvents: events.slice(-5).reverse().map(withEventTotals),
        totals: {
          receivedGrossVnd: receivedGross,
          receivedVnd: Math.max(0, receivedGross - settledVnd),
          settledVnd,
          returnedPaidVnd,
          overGivenVnd,
          pendingReturnVnd,
          givenVnd: attended + returnedPaidVnd,
          people: store.people.filter((p) => p.bookId === bookId).length,
        },
      };
    },
    async listEvents(bookId) {
      mustBook(bookId);
      return store.events
        .filter((e) => e.bookId === bookId)
        .map((e) => withEventTotals(e))
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
    },
    async createEvent(bookId, input) {
      mustBook(bookId);
      const event: SodamEvent = {
        id: id('evt'),
        bookId,
        title: input.title,
        kind: input.kind,
        role: input.role,
        status: 'OPEN',
        occurredOn: input.occurredOn ?? now().slice(0, 10),
        note: input.note ?? '',
        createdAt: now(),
        updatedAt: now(),
      };
      store.events.push(event);
      return event;
    },
    async getEvent(bookId, eventId) {
      const event = mustEvent(bookId, eventId);
      const returns = store.returns.filter((r) => r.bookId === bookId && r.fromEventId === eventId);
      const byPerson = new Map(returns.map((r) => [r.personId, r]));
      const entries = store.entries
        .filter((e) => e.eventId === eventId)
        .slice(0, 100)
        .map((e) => {
          const ret = e.personId ? byPerson.get(e.personId) : undefined;
          return {
            ...e,
            returnItem: ret
              ? {
                  id: ret.id,
                  status: ret.status,
                  receivedAmountVnd: ret.suggestedAmountVnd,
                  returnedAmountVnd: ret.doneAmountVnd,
                  overGivenVnd: Math.max(
                    0,
                    (ret.doneAmountVnd ?? 0) - (ret.suggestedAmountVnd ?? 0),
                  ),
                }
              : null,
          };
        });
      const totals = withEventTotals(event);
      const settledVnd = returns
        .filter((r) => r.status === 'DONE')
        .reduce((s, r) => s + (r.suggestedAmountVnd ?? 0), 0);
      const overGivenVnd = returns
        .filter((r) => r.status === 'DONE')
        .reduce((s, r) => s + Math.max(0, (r.doneAmountVnd ?? 0) - (r.suggestedAmountVnd ?? 0)), 0);
      return {
        ...totals,
        entries,
        settledVnd,
        netTotalVnd: Math.max(0, (totals.totalAmountVnd ?? 0) - settledVnd),
        overGivenVnd,
      };
    },
    async closeEvent(bookId, eventId) {
      const event = mustEvent(bookId, eventId);
      event.status = 'CLOSED';
      event.updatedAt = now();
      return event;
    },
    async createEntry(bookId, eventId, input) {
      const event = mustEvent(bookId, eventId);
      const person = ensurePerson(bookId, input.personName);
      const entry: SodamEntry = {
        id: id('ent'),
        eventId,
        personId: person.id,
        personName: input.personName.trim(),
        amountVnd: input.amountVnd,
        source: input.source ?? 'MANUAL',
        rawText: input.rawText ?? null,
        note: input.note ?? '',
        createdAt: now(),
        updatedAt: now(),
      };
      store.entries.unshift(entry);
      if (event.role === 'HOSTED') {
        syncReturnForPersonEvent(bookId, person.id, event.id);
      }
      return entry;
    },
    async updateEntry(bookId, eventId, entryId, input) {
      mustEvent(bookId, eventId);
      const entry = store.entries.find((e) => e.id === entryId && e.eventId === eventId);
      if (!entry) throw new Error('Không tìm thấy dòng.');
      if (input.personName != null) entry.personName = input.personName;
      if (input.amountVnd != null) entry.amountVnd = input.amountVnd;
      if (input.note != null) entry.note = input.note;
      entry.updatedAt = now();
      return entry;
    },
    async deleteEntry(bookId, eventId, entryId) {
      mustEvent(bookId, eventId);
      store.entries = store.entries.filter((e) => !(e.id === entryId && e.eventId === eventId));
    },
    async batchEntries(bookId, eventId, rows) {
      const out: SodamEntry[] = [];
      for (const row of rows.slice(0, 100)) {
        out.push(await this.createEntry(bookId, eventId, { ...row, source: 'PHOTO' }));
      }
      return out;
    },
    async listPeople(bookId) {
      mustBook(bookId);
      return store.people.filter((p) => p.bookId === bookId).slice(0, 200);
    },
    async searchPeople(bookId, q) {
      mustBook(bookId);
      const needle = q.trim().toLowerCase();
      return store.people
        .filter((p) => p.bookId === bookId && p.displayName.toLowerCase().includes(needle))
        .slice(0, 20)
        .map((p) => ({
          ...p,
          history: store.entries.filter((e) => e.personId === p.id).slice(0, 20),
        }));
    },
    async upsertPerson(bookId, input) {
      mustBook(bookId);
      if (input.id) {
        const person = store.people.find((p) => p.id === input.id && p.bookId === bookId);
        if (!person) throw new Error('Không tìm thấy người.');
        person.displayName = input.displayName;
        person.note = input.note ?? person.note;
        person.updatedAt = now();
        return person;
      }
      return ensurePerson(bookId, input.displayName, input.note);
    },
    async listRelations(bookId) {
      mustBook(bookId);
      const personIds = new Set(store.people.filter((p) => p.bookId === bookId).map((p) => p.id));
      return store.relations.filter((r) => personIds.has(r.fromPersonId)).slice(0, 200);
    },
    async createRelation(bookId, input) {
      mustBook(bookId);
      const rel: SodamRelation = { id: id('rel'), ...input };
      store.relations.push(rel);
      return rel;
    },
    async deleteRelation(bookId, relationId) {
      mustBook(bookId);
      const personIds = new Set(store.people.filter((p) => p.bookId === bookId).map((p) => p.id));
      const i = store.relations.findIndex(
        (r) => r.id === relationId && personIds.has(r.fromPersonId),
      );
      if (i >= 0) store.relations.splice(i, 1);
    },
    async tree(bookId) {
      return {
        people: await this.listPeople(bookId),
        relations: await this.listRelations(bookId),
      };
    },
    async listReturns(bookId, status) {
      mustBook(bookId);
      return store.returns
        .filter((r) => r.bookId === bookId && (!status || r.status === status))
        .map((r) => {
          const received = r.suggestedAmountVnd ?? 0;
          return {
            ...r,
            personName: store.people.find((p) => p.id === r.personId)?.displayName,
            fromEventTitle: store.events.find((e) => e.id === r.fromEventId)?.title,
            receivedAmountVnd: received,
            returnedAmountVnd: r.doneAmountVnd,
            overGivenVnd: r.doneAmountVnd != null ? Math.max(0, r.doneAmountVnd - received) : null,
          };
        })
        .slice(0, 100);
    },
    async markReturn(bookId, returnId, input) {
      const item = store.returns.find((r) => r.id === returnId && r.bookId === bookId);
      if (!item) throw new Error('Không tìm thấy trả lễ.');
      const received = item.suggestedAmountVnd ?? 0;
      item.status = input.status;
      item.doneAmountVnd =
        input.status === 'DONE' ? Math.max(0, Math.round(input.amountVnd ?? received)) : null;
      item.doneAt = input.status === 'DONE' ? now() : null;
      item.updatedAt = now();
      return {
        ...item,
        personName: store.people.find((p) => p.id === item.personId)?.displayName,
        receivedAmountVnd: received,
        returnedAmountVnd: item.doneAmountVnd,
        overGivenVnd:
          item.doneAmountVnd != null ? Math.max(0, item.doneAmountVnd - received) : null,
      };
    },
    async exportCsv(bookId) {
      mustBook(bookId);
      const events = store.events.filter((e) => e.bookId === bookId);
      const lines = ['eventTitle,eventRole,personName,amountVnd,source'];
      for (const event of events) {
        for (const entry of store.entries.filter((e) => e.eventId === event.id)) {
          lines.push(
            [event.title, event.role, entry.personName, String(entry.amountVnd), entry.source]
              .map(csvEscape)
              .join(','),
          );
        }
      }
      return lines.join('\n');
    },
    async importCsv(bookId, csv) {
      mustBook(bookId);
      const lines = csv.trim().split(/\r?\n/).slice(1);
      let imported = 0;
      let event = store.events.find((e) => e.bookId === bookId && e.status === 'OPEN');
      if (!event) {
        event = await this.createEvent(bookId, {
          title: 'Import CSV',
          kind: 'KHAC',
          role: 'HOSTED',
        });
      }
      for (const line of lines.slice(0, 100)) {
        const cols = line.split(',');
        if (cols.length < 4) continue;
        const personName = cols[2]?.replace(/^"|"$/g, '') ?? '';
        const amountVnd = Number(cols[3]);
        if (!personName || !Number.isFinite(amountVnd)) continue;
        await this.createEntry(bookId, event.id, { personName, amountVnd, source: 'MANUAL' });
        imported += 1;
      }
      return { imported };
    },
    async parseUtterance(_bookId, text) {
      const parsed = parseVietnameseGiftLine(text);
      if (!parsed.name || parsed.amountVnd == null) {
        return {
          intent: 'ask',
          name: parsed.name,
          amountVnd: parsed.amountVnd,
          rawText: text,
          speakBack: 'Chưa nghe rõ tên hoặc số tiền. Xin đọc lại.',
        };
      }
      return {
        intent: 'record',
        name: parsed.name,
        amountVnd: parsed.amountVnd,
        rawText: text,
        speakBack: `Đã ghi ${parsed.name}, ${parsed.amountVnd.toLocaleString('vi-VN')} đồng. Đúng không?`,
      };
    },
    async suggestAmount(bookId, personId) {
      mustBook(bookId);
      const history = store.entries.filter((e) => e.personId === personId);
      const avg =
        history.length > 0
          ? Math.round(history.reduce((s, e) => s + e.amountVnd, 0) / history.length / 50_000) *
            50_000
          : 500_000;
      return { amountVnd: avg || 500_000, reason: 'Theo trung bình các lần trước (demo).' };
    },
    async photoCandidates() {
      return {
        candidates: [
          { name: 'Nguyễn Văn A', amountVnd: 500_000 },
          { name: 'Trần Thị B', amountVnd: 300_000 },
        ],
      };
    },
    async sync(bookId, mutations: SodamSyncMutation[]) {
      mustBook(bookId);
      const applied: string[] = [];
      for (const m of mutations.slice(0, 50)) {
        if (store.appliedMutations.has(m.clientMutationId)) {
          applied.push(m.clientMutationId);
          continue;
        }
        store.appliedMutations.add(m.clientMutationId);
        applied.push(m.clientMutationId);
      }
      return { applied };
    },
  };
}

function mustBook(bookId: string) {
  const book = store.books.find((b) => b.id === bookId);
  if (!book) throw new Error('Không tìm thấy sổ.');
  return book;
}

function mustEvent(bookId: string, eventId: string) {
  mustBook(bookId);
  const event = store.events.find((e) => e.id === eventId && e.bookId === bookId);
  if (!event) throw new Error('Không tìm thấy đám.');
  return event;
}

function ensurePerson(bookId: string, displayName: string, note = ''): SodamPerson {
  const existing = store.people.find(
    (p) => p.bookId === bookId && p.displayName.toLowerCase() === displayName.trim().toLowerCase(),
  );
  if (existing) return existing;
  const person: SodamPerson = {
    id: id('per'),
    bookId,
    displayName: displayName.trim(),
    note,
    createdAt: now(),
    updatedAt: now(),
  };
  store.people.push(person);
  return person;
}

function syncReturnForPersonEvent(bookId: string, personId: string, fromEventId: string) {
  const personEntries = store.entries.filter(
    (e) => e.eventId === fromEventId && e.personId === personId,
  );
  const total = personEntries.reduce((s, e) => s + e.amountVnd, 0);
  const existing = store.returns
    .filter((r) => r.bookId === bookId && r.personId === personId && r.fromEventId === fromEventId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (personEntries.length === 0 || total <= 0) {
    if (existing?.status === 'OPEN') {
      store.returns = store.returns.filter((r) => r.id !== existing.id);
    }
    return;
  }

  if (existing) {
    if (existing.status !== 'OPEN') return;
    existing.suggestedAmountVnd = total;
    existing.updatedAt = now();
    return;
  }

  store.returns.push({
    id: id('ret'),
    bookId,
    personId,
    fromEventId,
    status: 'OPEN',
    suggestedAmountVnd: total,
    doneAmountVnd: null,
    doneAt: null,
    createdAt: now(),
    updatedAt: now(),
  });
}

function withEventTotals(event: SodamEvent): SodamEvent {
  const entries = store.entries.filter((e) => e.eventId === event.id);
  return {
    ...event,
    entryCount: entries.length,
    totalAmountVnd: entries.reduce((s, e) => s + e.amountVnd, 0),
  };
}

function csvEscape(value: string) {
  if (value.includes(',') || value.includes('"')) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
