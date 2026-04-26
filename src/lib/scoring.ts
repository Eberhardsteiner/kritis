import { baseDomains } from '../data/baseDomains';
import { defaultBenchmarkTargets } from '../data/governanceBase';
import { kritisCertificationStages, maturityBands, KRITIS_ELIGIBLE_SECTORS } from '../data/kritisBase';
import { getDomainWeight } from './moduleRegistry';
import type {
  ActionItem,
  ActionSummary,
  AnswerEntry,
  AuditChecklistItemDefinition,
  AuditChecklistState,
  AuditFindingItem,
  AuditFindingSummary,
  BenchmarkSnapshot,
  CertificationProgress,
  CertificationState,
  ChecklistProgress,
  CompanyProfile,
  DomainScore,
  EvidenceItem,
  EvidenceSummary,
  GovernanceSummary,
  KritisApplicability,
  QuestionDefinition,
  RequirementDefinition,
  RequirementStatus,
  ReviewPlan,
  ScoreSnapshot,
  SectorModuleDefinition,
  SiteItem,
  StakeholderItem,
  AssetItem,
  BusinessProcessItem,
  DependencyItem,
  ScenarioItem,
  ExerciseItem,
  JurisdictionCode,
  ResilienceSummary,
} from '../types';

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
    const adjustedWeights = relevantQuestions.map((question) => question.weight * getDomainWeight(domain.id, module));

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

  const overallScore = totalAnsweredWeight > 0 ? round((totalAchievedWeight / totalAnsweredWeight) * 100) : 0;
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
        urgency: (
          priorityValue >= 1.25 ? 'hoch' : priorityValue >= 0.8 ? 'mittel' : 'niedrig'
        ) as 'hoch' | 'mittel' | 'niedrig',
        priorityValue,
      };
    })
    .sort((a, b) => b.priorityValue - a.priorityValue)
    .slice(0, 6)
    .map(({ priorityValue, ...item }) => item);

  return {
    overallScore,
    completion,
    maturityLabel,
    domainScores,
    recommendations,
  };
}

