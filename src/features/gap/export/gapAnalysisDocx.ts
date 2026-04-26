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
import {
  CURRENCY_LABELS,
  formatCalendarWeeksRange,
  formatEuro,
  formatEuroRange,
  formatPersonDays,
  formatPersonDaysRange,
} from '../utils/formatters';
import type {
  CompanyProfile,
  ConsultingRateSettings,
  GapAnalysisEntry,
  GapAnalysisSummary,
  RequirementDefinition,
} from '../../../types';

export interface GapAnalysisDocxInput {
  companyProfile: CompanyProfile;
  gapAnalysisSummary: GapAnalysisSummary;
  requirements: RequirementDefinition[];
  /**
   * Optionaler Tagessatz für Euro-Bandbreite. Wenn nicht gesetzt,
   * blendet das Dokument die Euro-Spalten aus und zeigt nur PT.
   */
  consultingRate?: ConsultingRateSettings | null;
  generatedAt?: Date;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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

function buildRegimeTable(
  summary: GapAnalysisSummary,
  rate: ConsultingRateSettings | null | undefined,
): Table {
  const header = new TableRow({
    tableHeader: true,
    children: [
      tableCell('Regime', true),
      tableCell('PT-Bandbreite', true),
      ...(rate ? [tableCell(`${CURRENCY_LABELS[rate.currency]}-Bandbreite`, true)] : []),
      tableCell('Anzahl Pflichten', true),
      tableCell('Kategorien-Breakdown', true),
    ],
  });
  const rows = summary.byRegime.map((regime) => {
    const cells = [
      tableCell(regime.regimeLabel),
      tableCell(formatPersonDaysRange(regime.minPersonDays, regime.maxPersonDays)),
    ];
    if (rate && rate.ratePerPersonDay > 0) {
      cells.push(
        tableCell(
          formatEuroRange(
            regime.minPersonDays * rate.ratePerPersonDay,
            regime.maxPersonDays * rate.ratePerPersonDay,
            rate.currency,
          ),
        ),
      );
    }
    cells.push(
      tableCell(String(regime.entries.length)),
      tableCell(
        Object.entries(regime.byCategory)
          .map(([category, range]) => `${category}: ${formatPersonDaysRange(range.minPersonDays, range.maxPersonDays)}`)
          .join(', ') || '–',
      ),
    );
    return new TableRow({ children: cells });
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows],
  });
}

/**
 * Tätigkeits-Tabelle pro Anforderung mit effortBreakdown. C5.4.4:
 * Brutto-Aufwand und Restaufwand stehen jetzt nebeneinander, weil sie
 * zwei legitime Fragen beantworten:
 *  - Brutto = vollständige Durchführung (Beratungs-Aufwand-Begründung,
 *    status-unabhängig).
 *  - Restaufwand = status-skaliert; deren Summe stimmt mit dem
 *    Anforderungs-Header überein.
 *
 * Spalten:
 *  - Mit Tagessatz (5):  Tätigkeit | Brutto-h | Brutto-€ | Rest-h | Rest-€
 *  - Ohne Tagessatz (3): Tätigkeit | Brutto-h | Rest-h
 *
 * Min/Max-Bandbreite wird als "min – max" innerhalb einer Zelle
 * formatiert, damit die Spaltenanzahl nicht explodiert.
 */
