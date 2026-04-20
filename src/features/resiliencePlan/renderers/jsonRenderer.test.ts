import { describe, expect, it } from 'vitest';
import {
  buildResiliencePlanJsonFileName,
  parseResiliencePlanImport,
  renderResiliencePlanJson,
  renderResiliencePlanJsonBlob,
  safeParseResiliencePlanImport,
} from './jsonRenderer';
import { buildEmptyPlanContent } from '../template';
import type { ResiliencePlan } from '../types';

const plan: ResiliencePlan = {
  id: 'plan-a',
  tenantId: 'demo',
  version: '1.2.0',
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
};

describe('renderResiliencePlanJson', () => {
  it('erzeugt einen Container mit Version 1 und ISO-Zeitstempel', () => {
    const json = renderResiliencePlanJson(plan, { generatedAt: new Date('2026-04-20T10:00:00Z') });
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.generatedAt).toBe('2026-04-20T10:00:00.000Z');
    expect(parsed.plan.id).toBe('plan-a');
  });

  it('liefert hübsch-formatiertes JSON (pretty=true als Default)', () => {
    const json = renderResiliencePlanJson(plan);
    expect(json).toContain('\n');
    expect(json).toContain('  '); // 2-space indent
  });

  it('liefert kompaktes JSON mit pretty=false', () => {
    const json = renderResiliencePlanJson(plan, { pretty: false });
    expect(json).not.toContain('\n');
  });

  it('wirft, wenn das Schema verletzt ist (z. B. unbekannter Status)', () => {
    const broken = { ...plan, status: 'phantasie' as never };
    expect(() => renderResiliencePlanJson(broken)).toThrow();
  });
});

describe('renderResiliencePlanJsonBlob', () => {
  it('liefert einen Blob mit application/json', () => {
    const blob = renderResiliencePlanJsonBlob(plan);
    expect(blob.type).toBe('application/json');
    expect(blob.size).toBeGreaterThan(100);
  });
});

describe('parseResiliencePlanImport', () => {
  it('rundet ein Export → Import fehlerfrei', () => {
    const json = renderResiliencePlanJson(plan, { generatedAt: new Date('2026-04-20T10:00:00Z') });
    const roundTripped = parseResiliencePlanImport(JSON.parse(json));
    expect(roundTripped.id).toBe(plan.id);
    expect(roundTripped.content.scope.operatorName).toBe('Stadtwerke Musterheim');
  });

  it('safeParse liefert success=false bei falscher Containerversion', () => {
    const broken = { version: 2, generatedAt: '2026-04-20', plan };
    const result = safeParseResiliencePlanImport(broken);
    expect(result.success).toBe(false);
  });
});

describe('buildResiliencePlanJsonFileName', () => {
  it('baut einen stabilen Dateinamen mit Mandantenslug und Version', () => {
    const name = buildResiliencePlanJsonFileName(
      'Stadtwerke Musterheim',
      '1.2.0',
      new Date('2026-04-20T10:00:00Z'),
    );
    expect(name).toBe('Resilienzplan-stadtwerke-musterheim-v1.2.0-2026-04-20.json');
  });

  it('fällt auf "mandant" zurück bei leerem Namen', () => {
    const name = buildResiliencePlanJsonFileName('', '1.0.0', new Date('2026-04-20T10:00:00Z'));
    expect(name).toBe('Resilienzplan-mandant-v1.0.0-2026-04-20.json');
  });

  it('saeubert Nicht-ASCII-Zeichen und Sonderzeichen in der Version', () => {
    const name = buildResiliencePlanJsonFileName(
      'Müller & Söhne GmbH',
      '1.0.0-beta',
      new Date('2026-04-20T10:00:00Z'),
    );
    expect(name).toMatch(/^Resilienzplan-m-ller-s-hne-gmbh-v1\.0\.0-beta-2026-04-20\.json$/);
  });
});
