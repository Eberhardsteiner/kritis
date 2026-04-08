import type {
  AccessAccountSummary,
  ApiClientScope,
  AuthMode,
  AuthProviderSummary,
  ApiClientSummary,
  AppState,
  AuditLogEntry,
  AuthSession,
  DocumentLedgerSummaryServer,
  EvidenceRetentionSummary,
  DocumentVersionEntry,
  ExportPackageEntry,
  ExportPackageType,
  HostingReadinessSummary,
  IntegritySummary,
  JobRunSummary,
  JobRunType,
  ModulePackRegistryEntry,
  ObservabilitySummary,
  RestoreDrillSummary,
  SecurityGateSummary,
  ServerAttachmentRef,
  ServerHealth,
  ServerSyncResult,
  SnapshotInfo,
  SystemSettings,
  TenantPolicy,
  TenantSummary,
  UserItem,
  UserRoleProfile,
  UserStatus,
} from '../types';

const API_BASE = '/api';

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = typeof payload?.message === 'string'
      ? payload.message
      : `API-Fehler ${response.status}`;
    const error = new Error(message) as Error & { details?: string[]; status?: number; currentVersion?: number; currentUpdatedAt?: string };
    error.details = Array.isArray(payload?.details) ? payload.details : undefined;
    error.status = response.status;
    error.currentVersion = typeof payload?.currentVersion === 'number' ? payload.currentVersion : undefined;
    error.currentUpdatedAt = typeof payload?.currentUpdatedAt === 'string' ? payload.currentUpdatedAt : undefined;
    throw error;
  }

  return payload as T;
}

