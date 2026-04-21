/**
 * Public API des reporting-Feature-Moduls.
 *
 * Extrahiert in C2.10 als zehntes und kleinstes Handler-Feature-Slice.
 *
 * Umfang: **nur Handler.** Dieses Feature enthaelt:
 *   - useReportingHandlers mit vier Export-Handlern
 *     (Management-Report Markdown/PDF, Formaler Audit-Bericht HTML,
 *      Audit-Pack PDF)
 *
 * --------------------------------------------------------------------------
 * Bewusste Ausnahme bis C4b: ReportView bleibt in src/views/
 * --------------------------------------------------------------------------
 * ReportView (614 Zeilen) ist eine **Querschnitts-View**, die aus fast
 * allen extrahierten Features liest: regulatoryProfile,
 * certificationState, scoreSnapshot, benchmark, stakeholders, sites,
 * actionItems, evidenceSummary, findings, kritisMilestones,
 * gapAnalysisSummary, exportPackages und mehr.
 *
 * 18 von 22 Read-Props kommen aus `useAppDerivedState`; das macht
 * ReportView strukturell zum **Konsumenten** der Feature-Slices, nicht
 * zu einem neuen Feature-Slice mit eigener Fach-Domain. Ein
 * 1:1-Umzug der View waere jetzt rein mechanisch moeglich, aber
 * fachlich vorgreifend: C4b wird entscheiden, ob ReportView in
 * mehrere Panels aufgeteilt wird (z. B. Export-Panel, Status-Panel,
 * Stakeholder-Panel, Finding-Panel) oder als Ganzes in einen
 * reporting/views/-Ordner wandert.
 *
 * Die Exporter-Logik (`src/lib/exporters.ts`, 866 Zeilen) bleibt in
 * `lib/`, weil sie sowohl von App.tsx als auch von
 * `buildActiveViewPanelProps.ts` konsumiert wird. Gleiches Muster wie
 * `lib/regulatory.ts` in C2.9.
 * --------------------------------------------------------------------------
 *
 * Von aussen zu konsumieren:
 *  - useReportingHandlers + ReportingHandlerDependencies +
 *    ReportingHandlers (von App.tsx)
 */

export {
  useReportingHandlers,
  type ReportingHandlers,
} from './hooks/useReportingHandlers';
