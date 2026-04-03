import { useEffect, useMemo, useState } from 'react';
import { Download, Save } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { AssessmentView } from './views/AssessmentView';
import { DashboardView } from './views/DashboardView';
import { GovernanceView } from './views/GovernanceView';
import { KritisView } from './views/KritisView';
import { MeasuresView } from './views/MeasuresView';
import { ModulesView } from './views/ModulesView';
import { ReportView } from './views/ReportView';
import {
  exportActionPlanAsCsv,
  exportAssessmentAsJson,
  exportEvidenceRegisterAsCsv,
  exportFindingRegisterAsCsv,
  exportFormalAuditReportAsHtml,
  exportManagementReportAsMarkdown,
  exportStakeholderRegisterAsCsv,
} from './lib/exporters';
import {
  builtInModules,
  getActionTemplatesForModule,
  getAuditChecklistForModule,
  getEvidenceTemplatesForModule,
  getKritisRequirementsForModule,
  getModuleById,
  getQuestionsForModule,
  getRoleTemplatesForModule,
  parseAndValidateModule,
} from './lib/moduleRegistry';
import {
  assessKritisApplicability,
  buildBenchmarkSnapshot,
  buildLinkedCountMap,
  computeScoreSnapshot,
  getActionSummary,
  getAuditFindingSummary,
  getCertificationProgress,
  getChecklistProgress,
  getEvidenceSummary,
  getGovernanceSummary,
  getRequirementProgress,
} from './lib/scoring';
import { loadState, saveState } from './lib/storage';
import { kritisCertificationStages } from './data/kritisBase';
import type {
  ActionItem,
  ActionPriority,
  AppState,
  AssessmentFilters,
  AssetItem,
  AuditChecklistState,
  AuditFindingItem,
  CertificationStageState,
  CertificationState,
  CompanyProfile,
  EvidenceAttachment,
  EvidenceClassification,
  EvidenceItem,
  EvidenceType,
  QuestionDefinition,
  RequirementDefinition,
  RequirementStatus,
  ReviewPlan,
  SectorModuleDefinition,
  SiteItem,
  StakeholderItem,
} from './types';

interface ImportFeedback {
  type: 'success' | 'error';
  text: string;
  details?: string[];
}

const defaultCompanyProfile: CompanyProfile = {
  companyName: '',
  industryLabel: '',
  locations: '',
  employees: '',
  criticalService: '',
  personsServed: '',
};

const defaultAssessmentFilters: AssessmentFilters = {
  search: '',
  domainId: 'all',
  showOnlyCritical: false,
  showOnlyUnanswered: false,
  showOnlyGaps: false,
};

const defaultReviewPlan: ReviewPlan = {
  executiveSponsor: '',
  approver: '',
  nextInternalAuditDate: '',
  nextManagementReviewDate: '',
  nextExerciseDate: '',
  nextEvidenceReviewDate: '',
};

const MAX_LOCAL_ATTACHMENT_BYTES = 450 * 1024;

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createDefaultCertificationState(): CertificationState {
  return {
    auditLead: '',
    targetDate: '',
    decisionNote: '',
    stageStates: Object.fromEntries(
      kritisCertificationStages.map((stage) => [
        stage.id,
        { status: 'not_started', notes: '' } as CertificationStageState,
      ]),
    ),
  };
}

function normalizeCertificationState(input?: Partial<CertificationState>): CertificationState {
  const stageStates = Object.fromEntries(
    kritisCertificationStages.map((stage) => {
      const current = input?.stageStates?.[stage.id];
      return [
        stage.id,
        {
          status: current?.status ?? 'not_started',
          notes: current?.notes ?? '',
        } satisfies CertificationStageState,
      ];
    }),
  ) as CertificationState['stageStates'];

  return {
    auditLead: input?.auditLead ?? '',
    targetDate: input?.targetDate ?? '',
    decisionNote: input?.decisionNote ?? '',
    stageStates,
  };
}

function normalizeActionPriority(value: string | undefined): ActionPriority {
  if (value === 'kritisch' || value === 'hoch' || value === 'mittel' || value === 'niedrig') {
    return value;
  }
  return 'mittel';
}

function normalizeEvidenceClassification(value: string | undefined): EvidenceClassification {
  if (
    value === 'öffentlich'
    || value === 'intern'
    || value === 'vertraulich'
    || value === 'streng_vertraulich'
  ) {
    return value;
  }
  return 'intern';
}

function normalizeAttachment(value: unknown): EvidenceAttachment | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Partial<EvidenceAttachment>;
  if (
    typeof candidate.fileName !== 'string'
    || typeof candidate.mimeType !== 'string'
    || typeof candidate.sizeKb !== 'number'
    || typeof candidate.dataUrl !== 'string'
  ) {
    return undefined;
  }

  return {
    fileName: candidate.fileName,
    mimeType: candidate.mimeType,
    sizeKb: candidate.sizeKb,
    dataUrl: candidate.dataUrl,
  };
}

function normalizeLoadedActions(items: unknown, fallbackModuleId: string): ActionItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<ActionItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('act'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      description: item.description ?? '',
      owner: item.owner ?? '',
      dueDate: item.dueDate ?? '',
      status: item.status ?? 'open',
      priority: normalizeActionPriority(item.priority),
      sourceType: item.sourceType ?? 'manual',
      sourceId: item.sourceId,
      sourceLabel: item.sourceLabel ?? 'Manuell',
      relatedQuestionIds: item.relatedQuestionIds ?? [],
      relatedRequirementIds: item.relatedRequirementIds ?? [],
      notes: item.notes ?? '',
      createdAt: item.createdAt ?? new Date().toISOString(),
    }));
}

