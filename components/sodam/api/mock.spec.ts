import { beforeEach, describe, expect, it } from 'vitest';
import { createMockSodamApi, resetSodamMockStore } from './mock';

describe('sodam mock api OF-01 / SD', () => {
  beforeEach(() => resetSodamMockStore());

  it('SD-01 create book as owner', async () => {
    const api = createMockSodamApi();
    const book = await api.createBook('Nhà A');
    expect(book.myRole).toBe('OWNER');
    expect(book.inviteCode).toBeTruthy();
  });

  it('SD-04 HOSTED entry creates return', async () => {
    const api = createMockSodamApi();
    const books = await api.listBooks();
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
    const bookId = (await api.listBooks())[0]!.id;
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
    const bookId = (await api.listBooks())[0]!.id;
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
    const bookId = (await api.listBooks())[0]!.id;
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
    const bookId = (await api.listBooks())[0]!.id;
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
    const bookId = (await api.listBooks())[0]!.id;
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
    const bookId = (await api.listBooks())[0]!.id;
    const r = await api.parseUtterance(bookId, 'Nguyễn A 500 nghìn');
    expect(r.intent).toBe('record');
    expect(r.amountVnd).toBe(500_000);
  });
});
