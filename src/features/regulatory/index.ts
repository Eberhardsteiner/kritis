/**
 * Public API des regulatory-Feature-Moduls.
 *
 * Extrahiert in C2.9 als neuntes Feature-Slice. Umfasst die elf Handler
 * rund um das KRITIS-Cockpit (Regulatorik-Profil, Certification/Readiness,
 * Audit-Checklist & Findings, Compliance-Kalender) sowie einen Pure-
 * Helper fuer die Evidence-Delete-Kaskade, der cross-feature von
 * useEvidenceHandlers konsumiert wird.
 *
 * --------------------------------------------------------------------------
 * Bewusste Ausnahme bis C4b: regulatory hat (noch) keine Views im Ordner
 * --------------------------------------------------------------------------
 * KritisView (1.077 Zeilen) ist die groesste View der App und rendert
 * eine Vielzahl ge-shareder Komponenten:
 *   - AuthorityCard, CertificationStageCard, FindingCard,
 *     ManagementLiabilityCard, PenaltyExposureCard, StandardMappingsPanel
 *     (alle aus src/components/)
 *   - RiskMatrixView, RiskEntryForm, RiskRegisterView
 *     (aus features/riskCatalog/views/)
 *
 * Ein 1:1-Umzug der View nach features/regulatory/views/ wuerde diese
 * Abhaengigkeiten zwar nicht brechen (relative Pfade funktionieren),
 * aber fachlich vorwegnehmen, was **C4b** (Component-Tests + Panel-
 * Splits) sauber loest: KritisView in ~5 Panels zerlegen
 * (Scope-Header, Regime-Liste, Readiness-Cockpit, Audit-Checklist,
 * Findings) und die gemeinsamen Komponenten entlang der neuen
 * Panel-Schnitte neu gruppieren.
 *
 * Fuer C2.9 bleibt daher der pragmatische Schnitt: KritisView bleibt in
 * src/views/; regulatory/ enthaelt Hook + Pure-Helper + Public API.
 * Der Meta-Review-Eintrag in BLOCK-C.md (Abschnitt 9) haelt diesen
 * Zustand fest und prueft ihn vor Pilotfreigabe erneut.
 * --------------------------------------------------------------------------
 *
 * Von aussen zu konsumieren:
 *  - useRegulatoryHandlers + RegulatoryHandlerDependencies +
 *    RegulatoryHandlers (von App.tsx)
 *  - clearEvidenceRefsFromFindings (von useEvidenceHandlers fuer die
 *    atomare Evidence-Delete-Kaskade, siehe JSDoc dort)
 *  - normalizeLoadedFindings, normalizeCertificationState,
 *    normalizeComplianceCalendar (von der App-Shell-Hydration in
 *    src/app/state/buildAppState.ts, seit C2.11b)
 *
 * Note: Drei getrennte Pure-Helper-Files (findings.ts, certification.ts,
 * complianceCalendar.ts) statt einer gemeinsamen normalization.ts —
 * siehe Design-Note in findings.ts.
 */

export {
  useRegulatoryHandlers,
  type RegulatoryHandlers,
} from './hooks/useRegulatoryHandlers';

export {
  clearEvidenceRefsFromFindings,
  normalizeLoadedFindings,
} from './findings';

export { normalizeCertificationState } from './certification';

export { normalizeComplianceCalendar } from './complianceCalendar';
