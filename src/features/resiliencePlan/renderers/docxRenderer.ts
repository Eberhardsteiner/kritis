import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import {
  ORDERED_RESILIENCE_GOALS,
  PLAN_SECTION_LABELS,
  RESILIENCE_GOAL_DESCRIPTIONS,
  RESILIENCE_GOAL_LABELS,
} from '../template';
import type { MeasureReference, ResiliencePlan, TopRiskReference } from '../types';

/**
 * DOCX-Renderer für den Resilienzplan nach § 13 KRITISDachG. Baut das
 * Dokument entlang der sechsteiligen Grundstruktur und nutzt Tabellen,
 * wo strukturiertes Lesen für Audit-Zwecke nötig ist (Top-Risiken, Maßnahmen,
 * Evidenzen).
 */

export interface RenderDocxOptions {
  generatedAt?: Date;
}

function headingParagraph(
  text: string,
  level: (typeof HeadingLevel)[keyof typeof HeadingLevel],
): Paragraph {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 240, after: 120 },
  });
}

function bodyParagraph(text: string, bold = false): Paragraph {
  if (!text.trim()) {
    return new Paragraph({ children: [new TextRun({ text: ' ' })] });
  }
  return new Paragraph({
    children: [new TextRun({ text, bold })],
    spacing: { after: 80 },
  });
}

function labelValue(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value || '—' }),
    ],
    spacing: { after: 60 },
  });
}

function cell(text: string, bold = false, width = 20): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
    width: { size: width, type: WidthType.PERCENTAGE },
  });
}

function buildTopRisksTable(topRisks: TopRiskReference[]): Table {
  const header = new TableRow({
    tableHeader: true,
    children: [
      cell('Titel', true, 35),
      cell('Kategorie', true, 20),
      cell('Initial', true, 15),
      cell('Restrisiko', true, 15),
      cell('Kritikalität', true, 15),
    ],
  });
  const rows = topRisks.map((risk) => new TableRow({
    children: [
      cell(risk.title, false, 35),
      cell(risk.category, false, 20),
      cell(String(risk.initialScore), false, 15),
      cell(String(risk.residualScore), false, 15),
      cell(risk.criticality, false, 15),
    ],
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows],
  });
}

function buildMeasuresTable(measures: MeasureReference[]): Table {
  const header = new TableRow({
    tableHeader: true,
    children: [
      cell('Maßnahme', true, 38),
      cell('Owner', true, 20),
      cell('Fällig', true, 18),
      cell('Status', true, 12),
      cell('Link', true, 12),
    ],
  });
  const rows = measures.map((measure) => new TableRow({
    children: [
      cell(measure.title || '—', false, 38),
      cell(measure.owner || 'offen', false, 20),
      cell(measure.dueDate || '—', false, 18),
      cell(measure.status, false, 12),
      cell(measure.linkedActionItemId ? 'verknüpft' : '—', false, 12),
    ],
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows],
  });
}

