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
 * Maximaler Aufschlag durch den Domain-Score-Modulator. Bei Domain-Score 0 %
 * wird der Gap-Faktor um 50 % erhöht (Modulator 1.5), bei Domain-Score 100 %
 * bleibt der Gap-Faktor unverändert (Modulator 1.0). Linear interpoliert.
 *
 * Hintergrund: Schlechte Antworten in der Grundanalyse signalisieren niedrige
 * Reife und damit Mehraufwand bei der Umsetzung der Compliance-Anforderungen.
 * Der Anforderungs-Status bleibt aber der dominante Treiber — der Modulator
 * ist nur eine Feinjustierung um bis zu ±50 %, nicht der Haupt-Hebel.
 */
const DOMAIN_MODULATOR_MAX_SURCHARGE = 0.5;

/**
 * Mappt eine Requirement-Kategorie auf eine Domain-ID aus baseDomains.
 * Wird genutzt, um pro Anforderung den passenden Domain-Score aus der
 * Grundanalyse für den Modulator nachzuschlagen.
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

function computeDomainModulator(domainScore: number | undefined): number {
  if (domainScore === undefined) {
    return 1;
  }
  const clamped = Math.max(0, Math.min(100, domainScore));
  return 1 + (1 - clamped / 100) * DOMAIN_MODULATOR_MAX_SURCHARGE;
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
  domainScore?: number;
  domainId?: string;
}): EffortEstimate {
  const { requirement, currentStatus, primaryMappings, evidenceCount, domainScore, domainId } =
    params;

  const baseGap = STATUS_GAP_FACTOR[currentStatus] ?? 1;
  const domainModulator = computeDomainModulator(domainScore);
  const mappingReduction = Math.min(
    MAPPING_REDUCTION_CAP,
    primaryMappings * MAPPING_REDUCTION_PER_PRIMARY,
  );
  const evidenceReduction = Math.min(
    EVIDENCE_REDUCTION_CAP,
    evidenceCount * EVIDENCE_REDUCTION_PER_ITEM,
  );

  const rawGap = baseGap * domainModulator - mappingReduction - evidenceReduction;
  const gap =
    currentStatus === 'not_applicable' || baseGap === 0
      ? 0
      : Math.max(MIN_GAP_FLOOR, rawGap);

  // ─── Branch 1: explizite effortBreakdown-Aufschlüsselung ────────────
  // Wenn der Requirement einen ausgearbeiteten Breakdown hat, nutzen wir
  // dessen Min/Max-PT als Basis und multiplizieren mit demselben Gap-
  // Faktor (inkl. Domain-Modulator und Reduktionen wie bei der Heuristik).
  // Das gibt UVM-Angebotsgrundlagen mit verteidigbaren Bandbreiten und
  // Tätigkeits-Listen, statt einer einzelnen Heuristik-Zahl.
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
    if (domainScore !== undefined && domainModulator !== 1) {
      const surcharge = baseGap * domainModulator - baseGap;
      const domainHint = domainId ? ` (${domainId})` : '';
      assumptions.push(
        `Aufschlag durch Domain-Score ${Math.round(domainScore)} %${domainHint}: ${surcharge >= 0 ? '+' : ''}${surcharge.toFixed(2)}`,
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

    return {
      personDays,
      minPersonDays,
      maxPersonDays,
      confidence: pickConfidence({ primaryMappings, evidenceCount, currentStatus }),
      assumptions,
      activities: breakdown.activities,
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
  if (domainScore !== undefined && domainModulator !== 1) {
    const surcharge = baseGap * domainModulator - baseGap;
    const domainHint = domainId ? ` (${domainId})` : '';
    assumptions.push(
      `Aufschlag durch Domain-Score ${Math.round(domainScore)} %${domainHint}: ${surcharge >= 0 ? '+' : ''}${surcharge.toFixed(2)}`,
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
   * Optionale Domain-Scores aus der Grundanalyse. Wenn übergeben, modulieren
   * sie den Gap-Faktor pro Anforderung über `computeDomainModulator`:
   * Domain-Score 100 % → Modulator 1.0 (kein Aufschlag), Domain-Score 0 % →
   * Modulator 1.5 (50 % Aufschlag). Wenn weggelassen, bleibt das Verhalten
   * identisch zur Vor-v0.9.22-Berechnung (kein Modulator-Effekt) — damit
   * Bestands-Tests und Aufrufer ohne Grundanalyse weiterhin funktionieren.
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
    const currentStatus = requirementStates[requirement.id] ?? 'open';
    const primaryMappings = countPrimaryMappings(requirement);
    const evidenceCount = countRelatedEvidence(requirement, evidenceItems);
    const domainId = resolveDomainId(requirement.category);
    const domainScore = hasDomainScores ? domainScoreById.get(domainId) : undefined;
    const effortEstimate = buildEstimate({
      requirement,
      currentStatus,
      primaryMappings,
      evidenceCount,
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
