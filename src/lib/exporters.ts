import type {
  ActionItem,
  AnswerEntry,
  CertificationProgress,
  CertificationState,
  CompanyProfile,
  EvidenceItem,
  EvidenceSummary,
  KritisApplicability,
  RequirementDefinition,
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

function escapeCsv(value: string | number): string {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9äöüß]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

export function exportAssessmentAsJson(params: {
  companyProfile: CompanyProfile;
  module?: SectorModuleDefinition;
  scoreSnapshot: ScoreSnapshot;
  answers: Record<string, AnswerEntry>;
  requirementStates: Record<string, RequirementStatus>;
  actionItems: ActionItem[];
  evidenceItems: EvidenceItem[];
  certificationState: CertificationState;
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

export function exportActionPlanAsCsv(actions: ActionItem[]): void {
  const rows = [
    ['Titel', 'Beschreibung', 'Priorität', 'Status', 'Verantwortlich', 'Fällig', 'Quelle', 'Notizen'],
    ...actions.map((action) => [
      action.title,
      action.description,
      action.priority,
      action.status,
      action.owner,
      action.dueDate,
      action.sourceLabel,
      action.notes,
    ]),
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  downloadBlob(
    `massnahmenplan-${new Date().toISOString().slice(0, 10)}.csv`,
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  );
}

export function exportEvidenceRegisterAsCsv(evidenceItems: EvidenceItem[]): void {
  const rows = [
    ['Titel', 'Typ', 'Status', 'Verantwortlich', 'Review-Datum', 'Referenz', 'Quelle', 'Notizen'],
    ...evidenceItems.map((item) => [
      item.title,
      item.type,
      item.status,
      item.owner,
      item.reviewDate,
      item.link,
      item.sourceLabel,
      item.notes,
    ]),
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  downloadBlob(
    `nachweisregister-${new Date().toISOString().slice(0, 10)}.csv`,
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  );
}

export function exportManagementReportAsMarkdown(params: {
  companyProfile: CompanyProfile;
  module?: SectorModuleDefinition;
  scoreSnapshot: ScoreSnapshot;
  applicability: KritisApplicability;
  requirementProgress: { score: number; openCount: number; readyCount: number };
  requirements: RequirementDefinition[];
  requirementStates: Record<string, RequirementStatus>;
  actionItems: ActionItem[];
  evidenceSummary: EvidenceSummary;
  certificationState: CertificationState;
  certificationProgress: CertificationProgress;
}): void {
  const {
    companyProfile,
    module,
    scoreSnapshot,
    applicability,
    requirementProgress,
    requirements,
    requirementStates,
    actionItems,
    evidenceSummary,
    certificationState,
    certificationProgress,
  } = params;

  const companyLabel = companyProfile.companyName.trim() || 'Unternehmen';
  const overdueActions = actionItems.filter((item) => {
    return item.dueDate && item.status !== 'done' && new Date(item.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);
  });

  const topActions = [...actionItems]
    .sort((a, b) => {
      const priorityRank = { kritisch: 0, hoch: 1, mittel: 2, niedrig: 3 };
      return priorityRank[a.priority] - priorityRank[b.priority];
    })
    .slice(0, 8);

  const openRequirements = requirements.filter((requirement) => {
    const status = requirementStates[requirement.id] ?? 'open';
    return status !== 'ready' && status !== 'not_applicable';
  });

  const stageLines = Object.entries(certificationState.stageStates)
    .map(([stageId, stageState]) => `- ${stageId}: ${stageState.status}${stageState.notes ? ` - ${stageState.notes}` : ''}`)
    .join('\n');

  const markdown = `# Management Report: ${companyLabel}

## Profil
- Unternehmen: ${companyLabel}
- Branche: ${companyProfile.industryLabel || '-'}
- Modul: ${module?.name ?? 'Basisprofil'}
- Mitarbeitende: ${companyProfile.employees || '-'}
- Standorte: ${companyProfile.locations || '-'}
- Kritische Dienstleistung: ${companyProfile.criticalService || '-'}

## Resilienz-Status
- Gesamtwert: ${scoreSnapshot.overallScore}%
- Reifegrad: ${scoreSnapshot.maturityLabel}
- Bearbeitungsgrad: ${scoreSnapshot.completion}%
- KRITIS-Einordnung: ${applicability.title}
- KRITIS-Readiness: ${requirementProgress.score}%
- Interne Zertifizierungsreife: ${certificationProgress.score}%

## Domänenwerte
${scoreSnapshot.domainScores.map((domain) => `- ${domain.label}: ${domain.score}% (${domain.answeredCount}/${domain.totalCount} beantwortet)`).join('\n')}

## Priorisierte Empfehlungen
${scoreSnapshot.recommendations.map((recommendation) => `- ${recommendation.title} (${recommendation.domainLabel}, ${recommendation.urgency}): ${recommendation.action}`).join('\n')}

## Maßnahmenplan
- Gesamtmaßnahmen: ${actionItems.length}
- Überfällige Maßnahmen: ${overdueActions.length}

${topActions.length
    ? topActions.map((action) => `- [${action.status}] ${action.title} | Priorität: ${action.priority} | Fällig: ${action.dueDate || '-'} | Verantwortlich: ${action.owner || '-'}`).join('\n')
    : '- Noch keine Maßnahmen angelegt.'}

## Nachweisregister
- Nachweisabdeckung: ${evidenceSummary.coverage}%
- Freigegeben: ${evidenceSummary.approved}
- In Review: ${evidenceSummary.review}
- Entwurf: ${evidenceSummary.draft}
- Fehlend: ${evidenceSummary.missing}

## KRITIS-Anforderungen offen
${openRequirements.length
    ? openRequirements.map((requirement) => `- ${requirement.title} (${requirement.lawRef ?? 'ohne Referenz'})`).join('\n')
    : '- Keine offenen KRITIS-Anforderungen.'}

## Zertifizierungsworkflow
- Audit Lead: ${certificationState.auditLead || '-'}
- Zieltermin: ${certificationState.targetDate || '-'}
- Abgeschlossene Stufen: ${certificationProgress.readyStages}

${stageLines || '- Keine Status gepflegt.'}

## Management-Entscheid
${certificationState.decisionNote || 'Noch kein Beschluss dokumentiert.'}
`;

  downloadBlob(
    `management-report-${slugify(companyLabel) || 'unternehmen'}-${new Date().toISOString().slice(0, 10)}.md`,
    new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
  );
}
