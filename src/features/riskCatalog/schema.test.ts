import { describe, expect, it } from 'vitest';
import {
  riskCatalogExportSchema,
  riskEntrySchema,
  safeParseRiskEntry,
} from './schema';
import { countTaxonomyEntries, findCategory, findSubCategory, riskTaxonomy } from './taxonomy';
import type { RiskEntry } from './types';

const validEntry: RiskEntry = {
  id: 'risk-1',
  categoryId: 'nature',
  subCategoryId: 'flooding',
  titel: 'Hochwasser am Standort West',
  beschreibung: 'HQ100-Zone mit Rückstau aus dem kommunalen Entwässerungsnetz.',
  eintrittswahrscheinlichkeit: 3,
  auswirkung: 4,
  affectedAssetIds: ['asset-werk-west'],
  affectedProcessIds: ['proc-produktion'],
  affectedInterdependencies: ['dep-energie'],
  mitigationMeasureIds: ['measure-mobile-schutzwand'],
  residualRisk: 2,
  reviewDate: '2026-12-31',
  owner: 'BCM-Leitung',
};

describe('Taxonomie · Vollständigkeit', () => {
  it('enthält genau die sechs Hauptkategorien', () => {
    const ids = riskTaxonomy.map((category) => category.id).sort();
    expect(ids).toEqual(
      ['cyber_physical', 'human_intentional', 'human_unintentional', 'interdependency', 'nature', 'technical'].sort(),
    );
  });

  it('hat zwischen 3 und 8 Unterkategorien pro Hauptkategorie', () => {
    for (const category of riskTaxonomy) {
      expect(category.subCategories.length, `Kategorie "${category.id}"`).toBeGreaterThanOrEqual(3);
      expect(category.subCategories.length, `Kategorie "${category.id}"`).toBeLessThanOrEqual(8);
    }
  });

  it('zählt eine Gesamtzahl sinnvoller Unterkategorien für UI-Sanity-Checks', () => {
    const { categories, subCategories } = countTaxonomyEntries();
    expect(categories).toBe(6);
    expect(subCategories).toBeGreaterThanOrEqual(25);
  });

  it('liefert für eine bekannte Kombination eine passende Unterkategorie', () => {
    const category = findCategory('technical');
    const sub = findSubCategory('technical', 'power_outage');
    expect(category?.label).toBe('Technische Gefahren');
    expect(sub?.label).toBe('Stromausfall');
    expect(sub?.typischeIndikatoren.length).toBeGreaterThanOrEqual(2);
  });

  it('liefert undefined für unbekannte Kategorien', () => {
    expect(findCategory('phantasie')).toBeUndefined();
    expect(findSubCategory('nature', 'phantasie')).toBeUndefined();
  });

  it('verlinkt nur auf real existierende Requirement-IDs (Plausibilitätsprüfung)', () => {
    const knownRequirementPrefix = /^(de_kritis|de_bsig|at_nisg|ch_bacs)_/;
    for (const category of riskTaxonomy) {
      for (const sub of category.subCategories) {
        for (const link of sub.verlinkungZu) {
          expect(link).toMatch(knownRequirementPrefix);
        }
      }
    }
  });
});

describe('riskEntrySchema · Validierung', () => {
  it('akzeptiert einen vollständigen gültigen Eintrag', () => {
    const parsed = riskEntrySchema.parse(validEntry);
    expect(parsed.id).toBe('risk-1');
    expect(parsed.eintrittswahrscheinlichkeit).toBe(3);
  });

  it('setzt fehlende Arrays auf leere Defaults', () => {
    const minimal = {
      ...validEntry,
      affectedAssetIds: undefined,
      affectedProcessIds: undefined,
      affectedInterdependencies: undefined,
      mitigationMeasureIds: undefined,
    };
    const parsed = riskEntrySchema.parse(minimal);
    expect(parsed.affectedAssetIds).toEqual([]);
    expect(parsed.mitigationMeasureIds).toEqual([]);
  });

  it('lehnt Scores außerhalb 1-5 ab', () => {
    const result = safeParseRiskEntry({ ...validEntry, eintrittswahrscheinlichkeit: 7 });
    expect(result.success).toBe(false);
  });

  it('lehnt Fließkomma-Scores ab', () => {
    const result = safeParseRiskEntry({ ...validEntry, auswirkung: 3.5 });
    expect(result.success).toBe(false);
  });

  it('lehnt eine unbekannte Kategorie ab', () => {
    const result = safeParseRiskEntry({ ...validEntry, categoryId: 'phantasie' });
    expect(result.success).toBe(false);
  });

  it('lehnt eine zur Kategorie unpassende Unterkategorie ab', () => {
    const result = safeParseRiskEntry({
      ...validEntry,
      categoryId: 'nature',
      subCategoryId: 'power_outage',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('subCategoryId'))).toBe(true);
    }
  });

  it('lehnt ein Restrisiko ab, das höher als die ursprüngliche Auswirkung ist', () => {
    const result = safeParseRiskEntry({ ...validEntry, auswirkung: 2, residualRisk: 4 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('residualRisk'))).toBe(true);
    }
  });

  it('akzeptiert ein Restrisiko gleich der Auswirkung (vor Maßnahme)', () => {
    const result = safeParseRiskEntry({ ...validEntry, auswirkung: 4, residualRisk: 4 });
    expect(result.success).toBe(true);
  });
});

describe('riskCatalogExportSchema', () => {
  it('validiert einen konsistenten Export-Container', () => {
    const container = {
      version: 1 as const,
      generatedAt: '2026-04-20T10:00:00Z',
      entries: [validEntry],
    };
    const parsed = riskCatalogExportSchema.parse(container);
    expect(parsed.entries).toHaveLength(1);
  });

  it('lehnt falsche Schema-Version ab', () => {
    const container = {
      version: 99,
      generatedAt: '2026-04-20',
      entries: [validEntry],
    };
    const result = riskCatalogExportSchema.safeParse(container);
    expect(result.success).toBe(false);
  });
});
