import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResiliencePlanVersionHistory } from './ResiliencePlanVersionHistory';
import { buildEmptyPlanContent } from '../template';
import type { ResiliencePlan, ResiliencePlanStatus } from '../types';

function makePlan(status: ResiliencePlanStatus = 'draft', overrides: Partial<ResiliencePlan> = {}): ResiliencePlan {
  return {
    id: 'plan-v',
    tenantId: 'demo',
    version: '1.0.0',
    status,
    createdAt: '2026-04-20T10:00:00Z',
    updatedAt: '2026-04-20T10:00:00Z',
    content: buildEmptyPlanContent(),
    ...overrides,
  };
}

describe('ResiliencePlanVersionHistory · Draft', () => {
  it('zeigt den Review-Button im Draft-Status', () => {
    const onSubmitForReview = vi.fn();
    render(
      <ResiliencePlanVersionHistory
        currentPlan={makePlan('draft')}
        onSubmitForReview={onSubmitForReview}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Review anfragen/ }));
    expect(onSubmitForReview).toHaveBeenCalledTimes(1);
  });

  it('blendet Freigabe- und Archivierungs-Buttons im Draft aus', () => {
    render(<ResiliencePlanVersionHistory currentPlan={makePlan('draft')} />);
    expect(screen.queryByRole('button', { name: /Freigeben/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Archivieren/ })).toBeNull();
  });
});

describe('ResiliencePlanVersionHistory · Review', () => {
  it('zeigt Eingabefeld und Freigabe-Button', () => {
    render(<ResiliencePlanVersionHistory currentPlan={makePlan('review')} onApprove={() => {}} />);
    expect(screen.getByRole('textbox', { name: /freigebenden Person/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Freigeben/ })).toBeDisabled();
  });

  it('aktiviert Freigeben, wenn Name eingegeben ist, und ruft onApprove mit getrimmtem Wert', () => {
    const onApprove = vi.fn();
    render(<ResiliencePlanVersionHistory currentPlan={makePlan('review')} onApprove={onApprove} />);
    fireEvent.change(screen.getByRole('textbox', { name: /freigebenden Person/ }), {
      target: { value: '  Dr. Muster · CEO  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Freigeben/ }));
    expect(onApprove).toHaveBeenCalledWith('Dr. Muster · CEO');
  });

  it('ruft onReturnToDraft aus Review auf', () => {
    const onReturnToDraft = vi.fn();
    render(
      <ResiliencePlanVersionHistory currentPlan={makePlan('review')} onReturnToDraft={onReturnToDraft} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Zurück in Entwurf/ }));
    expect(onReturnToDraft).toHaveBeenCalledTimes(1);
  });
});

describe('ResiliencePlanVersionHistory · Approved und Archived', () => {
  it('zeigt im Approved-Status Rücknahme und Archivieren', () => {
    const onReturnToDraft = vi.fn();
    const onArchive = vi.fn();
    render(
      <ResiliencePlanVersionHistory
        currentPlan={makePlan('approved', { approvedBy: 'Dr. Muster', approvedAt: '2026-05-01T09:00:00Z' })}
        onReturnToDraft={onReturnToDraft}
        onArchive={onArchive}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Freigabe zurückziehen/ }));
    fireEvent.click(screen.getByRole('button', { name: /Archivieren/ }));
    expect(onReturnToDraft).toHaveBeenCalledTimes(1);
    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it('zeigt im Archived-Status Reaktivieren-Button', () => {
    const onReturnToDraft = vi.fn();
    render(
      <ResiliencePlanVersionHistory currentPlan={makePlan('archived')} onReturnToDraft={onReturnToDraft} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Reaktivieren/ }));
    expect(onReturnToDraft).toHaveBeenCalledTimes(1);
  });
});

describe('ResiliencePlanVersionHistory · Archivierte Versionen', () => {
  it('zeigt Leer-Hinweis ohne archivierte Versionen', () => {
    render(<ResiliencePlanVersionHistory currentPlan={makePlan()} />);
    expect(screen.getByText(/Keine archivierten Fassungen vorhanden/)).toBeInTheDocument();
  });

  it('listet archivierte Versionen mit Metadaten', () => {
    const archived = [
      makePlan('archived', {
        id: 'old',
        version: '0.9.0',
        approvedBy: 'Ältere Freigabe',
        approvedAt: '2025-12-01T08:00:00Z',
      }),
    ];
    render(<ResiliencePlanVersionHistory currentPlan={makePlan()} archivedVersions={archived} />);
    expect(screen.getByText(/Version 0\.9\.0/)).toBeInTheDocument();
    expect(screen.getByText(/Freigabe Ältere Freigabe/)).toBeInTheDocument();
  });
});

describe('ResiliencePlanVersionHistory · canTransitionStatus=false', () => {
  it('blendet alle Aktions-Buttons aus, wenn Transitions verboten sind', () => {
    render(
      <ResiliencePlanVersionHistory
        currentPlan={makePlan('review')}
        canTransitionStatus={false}
        onApprove={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /Freigeben/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Zurück in Entwurf/ })).toBeNull();
  });
});
