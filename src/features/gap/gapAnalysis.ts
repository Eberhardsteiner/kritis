import type {
  DomainScore,
  EffortConfidence,
  EffortEstimate,
  EvidenceItem,
  GapAnalysisByRegime,
  GapAnalysisEntry,
  GapAnalysisSummary,
  RegulatoryRegimeDefinition,
  RequirementDefinition,
  RequirementStatus,
  ResolvedActivityHours,
} from '../../types';

type RequirementEffortSize = 'small' | 'medium' | 'large';

const BASE_PERSON_DAYS: Record<RequirementEffortSize, number> = {
  small: 2,
  medium: 5,
  large: 10,
};

/**
 * Ordnet Requirement-Kategorien einer Grössenklasse zu. Konservativ gewählt —
 * besser 10 PT konservativ als 6 PT optimistisch.
 */
const CATEGORY_SIZE: Record<string, RequirementEffortSize> = {
  scope: 'small',
  registration: 'small',
  governance: 'small',
  risk: 'medium',
  plan: 'medium',
  evidence: 'medium',
  incident: 'medium',
  reporting_channel: 'medium',
  special_measures: 'medium',
  measures: 'large',
};

const STATUS_GAP_FACTOR: Record<RequirementStatus, number> = {
  open: 1,
  in_progress: 0.5,
  ready: 0.1,
  not_applicable: 0,
};

const MAPPING_REDUCTION_PER_PRIMARY = 0.1;
const MAPPING_REDUCTION_CAP = 0.3;
const EVIDENCE_REDUCTION_PER_ITEM = 0.05;
const EVIDENCE_REDUCTION_CAP = 0.2;
const MIN_GAP_FLOOR = 0.1;

/**
 * Mappt eine Requirement-Kategorie auf eine Domain-ID aus baseDomains.
 * Wird genutzt, um pro Anforderung den passenden Domain-Score aus der
 * Grundanalyse für den Status-Vorschlag (`deriveStatusFromDomainScore`)
 * nachzuschlagen.
 *
 * Heuristik:
 * - Compliance-/Verwaltungs-Aspekte (scope, registration, governance, risk,
 *   evidence) → governance (Führung & Governance)
 * - Krisen-/Notfall-Aspekte (plan, incident, reporting_channel) → bcm
 *   (Krisenmanagement & Kommunikation)
 * - Maßnahmen-/Sicherheits-Aspekte (measures, special_measures) → cyber
 *   (IT, Daten & Cyber)
 *
 * Bei unbekannten Kategorien fällt das Mapping auf 'governance' zurück —
 * die sicherste Default-Annahme für Compliance-Anforderungen.
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

function resolveDomainId(category: string | undefined): string {
  if (!category) {
    return 'governance';
  }
  return REQUIREMENT_CATEGORY_TO_DOMAIN[category] ?? 'governance';
}

/**
 * Leitet einen Anforderungs-Status-Vorschlag aus dem Domain-Score ab.
 * Hohe Domain-Scores signalisieren, dass der Tenant in der zugehörigen
 * Domäne reif ist – also vermutlich auch die zugehörigen Anforderungen
 * weitgehend erfüllt sind.
 *
 * Schwellen (in C5.4.2 mit Dr. Steiner abgestimmt):
 *  - Score ≥ 75 % → 'ready' (Anforderung weitgehend erfüllt, nur Pflege
 *    notwendig — Gap-Faktor 0.1, also 10 % der Bandbreite)
 *  - Score 50–74 % → 'in_progress' (in Bearbeitung, signifikanter
 *    Restaufwand — Gap-Faktor 0.5, also 50 % der Bandbreite)
 *  - Score < 50 % → 'open' (Volle Umsetzung erforderlich — Gap-Faktor
 *    1.0, also 100 % der Bandbreite)
 *  - Score undefined → 'open' (Default für Tenants ohne Grundanalyse —
 *    bestandskonform mit Vor-C5.4.2-Verhalten)
 *
 * Wenn explizit ein Status in `requirementStates` gesetzt ist, hat dieser
 * Vorrang vor dem Vorschlag (User-Override schlägt Heuristik). Das wird
 * in `computeGapAnalysis` berücksichtigt.
 */
