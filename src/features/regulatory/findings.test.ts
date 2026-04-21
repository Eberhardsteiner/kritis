import { describe, expect, it } from 'vitest';
import { clearEvidenceRefsFromFindings } from './findings';
import type { AuditFindingItem } from '../../types';

/**
 * Tests fuer den cross-feature-konsumierten Pure-Helper aus C2.9.
 *
 * Der Helper ersetzt die frueher im evidence-Hook inline codierte
 * Kaskade (C2.4 -> C2.9). Diese Tests stellen sicher, dass die
 * Extraktion fachlich identisch bleibt:
 *   - das Finding selbst bleibt erhalten (kein filter, nur map)
 *   - alle ANDEREN Evidence-IDs bleiben erhalten
 *   - nur die Ziel-ID wird entfernt, auch wenn sie mehrfach vorkommt
 *   - die Eingabe wird nicht mutiert (immutable)
 *   - andere Finding-Felder (title, severity, owner etc.) bleiben
 *     unveraendert.
 */
function makeFinding(overrides: Partial<AuditFindingItem> = {}): AuditFindingItem {
  return {
    id: 'fnd-test',
    moduleId: 'manufacturing',
    title: 'Test-Feststellung',
    area: 'Audit',
    severity: 'medium',
    status: 'open',
    owner: 'Auditor',
    dueDate: '2026-06-01',
    relatedRequirementIds: ['req-1'],
    relatedEvidenceIds: [],
    notes: 'Testnotiz',
    createdAt: '2026-04-21T00:00:00.000Z',
    ...overrides,
  };
}

describe('clearEvidenceRefsFromFindings', () => {
  it('belaesst Findings erhalten, die die geloeschte Evidenz nicht referenzieren', () => {
    const findings = [makeFinding({ id: 'fnd-1', relatedEvidenceIds: ['evi-a', 'evi-b'] })];
    const result = clearEvidenceRefsFromFindings(findings, 'evi-X');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('fnd-1');
    expect(result[0].relatedEvidenceIds).toEqual(['evi-a', 'evi-b']);
  });

  it('entfernt die geloeschte Evidenz-ID aus den relatedEvidenceIds, Finding bleibt', () => {
    const findings = [
      makeFinding({ id: 'fnd-1', relatedEvidenceIds: ['evi-a', 'evi-b', 'evi-c'] }),
    ];
    const result = clearEvidenceRefsFromFindings(findings, 'evi-b');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('fnd-1');
    expect(result[0].relatedEvidenceIds).toEqual(['evi-a', 'evi-c']);
    // Finding-Body (title/severity/owner) unveraendert.
    expect(result[0].title).toBe('Test-Feststellung');
    expect(result[0].severity).toBe('medium');
    expect(result[0].owner).toBe('Auditor');
  });

  it('entfernt die Evidenz-ID bei Mehrfach-Vorkommen komplett', () => {
    const findings = [
      makeFinding({ id: 'fnd-1', relatedEvidenceIds: ['evi-a', 'evi-b', 'evi-a'] }),
    ];
    const result = clearEvidenceRefsFromFindings(findings, 'evi-a');

    expect(result[0].relatedEvidenceIds).toEqual(['evi-b']);
  });

  it('arbeitet ueber mehrere Findings gleichzeitig', () => {
    const findings = [
      makeFinding({ id: 'fnd-1', relatedEvidenceIds: ['evi-a', 'evi-b'] }),
      makeFinding({ id: 'fnd-2', relatedEvidenceIds: ['evi-c'] }),
      makeFinding({ id: 'fnd-3', relatedEvidenceIds: ['evi-a', 'evi-c'] }),
    ];
    const result = clearEvidenceRefsFromFindings(findings, 'evi-a');

    expect(result).toHaveLength(3);
    expect(result[0].relatedEvidenceIds).toEqual(['evi-b']);
    expect(result[1].relatedEvidenceIds).toEqual(['evi-c']);
    expect(result[2].relatedEvidenceIds).toEqual(['evi-c']);
  });

  it('mutiert die Eingabe nicht (Immutability-Kontrakt)', () => {
    const originalEvidenceIds = ['evi-a', 'evi-b'];
    const findings = [
      makeFinding({ id: 'fnd-1', relatedEvidenceIds: originalEvidenceIds }),
    ];
    const beforeArrayRef = findings[0];

    clearEvidenceRefsFromFindings(findings, 'evi-a');

    // Originale relatedEvidenceIds-Array nicht veraendert.
    expect(originalEvidenceIds).toEqual(['evi-a', 'evi-b']);
    // Original-Finding-Object-Referenz nicht mutiert.
    expect(beforeArrayRef.relatedEvidenceIds).toEqual(['evi-a', 'evi-b']);
  });

  it('gibt eine leere Liste zurueck, wenn keine Findings uebergeben werden', () => {
    expect(clearEvidenceRefsFromFindings([], 'evi-a')).toEqual([]);
  });

  it('belaesst leere relatedEvidenceIds-Arrays leer', () => {
    const findings = [makeFinding({ id: 'fnd-1', relatedEvidenceIds: [] })];
    const result = clearEvidenceRefsFromFindings(findings, 'evi-a');

    expect(result[0].relatedEvidenceIds).toEqual([]);
  });
});
