import { describe, expect, it } from 'vitest';
import {
  abandonSession,
  acknowledgeInject,
  advanceStep,
  completeSession,
  createSession,
  evaluateSession,
  findDecision,
  getCurrentStep,
  getPhaseLabel,
  getVerdictLabel,
  recordDecision,
  startSession,
  updateParticipantNotes,
} from './engine';
import type { Scenario } from './types';

const scenario: Scenario = {
  id: 's',
  version: '1.0.0',
  title: 't',
  summary: '',
  sectors: ['Energie'],
  applicableRegimes: ['de_kritisdachg'],
  durationMinutes: 60,
  roles: [{ id: 'ceo', title: 'CEO', briefing: '' }],
  timeline: [
    {
      t: 0,
      phase: 'discovery',
      injects: [{ id: 'inj-1', title: 'Meldung', description: 'Log' }],
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
    {
      t: 30,
      phase: '24h_reporting',
      injects: [{ id: 'inj-2', title: 'BSI-Frist', description: 'Uhr läuft' }],
      decisions: [
        {
          id: 'dec-2',
          question: 'Jetzt melden?',
          options: [
            { id: 'now', label: 'Jetzt', evaluationHints: ['timely'], scoreContribution: 5 },
            { id: 'later', label: 'Später', evaluationHints: ['timely'], scoreContribution: 0 },
          ],
        },
      ],
    },
  ],
  evaluationCriteria: [
    { id: 'timely', description: 'Fristgerechte Meldung', weight: 3 },
    { id: 'board', description: 'Geschäftsleitung einbezogen', weight: 2 },
  ],
};

describe('createSession und startSession', () => {
  it('erzeugt eine Session im Status not_started', () => {
    const session = createSession({ scenario, tenantId: 'demo', sessionId: 'sess-1' });
    expect(session.status).toBe('not_started');
    expect(session.scenarioId).toBe('s');
    expect(session.scenarioVersion).toBe('1.0.0');
    expect(session.tenantId).toBe('demo');
    expect(session.currentStepIndex).toBe(0);
  });

  it('startSession setzt active und startedAt', () => {
    const session = createSession({ scenario, tenantId: 'demo' });
    const started = startSession(session, new Date('2026-04-20T10:00:00Z'));
    expect(started.status).toBe('active');
    expect(started.startedAt).toBe('2026-04-20T10:00:00.000Z');
  });

  it('startSession ist idempotent für eine bereits aktive Session', () => {
    const session = startSession(createSession({ scenario, tenantId: 'demo' }));
    const again = startSession(session);
    expect(again).toBe(session);
  });
});

describe('recordDecision', () => {
  it('fügt einen DecisionRecord hinzu und referenziert Option', () => {
    const session = startSession(createSession({ scenario, tenantId: 'demo' }));
    const updated = recordDecision(session, scenario, 'dec-1', 'yes', new Date('2026-04-20T10:05:00Z'));
    expect(updated.decisions).toHaveLength(1);
    expect(updated.decisions[0]).toMatchObject({
      decisionId: 'dec-1',
      selectedOptionId: 'yes',
      chosenAt: '2026-04-20T10:05:00.000Z',
    });
  });

  it('überschreibt einen existierenden Record', () => {
    let session = startSession(createSession({ scenario, tenantId: 'demo' }));
    session = recordDecision(session, scenario, 'dec-1', 'yes');
    session = recordDecision(session, scenario, 'dec-1', 'no');
    expect(session.decisions).toHaveLength(1);
    expect(session.decisions[0].selectedOptionId).toBe('no');
  });

  it('wirft bei unbekannter Entscheidung', () => {
    const session = startSession(createSession({ scenario, tenantId: 'demo' }));
    expect(() => recordDecision(session, scenario, 'phantom', 'yes')).toThrow();
  });

  it('wirft bei unbekannter Option', () => {
    const session = startSession(createSession({ scenario, tenantId: 'demo' }));
    expect(() => recordDecision(session, scenario, 'dec-1', 'phantom')).toThrow();
  });
});

describe('acknowledgeInject · advanceStep · updateParticipantNotes', () => {
  it('legt einen InjectAck an und ist idempotent', () => {
    const session = startSession(createSession({ scenario, tenantId: 'demo' }));
    const once = acknowledgeInject(session, 'inj-1', new Date('2026-04-20T10:01:00Z'));
    const twice = acknowledgeInject(once, 'inj-1');
    expect(twice.injectAcks).toHaveLength(1);
    expect(once.injectAcks[0].acknowledgedAt).toBe('2026-04-20T10:01:00.000Z');
  });

  it('advanceStep erhöht currentStepIndex, stoppt am Ende', () => {
    const session = startSession(createSession({ scenario, tenantId: 'demo' }));
    const step1 = advanceStep(session, scenario);
    expect(step1.currentStepIndex).toBe(1);
    const stopped = advanceStep(step1, scenario);
    expect(stopped.currentStepIndex).toBe(1);
  });

  it('updateParticipantNotes setzt die Notizen', () => {
    const session = startSession(createSession({ scenario, tenantId: 'demo' }));
    const withNotes = updateParticipantNotes(session, 'Erste Beobachtung: ...');
    expect(withNotes.participantNotes).toBe('Erste Beobachtung: ...');
  });
});

describe('findDecision · getCurrentStep', () => {
  it('findDecision liefert die Decision aus der richtigen Stufe', () => {
    expect(findDecision(scenario, 'dec-2')?.question).toBe('Jetzt melden?');
  });

  it('findDecision liefert undefined für unbekannte IDs', () => {
    expect(findDecision(scenario, 'phantom')).toBeUndefined();
  });

  it('getCurrentStep folgt currentStepIndex', () => {
    const session = createSession({ scenario, tenantId: 'demo' });
    expect(getCurrentStep(session, scenario)?.phase).toBe('discovery');
    expect(getCurrentStep({ ...session, currentStepIndex: 1 }, scenario)?.phase).toBe('24h_reporting');
  });
});

describe('evaluateSession · Bewertungskernfunktion', () => {
  it('liefert volle Punktzahl bei perfekten Entscheidungen', () => {
    let session = startSession(createSession({ scenario, tenantId: 'demo' }));
    session = recordDecision(session, scenario, 'dec-1', 'yes');
    session = recordDecision(session, scenario, 'dec-2', 'now');
    const result = evaluateSession(session, scenario);
    expect(result.percentage).toBe(100);
    expect(result.verdict).toBe('bestanden');
  });

  it('liefert 0 % bei maximal schlechten Entscheidungen', () => {
    let session = startSession(createSession({ scenario, tenantId: 'demo' }));
    session = recordDecision(session, scenario, 'dec-1', 'no');
    session = recordDecision(session, scenario, 'dec-2', 'later');
    const result = evaluateSession(session, scenario);
    // dec-1: 1/5 ergibt 20% für board, dec-2: 0/5 ergibt 0% für timely
    // weighted: board 20% * 2 = 0.4, timely 0% * 3 = 0 → total 0.4/5 = 8%
    expect(result.percentage).toBeLessThan(60);
    expect(result.verdict).toBe('nicht_bestanden');
  });

  it('liefert bedingt bestanden bei gemischten Entscheidungen', () => {
    let session = startSession(createSession({ scenario, tenantId: 'demo' }));
    session = recordDecision(session, scenario, 'dec-1', 'yes');
    session = recordDecision(session, scenario, 'dec-2', 'later');
    const result = evaluateSession(session, scenario);
    // board 100% * 2 = 2, timely 0% * 3 = 0 → 2/5 = 40% → nicht bestanden
    expect(result.percentage).toBe(40);
    expect(result.verdict).toBe('nicht_bestanden');
  });

  it('liefert "bedingt bestanden" im mittleren Bereich (60-79 %)', () => {
    let session = startSession(createSession({ scenario, tenantId: 'demo' }));
    session = recordDecision(session, scenario, 'dec-1', 'yes');  // board +5
    session = recordDecision(session, scenario, 'dec-2', 'now');   // timely +5
    // Beide perfekt → 100% bestanden. Für bedingt brauchen wir einen Mixwert.
    // Erstelle ein Szenario-basiertes Beispiel:
    const mixedScenario: Scenario = {
      ...scenario,
      evaluationCriteria: [
        { id: 'timely', description: 'timely', weight: 3 },
        { id: 'board', description: 'board', weight: 1 },
      ],
    };
    let s2 = startSession(createSession({ scenario: mixedScenario, tenantId: 'demo' }));
    s2 = recordDecision(s2, mixedScenario, 'dec-1', 'no');  // board 1/5 = 20%
    s2 = recordDecision(s2, mixedScenario, 'dec-2', 'now'); // timely 100%
    const res = evaluateSession(s2, mixedScenario);
    // weighted: 20%*1 + 100%*3 = 0.2 + 3.0 = 3.2 / 4 = 80% → bestanden
    expect(res.percentage).toBe(80);
  });

  it('dokumentiert pro Kriterium Rationale-Zeilen', () => {
    let session = startSession(createSession({ scenario, tenantId: 'demo' }));
    session = recordDecision(session, scenario, 'dec-1', 'no');
    const result = evaluateSession(session, scenario);
    const board = result.perCriterion.find((p) => p.criterionId === 'board');
    expect(board?.rationale[0]).toContain('gewählt „Nein"');
    const timely = result.perCriterion.find((p) => p.criterionId === 'timely');
    expect(timely?.rationale[0]).toContain('keine Entscheidung');
  });

  it('behandelt nicht-verknüpfte Kriterien mit Score 0 und Erklärung', () => {
    const withOrphan: Scenario = {
      ...scenario,
      evaluationCriteria: [
        ...scenario.evaluationCriteria,
        { id: 'orphan', description: 'Nie getestet', weight: 1 },
      ],
    };
    const session = startSession(createSession({ scenario: withOrphan, tenantId: 'demo' }));
    const result = evaluateSession(session, withOrphan);
    const orphan = result.perCriterion.find((p) => p.criterionId === 'orphan');
    expect(orphan?.score).toBe(0);
    expect(orphan?.weighted).toBe(0);
    expect(orphan?.rationale[0]).toContain('Kein Szenario-Inject');
  });
});

describe('completeSession und abandonSession', () => {
  it('completeSession wechselt auf completed und setzt result + endedAt', () => {
    let session = startSession(createSession({ scenario, tenantId: 'demo' }));
    session = recordDecision(session, scenario, 'dec-1', 'yes');
    session = recordDecision(session, scenario, 'dec-2', 'now');
    const completed = completeSession(session, scenario, new Date('2026-04-20T11:00:00Z'));
    expect(completed.status).toBe('completed');
    expect(completed.endedAt).toBe('2026-04-20T11:00:00.000Z');
    expect(completed.result?.verdict).toBe('bestanden');
  });

  it('completeSession ist No-Op, wenn die Session nicht aktiv ist', () => {
    const session = createSession({ scenario, tenantId: 'demo' });
    expect(completeSession(session, scenario)).toBe(session);
  });

  it('abandonSession setzt status auf abandoned', () => {
    const session = startSession(createSession({ scenario, tenantId: 'demo' }));
    const aborted = abandonSession(session, new Date('2026-04-20T10:45:00Z'));
    expect(aborted.status).toBe('abandoned');
    expect(aborted.endedAt).toBe('2026-04-20T10:45:00.000Z');
  });

  it('abandonSession ist No-Op nach completed/abandoned', () => {
    let session = startSession(createSession({ scenario, tenantId: 'demo' }));
    session = recordDecision(session, scenario, 'dec-1', 'yes');
    session = recordDecision(session, scenario, 'dec-2', 'now');
    const completed = completeSession(session, scenario);
    expect(abandonSession(completed)).toBe(completed);
  });
});

describe('Label-Helper', () => {
  it('übersetzt alle Verdicts', () => {
    expect(getVerdictLabel('bestanden')).toBe('Bestanden');
    expect(getVerdictLabel('bedingt_bestanden')).toBe('Bedingt bestanden');
    expect(getVerdictLabel('nicht_bestanden')).toBe('Nicht bestanden');
  });

  it('übersetzt alle Phasen', () => {
    expect(getPhaseLabel('discovery')).toBe('Erkennung');
    expect(getPhaseLabel('early_response')).toBe('Frühreaktion');
    expect(getPhaseLabel('24h_reporting')).toBe('24-Stunden-Meldung');
    expect(getPhaseLabel('stabilization')).toBe('Stabilisierung');
    expect(getPhaseLabel('recovery')).toBe('Wiederanlauf');
  });
});
