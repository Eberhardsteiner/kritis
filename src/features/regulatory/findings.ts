import type { AuditFindingItem } from '../../types';
import { createId } from '../../shared/ids';

/**
 * Finding-bezogene Pure-Helper und Normalizer fuer das regulatory-
 * Feature.
 *
 * === Design-Note: drei Regulatory-Pure-Helper-Files ========================
 * Das regulatory-Feature weicht bewusst vom Normalizer-Muster der
 * anderen Features ab (measures, governance, evidence, operations,
 * programRollout nutzen jeweils eine gemeinsame `normalization.ts`).
 * Hier sind drei getrennte Dateien angelegt:
 *   - findings.ts               (Findings + Evidence-Cross-Helper)
 *   - certification.ts          (KRITIS-Readiness-Stages)
 *   - complianceCalendar.ts     (KRITIS-Basisdaten / BSIG-Fristen)
 *
 * Begruendung: regulatory ist eine **Domaene mit fachlich getrennten
 * Sub-Domaenen**, die je eigene Datenmodelle und Konsumenten haben:
 * Findings gehoeren zum Audit-Workflow, Certification zum Readiness-
 * Cockpit, Compliance-Kalender zur BSIG/NIS2-Stichtag-Steuerung. Eine
 * gemeinsame `normalization.ts` waere eine lose Sammlung ohne inneren
 * Zusammenhang und wuerde den Cross-Feature-Konsum
 * (clearEvidenceRefsFromFindings ist z. B. evidence-Kopplung, das darf
 * nicht mit KRITIS-Certification-Code kollidieren) unsauber machen.
 *
 * Das ist eine bewusste Ausnahme, keine Inkonsistenz — in der
 * Post-C2.11-Meta-Review ist dieser Gedanke in BLOCK-C.md
 * festzuhalten.
 * ===========================================================================
 */

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

/**
 * Normalisiert eine (moeglicherweise teilweise oder fehlerhafte)
 * Finding-Liste, die aus localStorage oder vom Server kommt. Fehlende
 * Felder bekommen sinnvolle Defaults; unbekannte Severity-/Status-Werte
 * werden NICHT gehaertet (das ist Aufgabe der Type-Guards) — wir
 * uebernehmen den Wert und vertrauen der TypeScript-Typdefinition.
 *
 * Seit C2.11b: aus App.tsx in die regulatory-Feature-Heimat gezogen.
 * Einziger Konsument: `buildAppStateFromLoaded` aus
 * `src/app/state/buildAppState.ts`.
 */
export function normalizeLoadedFindings(
  items: unknown,
  fallbackModuleId: string,
): AuditFindingItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<AuditFindingItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('fnd'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      area: item.area ?? '',
      severity: item.severity ?? 'medium',
      status: item.status ?? 'open',
      owner: item.owner ?? '',
      dueDate: item.dueDate ?? '',
      relatedRequirementIds: item.relatedRequirementIds ?? [],
      relatedEvidenceIds: item.relatedEvidenceIds ?? [],
      notes: item.notes ?? '',
      createdAt: item.createdAt ?? new Date().toISOString(),
    }));
}
