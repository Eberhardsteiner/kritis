import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExerciseReview } from './ExerciseReview';
import { completeSession, createSession, recordDecision, startSession } from '../engine';
import type { ExerciseSession, Scenario } from '../types';

const scenario: Scenario = {
  id: 's',
  version: '1.0.0',
  title: 'Cyber-Szenario Test',
  summary: '',
  sectors: ['Energie'],
  applicableRegimes: ['de_kritisdachg'],
  durationMinutes: 60,
  roles: [{ id: 'ceo', title: 'CEO', briefing: '' }],
  timeline: [
    {
      t: 0,
      phase: 'discovery',
      injects: [],
      decisions: [
        {
          id: 'dec-1',
          question: 'Vorstand alarmieren?',
          options: [
            { id: 'yes', label: 'Ja', evaluationHints: ['board'], scoreContribution: 5 },
            { id: 'no', label: 'Nein', evaluationHints: ['board'], scoreContribution: 1 },
          ],
        },
      ],
    },
  ],
  evaluationCriteria: [{ id: 'board', description: 'Geschäftsleitung einbezogen', weight: 3 }],
};

function makeCompletedSession(): ExerciseSession {
  let s = startSession(
    createSession({ scenario, tenantId: 'demo', sessionId: 'sess-1' }),
    new Date('2026-04-20T10:00:00Z'),
  );
  s = recordDecision(s, scenario, 'dec-1', 'yes', new Date('2026-04-20T10:05:00Z'));
  return completeSession(s, scenario, new Date('2026-04-20T10:30:00Z'));
}

describe('ExerciseReview · Fehlende Auswertung', () => {
  it('zeigt einen muted-Hinweis, wenn kein result vorhanden ist', () => {
    const draftSession = startSession(createSession({ scenario, tenantId: 'demo' }));
    render(<ExerciseReview session={draftSession} scenario={scenario} />);
    expect(screen.getByText(/Noch kein Ergebnis verfügbar/)).toBeInTheDocument();
  });
});

describe('ExerciseReview · Vollständige Auswertung', () => {
  it('zeigt Verdict und Prozent prominent an', () => {
    const session = makeCompletedSession();
    const { container } = render(<ExerciseReview session={session} scenario={scenario} />);
    expect(container.querySelector('.stat-card.success')).not.toBeNull();
    const statValue = container.querySelector('.stat-value');
    expect(statValue?.textContent).toContain('100,0');
    expect(screen.getByText('Bestanden')).toBeInTheDocument();
  });

  it('listet Kriterien mit Rationale und Gewicht', () => {
    const session = makeCompletedSession();
    render(<ExerciseReview session={session} scenario={scenario} />);
    expect(screen.getByText('Geschäftsleitung einbezogen')).toBeInTheDocument();
    expect(screen.getByText(/Gewicht 3/)).toBeInTheDocument();
    expect(screen.getByText(/Score 5,0\/5/)).toBeInTheDocument();
    expect(screen.getByText(/gewählt „Ja"/)).toBeInTheDocument();
  });

  it('zeigt das Entscheidungsprotokoll chronologisch', () => {
    const session = makeCompletedSession();
    render(<ExerciseReview session={session} scenario={scenario} />);
    expect(screen.getByText(/Entscheidungsprotokoll \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('Vorstand alarmieren?')).toBeInTheDocument();
    expect(screen.getByText(/→ Ja/)).toBeInTheDocument();
  });

  it('zeigt Moderations-Notizen, wenn vorhanden', () => {
    const session = { ...makeCompletedSession(), participantNotes: 'Alle Entscheidungen zügig.' };
    render(<ExerciseReview session={session} scenario={scenario} />);
    expect(screen.getByText('Alle Entscheidungen zügig.')).toBeInTheDocument();
  });

  it('ruft Callbacks auf Button-Klick', () => {
    const session = makeCompletedSession();
    const onCreateEvidence = vi.fn();
    const onExportJson = vi.fn();
    render(
      <ExerciseReview
        session={session}
        scenario={scenario}
        onCreateEvidence={onCreateEvidence}
        onExportJson={onExportJson}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Als Evidenz hinterlegen/ }));
    fireEvent.click(screen.getByRole('button', { name: /JSON exportieren/ }));
    expect(onCreateEvidence).toHaveBeenCalledTimes(1);
    expect(onExportJson).toHaveBeenCalledTimes(1);
  });

  it('blendet Buttons aus, wenn keine Callbacks übergeben werden', () => {
    const session = makeCompletedSession();
    render(<ExerciseReview session={session} scenario={scenario} />);
    expect(screen.queryByRole('button', { name: /Als Evidenz hinterlegen/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /JSON exportieren/ })).toBeNull();
  });
});
