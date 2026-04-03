import type {
  ActionItem,
  AuditFindingItem,
  AuditFindingSummary,
  BenchmarkSnapshot,
  CertificationProgress,
  CertificationState,
  ChecklistProgress,
  CompanyProfile,
  EvidenceItem,
  EvidenceSummary,
  GovernanceSummary,
  KritisApplicability,
  RequirementDefinition,
  RequirementStatus,
  ReviewPlan,
  ScoreSnapshot,
  SectorModuleDefinition,
  SiteItem,
  StakeholderItem,
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

export function exportAssessmentAsJson(payload: unknown): void {
  downloadBlob(
    `krisenfest-assessment-${new Date().toISOString().slice(0, 10)}.json`,
    new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...((payload ?? {}) as object) }, null, 2)], {
      type: 'application/json;charset=utf-8',
    }),
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
    ['Titel', 'Typ', 'Status', 'Version', 'Klasse', 'Owner', 'Reviewer', 'Review-Datum', 'Referenz', 'Anhang', 'Quelle', 'Notizen'],
    ...evidenceItems.map((item) => [
      item.title,
      item.type,
      item.status,
      item.version,
      item.classification,
      item.owner,
      item.reviewer,
      item.reviewDate,
      item.link,
      item.attachment?.fileName ?? '',
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

export function exportStakeholderRegisterAsCsv(stakeholders: StakeholderItem[]): void {
  const rows = [
    ['Name', 'Rolle', 'Bereich', 'E-Mail', 'Freigabebereich', 'Primär', 'Verantwortung', 'Notizen'],
    ...stakeholders.map((item) => [
      item.name,
      item.roleLabel,
      item.department,
      item.email,
      item.approvalScope,
      item.isPrimary ? 'Ja' : 'Nein',
      item.responsibilities,
      item.notes,
    ]),
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  downloadBlob(
    `stakeholder-register-${new Date().toISOString().slice(0, 10)}.csv`,
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  );
}

export function exportStructureRegisterAsCsv(
  sites: SiteItem[],
  findings: AuditFindingItem[],
): void {
  const rows = [
    ['Typ', 'Name', 'Ort/Bereich', 'Kritikalität', 'Service/Fokus', 'Fallback / Status', 'Notizen'],
    ...sites.map((site) => [
      'Standort',
      site.name,
      site.location,
      site.criticality,
      site.primaryService,
      site.fallbackSite,
      site.notes,
    ]),
    ...findings.map((finding) => [
      'Feststellung',
      finding.title,
      finding.area,
      finding.severity,
      finding.owner,
      finding.status,
      finding.notes,
    ]),
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  downloadBlob(
    `struktur-und-feststellungen-${new Date().toISOString().slice(0, 10)}.csv`,
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  );
}

export function exportFindingRegisterAsCsv(findings: AuditFindingItem[]): void {
  const rows = [
    ['Titel', 'Bereich', 'Schweregrad', 'Status', 'Owner', 'Fällig', 'Anforderungen', 'Nachweise', 'Notizen'],
    ...findings.map((item) => [
      item.title,
      item.area,
      item.severity,
      item.status,
      item.owner,
      item.dueDate,
      item.relatedRequirementIds.join(' | '),
      item.relatedEvidenceIds.join(' | '),
      item.notes,
    ]),
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  downloadBlob(
    `audit-feststellungen-${new Date().toISOString().slice(0, 10)}.csv`,
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
  stakeholders: StakeholderItem[];
  sites: SiteItem[];
  reviewPlan: ReviewPlan;
  benchmark: BenchmarkSnapshot;
  governanceSummary: GovernanceSummary;
  checklistProgress: ChecklistProgress;
  findingSummary: AuditFindingSummary;
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
    stakeholders,
    sites,
    reviewPlan,
    benchmark,
    governanceSummary,
    checklistProgress,
    findingSummary,
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

## Resilienzstatus
- Gesamtwert: ${scoreSnapshot.overallScore}%
- Zielwert: ${benchmark.overallTarget}%
- Reifegrad: ${scoreSnapshot.maturityLabel}
- Bearbeitungsgrad: ${scoreSnapshot.completion}%
- Governance-Reife: ${governanceSummary.score}%
- KRITIS-Einordnung: ${applicability.title}
- KRITIS-Readiness: ${requirementProgress.score}%
- Audit-Checklist: ${checklistProgress.score}%
- Feststellungen offen: ${findingSummary.open}
- Interne Zertifizierungsreife: ${certificationProgress.score}%

## Domänenwerte
${scoreSnapshot.domainScores.map((domain) => `- ${domain.label}: ${domain.score}% (Ziel ${benchmark.domainTargets[domain.domainId] ?? '-'}%)`).join('\n')}

## Governance & Struktur
- Stakeholder gepflegt: ${stakeholders.length}
- Standorte gepflegt: ${sites.length}
- Sponsor: ${reviewPlan.executiveSponsor || '-'}
- Approver: ${reviewPlan.approver || '-'}
- Nächster Management-Review: ${reviewPlan.nextManagementReviewDate || '-'}

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

## Audit-Checklist
- Bewertete Prüfbausteine: ${checklistProgress.total}
- Evidenzfähig oder geschlossen: ${checklistProgress.evidenced}
- Blocker: ${checklistProgress.blockers}
- Kritische offene Feststellungen: ${findingSummary.critical}

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

export function exportFormalAuditReportAsHtml(params: {
  companyProfile: CompanyProfile;
  module?: SectorModuleDefinition;
  scoreSnapshot: ScoreSnapshot;
  applicability: KritisApplicability;
  benchmark: BenchmarkSnapshot;
  governanceSummary: GovernanceSummary;
  requirementProgress: { score: number; openCount: number; readyCount: number };
  checklistProgress: ChecklistProgress;
  findingSummary: AuditFindingSummary;
  evidenceSummary: EvidenceSummary;
  certificationProgress: CertificationProgress;
  stakeholders: StakeholderItem[];
  sites: SiteItem[];
  findings: AuditFindingItem[];
}): void {
  const {
    companyProfile,
    module,
    scoreSnapshot,
    applicability,
    benchmark,
    governanceSummary,
    requirementProgress,
    checklistProgress,
    findingSummary,
    evidenceSummary,
    certificationProgress,
    stakeholders,
    sites,
    findings,
  } = params;

  const companyLabel = companyProfile.companyName.trim() || 'Unternehmen';

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>Audit Report ${companyLabel}</title>
<style>
  body { font-family: Inter, Arial, sans-serif; margin: 32px; color: #162033; }
  h1, h2, h3 { margin: 0 0 12px; }
  h1 { font-size: 28px; }
  h2 { font-size: 18px; margin-top: 28px; }
  .muted { color: #5d6b82; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .card { border: 1px solid #dbe3ef; border-radius: 16px; padding: 16px; margin-top: 12px; }
  .metric { font-size: 28px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border-bottom: 1px solid #dbe3ef; padding: 10px 8px; text-align: left; vertical-align: top; }
  th { background: #f8fbff; }
  .tag { display: inline-block; border-radius: 999px; padding: 4px 8px; font-size: 12px; background: #eef5ff; color: #1d4ed8; }
  .row { display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; }
  @media print { body { margin: 18px; } }
</style>
</head>
<body>
  <p class="muted">Krisenfestigkeit Monitor · Formaler Auditreport</p>
  <h1>${companyLabel}</h1>
  <p class="muted">${module?.name ?? 'Basisprofil'} · ${companyProfile.industryLabel || 'Branche offen'}</p>

  <section class="grid">
    <div class="card"><div class="metric">${scoreSnapshot.overallScore}%</div><div class="muted">Resilienzstatus</div></div>
    <div class="card"><div class="metric">${benchmark.overallTarget}%</div><div class="muted">Zielwert</div></div>
    <div class="card"><div class="metric">${requirementProgress.score}%</div><div class="muted">KRITIS-Readiness</div></div>
    <div class="card"><div class="metric">${certificationProgress.score}%</div><div class="muted">Zertifizierungsreife</div></div>
  </section>

  <h2>Einordnung</h2>
  <div class="card">
    <div class="row"><strong>KRITIS-Einordnung</strong><span class="tag">${applicability.title}</span></div>
    <p class="muted">${applicability.text}</p>
    <div class="row"><span>Governance-Reife</span><strong>${governanceSummary.score}%</strong></div>
    <div class="row"><span>Audit-Checklist</span><strong>${checklistProgress.score}%</strong></div>
    <div class="row"><span>Offene Feststellungen</span><strong>${findingSummary.open}</strong></div>
    <div class="row"><span>Nachweisabdeckung</span><strong>${evidenceSummary.coverage}%</strong></div>
  </div>

  <h2>Domänen und Zielwerte</h2>
  <table>
    <thead>
      <tr><th>Domäne</th><th>Ist</th><th>Ziel</th><th>Gap</th></tr>
    </thead>
    <tbody>
      ${scoreSnapshot.domainScores.map((domain) => {
        const target = benchmark.domainTargets[domain.domainId] ?? 0;
        const gap = Math.round((target - domain.score) * 10) / 10;
        return `<tr><td>${domain.label}</td><td>${domain.score}%</td><td>${target}%</td><td>${gap}%</td></tr>`;
      }).join('')}
    </tbody>
  </table>

  <h2>Governance und Struktur</h2>
  <table>
    <thead>
      <tr><th>Stakeholder</th><th>Rolle</th><th>Freigabe</th></tr>
    </thead>
    <tbody>
      ${stakeholders.length ? stakeholders.map((item) => `<tr><td>${item.name}</td><td>${item.roleLabel}</td><td>${item.approvalScope || '-'}</td></tr>`).join('') : '<tr><td colspan="3">Keine Stakeholder gepflegt.</td></tr>'}
    </tbody>
  </table>

  <table>
    <thead>
      <tr><th>Standort</th><th>Ort</th><th>Kritikalität</th><th>Service</th></tr>
    </thead>
    <tbody>
      ${sites.length ? sites.map((item) => `<tr><td>${item.name}</td><td>${item.location}</td><td>${item.criticality}</td><td>${item.primaryService || '-'}</td></tr>`).join('') : '<tr><td colspan="4">Keine Standorte gepflegt.</td></tr>'}
    </tbody>
  </table>

  <h2>Auditfeststellungen</h2>
  <table>
    <thead>
      <tr><th>Titel</th><th>Bereich</th><th>Schweregrad</th><th>Status</th><th>Owner</th><th>Fällig</th></tr>
    </thead>
    <tbody>
      ${findings.length ? findings.map((item) => `<tr><td>${item.title}</td><td>${item.area}</td><td>${item.severity}</td><td>${item.status}</td><td>${item.owner || '-'}</td><td>${item.dueDate || '-'}</td></tr>`).join('') : '<tr><td colspan="6">Keine Feststellungen gepflegt.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;

  downloadBlob(
    `audit-report-${slugify(companyLabel) || 'unternehmen'}-${new Date().toISOString().slice(0, 10)}.html`,
    new Blob([html], { type: 'text/html;charset=utf-8' }),
  );
}
