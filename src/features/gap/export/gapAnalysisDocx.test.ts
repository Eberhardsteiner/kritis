import { describe, expect, it } from 'vitest';
import { Packer } from 'docx';
import {
  buildGapAnalysisBlob,
  buildGapAnalysisDocument,
  buildGapAnalysisFileName,
} from './gapAnalysisDocx';
import type { CompanyProfile, GapAnalysisSummary, RequirementDefinition } from '../../../types';

const companyProfile: CompanyProfile = {
  companyName: 'Demo-Unternehmen',
  industryLabel: 'Produktion',
  employees: '250',
  locations: '3',
  criticalService: 'Notfallversorgung',
  personsServed: '750000',
};

const requirements: RequirementDefinition[] = [
  {
    id: 'de_kritis_risk_assessment',
    title: 'Betreiber-Risikoanalyse',
    description: '',
    guidance: '',
    lawRef: '§ 12 KRITISDachG',
    regimeId: 'de_kritisdachg',
    category: 'risk',
  },
];

const summary: GapAnalysisSummary = {
  totalPersonDays: 12.5,
  minPersonDays: 12.5,
  maxPersonDays: 12.5,
  calendarWeeks: 3,
  minCalendarWeeks: 2.5,
  maxCalendarWeeks: 2.5,
  entryCount: 1,
  byRegime: [
    {
      regimeId: 'de_kritisdachg',
      regimeLabel: 'KRITIS-DachG',
      totalPersonDays: 12.5,
      minPersonDays: 12.5,
      maxPersonDays: 12.5,
      byCategory: { risk: { minPersonDays: 12.5, maxPersonDays: 12.5, midPersonDays: 12.5 } },
      entries: [
        {
          requirementId: 'de_kritis_risk_assessment',
          regimeId: 'de_kritisdachg',
          category: 'risk',
          currentStatus: 'open',
          targetStatus: 'ready',
          effortEstimate: {
            personDays: 12.5,
            confidence: 'medium',
            assumptions: ['Basis-Aufwand 5 PT', 'Gap-Faktor 1'],
            source: 'heuristic',
          },
          dependencies: [],
        },
      ],
    },
  ],
};

