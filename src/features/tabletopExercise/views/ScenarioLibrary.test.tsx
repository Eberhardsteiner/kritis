import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScenarioLibrary } from './ScenarioLibrary';
import type { Scenario } from '../types';

function makeScenario(overrides: Partial<Scenario>): Scenario {
  return {
    id: 's-1',
    version: '1.0.0',
    title: 'Testszenario',
    summary: 'Kurzer Test.',
    sectors: ['Energie'],
    applicableRegimes: ['de_kritisdachg'],
    durationMinutes: 60,
    roles: [{ id: 'r', title: 'R', briefing: '' }],
    timeline: [
      {
        t: 0,
        phase: 'discovery',
        injects: [],
        decisions: [
          { id: 'd', question: 'q', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
        ],
      },
    ],
    evaluationCriteria: [{ id: 'c', description: 'c', weight: 1 }],
    ...overrides,
  };
}

describe('ScenarioLibrary · Darstellung', () => {
  it('zeigt Stammlisten-Szenarien und den Import-Hinweis bei leerer Mandanten-Liste', () => {
    const builtIns = [makeScenario({ id: 'b-1', title: 'Cyber-Szenario' })];
    render(
      <ScenarioLibrary
        builtInScenarios={builtIns}
        importedScenarios={[]}
        onStartExercise={() => {}}
        canEdit
      />,
    );
    expect(screen.getByText('Cyber-Szenario')).toBeInTheDocument();
    expect(screen.getByText(/Noch keine mandantenspezifischen Szenarien importiert/)).toBeInTheDocument();
  });

  it('zeigt importierte Szenarien mit "Importiert"-Chip', () => {
    const imported = [makeScenario({ id: 'i-1', title: 'Eigenes Szenario' })];
    render(
      <ScenarioLibrary
        builtInScenarios={[]}
        importedScenarios={imported}
        onStartExercise={() => {}}
        canEdit
      />,
    );
    expect(screen.getByText('Eigenes Szenario')).toBeInTheDocument();
    expect(screen.getByText('Importiert')).toBeInTheDocument();
  });

  it('markiert das aktuell laufende Szenario mit "Läuft gerade" und deaktiviert Start', () => {
    const scenario = makeScenario({ id: 's-run', title: 'Laufend' });
    render(
      <ScenarioLibrary
        builtInScenarios={[scenario]}
        importedScenarios={[]}
        activeSessionScenarioId="s-run"
        onStartExercise={() => {}}
        canEdit
      />,
    );
    expect(screen.getByText('Läuft gerade')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Übung läuft/ })).toBeDisabled();
  });
});

describe('ScenarioLibrary · Aktionen', () => {
  it('ruft onStartExercise mit dem ausgewählten Szenario auf', () => {
    const scenario = makeScenario({ id: 's-start', title: 'Starten' });
    const onStart = vi.fn();
    render(
      <ScenarioLibrary
        builtInScenarios={[scenario]}
        importedScenarios={[]}
        onStartExercise={onStart}
        canEdit
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Übung starten/ }));
    expect(onStart).toHaveBeenCalledWith(scenario);
  });

  it('ruft onRemoveImported nur bei importierten Szenarien', () => {
    const imported = [makeScenario({ id: 'rm', title: 'Zu löschen' })];
    const onRemove = vi.fn();
    render(
      <ScenarioLibrary
        builtInScenarios={[]}
        importedScenarios={imported}
        onStartExercise={() => {}}
        onRemoveImported={onRemove}
        canEdit
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Importiertes Szenario "Zu löschen" entfernen/ }));
    expect(onRemove).toHaveBeenCalledWith('rm');
  });

  it('deaktiviert Start-Buttons, wenn canEdit=false', () => {
    const scenario = makeScenario({ id: 's-ro', title: 'Read-Only' });
    render(
      <ScenarioLibrary
        builtInScenarios={[scenario]}
        importedScenarios={[]}
        onStartExercise={() => {}}
        canEdit={false}
      />,
    );
    expect(screen.getByRole('button', { name: /Übung starten/ })).toBeDisabled();
  });
});

describe('ScenarioLibrary · JSON-Import', () => {
  function makeFile(content: string, name = 'scenario.json'): File {
    return new File([content], name, { type: 'application/json' });
  }

  it('importiert ein gültiges Szenario und ruft onImportScenario auf', async () => {
    const onImport = vi.fn();
    render(
      <ScenarioLibrary
        builtInScenarios={[]}
        importedScenarios={[]}
        onStartExercise={() => {}}
        onImportScenario={onImport}
        canEdit
      />,
    );
    const valid = makeScenario({ id: 'imp', title: 'Importiert' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [makeFile(JSON.stringify(valid))] });
    fireEvent.change(input);
    await vi.waitFor(() => expect(onImport).toHaveBeenCalled(), { timeout: 2000 });
    expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ id: 'imp' }));
  });

  it('meldet Fehler bei unbekannter ScenarioPhase und ruft onImportScenario NICHT auf', async () => {
    const onImport = vi.fn();
    render(
      <ScenarioLibrary
        builtInScenarios={[]}
        importedScenarios={[]}
        onStartExercise={() => {}}
        onImportScenario={onImport}
        canEdit
      />,
    );
    const broken = { ...makeScenario({}), timeline: [{ t: 0, phase: 'phantom', injects: [], decisions: [] }] };
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File([JSON.stringify(broken)], 's.json')] });
    fireEvent.change(input);
    await vi.waitFor(() => expect(screen.queryByText(/Import fehlgeschlagen/)).toBeInTheDocument(), {
      timeout: 2000,
    });
    expect(onImport).not.toHaveBeenCalled();
  });

  it('meldet Fehler bei kaputtem JSON', async () => {
    const onImport = vi.fn();
    render(
      <ScenarioLibrary
        builtInScenarios={[]}
        importedScenarios={[]}
        onStartExercise={() => {}}
        onImportScenario={onImport}
        canEdit
      />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File(['{nicht-json'], 's.json')] });
    fireEvent.change(input);
    await vi.waitFor(
      () => expect(screen.queryByText(/JSON konnte nicht gelesen werden/)).toBeInTheDocument(),
      { timeout: 2000 },
    );
    expect(onImport).not.toHaveBeenCalled();
  });
});
