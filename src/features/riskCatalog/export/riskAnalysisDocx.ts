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
  buildRiskAggregate,
  classifyResidualRisk,
  classifyRiskEntry,
  computeRiskScore,
  getCriticalityLabel,
} from '../analysis';
import { findSubCategory } from '../taxonomy';
import type { RiskEntry } from '../types';
import type { CompanyProfile } from '../../../types';

export interface RiskAnalysisDocxInput {
  companyProfile: CompanyProfile;
  riskEntries: RiskEntry[];
  generatedAt?: Date;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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

function tableCell(text: string, bold = false, width = 15): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
    width: { size: width, type: WidthType.PERCENTAGE },
  });
}

function buildCriticalitySummaryTable(entries: RiskEntry[]): Table {
  const aggregate = buildRiskAggregate(entries);
  const header = new TableRow({
    tableHeader: true,
    children: [
      tableCell('Sicht', true, 30),
      tableCell('Akzeptabel', true, 15),
      tableCell('Beobachten', true, 15),
      tableCell('Handeln', true, 20),
      tableCell('Sofort handeln', true, 20),
    ],
  });
  const initialRow = new TableRow({
    children: [
      tableCell('Initialbewertung', false, 30),
      tableCell(String(aggregate.byCriticality.akzeptabel), false, 15),
      tableCell(String(aggregate.byCriticality.beobachten), false, 15),
      tableCell(String(aggregate.byCriticality.handeln), false, 20),
      tableCell(String(aggregate.byCriticality.sofort), false, 20),
    ],
  });
  const residualRow = new TableRow({
    children: [
      tableCell('Restrisiko (nach Maßnahmen)', false, 30),
      tableCell(String(aggregate.residualByCriticality.akzeptabel), false, 15),
      tableCell(String(aggregate.residualByCriticality.beobachten), false, 15),
      tableCell(String(aggregate.residualByCriticality.handeln), false, 20),
      tableCell(String(aggregate.residualByCriticality.sofort), false, 20),
    ],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, initialRow, residualRow],
  });
}

function buildCategoryTable(entries: RiskEntry[]): Table {
  const aggregate = buildRiskAggregate(entries);
  const header = new TableRow({
    tableHeader: true,
    children: [
      tableCell('Kategorie', true, 35),
      tableCell('Anzahl', true, 10),
      tableCell('Ø Score', true, 15),
      tableCell('Max. Score', true, 15),
      tableCell('Verteilung', true, 25),
    ],
  });
  const rows = aggregate.byCategory.map((group) => new TableRow({
    children: [
      tableCell(group.categoryLabel, false, 35),
      tableCell(String(group.count), false, 10),
      tableCell(group.averageScore.toFixed(1).replace('.', ','), false, 15),
      tableCell(String(group.highestScore), false, 15),
      tableCell(
        `A: ${group.byCriticality.akzeptabel} · B: ${group.byCriticality.beobachten} · H: ${group.byCriticality.handeln} · S: ${group.byCriticality.sofort}`,
        false,
        25,
      ),
    ],
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows],
  });
}

function buildEntryTable(entries: RiskEntry[]): Table {
  const header = new TableRow({
    tableHeader: true,
    children: [
      tableCell('Titel', true, 24),
      tableCell('Kategorie / Unterkategorie', true, 22),
      tableCell('Initial', true, 14),
      tableCell('Restrisiko', true, 14),
      tableCell('Owner', true, 13),
      tableCell('Review', true, 13),
    ],
  });
  const rows = entries.map((entry) => {
    const sub = findSubCategory(entry.categoryId, entry.subCategoryId);
    const initialScore = computeRiskScore(entry.eintrittswahrscheinlichkeit, entry.auswirkung);
    const residualScore = computeRiskScore(entry.eintrittswahrscheinlichkeit, entry.residualRisk);
    const initialLabel = getCriticalityLabel(classifyRiskEntry(entry));
    const residualLabel = getCriticalityLabel(classifyResidualRisk(entry));
    return new TableRow({
      children: [
        tableCell(entry.titel || '–', false, 24),
        tableCell(`${entry.categoryId} · ${sub?.label ?? entry.subCategoryId}`, false, 22),
        tableCell(`${initialLabel} · ${initialScore}`, false, 14),
        tableCell(`${residualLabel} · ${residualScore}`, false, 14),
        tableCell(entry.owner || 'offen', false, 13),
        tableCell(entry.reviewDate || '–', false, 13),
      ],
    });
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows],
  });
}