function withAuthHeaders(token: string, includeJson = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (includeJson) {
    headers['content-type'] = 'application/json';
  }
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

export interface AuthBootstrapResponse {
  ok: boolean;
  authenticationRequired: boolean;
  authenticationOptional?: boolean;
  appMode?: 'demo' | 'production';
  authMode?: AuthMode;
  anonymousAccessEnabled?: boolean;
  anonymousAccessMode?: 'read_only' | 'disabled';
  localLoginEnabled?: boolean;
  authProviders?: AuthProviderSummary[];
  publicTenant?: TenantSummary | null;
  tenants: TenantSummary[];
}

export interface ServerBootstrapResponse {
  ok: boolean;
  state: Partial<AppState> | null;
  stateVersion?: number;
  stateUpdatedAt?: string;
  tenant?: TenantSummary;
  session?: AuthSession | null;
  workspaceUserSeed?: UserItem;
  accessMode?: 'anonymous' | 'authenticated';
}

export interface ServerSyncResponse extends ServerSyncResult {
  state: Partial<AppState>;
}

export interface ServerAttachmentResponse {
  ok: boolean;
  attachment: ServerAttachmentRef;
  evidenceId: string;
  stateVersion?: number;
  stateUpdatedAt?: string;
}

export interface SnapshotCreateResponse {
  ok: boolean;
  snapshot: SnapshotInfo;
}

export interface SnapshotRestoreResponse {
  ok: boolean;
  snapshot: SnapshotInfo;
  state: Partial<AppState>;
  stateVersion?: number;
  stateUpdatedAt?: string;
}

export interface AuthLoginResponse {
  ok: boolean;
  session: AuthSession;
  state: Partial<AppState>;
  stateVersion?: number;
  stateUpdatedAt?: string;
  workspaceUserSeed: UserItem;
  accessibleTenants: Array<{
    tenantId: string;
    tenantName: string;
    roleProfile: UserRoleProfile;
  }>;
}

export interface AuthSessionResponse {
  ok: boolean;
  session: AuthSession;
  workspaceUserSeed: UserItem;
}

export interface OidcStartResponse {
  ok: boolean;
  providerId: string;
  redirectUrl: string;
  state: string;
  expiresAt: string;
}

export interface ModuleRegistryResponse {
  ok: boolean;
  entries: ModulePackRegistryEntry[];
}

export interface AccessAccountsResponse {
  ok: boolean;
  accounts: AccessAccountSummary[];
}

export interface TenantListResponse {
  ok: boolean;
  tenants: TenantSummary[];
}

export interface AccountUpsertPayload {
  tenantId?: string;
  name: string;
  email: string;
  password?: string;
  roleProfile: UserRoleProfile;
  authSource?: 'local' | 'oidc' | 'hybrid';
  status?: UserStatus;
  scope?: string;
  workspaceUserId?: string;
}

export interface AccountUpsertResponse {
  ok: boolean;
  account: AccessAccountSummary;
}

export interface TenantCreatePayload {
  name: string;
  slug?: string;
  industryLabel?: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface TenantCreateResponse {
  ok: boolean;
  tenant: TenantSummary;
}

export interface DocumentLedgerResponse {
  ok: boolean;
  summary: DocumentLedgerSummaryServer;
}

export interface EvidenceRetentionSummaryResponse {
  ok: boolean;
  summary: EvidenceRetentionSummary;
}

export interface EvidenceVersionsResponse {
  ok: boolean;
  versions: DocumentVersionEntry[];
}

export interface EvidenceRestoreVersionResponse {
  ok: boolean;
  evidenceId: string;
  evidence: AppState['evidenceItems'][number];
  versions: DocumentVersionEntry[];
  stateVersion?: number;
  stateUpdatedAt?: string;
}

export async function fetchModuleRegistry(token = ''): Promise<ModuleRegistryResponse> {
  const response = await fetch(`${API_BASE}/modules/registry`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<ModuleRegistryResponse>(response);
}

export async function importModulePack(
  token: string,
  fileName: string,
  jsonText: string,
  changeNote = '',
): Promise<ModuleRegistryResponse> {
  const response = await fetch(`${API_BASE}/modules/registry/import`, {
    method: 'POST',
    headers: withAuthHeaders(token, true),
    body: JSON.stringify({ fileName, jsonText, changeNote }),
  });
  return parseJsonResponse<ModuleRegistryResponse>(response);
}

export async function activateModulePack(
  token: string,
  entryId: string,
  releaseNote = '',
): Promise<ModuleRegistryResponse> {
  const response = await fetch(`${API_BASE}/modules/registry/${encodeURIComponent(entryId)}/activate`, {
    method: 'POST',
    headers: withAuthHeaders(token, true),
    body: JSON.stringify({ releaseNote }),
  });
  return parseJsonResponse<ModuleRegistryResponse>(response);
}

export async function retireModulePack(
  token: string,
  entryId: string,
  note = '',
): Promise<ModuleRegistryResponse> {
  const response = await fetch(`${API_BASE}/modules/registry/${encodeURIComponent(entryId)}/retire`, {
    method: 'POST',
    headers: withAuthHeaders(token, true),
    body: JSON.stringify({ note }),
  });
  return parseJsonResponse<ModuleRegistryResponse>(response);
}

export async function fetchServerHealth(): Promise<ServerHealth> {
  const response = await fetch(`${API_BASE}/health`);
  return parseJsonResponse<ServerHealth>(response);
}

export async function fetchAuthBootstrap(): Promise<AuthBootstrapResponse> {
  const response = await fetch(`${API_BASE}/auth/bootstrap`);
  return parseJsonResponse<AuthBootstrapResponse>(response);
}

export async function loginToServer(
  email: string,
  password: string,
  tenantId: string,
): Promise<AuthLoginResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: withAuthHeaders('', true),
    body: JSON.stringify({ email, password, tenantId }),
  });

  return parseJsonResponse<AuthLoginResponse>(response);
}

export async function startOidcLogin(tenantId = ''): Promise<OidcStartResponse> {
  const suffix = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const response = await fetch(`${API_BASE}/auth/oidc/start${suffix}`);
  return parseJsonResponse<OidcStartResponse>(response);
}

export async function completeOidcLogin(ticket: string): Promise<AuthLoginResponse> {
  const response = await fetch(`${API_BASE}/auth/oidc/complete`, {
    method: 'POST',
    headers: withAuthHeaders('', true),
    body: JSON.stringify({ ticket }),
  });
  return parseJsonResponse<AuthLoginResponse>(response);
}

