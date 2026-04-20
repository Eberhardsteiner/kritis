import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResiliencePlanEditor } from './ResiliencePlanEditor';
import { buildEmptyPlanContent } from '../template';
import type { ResiliencePlan } from '../types';

function makePlan(overrides: Partial<ResiliencePlan> = {}): ResiliencePlan {
  return {
    id: 'plan-1',
    tenantId: 'demo',
    version: '1.0.0',
    status: 'draft',
    createdAt: '2026-04-20T10:00:00Z',
    updatedAt: '2026-04-20T10:00:00Z',
    content: buildEmptyPlanContent(),
    ...overrides,
  };
}

describe('ResiliencePlanEditor · Tabs und Abschnitte', () => {
  it('zeigt Tab-Labels für alle sechs Abschnitte', () => {
    render(<ResiliencePlanEditor plan={makePlan()} onSave={() => {}} />);
    expect(screen.getByRole('tab', { name: /1\. Einleitung/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /2\. Risikobasis/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /3\. Resilienzziele/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /4\. Verantwortlichkeiten/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /5\. Meldewesen/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /6\. Nachweise/ })).toBeInTheDocument();
  });

  it('startet mit dem Scope-Tab aktiv', () => {
    render(<ResiliencePlanEditor plan={makePlan()} onSave={() => {}} />);
    expect(screen.getByRole('tab', { name: /1\. Einleitung/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('textbox', { name: /Betreiber$/ })).toBeInTheDocument();
  });

  it('wechselt auf den Governance-Tab beim Klick', () => {
    render(<ResiliencePlanEditor plan={makePlan()} onSave={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: /4\. Verantwortlichkeiten/ }));
    expect(screen.getByRole('textbox', { name: /Geschäftsleitung/ })).toBeInTheDocument();
  });
});

describe('ResiliencePlanEditor · Eingaben und Validierung', () => {
  it('aktualisiert Felder im Entwurf ohne onSave auszulösen', () => {
    render(<ResiliencePlanEditor plan={makePlan()} onSave={() => {}} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Betreiber$/ }), {
      target: { value: 'Stadtwerke Musterheim' },
    });
    expect((screen.getByRole('textbox', { name: /Betreiber$/ }) as HTMLInputElement).value).toBe(
      'Stadtwerke Musterheim',
    );
  });

  it('markiert fehlende Pflichtfelder über den Validator', () => {
    render(<ResiliencePlanEditor plan={makePlan()} onSave={() => {}} />);
    // Template ist leer → Betreiber, kritische Dienstleistung, Governance- und Meldekontakt fehlen
    expect(screen.getByText(/4 Fehler/)).toBeInTheDocument();
  });

  it('meldet Pflichtfelder vollständig, sobald alle Error-Felder gesetzt sind', () => {
    const plan = makePlan();
    plan.content.scope.operatorName = 'X';
    plan.content.scope.criticalService = 'Y';
    plan.content.governance.managementBoardContact = 'CEO';
    plan.content.reporting.incidentContact = '+49';
    render(<ResiliencePlanEditor plan={plan} onSave={() => {}} />);
    expect(screen.getByText(/Pflichtfelder vollständig/)).toBeInTheDocument();
  });
});

describe('ResiliencePlanEditor · Maßnahmen-Pflege', () => {
  it('fügt eine neue Maßnahme zu "Verhindern" hinzu', () => {
    render(<ResiliencePlanEditor plan={makePlan()} onSave={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: /3\. Resilienzziele/ }));
    const preventCard = screen.getByText('Verhindern').closest('article');
    expect(preventCard).not.toBeNull();
    const addBtn = preventCard!.querySelector('button[type="button"]');
    fireEvent.click(addBtn!);
    expect(screen.getAllByRole('textbox', { name: 'Titel' }).length).toBeGreaterThan(0);
  });

  it('löscht eine Maßnahme per Entfernen-Button', () => {
    const plan = makePlan();
    plan.content.measuresByGoal.respond = [
      {
        id: 'm1',
        title: 'Playbook aktualisieren',
        description: '',
        goal: 'respond',
        owner: '',
        dueDate: '',
        status: 'planned',
      },
    ];
    render(<ResiliencePlanEditor plan={plan} onSave={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: /3\. Resilienzziele/ }));
    expect(screen.getByRole('textbox', { name: /^Titel$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Maßnahme "Playbook aktualisieren" entfernen/ }));
    expect(screen.queryByRole('textbox', { name: /^Titel$/ })).toBeNull();
  });
});

describe('ResiliencePlanEditor · Speichern und Abbrechen', () => {
  it('ruft onSave mit updatedAt-Aktualisierung auf', () => {
    const onSave = vi.fn();
    const plan = makePlan();
    plan.content.scope.operatorName = 'X';
    plan.content.scope.criticalService = 'Y';
    plan.content.governance.managementBoardContact = 'CEO';
    plan.content.reporting.incidentContact = '+49';
    render(<ResiliencePlanEditor plan={plan} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /Plan speichern/ }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const submitted = onSave.mock.calls[0][0];
    expect(submitted.content.scope.operatorName).toBe('X');
    expect(submitted.updatedAt).not.toBe(plan.updatedAt);
  });

  it('ruft onCancel auf, wenn der Abbrechen-Button geklickt wird', () => {
    const onCancel = vi.fn();
    render(<ResiliencePlanEditor plan={makePlan()} onSave={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
