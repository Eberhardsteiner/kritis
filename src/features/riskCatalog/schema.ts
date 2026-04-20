import { z } from 'zod';
import { findSubCategory, riskTaxonomy } from './taxonomy';
import type { RiskEntry } from './types';

/**
 * Zod-Schemas für RiskEntry und den Import/Export-Container.
 * Die Validierung prüft:
 *   - dass die Scores im Bereich 1..5 liegen
 *   - dass categoryId eine der sechs Hauptkategorien ist
 *   - dass subCategoryId zu dieser Hauptkategorie gehört (Kreuzvalidierung)
 */

export const riskCategoryIdSchema = z.enum([
  'nature',
  'technical',
  'human_intentional',
  'human_unintentional',
  'interdependency',
  'cyber_physical',
]);

const riskScoreSchema = z
  .number()
  .int()
  .min(1)
  .max(5) as z.ZodType<1 | 2 | 3 | 4 | 5>;

export const riskEntrySchema = z
  .object({
    id: z.string().min(1),
    categoryId: riskCategoryIdSchema,
    subCategoryId: z.string().min(1),
    titel: z.string().min(1),
    beschreibung: z.string(),
    eintrittswahrscheinlichkeit: riskScoreSchema,
    auswirkung: riskScoreSchema,
    affectedAssetIds: z.array(z.string()).default([]),
    affectedProcessIds: z.array(z.string()).default([]),
    affectedInterdependencies: z.array(z.string()).default([]),
    mitigationMeasureIds: z.array(z.string()).default([]),
    residualRisk: riskScoreSchema,
    reviewDate: z.string(),
    owner: z.string(),
  })
  .superRefine((entry, ctx) => {
    const match = findSubCategory(entry.categoryId, entry.subCategoryId);
    if (!match) {
      ctx.addIssue({
        code: 'custom',
        path: ['subCategoryId'],
        message: `Unterkategorie "${entry.subCategoryId}" ist unbekannt für Kategorie "${entry.categoryId}".`,
      });
    }
    if (entry.residualRisk > entry.auswirkung) {
      ctx.addIssue({
        code: 'custom',
        path: ['residualRisk'],
        message: 'Restrisiko darf nicht höher als die ursprüngliche Auswirkung sein.',
      });
    }
  });

export const riskCatalogExportSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  entries: z.array(riskEntrySchema),
});

export type RiskCatalogExport = z.infer<typeof riskCatalogExportSchema>;

export function parseRiskEntry(raw: unknown): RiskEntry {
  return riskEntrySchema.parse(raw) as RiskEntry;
}

export function safeParseRiskEntry(raw: unknown) {
  return riskEntrySchema.safeParse(raw);
}

/**
 * Sanity-Check beim Modul-Laden: alle Taxonomie-Einträge sind intern konsistent.
 * Läuft einmal beim Import des Schema-Moduls und würde bei Inkonsistenz einen
 * Start­fehler werfen.
 */
function assertTaxonomyIntegrity(): void {
  const ids = new Set<string>();
  for (const category of riskTaxonomy) {
    if (ids.has(category.id)) {
      throw new Error(`Doppelte Risiko-Kategorie-ID: ${category.id}`);
    }
    ids.add(category.id);

    const subIds = new Set<string>();
    for (const sub of category.subCategories) {
      if (subIds.has(sub.id)) {
        throw new Error(`Doppelte Unterkategorie "${sub.id}" in Kategorie "${category.id}"`);
      }
      subIds.add(sub.id);
    }
  }
}

assertTaxonomyIntegrity();
