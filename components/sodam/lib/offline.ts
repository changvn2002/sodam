'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SodamApi, SodamSyncMutation } from '../api/types';

const DB = 'sodam-offline-v1';
const STORE = 'outbox';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'clientMutationId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readAll(bookId: string): Promise<SodamSyncMutation[]> {
  if (typeof indexedDB === 'undefined') return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as Array<SodamSyncMutation & { bookId: string }>).filter(
        (r) => r.bookId === bookId,
      );
      resolve(
        rows.map(({ clientMutationId, type, payload, createdAt }) => ({
          clientMutationId,
          type,
          payload,
          createdAt,
        })),
      );
    };
    req.onerror = () => reject(req.error);
  });
}

async function putMutation(bookId: string, m: SodamSyncMutation) {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ ...m, bookId });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearApplied(ids: string[]) {
  if (typeof indexedDB === 'undefined' || !ids.length) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Offline outbox for the Sodam ledger.
 *
 * Truth (U1) that this hook must preserve: book data lives on the server, so
 * opening/loading a book needs network. The outbox only queues NEW entries
 * (`createEntry` mutations) written while offline; edits/deletes are never
 * replayed. DB name, store, keyPath and the mutation format are frozen —
 * queues written by older builds must survive upgrades untouched.
 *
 * Contract (backwards compatible): { online, enqueue, flush } as before,
 * plus { pendingCount, flushFailed, bindBook, refreshPending } for the
 * offline UI (banner + outbox chip).
 */
export function useSodamOffline(api: SodamApi) {
  // Hydration discipline: the first render MUST be identical on server and
  // client. Reading `navigator.onLine` in the initializer breaks that —
  // Node ≥21 has a global `navigator` without `onLine`, so the old
  // `typeof navigator` guard still evaluated to `undefined` (falsy) on the
  // server, SSR emitted the offline banner, the online client did not, and
  // every load threw React #418. Start from the SSR default (`true`) and
  // sync the real value in the mount effect below.
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [flushFailed, setFlushFailed] = useState(false);
  const lastBookIdRef = useRef<string | null>(null);

  /** Recount the bound book's queued mutations straight from IndexedDB. */
  const refreshPending = useCallback(async (bookId?: string): Promise<number> => {
    if (bookId) lastBookIdRef.current = bookId;
    const target = bookId ?? lastBookIdRef.current;
    if (!target) {
      setPendingCount(0);
      return 0;
    }
    try {
      const rows = await readAll(target);
      setPendingCount(rows.length);
      return rows.length;
    } catch {
      // IndexedDB unavailable/blocked: keep the last known count rather than
      // claiming the queue is empty.
      return -1;
    }
  }, []);

  /** Lane UI calls this when a book is opened so auto-flush/count know it. */
  const bindBook = useCallback(
    (bookId: string) => {
      lastBookIdRef.current = bookId;
      void refreshPending(bookId);
    },
    [refreshPending],
  );

  const flush = useCallback(
    async (bookId: string) => {
      lastBookIdRef.current = bookId;
      try {
        const mutations = await readAll(bookId);
        if (!mutations.length) {
          setPendingCount(0);
          setFlushFailed(false);
          return;
        }
        const { applied } = await api.sync(bookId, mutations);
        await clearApplied(applied);
        const remaining = await readAll(bookId);
        setPendingCount(remaining.length);
        // Partial apply: whatever the server did not confirm stays queued
        // and is surfaced as "not sent yet" so the user can retry.
        setFlushFailed(remaining.length > 0);
      } catch {
        // Network (or DB) failure: NEVER drop the queue and NEVER throw —
        // callers fire flush optimistically (online event, screen change).
        setFlushFailed(true);
        try {
          const rows = await readAll(bookId);
          setPendingCount(rows.length);
        } catch {
          // Keep the last known count; the chip still shows the failure.
        }
      }
    },
    [api],
  );

  useEffect(() => {
    // Sync the real connectivity once on mount (see initializer note):
    // an actually-offline client gets its banner here, one tick after
    // hydration, instead of via a server/client render mismatch.
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      // Back online: replay the bound book's queue automatically, then the
      // flush itself refreshes pendingCount / flushFailed.
      const bookId = lastBookIdRef.current;
      if (bookId) void flush(bookId);
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [flush]);

  const enqueue = useCallback(
    (bookId: string, type: string, payload: Record<string, unknown>) => {
      lastBookIdRef.current = bookId;
      const m: SodamSyncMutation = {
        clientMutationId: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type,
        payload,
        createdAt: new Date().toISOString(),
      };
      void putMutation(bookId, m)
        .then(() => refreshPending(bookId))
        .catch(() => {
          // Write failed (e.g. storage blocked): recount so the UI never
          // claims a queue size we could not persist.
          void refreshPending(bookId);
        });
    },
    [refreshPending],
  );

  return { online, enqueue, flush, pendingCount, flushFailed, bindBook, refreshPending };
}
