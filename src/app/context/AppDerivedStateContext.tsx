/**
 * AppDerivedStateContext · Abgeleiteter Zustand aus `useAppDerivedState`.
 *
 * Eingefuehrt in C2.11d. Der gesamte Rueckgabewert von
 * `useAppDerivedState({ state, moduleRegistryEntries })` wird hier
 * gebuendelt und an die Feature-Hooks gereicht, die keine
 * Mutationen brauchen (reporting, gap, teilweise regulatory/
 * measures/evidence fuer Lookups und Summaries).
 *
 * Siehe WorkspaceStateContext.tsx fuer die Abgrenzung der beiden
 * Contexts und die Re-Render-Kontroll-Entscheidung (Standard-Bail-Out,
 * keine Selektoren).
 */
import { createContext, useContext } from 'react';
import { useAppDerivedState as useAppDerivedStateComputation } from '../../hooks/useAppDerivedState';

export type AppDerivedStateValue = ReturnType<typeof useAppDerivedStateComputation>;

const MISSING_PROVIDER = Symbol('MISSING_APP_DERIVED_STATE_PROVIDER');

export const AppDerivedStateContext = createContext<
  AppDerivedStateValue | typeof MISSING_PROVIDER
>(MISSING_PROVIDER);

AppDerivedStateContext.displayName = 'AppDerivedStateContext';

export function useAppDerivedState(): AppDerivedStateValue {
  const value = useContext(AppDerivedStateContext);
  if (value === MISSING_PROVIDER) {
    throw new Error(
      'useAppDerivedState must be called inside <AppProvider>. '
        + 'Dieser Context kapselt die Ableitungen aus state + '
        + 'moduleRegistryEntries fuer Feature-Hooks.',
    );
  }
  return value;
}
