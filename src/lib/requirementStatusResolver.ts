/**
 * requirementStatusResolver.ts · Zentrale Auflösung von Anforderungs-Status
 *
 * Bis C5.4.2 leitete `computeGapAnalysis` als einzige Funktion einen
 * Status-Vorschlag aus dem Domain-Score der Grundanalyse ab. Alle
 * anderen Berechnungen (Reifegrad, Penalty, Reports, Markdown- und
 * PDF-Exports) arbeiteten weiterhin mit dem rohen `requirementStates`-
 * Map und ignorierten die Grundanalyse — Folge: das Dashboard zeigte
 * "Reife: 35 %" während die Gap-Analyse "3,4 – 6 PT" anzeigte (siehe
 * UVM-Demo-Audit von Dr. Steiner, C5.4.3).
 *
 * Dieser Helper konsolidiert die Auflösung an EINER Stelle, sodass
 * alle Consumer dieselbe Status-Map sehen. Die Hierarchie ist:
 *
 *   1. Expliziter Eintrag in `requirementStates` (User-Override).
 *      Auch der Wert 'open' zählt als explizit gesetzt — der User hat
 *      sich bewusst dafür entschieden.
 *   2. Status-Vorschlag aus `deriveStatusFromDomainScore` über das
 *      Kategorie→Domain-Mapping.
 *   3. Default 'open' (wenn weder Eintrag noch Domain-Score vorliegt).
 *
 * Wichtig: Die Prüfung "explizit gesetzt" läuft über `id in map`, nicht
 * über `?? 'open'`. Sonst würde ein bewusst auf 'open' gesetzter Eintrag
 * vom Domain-Score-Vorschlag überschrieben — Dr. Steiners Audit-Befund.
 */
import type {
  DomainScore,
  RequirementDefinition,
  RequirementStatus,
} from '../types';
import { deriveStatusFromDomainScore } from '../features/gap/gapAnalysis';

/**
 * Mappt eine Requirement-Kategorie auf eine Domain-ID aus der Grund-
 * analyse. Diese Map ist deckungsgleich zur Map in `gapAnalysis.ts`
 * (`REQUIREMENT_CATEGORY_TO_DOMAIN`). Sie wird hier dupliziert, damit
 * dieser Helper unabhängig von Internas der Gap-Analyse arbeitet —
 * Tests in `requirementStatusResolver.test.ts` verifizieren die
 * Übereinstimmung beider Maps.
 *
 * Heuristik:
 * - scope, registration, governance, risk, evidence → governance
 * - plan, incident, reporting_channel               → bcm
 * - measures, special_measures                      → cyber
 *
 * Bei unbekannten Kategorien fällt das Mapping auf 'governance' zurück.
 */
const REQUIREMENT_CATEGORY_TO_DOMAIN: Record<string, string> = {
  scope: 'governance',
  registration: 'governance',
  governance: 'governance',
  risk: 'governance',
  evidence: 'governance',
  plan: 'bcm',
  incident: 'bcm',
  reporting_channel: 'bcm',
  measures: 'cyber',
  special_measures: 'cyber',
};

export function resolveDomainIdForRequirement(category: string | undefined): string {
  if (!category) return 'governance';
  return REQUIREMENT_CATEGORY_TO_DOMAIN[category] ?? 'governance';
}

/**
 * Berechnet die effektive Status-Map pro Anforderung. Drop-in-Replacement
 * für `requirementStates` in allen nachgelagerten Berechnungen.
 *
 * Verhalten:
 *  - Ohne `domainScores` (oder leerer Liste) bleibt die Map unverändert
 *    (bestandskompatibel, Tenants ohne Grundanalyse).
 *  - Mit `domainScores` werden alle Anforderungen, deren ID NICHT
 *    explizit in `requirementStates` enthalten ist, mit dem aus dem
 *    passenden Domain-Score abgeleiteten Status aufgefüllt.
 *  - Explizit gesetzte Werte (auch 'open') bleiben erhalten — der
 *    User-Override schlägt immer den Vorschlag.
 */
export function buildEffectiveRequirementStates(params: {
  requirements: RequirementDefinition[];
  requirementStates: Record<string, RequirementStatus>;
  domainScores?: DomainScore[];
}): Record<string, RequirementStatus> {
  const { requirements, requirementStates, domainScores } = params;
  const result: Record<string, RequirementStatus> = { ...requirementStates };

  if (!domainScores || domainScores.length === 0) {
    return result;
  }

  const domainScoreById = new Map(
    domainScores.map((entry) => [entry.domainId, entry.score]),
  );

  for (const requirement of requirements) {
    // Explizit gesetzter Status hat Vorrang. Wir prüfen über `in`, NICHT
    // über `?? 'open'`, weil ein bewusst gesetztes 'open' explizit ist
    // und das Domain-Score-Vorschlag-Verfahren überschreiben muss.
    if (requirement.id in requirementStates) {
      continue;
    }
    const domainId = resolveDomainIdForRequirement(requirement.category);
    const domainScore = domainScoreById.get(domainId);
    result[requirement.id] = deriveStatusFromDomainScore(domainScore);
  }

  return result;
}
