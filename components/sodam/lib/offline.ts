'use client';

import { useCallback, useEffect, useState } from 'react';
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

export function useSodamOffline(api: SodamApi) {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const enqueue = useCallback((bookId: string, type: string, payload: Record<string, unknown>) => {
    const m: SodamSyncMutation = {
      clientMutationId: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
    };
    void putMutation(bookId, m);
  }, []);

  const flush = useCallback(
    async (bookId: string) => {
      const mutations = await readAll(bookId);
      if (!mutations.length) return;
      const { applied } = await api.sync(bookId, mutations);
      await clearApplied(applied);
    },
    [api],
  );

  return { online, enqueue, flush };
}
