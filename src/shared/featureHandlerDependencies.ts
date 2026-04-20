import type { Dispatch, SetStateAction } from 'react';
import type { AppState, PermissionKey } from '../types';

/**
 * Tone-Varianten fuer die globale Notice-/Toast-Pipeline. Siehe
 * ImportFeedback in src/App.tsx und NoticeContent in
 * src/components/AppNotice.tsx -- dieser Typ wird von allen
 * Feature-Hooks gemeinsam referenziert.
 */
export type NoticeTone = 'success' | 'error' | 'info';

/**
 * Gemeinsame Schnittmenge aller Feature-Handler-Hook-Vertraege.
 *
 * Nach drei konkreten Iterationen (Actions C2.2, Governance C2.3,
 * Evidence C2.4) waren diese vier Felder in jedem Hook gleich benoetigt:
 *
 *  - `state`/`setState`: Zugriff auf die zentrale AppState-Quelle
 *    (solange kein Context eingefuehrt ist, siehe BLOCK-C.md Abschnitt
 *    State-Management).
 *  - `runWithPermission`: Permission-Gate, das bei fehlendem Recht
 *    automatisch eine Fehler-Notice aussendet und die Action abbricht.
 *  - `showNotice`: direkte Notice-Pipeline fuer feature-spezifische
 *    Meldungen (z. B. Upload-Erfolg, Server-Fehler). Die `info`-Tone-
 *    Variante ist seit Phase 2 von C2.3 verfuegbar.
 *
 * Feature-spezifische Ergaenzungen (z. B. currentModule, Lookups,
 * Server-Sync-Refs) werden per `extends` im Feature-Hook-Ordner
 * angehaengt.
 */
export interface FeatureHandlerDependencies {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  runWithPermission: (
    permission: PermissionKey,
    message: string,
    action: () => void,
  ) => boolean;
  showNotice: (tone: NoticeTone, message: string, details?: string[]) => void;
}
