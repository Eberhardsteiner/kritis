import { describe, expect, it } from 'vitest';
import { buildQuestionSet } from './buildQuestionSet';
import { baseDomains } from '../data/baseDomains';
import type { SectorModulePack } from '../types';

const KNOWN_DOMAIN_IDS = new Set(baseDomains.map((domain) => domain.id));

const HEALTHCARE_FAKE_PACK: SectorModulePack = {
  packId: 'healthcare-core',
  id: 'healthcare',
  name: 'Gesundheit',
  additionalQuestions: [
    {
      id: 'healthcare_extra_1',
      domainId: 'operations',
      title: 'Notaufnahme-Notbetrieb',
      prompt: '',
      guidance: '',
      recommendation: '',
      weight: 1.2,
    },
    {
      id: 'healthcare_extra_2',
      domainId: 'cyber',
      title: 'PACS-Backup',
      prompt: '',
      guidance: '',
      recommendation: '',
      weight: 1.1,
    },
    {
      id: 'healthcare_extra_3',
      domainId: 'people',
      title: 'Fachkraefte-Pool',
      prompt: '',
      guidance: '',
      recommendation: '',
      weight: 1,
    },
    {
      id: 'healthcare_extra_4',
      domainId: 'bcm',
      title: 'Klinik-Stab',
      prompt: '',
      guidance: '',
      recommendation: '',
      weight: 1,
    },
  ],
};

describe('buildQuestionSet', () => {
  it('liefert genau die 24 Basisfragen, wenn kein Modul gewaehlt ist', () => {
    const result = buildQuestionSet(undefined);
    expect(result).toHaveLength(24);
  });

  it('haengt additionalQuestions des Moduls an die Basisfragen an', () => {
    const result = buildQuestionSet(HEALTHCARE_FAKE_PACK);
    expect(result).toHaveLength(24 + 4);
    expect(result[24].id).toBe('healthcare_extra_1');
    expect(result[27].id).toBe('healthcare_extra_4');
  });

  it('sorgt dafuer, dass alle Modul-Fragen gueltige Domain-IDs verwenden', () => {
    const result = buildQuestionSet(HEALTHCARE_FAKE_PACK);
    result.forEach((question) => {
      expect(KNOWN_DOMAIN_IDS.has(question.domainId)).toBe(true);
    });
  });

  it('toleriert ein Pack ohne additionalQuestions', () => {
    const result = buildQuestionSet({ packId: 'x-core', id: 'x', name: 'X' });
    expect(result).toHaveLength(24);
  });

  it('liefert 28 Fragen, wenn das echte healthcare-core-Pack geladen ist', async () => {
    // Lese das echte JSON aus public/ — vermeidet, dass der Test divergiert,
    // wenn Pack-Inhalte sich aendern.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const url = await import('node:url');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const json = JSON.parse(
      fs.readFileSync(
        path.join(here, '..', '..', 'public', 'module-packs', 'healthcare-core.container.json'),
        'utf-8',
      ),
    ) as { module?: SectorModulePack };
    const pack: SectorModulePack = {
      packId: 'healthcare-core',
      id: json.module?.id ?? 'healthcare',
      name: json.module?.name ?? 'Healthcare',
      additionalQuestions: json.module?.additionalQuestions,
    };
    const result = buildQuestionSet(pack);
    expect(result).toHaveLength(28);
  });
});
