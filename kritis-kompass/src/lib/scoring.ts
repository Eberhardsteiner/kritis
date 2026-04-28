// Aus src/lib/scoring.ts der Altapp uebernommen.
// Behalten: getMaturityLabel, computeScoreSnapshot, assessKritisApplicability.
// Weggelassen: getRequirementProgress, getActionSummary, getEvidenceSummary,
// getCertificationProgress, getChecklistProgress, getAuditFindingSummary,
// getGovernanceSummary, getResilienceSummary, buildBenchmarkSnapshot,
// buildLinkedCountMap.
// getDomainWeight ist hier inline gestubt statt aus moduleRegistry zu ziehen.
// TODO Phase 3-4: ggf. weitere Scoring-Helfer zurueckholen.

import { baseDomains } from '../data/baseDomains';
import { KRITIS_ELIGIBLE_SECTORS, maturityBands } from '../data/kritisBase';
import type {
  AnswerEntry,
  CompanyProfile,
  DomainScore,
  JurisdictionCode,
  KritisApplicability,
  QuestionDefinition,
  ScoreSnapshot,
  SectorModuleDefinition,
} from '../types';

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

// Stub fuer getDomainWeight aus moduleRegistry — liest nur das
// DomainWeightAdjustment des aktuellen Moduls oder gibt 1.0 zurueck.
// Reicht fuer das Skelett; in Phase 3-4 ggf. um Overlay-Logik ergaenzen.
function getDomainWeight(domainId: string, module?: SectorModuleDefinition): number {
  return module?.domainWeightAdjustments?.[domainId] ?? 1;
}

export function getMaturityLabel(score: number): string {
  let current = maturityBands[0].label;
  for (const band of maturityBands) {
    if (score >= band.min) {
      current = band.label;
    }
  }
  return current;
}

export function computeScoreSnapshot(
  questions: QuestionDefinition[],
  answers: Record<string, AnswerEntry>,
  module?: SectorModuleDefinition,
): ScoreSnapshot {
  const domainScores: DomainScore[] = baseDomains.map((domain) => {
    const relevantQuestions = questions.filter((question) => question.domainId === domain.id);
    const adjustedWeights = relevantQuestions.map(
      (question) => question.weight * getDomainWeight(domain.id, module),
    );

    let answeredWeight = 0;
    let achievedWeight = 0;
    let answeredCount = 0;

    relevantQuestions.forEach((question, index) => {
      const answer = answers[question.id];
      const score = answer?.score;
      const adjustedWeight = adjustedWeights[index];

      if (score !== null && score !== undefined) {
        answeredCount += 1;
        answeredWeight += adjustedWeight;
        achievedWeight += (score / 4) * adjustedWeight;
      }
    });

    const score = answeredWeight > 0 ? round((achievedWeight / answeredWeight) * 100) : 0;
    const completion = relevantQuestions.length
      ? round((answeredCount / relevantQuestions.length) * 100)
      : 0;

    return {
      domainId: domain.id,
      label: domain.label,
      score,
      completion,
      answeredCount,
      totalCount: relevantQuestions.length,
    };
  });

  let totalQuestions = 0;
  let totalAnswered = 0;
  let totalAnsweredWeight = 0;
  let totalAchievedWeight = 0;

  questions.forEach((question) => {
    totalQuestions += 1;
    const answer = answers[question.id];
    const score = answer?.score;
    const adjustedWeight = question.weight * getDomainWeight(question.domainId, module);

    if (score !== null && score !== undefined) {
      totalAnswered += 1;
      totalAnsweredWeight += adjustedWeight;
      totalAchievedWeight += (score / 4) * adjustedWeight;
    }
  });

  const overallScore =
    totalAnsweredWeight > 0 ? round((totalAchievedWeight / totalAnsweredWeight) * 100) : 0;
  const completion = totalQuestions ? round((totalAnswered / totalQuestions) * 100) : 0;
  const maturityLabel = getMaturityLabel(overallScore);

  const domainLookup = new Map(baseDomains.map((domain) => [domain.id, domain.label]));
  const recommendations = questions
    .map((question) => {
      const answer = answers[question.id];
      const score = answer?.score ?? 0;
      const adjustedWeight = question.weight * getDomainWeight(question.domainId, module);
      const gap = 1 - score / 4;
      const priorityValue = gap * adjustedWeight * (question.critical ? 1.2 : 1);

      return {
        questionId: question.id,
        title: question.title,
        domainId: question.domainId,
        domainLabel: domainLookup.get(question.domainId) ?? question.domainId,
        action: question.recommendation,
        rationale:
          score === 0
            ? 'Aktuell keine belastbare Ausprägung dokumentiert.'
            : score <= 1
              ? 'Ausprägung ist noch sehr lückenhaft und im Krisenfall unsicher.'
              : 'Ausprägung ist vorhanden, aber für robuste Krisenfestigkeit noch nicht ausreichend.',
        urgency: (priorityValue >= 1.25
          ? 'hoch'
          : priorityValue >= 0.8
            ? 'mittel'
            : 'niedrig') as 'hoch' | 'mittel' | 'niedrig',
        priorityValue,
      };
    })
    .sort((a, b) => b.priorityValue - a.priorityValue)
    .slice(0, 6)
    .map(({ priorityValue: _priorityValue, ...item }) => item);

  return {
    overallScore,
    completion,
    maturityLabel,
    domainScores,
    recommendations,
  };
}

