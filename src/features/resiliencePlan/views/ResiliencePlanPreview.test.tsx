import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResiliencePlanPreview } from './ResiliencePlanPreview';
import { buildEmptyPlanContent } from '../template';
import type { ResiliencePlan } from '../types';

function makePlan(overrides: Partial<ResiliencePlan> = {}): ResiliencePlan {
  return {
    id: 'plan-p',
    tenantId: 'demo',
    version: '1.0.0',
    status: 'draft',
    createdAt: '2026-04-20T10:00:00Z',
    updatedAt: '2026-04-20T10:00:00Z',
    content: {
      ...buildEmptyPlanContent(),
      scope: {
        ...buildEmptyPlanContent().scope,
        operatorName: 'Stadtwerke Musterheim',
        criticalService: 'Stromverteilung',
      },
    },
    ...overrides,
  };
}

describe('ResiliencePlanPreview', () => {
  it('zeigt Titel mit Version und Status-Chip', () => {
    render(<ResiliencePlanPreview plan={makePlan()} />);
    expect(screen.getByText(/Resilienzplan 1\.0\.0/)).toBeInTheDocument();
    expect(screen.getByText('Entwurf')).toBeInTheDocument();
  });

  it('rendert alle sechs Abschnitt-Überschriften nach § 13-Nummerierung', () => {
    render(<ResiliencePlanPreview plan={makePlan()} />);
    expect(screen.getByRole('heading', { name: /1\. Einleitung/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /2\. Risikobasis/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /3\. Resilienzziele/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /4\. Verantwortlichkeiten/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /5\. Meldewesen/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /6\. Nachweise/ })).toBeInTheDocument();
  });

  it('zeigt Stammdaten im Scope-Abschnitt', () => {
    render(<ResiliencePlanPreview plan={makePlan()} />);
    expect(screen.getByText('Stadtwerke Musterheim')).toBeInTheDocument();
    expect(screen.getByText('Stromverteilung')).toBeInTheDocument();
  });

  it('zeigt den Freigabe-Chip, wenn approved', () => {
    const plan = makePlan({ status: 'approved', approvedBy: 'Dr. Muster' });
    render(<ResiliencePlanPreview plan={plan} />);
    expect(screen.getByText('Freigegeben')).toBeInTheDocument();
    expect(screen.getByText(/Freigabe durch Dr\. Muster/)).toBeInTheDocument();
  });

  it('zeigt Top-Risiken, wenn vorhanden', () => {
    const plan = makePlan();
    plan.content.riskBasis.topRisks = [
      {
        title: 'Ransomware auf Leitstelle',
        category: 'cyber_physical',
        initialScore: 20,
        residualScore: 12,
        criticality: 'Sofort handeln',
      },
    ];
    render(<ResiliencePlanPreview plan={plan} />);
    expect(screen.getByText(/Ransomware auf Leitstelle/)).toBeInTheDocument();
    expect(screen.getByText(/Initial 20/)).toBeInTheDocument();
  });

  it('zählt Maßnahmen pro Resilienzziel', () => {
    const plan = makePlan();
    plan.content.measuresByGoal.prevent = [
      {
        id: 'm1',
        title: 'Awareness',
        description: '',
        goal: 'prevent',
        owner: '',
        dueDate: '',
        status: 'planned',
      },
      {
        id: 'm2',
        title: 'Schulung',
        description: '',
        goal: 'prevent',
        owner: '',
        dueDate: '',
        status: 'planned',
      },
    ];
    render(<ResiliencePlanPreview plan={plan} />);
    const preventCard = screen.getByText('Verhindern').closest('article');
    expect(preventCard).not.toBeNull();
    expect(preventCard!.textContent).toContain('2 Maßnahmen');
  });

  it('blendet im compact-Modus die Metadaten-Zeile und Ziel-Beschreibung aus', () => {
    const plan = makePlan();
    plan.content.measuresByGoal.recover = [
      { id: 'm', title: 'Backup', description: '', goal: 'recover', owner: '', dueDate: '', status: 'planned' },
    ];
    const { container } = render(<ResiliencePlanPreview plan={plan} compact />);
    expect(screen.queryByText(/Erstellt: 2026-04-20/)).toBeNull();
    expect(container.textContent).not.toContain('Maßnahmen für die Wiederherstellung');
  });
});