describe('buildGapAnalysisDocument', () => {
  it('erstellt ein Document-Objekt, das sich in einen Buffer serialisieren lässt', async () => {
    const document = buildGapAnalysisDocument({
      companyProfile,
      gapAnalysisSummary: summary,
      requirements,
      generatedAt: new Date('2026-04-20T10:00:00Z'),
    });
    const buffer = await Packer.toBuffer(document);
    expect(buffer.byteLength).toBeGreaterThan(1000);
    // ZIP magic number PK (0x50 0x4B) — DOCX ist ein ZIP
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it('produziert einen DOCX-Buffer plausibler Groesse fuer einen realistischen Mandanten', async () => {
    const document = buildGapAnalysisDocument({
      companyProfile,
      gapAnalysisSummary: summary,
      requirements,
    });
    const buffer = await Packer.toBuffer(document);
    // Realistischer DOCX-Buffer hat > 2 kB (ZIP-Overhead + Content)
    expect(buffer.byteLength).toBeGreaterThan(2000);
  });

  it('funktioniert bei leerer Zusammenfassung ohne Zeilen', async () => {
    const emptySummary: GapAnalysisSummary = {
      totalPersonDays: 0,
      minPersonDays: 0,
      maxPersonDays: 0,
      calendarWeeks: 0,
      minCalendarWeeks: 0,
      maxCalendarWeeks: 0,
      entryCount: 0,
      byRegime: [],
    };
    const document = buildGapAnalysisDocument({
      companyProfile,
      gapAnalysisSummary: emptySummary,
      requirements: [],
    });
    const buffer = await Packer.toBuffer(document);
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});

describe('buildGapAnalysisBlob', () => {
  it('liefert einen Blob mit korrektem MIME-Typ für DOCX', async () => {
    const blob = await buildGapAnalysisBlob({
      companyProfile,
      gapAnalysisSummary: summary,
      requirements,
    });
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toContain('wordprocessingml.document');
  });
});

describe('buildGapAnalysisDocument · Tätigkeits-Tabelle Brutto/Rest (C5.4.4)', () => {
  const breakdownSummary: GapAnalysisSummary = {
    totalPersonDays: 0.2,
    minPersonDays: 0.15,
    maxPersonDays: 0.25,
    calendarWeeks: 1,
    minCalendarWeeks: 0.1,
    maxCalendarWeeks: 0.1,
    entryCount: 1,
    byRegime: [
      {
        regimeId: 'de_kritisdachg',
        regimeLabel: 'KRITIS-DachG',
        totalPersonDays: 0.2,
        minPersonDays: 0.15,
        maxPersonDays: 0.25,
        byCategory: { governance: { minPersonDays: 0.15, maxPersonDays: 0.25, midPersonDays: 0.2 } },
        entries: [
          {
            requirementId: 'de_kritis_laenderoeffnung',
            regimeId: 'de_kritisdachg',
            category: 'governance',
            currentStatus: 'ready',
            targetStatus: 'ready',
            effortEstimate: {
              personDays: 0.2,
              minPersonDays: 0.15,
              maxPersonDays: 0.25,
              confidence: 'high',
              assumptions: ['Breakdown 1.5 – 2.5 PT'],
              source: 'breakdown',
              activities: [
                { label: 'Recherche', minHours: 4, maxHours: 6 },
                { label: 'Bewertung', minHours: 4, maxHours: 6 },
              ],
              resolvedActivities: [
                { label: 'Recherche', minHoursRaw: 4, maxHoursRaw: 6, minHoursEffective: 0.4, maxHoursEffective: 0.6 },
                { label: 'Bewertung', minHoursRaw: 4, maxHoursRaw: 6, minHoursEffective: 0.4, maxHoursEffective: 0.6 },
              ],
              drivers: ['Anzahl Bundesländer'],
            },
            dependencies: [],
          },
        ],
      },
    ],
  };

  const breakdownRequirements: RequirementDefinition[] = [
    {
      id: 'de_kritis_laenderoeffnung',
      title: 'Länderöffnungsklausel geprüft',
      description: '',
      guidance: '',
      lawRef: '§ 14 KRITISDachG',
      regimeId: 'de_kritisdachg',
      category: 'governance',
    },
  ];

  it('serialisiert ohne Fehler, wenn entries resolvedActivities haben', async () => {
    const document = buildGapAnalysisDocument({
      companyProfile,
      gapAnalysisSummary: breakdownSummary,
      requirements: breakdownRequirements,
    });
    const buffer = await Packer.toBuffer(document);
    expect(buffer.byteLength).toBeGreaterThan(2000);
  });

  it('erzeugt einen größeren Buffer mit Aktivitäten als ohne — Tabelle wird tatsächlich gerendert', async () => {
    const withActivities = await Packer.toBuffer(
      buildGapAnalysisDocument({
        companyProfile,
        gapAnalysisSummary: breakdownSummary,
        requirements: breakdownRequirements,
      }),
    );
    const summaryWithoutActivities: GapAnalysisSummary = {
      ...breakdownSummary,
      byRegime: [
        {
          ...breakdownSummary.byRegime[0],
          entries: [
            {
              ...breakdownSummary.byRegime[0].entries[0],
              effortEstimate: {
                ...breakdownSummary.byRegime[0].entries[0].effortEstimate,
                activities: [],
                resolvedActivities: [],
              },
            },
          ],
        },
      ],
    };
    const withoutActivities = await Packer.toBuffer(
      buildGapAnalysisDocument({
        companyProfile,
        gapAnalysisSummary: summaryWithoutActivities,
        requirements: breakdownRequirements,
      }),
    );
    expect(withActivities.byteLength).toBeGreaterThan(withoutActivities.byteLength);
  });
});

describe('buildGapAnalysisFileName', () => {
  it('baut einen konsistenten, filesystem-sicheren Dateinamen', () => {
    const name = buildGapAnalysisFileName(companyProfile, new Date('2026-04-20T10:00:00Z'));
    expect(name).toBe('Angebotsgrundlage-demo-unternehmen-2026-04-20.docx');
  });

  it('fällt zurück auf "mandant", wenn der Firmenname leer oder nicht-sanierbar ist', () => {
    const emptyProfile: CompanyProfile = { ...companyProfile, companyName: '' };
    const name = buildGapAnalysisFileName(emptyProfile, new Date('2026-04-20T10:00:00Z'));
    expect(name).toBe('Angebotsgrundlage-mandant-2026-04-20.docx');
  });

  it('entfernt nicht-ASCII-Zeichen und Mehrfach-Bindestriche', () => {
    const messyProfile: CompanyProfile = { ...companyProfile, companyName: 'Stadtwerke Müller & Söhne GmbH' };
    const name = buildGapAnalysisFileName(messyProfile, new Date('2026-04-20T10:00:00Z'));
    expect(name).toMatch(/^Angebotsgrundlage-stadtwerke-m-ller-s-hne-gmbh-2026-04-20\.docx$/);
  });
});