function normalizeLoadedEvidence(items: unknown, fallbackModuleId: string): EvidenceItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<EvidenceItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('evi'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      type: item.type ?? 'other',
      owner: item.owner ?? '',
      reviewer: item.reviewer ?? '',
      version: item.version ?? '1.0',
      classification: normalizeEvidenceClassification(item.classification),
      link: item.link ?? '',
      status: item.status ?? 'missing',
      reviewDate: item.reviewDate ?? '',
      sourceType: item.sourceType ?? 'manual',
      sourceId: item.sourceId,
      sourceLabel: item.sourceLabel ?? 'Manuell',
      relatedQuestionIds: item.relatedQuestionIds ?? [],
      relatedRequirementIds: item.relatedRequirementIds ?? [],
      notes: item.notes ?? '',
      attachment: normalizeAttachment(item.attachment),
      createdAt: item.createdAt ?? new Date().toISOString(),
    }));
}

function normalizeLoadedStakeholders(items: unknown, fallbackModuleId: string): StakeholderItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<StakeholderItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('stk'),
      moduleId: item.moduleId ?? fallbackModuleId,
      name: item.name ?? '',
      roleLabel: item.roleLabel ?? '',
      department: item.department ?? '',
      email: item.email ?? '',
      approvalScope: item.approvalScope ?? '',
      responsibilities: item.responsibilities ?? '',
      isPrimary: item.isPrimary ?? false,
      notes: item.notes ?? '',
    }));
}

function normalizeLoadedSites(items: unknown, fallbackModuleId: string): SiteItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<SiteItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('site'),
      moduleId: item.moduleId ?? fallbackModuleId,
      name: item.name ?? '',
      type: item.type ?? '',
      location: item.location ?? '',
      criticality: item.criticality ?? 'mittel',
      primaryService: item.primaryService ?? '',
      fallbackSite: item.fallbackSite ?? '',
      notes: item.notes ?? '',
    }));
}

function normalizeLoadedAssets(items: unknown, fallbackModuleId: string): AssetItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<AssetItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('ast'),
      moduleId: item.moduleId ?? fallbackModuleId,
      siteId: item.siteId ?? '',
      name: item.name ?? '',
      type: item.type ?? '',
      criticality: item.criticality ?? 'mittel',
      owner: item.owner ?? '',
      rtoHours: item.rtoHours ?? '',
      fallback: item.fallback ?? '',
      dependencies: item.dependencies ?? '',
      notes: item.notes ?? '',
    }));
}

function normalizeReviewPlan(input?: Partial<ReviewPlan>): ReviewPlan {
  return {
    executiveSponsor: input?.executiveSponsor ?? '',
    approver: input?.approver ?? '',
    nextInternalAuditDate: input?.nextInternalAuditDate ?? '',
    nextManagementReviewDate: input?.nextManagementReviewDate ?? '',
    nextExerciseDate: input?.nextExerciseDate ?? '',
    nextEvidenceReviewDate: input?.nextEvidenceReviewDate ?? '',
  };
}

function normalizeLoadedFindings(items: unknown, fallbackModuleId: string): AuditFindingItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<AuditFindingItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('fnd'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      area: item.area ?? '',
      severity: item.severity ?? 'medium',
      status: item.status ?? 'open',
      owner: item.owner ?? '',
      dueDate: item.dueDate ?? '',
      relatedRequirementIds: item.relatedRequirementIds ?? [],
      relatedEvidenceIds: item.relatedEvidenceIds ?? [],
      notes: item.notes ?? '',
      createdAt: item.createdAt ?? new Date().toISOString(),
    }));
}

function createInitialState(): AppState {
  const loaded = loadState();
  const fallbackModuleId = loaded?.selectedModuleId ?? builtInModules[0].id;

  return {
    activeView: loaded?.activeView ?? 'dashboard',
    selectedModuleId: fallbackModuleId,
    uploadedModules: loaded?.uploadedModules ?? [],
    answers: loaded?.answers ?? {},
    requirementStates: loaded?.requirementStates ?? {},
    companyProfile: {
      ...defaultCompanyProfile,
      ...(loaded?.companyProfile ?? {}),
    },
    actionItems: normalizeLoadedActions(loaded?.actionItems, fallbackModuleId),
    evidenceItems: normalizeLoadedEvidence(loaded?.evidenceItems, fallbackModuleId),
    stakeholders: normalizeLoadedStakeholders(loaded?.stakeholders, fallbackModuleId),
    sites: normalizeLoadedSites(loaded?.sites, fallbackModuleId),
    assets: normalizeLoadedAssets(loaded?.assets, fallbackModuleId),
    reviewPlan: normalizeReviewPlan(loaded?.reviewPlan),
    auditChecklistStates: loaded?.auditChecklistStates ?? {},
    auditFindings: normalizeLoadedFindings(loaded?.auditFindings, fallbackModuleId),
    certificationState: normalizeCertificationState(loaded?.certificationState),
    assessmentFilters: {
      ...defaultAssessmentFilters,
      ...(loaded?.assessmentFilters ?? {}),
    },
  };
}

