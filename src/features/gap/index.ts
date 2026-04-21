/**
 * Public API des Gap-Feature-Moduls (B6 · Restaufwand-Heuristik + DOCX-Export).
 *
 * Von aussen sollen ausschliesslich diese Exporte konsumiert werden. Die
 * internen Pfade (`./gapAnalysis`, `./components/*`, `./export/*`,
 * `./hooks/*`) sind Implementierungsdetails und duerfen sich ohne
 * Rueckwirkung auf Konsumenten aendern.
 *
 * Seit C2.11a: useGapHandlers als Hook-Schicht fuer den
 * DOCX-Export. gap ist wie reporting (C2.10) ein **read-only-Feature**
 * (kein setState-/runWithPermission-Bedarf im Hook, Gate laeuft ueber
 * hasPermission).
 */

export { computeGapAnalysis, getConfidenceLabel } from './gapAnalysis';
export { GapAnalysisDashboard } from './components/GapAnalysisDashboard';
export {
  buildGapAnalysisBlob,
  buildGapAnalysisDocument,
  buildGapAnalysisFileName,
} from './export/gapAnalysisDocx';
export type { GapAnalysisDocxInput } from './export/gapAnalysisDocx';

export {
  useGapHandlers,
  type GapHandlerDependencies,
  type GapHandlers,
} from './hooks/useGapHandlers';