function buildActivityTable(
  entry: GapAnalysisEntry,
  rate: ConsultingRateSettings | null | undefined,
): Table {
  const hasRate = !!rate && rate.ratePerPersonDay > 0;
  const headerCells = [
    tableCell('Tätigkeit', true),
    tableCell('Brutto-h (min – max)', true),
  ];
  if (hasRate && rate) {
    headerCells.push(tableCell(`Brutto-${CURRENCY_LABELS[rate.currency]} (min – max)`, true));
  }
  headerCells.push(tableCell('Rest-h (min – max)', true));
  if (hasRate && rate) {
    headerCells.push(tableCell(`Rest-${CURRENCY_LABELS[rate.currency]} (min – max)`, true));
  }
  const header = new TableRow({ tableHeader: true, children: headerCells });
  const resolvedActivities = entry.effortEstimate.resolvedActivities ?? [];
  const rows = resolvedActivities.map((activity) => {
    const cells = [
      tableCell(activity.note ? `${activity.label} — ${activity.note}` : activity.label),
      tableCell(`${activity.minHoursRaw} – ${activity.maxHoursRaw}`),
    ];
    if (hasRate && rate) {
      const minRawEuro = (activity.minHoursRaw / 8) * rate.ratePerPersonDay;
      const maxRawEuro = (activity.maxHoursRaw / 8) * rate.ratePerPersonDay;
      cells.push(
        tableCell(`${formatEuro(minRawEuro, rate.currency)} – ${formatEuro(maxRawEuro, rate.currency)}`),
      );
    }
    cells.push(
      tableCell(`${activity.minHoursEffective} – ${activity.maxHoursEffective}`),
    );
    if (hasRate && rate) {
      const minEffEuro = (activity.minHoursEffective / 8) * rate.ratePerPersonDay;
      const maxEffEuro = (activity.maxHoursEffective / 8) * rate.ratePerPersonDay;
      cells.push(
        tableCell(`${formatEuro(minEffEuro, rate.currency)} – ${formatEuro(maxEffEuro, rate.currency)}`),
      );
    }
    return new TableRow({ children: cells });
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows],
  });
}

/**
 * Erläuterungs-Zeile unterhalb der Tätigkeits-Tabelle. Beantwortet die
 * Kunden-Frage "warum sind die zwei Spalten unterschiedlich groß?" und
 * benennt den konkreten Skalierungs-Faktor je nach Status.
 */
function buildActivityTableLegend(entry: GapAnalysisEntry): Paragraph {
  const restLabel =
    entry.currentStatus === 'ready'
      ? '10 % (nur Pflege)'
      : entry.currentStatus === 'in_progress'
        ? '50 % (in Bearbeitung)'
        : entry.currentStatus === 'not_applicable'
          ? '0 % (nicht anwendbar)'
          : '100 % (volle Umsetzung)';
  return bodyParagraph(
    `Brutto-Aufwand: vollständige Durchführung der Tätigkeit (status-unabhängig). `
      + `Restaufwand: skaliert auf aktuellen Status — ${restLabel} des Brutto-Aufwands. `
      + `Die Summe der Restaufwand-Spalte stimmt mit dem Anforderungs-Aufwand-Header überein.`,
  );
}

function buildRequirementBreakdownBlocks(
  summary: GapAnalysisSummary,
  requirementLookup: Map<string, RequirementDefinition>,
  rate: ConsultingRateSettings | null | undefined,
): Array<Paragraph | Table> {
  const blocks: Array<Paragraph | Table> = [];
  for (const regime of summary.byRegime) {
    for (const entry of regime.entries) {
      const requirement = requirementLookup.get(entry.requirementId);
      const minPT = entry.effortEstimate.minPersonDays ?? entry.effortEstimate.personDays;
      const maxPT = entry.effortEstimate.maxPersonDays ?? entry.effortEstimate.personDays;
      const ptLabel = formatPersonDaysRange(minPT, maxPT);
      const euroLabel =
        rate && rate.ratePerPersonDay > 0
          ? formatEuroRange(
              minPT * rate.ratePerPersonDay,
              maxPT * rate.ratePerPersonDay,
              rate.currency,
            )
          : '';
      const title = requirement?.title
        ? `${requirement.title}${requirement.lawRef ? ` (${requirement.lawRef})` : ''}`
        : entry.requirementId;
      blocks.push(headingParagraph(title, HeadingLevel.HEADING_2));
      blocks.push(labelValueParagraph('Aufwand', `${ptLabel}${euroLabel ? ` | ${euroLabel}` : ''}`));
      blocks.push(labelValueParagraph('Status', entry.currentStatus));
      blocks.push(
        labelValueParagraph(
          'Confidence',
          getConfidenceLabel(entry.effortEstimate.confidence),
        ),
      );
      const resolvedActivities = entry.effortEstimate.resolvedActivities ?? [];
      if (resolvedActivities.length > 0) {
        blocks.push(buildActivityTable(entry, rate));
        blocks.push(buildActivityTableLegend(entry));
      }
      const drivers = entry.effortEstimate.drivers ?? [];
      if (drivers.length > 0) {
        blocks.push(labelValueParagraph('Treiber für die Bandbreite', drivers.join(', ')));
      }
      if (entry.effortEstimate.assumptions.length > 0) {
        blocks.push(
          labelValueParagraph(
            'Annahmen',
            entry.effortEstimate.assumptions.join(' · '),
          ),
        );
      }
    }
  }
  return blocks;
}