export function deriveStatusFromDomainScore(score: number | undefined): RequirementStatus {
  if (score === undefined) return 'open';
  if (score >= 75) return 'ready';
  if (score >= 50) return 'in_progress';
  return 'open';
}

function resolveSize(category: string | undefined): RequirementEffortSize {
  if (!category) {
    return 'medium';
  }
  return CATEGORY_SIZE[category] ?? 'medium';
}

function countPrimaryMappings(requirement: RequirementDefinition): number {
  return (requirement.mappedControls ?? []).filter((entry) => entry.relevance === 'primary').length;
}

function countRelatedEvidence(
  requirement: RequirementDefinition,
  evidence: EvidenceItem[],
): number {
  return evidence.filter((item) => item.relatedRequirementIds?.includes(requirement.id)).length;
}

function pickConfidence(params: {
  primaryMappings: number;
  evidenceCount: number;
  currentStatus: RequirementStatus;
}): EffortConfidence {
  if (params.currentStatus === 'not_applicable') {
    return 'high';
  }
  if (params.primaryMappings >= 1 && params.evidenceCount >= 1) {
    return 'high';
  }
  if (params.primaryMappings >= 2) {
    return 'high';
  }
  if (params.primaryMappings >= 1 || params.evidenceCount >= 1) {
    return 'medium';
  }
  return 'low';
}

