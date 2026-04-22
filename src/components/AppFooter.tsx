/**
 * AppFooter · Dezente Version-/Build-Info unterhalb der Haupt-Ansicht.
 *
 * Wird in der AppShell (src/App.tsx) am Ende von `.main-shell` gerendert.
 * Ziel: Immer sichtbar, aber nicht aufdringlich. Liest die zentrale
 * Version-Konstante aus `src/lib/version.ts` (inkl. Build-Time-injizierten
 * Commit-Hash und Build-Datum).
 *
 * Formate:
 *   - Produktiv: `v0.9 · main@57846fd · 2026-04-22`
 *   - Dev-Run:   `v0.9 · main@dev · dev`
 */
import { formatBuildLabel } from '../lib/version';

export function AppFooter() {
  return (
    <footer className="app-footer" aria-label="App-Version und Build-Info">
      <span>{formatBuildLabel()}</span>
    </footer>
  );
}
