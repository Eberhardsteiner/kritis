import type { CertificationState, CertificationStageState } from '../../types';
import { kritisCertificationStages } from '../../data/kritisBase';

/**
 * KRITIS-Readiness-Certification-Normalizer (§ 13 KRITISDachG).
 *
 * Zusammen mit `findings.ts` und `complianceCalendar.ts` bildet dieser
 * File einen der drei getrennten Regulatory-Pure-Helper-Module (siehe
 * Design-Note im Kopf von `findings.ts`).
 *
 * Seit C2.11b: aus App.tsx in die regulatory-Feature-Heimat gezogen.
 * Einziger Konsument: `buildAppStateFromLoaded` aus
 * `src/app/state/buildAppState.ts`.
 *
 * Die frueher hier mit-liegende Helferfunktion `createDefaultCertificationState`
 * wurde in C2.11b geloescht — sie war Dead Code (0 Referenzen im
 * Repository, Repository-wide grep verifiziert).
 * `normalizeCertificationState(undefined)` erzeugt denselben
 * Default-State.
 */
export function normalizeCertificationState(
  input?: Partial<CertificationState>,
): CertificationState {
  const stageStates = Object.fromEntries(
    kritisCertificationStages.map((stage) => {
      const current = input?.stageStates?.[stage.id];
      return [
        stage.id,
        {
          status: current?.status ?? 'not_started',
          notes: current?.notes ?? '',
        } satisfies CertificationStageState,
      ];
    }),
  ) as CertificationState['stageStates'];

  return {
    auditLead: input?.auditLead ?? '',
    targetDate: input?.targetDate ?? '',
    decisionNote: input?.decisionNote ?? '',
    stageStates,
  };
}
