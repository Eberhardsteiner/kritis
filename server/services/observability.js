/**
 * observability.js · Singleton-Wrapper um den Observability-Store.
 *
 * Eingeführt in C3.6-Polish (retroaktiver Null-Deps-Nachzug). Vorher
 * lebte die Instanz als module-local `const observability` in
 * `server/index.js` und wurde als Deps-Entry an `registerSystemRoutes`
 * sowie als Closure-Variable an die Request-Middleware und
 * Rate-Limit-onLimit-Hooks gereicht.
 *
 * Jetzt ESM-Singleton: Der Store wird beim ersten Import gebaut und
 * bleibt per ES-Module-Semantik prozess-weit einzigartig. Beide
 * Konsumenten (routes/system.js für GET /api/system/observability und
 * server/index.js für Middleware + Security-Events) importieren
 * dieselbe Instanz.
 */
import { createObservabilityStore } from '../hardening.js';

export const observability = createObservabilityStore({
  recentEventLimit: 120,
  maxLatencySamplesPerRoute: 240,
});
