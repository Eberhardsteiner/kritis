/**
 * useAppShellEffects · Reine App-Shell-Infrastruktur-Effects
 *
 * Drei klassische Lifecycle-/Infrastruktur-useEffects, die bisher als
 * Inline-useEffects in src/App.tsx lebten:
 *   - Bootstrap beim ersten Mount (initial load vom Server)
 *   - Notice-Dismiss-Timer (Toast-Auto-Hide nach 6 Sekunden)
 *   - LocalStorage-Persistenz (saveState nach jedem State-Change)
 *
 * Extrahiert in C2.11c. Ein vierter useEffect (useModuleSelectionGuard)
 * lebt bewusst in einer separaten Datei — siehe
 * `src/app/effects/useModuleSelectionGuard.ts` fuer die fachliche
 * Begruendung.
 *
 * Alle drei Effects sind rein infrastrukturell (Lifecycle-Koordination,
 * kein Fach-Bezug). Sie bleiben in der App-Shell-Ebene.
 */
import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppState } from '../../types';
import { saveState } from '../../lib/storage';

interface Notice {
  type: 'success' | 'error' | 'info';
  text: string;
  details?: string[];
}

export interface AppShellEffectsDependencies {
  // === Bootstrap =============================================================
  // Einmaliger Server-Bootstrap beim ersten Mount. loadStateFromServer
  // kommt aus useServerSync.
  loadStateFromServer: () => Promise<boolean>;

  // === Notice-Dismiss-Timer ================================================
  notice: Notice | null;
  setNotice: Dispatch<SetStateAction<Notice | null>>;

  // === LocalStorage-Persistenz ==============================================
  state: AppState;
}

/**
 * Registriert die drei App-Shell-Infrastruktur-Effects in stabiler
 * Reihenfolge. Die Reihenfolge ist wichtig: Bootstrap zuerst (triggert
 * Hydration-Seiteneffekte), dann Notice-Timer (UI-Toast), dann
 * LocalStorage-Persistenz (reagiert auf jede Hydration).
 */
export function useAppShellEffects(deps: AppShellEffectsDependencies): void {
  const { loadStateFromServer, notice, setNotice, state } = deps;

  // Bootstrap: einmaliger initial-load. Empty dep array -> fires genau einmal.
  useEffect(() => {
    void loadStateFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notice-Dismiss: bei jeder notice-Aenderung neuer 6s-Timer.
  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice, setNotice]);

  // LocalStorage-Persistenz: saveState bei jeder State-Aenderung.
  useEffect(() => {
    saveState(state);
  }, [state]);
}
