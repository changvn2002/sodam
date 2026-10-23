/**
 * Port of the host's NestJS `SodamService` (server/src/products/sodam/sodam.service.ts).
 * Business logic is unchanged; Nest exceptions became HttpError and the
 * injected PrismaService became the standalone Prisma client.
 *
 * Access model (no-login): there are no accounts. Every book-scoped function
 * takes the book's invite code — presented by the client from its local
 * registry — and `requireBookAccess` verifies it before any data is touched.
 * A wrong/missing code answers 404 "Book not found", exactly like a book
 * that does not exist, so codes cannot be probed by book id.
 */

export { requireBookAccess } from './sodam-service/internal';
export { createBook, joinBook, listBooksByCodes, rotateInviteCode } from './sodam-service/books';
export { dashboard } from './sodam-service/dashboard';
export { closeEvent, createEvent, getEvent, listEvents } from './sodam-service/events';
export { batchEntries, createEntry, deleteEntry, updateEntry } from './sodam-service/entries';
export { listPeople, searchPeople, upsertPerson } from './sodam-service/people';
export { createRelation, deleteRelation, listRelations, tree } from './sodam-service/relations';
export { listReturns, markReturn } from './sodam-service/returns';
export { exportCsv, importCsv, sync } from './sodam-service/transfer';