function buildEstimate(params: {
  requirement: RequirementDefinition;
  currentStatus: RequirementStatus;
  primaryMappings: number;
  evidenceCount: number;
  /**
   * `true`, wenn `currentStatus` aus dem Domain-Score abgeleitet wurde
   * (kein expliziter `requirementStates`-Eintrag). Steuert den
   * Transparenz-Hinweis in der Assumptions-Liste.
   */
  statusDerivedFromGrundanalyse: boolean;
  domainScore?: number;
  domainId?: string;
}): EffortEstimate {
  const {
    requirement,
    currentStatus,
    primaryMappings,
    evidenceCount,
    statusDerivedFromGrundanalyse,
    domainScore,
    domainId,
  } = params;

  // Gap-Faktor nur noch aus Status (nicht mehr Domain-Modulator-multipliziert).
  // Status selbst kommt entweder explizit aus requirementStates oder über
  // deriveStatusFromDomainScore aus der Grundanalyse — siehe computeGapAnalysis.
  const baseGap = STATUS_GAP_FACTOR[currentStatus] ?? 1;
  const mappingReduction = Math.min(
    MAPPING_REDUCTION_CAP,
    primaryMappings * MAPPING_REDUCTION_PER_PRIMARY,
  );
  const evidenceReduction = Math.min(
    EVIDENCE_REDUCTION_CAP,
    evidenceCount * EVIDENCE_REDUCTION_PER_ITEM,
  );

  const rawGap = baseGap - mappingReduction - evidenceReduction;
  const gap =
    currentStatus === 'not_applicable' || baseGap === 0
      ? 0
      : Math.max(MIN_GAP_FLOOR, rawGap);

  // ─── Branch 1: explizite effortBreakdown-Aufschlüsselung ────────────
  // Wenn der Requirement einen ausgearbeiteten Breakdown hat, nutzen wir
  // dessen Min/Max-PT als Basis und multiplizieren mit dem sauberen
  // Status-basierten Gap-Faktor. Konzeptionell: „Bei Status `ready`
  // brauchen wir nur 10 % der Tätigkeitsstunden für Pflege, bei
  // `in_progress` 50 % als Restaufwand, bei `open` die volle Bandbreite."
  const breakdown = requirement.effortBreakdown;
  if (breakdown) {
    const minPersonDaysRaw =
      currentStatus === 'not_applicable' || baseGap === 0 ? 0 : breakdown.minPersonDays * gap;
    const maxPersonDaysRaw =
      currentStatus === 'not_applicable' || baseGap === 0 ? 0 : breakdown.maxPersonDays * gap;
    const minPersonDays = Number(minPersonDaysRaw.toFixed(2));
    const maxPersonDays = Number(maxPersonDaysRaw.toFixed(2));
    const personDays = Number(((minPersonDays + maxPersonDays) / 2).toFixed(2));

    const assumptions: string[] = [
      `Breakdown ${breakdown.minPersonDays} – ${breakdown.maxPersonDays} PT aus ${breakdown.activities.length} Tätigkeit${breakdown.activities.length === 1 ? '' : 'en'}`,
      `Gap-Faktor ${baseGap.toFixed(2)} (Status: ${currentStatus})`,
    ];
    if (statusDerivedFromGrundanalyse && domainScore !== undefined) {
      const domainHint = domainId ? ` in ${domainId}` : '';
      assumptions.push(
        `Status aus Grundanalyse abgeleitet: ${currentStatus} (Domain-Score ${Math.round(domainScore)} %${domainHint})`,
      );
    }
    if (mappingReduction > 0) {
      assumptions.push(
        `Reduktion durch ${primaryMappings} primary-Mapping${primaryMappings === 1 ? '' : 's'}: -${mappingReduction.toFixed(2)}`,
      );
    }
    if (evidenceReduction > 0) {
      assumptions.push(
        `Reduktion durch ${evidenceCount} Evidenz${evidenceCount === 1 ? '' : 'en'}: -${evidenceReduction.toFixed(2)}`,
      );
    }
    if (breakdown.sourceNote) {
      assumptions.push(breakdown.sourceNote);
    }

    // C5.4.4: Pro Tätigkeit Brutto + Netto/Restaufwand. Brutto-Stunden
    // bleiben unverändert (Beratungs-Aufwand-Begründung), Effective-
    // Stunden werden mit dem gleichen Gap-Faktor wie der Header
    // skaliert. Damit summiert sich die Effective-Spalte auf
    // `minPersonDays * 8` bzw. `maxPersonDays * 8` — mathematisch
    // konsistent mit dem Anforderungs-Header.
    const isZeroBranch = currentStatus === 'not_applicable' || baseGap === 0;
    const resolvedActivities: ResolvedActivityHours[] = breakdown.activities.map((activity) => ({
      label: activity.label,
      minHoursRaw: activity.minHours,
      maxHoursRaw: activity.maxHours,
      minHoursEffective: isZeroBranch ? 0 : Number((activity.minHours * gap).toFixed(2)),
      maxHoursEffective: isZeroBranch ? 0 : Number((activity.maxHours * gap).toFixed(2)),
      note: activity.note,
    }));

    // Plausibilitäts-Sanity-Check: Summe der Effective-Stunden muss
    // mit `minPersonDays * 8` / `maxPersonDays * 8` übereinstimmen
    // (Toleranz 0.1h). Schützt vor Drift bei zukünftigen Änderungen
    // an `gap` oder Bandbreiten-Berechnung. Im Production-Build wird
    // der Block durch Vite-Define entfernt — `__DEV__` ist hier ein
    // Type-Cast, weil tsc `import.meta.env` nicht ohne `vite/client`
    // kennt; zur Laufzeit liefert Vite die Variable wie üblich.
    const __DEV__ = (import.meta as { env?: { DEV?: boolean } }).env?.DEV ?? false;
    if (__DEV__) {
      const sumMinHoursEff = resolvedActivities.reduce(
        (sum, activity) => sum + activity.minHoursEffective,
        0,
      );
      const sumMaxHoursEff = resolvedActivities.reduce(
        (sum, activity) => sum + activity.maxHoursEffective,
        0,
      );
      const expectedMinHoursEff = minPersonDays * 8;
      const expectedMaxHoursEff = maxPersonDays * 8;
      if (Math.abs(sumMinHoursEff - expectedMinHoursEff) > 0.1) {
        // eslint-disable-next-line no-console
        console.warn(
          `[gapAnalysis] resolvedActivities min-Summe (${sumMinHoursEff} h) ≠ minPersonDays*8 (${expectedMinHoursEff} h) für ${requirement.id}`,
        );
      }
      if (Math.abs(sumMaxHoursEff - expectedMaxHoursEff) > 0.1) {
        // eslint-disable-next-line no-console
        console.warn(
          `[gapAnalysis] resolvedActivities max-Summe (${sumMaxHoursEff} h) ≠ maxPersonDays*8 (${expectedMaxHoursEff} h) für ${requirement.id}`,
        );
      }
    }

    return {
      personDays,
      minPersonDays,
      maxPersonDays,
      confidence: pickConfidence({ primaryMappings, evidenceCount, currentStatus }),
      assumptions,
      activities: breakdown.activities,
      resolvedActivities,
      drivers: breakdown.drivers,
      source: 'breakdown',
    };
  }

  // ─── Branch 2: Heuristik-Fallback (ohne effortBreakdown) ────────────
  const size = resolveSize(requirement.category);
  const basePersonDays = BASE_PERSON_DAYS[size];

  const personDays = Number((basePersonDays * gap).toFixed(1));

  const assumptions: string[] = [
    `Basis-Aufwand ${basePersonDays} PT (Kategorie ${size})`,
    `Gap-Faktor ${baseGap.toFixed(2)} (Status: ${currentStatus})`,
  ];
  if (statusDerivedFromGrundanalyse && domainScore !== undefined) {
    const domainHint = domainId ? ` in ${domainId}` : '';
    assumptions.push(
      `Status aus Grundanalyse abgeleitet: ${currentStatus} (Domain-Score ${Math.round(domainScore)} %${domainHint})`,
    );
  }
  if (mappingReduction > 0) {
    assumptions.push(
      `Reduktion durch ${primaryMappings} primary-Mapping${primaryMappings === 1 ? '' : 's'}: -${mappingReduction.toFixed(2)}`,
    );
  }
  if (evidenceReduction > 0) {
    assumptions.push(
      `Reduktion durch ${evidenceCount} Evidenz${evidenceCount === 1 ? '' : 'en'}: -${evidenceReduction.toFixed(2)}`,
    );
  }
  if (gap > 0 && gap === MIN_GAP_FLOOR && rawGap < MIN_GAP_FLOOR) {
    assumptions.push(`Mindest-Gap-Faktor ${MIN_GAP_FLOOR.toFixed(2)} greift (Integrations- und Nachweispflege)`);
  }

  return {
    personDays,
    confidence: pickConfidence({ primaryMappings, evidenceCount, currentStatus }),
    assumptions,
    source: 'heuristic',
  };
}

