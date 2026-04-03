import { baseDomains } from '../data/baseDomains';
import { kritisCertificationStages, maturityBands, KRITIS_ELIGIBLE_SECTORS } from '../data/kritisBase';
import { getDomainWeight } from './moduleRegistry';
import type {
  ActionItem,
  ActionSummary,
  AnswerEntry,
  CertificationProgress,
  CertificationState,
  CompanyProfile,
  DomainScore,
  EvidenceItem,
  EvidenceSummary,
  KritisApplicability,
  QuestionDefinition,
  RequirementDefinition,
  RequirementStatus,
  ScoreSnapshot,
  SectorModuleDefinition,
} from '../types';

function round(value: number): number {
  return Math.round(value * 10) / 10;
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

export function assessKritisApplicability(
  profile: CompanyProfile,
  module?: SectorModuleDefinition,
): KritisApplicability {
  const sectorHints = new Set<string>([
    ...(module?.kritisExtension?.eligibleSectors ?? []),
    ...(module?.sectorCategory ? [module.sectorCategory] : []),
  ]);

  const sectorEligible = [...sectorHints].some((entry) => KRITIS_ELIGIBLE_SECTORS.includes(entry));
  const personsServed = normalizePersonsServed(profile.personsServed);
  const hasCriticalService = Boolean(profile.criticalService.trim());

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
  return {
    total,
    approved,
    review,
    draft,
    missing,
    coverage: total ? round((weightedCoverage / total) * 100) : 0,
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

  return {
    score,
    readyStages,
    stageCompletion,
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
