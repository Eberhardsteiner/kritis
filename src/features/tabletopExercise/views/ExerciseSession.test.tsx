import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExerciseSession } from './ExerciseSession';
import {
  acknowledgeInject,
  createSession,
  recordDecision,
  startSession,
} from '../engine';
import type { Scenario } from '../types';

const scenario: Scenario = {
  id: 's',
  version: '1.0.0',
  title: 'Testszenario',
  summary: 'Kurz.',
  sectors: ['Energie'],
  applicableRegimes: ['de_kritisdachg'],
  durationMinutes: 60,
  roles: [{ id: 'ceo', title: 'CEO', briefing: 'Entscheidet.' }],
  timeline: [
    {
      t: 0,
      phase: 'discovery',
      injects: [{ id: 'inj-1', title: 'Meldung', description: 'SOC', roleId: 'ceo' }],
      decisions: [
        {
          id: 'dec-1',
          question: 'Vorstand alarmieren?',
          roleId: 'ceo',
          options: [
            { id: 'yes', label: 'Ja', evaluationHints: ['board'] },
            { id: 'no', label: 'Nein', evaluationHints: ['board'] },
          ],
        },
      ],
    },
    {
      t: 30,
      phase: '24h_reporting',
      injects: [],
      decisions: [
        {
          id: 'dec-2',
          question: 'Jetzt melden?',
          options: [
            { id: 'now', label: 'Jetzt', evaluationHints: ['timely'] },
            { id: 'later', label: 'Später', evaluationHints: ['timely'] },
          ],
        },
      ],
    },
  ],
  evaluationCriteria: [
    { id: 'board', description: '', weight: 1 },
    { id: 'timely', description: '', weight: 1 },
  ],
};

function noopHandlers() {
  return {
    onStart: vi.fn(),
    onAcknowledgeInject: vi.fn(),
    onRecordDecision: vi.fn(),
    onAdvanceStep: vi.fn(),
    onCompleteSession: vi.fn(),
    onAbandonSession: vi.fn(),
    onUpdateNotes: vi.fn(),
  };
}

describe('ExerciseSession · Pre-Start', () => {
  it('zeigt Rollen-Briefings und Start-Button im not_started-Status', () => {
    const session = createSession({ scenario, tenantId: 'demo' });
    const handlers = noopHandlers();
    render(<ExerciseSession session={session} scenario={scenario} {...handlers} />);
    expect(screen.getByText('CEO')).toBeInTheDocument();
    expect(screen.getByText('Entscheidet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Übung starten/ }));
    expect(handlers.onStart).toHaveBeenCalledTimes(1);
  });
});

describe('ExerciseSession · Laufende Übung', () => {
  it('zeigt Phase, Injects und Entscheidungen', () => {
    const session = startSession(createSession({ scenario, tenantId: 'demo' }));
    const handlers = noopHandlers();
    render(<ExerciseSession session={session} scenario={scenario} {...handlers} />);
    expect(screen.getByText(/Phase 1\/2 · Erkennung/)).toBeInTheDocument();
    expect(screen.getByText('Meldung')).toBeInTheDocument();
    expect(screen.getByText('Vorstand alarmieren?')).toBeInTheDocument();
  });

  it('ruft onAcknowledgeInject auf und zeigt Status "Aufgenommen"', () => {
    let session = startSession(createSession({ scenario, tenantId: 'demo' }));
    const handlers = noopHandlers();
    const { rerender } = render(<ExerciseSession session={session} scenario={scenario} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: /Aufnehmen/ }));
    expect(handlers.onAcknowledgeInject).toHaveBeenCalledWith('inj-1');
    session = acknowledgeInject(session, 'inj-1');
    rerender(<ExerciseSession session={session} scenario={scenario} {...handlers} />);
    expect(screen.getByText('Aufgenommen')).toBeInTheDocument();
  });

  it('ruft onRecordDecision auf', () => {
    const session = startSession(createSession({ scenario, tenantId: 'demo' }));
    const handlers = noopHandlers();
    render(<ExerciseSession session={session} scenario={scenario} {...handlers} />);
    fireEvent.click(screen.getByRole('radio', { name: /Ja/ }));
    expect(handlers.onRecordDecision).toHaveBeenCalledWith('dec-1', 'yes');
  });

  it('deaktiviert "Nächste Phase", solange nicht alle Entscheidungen getroffen sind', () => {
    let session = startSession(createSession({ scenario, tenantId: 'demo' }));
    session = acknowledgeInject(session, 'inj-1');
    const handlers = noopHandlers();
    render(<ExerciseSession session={session} scenario={scenario} {...handlers} />);
    expect(screen.getByRole('button', { name: /Nächste Phase/ })).toBeDisabled();
  });

  it('aktiviert "Nächste Phase", wenn alle Decisions + Injects erledigt sind', () => {
    let session = startSession(createSession({ scenario, tenantId: 'demo' }));
    session = acknowledgeInject(session, 'inj-1');
    session = recordDecision(session, scenario, 'dec-1', 'yes');
    const handlers = noopHandlers();
    render(<ExerciseSession session={session} scenario={scenario} {...handlers} />);
    const btn = screen.getByRole('button', { name: /Nächste Phase/ });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(handlers.onAdvanceStep).toHaveBeenCalledTimes(1);
  });

  it('zeigt Abschluss-Button im letzten Schritt und nicht die Nächste-Phase-Taste', () => {
    let session = startSession(createSession({ scenario, tenantId: 'demo' }));
    session = acknowledgeInject(session, 'inj-1');
    session = recordDecision(session, scenario, 'dec-1', 'yes');
    // Advance to last step manually:
    session = { ...session, currentStepIndex: 1 };
    session = recordDecision(session, scenario, 'dec-2', 'now');
    const handlers = noopHandlers();
    render(<ExerciseSession session={session} scenario={scenario} {...handlers} />);
    expect(screen.queryByRole('button', { name: /Nächste Phase/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Übung abschließen/ }));
    expect(handlers.onCompleteSession).toHaveBeenCalledTimes(1);
  });

  it('ruft onAbandonSession auf', () => {
    const session = startSession(createSession({ scenario, tenantId: 'demo' }));
    const handlers = noopHandlers();
    render(<ExerciseSession session={session} scenario={scenario} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/ }));
    expect(handlers.onAbandonSession).toHaveBeenCalledTimes(1);
  });

  it('updaten der Notizen ruft onUpdateNotes', () => {
    const session = startSession(createSession({ scenario, tenantId: 'demo' }));
    const handlers = noopHandlers();
    render(<ExerciseSession session={session} scenario={scenario} {...handlers} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Moderations-Notizen/ }), {
      target: { value: 'Erste Beobachtung' },
    });
    expect(handlers.onUpdateNotes).toHaveBeenCalledWith('Erste Beobachtung');
  });
});
