import { jsPDF } from 'jspdf';
import type {
  ActionItem,
  AuditFindingItem,
  AuditFindingSummary,
  BenchmarkSnapshot,
  CertificationProgress,
  CertificationState,
  ChecklistProgress,
  CompanyProfile,
  ComplianceCalendar,
  DeadlineSummary,
  DocumentLibrarySummary,
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

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function htmlEscape(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createPdfDocument(title: string) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 16;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  function ensureSpace(required = 10): void {
    if (y + required <= pageHeight - margin) {
      return;
    }
    pdf.addPage();
    y = margin;
  }

  function addTitle(text: string, subtitle?: string): void {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text(text, margin, y);
    y += 8;

    if (subtitle) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const lines = pdf.splitTextToSize(subtitle, contentWidth);
      pdf.text(lines, margin, y);
      y += lines.length * 5 + 2;
    }
  }

  function addSection(titleText: string): void {
    ensureSpace(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text(titleText, margin, y);
    y += 7;
  }

  function addParagraph(text: string): void {
    const normalized = text.trim();
    if (!normalized) {
      return;
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    const lines = pdf.splitTextToSize(normalized, contentWidth);
    ensureSpace(lines.length * 5 + 4);
    pdf.text(lines, margin, y);
    y += lines.length * 5 + 2;
  }

  function addBullets(items: string[]): void {
    const filtered = items.filter(Boolean);
    if (!filtered.length) {
      addParagraph('Keine Einträge vorhanden.');
      return;
    }

    filtered.forEach((item) => {
      const lines = pdf.splitTextToSize(`• ${item}`, contentWidth);
      ensureSpace(lines.length * 5 + 2);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(lines, margin, y);
      y += lines.length * 5;
    });

    y += 1;
  }

  function addMiniTable(rows: Array<[string, string | number]>): void {
    rows.forEach(([label, value]) => {
      const leftWidth = 58;
      const rightLines = pdf.splitTextToSize(String(value ?? '-'), contentWidth - leftWidth);
      ensureSpace(Math.max(6, rightLines.length * 5 + 1));
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text(String(label), margin, y);
      pdf.setFont('helvetica', 'normal');
      pdf.text(rightLines, margin + leftWidth, y);
      y += Math.max(5, rightLines.length * 5) + 1;
    });
    y += 2;
  }

  function addMetricGrid(metrics: Array<{ label: string; value: string | number }>): void {
    const cardWidth = (contentWidth - 6) / 2;
    let col = 0;
    let rowY = y;

    metrics.forEach((metric, index) => {
      if (col === 0) {
        ensureSpace(20);
        rowY = y;
      }

      const x = margin + (cardWidth + 6) * col;
      pdf.setDrawColor(221, 229, 240);
      pdf.roundedRect(x, rowY, cardWidth, 16, 3, 3);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text(String(metric.value), x + 4, rowY + 7);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(metric.label, x + 4, rowY + 13);

      col += 1;
      if (col === 2 || index === metrics.length - 1) {
        col = 0;
        y = rowY + 20;
      }
    });
  }

  pdf.setProperties({ title });
  return { pdf, addTitle, addSection, addParagraph, addBullets, addMiniTable, addMetricGrid, save: (filename: string) => pdf.save(filename) };
}

export function exportAssessmentAsJson(payload: unknown): void {
  downloadBlob(
    `krisenfest-assessment-${todayStamp()}.json`,
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
    `massnahmenplan-${todayStamp()}.csv`,
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  );
}

export function exportEvidenceRegisterAsCsv(evidenceItems: EvidenceItem[]): void {
  const rows = [
    [
      'Titel',
      'Ordner',
      'Typ',
      'Status',
      'Version',
      'Klasse',
      'Owner',
      'Reviewer',
      'Review-Datum',
      'Gültig bis',
      'Review-Zyklus',
      'Externe ID',
      'Referenz',
      'Tags',
      'Anhang',
      'Quelle',
      'Notizen',
    ],
    ...evidenceItems.map((item) => [
      item.title,
      item.folder,
      item.type,
      item.status,
      item.version,
      item.classification,
      item.owner,
      item.reviewer,
      item.reviewDate,
      item.validUntil,
      item.reviewCycleDays,
      item.externalId,
      item.link,
      item.tags.join(' | '),
      item.attachment?.fileName ?? '',
      item.sourceLabel,
      item.notes,
    ]),
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  downloadBlob(
    `nachweisregister-${todayStamp()}.csv`,
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
    `stakeholder-register-${todayStamp()}.csv`,
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
    `struktur-und-feststellungen-${todayStamp()}.csv`,
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
    `audit-feststellungen-${todayStamp()}.csv`,
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
  documentLibrarySummary?: DocumentLibrarySummary;
  deadlineSummary?: DeadlineSummary;
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
    documentLibrarySummary,
    deadlineSummary,
  } = params;

  const companyLabel = companyProfile.companyName.trim() || 'Unternehmen';
  const overdueActions = actionItems.filter((item) => item.dueDate && item.status !== 'done'
    && new Date(item.dueDate).getTime() < new Date().setHours(0, 0, 0, 0));

  const priorityRank = { kritisch: 0, hoch: 1, mittel: 2, niedrig: 3 };
  const topActions = [...actionItems]
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
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
${documentLibrarySummary ? `- Dokumentenregister: ${documentLibrarySummary.total} Einträge, ${documentLibrarySummary.expired} abgelaufen, ${documentLibrarySummary.missingFolder} ohne Ordner` : ''}
${deadlineSummary ? `- Fristen-Cockpit: ${deadlineSummary.overdue} überfällig, ${deadlineSummary.dueSoon} in den nächsten 30 Tagen` : ''}

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
    `management-report-${slugify(companyLabel) || 'unternehmen'}-${todayStamp()}.md`,
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
  documentLibrarySummary?: DocumentLibrarySummary;
  deadlineSummary?: DeadlineSummary;
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
    documentLibrarySummary,
    deadlineSummary,
  } = params;

  const companyLabel = companyProfile.companyName.trim() || 'Unternehmen';

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>Audit Report ${htmlEscape(companyLabel)}</title>
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
  <h1>${htmlEscape(companyLabel)}</h1>
  <p class="muted">${htmlEscape(module?.name ?? 'Basisprofil')} · ${htmlEscape(companyProfile.industryLabel || 'Branche offen')}</p>

  <section class="grid">
    <div class="card"><div class="metric">${scoreSnapshot.overallScore}%</div><div class="muted">Resilienzstatus</div></div>
    <div class="card"><div class="metric">${benchmark.overallTarget}%</div><div class="muted">Zielwert</div></div>
    <div class="card"><div class="metric">${requirementProgress.score}%</div><div class="muted">KRITIS-Readiness</div></div>
    <div class="card"><div class="metric">${certificationProgress.score}%</div><div class="muted">Zertifizierungsreife</div></div>
  </section>

  <h2>Einordnung</h2>
  <div class="card">
    <div class="row"><strong>KRITIS-Einordnung</strong><span class="tag">${htmlEscape(applicability.title)}</span></div>
    <p class="muted">${htmlEscape(applicability.text)}</p>
    <div class="row"><span>Governance-Reife</span><strong>${governanceSummary.score}%</strong></div>
    <div class="row"><span>Audit-Checklist</span><strong>${checklistProgress.score}%</strong></div>
    <div class="row"><span>Offene Feststellungen</span><strong>${findingSummary.open}</strong></div>
    <div class="row"><span>Nachweisabdeckung</span><strong>${evidenceSummary.coverage}%</strong></div>
    ${documentLibrarySummary ? `<div class="row"><span>Dokumentenregister</span><strong>${documentLibrarySummary.total} Einträge</strong></div>` : ''}
    ${deadlineSummary ? `<div class="row"><span>Überfällige Fristen</span><strong>${deadlineSummary.overdue}</strong></div>` : ''}
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
        return `<tr><td>${htmlEscape(domain.label)}</td><td>${domain.score}%</td><td>${target}%</td><td>${gap}%</td></tr>`;
      }).join('')}
    </tbody>
  </table>

  <h2>Governance und Struktur</h2>
  <table>
    <thead>
      <tr><th>Stakeholder</th><th>Rolle</th><th>Freigabe</th></tr>
    </thead>
    <tbody>
      ${stakeholders.length ? stakeholders.map((item) => `<tr><td>${htmlEscape(item.name)}</td><td>${htmlEscape(item.roleLabel)}</td><td>${htmlEscape(item.approvalScope || '-')}</td></tr>`).join('') : '<tr><td colspan="3">Keine Stakeholder gepflegt.</td></tr>'}
    </tbody>
  </table>

  <table>
    <thead>
      <tr><th>Standort</th><th>Ort</th><th>Kritikalität</th><th>Service</th></tr>
    </thead>
    <tbody>
      ${sites.length ? sites.map((item) => `<tr><td>${htmlEscape(item.name)}</td><td>${htmlEscape(item.location)}</td><td>${htmlEscape(item.criticality)}</td><td>${htmlEscape(item.primaryService || '-')}</td></tr>`).join('') : '<tr><td colspan="4">Keine Standorte gepflegt.</td></tr>'}
    </tbody>
  </table>

  <h2>Auditfeststellungen</h2>
  <table>
    <thead>
      <tr><th>Titel</th><th>Bereich</th><th>Schweregrad</th><th>Status</th><th>Owner</th><th>Fällig</th></tr>
    </thead>
    <tbody>
      ${findings.length ? findings.map((item) => `<tr><td>${htmlEscape(item.title)}</td><td>${htmlEscape(item.area)}</td><td>${htmlEscape(item.severity)}</td><td>${htmlEscape(item.status)}</td><td>${htmlEscape(item.owner || '-')}</td><td>${htmlEscape(item.dueDate || '-')}</td></tr>`).join('') : '<tr><td colspan="6">Keine Feststellungen gepflegt.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;

  downloadBlob(
    `audit-report-${slugify(companyLabel) || 'unternehmen'}-${todayStamp()}.html`,
    new Blob([html], { type: 'text/html;charset=utf-8' }),
  );
}

