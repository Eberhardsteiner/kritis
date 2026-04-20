import { describe, expect, it } from 'vitest';
import {
  exerciseSessionSchema,
  parseScenario,
  safeParseScenario,
  scenarioExportSchema,
  scenarioSchema,
} from './schema';
import type { Scenario } from './types';

const validScenario: Scenario = {
  id: 'scenario-test',
  version: '1.0.0',
  title: 'Test-Szenario',
  summary: 'Kurzer Test.',
  sectors: ['Energie'],
  applicableRegimes: ['de_kritisdachg'],
  durationMinutes: 120,
  roles: [
    { id: 'ceo', title: 'CEO', briefing: 'Leitung.' },
    { id: 'ciso', title: 'CISO', briefing: 'Cyber-Lead.' },
  ],
  timeline: [
    {
      t: 0,
      phase: 'discovery',
      injects: [
        { id: 'inj-1', title: 'Meldung SOC', description: 'Auffällige Logins.', roleId: 'ciso' },
      ],
      decisions: [
        {
          id: 'dec-1',
          question: 'Sofortmeldung an Geschäftsleitung?',
          options: [
            {
              id: 'opt-a',
              label: 'Ja, Vorstand alarmieren',
              evaluationHints: ['board_involvement'],
              scoreContribution: 5,
            },
            { id: 'opt-b', label: 'Noch abwarten', scoreContribution: 1 },
          ],
          roleId: 'ciso',
          relatedCriteria: ['board_involvement'],
        },
      ],
    },
    {
      t: 60,
      phase: '24h_reporting',
      injects: [
        { id: 'inj-2', title: 'BSI erwartet Erstmeldung', description: '24-h-Frist läuft.' },
      ],
      decisions: [
        {
          id: 'dec-2',
          question: 'Meldung jetzt abschicken?',
          options: [
            { id: 'opt-now', label: 'Jetzt melden', evaluationHints: ['timely_24h_report'], scoreContribution: 5 },
            { id: 'opt-later', label: 'Noch warten', scoreContribution: 0 },
          ],
        },
      ],
    },
  ],
  evaluationCriteria: [
    { id: 'timely_24h_report', description: '24-Stunden-Meldung fristgerecht erfolgt.', weight: 3, category: 'reporting' },
    { id: 'board_involvement', description: 'Geschäftsleitung einbezogen.', weight: 2, category: 'governance' },
  ],
};

describe('scenarioSchema · Basisvalidierung', () => {
  it('akzeptiert ein vollständiges, konsistentes Szenario', () => {
    const parsed = parseScenario(validScenario);
    expect(parsed.id).toBe('scenario-test');
    expect(parsed.timeline).toHaveLength(2);
  });

  it('lehnt ein Szenario ohne Rollen ab', () => {
    const result = safeParseScenario({ ...validScenario, roles: [] });
    expect(result.success).toBe(false);
  });

  it('lehnt Entscheidungen mit nur einer Option ab', () => {
    const broken = JSON.parse(JSON.stringify(validScenario)) as Scenario;
    broken.timeline[0].decisions[0].options = [{ id: 'only', label: 'Nur eine' }];
    const result = safeParseScenario(broken);
    expect(result.success).toBe(false);
  });

  it('lehnt durationMinutes ausserhalb 15..1440 ab', () => {
    const tooShort = safeParseScenario({ ...validScenario, durationMinutes: 5 });
    const tooLong = safeParseScenario({ ...validScenario, durationMinutes: 2000 });
    expect(tooShort.success).toBe(false);
    expect(tooLong.success).toBe(false);
  });

  it('lehnt unbekannte ScenarioPhase ab', () => {
    const broken = JSON.parse(JSON.stringify(validScenario)) as Scenario;
    (broken.timeline[0].phase as string) = 'phantasie';
    const result = safeParseScenario(broken);
    expect(result.success).toBe(false);
  });
});

