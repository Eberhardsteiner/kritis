import { useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, CloudOff, Download, RefreshCw, Save } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { AssessmentView } from './views/AssessmentView';
import { DashboardView } from './views/DashboardView';
import { GovernanceView } from './views/GovernanceView';
import { ControlView } from './views/ControlView';
import { KritisView } from './views/KritisView';
import { MeasuresView } from './views/MeasuresView';
import { ModulesView } from './views/ModulesView';
import { ReportView } from './views/ReportView';
import { PlatformView } from './views/PlatformView';
import {
  exportActionPlanAsCsv,
  exportAssessmentAsJson,
  exportAuditPackAsPdf,
  exportEvidenceRegisterAsCsv,
  exportFindingRegisterAsCsv,
  exportFormalAuditReportAsHtml,
  exportManagementReportAsMarkdown,
  exportManagementReportAsPdf,
  exportStakeholderRegisterAsCsv,
} from './lib/exporters';
import {
  builtInModules,
  getActionTemplatesForModule,
  getAuditChecklistForModule,
  getDocumentFoldersForModule,
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
import { getAccessProfile } from './data/workspaceBase';
import {
  buildDeadlineSummary,
  buildDocumentLibrarySummary,
  getDocumentFolderSuggestions,
} from './lib/workspace';
import { loadState, saveState } from './lib/storage';
import {
  createSnapshot,
  fetchAuditLog,
  fetchServerHealth,
  fetchServerState,
  fetchSnapshots,
  removeEvidenceAttachment,
  restoreSnapshot,
  syncStateToServer,
  uploadEvidenceAttachment,
} from './lib/serverApi';
import { kritisCertificationStages } from './data/kritisBase';
import type {
  ActionItem,
  ActionPriority,
  AppState,
  AuditLogEntry,
  AssessmentFilters,
  AssetItem,
  AuditChecklistState,
  AuditFindingItem,
  CertificationStageState,
  CertificationState,
  CompanyProfile,
  ComplianceCalendar,
  EvidenceAttachment,
  EvidenceClassification,
  EvidenceItem,
  EvidenceType,
  PermissionKey,
  QuestionDefinition,
  RequirementDefinition,
  RequirementStatus,
  ReviewPlan,
  ServerHealth,
  SnapshotInfo,
  SectorModuleDefinition,
  SiteItem,
  StakeholderItem,
  UserItem,
  UserRoleProfile,
  UserStatus,
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
const MAX_SERVER_ATTACHMENT_BYTES = 12 * 1024 * 1024;

type ServerMode = 'checking' | 'connected' | 'syncing' | 'offline' | 'error';

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

function normalizeServerAttachment(value: unknown): EvidenceItem['serverAttachment'] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Partial<NonNullable<EvidenceItem['serverAttachment']>>;
  if (
    typeof candidate.id !== 'string'
    || typeof candidate.fileName !== 'string'
    || typeof candidate.storedFileName !== 'string'
    || typeof candidate.mimeType !== 'string'
    || typeof candidate.sizeKb !== 'number'
    || typeof candidate.url !== 'string'
    || typeof candidate.uploadedAt !== 'string'
    || typeof candidate.uploadedBy !== 'string'
  ) {
    return undefined;
  }

  return {
    id: candidate.id,
    fileName: candidate.fileName,
    storedFileName: candidate.storedFileName,
    mimeType: candidate.mimeType,
    sizeKb: candidate.sizeKb,
    url: candidate.url,
    uploadedAt: candidate.uploadedAt,
    uploadedBy: candidate.uploadedBy,
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
      folder: item.folder ?? 'Allgemein',
      tags: Array.isArray(item.tags) ? item.tags.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())) : [],
      externalId: item.externalId ?? '',
      link: item.link ?? '',
      status: item.status ?? 'missing',
      reviewDate: item.reviewDate ?? '',
      validUntil: item.validUntil ?? '',
      reviewCycleDays: typeof item.reviewCycleDays === 'number' && Number.isFinite(item.reviewCycleDays) ? item.reviewCycleDays : 180,
      sourceType: item.sourceType ?? 'manual',
      sourceId: item.sourceId,
      sourceLabel: item.sourceLabel ?? 'Manuell',
      relatedQuestionIds: item.relatedQuestionIds ?? [],
      relatedRequirementIds: item.relatedRequirementIds ?? [],
      notes: item.notes ?? '',
      attachment: normalizeAttachment(item.attachment),
      serverAttachment: normalizeServerAttachment(item.serverAttachment),
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


function normalizeUserRoleProfile(value: string | undefined): UserRoleProfile {
  if (
    value === 'admin'
    || value === 'lead'
    || value === 'editor'
    || value === 'reviewer'
    || value === 'auditor'
    || value === 'viewer'
  ) {
    return value;
  }
  return 'lead';
}

function normalizeUserStatus(value: string | undefined): UserStatus {
  if (value === 'active' || value === 'invited' || value === 'inactive') {
    return value;
  }
  return 'active';
}

function normalizeLoadedUsers(items: unknown): UserItem[] {
  if (!Array.isArray(items) || !items.length) {
    return [
      {
        id: createId('usr'),
        name: 'Programmadmin',
        email: '',
        department: '',
        roleProfile: 'admin',
        status: 'active',
        scope: 'Gesamtprogramm',
        notes: '',
      },
    ];
  }

  return items
    .filter((item): item is Partial<UserItem> => typeof item === 'object' && item !== null)
    .map((item, index) => ({
      id: item.id ?? createId('usr'),
      name: item.name ?? (index === 0 ? 'Programmadmin' : ''),
      email: item.email ?? '',
      department: item.department ?? '',
      roleProfile: normalizeUserRoleProfile(item.roleProfile),
      status: normalizeUserStatus(item.status),
      scope: item.scope ?? 'Gesamtprogramm',
      notes: item.notes ?? '',
      linkedStakeholderId: item.linkedStakeholderId,
    }));
}

function normalizeComplianceCalendar(input?: Partial<ComplianceCalendar>): ComplianceCalendar {
  return {
    registrationDate: input?.registrationDate ?? '',
    lastRiskAssessmentDate: input?.lastRiskAssessmentDate ?? '',
    lastResiliencePlanUpdate: input?.lastResiliencePlanUpdate ?? '',
    lastBsiEvidenceAuditDate: input?.lastBsiEvidenceAuditDate ?? '',
    incidentContact: input?.incidentContact ?? '',
    incidentBackupContact: input?.incidentBackupContact ?? '',
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

function buildAppStateFromLoaded(
  loaded?: Partial<AppState> | null,
  uiState?: Partial<Pick<AppState, 'activeView' | 'selectedModuleId' | 'activeUserId' | 'assessmentFilters'>>,
): AppState {
  const availableModules = [...builtInModules, ...(loaded?.uploadedModules ?? [])];
  const requestedModuleId = uiState?.selectedModuleId ?? loaded?.selectedModuleId ?? builtInModules[0].id;
  const fallbackModuleId = availableModules.some((module) => module.id === requestedModuleId)
    ? requestedModuleId
    : builtInModules[0].id;
  const users = normalizeLoadedUsers(loaded?.users);

  return {
    activeView: uiState?.activeView ?? loaded?.activeView ?? 'dashboard',
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
    users,
    activeUserId: users.some((item) => item.id === (uiState?.activeUserId ?? loaded?.activeUserId))
      ? ((uiState?.activeUserId ?? loaded?.activeUserId) as string)
      : users[0]?.id ?? '',
    complianceCalendar: normalizeComplianceCalendar(loaded?.complianceCalendar),
    auditChecklistStates: loaded?.auditChecklistStates ?? {},
    auditFindings: normalizeLoadedFindings(loaded?.auditFindings, fallbackModuleId),
    certificationState: normalizeCertificationState(loaded?.certificationState),
    assessmentFilters: {
      ...defaultAssessmentFilters,
      ...(loaded?.assessmentFilters ?? {}),
      ...(uiState?.assessmentFilters ?? {}),
    },
  };
}

function createInitialState(): AppState {
  return buildAppStateFromLoaded(loadState());
}

function buildServerPayload(state: AppState): Partial<AppState> {
  return {
    uploadedModules: state.uploadedModules,
    answers: state.answers,
    requirementStates: state.requirementStates,
    companyProfile: state.companyProfile,
    actionItems: state.actionItems,
    evidenceItems: state.evidenceItems,
    stakeholders: state.stakeholders,
    sites: state.sites,
    assets: state.assets,
    reviewPlan: state.reviewPlan,
    users: state.users,
    complianceCalendar: state.complianceCalendar,
    auditChecklistStates: state.auditChecklistStates,
    auditFindings: state.auditFindings,
    certificationState: state.certificationState,
  };
}

function serializeServerPayload(state: AppState): string {
  return JSON.stringify(buildServerPayload(state));
}

function applyRemoteState(remoteState: Partial<AppState>, currentState: AppState): AppState {
  return buildAppStateFromLoaded(remoteState, {
    activeView: currentState.activeView,
    selectedModuleId: currentState.selectedModuleId,
    activeUserId: currentState.activeUserId,
    assessmentFilters: currentState.assessmentFilters,
  });
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

function inferRoleProfileFromStakeholder(stakeholder: StakeholderItem): UserRoleProfile {
  const text = `${stakeholder.roleLabel} ${stakeholder.approvalScope} ${stakeholder.responsibilities}`.toLowerCase();

  if (text.includes('admin') || text.includes('administrator')) {
    return 'admin';
  }
  if (
    text.includes('leiter')
    || text.includes('lead')
    || text.includes('sponsor')
    || text.includes('geschäfts')
    || text.includes('vorstand')
  ) {
    return 'lead';
  }
  if (
    text.includes('audit')
    || text.includes('prüf')
    || text.includes('revision')
  ) {
    return 'auditor';
  }
  if (
    text.includes('review')
    || text.includes('freigabe')
    || text.includes('compliance')
  ) {
    return 'reviewer';
  }
  return 'editor';
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
  const [notice, setNotice] = useState<ImportFeedback | null>(null);
  const [serverMode, setServerMode] = useState<ServerMode>('checking');
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);
  const [lastServerLoadAt, setLastServerLoadAt] = useState('');
  const [lastServerSyncAt, setLastServerSyncAt] = useState('');
  const [syncError, setSyncError] = useState('');
  const [auditLogEntries, setAuditLogEntries] = useState<AuditLogEntry[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const serverInitializedRef = useRef(false);
  const suppressNextServerSyncRef = useRef(false);
  const lastSyncedPayloadRef = useRef<string>(serializeServerPayload(state));

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
  const documentFolders = useMemo(
    () => getDocumentFolderSuggestions(getDocumentFoldersForModule(currentModule), currentEvidenceItems),
    [currentModule, currentEvidenceItems],
  );
  const activeUser = useMemo(
    () => state.users.find((item) => item.id === state.activeUserId) ?? state.users[0] ?? null,
    [state.users, state.activeUserId],
  );
  const activeAccessProfile = useMemo(
    () => getAccessProfile(activeUser?.roleProfile ?? 'admin'),
    [activeUser],
  );

  function hasPermission(permission: PermissionKey): boolean {
    return activeAccessProfile.permissions.includes(permission);
  }

  function showNotice(type: ImportFeedback['type'], text: string, details?: string[]) {
    setNotice({ type, text, details });
  }

  function runWithPermission(
    permission: PermissionKey,
    text: string,
    action: () => void,
  ): boolean {
    if (!hasPermission(permission)) {
      showNotice('error', text, [`Aktives Profil: ${activeAccessProfile.label}`, `Erforderliches Recht: ${permission}`]);
      return false;
    }

    action();
    return true;
  }

  async function refreshServerSideData(): Promise<void> {
    try {
      const [health, audit, snapshotList] = await Promise.all([
        fetchServerHealth(),
        fetchAuditLog(),
        fetchSnapshots(),
      ]);
      setServerHealth(health);
      setAuditLogEntries(audit.entries);
      setSnapshots(snapshotList.snapshots);
      setServerMode('connected');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Serverdaten konnten nicht geladen werden.';
      setServerMode('offline');
      setSyncError(message);
    }
  }

  async function loadStateFromServer(): Promise<boolean> {
    try {
      setServerMode('checking');
      const [health, remote] = await Promise.all([
        fetchServerHealth(),
        fetchServerState(),
      ]);
      setServerHealth(health);

      if (remote.state) {
        suppressNextServerSyncRef.current = true;
        setState((current) => applyRemoteState(remote.state ?? {}, current));
        const hydrated = applyRemoteState(remote.state ?? {}, state);
        lastSyncedPayloadRef.current = serializeServerPayload(hydrated);
      } else {
        lastSyncedPayloadRef.current = serializeServerPayload(state);
      }

      setLastServerLoadAt(new Date().toISOString());
      setSyncError('');
      setServerMode('connected');
      serverInitializedRef.current = true;
      await refreshServerSideData();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Server ist aktuell nicht erreichbar.';
      setServerMode('offline');
      setSyncError(message);
      serverInitializedRef.current = true;
      return false;
    }
  }

  async function pushStateToServer(nextState: AppState, reason?: string): Promise<void> {
    try {
      setServerMode('syncing');
      const response = await syncStateToServer(nextState, nextState.activeUserId);
      lastSyncedPayloadRef.current = JSON.stringify(response.state ?? buildServerPayload(nextState));
      suppressNextServerSyncRef.current = true;
      setState((current) => applyRemoteState(response.state ?? buildServerPayload(nextState), current));
      setLastServerSyncAt(response.savedAt);
      setSyncError('');
      setServerMode('connected');
      await refreshServerSideData();
      if (reason) {
        showNotice('success', reason);
      }
    } catch (error) {
      const details = error instanceof Error && 'details' in error && Array.isArray((error as Error & { details?: string[] }).details)
        ? (error as Error & { details?: string[] }).details
        : undefined;
      const message = error instanceof Error ? error.message : 'Synchronisierung fehlgeschlagen.';
      setSyncError(message);
      setServerMode('error');
      showNotice('error', message, details);
    }
  }

  async function handleRefreshServer() {
    const success = await loadStateFromServer();
    if (success) {
      showNotice('success', 'Serverstand wurde neu geladen.');
    }
  }

  async function handleSyncNow() {
    if (serverMode === 'offline' || serverMode === 'checking') {
      showNotice('error', 'Aktuell ist kein API-Server erreichbar.');
      return;
    }

    await pushStateToServer(state, 'Änderungen wurden an den Server übertragen.');
  }

  async function handleCreateSnapshotOnServer(name: string, comment: string) {
    if (!hasPermission('workspace_edit')) {
      showNotice('error', 'Für Snapshots fehlt dem aktiven Profil das Recht workspace_edit.');
      return;
    }

    try {
      const response = await createSnapshot(state.activeUserId, name, comment);
      setSnapshots((current) => [response.snapshot, ...current.filter((item) => item.id !== response.snapshot.id)]);
      await refreshServerSideData();
      showNotice('success', `Snapshot „${response.snapshot.name}“ wurde gespeichert.`);
    } catch (error) {
      const details = error instanceof Error && 'details' in error && Array.isArray((error as Error & { details?: string[] }).details)
        ? (error as Error & { details?: string[] }).details
        : undefined;
      showNotice('error', error instanceof Error ? error.message : 'Snapshot konnte nicht erstellt werden.', details);
    }
  }

  async function handleRestoreSnapshot(snapshotId: string) {
    if (!hasPermission('workspace_edit')) {
      showNotice('error', 'Für die Wiederherstellung fehlt dem aktiven Profil das Recht workspace_edit.');
      return;
    }

    try {
      const response = await restoreSnapshot(state.activeUserId, snapshotId);
      suppressNextServerSyncRef.current = true;
      setState((current) => applyRemoteState(response.state, current));
      lastSyncedPayloadRef.current = JSON.stringify(response.state ?? {});
      setLastServerSyncAt(new Date().toISOString());
      setSyncError('');
      setServerMode('connected');
      await refreshServerSideData();
      showNotice('success', `Snapshot „${response.snapshot.name}“ wurde wiederhergestellt.`);
    } catch (error) {
      const details = error instanceof Error && 'details' in error && Array.isArray((error as Error & { details?: string[] }).details)
        ? (error as Error & { details?: string[] }).details
        : undefined;
      showNotice('error', error instanceof Error ? error.message : 'Snapshot konnte nicht wiederhergestellt werden.', details);
    }
  }

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
  const documentLibrarySummary = useMemo(
    () => buildDocumentLibrarySummary(currentEvidenceItems),
    [currentEvidenceItems],
  );
  const governanceSummary = useMemo(
    () => getGovernanceSummary(currentStakeholders, currentSites, currentAssets, state.reviewPlan),
    [currentStakeholders, currentSites, currentAssets, state.reviewPlan],
  );
  const deadlineSummary = useMemo(
    () => buildDeadlineSummary({
      actionItems: currentActionItems,
      evidenceItems: currentEvidenceItems,
      reviewPlan: state.reviewPlan,
      complianceCalendar: state.complianceCalendar,
      applicability: kritisApplicability,
    }),
    [currentActionItems, currentEvidenceItems, state.reviewPlan, state.complianceCalendar, kritisApplicability],
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
  const attachmentCount = useMemo(
    () => state.evidenceItems.filter((item) => item.attachment || item.serverAttachment).length,
    [state.evidenceItems],
  );
  const readOnlyHint = useMemo(() => {
    if (state.activeView === 'assessment' && !hasPermission('assessment_edit')) {
      return 'Lesemodus: Für Analyse und Unternehmensprofil fehlen dem aktiven Profil Schreibrechte.';
    }
    if (state.activeView === 'measures' && !hasPermission('actions_edit') && !hasPermission('evidence_edit')) {
      return 'Lesemodus: Für Maßnahmen und Evidenzen fehlen dem aktiven Profil Schreibrechte.';
    }
    if (state.activeView === 'governance' && !hasPermission('governance_edit')) {
      return 'Lesemodus: Governance- und Strukturänderungen sind für dieses Profil gesperrt.';
    }
    if (state.activeView === 'control' && !hasPermission('workspace_edit')) {
      return 'Lesemodus: Nutzerverwaltung und Compliance-Kalender erfordern workspace_edit.';
    }
    if (state.activeView === 'modules' && !hasPermission('modules_manage')) {
      return 'Lesemodus: Das Importieren oder Pflegen von Branchenmodulen ist für dieses Profil gesperrt.';
    }
    if (state.activeView === 'kritis' && !hasPermission('kritis_edit')) {
      return 'Lesemodus: KRITIS-Bausteine, Audit-Checklist und Zertifizierungsstufen erfordern kritis_edit.';
    }
    if (state.activeView === 'report' && !hasPermission('reports_export')) {
      return 'Hinweis: Exporte sind für dieses Profil deaktiviert.';
    }
    if (state.activeView === 'platform' && !hasPermission('workspace_edit')) {
      return 'Hinweis: Server-Snapshots und Wiederherstellungen erfordern workspace_edit.';
    }
    return '';
  }, [state.activeView, activeAccessProfile]);

  useEffect(() => {
    void loadStateFromServer();
  }, []);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!serverInitializedRef.current) {
      return undefined;
    }

    const payload = serializeServerPayload(state);

    if (suppressNextServerSyncRef.current) {
      suppressNextServerSyncRef.current = false;
      lastSyncedPayloadRef.current = payload;
      return undefined;
    }

    if (!autoSyncEnabled || serverMode === 'offline' || serverMode === 'checking' || serverMode === 'error') {
      return undefined;
    }

    if (payload === lastSyncedPayloadRef.current) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void pushStateToServer(state);
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [state, autoSyncEnabled, serverMode]);

  useEffect(() => {
    if (!getModuleById(state.selectedModuleId, state.uploadedModules)) {
      setState((current) => ({
        ...current,
        selectedModuleId: builtInModules[0].id,
      }));
    }
  }, [state.selectedModuleId, state.uploadedModules]);

  useEffect(() => {
    if (!state.users.length) {
      const fallbackUsers = normalizeLoadedUsers([]);
      setState((current) => ({
        ...current,
        users: fallbackUsers,
        activeUserId: fallbackUsers[0]?.id ?? '',
      }));
      return;
    }

    if (!state.users.some((item) => item.id === state.activeUserId)) {
      setState((current) => ({
        ...current,
        activeUserId: current.users[0]?.id ?? '',
      }));
    }
  }, [state.users, state.activeUserId]);

  function setActiveView(activeView: AppState['activeView']) {
    setState((current) => ({ ...current, activeView }));
  }

  function updateProfileField(field: keyof CompanyProfile, value: string) {
    runWithPermission('assessment_edit', 'Für Änderungen am Unternehmensprofil fehlt das Recht assessment_edit.', () => {
      setState((current) => ({
        ...current,
        companyProfile: {
          ...current.companyProfile,
          [field]: value,
        },
      }));
    });
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
    runWithPermission('governance_edit', 'Für Änderungen am Reviewplan fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        reviewPlan: {
          ...current.reviewPlan,
          [field]: value,
        },
      }));
    });
  }


  function updateComplianceCalendar(field: keyof ComplianceCalendar, value: string) {
    runWithPermission('workspace_edit', 'Für Änderungen am Compliance-Kalender fehlt das Recht workspace_edit.', () => {
      setState((current) => ({
        ...current,
        complianceCalendar: {
          ...current.complianceCalendar,
          [field]: value,
        },
      }));
    });
  }

  function selectActiveUser(userId: string) {
    setState((current) => ({
      ...current,
      activeUserId: userId,
    }));
  }

  function handleCreateUser() {
    runWithPermission('workspace_edit', 'Für das Anlegen von Nutzern fehlt das Recht workspace_edit.', () => {
      setState((current) => {
        const newUser: UserItem = {
          id: createId('usr'),
          name: '',
          email: '',
          department: '',
          roleProfile: 'editor',
          status: 'active',
          scope: currentModule.name,
          notes: '',
        };

        return {
          ...current,
          users: [newUser, ...current.users],
          activeUserId: newUser.id,
          activeView: 'control',
        };
      });
    });
  }

  function handleGenerateUsersFromStakeholders() {
    runWithPermission('workspace_edit', 'Für die Ableitung von Nutzern fehlt das Recht workspace_edit.', () => {
      setState((current) => {
        const moduleStakeholders = current.stakeholders.filter((item) => item.moduleId === currentModule.id);
        const users = [...current.users];

        moduleStakeholders.forEach((stakeholder) => {
          const exists = users.some(
            (user) => user.linkedStakeholderId === stakeholder.id
              || (user.email && stakeholder.email && user.email === stakeholder.email),
          );

          if (!exists) {
            users.unshift({
              id: createId('usr'),
              name: stakeholder.name,
              email: stakeholder.email,
              department: stakeholder.department,
              roleProfile: inferRoleProfileFromStakeholder(stakeholder),
              status: 'active',
              scope: stakeholder.approvalScope || stakeholder.roleLabel || currentModule.name,
              notes: stakeholder.notes,
              linkedStakeholderId: stakeholder.id,
            });
          }
        });

        return {
          ...current,
          users,
          activeView: 'control',
        };
      });
    });
  }

  function handleUpdateUser(userId: string, patch: Partial<UserItem>) {
    runWithPermission('workspace_edit', 'Für Änderungen an Nutzerprofilen fehlt das Recht workspace_edit.', () => {
      setState((current) => ({
        ...current,
        users: current.users.map((item) => (
          item.id === userId
            ? {
                ...item,
                ...patch,
                roleProfile: normalizeUserRoleProfile((patch.roleProfile as string | undefined) ?? item.roleProfile),
                status: normalizeUserStatus((patch.status as string | undefined) ?? item.status),
              }
            : item
        )),
      }));
    });
  }

  function handleDeleteUser(userId: string) {
    runWithPermission('workspace_edit', 'Für das Löschen von Nutzern fehlt das Recht workspace_edit.', () => {
      setState((current) => {
        const remainingUsers = current.users.filter((item) => item.id !== userId);
        if (!remainingUsers.length) {
          const fallbackUsers = normalizeLoadedUsers([]);
          return {
            ...current,
            users: fallbackUsers,
            activeUserId: fallbackUsers[0]?.id ?? '',
          };
        }

        return {
          ...current,
          users: remainingUsers,
          activeUserId: current.activeUserId === userId ? remainingUsers[0]?.id ?? '' : current.activeUserId,
        };
      });
    });
  }

  function updateCertificationField(
    field: 'auditLead' | 'targetDate' | 'decisionNote',
    value: string,
  ) {
    runWithPermission('kritis_edit', 'Für Änderungen an der Zertifizierungssteuerung fehlt das Recht kritis_edit.', () => {
      setState((current) => ({
        ...current,
        certificationState: {
          ...current.certificationState,
          [field]: value,
        },
      }));
    });
  }

  function updateCertificationStage(stageId: string, patch: Partial<CertificationStageState>) {
    runWithPermission('kritis_edit', 'Für Änderungen an Zertifizierungsstufen fehlt das Recht kritis_edit.', () => {
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
    });
  }

  function updateChecklistState(itemId: string, patch: Partial<AuditChecklistState>) {
    runWithPermission('kritis_edit', 'Für Änderungen an der Audit-Checklist fehlt das Recht kritis_edit.', () => {
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
    });
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
    runWithPermission('assessment_edit', 'Für Bewertungsänderungen fehlt das Recht assessment_edit.', () => {
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
    });
  }

  function handleNoteChange(questionId: string, note: string) {
    runWithPermission('assessment_edit', 'Für Notizen in der Analyse fehlt das Recht assessment_edit.', () => {
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
    });
  }

  function handleRequirementChange(requirementId: string, status: RequirementStatus) {
    runWithPermission('kritis_edit', 'Für Statusänderungen bei KRITIS-Bausteinen fehlt das Recht kritis_edit.', () => {
      setState((current) => ({
        ...current,
        requirementStates: {
          ...current.requirementStates,
          [requirementId]: status,
        },
      }));
    });
  }

  async function handleImportFiles(files: FileList | null) {
    if (!hasPermission('modules_manage')) {
      showNotice('error', 'Für den Modulimport fehlt das Recht modules_manage.');
      return;
    }

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
    runWithPermission('actions_edit', 'Für Maßnahmenänderungen fehlt das Recht actions_edit.', () => {
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
    });
  }

  function upsertEvidenceDrafts(drafts: Array<Omit<EvidenceItem, 'id' | 'createdAt'>>) {
    runWithPermission('evidence_edit', 'Für Evidenzänderungen fehlt das Recht evidence_edit.', () => {
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
    });
  }

  function createEvidenceDraft(
    patch: Partial<Omit<EvidenceItem, 'id' | 'createdAt'>> = {},
  ): Omit<EvidenceItem, 'id' | 'createdAt'> {
    return {
      moduleId: currentModule.id,
      title: '',
      type: 'other',
      owner: '',
      reviewer: '',
      version: '1.0',
      classification: 'intern',
      folder: documentFolders[0] ?? 'Allgemein',
      tags: [],
      externalId: '',
      link: '',
      status: 'missing',
      reviewDate: getDateOffset(60),
      validUntil: getDateOffset(365),
      reviewCycleDays: 180,
      sourceType: 'manual',
      sourceLabel: 'Manuell',
      relatedQuestionIds: [],
      relatedRequirementIds: [],
      notes: '',
      attachment: undefined,
      ...patch,
    };
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
    return createEvidenceDraft({
      title: question.evidenceHint ? `${question.title} - Evidenz` : question.title,
      type: guessEvidenceType(`${question.evidenceHint ?? ''} ${question.title}`),
      sourceType: 'question',
      sourceId: question.id,
      sourceLabel: question.title,
      relatedQuestionIds: [question.id],
      notes: question.evidenceHint ?? question.guidance,
      tags: question.tags ?? [],
    });
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
    return createEvidenceDraft({
      title: `Nachweis - ${requirement.title}`,
      type: guessEvidenceType(`${requirement.title} ${requirement.guidance}`),
      reviewDate: getDateOffset(45),
      sourceType: 'requirement',
      sourceId: requirement.id,
      sourceLabel: requirement.title,
      relatedRequirementIds: [requirement.id],
      notes: `${requirement.guidance}${requirement.dueHint ? ` | ${requirement.dueHint}` : ''}`,
      tags: ['KRITIS'],
    });
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
    upsertEvidenceDrafts([createEvidenceDraft()]);
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
    const drafts = evidenceTemplates.map((template) => createEvidenceDraft({
      title: template.title,
      type: template.type,
      owner: template.ownerRole ?? '',
      folder: template.folder ?? documentFolders[0] ?? 'Allgemein',
      tags: template.tags ?? [],
      reviewDate: getDateOffset(75),
      reviewCycleDays: 180,
      sourceType: 'module_template',
      sourceId: template.id,
      sourceLabel: template.title,
      relatedQuestionIds: template.relatedQuestionIds ?? [],
      relatedRequirementIds: template.relatedRequirementIds ?? [],
      notes: template.reviewCycleHint ?? '',
    }));

    upsertEvidenceDrafts(drafts);
  }

  function handleUpdateAction(actionId: string, patch: Partial<ActionItem>) {
    runWithPermission('actions_edit', 'Für Änderungen an Maßnahmen fehlt das Recht actions_edit.', () => {
      setState((current) => ({
        ...current,
        actionItems: current.actionItems.map((item) => (
          item.id === actionId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteAction(actionId: string) {
    runWithPermission('actions_edit', 'Für das Löschen von Maßnahmen fehlt das Recht actions_edit.', () => {
      setState((current) => ({
        ...current,
        actionItems: current.actionItems.filter((item) => item.id !== actionId),
      }));
    });
  }

  function handleUpdateEvidence(evidenceId: string, patch: Partial<EvidenceItem>) {
    runWithPermission('evidence_edit', 'Für Änderungen an Evidenzen fehlt das Recht evidence_edit.', () => {
      setState((current) => ({
        ...current,
        evidenceItems: current.evidenceItems.map((item) => (
          item.id === evidenceId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteEvidence(evidenceId: string) {
    runWithPermission('evidence_edit', 'Für das Löschen von Evidenzen fehlt das Recht evidence_edit.', () => {
      setState((current) => ({
        ...current,
        evidenceItems: current.evidenceItems.filter((item) => item.id !== evidenceId),
        auditFindings: current.auditFindings.map((finding) => ({
          ...finding,
          relatedEvidenceIds: finding.relatedEvidenceIds.filter((id) => id !== evidenceId),
        })),
      }));
    });
  }

  async function handleAttachEvidenceFile(evidenceId: string, file: File | null) {
    if (!file) {
      return;
    }

    if (!hasPermission('evidence_edit')) {
      showNotice('error', 'Für Dateianhänge fehlt das Recht evidence_edit.');
      return;
    }

    if (serverMode === 'connected' || serverMode === 'syncing') {
      if (file.size > MAX_SERVER_ATTACHMENT_BYTES) {
        showNotice('error', 'Die Datei ist für den Prototyp zu groß. Bitte unter 12 MB bleiben.');
        return;
      }

      try {
        const response = await uploadEvidenceAttachment(state.activeUserId, evidenceId, file);
        setState((current) => {
          const nextState = {
            ...current,
            evidenceItems: current.evidenceItems.map((item) => (
              item.id === evidenceId
                ? {
                    ...item,
                    serverAttachment: response.attachment,
                    attachment: undefined,
                    status: item.status === 'missing' ? 'draft' : item.status,
                  }
                : item
            )),
          };
          lastSyncedPayloadRef.current = serializeServerPayload(nextState);
          suppressNextServerSyncRef.current = true;
          return nextState;
        });
        setLastServerSyncAt(new Date().toISOString());
        setSyncError('');
        await refreshServerSideData();
        showNotice('success', `Datei „${file.name}“ wurde serverseitig gespeichert.`);
        return;
      } catch (error) {
        const details = error instanceof Error && 'details' in error && Array.isArray((error as Error & { details?: string[] }).details)
          ? (error as Error & { details?: string[] }).details
          : undefined;
        showNotice('error', error instanceof Error ? error.message : 'Datei konnte nicht hochgeladen werden.', details);
        return;
      }
    }

    if (file.size > MAX_LOCAL_ATTACHMENT_BYTES) {
      showNotice('error', 'Die Datei ist für den lokalen Browser-Prototyp zu groß. Bitte unter ca. 450 KB bleiben.');
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
              serverAttachment: undefined,
              status: item.status === 'missing' ? 'draft' : item.status,
            }
          : item
      )),
    }));
    showNotice('success', `Datei „${file.name}“ wurde lokal im Browser gespeichert.`);
  }

  async function handleRemoveEvidenceFile(evidenceId: string) {
    if (!hasPermission('evidence_edit')) {
      showNotice('error', 'Für das Entfernen von Dateianhängen fehlt das Recht evidence_edit.');
      return;
    }

    const evidence = state.evidenceItems.find((item) => item.id === evidenceId);
    if (evidence?.serverAttachment && (serverMode === 'connected' || serverMode === 'syncing')) {
      try {
        await removeEvidenceAttachment(state.activeUserId, evidenceId);
        await refreshServerSideData();
      } catch (error) {
        const details = error instanceof Error && 'details' in error && Array.isArray((error as Error & { details?: string[] }).details)
          ? (error as Error & { details?: string[] }).details
          : undefined;
        showNotice('error', error instanceof Error ? error.message : 'Server-Datei konnte nicht entfernt werden.', details);
        return;
      }
    }

    setState((current) => {
      const nextState = {
        ...current,
        evidenceItems: current.evidenceItems.map((item) => (
          item.id === evidenceId ? { ...item, attachment: undefined, serverAttachment: undefined } : item
        )),
      };
      if (evidence?.serverAttachment && (serverMode === 'connected' || serverMode === 'syncing')) {
        lastSyncedPayloadRef.current = serializeServerPayload(nextState);
        suppressNextServerSyncRef.current = true;
      }
      return nextState;
    });
    showNotice('success', 'Dateianhang wurde entfernt.');
  }

  function handleCreateEmptyStakeholder() {
    runWithPermission('governance_edit', 'Für Stakeholder-Änderungen fehlt das Recht governance_edit.', () => {
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
    });
  }

  function handleGenerateRoleTemplates() {
    runWithPermission('governance_edit', 'Für Rollenvorlagen fehlt das Recht governance_edit.', () => {
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
    });
  }

  function handleUpdateStakeholder(stakeholderId: string, patch: Partial<StakeholderItem>) {
    runWithPermission('governance_edit', 'Für Änderungen an Stakeholdern fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        stakeholders: current.stakeholders.map((item) => (
          item.id === stakeholderId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteStakeholder(stakeholderId: string) {
    runWithPermission('governance_edit', 'Für das Löschen von Stakeholdern fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        stakeholders: current.stakeholders.filter((item) => item.id !== stakeholderId),
      }));
    });
  }

  function handleCreateEmptySite() {
    runWithPermission('governance_edit', 'Für Standortänderungen fehlt das Recht governance_edit.', () => {
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
    });
  }

  function handleUpdateSite(siteId: string, patch: Partial<SiteItem>) {
    runWithPermission('governance_edit', 'Für Änderungen an Standorten fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        sites: current.sites.map((item) => (
          item.id === siteId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteSite(siteId: string) {
    runWithPermission('governance_edit', 'Für das Löschen von Standorten fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        sites: current.sites.filter((item) => item.id !== siteId),
        assets: current.assets.map((asset) => (
          asset.siteId === siteId ? { ...asset, siteId: '' } : asset
        )),
      }));
    });
  }

  function handleCreateEmptyAsset() {
    runWithPermission('governance_edit', 'Für Asset-Änderungen fehlt das Recht governance_edit.', () => {
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
    });
  }

  function handleUpdateAsset(assetId: string, patch: Partial<AssetItem>) {
    runWithPermission('governance_edit', 'Für Änderungen an Assets fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        assets: current.assets.map((item) => (
          item.id === assetId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteAsset(assetId: string) {
    runWithPermission('governance_edit', 'Für das Löschen von Assets fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        assets: current.assets.filter((item) => item.id !== assetId),
      }));
    });
  }

  function handleCreateFinding() {
    runWithPermission('kritis_edit', 'Für Feststellungen fehlt das Recht kritis_edit.', () => {
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
    });
  }

  function handleGenerateFindingsFromChecklist() {
    runWithPermission('kritis_edit', 'Für die automatische Ableitung von Feststellungen fehlt das Recht kritis_edit.', () => {
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
    });
  }

  function handleUpdateFinding(findingId: string, patch: Partial<AuditFindingItem>) {
    runWithPermission('kritis_edit', 'Für Änderungen an Feststellungen fehlt das Recht kritis_edit.', () => {
      setState((current) => ({
        ...current,
        auditFindings: current.auditFindings.map((item) => (
          item.id === findingId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteFinding(findingId: string) {
    runWithPermission('kritis_edit', 'Für das Löschen von Feststellungen fehlt das Recht kritis_edit.', () => {
      setState((current) => ({
        ...current,
        auditFindings: current.auditFindings.filter((item) => item.id !== findingId),
      }));
    });
  }

  function handleExportJson() {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für JSON-Exporte fehlt das Recht reports_export.');
      return;
    }
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
      users: state.users,
      activeUserId: state.activeUserId,
      complianceCalendar: state.complianceCalendar,
      auditChecklist: auditChecklist.map((item) => ({
        ...item,
        state: state.auditChecklistStates[item.id] ?? { status: 'not_started', notes: '' },
      })),
      auditFindings: currentFindings,
      benchmark: benchmarkSnapshot,
      documentLibrarySummary,
      deadlineSummary,
      certificationState: state.certificationState,
    });
  }

  function handleExportMarkdown() {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für Report-Exporte fehlt das Recht reports_export.');
      return;
    }
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
      documentLibrarySummary,
      deadlineSummary,
    });
  }

  function handleExportFormalHtml() {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für formale Auditberichte fehlt das Recht reports_export.');
      return;
    }
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
      documentLibrarySummary,
      deadlineSummary,
    });
  }

  function handleExportManagementPdf() {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für Management-PDFs fehlt das Recht reports_export.');
      return;
    }
    exportManagementReportAsPdf({
      companyProfile: state.companyProfile,
      module: currentModule,
      scoreSnapshot,
      benchmark: benchmarkSnapshot,
      applicability: kritisApplicability,
      requirementProgress,
      evidenceSummary,
      governanceSummary,
      certificationProgress,
      actionItems: currentActionItems,
      documentLibrarySummary,
      deadlineSummary,
    });
  }

  function handleExportAuditPdf() {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für Audit-PDFs fehlt das Recht reports_export.');
      return;
    }
    exportAuditPackAsPdf({
      companyProfile: state.companyProfile,
      module: currentModule,
      reviewPlan: state.reviewPlan,
      complianceCalendar: state.complianceCalendar,
      requirements,
      requirementStates: state.requirementStates,
      checklistProgress,
      findingSummary,
      findings: currentFindings,
      evidenceItems: currentEvidenceItems,
      deadlineSummary,
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
              <label className="field-label topbar-selector">
                Arbeitsprofil
                <select
                  value={activeUser?.id ?? ''}
                  onChange={(event) => selectActiveUser(event.target.value)}
                >
                  {state.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || 'Ohne Namen'} · {getAccessProfile(user.roleProfile).label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="inline-note">
                <Save size={16} />
                <span>Automatisch lokal gespeichert</span>
              </div>
              <div className="inline-note">
                {serverMode === 'connected' || serverMode === 'syncing' ? <Cloud size={16} /> : <CloudOff size={16} />}
                <span>
                  {serverMode === 'connected'
                    ? 'Server verbunden'
                    : serverMode === 'syncing'
                      ? 'Server synchronisiert'
                      : serverMode === 'checking'
                        ? 'Server wird geprüft'
                        : 'Nur lokaler Modus'}
                </span>
              </div>
              <span className="chip outline">{activeAccessProfile.label}</span>
              <button type="button" className="button secondary" onClick={handleSyncNow} disabled={serverMode === 'offline' || serverMode === 'checking'}>
                <RefreshCw size={16} />
                Jetzt synchronisieren
              </button>
              <button type="button" className="button secondary" onClick={handleExportJson} disabled={!hasPermission('reports_export')}>
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

        {notice ? (
          <div className={`feedback-box ${notice.type}`}>
            <strong>{notice.text}</strong>
            {notice.details?.length ? (
              <ul>
                {notice.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {readOnlyHint ? (
          <div className="feedback-box error">
            <strong>{readOnlyHint}</strong>
          </div>
        ) : null}

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
              documentFolders={documentFolders}
              documentLibrarySummary={documentLibrarySummary}
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

          {state.activeView === 'control' ? (
            <ControlView
              users={state.users}
              activeUserId={state.activeUserId}
              activeAccessProfile={activeAccessProfile}
              documentLibrarySummary={documentLibrarySummary}
              deadlineSummary={deadlineSummary}
              complianceCalendar={state.complianceCalendar}
              onSelectActiveUser={selectActiveUser}
              onCreateUser={handleCreateUser}
              onGenerateUsersFromStakeholders={handleGenerateUsersFromStakeholders}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onUpdateComplianceCalendar={updateComplianceCalendar}
            />
          ) : null}

          {state.activeView === 'platform' ? (
            <PlatformView
              serverMode={serverMode}
              serverHealth={serverHealth}
              activeUser={activeUser}
              activeAccessProfile={activeAccessProfile}
              autoSyncEnabled={autoSyncEnabled}
              lastServerLoadAt={lastServerLoadAt}
              lastServerSyncAt={lastServerSyncAt}
              syncError={syncError}
              attachmentCount={attachmentCount}
              evidenceCount={state.evidenceItems.length}
              auditLog={auditLogEntries}
              snapshots={snapshots}
              hasWorkspaceAccess={hasPermission('workspace_edit')}
              onToggleAutoSync={setAutoSyncEnabled}
              onRefreshServer={handleRefreshServer}
              onSyncNow={handleSyncNow}
              onCreateSnapshot={handleCreateSnapshotOnServer}
              onRestoreSnapshot={handleRestoreSnapshot}
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
              documentLibrarySummary={documentLibrarySummary}
              deadlineSummary={deadlineSummary}
              certificationProgress={certificationProgress}
              checklistProgress={checklistProgress}
              findingSummary={findingSummary}
              stakeholders={currentStakeholders}
              sites={currentSites}
              onExportMarkdown={handleExportMarkdown}
              onExportManagementPdf={handleExportManagementPdf}
              onExportAuditPdf={handleExportAuditPdf}
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