export function exportManagementReportAsPdf(params: {
  companyProfile: CompanyProfile;
  module?: SectorModuleDefinition;
  scoreSnapshot: ScoreSnapshot;
  benchmark: BenchmarkSnapshot;
  applicability: KritisApplicability;
  requirementProgress: { score: number; openCount: number; readyCount: number };
  evidenceSummary: EvidenceSummary;
  governanceSummary: GovernanceSummary;
  certificationProgress: CertificationProgress;
  actionItems: ActionItem[];
  documentLibrarySummary: DocumentLibrarySummary;
  deadlineSummary: DeadlineSummary;
}): void {
  const {
    companyProfile,
    module,
    scoreSnapshot,
    benchmark,
    applicability,
    requirementProgress,
    evidenceSummary,
    governanceSummary,
    certificationProgress,
    actionItems,
    documentLibrarySummary,
    deadlineSummary,
  } = params;

  const companyLabel = companyProfile.companyName.trim() || 'Unternehmen';
  const dueActions = [...actionItems]
    .filter((item) => item.status !== 'done')
    .sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31'))
    .slice(0, 8);

  const doc = createPdfDocument(`Management Report ${companyLabel}`);
  doc.addTitle(companyLabel, `${module?.name ?? 'Basisprofil'} · ${companyProfile.industryLabel || 'Branche offen'}`);
  doc.addMetricGrid([
    { label: 'Resilienz', value: `${scoreSnapshot.overallScore}%` },
    { label: 'Zielwert', value: `${benchmark.overallTarget}%` },
    { label: 'KRITIS-Readiness', value: `${requirementProgress.score}%` },
    { label: 'Zertifizierungsreife', value: `${certificationProgress.score}%` },
  ]);

  doc.addSection('Einordnung');
  doc.addMiniTable([
    ['Bewertung', applicability.title],
    ['Governance-Reife', `${governanceSummary.score}%`],
    ['Nachweisabdeckung', `${evidenceSummary.coverage}%`],
    ['Dokumentenregister', `${documentLibrarySummary.total} Einträge`],
    ['Überfällige Fristen', deadlineSummary.overdue],
    ['Fristen in 30 Tagen', deadlineSummary.dueSoon],
  ]);
  doc.addParagraph(applicability.text);

  doc.addSection('Schwächste Domänen');
  doc.addBullets(
    [...scoreSnapshot.domainScores]
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .map((domain) => {
        const target = benchmark.domainTargets[domain.domainId] ?? 0;
        return `${domain.label}: ${domain.score}% bei Ziel ${target}%`;
      }),
  );

  doc.addSection('Nächste Maßnahmen');
  doc.addBullets(
    dueActions.length
      ? dueActions.map((item) => `${item.title} · ${item.priority} · ${item.owner || 'Verantwortung offen'} · ${item.dueDate || 'ohne Termin'}`)
      : ['Keine offenen Maßnahmen gepflegt.'],
  );

  doc.addSection('Dokumentenbibliothek');
  doc.addMiniTable([
    ['Anhänge lokal hinterlegt', documentLibrarySummary.attachedFiles],
    ['Reviews fällig', documentLibrarySummary.dueReviews],
    ['Abgelaufen', documentLibrarySummary.expired],
    ['Läuft bald ab', documentLibrarySummary.expiringSoon],
    ['Ohne Ordner', documentLibrarySummary.missingFolder],
  ]);
  doc.addBullets(
    documentLibrarySummary.byFolder.slice(0, 8).map((item) => `${item.folder}: ${item.count} Dokumente`),
  );

  doc.addSection('Fristen-Cockpit');
  doc.addBullets(
    deadlineSummary.nextItems.length
      ? deadlineSummary.nextItems.slice(0, 8).map((item) => `${item.title} · ${item.dueDate || 'offen'} · ${item.status} · ${item.owner}`)
      : ['Keine Fristen gepflegt.'],
  );

  doc.save(`management-report-${slugify(companyLabel) || 'unternehmen'}-${todayStamp()}.pdf`);
}

