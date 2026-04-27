/**
 * version.ts · Zentrale Version-Konstanten
 *
 * APP_VERSION ist der sprechende Release-Name, angezeigt im Footer und
 * in Diagnose-Ausgaben. Er folgt dem „v<major>.<minor>"-Muster.
 *
 * BUILD_COMMIT und BUILD_DATE werden zur Build-Zeit von Vite injiziert
 * (siehe vite.config.js `define`-Block). Für Dev-Runs (`npm run dev`)
 * sind sie ebenfalls definiert, aber mit "dev"-Platzhaltern.
 *
 * Die Konstanten sind bewusst als plain export ausgeführt (kein default,
 * kein object), damit TypeScript-Inlining bei Produktionsbuilds greift
 * und Treeshaking die Werte in jeden Import-Pfad inline-ziehen kann.
 */

// Globale Symbole aus vite.config.js `define` — zur Build-Zeit durch
// Literal-Strings ersetzt. Die declare-Deklaration ist nötig, weil das
// Symbol kein `import.meta.env`-Eintrag ist, sondern ein echtes Global.
declare const __APP_BUILD_COMMIT__: string;
declare const __APP_BUILD_DATE__: string;

export const APP_VERSION = 'v0.9.40';

export const BUILD_COMMIT =
  typeof __APP_BUILD_COMMIT__ !== 'undefined' ? __APP_BUILD_COMMIT__ : 'dev';

export const BUILD_DATE =
  typeof __APP_BUILD_DATE__ !== 'undefined' ? __APP_BUILD_DATE__ : 'dev';

/**
 * Konkatenierter Versions-String, wie er im Footer angezeigt wird.
 * Beispiel: `v0.9 · main@57846fd · 2026-04-22`
 *
 * Die Segmente sind bewusst mit mittlerem Bindestrich (·, U+00B7)
 * getrennt, damit der String auch in schmalen UI-Zonen lesbar bleibt.
 */
export function formatBuildLabel(): string {
  return `${APP_VERSION} · main@${BUILD_COMMIT} · ${BUILD_DATE}`;
}
