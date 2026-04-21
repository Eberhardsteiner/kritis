import type { ComplianceCalendar } from '../../types';

/**
 * Compliance-Kalender-Normalizer (KRITIS-Basisdaten, § 20
 * Registrierung + BSIG/NIS2-Fristen).
 *
 * Zusammen mit `findings.ts` und `certification.ts` bildet dieser
 * File einen der drei getrennten Regulatory-Pure-Helper-Module (siehe
 * Design-Note im Kopf von `findings.ts`).
 *
 * Seit C2.11b: aus App.tsx in die regulatory-Feature-Heimat gezogen.
 * Passt logisch zur C2.9-Option-B-Entscheidung: `updateComplianceCalendar`
 * lebt als Handler in useRegulatoryHandlers, das Rendering bleibt in
 * ControlView (platform-Slice) — hier ist jetzt die Normalisierung.
 *
 * Einziger Konsument: `buildAppStateFromLoaded` aus
 * `src/app/state/buildAppState.ts`.
 */
export function normalizeComplianceCalendar(
  input?: Partial<ComplianceCalendar>,
): ComplianceCalendar {
  return {
    registrationDate: input?.registrationDate ?? '',
    lastRiskAssessmentDate: input?.lastRiskAssessmentDate ?? '',
    lastResiliencePlanUpdate: input?.lastResiliencePlanUpdate ?? '',
    lastBsiEvidenceAuditDate: input?.lastBsiEvidenceAuditDate ?? '',
    incidentContact: input?.incidentContact ?? '',
    incidentBackupContact: input?.incidentBackupContact ?? '',
    bsigRegistrationDate: input?.bsigRegistrationDate ?? '',
    lastCyberRiskAssessmentDate: input?.lastCyberRiskAssessmentDate ?? '',
    lastIncidentExerciseDate: input?.lastIncidentExerciseDate ?? '',
  };
}
