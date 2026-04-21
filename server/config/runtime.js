/**
 * runtime.js · Runtime-derived Konfigurations-Werte.
 *
 * Eingeführt in C3.0c als dritte Config-Kategorie neben `paths.js`
 * (Pfad-Konstanten) und `defaults.js` (Default-Objekte + statische
 * Konstanten). Diese Datei kapselt alle Werte, die **beim Modul-Load
 * aus Umgebungsvariablen und Runtime-Config-Buildern abgeleitet**
 * werden und danach für die gesamte Prozess-Laufzeit unverändert sind.
 *
 * Motivation: In C3.0c brauchen acht Funktionen der Auth-Session-
 * Schicht (buildAutoCreatedMembership, resolveOidcTargetTenant,
 * resolveOidcAccount, resolveOidcLoginContext, getAuthContext,
 * buildAnonymousMembership, buildAnonymousContext, buildAnonymousAccount)
 * Zugriff auf `authStrategy`, `runtimeConfig.anonymousRoleProfile`,
 * `ANONYMOUS_ACCESS_ENABLED` oder `GUEST_*`. Statt diese Werte als
 * Parameter zu reichen oder über eine Factory-Pattern-Indirection
 * zu binden, werden sie aus dieser zentralen Config-Datei importiert.
 * Das erhält das in C3.0a/b etablierte Einzel-Parameter-Muster und
 * vermeidet ein 30-Feld-Return-Objekt aus einem
 * `createAuthSessionService(deps)`-Factory.
 *
 * Bewusst NICHT hier:
 *  - `GENERATED_BOOTSTRAP_PASSWORD`, `INITIAL_BOOTSTRAP_PASSWORD`:
 *    seedingspezifisch, nicht runtime-konfigurativ. Bleiben in
 *    `server/index.js` bis C3.6 und ziehen dann mit
 *    `services/storage-init.js` um (seedFreshSystemIfEmpty,
 *    migrateLegacyStorageIfNeeded).
 *  - `PORT`, `MAX_JSON_SIZE` etc.: Limits/Statische Konstanten liegen
 *    in `defaults.js` bzw. `index.js`, nicht in runtime.js.
 *
 * Konsumenten:
 *  - `services/auth-session.js` (direkte Imports für 8 Funktionen)
 *  - `server/index.js` (Middleware-Setup, Route-Registrierungs-Deps,
 *    Seed-Password-Bootstrap-Kette)
 *  - `services/persistence-wrappers.js` importiert NICHT aus runtime —
 *    die beiden Platform-Settings-Wrappers bekommen `defaultPlatformSettings`
 *    als Parameter von den Adaptern in index.js.
 */
import { buildRuntimeConfig } from '../security.js';
import { buildAuthStrategyConfig } from '../auth-provider.js';
import { buildDefaultPlatformSettings } from './defaults.js';

/** Aus `process.env` + Defaults gebaute Runtime-Konfiguration. */
export const runtimeConfig = buildRuntimeConfig(process.env);

/**
 * Auth-Strategie-Config (OIDC-Settings, lokal/hybrid-Toggles).
 * Nutzt `runtimeConfig`, weil die Strategie von appMode und
 * authRequired abhängt.
 */
export const authStrategy = buildAuthStrategyConfig(process.env, runtimeConfig);

/** Erzwingt Auth vor jedem Schreib-Zugriff. Aus runtimeConfig. */
export const AUTHENTICATION_REQUIRED = runtimeConfig.authRequired;

/** Erlaubt anonymen Read-Only-Zugang. Aus runtimeConfig. */
export const ANONYMOUS_ACCESS_ENABLED = runtimeConfig.anonymousAccessEnabled;

/** Festgelegte Identifier für den offenen Lesemodus (Anonymous-Context). */
export const GUEST_ACCOUNT_ID = 'guest-access';
export const GUEST_USER_ID = 'usr-public';

/**
 * Demo-Admin-Passwort für Seed + lokale Mandantenerstellung.
 * Wird aus KRISENFEST_DEMO_ADMIN_PASSWORD gelesen, Fallback
 * „Krisenfest2026!". Von `server/routes/admin.js` als
 * Create-Tenant-Default und von der Seed-Logik konsumiert.
 */
export const DEFAULT_DEMO_PASSWORD = String(
  process.env.KRISENFEST_DEMO_ADMIN_PASSWORD || 'Krisenfest2026!',
).trim() || 'Krisenfest2026!';

/**
 * Plattform-Settings-Default-Objekt. Runtime-gebaut über die
 * Factory aus `defaults.js`, weil `deploymentStage`, `publicApiEnabled`
 * und `allowedOrigins` von `runtimeConfig.appMode` bzw.
 * `runtimeConfig.allowedOrigins` abhängen.
 */
export const defaultPlatformSettings = buildDefaultPlatformSettings(runtimeConfig);
