import { jsPDF } from 'jspdf';
import {
  ORDERED_RESILIENCE_GOALS,
  PLAN_SECTION_LABELS,
  RESILIENCE_GOAL_DESCRIPTIONS,
  RESILIENCE_GOAL_LABELS,
} from '../template';
import type { ResiliencePlan } from '../types';

/**
 * PDF-Renderer für den Resilienzplan via jspdf. Die Ausgabe ist bewusst
 * schlank gehalten (keine Grafiken, keine komplexen Tabellen), damit sie
 * auf jedem Gerät zuverlässig rendert. Falls perspektivisch Management-
 * Folien mit höherer Qualität gewünscht sind, kann auf pdfmake oder
 * serverseitiges Playwright gewechselt werden — BLOCK-B.md B4 § Renderer.
 */

export interface RenderPdfOptions {
  generatedAt?: Date;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('de-DE');
}

export function renderResiliencePlanPdf(
  plan: ResiliencePlan,
  options: RenderPdfOptions = {},
): jsPDF {
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

  function addHeading(text: string, size = 14): void {
    ensureSpace(size + 4);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(size);
    pdf.text(text, margin, y);
    y += size * 0.6 + 3;
  }

  function addBody(text: string, opts: { italic?: boolean; bold?: boolean } = {}): void {
    const normalized = text.trim();
    if (!normalized) {
      return;
    }
    pdf.setFont('helvetica', opts.bold ? 'bold' : opts.italic ? 'italic' : 'normal');
    pdf.setFontSize(10);
    const lines = pdf.splitTextToSize(normalized, contentWidth);
    for (const line of lines as string[]) {
      ensureSpace(5);
      pdf.text(line, margin, y);
      y += 4.5;
    }
    y += 2;
  }

  function addLabelValue(label: string, value: string): void {
    const normalizedValue = value?.trim() || '—';
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    const labelWidth = pdf.getTextWidth(`${label}: `);
    ensureSpace(5);
    pdf.text(`${label}:`, margin, y);
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(normalizedValue, contentWidth - labelWidth - 2);
    pdf.text(lines as string[], margin + labelWidth, y);
    y += ((lines as string[]).length) * 4.5 + 1;
  }

  const generatedAt = options.generatedAt ?? new Date();

  // Titelkopf
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('Resilienzplan nach § 13 KRITISDachG', margin, y);
  y += 9;

  addBody(
    `Version ${plan.version} · Status ${plan.status} · erstellt am ${formatDate(generatedAt)} · UVM Consulting Group.`,
    { italic: true },
  );
  addBody(
    plan.approvedBy
      ? `Freigegeben durch ${plan.approvedBy} am ${plan.approvedAt ?? '—'}.`
      : 'Noch nicht formal freigegeben.',
    { italic: true },
  );

  // 1. Scope
  addHeading(PLAN_SECTION_LABELS.scope);
  addLabelValue('Betreiber', plan.content.scope.operatorName);
  addLabelValue('Sektor', plan.content.scope.sector);
  addLabelValue('Kritische Dienstleistung', plan.content.scope.criticalService);
  addLabelValue('Standorte', plan.content.scope.locations);
  addLabelValue('Mitarbeitende', plan.content.scope.employees);
  addLabelValue('Versorgte Personen', plan.content.scope.personsServed);
  addBody(plan.content.scope.scopeNote);

  // 2. Risikobasis
  addHeading(PLAN_SECTION_LABELS.riskBasis);
  addBody(plan.content.riskBasis.methodology);
  addBody(plan.content.riskBasis.riskAnalysisReference);
  addBody(plan.content.riskBasis.riskBasisNote);
  if (plan.content.riskBasis.topRisks.length > 0) {
    addHeading('2.1 Top-Risiken', 12);
    for (const risk of plan.content.riskBasis.topRisks) {
      addBody(
        `• ${risk.title} (Kategorie ${risk.category}) — Initial ${risk.initialScore}, Rest ${risk.residualScore}, ${risk.criticality}`,
      );
    }
  }

  // 3. Maßnahmen nach Resilienzzielen
  addHeading(PLAN_SECTION_LABELS.measuresByGoal);
  for (const goal of ORDERED_RESILIENCE_GOALS) {
    const measures = plan.content.measuresByGoal[goal];
    addHeading(`3.${ORDERED_RESILIENCE_GOALS.indexOf(goal) + 1} ${RESILIENCE_GOAL_LABELS[goal]}`, 12);
    addBody(RESILIENCE_GOAL_DESCRIPTIONS[goal], { italic: true });
    if (measures.length === 0) {
      addBody('Keine Maßnahmen zugeordnet.');
    } else {
      for (const measure of measures) {
        addBody(
          `• ${measure.title || 'Unbenannt'} · Owner ${measure.owner || 'offen'} · fällig ${measure.dueDate || '—'} · Status ${measure.status}`,
        );
      }
    }
  }

  // 4. Governance
  addHeading(PLAN_SECTION_LABELS.governance);
  addLabelValue('Geschäftsleitung (§ 20)', plan.content.governance.managementBoardContact);
  addLabelValue('Programmverantwortung', plan.content.governance.programOwner);
  addBody(plan.content.governance.escalationPath);
  addBody(plan.content.governance.boardReviewCadence);
  addBody(plan.content.governance.governanceNote);

  // 5. Reporting
  addHeading(PLAN_SECTION_LABELS.reporting);
  addLabelValue('Meldekontakt (§ 18)', plan.content.reporting.incidentContact);
  addLabelValue('Ersatzkontakt', plan.content.reporting.incidentBackupContact);
  addBody(plan.content.reporting.bsiPortalNote);
  addBody(plan.content.reporting.firstReportingTimeline);
  addBody(plan.content.reporting.reportingNote);

  // 6. Evidenz
  addHeading(PLAN_SECTION_LABELS.evidence);
  addLabelValue('Review-Zyklus (Jahre)', String(plan.content.evidence.reviewCycleYears));
  addBody(plan.content.evidence.equivalentProofsNote);
  addBody(plan.content.evidence.evidenceNote);
  if (plan.content.evidence.evidenceReferences.length > 0) {
    addHeading('6.1 Nachweisreferenzen', 12);
    for (const ref of plan.content.evidence.evidenceReferences) {
      addBody(
        `• ${ref.title} (Typ ${ref.type}${ref.sourceStandard ? `, ${ref.sourceStandard}` : ''})`,
      );
    }
  }

  return pdf;
}

export function renderResiliencePlanPdfBlob(
  plan: ResiliencePlan,
  options: RenderPdfOptions = {},
): Blob {
  const pdf = renderResiliencePlanPdf(plan, options);
  return pdf.output('blob');
}

export function buildResiliencePlanPdfFileName(
  operatorName: string,
  version: string,
  generatedAt: Date = new Date(),
): string {
  const slug = (operatorName || 'mandant')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'mandant';
  const dateSlug = generatedAt.toISOString().slice(0, 10);
  const versionSlug = version.replace(/[^a-z0-9.]/gi, '-');
  return `Resilienzplan-${slug}-v${versionSlug}-${dateSlug}.pdf`;
}