/**
 * Heuristik-Übersicht als Kompakt-Tabelle, primär für Anforderungen
 * ohne Breakdown (Pack-Adoptionen). Bleibt zur Schnell-Orientierung
 * im Dokument unterhalb der Detail-Blöcke.
 */
function buildRequirementTable(
  summary: GapAnalysisSummary,
  requirementLookup: Map<string, RequirementDefinition>,
  rate: ConsultingRateSettings | null | undefined,
): Table {
  const headerCells = [
    tableCell('Pflichtbaustein', true),
    tableCell('Kategorie', true),
    tableCell('Status', true),
    tableCell('PT-Bandbreite', true),
  ];
  if (rate && rate.ratePerPersonDay > 0) {
    headerCells.push(tableCell(`${CURRENCY_LABELS[rate.currency]}-Bandbreite`, true));
  }
  headerCells.push(tableCell('Confidence', true));
  const header = new TableRow({ tableHeader: true, children: headerCells });
  const rows: TableRow[] = [];
  for (const regime of summary.byRegime) {
    for (const entry of regime.entries) {
      const requirement = requirementLookup.get(entry.requirementId);
      const minPT = entry.effortEstimate.minPersonDays ?? entry.effortEstimate.personDays;
      const maxPT = entry.effortEstimate.maxPersonDays ?? entry.effortEstimate.personDays;
      const ptLabel = formatPersonDaysRange(minPT, maxPT);
      const cells = [
        tableCell(
          requirement?.title ? `${requirement.title} (${requirement.lawRef ?? ''})` : entry.requirementId,
        ),
        tableCell(entry.category),
        tableCell(entry.currentStatus),
        tableCell(ptLabel),
      ];
      if (rate && rate.ratePerPersonDay > 0) {
        cells.push(
          tableCell(
            formatEuroRange(
              minPT * rate.ratePerPersonDay,
              maxPT * rate.ratePerPersonDay,
              rate.currency,
            ),
          ),
        );
      }
      cells.push(tableCell(getConfidenceLabel(entry.effortEstimate.confidence)));
      rows.push(new TableRow({ children: cells }));
    }
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows],
  });
}

