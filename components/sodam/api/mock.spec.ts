import { beforeEach, describe, expect, it } from 'vitest';
import { createMockSodamApi, resetSodamMockStore } from './mock';

describe('sodam mock api OF-01 / SD', () => {
  beforeEach(() => resetSodamMockStore());

  it('SD-01 create book (no account) returns a book with an invite code', async () => {
    const api = createMockSodamApi();
    const book = await api.createBook('Nhà A');
    expect(book.id).toBeTruthy();
    expect(book.inviteCode).toBeTruthy();
  });

  it('NL-01 no-login flow: create book → event → entry → dashboard totals', async () => {
    const api = createMockSodamApi();
    const book = await api.createBook('Sổ cưới 2026');
    // Resolve "my books" the way the client does: by stored invite codes.
    const mine = await api.listBooks([book.inviteCode]);
    expect(mine.map((b) => b.id)).toContain(book.id);

    const event = await api.createEvent(book.id, {
      title: 'Cưới con gái',
      kind: 'CUOI',
      role: 'HOSTED',
    });
    await api.createEntry(book.id, event.id, { personName: 'Bác Tư', amountVnd: 1_000_000 });
    await api.createEntry(book.id, event.id, { personName: 'Cô Năm', amountVnd: 500_000 });

    const dash = await api.dashboard(book.id);
    expect(dash.totals.receivedGrossVnd).toBe(1_500_000);
    expect(dash.totals.people).toBe(2);
    const detail = await api.getEvent(book.id, event.id);
    expect(detail.entries).toHaveLength(2);
    expect(detail.totalAmountVnd).toBe(1_500_000);
  });

  it('NL-02 join by invite code opens the same book; wrong code is rejected', async () => {
    const api = createMockSodamApi();
    const book = await api.createBook('Sổ nhà ngoại');
    const joined = await api.joinBook(book.inviteCode);
    expect(joined.id).toBe(book.id);
    await expect(api.joinBook('KHONG-CO-MA-NAY')).rejects.toThrow();
  });

  it('SD-04 HOSTED entry creates return', async () => {
    const api = createMockSodamApi();
    const books = await api.listBooks([]);
    const bookId = books[0]!.id;
    const event = await api.createEvent(bookId, {
      title: 'Cưới',
      kind: 'CUOI',
      role: 'HOSTED',
    });
    await api.createEntry(bookId, event.id, {
      personName: 'Nguyễn A',
      amountVnd: 500_000,
      source: 'MANUAL',
    });
    const returns = await api.listReturns(bookId, 'OPEN');
    expect(returns.length).toBeGreaterThanOrEqual(1);
    expect(returns[0]!.suggestedAmountVnd).toBe(500_000);
  });

  it('SD-05 mark return done', async () => {
    const api = createMockSodamApi();
    const bookId = (await api.listBooks([]))[0]!.id;
    const event = await api.createEvent(bookId, {
      title: 'Cưới',
      kind: 'CUOI',
      role: 'HOSTED',
    });
    await api.createEntry(bookId, event.id, {
      personName: 'Nguyễn A',
      amountVnd: 400_000,
    });
    const open = await api.listReturns(bookId, 'OPEN');
    const done = await api.markReturn(bookId, open[0]!.id, {
      status: 'DONE',
      amountVnd: 400_000,
    });
    expect(done.status).toBe('DONE');
  });

  it('SD-05b trả nhiều hơn vẫn trừ đúng số mừng', async () => {
    const api = createMockSodamApi();
    const bookId = (await api.listBooks([]))[0]!.id;
    const event = await api.createEvent(bookId, {
      title: 'Cưới',
      kind: 'CUOI',
      role: 'HOSTED',
    });
    await api.createEntry(bookId, event.id, {
      personName: 'Nguyễn A',
      amountVnd: 500_000,
    });
    await api.createEntry(bookId, event.id, {
      personName: 'Trần B',
      amountVnd: 300_000,
    });
    const open = await api.listReturns(bookId, 'OPEN');
    const a = open.find((r) => r.personName === 'Nguyễn A')!;
    const marked = await api.markReturn(bookId, a.id, {
      status: 'DONE',
      amountVnd: 700_000,
    });
    expect(marked.overGivenVnd).toBe(200_000);
    expect(marked.receivedAmountVnd).toBe(500_000);

    const dash = await api.dashboard(bookId);
    expect(dash.totals.receivedGrossVnd).toBe(800_000);
    expect(dash.totals.settledVnd).toBe(500_000);
    expect(dash.totals.receivedVnd).toBe(300_000);
    expect(dash.totals.overGivenVnd).toBe(200_000);

    const detail = await api.getEvent(bookId, event.id);
    expect(detail.netTotalVnd).toBe(300_000);
    expect(detail.overGivenVnd).toBe(200_000);
  });

  it('SD-06 relation tree', async () => {
    const api = createMockSodamApi();
    const bookId = (await api.listBooks([]))[0]!.id;
    const a = await api.upsertPerson(bookId, { displayName: 'A' });
    const b = await api.upsertPerson(bookId, { displayName: 'B' });
    await api.createRelation(bookId, {
      fromPersonId: a.id,
      toPersonId: b.id,
      type: 'SIBLING',
    });
    const tree = await api.tree(bookId);
    expect(tree.relations).toHaveLength(1);
  });

  it('SD-07 excel roundtrip', async () => {
    const api = createMockSodamApi();
    const bookId = (await api.listBooks([]))[0]!.id;
    const event = await api.createEvent(bookId, {
      title: 'Cưới',
      kind: 'CUOI',
      role: 'HOSTED',
    });
    await api.createEntry(bookId, event.id, {
      personName: 'X',
      amountVnd: 200_000,
    });
    const csv = await api.exportCsv(bookId);
    const { imported } = await api.importCsv(bookId, csv);
    expect(imported).toBeGreaterThanOrEqual(1);
  });

  it('OF-02 sync idempotent', async () => {
    const api = createMockSodamApi();
    const bookId = (await api.listBooks([]))[0]!.id;
    const mut = {
      clientMutationId: 'mut_1',
      type: 'createEntry',
      payload: {},
      createdAt: new Date().toISOString(),
    };
    const a = await api.sync(bookId, [mut]);
    const b = await api.sync(bookId, [mut]);
    expect(a.applied).toContain('mut_1');
    expect(b.applied).toContain('mut_1');
  });

  it('SV-01 parse via mock', async () => {
    const api = createMockSodamApi();
    const bookId = (await api.listBooks([]))[0]!.id;
    const r = await api.parseUtterance(bookId, 'Nguyễn A 500 nghìn');
    expect(r.intent).toBe('record');
    expect(r.amountVnd).toBe(500_000);
  });
});

describe('mock — rotate invite code (DATA-04(ii))', () => {
  beforeEach(() => resetSodamMockStore());

  it('new code opens the book, old code is rejected', async () => {
    const api = createMockSodamApi();
    const book = await api.createBook('Sổ mock đổi mã');
    const oldCode = book.inviteCode;
    const rotated = await api.rotateInviteCode(book.id);
    expect(rotated.inviteCode).not.toBe(oldCode);
    const joined = await api.joinBook(rotated.inviteCode);
    expect(joined.id).toBe(book.id);
    await expect(api.joinBook(oldCode)).rejects.toThrow();
  });
});
