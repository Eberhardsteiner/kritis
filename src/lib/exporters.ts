import type {
  AnswerEntry,
  CompanyProfile,
  RequirementStatus,
  ScoreSnapshot,
  SectorModuleDefinition,
} from '../types';

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportAssessmentAsJson(params: {
  companyProfile: CompanyProfile;
  module?: SectorModuleDefinition;
  scoreSnapshot: ScoreSnapshot;
  answers: Record<string, AnswerEntry>;
  requirementStates: Record<string, RequirementStatus>;
}): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    ...params,
  };

  downloadBlob(
    `krisenfest-assessment-${new Date().toISOString().slice(0, 10)}.json`,
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
  );
}
