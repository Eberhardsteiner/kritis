import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GapAnalysisDashboard } from './GapAnalysisDashboard';
import type { GapAnalysisSummary, RequirementDefinition } from '../../../types';

const requirementFixture: RequirementDefinition[] = [
  {
    id: 'req-r',
    title: 'Betreiber-Risikoanalyse',
    description: '',
    guidance: '',
    lawRef: '§ 12 KRITISDachG',
    category: 'risk',
    regimeId: 'de_kritisdachg',
  },
];

const summaryFixture: GapAnalysisSummary = {
  totalPersonDays: 8.5,
  minPersonDays: 8.5,
  maxPersonDays: 8.5,
  calendarWeeks: 2,
  minCalendarWeeks: 1.7,
  maxCalendarWeeks: 1.7,
  entryCount: 1,
  byRegime: [
    {
      regimeId: 'de_kritisdachg',
      regimeLabel: 'KRITIS-DachG',
      totalPersonDays: 8.5,
      minPersonDays: 8.5,
      maxPersonDays: 8.5,
      byCategory: { risk: { minPersonDays: 8.5, maxPersonDays: 8.5, midPersonDays: 8.5 } },
      entries: [
        {
          requirementId: 'req-r',
          regimeId: 'de_kritisdachg',
          category: 'risk',
          currentStatus: 'open',
          targetStatus: 'ready',
          effortEstimate: {
            personDays: 8.5,
            confidence: 'medium',
            assumptions: ['Basis-Aufwand 5 PT (Kategorie medium)', 'Gap-Faktor 1.00 (Status: open)'],
            source: 'heuristic',
          },
          dependencies: [],
        },
      ],
    },
  ],
};

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

