import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RiskMatrixView } from './RiskMatrixView';
import type { RiskEntry } from '../types';

function makeEntry(overrides: Partial<RiskEntry>): RiskEntry {
  return {
    id: 'r',
    categoryId: 'nature',
    subCategoryId: 'flooding',
    titel: 'Hochwasser West',
    beschreibung: '',
    eintrittswahrscheinlichkeit: 3,
    auswirkung: 4,
    affectedAssetIds: [],
    affectedProcessIds: [],
    affectedInterdependencies: [],
    mitigationMeasureIds: [],
    residualRisk: 2,
    reviewDate: '',
    owner: 'BCM',
    ...overrides,
  };
}

describe('RiskMatrixView', () => {
  it('rendert 25 Matrixzellen mit Achsen-Beschriftungen', () => {
    render(<RiskMatrixView entries={[]} />);
    // 25 cells = 25 buttons
    const cells = screen.getAllByRole('button');
    expect(cells.length).toBe(25);
    expect(screen.getByText(/Auswirkung 1/)).toBeInTheDocument();
    expect(screen.getByText(/Auswirkung 5/)).toBeInTheDocument();
    expect(screen.getByText(/Eintritt 1/)).toBeInTheDocument();
    expect(screen.getByText(/Eintritt 5/)).toBeInTheDocument();
  });

  it('zeigt die Gesamtanzahl der Risiken im Header-Chip', () => {
    const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' }), makeEntry({ id: 'c' })];
    render(<RiskMatrixView entries={entries} />);
    expect(screen.getByText(/3 Risiken/)).toBeInTheDocument();
  });

  it('zählt Einträge in der richtigen Zelle', () => {
    const entries = [
      makeEntry({ id: 'a', eintrittswahrscheinlichkeit: 3, auswirkung: 4 }),
      makeEntry({ id: 'b', eintrittswahrscheinlichkeit: 3, auswirkung: 4 }),
    ];
    render(<RiskMatrixView entries={entries} />);
    const targetCell = screen.getByLabelText(/Eintritt 3 Auswirkung 4.*2 Risiken/);
    expect(within(targetCell).getByText('2')).toBeInTheDocument();
  });

  it('zeigt die Detail-Liste nach Klick auf eine Zelle', () => {
    const entries = [
      makeEntry({ id: 'a', eintrittswahrscheinlichkeit: 5, auswirkung: 5, titel: 'Großbrand im Rechenzentrum' }),
    ];
    render(<RiskMatrixView entries={entries} />);
    const cell = screen.getByLabelText(/Eintritt 5 Auswirkung 5/);
    fireEvent.click(cell);
    expect(screen.getByText(/Zelle: Eintritt 5 · Auswirkung 5/)).toBeInTheDocument();
    expect(screen.getByText('Großbrand im Rechenzentrum')).toBeInTheDocument();
    expect(screen.getByText(/Sofort handeln · Score 25/)).toBeInTheDocument();
  });

  it('ruft onEntryClick auf, wenn ein Detaileintrag angeklickt wird', () => {
    const onEntryClick = vi.fn();
    const entry = makeEntry({ id: 'x', eintrittswahrscheinlichkeit: 1, auswirkung: 1, titel: 'Frost' });
    render(<RiskMatrixView entries={[entry]} onEntryClick={onEntryClick} />);
    fireEvent.click(screen.getByLabelText(/Eintritt 1 Auswirkung 1/));
    fireEvent.click(screen.getByRole('button', { name: /Frost/ }));
    expect(onEntryClick).toHaveBeenCalledWith(entry);
  });

  it('zeigt Restrisiko-Modus im Titel, wenn useResidual gesetzt ist', () => {
    render(<RiskMatrixView entries={[]} useResidual />);
    expect(screen.getByText('Restrisikobild nach Maßnahmen')).toBeInTheDocument();
  });

  it('zeigt bei leerer Zelle einen muted-Hinweis', () => {
    render(<RiskMatrixView entries={[]} />);
    fireEvent.click(screen.getByLabelText(/Eintritt 3 Auswirkung 3/));
    expect(screen.getByText('Keine Risiken in dieser Zelle erfasst.')).toBeInTheDocument();
  });
});
