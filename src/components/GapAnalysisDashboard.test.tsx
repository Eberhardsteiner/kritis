import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GapAnalysisDashboard } from './GapAnalysisDashboard';
import type { GapAnalysisSummary, RequirementDefinition } from '../types';

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
  calendarWeeks: 2,
  entryCount: 1,
  byRegime: [
    {
      regimeId: 'de_kritisdachg',
      regimeLabel: 'KRITIS-DachG',
      totalPersonDays: 8.5,
      byCategory: { risk: 8.5 },
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
          },
          dependencies: [],
        },
      ],
    },
  ],
};

const emptySummary: GapAnalysisSummary = {
  totalPersonDays: 0,
  calendarWeeks: 0,
  entryCount: 0,
  byRegime: [],
};

describe('GapAnalysisDashboard', () => {
  it('zeigt den Gesamtaufwand prominent mit Kalenderwochen', () => {
    const { container } = render(<GapAnalysisDashboard summary={summaryFixture} requirements={requirementFixture} />);
    const statValue = container.querySelector('.stat-value');
    expect(statValue?.textContent).toBe('8,5 PT');
    expect(screen.getByText(/≈ 2 Kalenderwochen/)).toBeInTheDocument();
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