export function buildGapAnalysisDocument(input: GapAnalysisDocxInput): Document {
  const { companyProfile, gapAnalysisSummary, requirements, consultingRate } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const requirementLookup = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const hasRate = consultingRate && consultingRate.ratePerPersonDay > 0;
  const totalPtLabel = formatPersonDaysRange(
    gapAnalysisSummary.minPersonDays,
    gapAnalysisSummary.maxPersonDays,
  );
  const totalEuroLabel = hasRate
    ? formatEuroRange(
        gapAnalysisSummary.minPersonDays * consultingRate!.ratePerPersonDay,
        gapAnalysisSummary.maxPersonDays * consultingRate!.ratePerPersonDay,
        consultingRate!.currency,
      )
    : '';
  const breakdownBlocks = buildRequirementBreakdownBlocks(
    gapAnalysisSummary,
    requirementLookup,
    consultingRate,
  );

  const headerElements: Array<Paragraph | Table> = [
    new Paragraph({
      children: [new TextRun({ text: 'Angebotsgrundlage KRITIS-Readiness', bold: true, size: 32 })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
    }),
    bodyParagraph(
      `Erstellt am ${formatDate(generatedAt)} — UVM Consulting Group / UVM-Institut.`,
    ),
  ];
  if (hasRate) {
    const effectiveLabel = consultingRate!.effectiveFrom
      ? `, gültig ab ${consultingRate!.effectiveFrom}`
      : '';
    headerElements.push(
      bodyParagraph(
        `Kalkulation auf Basis Tagessatz: ${formatEuro(consultingRate!.ratePerPersonDay, consultingRate!.currency)} pro Personentag${effectiveLabel}.`,
        true,
      ),
    );
  }
  headerElements.push(
    bodyParagraph(
      'Diese Angebotsgrundlage ist eine quantifizierte Aufwandsschätzung auf Basis des aktuellen Mandantenbilds. Anforderungen mit ausgearbeitetem Tätigkeits-Breakdown zeigen verteidigbare Min/Max-Bandbreiten; Anforderungen mit Heuristik-Schätzung zeigen einen Mittelwert. Die Zahlen ersetzen keine detaillierte Projektplanung.',
    ),
  );

  const childrenElements: Array<Paragraph | Table> = [
    ...headerElements,

    headingParagraph('Mandant', HeadingLevel.HEADING_1),
    labelValueParagraph('Unternehmen', companyProfile.companyName || '—'),
    labelValueParagraph('Branche', companyProfile.industryLabel || '—'),
    labelValueParagraph('Mitarbeitende', companyProfile.employees || '—'),
    labelValueParagraph('Standorte', companyProfile.locations || '—'),
    labelValueParagraph('Kritische Dienstleistung', companyProfile.criticalService || '—'),
    labelValueParagraph('Versorgte Personen', companyProfile.personsServed || '—'),

    headingParagraph('Gesamtabschätzung', HeadingLevel.HEADING_1),
    labelValueParagraph('Restaufwand gesamt (PT-Bandbreite)', totalPtLabel),
    ...(hasRate ? [labelValueParagraph(`Restaufwand gesamt (${CURRENCY_LABELS[consultingRate!.currency]}-Bandbreite)`, totalEuroLabel)] : []),
    labelValueParagraph(
      'Mittelwert',
      `${formatPersonDays(gapAnalysisSummary.totalPersonDays)} (Kalenderwochen: ${gapAnalysisSummary.totalPersonDays > 0 ? `${formatCalendarWeeksRange(gapAnalysisSummary.minCalendarWeeks, gapAnalysisSummary.maxCalendarWeeks)}, ein Consultant in Vollauslastung` : '0'})`,
    ),
    labelValueParagraph('Anzahl Pflichtbausteine', String(gapAnalysisSummary.entryCount)),

    headingParagraph('Restaufwand je Regime', HeadingLevel.HEADING_1),
    buildRegimeTable(gapAnalysisSummary, consultingRate),

    headingParagraph('Detail-Aufschlüsselung pro Anforderung', HeadingLevel.HEADING_1),
    bodyParagraph(
      'Pro Anforderung Tätigkeits-Tabelle mit Stunden- und Euro-Bandbreite (sofern Breakdown ausgearbeitet). Anforderungen mit reiner Heuristik-Schätzung erscheinen ohne Tätigkeits-Tabelle in der Übersicht weiter unten.',
    ),
    ...breakdownBlocks,

    headingParagraph('Übersicht aller Pflichtbausteine', HeadingLevel.HEADING_1),
    buildRequirementTable(gapAnalysisSummary, requirementLookup, consultingRate),

    headingParagraph('Heuristik (für Anforderungen ohne Breakdown)', HeadingLevel.HEADING_1),
    bodyParagraph(
      'Basis-Aufwand je Kategorie: scope/registration/governance = 2 PT, risk/plan/evidence/incident/reporting_channel/special_measures = 5 PT, measures = 10 PT.',
    ),
    bodyParagraph(
      'Gap-Faktor je Status: offen = 1,0; in Arbeit = 0,5; bereit = 0,1; nicht anwendbar = 0.',
    ),
    bodyParagraph(
      'Reduktionen: -0,1 pro primary-Mapping (max -0,3), -0,05 pro verknüpfter Evidenz (max -0,2). Mindest-Gap-Faktor 0,1 bei offenen Pflichten zur Sicherung der Integrations- und Nachweispflege.',
    ),
    bodyParagraph(
      'Domain-Score-Modulator: bei Domain-Score < 100 % aus der Grundanalyse wird der Gap-Faktor um bis zu 50 % erhöht (linearer Aufschlag). Damit haben Grundanalyse-Antworten einen sichtbaren Effekt auf den Restaufwand.',
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