export function exportAuditPackAsPdf(params: {
  companyProfile: CompanyProfile;
  module?: SectorModuleDefinition;
  reviewPlan: ReviewPlan;
  complianceCalendar: ComplianceCalendar;
  requirements: RequirementDefinition[];
  requirementStates: Record<string, RequirementStatus>;
  checklistProgress: ChecklistProgress;
  findingSummary: AuditFindingSummary;
  findings: AuditFindingItem[];
  evidenceItems: EvidenceItem[];
  deadlineSummary: DeadlineSummary;
}): void {
  const {
    companyProfile,
    module,
    reviewPlan,
    complianceCalendar,
    requirements,
    requirementStates,
    checklistProgress,
    findingSummary,
    findings,
    evidenceItems,
    deadlineSummary,
  } = params;

  const companyLabel = companyProfile.companyName.trim() || 'Unternehmen';
  const openRequirements = requirements.filter((requirement) => {
    const status = requirementStates[requirement.id] ?? 'open';
    return status !== 'ready' && status !== 'not_applicable';
  });

  const dueEvidence = [...evidenceItems]
    .filter((item) => item.reviewDate || item.validUntil)
    .sort((a, b) => `${a.reviewDate || a.validUntil || '9999-12-31'}`.localeCompare(`${b.reviewDate || b.validUntil || '9999-12-31'}`))
    .slice(0, 8);

  const doc = createPdfDocument(`Audit Pack ${companyLabel}`);
  doc.addTitle(`${companyLabel} · Audit Pack`, `${module?.name ?? 'Basisprofil'} · Exportdatum ${todayStamp()}`);
  doc.addMetricGrid([
    { label: 'Checklist-Score', value: `${checklistProgress.score}%` },
    { label: 'Blocker', value: checklistProgress.blockers },
    { label: 'Offene Feststellungen', value: findingSummary.open },
    { label: 'Kritische Feststellungen', value: findingSummary.critical },
  ]);

  doc.addSection('Review- und Compliance-Kalender');
  doc.addMiniTable([
    ['Management Review', reviewPlan.nextManagementReviewDate || '-'],
    ['Interner Audit', reviewPlan.nextInternalAuditDate || '-'],
    ['Evidence Review', reviewPlan.nextEvidenceReviewDate || '-'],
    ['Übung / Test', reviewPlan.nextExerciseDate || '-'],
    ['KRITIS-Registrierung', complianceCalendar.registrationDate || '-'],
    ['Letzte Risikoanalyse', complianceCalendar.lastRiskAssessmentDate || '-'],
    ['Letzte Resilienzplan-Aktualisierung', complianceCalendar.lastResiliencePlanUpdate || '-'],
    ['Letzter IT-Nachweis / Audit', complianceCalendar.lastBsiEvidenceAuditDate || '-'],
  ]);

  doc.addSection('Offene Anforderungen');
  doc.addBullets(
    openRequirements.length
      ? openRequirements.slice(0, 10).map((item) => `${item.title}${item.lawRef ? ` · ${item.lawRef}` : ''}`)
      : ['Keine offenen KRITIS-Anforderungen.'],
  );

  doc.addSection('Kommende Fristen');
  doc.addBullets(
    deadlineSummary.nextItems.length
      ? deadlineSummary.nextItems.slice(0, 10).map((item) => `${item.title} · ${item.dueDate || 'offen'} · ${item.category} · ${item.status}`)
      : ['Keine Fristen gepflegt.'],
  );

  doc.addSection('Nächste Evidenzen');
  doc.addBullets(
    dueEvidence.length
      ? dueEvidence.map((item) => `${item.title} · Ordner ${item.folder || 'offen'} · Review ${item.reviewDate || '-'} · Gültig bis ${item.validUntil || '-'}`)
      : ['Keine evidenzbezogenen Termine gepflegt.'],
  );

  doc.addSection('Auditfeststellungen');
  doc.addBullets(
    findings.length
      ? findings.slice(0, 12).map((item) => `${item.title} · ${item.severity} · ${item.status} · ${item.dueDate || 'ohne Termin'}`)
      : ['Keine Feststellungen dokumentiert.'],
  );

  doc.save(`audit-pack-${slugify(companyLabel) || 'unternehmen'}-${todayStamp()}.pdf`);
}
