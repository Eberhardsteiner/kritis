import { useEffect, useMemo, useState } from 'react';
import { Download, Save } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { AssessmentView } from './views/AssessmentView';
import { DashboardView } from './views/DashboardView';
import { KritisView } from './views/KritisView';
import { MeasuresView } from './views/MeasuresView';
import { ModulesView } from './views/ModulesView';
import { ReportView } from './views/ReportView';
import {
  exportActionPlanAsCsv,
  exportAssessmentAsJson,
  exportEvidenceRegisterAsCsv,
  exportManagementReportAsMarkdown,
} from './lib/exporters';
import {
  builtInModules,
  getActionTemplatesForModule,
  getEvidenceTemplatesForModule,
  getKritisRequirementsForModule,
  getModuleById,
  getQuestionsForModule,
  parseAndValidateModule,
} from './lib/moduleRegistry';
import {
  assessKritisApplicability,
  buildLinkedCountMap,
  computeScoreSnapshot,
  getActionSummary,
  getCertificationProgress,
  getEvidenceSummary,
  getRequirementProgress,
} from './lib/scoring';
import { loadState, saveState } from './lib/storage';
import { kritisCertificationStages } from './data/kritisBase';
import type {
  ActionItem,
  ActionPriority,
  AppState,
  AssessmentFilters,
  CertificationStageState,
  CertificationState,
  CompanyProfile,
  EvidenceItem,
  EvidenceType,
  QuestionDefinition,
  RequirementDefinition,
  RequirementStatus,
  SectorModuleDefinition,
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
  const base = createDefaultCertificationState();

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

function normalizeLoadedActions(
  items: unknown,
  fallbackModuleId: string,
): ActionItem[] {
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

function normalizeLoadedEvidence(
  items: unknown,
  fallbackModuleId: string,
): EvidenceItem[] {
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
      link: item.link ?? '',
      status: item.status ?? 'missing',
      reviewDate: item.reviewDate ?? '',
      sourceType: item.sourceType ?? 'manual',
      sourceId: item.sourceId,
      sourceLabel: item.sourceLabel ?? 'Manuell',
      relatedQuestionIds: item.relatedQuestionIds ?? [],
      relatedRequirementIds: item.relatedRequirementIds ?? [],
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

  const scoreSnapshot = useMemo(
    () => computeScoreSnapshot(questions, state.answers, currentModule),
    [questions, state.answers, currentModule],
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

  const currentActionItems = useMemo(
    () => state.actionItems.filter((item) => item.moduleId === currentModule.id),
    [state.actionItems, currentModule.id],
  );
  const currentEvidenceItems = useMemo(
    () => state.evidenceItems.filter((item) => item.moduleId === currentModule.id),
    [state.evidenceItems, currentModule.id],
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

  function upsertActionDrafts(
    drafts: Array<Omit<ActionItem, 'id' | 'createdAt'>>,
  ) {
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

  function upsertEvidenceDrafts(
    drafts: Array<Omit<EvidenceItem, 'id' | 'createdAt'>>,
  ) {
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
      link: '',
      status: 'missing',
      reviewDate: getDateOffset(60),
      sourceType: 'question',
      sourceId: question.id,
      sourceLabel: question.title,
      relatedQuestionIds: [question.id],
      relatedRequirementIds: [],
      notes: question.evidenceHint ?? question.guidance,
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
      link: '',
      status: 'missing',
      reviewDate: getDateOffset(45),
      sourceType: 'requirement',
      sourceId: requirement.id,
      sourceLabel: requirement.title,
      relatedQuestionIds: [],
      relatedRequirementIds: [requirement.id],
      notes: `${requirement.guidance}${requirement.dueHint ? ` | ${requirement.dueHint}` : ''}`,
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
        link: '',
        status: 'missing',
        reviewDate: getDateOffset(60),
        sourceType: 'manual',
        sourceLabel: 'Manuell',
        relatedQuestionIds: [],
        relatedRequirementIds: [],
        notes: '',
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
      link: '',
      status: 'missing' as const,
      reviewDate: getDateOffset(75),
      sourceType: 'module_template' as const,
      sourceId: template.id,
      sourceLabel: template.title,
      relatedQuestionIds: template.relatedQuestionIds ?? [],
      relatedRequirementIds: template.relatedRequirementIds ?? [],
      notes: template.reviewCycleHint ?? '',
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
      certificationState: state.certificationState,
      certificationProgress,
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
              requirementScore={requirementProgress.score}
              actionSummary={actionSummary}
              evidenceSummary={evidenceSummary}
              certificationProgress={certificationProgress}
              applicability={kritisApplicability}
              onGoToAssessment={() => setActiveView('assessment')}
              onGoToMeasures={() => setActiveView('measures')}
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
              onChangeStatus={handleRequirementChange}
              onCreateAction={handleCreateActionFromRequirement}
              onCreateEvidence={handleCreateEvidenceFromRequirement}
              onUpdateCertificationField={updateCertificationField}
              onUpdateCertificationStage={updateCertificationStage}
            />
          ) : null}

          {state.activeView === 'report' ? (
            <ReportView
              companyProfile={state.companyProfile}
              module={currentModule}
              scoreSnapshot={scoreSnapshot}
              applicability={kritisApplicability}
              requirementProgress={requirementProgress}
              requirements={requirements}
              requirementStates={state.requirementStates}
              actionItems={currentActionItems}
              evidenceSummary={evidenceSummary}
              certificationProgress={certificationProgress}
              onExportMarkdown={handleExportMarkdown}
              onExportActionCsv={() => exportActionPlanAsCsv(currentActionItems)}
              onExportEvidenceCsv={() => exportEvidenceRegisterAsCsv(currentEvidenceItems)}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