export function getRequirementProgress(
  requirements: RequirementDefinition[],
  requirementStates: Record<string, RequirementStatus>,
): { score: number; openCount: number; readyCount: number } {
  let maxPoints = 0;
  let points = 0;
  let openCount = 0;
  let readyCount = 0;

  requirements.forEach((requirement) => {
    const state = requirementStates[requirement.id] ?? 'open';
    if (state === 'not_applicable') {
      return;
    }

    maxPoints += 100;
    if (state === 'open') {
      openCount += 1;
      return;
    }
    if (state === 'in_progress') {
      points += 50;
      return;
    }
    if (state === 'ready') {
      points += 100;
      readyCount += 1;
    }
  });

  return {
    score: maxPoints ? round((points / maxPoints) * 100) : 0,
    openCount,
    readyCount,
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
    const sectorEligible = normalizedHints.some((entry) => AUSTRIA_NIS_SECTORS.includes(entry) || KRITIS_ELIGIBLE_SECTORS.includes(entry));
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
    const sectorEligible = normalizedHints.some((entry) => SWITZERLAND_CRITICAL_SECTORS.includes(entry) || KRITIS_ELIGIBLE_SECTORS.includes(entry));
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

function isPastDate(value: string): boolean {
  if (!value) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  date.setHours(0, 0, 0, 0);
  return date < today;
}

export function getActionSummary(actions: ActionItem[]): ActionSummary {
  return actions.reduce<ActionSummary>(
    (summary, action) => {
      summary.total += 1;
      if (action.status === 'open') {
        summary.open += 1;
      }
      if (action.status === 'planned') {
        summary.planned += 1;
      }
      if (action.status === 'in_progress') {
        summary.inProgress += 1;
      }
      if (action.status === 'done') {
        summary.done += 1;
      }
      if (action.status !== 'done' && isPastDate(action.dueDate)) {
        summary.overdue += 1;
      }
      return summary;
    },
    { total: 0, open: 0, planned: 0, inProgress: 0, done: 0, overdue: 0 },
  );
}

export function getEvidenceSummary(evidenceItems: EvidenceItem[]): EvidenceSummary {
  let approved = 0;
  let review = 0;
  let draft = 0;
  let missing = 0;
  let weightedCoverage = 0;

  evidenceItems.forEach((item) => {
    if (item.status === 'approved') {
      approved += 1;
      weightedCoverage += 1;
      return;
    }
    if (item.status === 'review') {
      review += 1;
      weightedCoverage += 0.75;
      return;
    }
    if (item.status === 'draft') {
      draft += 1;
      weightedCoverage += 0.4;
      return;
    }
    missing += 1;
  });

  const total = evidenceItems.length;
  // C5.4.5: dataAvailable trennt Greenfield (keine Evidenzen) von
  // Tenants mit erfassten Items, deren Coverage legitim niedrig ist.
  return {
    total,
    approved,
    review,
    draft,
    missing,
    coverage: total ? round((weightedCoverage / total) * 100) : 0,
    dataAvailable: total > 0,
  };
}

function getStageStatusPoints(status: string | undefined): number {
  if (status === 'ready') {
    return 100;
  }
  if (status === 'in_progress') {
    return 50;
  }
  return 0;
}

export function getCertificationProgress(
  certificationState: CertificationState,
  requirementScore: number,
  evidenceCoverage: number,
): CertificationProgress {
  const stagePoints = kritisCertificationStages.reduce((sum, stage) => {
    return sum + getStageStatusPoints(certificationState.stageStates[stage.id]?.status);
  }, 0);

  const stageCompletion = kritisCertificationStages.length
    ? round(stagePoints / kritisCertificationStages.length)
    : 0;

  const readyStages = kritisCertificationStages.filter(
    (stage) => certificationState.stageStates[stage.id]?.status === 'ready',
  ).length;

  const score = round(stageCompletion * 0.5 + requirementScore * 0.35 + evidenceCoverage * 0.15);

  // C5.4.5: dataAvailable wahr, sobald irgendeine Stage angefasst wurde
  // ODER Anforderungs-/Evidenz-Daten vorliegen (über die Sub-Scores).
  // Greenfield-Tenants haben weder Stages noch Daten → "—" im UI.
  const anyStageTouched = kritisCertificationStages.some((stage) => {
    const status = certificationState.stageStates[stage.id]?.status;
    return status === 'in_progress' || status === 'ready';
  });
  const dataAvailable = anyStageTouched || requirementScore > 0 || evidenceCoverage > 0;

  return {
    score,
    readyStages,
    stageCompletion,
    dataAvailable,
  };
}

function getChecklistStatusPoints(status: string | undefined): number {
  if (status === 'closed') {
    return 100;
  }
  if (status === 'evidenced') {
    return 80;
  }
  if (status === 'in_progress') {
    return 40;
  }
  return 0;
}

export function getChecklistProgress(
  checklist: AuditChecklistItemDefinition[],
  states: Record<string, AuditChecklistState>,
): ChecklistProgress {
  let total = 0;
  let maxPoints = 0;
  let points = 0;
  let blockers = 0;
  let evidenced = 0;
  let readyLike = 0;

  checklist.forEach((item) => {
    const currentStatus = states[item.id]?.status ?? 'not_started';
    if (currentStatus === 'not_applicable') {
      return;
    }

    total += 1;
    maxPoints += 100;
    points += getChecklistStatusPoints(currentStatus);

    if (currentStatus === 'evidenced' || currentStatus === 'closed') {
      evidenced += 1;
      readyLike += 1;
    } else if (currentStatus === 'in_progress') {
      readyLike += 1;
    }

    if (item.severity === 'high' && !['evidenced', 'closed', 'not_applicable'].includes(currentStatus)) {
      blockers += 1;
    }
  });

  return {
    score: maxPoints ? round((points / maxPoints) * 100) : 0,
    total,
    evidenced,
    readyLike,
    blockers,
  };
}

export function getAuditFindingSummary(findings: AuditFindingItem[]): AuditFindingSummary {
  return findings.reduce<AuditFindingSummary>(
    (summary, item) => {
      summary.total += 1;

      const isOpen = item.status !== 'closed';
      if (isOpen) {
        summary.open += 1;
      }
      if (isOpen && item.severity === 'critical') {
        summary.critical += 1;
      }
      if (isOpen && isPastDate(item.dueDate)) {
        summary.overdue += 1;
      }

      return summary;
    },
    { total: 0, open: 0, overdue: 0, critical: 0 },
  );
}

function getReviewCoverage(reviewPlan: ReviewPlan): number {
  const fields = [
    reviewPlan.executiveSponsor,
    reviewPlan.approver,
    reviewPlan.nextInternalAuditDate,
    reviewPlan.nextManagementReviewDate,
    reviewPlan.nextExerciseDate,
    reviewPlan.nextEvidenceReviewDate,
  ];

  const filled = fields.filter((value) => value.trim()).length;
  return fields.length ? round((filled / fields.length) * 100) : 0;
}

export function getGovernanceSummary(
  stakeholders: StakeholderItem[],
  sites: SiteItem[],
  assets: AssetItem[],
  reviewPlan: ReviewPlan,
): GovernanceSummary {
  const stakeholderCoverage = round(Math.min(stakeholders.filter((entry) => entry.name.trim()).length / 4, 1) * 100);
  const siteCoverage = round(Math.min(sites.filter((entry) => entry.name.trim()).length / 2, 1) * 100);
  const assetCoverage = round(Math.min(assets.filter((entry) => entry.name.trim()).length / 4, 1) * 100);
  const reviewCoverage = getReviewCoverage(reviewPlan);

  let dueReviews = 0;
  [
    reviewPlan.nextInternalAuditDate,
    reviewPlan.nextManagementReviewDate,
    reviewPlan.nextExerciseDate,
    reviewPlan.nextEvidenceReviewDate,
  ].forEach((value) => {
    if (isPastDate(value)) {
      dueReviews += 1;
    }
  });

  const score = round(
    stakeholderCoverage * 0.35
    + siteCoverage * 0.2
    + assetCoverage * 0.25
    + reviewCoverage * 0.2,
  );

  // C5.4.5: dataAvailable trennt Greenfield-Tenants ("nichts erfasst")
  // von Tenants mit erfassten, aber dürftigen Daten ("Score 5 % ist
  // legitim"). Eine einzige nicht-leere Zeile ODER ein einziges
  // gefülltes ReviewPlan-Feld zählt schon als "erfasst".
  const reviewPlanFilled =
    reviewPlan.executiveSponsor.trim() !== '' ||
    reviewPlan.approver.trim() !== '' ||
    reviewPlan.nextInternalAuditDate.trim() !== '' ||
    reviewPlan.nextManagementReviewDate.trim() !== '' ||
    reviewPlan.nextExerciseDate.trim() !== '' ||
    reviewPlan.nextEvidenceReviewDate.trim() !== '';
  const dataAvailable =
    stakeholders.length > 0
    || sites.length > 0
    || assets.length > 0
    || reviewPlanFilled;

  return {
    score,
    stakeholderCoverage,
    siteCoverage,
    assetCoverage,
    reviewCoverage,
    dueReviews,
    dataAvailable,
  };
}

function isDueWithinDays(value: string, days: number): boolean {
  if (!value) {
    return false;
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  date.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff <= days;
}

export function getResilienceSummary(
  processes: BusinessProcessItem[],
  dependencies: DependencyItem[],
  scenarios: ScenarioItem[],
  exercises: ExerciseItem[],
): ResilienceSummary {
  const criticalProcesses = processes.filter((item) => item.criticality === 'kritisch' || item.criticality === 'hoch').length;
  const processCompleteness = processes.length
    ? round((processes.reduce((sum, item) => {
        let filled = 0;
        if (item.title.trim()) filled += 1;
        if (item.owner.trim()) filled += 1;
        if (item.mtpdHours.trim()) filled += 1;
        if (item.rtoHours.trim()) filled += 1;
        if (item.outputs.trim()) filled += 1;
        return sum + filled / 5;
      }, 0) / processes.length) * 100)
    : 0;

  const singlePointsOfFailure = dependencies.filter((item) => item.singlePointOfFailure).length;
  const dependencyScore = dependencies.length
    ? round((1 - singlePointsOfFailure / dependencies.length) * 100)
    : 0;

  const highRiskScenarios = scenarios.filter((item) => item.likelihood * item.impact >= 16).length;
  const untestedScenarios = scenarios.filter((item) => item.exerciseStatus === 'not_tested').length;
  const scenarioScore = scenarios.length
    ? round((scenarios.reduce((sum, item) => {
        const riskPenalty = Math.max(0, (item.likelihood * item.impact) - 9) * 3;
        const exerciseBonus = item.exerciseStatus === 'tested' ? 20 : item.exerciseStatus === 'planned' ? 8 : 0;
        return sum + clamp(100 - riskPenalty + exerciseBonus, 20, 100);
      }, 0) / scenarios.length))
    : 0;

  const dueExercises = [
    ...scenarios.map((item) => item.nextExerciseDate),
    ...exercises.map((item) => item.nextExerciseDate || item.exerciseDate),
  ].filter((value) => isDueWithinDays(value, 30)).length;

  const exerciseScore = exercises.length
    ? round((exercises.reduce((sum, item) => {
        if (item.result === 'passed') return sum + 100;
        if (item.result === 'partial') return sum + 70;
        if (item.result === 'failed') return sum + 35;
        return sum + 45;
      }, 0) / exercises.length) - Math.min(dueExercises * 5, 25))
    : 0;

  const score = round(
    processCompleteness * 0.35
    + dependencyScore * 0.2
    + scenarioScore * 0.25
    + exerciseScore * 0.2,
  );

  // C5.4.5: dataAvailable, siehe Kommentar in `getGovernanceSummary`.
  // Auch hier: eine einzige Zeile in einer der vier Listen reicht aus.
  const dataAvailable =
    processes.length > 0
    || dependencies.length > 0
    || scenarios.length > 0
    || exercises.length > 0;

  return {
    processCoverage: processCompleteness,
    criticalProcesses,
    singlePointsOfFailure,
    highRiskScenarios,
    untestedScenarios,
    dueExercises,
    score,
    dataAvailable,
  };
}

function getSizeBand(employeeCount: number | null): { label: string; modifier: number; note: string } {
  if (employeeCount === null) {
    return {
      label: 'nicht angegeben',
      modifier: 0,
      note: 'Keine Größenklasse hinterlegt. Es werden sektorbezogene Zielwerte ohne Größenaufschlag verwendet.',
    };
  }

  if (employeeCount >= 1000) {
    return {
      label: 'groß',
      modifier: 4,
      note: 'Für große Betreiber wird ein höherer Zielkorridor angenommen.',
    };
  }

  if (employeeCount >= 250) {
    return {
      label: 'mittel',
      modifier: 2,
      note: 'Für mittlere Betreiber wird ein moderater Zielaufschlag angenommen.',
    };
  }

  return {
    label: 'klein',
    modifier: 0,
    note: 'Für kleinere Organisationen werden die sektorbezogenen Baseline-Zielwerte verwendet.',
  };
}

export function buildBenchmarkSnapshot(
  module: SectorModuleDefinition | undefined,
  employees: string,
  scoreSnapshot: ScoreSnapshot,
): BenchmarkSnapshot {
  const employeeCount = normalizeEmployeeCount(employees);
  const sizeBand = getSizeBand(employeeCount);

  const baseOverall = module?.maturityProfile?.targetOverall ?? 75;
  const domainTargets = Object.fromEntries(
    baseDomains.map((domain) => {
      const baseTarget = module?.maturityProfile?.targetByDomain?.[domain.id] ?? defaultBenchmarkTargets[domain.id] ?? 75;
      return [domain.id, clamp(baseTarget + sizeBand.modifier, 55, 95)];
    }),
  ) as Record<string, number>;

  const overallTarget = clamp(baseOverall + sizeBand.modifier, 55, 95);
  const notes = [
    ...(module?.maturityProfile?.notes ?? []),
    sizeBand.note,
  ];

  return {
    sizeBand: sizeBand.label,
    overallTarget,
    domainTargets,
    overallGap: round(overallTarget - scoreSnapshot.overallScore),
    notes,
  };
}

export function buildLinkedCountMap(
  items: Array<{ relatedQuestionIds: string[]; relatedRequirementIds: string[] }>,
  key: 'relatedQuestionIds' | 'relatedRequirementIds',
): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    item[key].forEach((id) => {
      acc[id] = (acc[id] ?? 0) + 1;
    });
    return acc;
  }, {});
}
