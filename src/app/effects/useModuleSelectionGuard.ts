/**
 * useModuleSelectionGuard · Schutz-Effect fuer den Modul-Katalog-Drift
 *
 * Wenn das aktuell ausgewaehlte Modul (`state.selectedModuleId`) aus
 * dem effektiven Katalog verschwindet (z. B. nach einem Module-Pack-
 * Retire oder Login in einen anderen Tenant-Modul-Scope), faellt die
 * Auswahl auf das erste verfuegbare Modul zurueck.
 *
 * --------------------------------------------------------------------------
 * LATENTE FACH-ZUGEHOERIGKEIT: modules, nicht App-Shell-Infrastruktur
 * --------------------------------------------------------------------------
 * Dieser Effect wohnt bewusst in einer eigenen Datei (nicht
 * zusammen mit den drei App-Shell-Effects in `useAppShellEffects.ts`),
 * weil er fachlich naeher am **modules**-Bereich liegt als an der
 * Shell-Infrastruktur:
 *   - Er liest `effectiveModuleCatalog` (module-registry-Derivat)
 *   - Er schreibt `state.selectedModuleId` (modules-Domain)
 *   - Die drei Shell-Effects hingegen sind reine Lifecycle-Infrastruktur
 *     (Bootstrap, Toast-Timer, LocalStorage-Persistenz)
 *
 * Sobald ein `src/features/modules/`-Feature entsteht (in Block C nicht
 * geplant, aber denkbar fuer C3/C4), waere dieser Effect als
 * Handler-/Custom-Hook dorthin zu ziehen. Die Trennung in eine eigene
 * Datei macht diesen moeglichen Umzug einfach — lediglich ein File-Move
 * und ein Import-Swap in `src/App.tsx`.
 * --------------------------------------------------------------------------
 *
 * Extrahiert in C2.11c aus src/App.tsx (vormals useEffect #4 in der
 * App-Shell-Kette). 1:1-Verhalten.
 */
import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppState, SectorModuleDefinition } from '../../types';
import { builtInModules, getModuleByIdFromCatalog } from '../../lib/moduleRegistry';

export function useModuleSelectionGuard(
  selectedModuleId: string,
  effectiveModuleCatalog: SectorModuleDefinition[],
  setState: Dispatch<SetStateAction<AppState>>,
): void {
  useEffect(() => {
    if (!getModuleByIdFromCatalog(selectedModuleId, effectiveModuleCatalog)) {
      setState((current) => ({
        ...current,
        selectedModuleId: effectiveModuleCatalog[0]?.id ?? builtInModules[0].id,
      }));
    }
  }, [selectedModuleId, effectiveModuleCatalog, setState]);
}