function normalizePersonsServed(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const digits = value.replace(/[^\d]/g, '');
  if (!digits) {
    return null;
  }

  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeEmployeeCount(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const digits = value.replace(/[^\d]/g, '');
  if (!digits) {
    return null;
  }

  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

const AUSTRIA_NIS_SECTORS = [
  'Energie',
  'Verkehr',
  'Bankwesen',
  'Finanzmarktinfrastrukturen',
  'Gesundheit',
  'Trinkwasser',
  'Abwasser',
  'Digitale Infrastruktur',
  'Öffentliche Verwaltung',
  'Weltraum',
  'Post und Kurierdienste',
  'Abfallbewirtschaftung',
  'Lebensmittel',
  'Verarbeitendes Gewerbe',
  'Forschung',
];

const SWITZERLAND_CRITICAL_SECTORS = [
  'Energie',
  'Trinkwasser',
  'Gesundheit',
  'Information und Kommunikation',
  'IT und Telekommunikation',
  'Ernährung',
  'Transport und Verkehr',
  'Öffentliche Verwaltung',
  'Siedlungsabfallentsorgung',
  'Finanz- und Versicherungswesen',
];

export function assessKritisApplicability(
  profile: CompanyProfile,
  module?: SectorModuleDefinition,
  jurisdiction: JurisdictionCode = 'DE',
): KritisApplicability {
  const sectorHints = new Set<string>([
    ...(module?.kritisExtension?.eligibleSectors ?? []),
    ...(module?.sectorCategory ? [module.sectorCategory] : []),
  ]);
  const normalizedHints = [...sectorHints].map((entry) => entry.trim());
  const personsServed = normalizePersonsServed(profile.personsServed);
  const employees = normalizeEmployeeCount(profile.employees);
  const hasCriticalService = Boolean(profile.criticalService.trim());

  if (jurisdiction === 'AT') {
    const sectorEligible = normalizedHints.some(
      (entry) => AUSTRIA_NIS_SECTORS.includes(entry) || KRITIS_ELIGIBLE_SECTORS.includes(entry),
    );
    if (sectorEligible && (hasCriticalService || employees !== null)) {
      return {
        status: 'prüfbedürftig',
        title: 'NISG-2026-Relevanz prüfen',
        text: 'Sektor oder Dienst sprechen für eine Prüfung nach dem österreichischen NISG 2026. Für die Einordnung als wesentliche oder wichtige Einrichtung sollten insbesondere Größe, Ausnahmebestände und konkrete Dienste geprüft werden.',
      };
    }
    return {
      status: 'eher_unwahrscheinlich',
      title: 'Derzeit eher keine NISG-2026-Relevanz erkennbar',
      text: 'Auf Basis der bisherigen Angaben ist eine Betroffenheit nach dem österreichischen NISG 2026 derzeit nicht naheliegend. Bei geänderten Diensten, Standorten oder Größenmerkmalen sollte die Einordnung erneut geprüft werden.',
    };
  }

  if (jurisdiction === 'CH') {
    const sectorEligible = normalizedHints.some(
      (entry) => SWITZERLAND_CRITICAL_SECTORS.includes(entry) || KRITIS_ELIGIBLE_SECTORS.includes(entry),
    );
    if (sectorEligible && hasCriticalService) {
      return {
        status: 'wahrscheinlich',
        title: 'Meldepflicht in der Schweiz wahrscheinlich relevant',
        text: 'Sektor und kritische Dienstleistung sprechen dafür, die schweizerische Meldepflicht für Cyberangriffe auf kritische Infrastrukturen vertieft zu prüfen und organisatorisch vorzubereiten.',
      };
    }
    if (sectorEligible || hasCriticalService) {
      return {
        status: 'prüfbedürftig',
        title: 'Schweizer Meldepflicht prüfen',
        text: 'Es liegen Indikatoren für eine Einordnung als kritische Infrastruktur vor. Die Meldepflicht gegenüber dem BACS sollte anhand des betroffenen Dienstes und der organisatorischen Rolle geprüft werden.',
      };
    }
    return {
      status: 'eher_unwahrscheinlich',
      title: 'Derzeit eher keine schweizerische Meldepflicht erkennbar',
      text: 'Auf Basis der bisherigen Angaben ist eine Meldepflicht nach schweizerischem Informationssicherheitsrecht derzeit nicht naheliegend. Die Einschätzung sollte bei neuen kritischen Diensten neu bewertet werden.',
    };
  }

  const sectorEligible = normalizedHints.some((entry) => KRITIS_ELIGIBLE_SECTORS.includes(entry));
  if (sectorEligible && personsServed !== null && personsServed >= 500000) {
    return {
      status: 'wahrscheinlich',
      title: 'Wahrscheinlich KRITIS-relevant',
      text: 'Sektor und Versorgungsreichweite sprechen für eine vertiefte KRITIS-Prüfung mit konkreter Anlagen- und Dienstleistungsbetrachtung.',
    };
  }

  if (sectorEligible || hasCriticalService || (personsServed !== null && personsServed >= 500000)) {
    return {
      status: 'prüfbedürftig',
      title: 'KRITIS-Relevanz prüfen',
      text: 'Es liegen Indikatoren für eine KRITIS-Einstufung vor. Die konkrete Einordnung sollte anhand der betroffenen Anlage, Dienstleistung und Schwellenwerte geprüft werden.',
    };
  }

  return {
    status: 'eher_unwahrscheinlich',
    title: 'Derzeit eher nicht KRITIS-relevant',
    text: 'Auf Basis der bisherigen Angaben ist eine KRITIS-Einstufung derzeit nicht naheliegend. Die Einordnung sollte bei geänderten Leistungen oder Reichweiten neu geprüft werden.',
  };
}