function guessEvidenceType(text: string): EvidenceType {
  const normalized = text.toLowerCase();
  if (normalized.includes('backup') || normalized.includes('restore')) {
    return 'backup';
  }
  if (normalized.includes('übung') || normalized.includes('test') || normalized.includes('protokoll')) {
    return 'test';
  }
  if (normalized.includes('schulung') || normalized.includes('training')) {
    return 'training';
  }
  if (normalized.includes('vertrag') || normalized.includes('sla')) {
    return 'contract';
  }
  if (normalized.includes('richtlinie') || normalized.includes('policy')) {
    return 'policy';
  }
  if (normalized.includes('bericht')) {
    return 'report';
  }
  if (normalized.includes('plan') || normalized.includes('konzept')) {
    return 'plan';
  }
  return 'other';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [state, setState] = useState<AppState>(createInitialState);
  const [feedback, setFeedback] = useState<ImportFeedback | null>(null);

  const currentModule = useMemo(
    () => getModuleById(state.selectedModuleId, state.uploadedModules) ?? builtInModules[0],
    [state.selectedModuleId, state.uploadedModules],
  );

  const questions = useMemo(() => getQuestionsForModule(currentModule), [currentModule]);
  const questionLookup = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );

  const requirements = useMemo(
    () => getKritisRequirementsForModule(currentModule),
    [currentModule],
  );
  const requirementLookup = useMemo(
    () => new Map(requirements.map((requirement) => [requirement.id, requirement])),
    [requirements],
  );

  const actionTemplates = useMemo(
    () => getActionTemplatesForModule(currentModule),
    [currentModule],
  );
  const evidenceTemplates = useMemo(
    () => getEvidenceTemplatesForModule(currentModule),
    [currentModule],
  );
  const roleTemplates = useMemo(
    () => getRoleTemplatesForModule(currentModule),
    [currentModule],
  );
  const auditChecklist = useMemo(
    () => getAuditChecklistForModule(currentModule),
    [currentModule],
  );

  const scoreSnapshot = useMemo(
    () => computeScoreSnapshot(questions, state.answers, currentModule),
    [questions, state.answers, currentModule],
  );

  const currentActionItems = useMemo(
    () => state.actionItems.filter((item) => item.moduleId === currentModule.id),
    [state.actionItems, currentModule.id],
  );
  const currentEvidenceItems = useMemo(
    () => state.evidenceItems.filter((item) => item.moduleId === currentModule.id),
    [state.evidenceItems, currentModule.id],
  );
  const currentStakeholders = useMemo(
    () => state.stakeholders.filter((item) => item.moduleId === currentModule.id),
    [state.stakeholders, currentModule.id],
  );
  const currentSites = useMemo(
    () => state.sites.filter((item) => item.moduleId === currentModule.id),
    [state.sites, currentModule.id],
  );
  const currentAssets = useMemo(
    () => state.assets.filter((item) => item.moduleId === currentModule.id),
    [state.assets, currentModule.id],
  );
  const currentFindings = useMemo(
    () => state.auditFindings.filter((item) => item.moduleId === currentModule.id),
    [state.auditFindings, currentModule.id],
  );

  const requirementProgress = useMemo(
    () => getRequirementProgress(requirements, state.requirementStates),
    [requirements, state.requirementStates],
  );

  const kritisApplicability = useMemo(
    () => assessKritisApplicability(state.companyProfile, currentModule),
    [state.companyProfile, currentModule],
  );

  const actionSummary = useMemo(
    () => getActionSummary(currentActionItems),
    [currentActionItems],
  );
  const evidenceSummary = useMemo(
    () => getEvidenceSummary(currentEvidenceItems),
    [currentEvidenceItems],
  );
  const governanceSummary = useMemo(
    () => getGovernanceSummary(currentStakeholders, currentSites, currentAssets, state.reviewPlan),
    [currentStakeholders, currentSites, currentAssets, state.reviewPlan],
  );
  const benchmarkSnapshot = useMemo(
    () => buildBenchmarkSnapshot(currentModule, state.companyProfile.employees, scoreSnapshot),
    [currentModule, state.companyProfile.employees, scoreSnapshot],
  );
  const checklistProgress = useMemo(
    () => getChecklistProgress(auditChecklist, state.auditChecklistStates),
    [auditChecklist, state.auditChecklistStates],
  );
  const findingSummary = useMemo(
    () => getAuditFindingSummary(currentFindings),
    [currentFindings],
  );
  const certificationProgress = useMemo(
    () => getCertificationProgress(
      state.certificationState,
      requirementProgress.score,
      evidenceSummary.coverage,
    ),
    [state.certificationState, requirementProgress.score, evidenceSummary.coverage],
  );

  const questionActionCounts = useMemo(
    () => buildLinkedCountMap(currentActionItems, 'relatedQuestionIds'),
    [currentActionItems],
  );
  const questionEvidenceCounts = useMemo(
    () => buildLinkedCountMap(currentEvidenceItems, 'relatedQuestionIds'),
    [currentEvidenceItems],
  );
  const requirementActionCounts = useMemo(
    () => buildLinkedCountMap(currentActionItems, 'relatedRequirementIds'),
    [currentActionItems],
  );
  const requirementEvidenceCounts = useMemo(
    () => buildLinkedCountMap(currentEvidenceItems, 'relatedRequirementIds'),
    [currentEvidenceItems],
  );

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!getModuleById(state.selectedModuleId, state.uploadedModules)) {
      setState((current) => ({
        ...current,
        selectedModuleId: builtInModules[0].id,
      }));
    }
  }, [state.selectedModuleId, state.uploadedModules]);

  function setActiveView(activeView: AppState['activeView']) {
    setState((current) => ({ ...current, activeView }));
  }

  function updateProfileField(field: keyof CompanyProfile, value: string) {
    setState((current) => ({
      ...current,
      companyProfile: {
        ...current.companyProfile,
        [field]: value,
      },
    }));
  }

  function updateAssessmentFilter(patch: Partial<AssessmentFilters>) {
    setState((current) => ({
      ...current,
      assessmentFilters: {
        ...current.assessmentFilters,
        ...patch,
      },
    }));
  }

  function updateReviewPlan(field: keyof ReviewPlan, value: string) {
    setState((current) => ({
      ...current,
      reviewPlan: {
        ...current.reviewPlan,
        [field]: value,
      },
    }));
  }

  function updateCertificationField(
    field: 'auditLead' | 'targetDate' | 'decisionNote',
    value: string,
  ) {
    setState((current) => ({
      ...current,
      certificationState: {
        ...current.certificationState,
        [field]: value,
      },
    }));
  }

  function updateCertificationStage(stageId: string, patch: Partial<CertificationStageState>) {
    setState((current) => ({
      ...current,
      certificationState: {
        ...current.certificationState,
        stageStates: {
          ...current.certificationState.stageStates,
          [stageId]: {
            ...current.certificationState.stageStates[stageId],
            ...patch,
          },
        },
      },
    }));
  }

  function updateChecklistState(itemId: string, patch: Partial<AuditChecklistState>) {
    setState((current) => ({
      ...current,
      auditChecklistStates: {
        ...current.auditChecklistStates,
        [itemId]: {
          status: current.auditChecklistStates[itemId]?.status ?? 'not_started',
          notes: current.auditChecklistStates[itemId]?.notes ?? '',
          ...patch,
        },
      },
    }));
  }

  function selectModule(moduleId: string) {
    setState((current) => {
      const module = getModuleById(moduleId, current.uploadedModules) ?? builtInModules[0];
      const shouldPrefillIndustry = !current.companyProfile.industryLabel.trim();

      return {
        ...current,
        selectedModuleId: moduleId,
        companyProfile: shouldPrefillIndustry
          ? {
              ...current.companyProfile,
              industryLabel: module.sectorCategory ?? module.name,
            }
          : current.companyProfile,
      };
    });
  }

  function handleScoreChange(questionId: string, score: number | null) {
    setState((current) => ({
      ...current,
      answers: {
        ...current.answers,
        [questionId]: {
          score: score as 0 | 1 | 2 | 3 | 4 | null,
          note: current.answers[questionId]?.note ?? '',
        },
      },
    }));
  }

  function handleNoteChange(questionId: string, note: string) {
    setState((current) => ({
      ...current,
      answers: {
        ...current.answers,
        [questionId]: {
          score: current.answers[questionId]?.score ?? null,
          note,
        },
      },
    }));
  }

  function handleRequirementChange(requirementId: string, status: RequirementStatus) {
    setState((current) => ({
      ...current,
      requirementStates: {
        ...current.requirementStates,
        [requirementId]: status,
      },
    }));
  }

  async function handleImportFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const file = files[0];
    const jsonText = await file.text();
    const result = parseAndValidateModule(jsonText);

    if (!result.valid || !result.module) {
      setFeedback({
        type: 'error',
        text: `Das Modul "${file.name}" konnte nicht importiert werden.`,
        details: result.errors,
      });
      return;
    }

    if (builtInModules.some((module) => module.id === result.module?.id)) {
      setFeedback({
        type: 'error',
        text: `Die ID "${result.module.id}" ist bereits durch ein integriertes Modul belegt.`,
      });
      return;
    }

    setState((current) => {
      const uploadedModules = [
        ...current.uploadedModules.filter((module) => module.id !== result.module?.id),
        result.module as SectorModuleDefinition,
      ];

      return {
        ...current,
        uploadedModules,
        selectedModuleId: result.module?.id ?? current.selectedModuleId,
        activeView: 'modules',
      };
    });

    setFeedback({
      type: 'success',
      text: `Modul "${result.module.name}" wurde importiert oder aktualisiert und als aktives Profil gewählt.`,
    });
  }

  function upsertActionDrafts(drafts: Array<Omit<ActionItem, 'id' | 'createdAt'>>) {
    setState((current) => {
      const actionItems = [...current.actionItems];

      drafts.forEach((draft) => {
        const shouldDeduplicate = draft.sourceType !== 'manual' && Boolean(draft.sourceId);
        const exists = shouldDeduplicate
          ? actionItems.some(
              (item) => item.moduleId === draft.moduleId
                && item.sourceType === draft.sourceType
                && item.sourceId === draft.sourceId,
            )
          : false;

        if (!exists) {
          actionItems.unshift({
            ...draft,
            id: createId('act'),
            createdAt: new Date().toISOString(),
          });
        }
      });

      return {
        ...current,
        actionItems,
        activeView: 'measures',
      };
    });
  }

  function upsertEvidenceDrafts(drafts: Array<Omit<EvidenceItem, 'id' | 'createdAt'>>) {
    setState((current) => {
      const evidenceItems = [...current.evidenceItems];

      drafts.forEach((draft) => {
        const shouldDeduplicate = draft.sourceType !== 'manual' && Boolean(draft.sourceId);
        const exists = shouldDeduplicate
          ? evidenceItems.some(
              (item) => item.moduleId === draft.moduleId
                && item.sourceType === draft.sourceType
                && item.sourceId === draft.sourceId,
            )
          : false;

        if (!exists) {
          evidenceItems.unshift({
            ...draft,
            id: createId('evi'),
            createdAt: new Date().toISOString(),
          });
        }
      });

      return {
        ...current,
        evidenceItems,
        activeView: 'measures',
      };
    });
  }

  function createActionFromQuestionDefinition(question: QuestionDefinition): Omit<ActionItem, 'id' | 'createdAt'> {
    return {
      moduleId: currentModule.id,
      title: question.title,
      description: question.recommendation,
      owner: '',
      dueDate: getDateOffset(question.critical ? 21 : 35),
      status: 'open',
      priority: question.critical ? 'kritisch' : 'hoch',
      sourceType: 'question',
      sourceId: question.id,
      sourceLabel: question.title,
      relatedQuestionIds: [question.id],
      relatedRequirementIds: [],
      notes: question.guidance,
    };
  }

  function createEvidenceFromQuestionDefinition(question: QuestionDefinition): Omit<EvidenceItem, 'id' | 'createdAt'> {
    return {
      moduleId: currentModule.id,
      title: question.evidenceHint ? `${question.title} - Evidenz` : question.title,
      type: guessEvidenceType(`${question.evidenceHint ?? ''} ${question.title}`),
      owner: '',
      reviewer: '',
      version: '1.0',
      classification: 'intern',
      link: '',
      status: 'missing',
      reviewDate: getDateOffset(60),
      sourceType: 'question',
      sourceId: question.id,
      sourceLabel: question.title,
      relatedQuestionIds: [question.id],
      relatedRequirementIds: [],
      notes: question.evidenceHint ?? question.guidance,
      attachment: undefined,
    };
  }

  function createActionFromRequirementDefinition(
    requirement: RequirementDefinition,
  ): Omit<ActionItem, 'id' | 'createdAt'> {
    return {
      moduleId: currentModule.id,
      title: requirement.title,
      description: requirement.guidance,
      owner: '',
      dueDate: getDateOffset(requirement.severity === 'high' ? 21 : 45),
      status: 'open',
      priority:
        requirement.severity === 'high'
          ? 'kritisch'
          : requirement.severity === 'medium'
            ? 'hoch'
            : 'mittel',
      sourceType: 'requirement',
      sourceId: requirement.id,
      sourceLabel: requirement.title,
      relatedQuestionIds: [],
      relatedRequirementIds: [requirement.id],
      notes: requirement.dueHint ?? '',
    };
  }

  function createEvidenceFromRequirementDefinition(
    requirement: RequirementDefinition,
  ): Omit<EvidenceItem, 'id' | 'createdAt'> {
    return {
      moduleId: currentModule.id,
      title: `Nachweis - ${requirement.title}`,
      type: guessEvidenceType(`${requirement.title} ${requirement.guidance}`),
      owner: '',
      reviewer: '',
      version: '1.0',
      classification: 'intern',
      link: '',
      status: 'missing',
      reviewDate: getDateOffset(45),
      sourceType: 'requirement',
      sourceId: requirement.id,
      sourceLabel: requirement.title,
      relatedQuestionIds: [],
      relatedRequirementIds: [requirement.id],
      notes: `${requirement.guidance}${requirement.dueHint ? ` | ${requirement.dueHint}` : ''}`,
      attachment: undefined,
    };
  }

  function handleCreateActionFromQuestion(questionId: string) {
    const question = questionLookup.get(questionId);
    if (!question) {
      return;
    }
    upsertActionDrafts([createActionFromQuestionDefinition(question)]);
  }

  function handleCreateEvidenceFromQuestion(questionId: string) {
    const question = questionLookup.get(questionId);
    if (!question) {
      return;
    }
    upsertEvidenceDrafts([createEvidenceFromQuestionDefinition(question)]);
  }

  function handleCreateActionFromRequirement(requirementId: string) {
    const requirement = requirementLookup.get(requirementId);
    if (!requirement) {
      return;
    }
    upsertActionDrafts([createActionFromRequirementDefinition(requirement)]);
  }

  function handleCreateEvidenceFromRequirement(requirementId: string) {
    const requirement = requirementLookup.get(requirementId);
    if (!requirement) {
      return;
    }
    upsertEvidenceDrafts([createEvidenceFromRequirementDefinition(requirement)]);
  }

  function handleCreateEmptyAction() {
    upsertActionDrafts([
      {
        moduleId: currentModule.id,
        title: '',
        description: '',
        owner: '',
        dueDate: getDateOffset(30),
        status: 'open',
        priority: 'mittel',
        sourceType: 'manual',
        sourceLabel: 'Manuell',
        relatedQuestionIds: [],
        relatedRequirementIds: [],
        notes: '',
      },
    ]);
  }

  function handleCreateEmptyEvidence() {
    upsertEvidenceDrafts([
      {
        moduleId: currentModule.id,
        title: '',
        type: 'other',
        owner: '',
        reviewer: '',
        version: '1.0',
        classification: 'intern',
        link: '',
        status: 'missing',
        reviewDate: getDateOffset(60),
        sourceType: 'manual',
        sourceLabel: 'Manuell',
        relatedQuestionIds: [],
        relatedRequirementIds: [],
        notes: '',
        attachment: undefined,
      },
    ]);
  }

  function handleGenerateRecommendationActions() {
    const drafts = scoreSnapshot.recommendations
      .map((recommendation) => questionLookup.get(recommendation.questionId))
      .filter((question): question is QuestionDefinition => Boolean(question))
      .map((question) => createActionFromQuestionDefinition(question));

    upsertActionDrafts(drafts);
  }

  function handleGenerateRequirementActions() {
    const drafts = requirements
      .filter((requirement) => {
        const status = state.requirementStates[requirement.id] ?? 'open';
        return status !== 'ready' && status !== 'not_applicable';
      })
      .map((requirement) => createActionFromRequirementDefinition(requirement));

    upsertActionDrafts(drafts);
  }

  function handleGenerateModuleActionTemplates() {
    const drafts = actionTemplates.map((template) => ({
      moduleId: currentModule.id,
      title: template.title,
      description: template.description,
      owner: template.ownerRole ?? '',
      dueDate: getDateOffset(35),
      status: 'planned' as const,
      priority: template.priority ?? 'mittel',
      sourceType: 'module_template' as const,
      sourceId: template.id,
      sourceLabel: template.title,
      relatedQuestionIds: template.relatedQuestionIds ?? [],
      relatedRequirementIds: template.relatedRequirementIds ?? [],
      notes: currentModule.uiHints?.accentLabel ? `Modulkontext: ${currentModule.uiHints.accentLabel}` : '',
    }));

    upsertActionDrafts(drafts);
  }

  function handleGenerateCriticalQuestionEvidence() {
    const drafts = scoreSnapshot.recommendations
      .map((recommendation) => questionLookup.get(recommendation.questionId))
      .filter((question): question is QuestionDefinition => Boolean(question))
      .map((question) => createEvidenceFromQuestionDefinition(question));

    upsertEvidenceDrafts(drafts);
  }

  function handleGenerateRequirementEvidence() {
    const drafts = requirements
      .filter((requirement) => {
        const status = state.requirementStates[requirement.id] ?? 'open';
        return status !== 'ready' && status !== 'not_applicable';
      })
      .map((requirement) => createEvidenceFromRequirementDefinition(requirement));

    upsertEvidenceDrafts(drafts);
  }

  function handleGenerateModuleEvidenceTemplates() {
    const drafts = evidenceTemplates.map((template) => ({
      moduleId: currentModule.id,
      title: template.title,
      type: template.type,
      owner: template.ownerRole ?? '',
      reviewer: '',
      version: '1.0',
      classification: 'intern' as const,
      link: '',
      status: 'missing' as const,
      reviewDate: getDateOffset(75),
      sourceType: 'module_template' as const,
      sourceId: template.id,
      sourceLabel: template.title,
      relatedQuestionIds: template.relatedQuestionIds ?? [],
      relatedRequirementIds: template.relatedRequirementIds ?? [],
      notes: template.reviewCycleHint ?? '',
      attachment: undefined,
    }));

    upsertEvidenceDrafts(drafts);
  }

  function handleUpdateAction(actionId: string, patch: Partial<ActionItem>) {
    setState((current) => ({
      ...current,
      actionItems: current.actionItems.map((item) => (
        item.id === actionId ? { ...item, ...patch } : item
      )),
    }));
  }

  function handleDeleteAction(actionId: string) {
    setState((current) => ({
      ...current,
      actionItems: current.actionItems.filter((item) => item.id !== actionId),
    }));
  }

  function handleUpdateEvidence(evidenceId: string, patch: Partial<EvidenceItem>) {
    setState((current) => ({
      ...current,
      evidenceItems: current.evidenceItems.map((item) => (
        item.id === evidenceId ? { ...item, ...patch } : item
      )),
    }));
  }

  function handleDeleteEvidence(evidenceId: string) {
    setState((current) => ({
      ...current,
      evidenceItems: current.evidenceItems.filter((item) => item.id !== evidenceId),
      auditFindings: current.auditFindings.map((finding) => ({
        ...finding,
        relatedEvidenceIds: finding.relatedEvidenceIds.filter((id) => id !== evidenceId),
      })),
    }));
  }

  async function handleAttachEvidenceFile(evidenceId: string, file: File | null) {
    if (!file) {
      return;
    }

    if (file.size > MAX_LOCAL_ATTACHMENT_BYTES) {
      window.alert('Die Datei ist für den lokalen Browser-Prototyp zu groß. Bitte bleiben Sie unter ca. 450 KB.');
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    const attachment: EvidenceAttachment = {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeKb: Math.round((file.size / 1024) * 10) / 10,
      dataUrl,
    };

    setState((current) => ({
      ...current,
      evidenceItems: current.evidenceItems.map((item) => (
        item.id === evidenceId
          ? {
              ...item,
              attachment,
              status: item.status === 'missing' ? 'draft' : item.status,
            }
          : item
      )),
    }));
  }

  function handleRemoveEvidenceFile(evidenceId: string) {
    setState((current) => ({
      ...current,
      evidenceItems: current.evidenceItems.map((item) => (
        item.id === evidenceId ? { ...item, attachment: undefined } : item
      )),
    }));
  }

  function handleCreateEmptyStakeholder() {
    setState((current) => ({
      ...current,
      stakeholders: [
        {
          id: createId('stk'),
          moduleId: currentModule.id,
          name: '',
          roleLabel: '',
          department: '',
          email: '',
          approvalScope: '',
          responsibilities: '',
          isPrimary: false,
          notes: '',
        },
        ...current.stakeholders,
      ],
      activeView: 'governance',
    }));
  }

  function handleGenerateRoleTemplates() {
    setState((current) => {
      const stakeholders = [...current.stakeholders];

      roleTemplates.forEach((template) => {
        const exists = stakeholders.some(
          (item) => item.moduleId === currentModule.id && item.roleLabel === template.label,
        );

        if (!exists) {
          stakeholders.unshift({
            id: createId('stk'),
            moduleId: currentModule.id,
            name: '',
            roleLabel: template.label,
            department: '',
            email: '',
            approvalScope: template.approvalScope ?? '',
            responsibilities: template.responsibility,
            isPrimary: Boolean(template.approvalScope),
            notes: template.focusAreas?.join(', ') ?? '',
          });
        }
      });

      return {
        ...current,
        stakeholders,
        activeView: 'governance',
      };
    });
  }

  function handleUpdateStakeholder(stakeholderId: string, patch: Partial<StakeholderItem>) {
    setState((current) => ({
      ...current,
      stakeholders: current.stakeholders.map((item) => (
        item.id === stakeholderId ? { ...item, ...patch } : item
      )),
    }));
  }

  function handleDeleteStakeholder(stakeholderId: string) {
    setState((current) => ({
      ...current,
      stakeholders: current.stakeholders.filter((item) => item.id !== stakeholderId),
    }));
  }

  function handleCreateEmptySite() {
    setState((current) => ({
      ...current,
      sites: [
        {
          id: createId('site'),
          moduleId: currentModule.id,
          name: '',
          type: '',
          location: '',
          criticality: 'mittel',
          primaryService: '',
          fallbackSite: '',
          notes: '',
        },
        ...current.sites,
      ],
      activeView: 'governance',
    }));
  }

  function handleUpdateSite(siteId: string, patch: Partial<SiteItem>) {
    setState((current) => ({
      ...current,
      sites: current.sites.map((item) => (
        item.id === siteId ? { ...item, ...patch } : item
      )),
    }));
  }

  function handleDeleteSite(siteId: string) {
    setState((current) => ({
      ...current,
      sites: current.sites.filter((item) => item.id !== siteId),
      assets: current.assets.map((asset) => (
        asset.siteId === siteId ? { ...asset, siteId: '' } : asset
      )),
    }));
  }

  function handleCreateEmptyAsset() {
    setState((current) => ({
      ...current,
      assets: [
        {
          id: createId('ast'),
          moduleId: currentModule.id,
          siteId: '',
          name: '',
          type: '',
          criticality: 'mittel',
          owner: '',
          rtoHours: '',
          fallback: '',
          dependencies: '',
          notes: '',
        },
        ...current.assets,
      ],
      activeView: 'governance',
    }));
  }

  function handleUpdateAsset(assetId: string, patch: Partial<AssetItem>) {
    setState((current) => ({
      ...current,
      assets: current.assets.map((item) => (
        item.id === assetId ? { ...item, ...patch } : item
      )),
    }));
  }

  function handleDeleteAsset(assetId: string) {
    setState((current) => ({
      ...current,
      assets: current.assets.filter((item) => item.id !== assetId),
    }));
  }

  function handleCreateFinding() {
    setState((current) => ({
      ...current,
      auditFindings: [
        {
          id: createId('fnd'),
          moduleId: currentModule.id,
          title: '',
          area: '',
          severity: 'medium',
          status: 'open',
          owner: '',
          dueDate: getDateOffset(21),
          relatedRequirementIds: [],
          relatedEvidenceIds: [],
          notes: '',
          createdAt: new Date().toISOString(),
        },
        ...current.auditFindings,
      ],
      activeView: 'kritis',
    }));
  }

  function handleGenerateFindingsFromChecklist() {
    setState((current) => {
      const auditFindings = [...current.auditFindings];

      auditChecklist.forEach((item) => {
        const stateForItem = current.auditChecklistStates[item.id]?.status ?? 'not_started';
        const needsFinding = item.severity === 'high' && !['evidenced', 'closed', 'not_applicable'].includes(stateForItem);

        if (!needsFinding) {
          return;
        }

        const exists = auditFindings.some(
          (finding) => finding.moduleId === currentModule.id && finding.title === item.title,
        );

        if (!exists) {
          auditFindings.unshift({
            id: createId('fnd'),
            moduleId: currentModule.id,
            title: item.title,
            area: item.area,
            severity: item.severity === 'high' ? 'high' : 'medium',
            status: 'open',
            owner: '',
            dueDate: getDateOffset(21),
            relatedRequirementIds: item.relatedRequirementIds ?? [],
            relatedEvidenceIds: [],
            notes: item.guidance,
            createdAt: new Date().toISOString(),
          });
        }
      });

      return {
        ...current,
        auditFindings,
        activeView: 'kritis',
      };
    });
  }

  function handleUpdateFinding(findingId: string, patch: Partial<AuditFindingItem>) {
    setState((current) => ({
      ...current,
      auditFindings: current.auditFindings.map((item) => (
        item.id === findingId ? { ...item, ...patch } : item
      )),
    }));
  }

  function handleDeleteFinding(findingId: string) {
    setState((current) => ({
      ...current,
      auditFindings: current.auditFindings.filter((item) => item.id !== findingId),
    }));
  }

  function handleExportJson() {
    exportAssessmentAsJson({
      companyProfile: state.companyProfile,
      module: currentModule,
      scoreSnapshot,
      answers: state.answers,
      requirementStates: state.requirementStates,
      actionItems: currentActionItems,
      evidenceItems: currentEvidenceItems,
      stakeholders: currentStakeholders,
      sites: currentSites,
      assets: currentAssets,
      reviewPlan: state.reviewPlan,
      auditChecklist: auditChecklist.map((item) => ({
        ...item,
        state: state.auditChecklistStates[item.id] ?? { status: 'not_started', notes: '' },
      })),
      auditFindings: currentFindings,
      benchmark: benchmarkSnapshot,
      certificationState: state.certificationState,
    });
  }

  function handleExportMarkdown() {
    exportManagementReportAsMarkdown({
      companyProfile: state.companyProfile,
      module: currentModule,
      scoreSnapshot,
      applicability: kritisApplicability,
      requirementProgress,
      requirements,
      requirementStates: state.requirementStates,
      actionItems: currentActionItems,
      evidenceSummary,
      stakeholders: currentStakeholders,
      sites: currentSites,
      reviewPlan: state.reviewPlan,
      benchmark: benchmarkSnapshot,
      governanceSummary,
      checklistProgress,
      findingSummary,
      certificationState: state.certificationState,
      certificationProgress,
    });
  }

  function handleExportFormalHtml() {
    exportFormalAuditReportAsHtml({
      companyProfile: state.companyProfile,
      module: currentModule,
      scoreSnapshot,
      applicability: kritisApplicability,
      benchmark: benchmarkSnapshot,
      governanceSummary,
      requirementProgress,
      checklistProgress,
      findingSummary,
      evidenceSummary,
      certificationProgress,
      stakeholders: currentStakeholders,
      sites: currentSites,
      findings: currentFindings,
    });
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={state.activeView} onChange={setActiveView} />

      <div className="main-shell">
        <header className="topbar card">
          <div className="topbar-head">
            <div>
              <p className="eyebrow">Projektsteuerung</p>
              <h2>Unternehmensprofil und aktives Branchenmodul</h2>
            </div>
            <div className="topbar-actions">
              <div className="inline-note">
                <Save size={16} />
                <span>Automatisch lokal gespeichert</span>
              </div>
              <button type="button" className="button secondary" onClick={handleExportJson}>
                <Download size={16} />
                JSON exportieren
              </button>
            </div>
          </div>

          <div className="profile-grid">
            <label className="field-label">
              Unternehmen
              <input
                type="text"
                placeholder="z. B. Musterwerke GmbH"
                value={state.companyProfile.companyName}
                onChange={(event) => updateProfileField('companyName', event.target.value)}
              />
            </label>
            <label className="field-label">
              Branche / Segment
              <input
                type="text"
                placeholder="z. B. Krankenhaus, Produktion, Energie"
                value={state.companyProfile.industryLabel}
                onChange={(event) => updateProfileField('industryLabel', event.target.value)}
              />
            </label>
            <label className="field-label">
              Aktives Modul
              <select
                value={state.selectedModuleId}
                onChange={(event) => selectModule(event.target.value)}
              >
                {[...builtInModules, ...state.uploadedModules].map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Mitarbeitende
              <input
                type="text"
                placeholder="z. B. 850"
                value={state.companyProfile.employees}
                onChange={(event) => updateProfileField('employees', event.target.value)}
              />
            </label>
            <label className="field-label">
              Standorte / Werke
              <input
                type="text"
                placeholder="z. B. 3 Standorte, 1 Rechenzentrum"
                value={state.companyProfile.locations}
                onChange={(event) => updateProfileField('locations', event.target.value)}
              />
            </label>
            <label className="field-label wide">
              Kritische Dienstleistung / Versorgung
              <input
                type="text"
                placeholder="z. B. Notfallversorgung, Stromverteilung, Trinkwasserversorgung"
                value={state.companyProfile.criticalService}
                onChange={(event) => updateProfileField('criticalService', event.target.value)}
              />
            </label>
            <label className="field-label">
              Versorgte Personen
              <input
                type="text"
                placeholder="z. B. 500000"
                value={state.companyProfile.personsServed}
                onChange={(event) => updateProfileField('personsServed', event.target.value)}
              />
            </label>
          </div>
        </header>

        <main className="content-shell">
          {state.activeView === 'dashboard' ? (
            <DashboardView
              companyName={state.companyProfile.companyName}
              module={currentModule}
              scoreSnapshot={scoreSnapshot}
              benchmark={benchmarkSnapshot}
              requirementScore={requirementProgress.score}
              actionSummary={actionSummary}
              evidenceSummary={evidenceSummary}
              certificationProgress={certificationProgress}
              applicability={kritisApplicability}
              governanceSummary={governanceSummary}
              checklistProgress={checklistProgress}
              findingSummary={findingSummary}
              onGoToAssessment={() => setActiveView('assessment')}
              onGoToMeasures={() => setActiveView('measures')}
              onGoToGovernance={() => setActiveView('governance')}
              onGoToKritis={() => setActiveView('kritis')}
            />
          ) : null}

          {state.activeView === 'assessment' ? (
            <AssessmentView
              questions={questions}
              answers={state.answers}
              domainScores={scoreSnapshot.domainScores}
              filters={state.assessmentFilters}
              questionActionCounts={questionActionCounts}
              questionEvidenceCounts={questionEvidenceCounts}
              onScoreChange={handleScoreChange}
              onNoteChange={handleNoteChange}
              onChangeFilter={updateAssessmentFilter}
              onCreateAction={handleCreateActionFromQuestion}
              onCreateEvidence={handleCreateEvidenceFromQuestion}
            />
          ) : null}

          {state.activeView === 'measures' ? (
            <MeasuresView
              module={currentModule}
              recommendations={scoreSnapshot.recommendations}
              requirements={requirements}
              requirementStates={state.requirementStates}
              actionItems={currentActionItems}
              evidenceItems={currentEvidenceItems}
              actionSummary={actionSummary}
              evidenceSummary={evidenceSummary}
              onCreateEmptyAction={handleCreateEmptyAction}
              onCreateEmptyEvidence={handleCreateEmptyEvidence}
              onGenerateRecommendationActions={handleGenerateRecommendationActions}
              onGenerateRequirementActions={handleGenerateRequirementActions}
              onGenerateModuleActionTemplates={handleGenerateModuleActionTemplates}
              onGenerateCriticalQuestionEvidence={handleGenerateCriticalQuestionEvidence}
              onGenerateRequirementEvidence={handleGenerateRequirementEvidence}
              onGenerateModuleEvidenceTemplates={handleGenerateModuleEvidenceTemplates}
              onUpdateAction={handleUpdateAction}
              onDeleteAction={handleDeleteAction}
              onUpdateEvidence={handleUpdateEvidence}
              onDeleteEvidence={handleDeleteEvidence}
              onAttachEvidenceFile={handleAttachEvidenceFile}
              onRemoveEvidenceFile={handleRemoveEvidenceFile}
            />
          ) : null}

          {state.activeView === 'governance' ? (
            <GovernanceView
              module={currentModule}
              stakeholders={currentStakeholders}
              sites={currentSites}
              assets={currentAssets}
              reviewPlan={state.reviewPlan}
              benchmark={benchmarkSnapshot}
              scoreSnapshot={scoreSnapshot}
              governanceSummary={governanceSummary}
              roleTemplates={roleTemplates}
              onCreateStakeholder={handleCreateEmptyStakeholder}
              onCreateSite={handleCreateEmptySite}
              onCreateAsset={handleCreateEmptyAsset}
              onGenerateRoleTemplates={handleGenerateRoleTemplates}
              onUpdateStakeholder={handleUpdateStakeholder}
              onDeleteStakeholder={handleDeleteStakeholder}
              onUpdateSite={handleUpdateSite}
              onDeleteSite={handleDeleteSite}
              onUpdateAsset={handleUpdateAsset}
              onDeleteAsset={handleDeleteAsset}
              onUpdateReviewPlan={updateReviewPlan}
            />
          ) : null}

          {state.activeView === 'modules' ? (
            <ModulesView
              builtInModules={builtInModules}
              uploadedModules={state.uploadedModules}
              selectedModuleId={state.selectedModuleId}
              onSelectModule={selectModule}
              onImportFiles={handleImportFiles}
              feedback={feedback}
            />
          ) : null}

          {state.activeView === 'kritis' ? (
            <KritisView
              applicability={kritisApplicability}
              requirements={requirements}
              requirementStates={state.requirementStates}
              requirementActionCounts={requirementActionCounts}
              requirementEvidenceCounts={requirementEvidenceCounts}
              certificationState={state.certificationState}
              certificationProgress={certificationProgress}
              module={currentModule}
              auditChecklist={auditChecklist}
              auditChecklistStates={state.auditChecklistStates}
              checklistProgress={checklistProgress}
              findingSummary={findingSummary}
              findings={currentFindings}
              onChangeStatus={handleRequirementChange}
              onCreateAction={handleCreateActionFromRequirement}
              onCreateEvidence={handleCreateEvidenceFromRequirement}
              onUpdateCertificationField={updateCertificationField}
              onUpdateCertificationStage={updateCertificationStage}
              onUpdateChecklistState={updateChecklistState}
              onCreateFinding={handleCreateFinding}
              onGenerateFindingsFromChecklist={handleGenerateFindingsFromChecklist}
              onUpdateFinding={handleUpdateFinding}
              onDeleteFinding={handleDeleteFinding}
            />
          ) : null}

          {state.activeView === 'report' ? (
            <ReportView
              companyProfile={state.companyProfile}
              module={currentModule}
              scoreSnapshot={scoreSnapshot}
              benchmark={benchmarkSnapshot}
              governanceSummary={governanceSummary}
              applicability={kritisApplicability}
              requirementProgress={requirementProgress}
              requirements={requirements}
              requirementStates={state.requirementStates}
              actionItems={currentActionItems}
              evidenceSummary={evidenceSummary}
              certificationProgress={certificationProgress}
              checklistProgress={checklistProgress}
              findingSummary={findingSummary}
              stakeholders={currentStakeholders}
              sites={currentSites}
              onExportMarkdown={handleExportMarkdown}
              onExportActionCsv={() => exportActionPlanAsCsv(currentActionItems)}
              onExportEvidenceCsv={() => exportEvidenceRegisterAsCsv(currentEvidenceItems)}
              onExportStakeholderCsv={() => exportStakeholderRegisterAsCsv(currentStakeholders)}
              onExportFindingCsv={() => exportFindingRegisterAsCsv(currentFindings)}
              onExportFormalHtml={handleExportFormalHtml}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
