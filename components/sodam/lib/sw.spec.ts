import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Static contract tests for the hand-written service worker (public/sw.js).
 * These verify the source-level guarantees (W5-01) only — actual install /
 * activation / offline-reload behaviour in a real browser is NOT covered
 * here and must be verified on the live deployment.
 */
const swSource = readFileSync(
  fileURLToPath(new URL('../../../public/sw.js', import.meta.url)),
  'utf8',
);

describe('public/sw.js — static contract', () => {
  it('registers install, activate and fetch listeners', () => {
    expect(swSource).toContain("addEventListener('install'");
    expect(swSource).toContain("addEventListener('activate'");
    expect(swSource).toContain("addEventListener('fetch'");
  });

  it('uses a versioned sodam-shell cache name', () => {
    expect(swSource).toMatch(/const CACHE = 'sodam-shell-[^']+'/);
  });

  it('precaches the app shell and key brand assets', () => {
    for (const url of [
      '/',
      '/manifest.webmanifest',
      '/icon.svg',
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/icons/icon-maskable-512.png',
      '/icons/apple-touch-icon.png',
      '/products/brand/sodam-logo.svg',
      '/og.jpg',
    ]) {
      expect(swSource).toContain(`'${url}'`);
    }
  });

  it('precaches per-URL so one failure cannot kill install', () => {
    expect(swSource).toContain('Promise.allSettled');
    expect(swSource).not.toContain('addAll');
  });

  it('activates immediately and claims clients', () => {
    expect(swSource).toContain('skipWaiting()');
    expect(swSource).toContain('clients.claim()');
  });

  it('evicts stale sodam-shell caches on activate', () => {
    expect(swSource).toContain("startsWith('sodam-shell-')");
    expect(swSource).toContain('caches.delete');
  });

  it('never intercepts /api/ (book data is never cached)', () => {
    expect(swSource).toContain("startsWith('/api/')");
  });

  it('falls back to the cached app shell for navigations', () => {
    expect(swSource).toContain("request.mode === 'navigate'");
    expect(swSource).toContain("caches.match('/')");
  });

  it('ignores cross-origin requests', () => {
    expect(swSource).toContain('url.origin !== self.location.origin');
  });
});
