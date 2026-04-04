import type { AppState } from '../types';

const STORAGE_KEY = 'krisenfest-app-state-v6';
const AUTH_TOKEN_KEY = 'krisenfest-app-auth-token-v1';
const LEGACY_KEYS = [
  'krisenfest-app-state-v5',
  'krisenfest-app-state-v4',
  'krisenfest-app-state-v3',
  'krisenfest-app-state-v2',
  'krisenfest-app-state-v1',
];

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
    // intentionally silent for prototype use
  }
}

export function loadAuthToken(): string {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function saveAuthToken(token: string): void {
  try {
    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // intentionally silent for prototype use
  }
}

export function clearAuthToken(): void {
  saveAuthToken('');
}