export function renderResiliencePlanDocxDocument(
  plan: ResiliencePlan,
  options: RenderDocxOptions = {},
): Document {
  const generatedAt = options.generatedAt ?? new Date();
  const formattedDate = generatedAt.toLocaleDateString('de-DE');
  const { content } = plan;

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      children: [new TextRun({ text: 'Resilienzplan nach § 13 KRITISDachG', bold: true, size: 32 })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
    }),
    bodyParagraph(
      `Version ${plan.version} · Status ${plan.status} · erstellt am ${formattedDate} · UVM Consulting Group.`,
    ),
    bodyParagraph(
      plan.approvedBy
        ? `Freigegeben durch ${plan.approvedBy} am ${plan.approvedAt ?? '—'}.`
        : 'Noch nicht formal freigegeben.',
    ),
  ];

  // 1. Scope
  children.push(headingParagraph(PLAN_SECTION_LABELS.scope, HeadingLevel.HEADING_1));
  children.push(labelValue('Betreiber', content.scope.operatorName));
  children.push(labelValue('Sektor', content.scope.sector));
  children.push(labelValue('Kritische Dienstleistung', content.scope.criticalService));
  children.push(labelValue('Standorte', content.scope.locations));
  children.push(labelValue('Mitarbeitende', content.scope.employees));
  children.push(labelValue('Versorgte Personen', content.scope.personsServed));
  children.push(bodyParagraph(content.scope.scopeNote));

  // 2. Risikobasis
  children.push(headingParagraph(PLAN_SECTION_LABELS.riskBasis, HeadingLevel.HEADING_1));
  children.push(bodyParagraph(content.riskBasis.methodology));
  children.push(bodyParagraph(content.riskBasis.riskAnalysisReference));
  children.push(bodyParagraph(content.riskBasis.riskBasisNote));
  if (content.riskBasis.topRisks.length > 0) {
    children.push(headingParagraph('2.1 Top-Risiken', HeadingLevel.HEADING_2));
    children.push(buildTopRisksTable(content.riskBasis.topRisks));
  } else {
    children.push(bodyParagraph('Noch keine Top-Risiken referenziert.'));
  }

  // 3. Maßnahmen nach Resilienzzielen
  children.push(headingParagraph(PLAN_SECTION_LABELS.measuresByGoal, HeadingLevel.HEADING_1));
  for (const goal of ORDERED_RESILIENCE_GOALS) {
    const label = RESILIENCE_GOAL_LABELS[goal];
    const measures = content.measuresByGoal[goal];
    children.push(headingParagraph(`3.${ORDERED_RESILIENCE_GOALS.indexOf(goal) + 1} ${label}`, HeadingLevel.HEADING_2));
    children.push(bodyParagraph(RESILIENCE_GOAL_DESCRIPTIONS[goal]));
    if (measures.length === 0) {
      children.push(bodyParagraph('Für dieses Resilienzziel sind noch keine Maßnahmen zugeordnet.'));
    } else {
      children.push(buildMeasuresTable(measures));
    }
  }

  // 4. Governance
  children.push(headingParagraph(PLAN_SECTION_LABELS.governance, HeadingLevel.HEADING_1));
  children.push(labelValue('Geschäftsleitung (§ 20)', content.governance.managementBoardContact));
  children.push(labelValue('Programmverantwortung', content.governance.programOwner));
  children.push(bodyParagraph(content.governance.escalationPath));
  children.push(bodyParagraph(content.governance.boardReviewCadence));
  children.push(bodyParagraph(content.governance.governanceNote));

  // 5. Reporting
  children.push(headingParagraph(PLAN_SECTION_LABELS.reporting, HeadingLevel.HEADING_1));
  children.push(labelValue('Meldekontakt (§ 18)', content.reporting.incidentContact));
  children.push(labelValue('Ersatzkontakt', content.reporting.incidentBackupContact));
  children.push(bodyParagraph(content.reporting.bsiPortalNote));
  children.push(bodyParagraph(content.reporting.firstReportingTimeline));
  children.push(bodyParagraph(content.reporting.reportingNote));

  // 6. Evidenz
  children.push(headingParagraph(PLAN_SECTION_LABELS.evidence, HeadingLevel.HEADING_1));
  children.push(labelValue('Review-Zyklus (Jahre)', String(content.evidence.reviewCycleYears)));
  children.push(bodyParagraph(content.evidence.equivalentProofsNote));
  children.push(bodyParagraph(content.evidence.evidenceNote));
  if (content.evidence.evidenceReferences.length > 0) {
    const header = new TableRow({
      tableHeader: true,
      children: [
        cell('Nachweis', true, 50),
        cell('Typ', true, 20),
        cell('Quellstandard', true, 30),
      ],
    });
    const rows = content.evidence.evidenceReferences.map((ref) => new TableRow({
      children: [
        cell(ref.title, false, 50),
        cell(ref.type, false, 20),
        cell(ref.sourceStandard ?? '—', false, 30),
      ],
    }));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [header, ...rows],
    }));
  }

  return new Document({
    creator: 'UVM Consulting Group',
    title: `Resilienzplan ${plan.version}`,
    description: 'Resilienzplan nach § 13 KRITISDachG',
    sections: [{ properties: {}, children }],
  });
}

export async function renderResiliencePlanDocxBlob(
  plan: ResiliencePlan,
  options: RenderDocxOptions = {},
): Promise<Blob> {
  const document = renderResiliencePlanDocxDocument(plan, options);
  return Packer.toBlob(document);
}

export function buildResiliencePlanDocxFileName(
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
  return `Resilienzplan-${slug}-v${versionSlug}-${dateSlug}.docx`;
}
