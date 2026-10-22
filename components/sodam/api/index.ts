import { createHttpSodamApi } from './http';
import { createMockSodamApi } from './mock';
import type { SodamApi } from './types';

export type SodamApiMode = 'http' | 'mock';

export function resolveSodamApiMode(): SodamApiMode {
  const mode = (process.env.NEXT_PUBLIC_SODAM_API_MODE ?? 'http').toLowerCase();
  return mode === 'mock' ? 'mock' : 'http';
}

export function createSodamApi(mode: SodamApiMode = resolveSodamApiMode()): SodamApi {
  return mode === 'mock' ? createMockSodamApi() : createHttpSodamApi();
}

export type { SodamApi } from './types';
export { resetSodamMockStore } from './mock';
