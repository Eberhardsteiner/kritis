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
import { getConfidenceLabel } from '../gapAnalysis';
import type {
  CompanyProfile,
  GapAnalysisSummary,
  RequirementDefinition,
} from '../../../types';

export interface GapAnalysisDocxInput {
  companyProfile: CompanyProfile;
  gapAnalysisSummary: GapAnalysisSummary;
  requirements: RequirementDefinition[];
  generatedAt?: Date;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatPersonDays(value: number): string {
  return `${value.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} PT`;
}

function headingParagraph(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 240, after: 120 },
  });
}

function bodyParagraph(text: string, bold = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold })],
    spacing: { after: 80 },
  });
}

function labelValueParagraph(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value }),
    ],
    spacing: { after: 60 },
  });
}

function tableCell(text: string, bold = false): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
    width: { size: 25, type: WidthType.PERCENTAGE },
  });
}

function buildRegimeTable(summary: GapAnalysisSummary): Table {
  const header = new TableRow({
    tableHeader: true,
    children: [
      tableCell('Regime', true),
      tableCell('Summe PT', true),
      tableCell('Anzahl Pflichten', true),
      tableCell('Kategorien-Breakdown', true),
    ],
  });
  const rows = summary.byRegime.map((regime) => new TableRow({
    children: [
      tableCell(regime.regimeLabel),
      tableCell(formatPersonDays(regime.totalPersonDays)),
      tableCell(String(regime.entries.length)),
      tableCell(
        Object.entries(regime.byCategory)
          .map(([category, pt]) => `${category}: ${formatPersonDays(pt)}`)
          .join(', ') || '–',
      ),
    ],
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows],
  });
}

function buildRequirementTable(
  summary: GapAnalysisSummary,
  requirementLookup: Map<string, RequirementDefinition>,
): Table {
  const header = new TableRow({
    tableHeader: true,
    children: [
      tableCell('Pflichtbaustein', true),
      tableCell('Kategorie', true),
      tableCell('Status', true),
      tableCell('PT', true),
      tableCell('Confidence', true),
    ],
  });
  const rows: TableRow[] = [];
  for (const regime of summary.byRegime) {
    for (const entry of regime.entries) {
      const requirement = requirementLookup.get(entry.requirementId);
      rows.push(
        new TableRow({
          children: [
            tableCell(
              requirement?.title ? `${requirement.title} (${requirement.lawRef ?? ''})` : entry.requirementId,
            ),
            tableCell(entry.category),
            tableCell(entry.currentStatus),
            tableCell(formatPersonDays(entry.effortEstimate.personDays)),
            tableCell(getConfidenceLabel(entry.effortEstimate.confidence)),
          ],
        }),
      );
    }
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows],
  });
}

export function buildGapAnalysisDocument(input: GapAnalysisDocxInput): Document {
  const { companyProfile, gapAnalysisSummary, requirements } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const requirementLookup = new Map(requirements.map((requirement) => [requirement.id, requirement]));

  const childrenElements: Array<Paragraph | Table> = [
    new Paragraph({
      children: [new TextRun({ text: 'Angebotsgrundlage KRITIS-Readiness', bold: true, size: 32 })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
    }),
    bodyParagraph(
      `Erstellt am ${formatDate(generatedAt)} — UVM Consulting Group / UVM-Institut.`,
    ),
    bodyParagraph(
      'Diese Angebotsgrundlage ist eine heuristische Aufwandsschätzung auf Basis des aktuellen Mandantenbilds und der hinterlegten Standard-Mappings. Die Zahlen sind konservativ gewählt; sie ersetzen keine detaillierte Projektplanung.',
    ),

    headingParagraph('Mandant', HeadingLevel.HEADING_1),
    labelValueParagraph('Unternehmen', companyProfile.companyName || '—'),
    labelValueParagraph('Branche', companyProfile.industryLabel || '—'),
    labelValueParagraph('Mitarbeitende', companyProfile.employees || '—'),
    labelValueParagraph('Standorte', companyProfile.locations || '—'),
    labelValueParagraph('Kritische Dienstleistung', companyProfile.criticalService || '—'),
    labelValueParagraph('Versorgte Personen', companyProfile.personsServed || '—'),

    headingParagraph('Gesamtabschätzung', HeadingLevel.HEADING_1),
    labelValueParagraph('Restaufwand gesamt', formatPersonDays(gapAnalysisSummary.totalPersonDays)),
    labelValueParagraph(
      'Kalenderwochen',
      gapAnalysisSummary.totalPersonDays > 0
        ? `${gapAnalysisSummary.calendarWeeks} (ein Consultant in Vollauslastung)`
        : '0',
    ),
    labelValueParagraph('Anzahl Pflichtbausteine', String(gapAnalysisSummary.entryCount)),

    headingParagraph('Restaufwand je Regime', HeadingLevel.HEADING_1),
    buildRegimeTable(gapAnalysisSummary),

    headingParagraph('Einzelbausteine', HeadingLevel.HEADING_1),
    buildRequirementTable(gapAnalysisSummary, requirementLookup),

    headingParagraph('Heuristik', HeadingLevel.HEADING_1),
    bodyParagraph(
      'Basis-Aufwand je Kategorie: scope/registration/governance = 2 PT, risk/plan/evidence/incident/reporting_channel/special_measures = 5 PT, measures = 10 PT.',
    ),
    bodyParagraph(
      'Gap-Faktor je Status: offen = 1,0; in Arbeit = 0,5; bereit = 0,1; nicht anwendbar = 0.',
    ),
    bodyParagraph(
      'Reduktionen: -0,1 pro primary-Mapping (max -0,3), -0,05 pro verknüpfter Evidenz (max -0,2). Mindest-Gap-Faktor 0,1 bei offenen Pflichten zur Sicherung der Integrations- und Nachweispflege.',
    ),

    headingParagraph('Nutzung', HeadingLevel.HEADING_1),
    bodyParagraph(
      'Diese Angebotsgrundlage dient UVM-Beratern als quantifizierte Ausgangsbasis für Kundengespräche. Sie enthält keine rechtsverbindliche Einordnung und ist kein Festpreis-Angebot. Eine vertiefte Aufwandsplanung erfolgt im Rahmen eines Scoping-Workshops.',
    ),
  ];

  return new Document({
    creator: 'UVM Consulting Group',
    title: 'Angebotsgrundlage KRITIS-Readiness',
    description: 'Heuristische Aufwandsabschätzung für KRITIS-Readiness-Projekte',
    sections: [
      {
        properties: {},
        children: childrenElements,
      },
    ],
  });
}

export async function buildGapAnalysisBlob(input: GapAnalysisDocxInput): Promise<Blob> {
  const document = buildGapAnalysisDocument(input);
  return Packer.toBlob(document);
}

export function buildGapAnalysisFileName(
  companyProfile: CompanyProfile,
  generatedAt: Date = new Date(),
): string {
  const companySlug = (companyProfile.companyName || 'mandant')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'mandant';
  const dateSlug = generatedAt.toISOString().slice(0, 10);
  return `Angebotsgrundlage-${companySlug}-${dateSlug}.docx`;
}
