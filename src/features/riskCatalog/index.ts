/**
 * Public API des riskCatalog-Feature-Moduls.
 *
 * Das Feature bestand bereits vor C2 (B3 · All-Gefahren-Ansatz nach
 * § 12 KRITISDachG) als strukturierter Ordner mit Taxonomie, Schema,
 * Analyse-Logik, Views und DOCX-Export. In C2.9 ist ein Handler-Hook
 * und diese Public-API-Schicht ergaenzt worden — damit hat riskCatalog
 * jetzt dieselbe Schnittstellen-Homogenitaet wie die spaeter extrahierten
 * Features (measures, governance, evidence, operations, assessment,
 * platform, programRollout, regulatory).
 *
 * Von aussen zu konsumieren:
 *  - useRiskCatalogHandlers + RiskCatalogHandlerDependencies +
 *    RiskCatalogHandlers (von App.tsx)
 *  - RiskMatrixView, RiskEntryForm, RiskRegisterView (von KritisView;
 *    bis C2.9 direkt per relativem Pfad aus features/riskCatalog/views/
 *    importiert — das kann schrittweise auf Public-API umgestellt werden,
 *    ist aber nicht Teil von C2.9).
 *  - buildRiskAnalysisBlob, buildRiskAnalysisFileName (wird weiterhin
 *    vom Export-Handler im Hook konsumiert).
 */

export {
  useRiskCatalogHandlers,
  type RiskCatalogHandlers,
} from './hooks/useRiskCatalogHandlers';
