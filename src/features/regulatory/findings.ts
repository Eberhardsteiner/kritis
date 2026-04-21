import type { AuditFindingItem } from '../../types';

/**
 * Entfernt `deletedEvidenceId` aus `finding.relatedEvidenceIds` aller
 * uebergebenen Findings. Das Finding selbst bleibt erhalten — nur die
 * Evidenz-Referenz wird bereinigt.
 *
 * === Fachliche Heimat: regulatory ==========================================
 * `auditFindings` sind Pruefungs-Findings im KRITIS-Cockpit. Sie gehoeren
 * fachlich ins regulatory-Feature (KritisView rendert die FindingCards,
 * handleCreate/Update/Delete/GenerateFindings sind in useRegulatoryHandlers).
 *
 * === Warum diese Helfer cross-feature konsumiert wird ======================
 * Beim Loeschen einer Evidenz via `handleDeleteEvidence` (useEvidenceHandlers
 * aus C2.4) muessen in derselben React-Transaktion ALLE Referenzen aus
 * `relatedEvidenceIds` entfernt werden — sonst zeigen Findings auf ein
 * nicht mehr existierendes Evidence-Item. Die Delete-Kaskade MUSS atomar
 * in einem einzigen setState-Funktional-Update laufen; ein nachgelagerter
 * zweiter setState-Aufruf waere ein Auge-Blick-Inkonsistent-State.
 *
 * Variante A aus der C2.9-Analyse: die Logik (Pure) wandert nach
 * regulatory, der setState-Aufruf bleibt ein einziger Call im
 * evidence-Hook. Das macht die Feature-Zuordnung fachlich korrekt
 * (Finding-Struktur kennt nur regulatory) ohne die Atomaritaet zu
 * opfern.
 *
 * === Gegenrichtung: handleDeleteFinding (regulatory) =======================
 * Das Loeschen eines Findings hat KEINEN Cross-Feature-Side-Effect —
 * Evidence-Items referenzieren keine Findings zurueck. Daher bleibt
 * handleDeleteFinding ein schlanker filter() auf state.auditFindings.
 */
export function clearEvidenceRefsFromFindings(
  findings: AuditFindingItem[],
  deletedEvidenceId: string,
): AuditFindingItem[] {
  return findings.map((finding) => ({
    ...finding,
    relatedEvidenceIds: finding.relatedEvidenceIds.filter(
      (id) => id !== deletedEvidenceId,
    ),
  }));
}
