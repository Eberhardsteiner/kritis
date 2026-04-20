import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RiskRegisterView } from './RiskRegisterView';
import type { RiskEntry } from '../types';

function makeEntry(overrides: Partial<RiskEntry>): RiskEntry {
  return {
    id: 'r',
    categoryId: 'nature',
    subCategoryId: 'flooding',
    titel: 'Test-Risiko',
    beschreibung: '',
    eintrittswahrscheinlichkeit: 3,
    auswirkung: 3,
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

describe('RiskRegisterView', () => {
  it('zeigt Leer-Hinweis, wenn keine Risiken erfasst sind', () => {
    render(<RiskRegisterView entries={[]} />);
    expect(screen.getByText(/Noch keine Risiken erfasst/)).toBeInTheDocument();
  });

  it('rendert jede Zeile mit Initial- und Restrisiko-Chip', () => {
    const entries = [
      makeEntry({ id: 'a', titel: 'Hochwasser', eintrittswahrscheinlichkeit: 5, auswirkung: 5, residualRisk: 3 }),
    ];
    render(<RiskRegisterView entries={entries} />);
    expect(screen.getByText('Hochwasser')).toBeInTheDocument();
    expect(screen.getByText(/Sofort handeln · Score 25/)).toBeInTheDocument();
    expect(screen.getByText(/Rest: Handeln · Score 15/)).toBeInTheDocument();
  });

  it('sortiert nach Score absteigend (Default) und aufsteigend', () => {
    const entries = [
      makeEntry({ id: 'low', titel: 'A', eintrittswahrscheinlichkeit: 1, auswirkung: 1 }),
      makeEntry({ id: 'high', titel: 'B', eintrittswahrscheinlichkeit: 5, auswirkung: 5 }),
      makeEntry({ id: 'mid', titel: 'C', eintrittswahrscheinlichkeit: 3, auswirkung: 3 }),
    ];
    render(<RiskRegisterView entries={entries} />);
    const titlesDesc = screen.getAllByRole('article').map((article) => article.querySelector('strong')?.textContent);
    expect(titlesDesc).toEqual(['B', 'C', 'A']);

    fireEvent.change(screen.getByRole('combobox', { name: 'Sortierung' }), {
      target: { value: 'score_asc' },
    });
    const titlesAsc = screen.getAllByRole('article').map((article) => article.querySelector('strong')?.textContent);
    expect(titlesAsc).toEqual(['A', 'C', 'B']);
  });

  it('filtert nach Kategorie', () => {
    const entries = [
      makeEntry({ id: 'a', categoryId: 'nature', subCategoryId: 'flooding', titel: 'Nature-A' }),
      makeEntry({ id: 'b', categoryId: 'technical', subCategoryId: 'power_outage', titel: 'Tech-B' }),
    ];
    render(<RiskRegisterView entries={entries} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter Kategorie' }), {
      target: { value: 'technical' },
    });
    expect(screen.queryByText('Nature-A')).toBeNull();
    expect(screen.getByText('Tech-B')).toBeInTheDocument();
  });

  it('filtert nach Kritikalität', () => {
    const entries = [
      makeEntry({ id: 'a', titel: 'Low', eintrittswahrscheinlichkeit: 1, auswirkung: 1 }),
      makeEntry({ id: 'b', titel: 'High', eintrittswahrscheinlichkeit: 5, auswirkung: 5 }),
    ];
    render(<RiskRegisterView entries={entries} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter Kritikalität' }), {
      target: { value: 'sofort' },
    });
    expect(screen.queryByText('Low')).toBeNull();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('zeigt Hinweis, wenn Filter alle Einträge aussieben', () => {
    const entries = [makeEntry({ id: 'a', titel: 'Nur akzeptabel', eintrittswahrscheinlichkeit: 1, auswirkung: 1 })];
    render(<RiskRegisterView entries={entries} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter Kritikalität' }), {
      target: { value: 'sofort' },
    });
    expect(screen.getByText(/Kein Risiko passt zu den aktiven Filtern/)).toBeInTheDocument();
  });

  it('ruft onEdit, onDelete, onAdd und Export-Callbacks auf', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onAdd = vi.fn();
    const onExportJson = vi.fn();
    const onExportDocx = vi.fn();
    const entries = [makeEntry({ id: 'a', titel: 'Testrisiko' })];
    render(
      <RiskRegisterView
        entries={entries}
        onEdit={onEdit}
        onDelete={onDelete}
        onAdd={onAdd}
        onExportJson={onExportJson}
        onExportDocx={onExportDocx}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Risiko "Testrisiko" bearbeiten/ }));
    fireEvent.click(screen.getByRole('button', { name: /Risiko "Testrisiko" löschen/ }));
    fireEvent.click(screen.getByRole('button', { name: /Neues Risiko/ }));
    fireEvent.click(screen.getByRole('button', { name: /§ 12-DOCX/ }));
    fireEvent.click(screen.getByRole('button', { name: /^JSON$/i }));
    expect(onEdit).toHaveBeenCalledWith(entries[0]);
    expect(onDelete).toHaveBeenCalledWith(entries[0]);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onExportJson).toHaveBeenCalledTimes(1);
    expect(onExportDocx).toHaveBeenCalledTimes(1);
  });
});