export async function fetchCurrentSession(token: string): Promise<AuthSessionResponse> {
  const response = await fetch(`${API_BASE}/auth/session`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<AuthSessionResponse>(response);
}

export async function logoutFromServer(token: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<{ ok: boolean; stateVersion?: number; stateUpdatedAt?: string }>(response);
}

export async function fetchServerState(token = ''): Promise<ServerBootstrapResponse> {
  const response = await fetch(`${API_BASE}/state`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<ServerBootstrapResponse>(response);
}

export async function syncStateToServer(state: AppState, token = '', expectedVersion?: number): Promise<ServerSyncResponse> {
  const response = await fetch(`${API_BASE}/state`, {
    method: 'PUT',
    headers: withAuthHeaders(token, true),
    body: JSON.stringify({ state, expectedVersion }),
  });

  return parseJsonResponse<ServerSyncResponse>(response);
}

export async function fetchAuditLog(token = ''): Promise<{ ok: boolean; entries: AuditLogEntry[] }> {
  const response = await fetch(`${API_BASE}/audit-log`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<{ ok: boolean; entries: AuditLogEntry[] }>(response);
}

export async function fetchSnapshots(token = ''): Promise<{ ok: boolean; snapshots: SnapshotInfo[] }> {
  const response = await fetch(`${API_BASE}/snapshots`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<{ ok: boolean; snapshots: SnapshotInfo[] }>(response);
}

export async function createSnapshot(
  token = '',
  name: string,
  comment: string,
): Promise<SnapshotCreateResponse> {
  const response = await fetch(`${API_BASE}/snapshots`, {
    method: 'POST',
    headers: withAuthHeaders(token, true),
    body: JSON.stringify({ name, comment }),
  });

  return parseJsonResponse<SnapshotCreateResponse>(response);
}

export async function restoreSnapshot(
  token = '',
  snapshotId: string,
): Promise<SnapshotRestoreResponse> {
  const response = await fetch(`${API_BASE}/snapshots/${snapshotId}/restore`, {
    method: 'POST',
    headers: withAuthHeaders(token),
  });

  return parseJsonResponse<SnapshotRestoreResponse>(response);
}

export async function uploadEvidenceAttachment(
  token = '',
  evidenceId: string,
  file: File,
): Promise<ServerAttachmentResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/evidence/${encodeURIComponent(evidenceId)}/attachment`, {
    method: 'POST',
    headers: withAuthHeaders(token),
    body: formData,
  });

  return parseJsonResponse<ServerAttachmentResponse>(response);
}

export async function removeEvidenceAttachment(
  token = '',
  evidenceId: string,
): Promise<{ ok: boolean; stateVersion?: number; stateUpdatedAt?: string }> {
  const response = await fetch(`${API_BASE}/evidence/${encodeURIComponent(evidenceId)}/attachment`, {
    method: 'DELETE',
    headers: withAuthHeaders(token),
  });

  return parseJsonResponse<{ ok: boolean; stateVersion?: number; stateUpdatedAt?: string }>(response);
}

export async function fetchDocumentLedgerSummary(token = ''): Promise<DocumentLedgerResponse> {
  const response = await fetch(`${API_BASE}/document-ledger/summary`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<DocumentLedgerResponse>(response);
}

export async function fetchEvidenceRetentionSummary(token = ''): Promise<EvidenceRetentionSummaryResponse> {
  const response = await fetch(`${API_BASE}/evidence-retention/summary`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<EvidenceRetentionSummaryResponse>(response);
}

export async function fetchEvidenceVersions(token = '', evidenceId: string): Promise<EvidenceVersionsResponse> {
  const response = await fetch(`${API_BASE}/evidence/${encodeURIComponent(evidenceId)}/versions`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<EvidenceVersionsResponse>(response);
}

export async function restoreEvidenceVersion(
  token = '',
  evidenceId: string,
  versionId: string,
): Promise<EvidenceRestoreVersionResponse> {
  const response = await fetch(
    `${API_BASE}/evidence/${encodeURIComponent(evidenceId)}/versions/${encodeURIComponent(versionId)}/restore`,
    {
      method: 'POST',
      headers: withAuthHeaders(token),
    },
  );
  return parseJsonResponse<EvidenceRestoreVersionResponse>(response);
}

export async function fetchTenantList(token: string): Promise<TenantListResponse> {
  const response = await fetch(`${API_BASE}/admin/tenants`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<TenantListResponse>(response);
}

export async function createTenant(token: string, payload: TenantCreatePayload): Promise<TenantCreateResponse> {
  const response = await fetch(`${API_BASE}/admin/tenants`, {
    method: 'POST',
    headers: withAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<TenantCreateResponse>(response);
}

export async function fetchAccessAccounts(token: string): Promise<AccessAccountsResponse> {
  const response = await fetch(`${API_BASE}/admin/accounts`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<AccessAccountsResponse>(response);
}

export async function upsertAccessAccount(
  token: string,
  payload: AccountUpsertPayload,
): Promise<AccountUpsertResponse> {
  const response = await fetch(`${API_BASE}/admin/accounts`, {
    method: 'POST',
    headers: withAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<AccountUpsertResponse>(response);
}

export async function resetAccessAccountPassword(
  token: string,
  accountId: string,
  password: string,
): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE}/admin/accounts/${encodeURIComponent(accountId)}/reset-password`, {
    method: 'POST',
    headers: withAuthHeaders(token, true),
    body: JSON.stringify({ password }),
  });
  return parseJsonResponse<{ ok: boolean; stateVersion?: number; stateUpdatedAt?: string }>(response);
}

export interface TenantPolicyResponse {
  ok: boolean;
  settings: TenantPolicy;
}

export interface ExportPackageListResponse {
  ok: boolean;
  packages: ExportPackageEntry[];
}

export interface ExportPackageCreatePayload {
  type: ExportPackageType;
  title: string;
  note?: string;
  signOffName?: string;
  signOffRole?: string;
  moduleId?: string;
  moduleName?: string;
  companyName?: string;
  sections?: string[];
  relatedSnapshotId?: string;
  payload: unknown;
}

export interface ExportPackageCreateResponse {
  ok: boolean;
  entry: ExportPackageEntry;
}

export interface ExportPackageReleaseResponse {
  ok: boolean;
  entry: ExportPackageEntry;
}

export async function fetchTenantSettings(token = ''): Promise<TenantPolicyResponse> {
  const response = await fetch(`${API_BASE}/tenant-settings`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<TenantPolicyResponse>(response);
}

export async function updateTenantSettings(
  token = '',
  settings: Partial<TenantPolicy>,
): Promise<TenantPolicyResponse> {
  const response = await fetch(`${API_BASE}/tenant-settings`, {
    method: 'PUT',
    headers: withAuthHeaders(token, true),
    body: JSON.stringify({ settings }),
  });
  return parseJsonResponse<TenantPolicyResponse>(response);
}

export async function fetchExportPackages(token = ''): Promise<ExportPackageListResponse> {
  const response = await fetch(`${API_BASE}/exports`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<ExportPackageListResponse>(response);
}

export async function createExportPackage(
  token = '',
  payload: ExportPackageCreatePayload,
): Promise<ExportPackageCreateResponse> {
  const response = await fetch(`${API_BASE}/exports/packages`, {
    method: 'POST',
    headers: withAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<ExportPackageCreateResponse>(response);
}

export async function releaseExportPackage(
  token = '',
  exportId: string,
  releaseNote: string,
): Promise<ExportPackageReleaseResponse> {
  const response = await fetch(`${API_BASE}/exports/${encodeURIComponent(exportId)}/release`, {
    method: 'POST',
    headers: withAuthHeaders(token, true),
    body: JSON.stringify({ releaseNote }),
  });
  return parseJsonResponse<ExportPackageReleaseResponse>(response);
}


export interface SystemSettingsResponse {
  ok: boolean;
  settings: SystemSettings;
}

export interface HostingReadinessResponse {
  ok: boolean;
  summary: HostingReadinessSummary;
}

export interface IntegritySummaryResponse {
  ok: boolean;
  summary: IntegritySummary;
}

export interface SecurityGateSummaryResponse {
  ok: boolean;
  summary: SecurityGateSummary;
}

export interface ObservabilitySummaryResponse {
  ok: boolean;
  summary: ObservabilitySummary;
}

export interface RestoreDrillListResponse {
  ok: boolean;
  drills: RestoreDrillSummary[];
}

export interface ApiClientListResponse {
  ok: boolean;
  clients: ApiClientSummary[];
}

export interface ApiClientCreatePayload {
  label: string;
  tenantId?: string;
  integrationType: 'reporting' | 'backup' | 'siem' | 'bi' | 'custom';
  scopes: ApiClientScope[];
  expiresAt?: string;
  note?: string;
}

export interface ApiClientCreateResponse {
  ok: boolean;
  client: ApiClientSummary;
  secret: string;
}

export interface ApiClientRevokeResponse {
  ok: boolean;
  client: ApiClientSummary;
}

export interface JobRunListResponse {
  ok: boolean;
  jobs: JobRunSummary[];
}

export interface JobRunCreatePayload {
  type: JobRunType;
  tenantId?: string;
}

export interface JobRunCreateResponse {
  ok: boolean;
  job: JobRunSummary;
}

export async function fetchSystemSettings(token = ''): Promise<SystemSettingsResponse> {
  const response = await fetch(`${API_BASE}/system/platform`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<SystemSettingsResponse>(response);
}

export async function updateSystemSettings(
  token: string,
  settings: Partial<SystemSettings>,
): Promise<SystemSettingsResponse> {
  const response = await fetch(`${API_BASE}/system/platform`, {
    method: 'PUT',
    headers: withAuthHeaders(token, true),
    body: JSON.stringify({ settings }),
  });
  return parseJsonResponse<SystemSettingsResponse>(response);
}

export async function fetchHostingReadiness(token = ''): Promise<HostingReadinessResponse> {
  const response = await fetch(`${API_BASE}/system/readiness`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<HostingReadinessResponse>(response);
}

export async function fetchIntegritySummary(token = ''): Promise<IntegritySummaryResponse> {
  const response = await fetch(`${API_BASE}/system/integrity`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<IntegritySummaryResponse>(response);
}

export async function fetchSecurityGateSummary(token = ''): Promise<SecurityGateSummaryResponse> {
  const response = await fetch(`${API_BASE}/system/security-gates`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<SecurityGateSummaryResponse>(response);
}

export async function fetchObservabilitySummary(token = ''): Promise<ObservabilitySummaryResponse> {
  const response = await fetch(`${API_BASE}/system/observability`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<ObservabilitySummaryResponse>(response);
}

export async function fetchRestoreDrills(token = ''): Promise<RestoreDrillListResponse> {
  const response = await fetch(`${API_BASE}/system/restore-drills`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<RestoreDrillListResponse>(response);
}

export async function fetchApiClients(token: string): Promise<ApiClientListResponse> {
  const response = await fetch(`${API_BASE}/system/api-clients`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<ApiClientListResponse>(response);
}

export async function createApiClient(
  token: string,
  payload: ApiClientCreatePayload,
): Promise<ApiClientCreateResponse> {
  const response = await fetch(`${API_BASE}/system/api-clients`, {
    method: 'POST',
    headers: withAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<ApiClientCreateResponse>(response);
}

export async function rotateApiClient(token: string, clientId: string): Promise<ApiClientCreateResponse> {
  const response = await fetch(`${API_BASE}/system/api-clients/${encodeURIComponent(clientId)}/rotate`, {
    method: 'POST',
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<ApiClientCreateResponse>(response);
}

export async function revokeApiClient(token: string, clientId: string): Promise<ApiClientRevokeResponse> {
  const response = await fetch(`${API_BASE}/system/api-clients/${encodeURIComponent(clientId)}/revoke`, {
    method: 'POST',
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<ApiClientRevokeResponse>(response);
}

export async function downloadProtectedResource(
  url: string,
  token = '',
  suggestedFileName?: string,
): Promise<void> {
  const response = await fetch(url, {
    headers: withAuthHeaders(token),
  });

  if (!response.ok) {
    await parseJsonResponse(response);
    return;
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  const disposition = response.headers.get('content-disposition') || '';
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const simpleName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const fileName = suggestedFileName || (encodedName ? decodeURIComponent(encodedName) : simpleName) || 'download';
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

export async function fetchSystemJobs(token: string): Promise<JobRunListResponse> {
  const response = await fetch(`${API_BASE}/system/jobs`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<JobRunListResponse>(response);
}

export async function runSystemJob(
  token: string,
  payload: JobRunCreatePayload,
): Promise<JobRunCreateResponse> {
  const response = await fetch(`${API_BASE}/system/jobs/run`, {
    method: 'POST',
    headers: withAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<JobRunCreateResponse>(response);
}

export async function updateTenantAdmin(
  token: string,
  tenantId: string,
  patch: Partial<TenantSummary>,
): Promise<{ ok: boolean; tenant: TenantSummary }> {
  const response = await fetch(`${API_BASE}/admin/tenants/${encodeURIComponent(tenantId)}`, {
    method: 'PUT',
    headers: withAuthHeaders(token, true),
    body: JSON.stringify({ patch }),
  });
  return parseJsonResponse<{ ok: boolean; tenant: TenantSummary }>(response);
}
