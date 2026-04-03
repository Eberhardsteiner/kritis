import type { AppState } from '../types';

const STORAGE_KEY = 'krisenfest-app-state-v1';

export function loadState(): Partial<AppState> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as Partial<AppState>;
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
