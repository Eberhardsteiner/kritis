import { resiliencePlanExportSchema, resiliencePlanSchema } from '../schema';
import type { ResiliencePlan } from '../types';

/**
 * JSON-Renderer: erzeugt einen Zod-validierten Export-Container mit Version 1
 * und Zeitstempel. Rückgabe ist ein JSON-String, der mit
 * parseResiliencePlanImport() wieder eingelesen werden kann.
 */

export interface RenderJsonOptions {
  generatedAt?: Date;
  pretty?: boolean;
}

export function renderResiliencePlanJson(plan: ResiliencePlan, options: RenderJsonOptions = {}): string {
  const validatedPlan = resiliencePlanSchema.parse(plan);
  const container = {
    version: 1 as const,
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    plan: validatedPlan,
  };
  return JSON.stringify(container, null, options.pretty === false ? undefined : 2);
}

export function renderResiliencePlanJsonBlob(plan: ResiliencePlan, options: RenderJsonOptions = {}): Blob {
  const payload = renderResiliencePlanJson(plan, options);
  return new Blob([payload], { type: 'application/json' });
}

export function parseResiliencePlanImport(raw: unknown): ResiliencePlan {
  const parsed = resiliencePlanExportSchema.parse(raw);
  return parsed.plan as ResiliencePlan;
}

export function safeParseResiliencePlanImport(raw: unknown) {
  return resiliencePlanExportSchema.safeParse(raw);
}

export function buildResiliencePlanJsonFileName(
  operatorName: string,
  version: string,
  generatedAt: Date = new Date(),
): string {
  const slug = (operatorName || 'mandant')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'mandant';
  const dateSlug = generatedAt.toISOString().slice(0, 10);
  const versionSlug = version.replace(/[^a-z0-9.]/gi, '-');
  return `Resilienzplan-${slug}-v${versionSlug}-${dateSlug}.json`;
}