export function buildRiskAnalysisDocument(input: RiskAnalysisDocxInput): Document {
  const { companyProfile, riskEntries } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const aggregate = buildRiskAggregate(riskEntries);

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      children: [new TextRun({ text: 'Betreiber-Risikoanalyse nach § 12 KRITISDachG', bold: true, size: 32 })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
    }),
    bodyParagraph(`Erstellt am ${formatDate(generatedAt)} — UVM Consulting Group / UVM-Institut.`),
    bodyParagraph(
      'Dokument zur strukturierten Risikoanalyse nach dem All-Gefahren-Ansatz des § 12 KRITISDachG. Das Papier fasst Methodik, Risikobild und Einzelrisiken zusammen und dient als Grundlage für den Resilienzplan nach § 13 und die Nachweisführung nach § 16.',
    ),

    headingParagraph('1. Mandant', HeadingLevel.HEADING_1),
    labelValueParagraph('Unternehmen', companyProfile.companyName || '—'),
    labelValueParagraph('Branche', companyProfile.industryLabel || '—'),
    labelValueParagraph('Standorte', companyProfile.locations || '—'),
    labelValueParagraph('Kritische Dienstleistung', companyProfile.criticalService || '—'),
    labelValueParagraph('Versorgte Personen', companyProfile.personsServed || '—'),

    headingParagraph('2. Methodik', HeadingLevel.HEADING_1),
    bodyParagraph(
      'Die Analyse folgt dem All-Gefahren-Ansatz nach § 12 KRITISDachG und erfasst Risiken in den sechs Kategorien Naturgefahren, Technische Gefahren, Menschliche Gefahren intentional und nicht intentional, Interdependenzen sowie Cyber-physische Kaskaden.',
    ),
    bodyParagraph(
      'Bewertet wird über eine 5×5-Matrix: Eintrittswahrscheinlichkeit × Auswirkung, jeweils Skala 1 (gering) bis 5 (sehr hoch).',
    ),
    bodyParagraph(
      'Kritikalitätsschwellen: Score 1–4 akzeptabel; 5–9 beobachten; 10–15 handeln; 16–25 sofort handeln. Das Restrisiko wird mit der Eintrittswahrscheinlichkeit und der Auswirkung nach Wirkung der Maßnahmen neu bewertet.',
    ),

    headingParagraph('3. Risikobild', HeadingLevel.HEADING_1),
    labelValueParagraph('Anzahl erfasster Risiken', String(aggregate.total)),
    labelValueParagraph(
      'Durchschnittlicher Score (initial)',
      aggregate.total > 0 ? aggregate.averageScore.toFixed(1).replace('.', ',') : '—',
    ),
    labelValueParagraph(
      'Höchster Score (initial)',
      aggregate.total > 0 ? String(aggregate.highestScore) : '—',
    ),

    headingParagraph('3.1 Verteilung nach Kritikalität', HeadingLevel.HEADING_2),
    buildCriticalitySummaryTable(riskEntries),

    headingParagraph('3.2 Verteilung nach Kategorien', HeadingLevel.HEADING_2),
    aggregate.byCategory.length > 0
      ? buildCategoryTable(riskEntries)
      : bodyParagraph('Noch keine Risiken erfasst.'),

    headingParagraph('4. Top-Risiken', HeadingLevel.HEADING_1),
    aggregate.topRisks.length > 0
      ? buildEntryTable(aggregate.topRisks)
      : bodyParagraph('Noch keine Risiken erfasst.'),

    headingParagraph('5. Einzelrisiken', HeadingLevel.HEADING_1),
    riskEntries.length > 0
      ? buildEntryTable(riskEntries)
      : bodyParagraph('Noch keine Risiken erfasst.'),

    headingParagraph('6. Hinweise', HeadingLevel.HEADING_1),
    bodyParagraph(
      'Die Bewertungen sind beratungsgestützt und folgen dem Konservativitätsgebot: Im Zweifel wird höher eingestuft, um die Angemessenheit der Maßnahmen nach § 13 abzusichern.',
    ),
    bodyParagraph(
      'Aktualisierung: Die Betreiber-Risikoanalyse ist mindestens alle vier Jahre sowie anlassbezogen fortzuschreiben (§ 12 Abs. 2 KRITISDachG).',
    ),
    bodyParagraph(
      'Nachweisfähigkeit: Dieses Dokument kann als Nachweis im Sinne von § 16 KRITISDachG herangezogen werden. Anerkennung gleichwertiger Nachweise (§ 17) bleibt vorbehalten.',
    ),
  ];

  return new Document({
    creator: 'UVM Consulting Group',
    title: 'Betreiber-Risikoanalyse nach § 12 KRITISDachG',
    description: 'Strukturierte Risikoanalyse nach dem All-Gefahren-Ansatz',
    sections: [{ properties: {}, children }],
  });
}

export async function buildRiskAnalysisBlob(input: RiskAnalysisDocxInput): Promise<Blob> {
  const document = buildRiskAnalysisDocument(input);
  return Packer.toBlob(document);
}

export function buildRiskAnalysisFileName(
  companyProfile: CompanyProfile,
  generatedAt: Date = new Date(),
): string {
  const companySlug = (companyProfile.companyName || 'mandant')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'mandant';
  const dateSlug = generatedAt.toISOString().slice(0, 10);
  return `Betreiber-Risikoanalyse-${companySlug}-${dateSlug}.docx`;
}