describe('GapAnalysisDashboard', () => {
  it('zeigt den Gesamtaufwand prominent mit Kalenderwochen', () => {
    const { container } = render(<GapAnalysisDashboard summary={summaryFixture} requirements={requirementFixture} />);
    const statValue = container.querySelector('.stat-value');
    expect(statValue?.textContent).toBe('8,5 PT');
    // C5.4.7: Kalenderwochen jetzt als Bandbreite mit einer Nachkommastelle.
    // Fixture min=max=1.7 → "1,7 Kalenderwochen".
    expect(screen.getByText(/≈ 1,7 Kalenderwochen/)).toBeInTheDocument();
  });

  it('zeigt pro Regime die PT-Summe und die Kategorien-Chips', () => {
    render(<GapAnalysisDashboard summary={summaryFixture} requirements={requirementFixture} />);
    expect(screen.getByText('KRITIS-DachG')).toBeInTheDocument();
    expect(screen.getByText(/risk: 8,5 PT/)).toBeInTheDocument();
  });

  it('rendert die Requirement-Einträge mit Confidence-Chip', () => {
    render(<GapAnalysisDashboard summary={summaryFixture} requirements={requirementFixture} />);
    expect(screen.getByText('Betreiber-Risikoanalyse')).toBeInTheDocument();
    expect(screen.getByText(/Confidence Mittel/)).toBeInTheDocument();
  });

  it('zeigt bei Klick die Annahmen der Schätzung', () => {
    render(<GapAnalysisDashboard summary={summaryFixture} requirements={requirementFixture} />);
    fireEvent.click(screen.getByRole('button', { name: /Betreiber-Risikoanalyse/ }));
    expect(screen.getByText(/Basis-Aufwand 5 PT/)).toBeInTheDocument();
    expect(screen.getByText(/Gap-Faktor 1\.00/)).toBeInTheDocument();
  });

  it('rendert im compact-Modus keine Detail-Einträge, aber die Kategorien', () => {
    render(<GapAnalysisDashboard summary={summaryFixture} requirements={requirementFixture} compact />);
    expect(screen.queryByText('Betreiber-Risikoanalyse')).toBeNull();
    expect(screen.getByText(/risk: 8,5 PT/)).toBeInTheDocument();
  });

  it('zeigt Leer-Hinweis, wenn keine Entries vorhanden sind', () => {
    render(<GapAnalysisDashboard summary={emptySummary} requirements={[]} />);
    expect(screen.getByText(/Keine Pflichten im aktuellen Mandantenbild/)).toBeInTheDocument();
    expect(screen.getByText(/Keine offenen Pflichtbausteine erkannt/)).toBeInTheDocument();
  });

  it('ruft onTriggerDocxExport beim Klick auf den Export-Button', () => {
    const onExport = vi.fn();
    render(
      <GapAnalysisDashboard
        summary={summaryFixture}
        requirements={requirementFixture}
        onTriggerDocxExport={onExport}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Angebotsgrundlage/ }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('blendet den Export-Button aus, wenn kein Handler übergeben wird', () => {
    render(<GapAnalysisDashboard summary={summaryFixture} requirements={requirementFixture} />);
    expect(screen.queryByRole('button', { name: /Angebotsgrundlage/ })).toBeNull();
  });
});

describe('GapAnalysisDashboard · Restaufwand-Tone (C5.4.7 Bug 13)', () => {
  function makeSummary(totalPt: number): GapAnalysisSummary {
    return {
      totalPersonDays: totalPt,
      minPersonDays: totalPt,
      maxPersonDays: totalPt,
      calendarWeeks: Math.ceil(totalPt / 5),
      minCalendarWeeks: totalPt > 0 ? Math.ceil((totalPt / 5) * 10) / 10 : 0,
      maxCalendarWeeks: totalPt > 0 ? Math.ceil((totalPt / 5) * 10) / 10 : 0,
      entryCount: 0,
      byRegime: [],
    };
  }

  function statCardClassNames(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll('.stat-card')).map((node) =>
      node.className.split(/\s+/).join(' '),
    );
  }

  it('Restaufwand 0 PT → good-Tone (CSS-Klasse `good`, nicht `success`)', () => {
    const { container } = render(<GapAnalysisDashboard summary={makeSummary(0)} requirements={[]} />);
    const classes = statCardClassNames(container).join(' | ');
    expect(classes).toMatch(/stat-card good/);
    expect(classes).not.toMatch(/stat-card success/);
  });

  it('Restaufwand 4 PT → good-Tone (< 1 Woche, perfekt erfüllt)', () => {
    const { container } = render(<GapAnalysisDashboard summary={makeSummary(4)} requirements={[]} />);
    const classes = statCardClassNames(container).join(' | ');
    expect(classes).toMatch(/stat-card good/);
  });

  it('Restaufwand 15 PT → info-Tone (1–4 Wochen, mid-tier)', () => {
    const { container } = render(<GapAnalysisDashboard summary={makeSummary(15)} requirements={[]} />);
    const classes = statCardClassNames(container).join(' | ');
    expect(classes).toMatch(/stat-card info/);
    expect(classes).not.toMatch(/stat-card warn/);
  });

  it('Restaufwand 50 PT → warn-Tone (> 4 Wochen, gelb)', () => {
    const { container } = render(<GapAnalysisDashboard summary={makeSummary(50)} requirements={[]} />);
    const classes = statCardClassNames(container).join(' | ');
    expect(classes).toMatch(/stat-card warn/);
    expect(classes).not.toMatch(/stat-card info/);
  });

  it('Schwelle: 5 PT → info-Tone (Übergang von good zu info)', () => {
    const { container } = render(<GapAnalysisDashboard summary={makeSummary(5)} requirements={[]} />);
    const classes = statCardClassNames(container).join(' | ');
    expect(classes).toMatch(/stat-card info/);
  });

  it('Schwelle: 20 PT → warn-Tone (Übergang von info zu warn)', () => {
    const { container } = render(<GapAnalysisDashboard summary={makeSummary(20)} requirements={[]} />);
    const classes = statCardClassNames(container).join(' | ');
    expect(classes).toMatch(/stat-card warn/);
  });
});

describe('GapAnalysisDashboard · Aktivitäts-Tabelle Brutto/Rest (C5.4.4)', () => {
  // Eigenes Fixture mit `breakdown`-Source und `resolvedActivities`,
  // damit die Tabellen-Spalten gerendert werden. Status `ready`,
  // damit Brutto und Effective sich um Faktor 10 unterscheiden —
  // Dr. Steiners Original-Bug.
  const breakdownRequirementFixture: RequirementDefinition[] = [
    {
      id: 'req-laenderoeffnung',
      title: 'Länderöffnungsklausel geprüft',
      description: '',
      guidance: '',
      lawRef: '§ 14 KRITISDachG',
      category: 'governance',
      regimeId: 'de_kritisdachg',
    },
  ];

  const breakdownSummaryFixture: GapAnalysisSummary = {
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
            requirementId: 'req-laenderoeffnung',
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
                { label: 'Stakeholder-Abstimmung', minHours: 2, maxHours: 4 },
                { label: 'Dokumentation', minHours: 2, maxHours: 4 },
              ],
              resolvedActivities: [
                { label: 'Recherche', minHoursRaw: 4, maxHoursRaw: 6, minHoursEffective: 0.4, maxHoursEffective: 0.6 },
                { label: 'Bewertung', minHoursRaw: 4, maxHoursRaw: 6, minHoursEffective: 0.4, maxHoursEffective: 0.6 },
                { label: 'Stakeholder-Abstimmung', minHoursRaw: 2, maxHoursRaw: 4, minHoursEffective: 0.2, maxHoursEffective: 0.4 },
                { label: 'Dokumentation', minHoursRaw: 2, maxHoursRaw: 4, minHoursEffective: 0.2, maxHoursEffective: 0.4 },
              ],
              drivers: ['Anzahl Bundesländer'],
            },
            dependencies: [],
          },
        ],
      },
    ],
  };

  it('zeigt zwei Spalten-Gruppen "Brutto-Aufwand" und "Restaufwand bei aktuellem Status"', () => {
    render(<GapAnalysisDashboard summary={breakdownSummaryFixture} requirements={breakdownRequirementFixture} />);
    fireEvent.click(screen.getByRole('button', { name: /Länderöffnungsklausel/ }));
    expect(screen.getByText('Brutto-Aufwand')).toBeInTheDocument();
    expect(screen.getByText('Restaufwand bei aktuellem Status')).toBeInTheDocument();
  });

  it('rendert sowohl Brutto- als auch Effective-Stunden in der Tabelle', () => {
    render(<GapAnalysisDashboard summary={breakdownSummaryFixture} requirements={breakdownRequirementFixture} />);
    fireEvent.click(screen.getByRole('button', { name: /Länderöffnungsklausel/ }));
    // Brutto: zwei Aktivitäten mit 4 – 6 h, zwei mit 2 – 4 h.
    expect(screen.getAllByText(/4 – 6 h/)).toHaveLength(2);
    expect(screen.getAllByText(/2 – 4 h/)).toHaveLength(2);
    // Effective bei Status ready: 10 % davon, also 0,4 – 0,6 h und 0,2 – 0,4 h.
    expect(screen.getAllByText(/0,4 – 0,6 h/)).toHaveLength(2);
    expect(screen.getAllByText(/0,2 – 0,4 h/)).toHaveLength(2);
  });

  it('zeigt status-spezifischen Restaufwand-Hinweis (10 % Pflege-Aufwand bei Status ready)', () => {
    render(<GapAnalysisDashboard summary={breakdownSummaryFixture} requirements={breakdownRequirementFixture} />);
    fireEvent.click(screen.getByRole('button', { name: /Länderöffnungsklausel/ }));
    expect(screen.getByText(/10 % Pflege-Aufwand/)).toBeInTheDocument();
    expect(screen.getByText(/Summe der Restaufwand-Spalte stimmt mit dem Anforderungs-Header überein/)).toBeInTheDocument();
  });
});
