/**
 * Public API des Gap-Feature-Moduls (B6 · Restaufwand-Heuristik + DOCX-Export).
 *
 * Von aussen sollen ausschliesslich diese Exporte konsumiert werden. Die
 * internen Pfade (`./gapAnalysis`, `./components/*`, `./export/*`) sind
 * Implementierungsdetails und duerfen sich ohne Rueckwirkung auf
 * Konsumenten aendern.
 */

export { computeGapAnalysis, getConfidenceLabel } from './gapAnalysis';
export { GapAnalysisDashboard } from './components/GapAnalysisDashboard';
export {
  buildGapAnalysisBlob,
  buildGapAnalysisDocument,
  buildGapAnalysisFileName,
} from './export/gapAnalysisDocx';
export type { GapAnalysisDocxInput } from './export/gapAnalysisDocx';
