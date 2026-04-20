import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RiskEntryForm } from './RiskEntryForm';

describe('RiskEntryForm', () => {
  it('zeigt Taxonomie-Kategorien und Unterkategorien gemäß Auswahl', () => {
    render(<RiskEntryForm onSubmit={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Kategorie' })).toBeInTheDocument();
    const initialOptions = screen.getAllByRole('option').map((option) => (option as HTMLOptionElement).value);
    expect(initialOptions).toContain('nature');
    expect(initialOptions).toContain('flooding');
  });

  it('aktualisiert die Unterkategorie-Auswahl, wenn die Hauptkategorie geändert wird', () => {
    render(<RiskEntryForm onSubmit={() => {}} />);
    const categorySelect = screen.getByRole('combobox', { name: 'Kategorie' }) as HTMLSelectElement;
    fireEvent.change(categorySelect, { target: { value: 'technical' } });
    const subSelect = screen.getByRole('combobox', { name: 'Unterkategorie' }) as HTMLSelectElement;
    expect(subSelect.value).toBe('power_outage');
  });

  it('berechnet Score und Kritikalität live aus der Eingabe', () => {
    render(<RiskEntryForm onSubmit={() => {}} />);
    // Default: 3 × 3 = 9 → beobachten; residualRisk 2, 3 × 2 = 6 → beobachten
    expect(screen.getByText(/Score initial 9/)).toBeInTheDocument();
    expect(screen.getByText(/Score Restrisiko 6/)).toBeInTheDocument();
    expect(screen.getByText(/Initialbewertung:/).textContent).toContain('Beobachten');
  });

  it('deaktiviert Submit, wenn kein Titel eingegeben ist', () => {
    render(<RiskEntryForm onSubmit={() => {}} />);
    const submit = screen.getByRole('button', { name: /Risiko speichern/ });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/Titel erforderlich/)).toBeInTheDocument();
  });

  it('ruft onSubmit mit dem kompletten RiskEntry auf', () => {
    const onSubmit = vi.fn();
    render(<RiskEntryForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Titel' }), {
      target: { value: 'Hochwasser West' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Risiko speichern/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.titel).toBe('Hochwasser West');
    expect(submitted.categoryId).toBe('nature');
    expect(submitted.subCategoryId).toBe('flooding');
    expect(submitted.eintrittswahrscheinlichkeit).toBe(3);
    expect(submitted.auswirkung).toBe(3);
    expect(submitted.id).toMatch(/^risk-/);
  });

  it('ruft onCancel auf, wenn der Abbrechen-Button geklickt wird', () => {
    const onCancel = vi.fn();
    render(<RiskEntryForm onSubmit={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('rendert Initialwerte, wenn `initial` übergeben wird', () => {
    render(
      <RiskEntryForm
        initial={{
          id: 'existing-1',
          categoryId: 'technical',
          subCategoryId: 'power_outage',
          titel: 'Stromausfall Werk Süd',
          eintrittswahrscheinlichkeit: 4,
          auswirkung: 5,
          residualRisk: 3,
          owner: 'Facility Mgmt',
        }}
        onSubmit={() => {}}
      />,
    );
    expect((screen.getByRole('textbox', { name: 'Titel' }) as HTMLInputElement).value).toBe('Stromausfall Werk Süd');
    expect(screen.getByText(/Score initial 20/)).toBeInTheDocument();
    expect(screen.getByText(/Score Restrisiko 12/)).toBeInTheDocument();
  });
});