export interface ComputeGapAnalysisArgs {
  requirements: RequirementDefinition[];
  requirementStates: Record<string, RequirementStatus>;
  evidenceItems: EvidenceItem[];
  regimeDefinitions: RegulatoryRegimeDefinition[];
  /**
   * Optionale Domain-Scores aus der Grundanalyse. Wenn übergeben, leiten
   * sie pro Anforderung einen Status-Vorschlag ab über
   * `deriveStatusFromDomainScore`:
   *  - Score ≥ 75 % → ready (10 % der Bandbreite, nur Pflege)
   *  - Score 50–74 % → in_progress (50 % der Bandbreite)
   *  - Score < 50 % → open (volle Bandbreite)
   *
   * Ein expliziter Eintrag in `requirementStates` schlägt den Vorschlag
   * (User-Override). Wenn `domainScores` weggelassen oder leer ist,
   * bleiben alle Anforderungen ohne expliziten Status auf 'open' —
   * bestandskompatibel mit der Vor-C5.4.2-Berechnung.
   *
   * Hinweis: Bis v0.9.25 funktionierte dieser Parameter über einen
   * Domain-Modulator (1.0–1.5), der den Gap-Faktor multiplizierte.
   * Dieser Mechanismus war konzeptionell falsch und wurde in C5.4.2
   * durch den Status-Vorschlag-Mechanismus ersetzt.
   */
  domainScores?: DomainScore[];
}

/**
 * Berechnet pro Requirement einen GapAnalysisEntry und aggregiert pro Regime.
 * Restaufwand in Personentagen, Summe pro Regime und Gesamtsumme.
 */
