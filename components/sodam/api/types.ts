/** Stable contract for live HTTP and mock demo — keep in sync with server DTOs. */

export type SodamEventKind =
  | 'CUOI'
  | 'DAM_HOI'
  | 'MA'
  | 'GIO'
  | 'MUNG_THO'
  | 'THOI_NOI'
  | 'DAY_THANG'
  | 'TAN_GIA'
  | 'KHAI_TRUONG'
  | 'SINH_NHAT'
  | 'MUNG_TUOI'
  | 'TOT_NGHIEP'
  | 'KHAC';
export type SodamEventRole = 'HOSTED' | 'ATTENDED';
export type SodamEventStatus = 'OPEN' | 'CLOSED';
export type SodamEntrySource = 'VOICE' | 'PHOTO' | 'MANUAL';
export type SodamReturnStatus = 'OPEN' | 'DONE' | 'SKIPPED';
export type SodamRelationType = 'SPOUSE' | 'PARENT' | 'CHILD' | 'SIBLING' | 'OTHER';

export type SodamBook = {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
};

export type SodamPerson = {
  id: string;
  bookId: string;
  displayName: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type SodamEvent = {
  id: string;
  bookId: string;
  title: string;
  kind: SodamEventKind;
  role: SodamEventRole;
  status: SodamEventStatus;
  occurredOn: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  entryCount?: number;
  totalAmountVnd?: number;
  settledVnd?: number;
  netTotalVnd?: number;
  overGivenVnd?: number;
};

export type SodamEntryReturn = {
  id: string;
  status: SodamReturnStatus;
  receivedAmountVnd: number | null;
  returnedAmountVnd: number | null;
  overGivenVnd: number;
};

export type SodamEntry = {
  id: string;
  eventId: string;
  personId: string | null;
  personName: string;
  amountVnd: number;
  source: SodamEntrySource;
  rawText: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
  returnItem?: SodamEntryReturn | null;
};

export type SodamReturnItem = {
  id: string;
  bookId: string;
  personId: string;
  personName?: string;
  fromEventId: string;
  fromEventTitle?: string;
  status: SodamReturnStatus;
  suggestedAmountVnd: number | null;
  doneAmountVnd: number | null;
  receivedAmountVnd?: number | null;
  returnedAmountVnd?: number | null;
  overGivenVnd?: number | null;
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SodamRelation = {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  type: SodamRelationType;
};

export type SodamDashboardTotals = {
  receivedVnd: number;
  receivedGrossVnd?: number;
  settledVnd?: number;
  returnedPaidVnd?: number;
  overGivenVnd?: number;
  pendingReturnVnd?: number;
  givenVnd: number;
  people: number;
};

export type SodamDashboard = {
  book: SodamBook;
  openEvent: SodamEvent | null;
  openReturnCount: number;
  recentEvents: SodamEvent[];
  totals: SodamDashboardTotals;
};

export type SodamParseResult = {
  intent: 'record' | 'correct' | 'ask' | 'unknown';
  name: string | null;
  amountVnd: number | null;
  rawText: string;
  speakBack: string;
};

export type SodamPhotoCandidate = { name: string; amountVnd: number };

export type SodamSuggestAmount = {
  amountVnd: number;
  reason: string;
};

export type SodamSyncMutation = {
  clientMutationId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type SodamApi = {
  status: () => Promise<{ product: { name: string; slug: string }; aiConfigured: boolean }>;
  /** Resolve the books whose invite codes this device holds (no accounts). */
  listBooks: (codes: string[]) => Promise<SodamBook[]>;
  createBook: (name: string) => Promise<SodamBook>;
  joinBook: (inviteCode: string) => Promise<SodamBook>;
  /** Đổi mã mời: mã cũ chết ngay, trả về sổ kèm mã mới (DATA-04(ii)). */
  rotateInviteCode: (bookId: string) => Promise<SodamBook>;
  dashboard: (bookId: string) => Promise<SodamDashboard>;
  listEvents: (bookId: string) => Promise<SodamEvent[]>;
  createEvent: (
    bookId: string,
    input: {
      title: string;
      kind: SodamEventKind;
      role: SodamEventRole;
      occurredOn?: string;
      note?: string;
    },
  ) => Promise<SodamEvent>;
  getEvent: (bookId: string, eventId: string) => Promise<SodamEvent & { entries: SodamEntry[] }>;
  closeEvent: (bookId: string, eventId: string) => Promise<SodamEvent>;
  createEntry: (
    bookId: string,
    eventId: string,
    input: {
      personName: string;
      amountVnd: number;
      source?: SodamEntrySource;
      note?: string;
      rawText?: string;
    },
  ) => Promise<SodamEntry>;
  updateEntry: (
    bookId: string,
    eventId: string,
    entryId: string,
    input: Partial<{ personName: string; amountVnd: number; note: string }>,
  ) => Promise<SodamEntry>;
  deleteEntry: (bookId: string, eventId: string, entryId: string) => Promise<void>;
  batchEntries: (
    bookId: string,
    eventId: string,
    rows: Array<{ personName: string; amountVnd: number }>,
  ) => Promise<SodamEntry[]>;
  listPeople: (bookId: string) => Promise<SodamPerson[]>;
  searchPeople: (
    bookId: string,
    q: string,
  ) => Promise<Array<SodamPerson & { history: SodamEntry[] }>>;
  upsertPerson: (
    bookId: string,
    input: { displayName: string; note?: string; id?: string },
  ) => Promise<SodamPerson>;
  listRelations: (bookId: string) => Promise<SodamRelation[]>;
  createRelation: (
    bookId: string,
    input: { fromPersonId: string; toPersonId: string; type: SodamRelationType },
  ) => Promise<SodamRelation>;
  deleteRelation: (bookId: string, relationId: string) => Promise<void>;
  tree: (bookId: string) => Promise<{ people: SodamPerson[]; relations: SodamRelation[] }>;
  listReturns: (bookId: string, status?: SodamReturnStatus) => Promise<SodamReturnItem[]>;
  markReturn: (
    bookId: string,
    returnId: string,
    input: { status: 'OPEN' | 'DONE' | 'SKIPPED'; amountVnd?: number },
  ) => Promise<SodamReturnItem>;
  exportCsv: (bookId: string) => Promise<string>;
  importCsv: (bookId: string, csv: string) => Promise<{ imported: number }>;
  parseUtterance: (bookId: string, text: string) => Promise<SodamParseResult>;
  suggestAmount: (bookId: string, personId: string) => Promise<SodamSuggestAmount>;
  photoCandidates: (bookId: string, file: File) => Promise<{ candidates: SodamPhotoCandidate[] }>;
  sync: (bookId: string, mutations: SodamSyncMutation[]) => Promise<{ applied: string[] }>;
};
