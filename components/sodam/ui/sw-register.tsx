'use client';

import { useEffect } from 'react';

/**
 * Registers the hand-written app-shell service worker (public/sw.js).
 * Production only — a SW in dev would serve stale chunks and confuse HMR.
 * Lane UI mounts <SwRegister /> once in the root layout; renders nothing.
 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Swallowed on purpose: registration can fail on unsupported/private
      // browsers; the app must keep working fully without the shell cache.
    });
  }, []);

  return null;
}

export default SwRegister;