export function computeGapAnalysis(args: ComputeGapAnalysisArgs): GapAnalysisSummary {
  const { requirements, requirementStates, evidenceItems, regimeDefinitions, domainScores } = args;
  const regimeLabelById = new Map(regimeDefinitions.map((def) => [def.id, def.shortLabel]));
  const domainScoreById = new Map(
    (domainScores ?? []).map((entry) => [entry.domainId, entry.score]),
  );
  const hasDomainScores = (domainScores?.length ?? 0) > 0;

  const entries: GapAnalysisEntry[] = requirements.map((requirement) => {
    const explicitStatus = requirementStates[requirement.id];
    const domainId = resolveDomainId(requirement.category);
    const domainScore = hasDomainScores ? domainScoreById.get(domainId) : undefined;

    // Status-Auflösung (C5.4.2): Expliziter `requirementStates`-Eintrag
    // hat Vorrang. Sonst Vorschlag aus Grundanalyse über
    // `deriveStatusFromDomainScore`. Ohne Grundanalyse fällt der Default
    // auf 'open' (bestandskompatibel mit Vor-C5.4.2).
    const currentStatus: RequirementStatus =
      explicitStatus ?? deriveStatusFromDomainScore(domainScore);
    const statusDerivedFromGrundanalyse =
      explicitStatus === undefined && domainScore !== undefined;

    const primaryMappings = countPrimaryMappings(requirement);
    const evidenceCount = countRelatedEvidence(requirement, evidenceItems);
    const effortEstimate = buildEstimate({
      requirement,
      currentStatus,
      primaryMappings,
      evidenceCount,
      statusDerivedFromGrundanalyse,
      domainScore,
      domainId: hasDomainScores ? domainId : undefined,
    });
    return {
      requirementId: requirement.id,
      regimeId: requirement.regimeId,
      category: requirement.category ?? 'general',
      currentStatus,
      targetStatus: 'ready',
      effortEstimate,
      dependencies: [],
    };
  });

  const byRegime: GapAnalysisByRegime[] = regimeDefinitions.map((definition) => {
    const regimeEntries = entries.filter((entry) => entry.regimeId === definition.id);
    const totalPersonDays = Number(
      regimeEntries.reduce((sum, entry) => sum + entry.effortEstimate.personDays, 0).toFixed(1),
    );
    // Min/Max-Aggregation: Anforderungen mit Breakdown tragen Min/Max
    // separat bei; Anforderungen mit Heuristik tragen `personDays` zu
    // beiden Aggregaten bei (point-Estimate ohne Bandbreite).
    const minPersonDays = Number(
      regimeEntries
        .reduce(
          (sum, entry) =>
            sum + (entry.effortEstimate.minPersonDays ?? entry.effortEstimate.personDays),
          0,
        )
        .toFixed(2),
    );
    const maxPersonDays = Number(
      regimeEntries
        .reduce(
          (sum, entry) =>
            sum + (entry.effortEstimate.maxPersonDays ?? entry.effortEstimate.personDays),
          0,
        )
        .toFixed(2),
    );
    const byCategory: Record<string, number> = {};
    for (const entry of regimeEntries) {
      byCategory[entry.category] = Number(
        ((byCategory[entry.category] ?? 0) + entry.effortEstimate.personDays).toFixed(1),
      );
    }
    return {
      regimeId: definition.id,
      regimeLabel: regimeLabelById.get(definition.id) ?? definition.label,
      totalPersonDays,
      minPersonDays,
      maxPersonDays,
      byCategory,
      entries: regimeEntries,
    };
  });

  const totalPersonDays = Number(
    byRegime.reduce((sum, regime) => sum + regime.totalPersonDays, 0).toFixed(1),
  );
  const minPersonDays = Number(
    byRegime.reduce((sum, regime) => sum + regime.minPersonDays, 0).toFixed(2),
  );
  const maxPersonDays = Number(
    byRegime.reduce((sum, regime) => sum + regime.maxPersonDays, 0).toFixed(2),
  );

  return {
    totalPersonDays,
    minPersonDays,
    maxPersonDays,
    calendarWeeks: Math.ceil(totalPersonDays / 5),
    entryCount: entries.length,
    byRegime,
  };
}

export function getConfidenceLabel(confidence: EffortConfidence): string {
  if (confidence === 'high') {
    return 'Hoch';
  }
  if (confidence === 'medium') {
    return 'Mittel';
  }
  return 'Niedrig';
}