describe('scenarioSchema · Konsistenzprüfungen', () => {
  it('lehnt einen Timeline-Schritt mit fallender t-Achse ab', () => {
    const broken = JSON.parse(JSON.stringify(validScenario)) as Scenario;
    broken.timeline.push({ t: 10, phase: 'recovery', injects: [], decisions: [] });
    const result = safeParseScenario(broken);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('aufsteigend'))).toBe(true);
    }
  });

  it('lehnt Inject mit unbekannter roleId ab', () => {
    const broken = JSON.parse(JSON.stringify(validScenario)) as Scenario;
    broken.timeline[0].injects[0].roleId = 'phantom';
    const result = safeParseScenario(broken);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('Unbekannte Rolle'))).toBe(true);
    }
  });

  it('lehnt Decision mit unbekannter relatedCriteria-ID ab', () => {
    const broken = JSON.parse(JSON.stringify(validScenario)) as Scenario;
    broken.timeline[0].decisions[0].relatedCriteria = ['nicht_existent'];
    const result = safeParseScenario(broken);
    expect(result.success).toBe(false);
  });

  it('lehnt Option mit unbekanntem evaluationHint ab', () => {
    const broken = JSON.parse(JSON.stringify(validScenario)) as Scenario;
    broken.timeline[0].decisions[0].options[0].evaluationHints = ['phantom_criterion'];
    const result = safeParseScenario(broken);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('evaluationHint'))).toBe(true);
    }
  });

  it('akzeptiert Optionen ohne evaluationHints', () => {
    const cleanScenario = JSON.parse(JSON.stringify(validScenario)) as Scenario;
    cleanScenario.timeline[0].decisions[0].options[1].evaluationHints = undefined;
    const result = safeParseScenario(cleanScenario);
    expect(result.success).toBe(true);
  });
});

describe('exerciseSessionSchema · Sitzungs-Validierung', () => {
  it('akzeptiert eine laufende Session ohne Ergebnis', () => {
    const session = {
      id: 'sess-1',
      scenarioId: 'scenario-test',
      scenarioVersion: '1.0.0',
      tenantId: 'demo',
      status: 'active' as const,
      startedAt: '2026-04-20T10:00:00Z',
      currentStepIndex: 1,
      decisions: [],
      injectAcks: [],
      participantNotes: '',
    };
    const result = exerciseSessionSchema.safeParse(session);
    expect(result.success).toBe(true);
  });

  it('lehnt negative currentStepIndex ab', () => {
    const session = {
      id: 'sess-1',
      scenarioId: 'x',
      scenarioVersion: '1.0.0',
      tenantId: 'demo',
      status: 'active',
      startedAt: '',
      currentStepIndex: -1,
      decisions: [],
      injectAcks: [],
      participantNotes: '',
    };
    const result = exerciseSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  it('lehnt eine unbekannte Verdict-Stufe ab', () => {
    const session = {
      id: 'sess-1',
      scenarioId: 'x',
      scenarioVersion: '1.0.0',
      tenantId: 'demo',
      status: 'completed',
      startedAt: '',
      currentStepIndex: 0,
      decisions: [],
      injectAcks: [],
      participantNotes: '',
      result: {
        totalScore: 10,
        maxScore: 20,
        percentage: 50,
        verdict: 'phantasie',
        perCriterion: [],
        summary: '',
      },
    };
    const result = exerciseSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });
});

describe('scenarioExportSchema · Import-Container', () => {
  it('akzeptiert einen Export-Container mit Version 1 und mehreren Szenarien', () => {
    const container = {
      version: 1 as const,
      generatedAt: '2026-04-20T10:00:00Z',
      scenarios: [validScenario],
    };
    const result = scenarioExportSchema.parse(container);
    expect(result.scenarios).toHaveLength(1);
  });

  it('lehnt falsche Schema-Version ab', () => {
    const container = {
      version: 2,
      generatedAt: '2026-04-20',
      scenarios: [validScenario],
    };
    const result = scenarioExportSchema.safeParse(container);
    expect(result.success).toBe(false);
  });
});
