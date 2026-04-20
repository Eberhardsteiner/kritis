/**
 * Public API des Evidence-Feature-Moduls (C2.4).
 *
 * Von aussen zu konsumieren:
 *  - EvidenceCard (auch von src/features/measures/views/MeasuresView
 *    importiert -- der einzige legitime Feature-zu-Feature-Import,
 *    durch diese Public-API-Grenze abgesichert)
 *  - useEvidenceHandlers + EvidenceHandlerDependencies + EvidenceHandlers
 *      (App.tsx erzeugt daraus die 13 Evidence-Handler)
 *  - normalizeLoadedEvidence, normalizeEvidenceClassification,
 *    normalizeAttachment, normalizeServerAttachment, guessEvidenceType
 *      (App.tsx ruft bei buildAppStateFromLoaded bzw. indirekt ueber
 *       Generate-Handler)
 *  - Draft-Factories (fuer kuenftige Unit-Tests / externe Aufrufer)
 *  - MAX_LOCAL_ATTACHMENT_BYTES / MAX_SERVER_ATTACHMENT_BYTES
 *      (UI-Hinweise / Upload-Input-Validierung)
 */

export { EvidenceCard } from './components/EvidenceCard';

export {
  useEvidenceHandlers,
  type EvidenceHandlerDependencies,
  type EvidenceHandlers,
} from './hooks/useEvidenceHandlers';

export {
  normalizeEvidenceClassification,
  normalizeAttachment,
  normalizeServerAttachment,
  normalizeLoadedEvidence,
  guessEvidenceType,
} from './normalizers';

export {
  createEvidenceDraft,
  createEvidenceFromQuestionDefinition,
  createEvidenceFromRequirementDefinition,
  type EvidenceDraftContext,
} from './drafts';

export {
  MAX_LOCAL_ATTACHMENT_BYTES,
  MAX_SERVER_ATTACHMENT_BYTES,
} from './constants';

export { readFileAsDataUrl } from './utils';
