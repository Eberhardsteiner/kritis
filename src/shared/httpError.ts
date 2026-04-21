/**
 * HTTP-Fehler-Utilities fuer die Client-Seite.
 *
 * Aktuell einzige Funktion: `isApiStatus` — Typ-Guard fuer
 * ParseJsonResponse-geworfene Error-Objekte aus `lib/serverApi.ts`.
 * Die Errors tragen ein optionales `.status`-Feld (number), mit dem
 * Handler zwischen Permission-Fehler (403), Auth-Expiry (401) und
 * Version-Conflict (409) unterscheiden.
 *
 * Extrahiert in C2.11b aus `src/App.tsx`. Konsumenten:
 *  - `src/app/state/buildAppState.ts` (indirekt, in C2.11c wandernd:
 *    App-Shell `loadStateFromServer` prueft 401)
 *  - `features/platform/hooks/usePlatformSystemHandlers`
 *    (`pushStateToServer` prueft 401 und 409 — zentral fuer die
 *    Invariante (3)/(4) aus dem Server-Sync-Push-Loop)
 *
 * Liegt bewusst in `src/shared/` (nicht in `src/app/state/`), weil
 * er von mindestens einem Feature-Hook konsumiert wird und nicht
 * App-Shell-spezifisch ist. In C3 (server/index.js-Zerlegung) koennen
 * hier weitere HTTP-Error-Helpfer ergaenzt werden.
 */
export function isApiStatus(error: unknown, status: number): boolean {
  return Boolean(
    error
      && typeof error === 'object'
      && 'status' in error
      && (error as { status?: number }).status === status,
  );
}
