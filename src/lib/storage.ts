import type { AppState } from '../types';

const STORAGE_KEY = 'krisenfest-app-state-v2';
const LEGACY_KEYS = ['krisenfest-app-state-v1'];

export function loadState(): Partial<AppState> | null {
  try {
    const candidates = [STORAGE_KEY, ...LEGACY_KEYS];

    for (const key of candidates) {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      return JSON.parse(raw) as Partial<AppState>;
    }

    return null;
  } catch {
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // intentionally silent for local prototype
  }
}
