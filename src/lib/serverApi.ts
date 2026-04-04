import type {
  AccessAccountSummary,
  AppState,
  AuditLogEntry,
  AuthSession,
  DocumentLedgerSummaryServer,
  DocumentVersionEntry,
  ServerAttachmentRef,
  ServerHealth,
  ServerSyncResult,
  SnapshotInfo,
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
    const error = new Error(message) as Error & { details?: string[]; status?: number };
    error.details = Array.isArray(payload?.details) ? payload.details : undefined;
    error.status = response.status;
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
  defaultPasswordHint?: string;
  tenants: TenantSummary[];
}

export interface ServerBootstrapResponse {
  ok: boolean;
  state: Partial<AppState> | null;
  tenant?: TenantSummary;
  session?: AuthSession;
}

export interface ServerSyncResponse extends ServerSyncResult {
  state: Partial<AppState>;
}

export interface ServerAttachmentResponse {
  ok: boolean;
  attachment: ServerAttachmentRef;
  evidenceId: string;
}

export interface SnapshotCreateResponse {
  ok: boolean;
  snapshot: SnapshotInfo;
}

export interface SnapshotRestoreResponse {
  ok: boolean;
  snapshot: SnapshotInfo;
  state: Partial<AppState>;
}

export interface AuthLoginResponse {
  ok: boolean;
  session: AuthSession;
  state: Partial<AppState>;
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

export interface EvidenceVersionsResponse {
  ok: boolean;
  versions: DocumentVersionEntry[];
}

export interface EvidenceRestoreVersionResponse {
  ok: boolean;
  evidenceId: string;
  evidence: AppState['evidenceItems'][number];
  versions: DocumentVersionEntry[];
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
  return parseJsonResponse<{ ok: boolean }>(response);
}

export async function fetchServerState(token: string): Promise<ServerBootstrapResponse> {
  const response = await fetch(`${API_BASE}/state`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<ServerBootstrapResponse>(response);
}

export async function syncStateToServer(state: AppState, token: string): Promise<ServerSyncResponse> {
  const response = await fetch(`${API_BASE}/state`, {
    method: 'PUT',
    headers: withAuthHeaders(token, true),
    body: JSON.stringify({ state }),
  });

  return parseJsonResponse<ServerSyncResponse>(response);
}

export async function fetchAuditLog(token: string): Promise<{ ok: boolean; entries: AuditLogEntry[] }> {
  const response = await fetch(`${API_BASE}/audit-log`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<{ ok: boolean; entries: AuditLogEntry[] }>(response);
}

export async function fetchSnapshots(token: string): Promise<{ ok: boolean; snapshots: SnapshotInfo[] }> {
  const response = await fetch(`${API_BASE}/snapshots`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<{ ok: boolean; snapshots: SnapshotInfo[] }>(response);
}

export async function createSnapshot(
  token: string,
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
  token: string,
  snapshotId: string,
): Promise<SnapshotRestoreResponse> {
  const response = await fetch(`${API_BASE}/snapshots/${snapshotId}/restore`, {
    method: 'POST',
    headers: withAuthHeaders(token),
  });

  return parseJsonResponse<SnapshotRestoreResponse>(response);
}

export async function uploadEvidenceAttachment(
  token: string,
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
  token: string,
  evidenceId: string,
): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE}/evidence/${encodeURIComponent(evidenceId)}/attachment`, {
    method: 'DELETE',
    headers: withAuthHeaders(token),
  });

  return parseJsonResponse<{ ok: boolean }>(response);
}

export async function fetchDocumentLedgerSummary(token: string): Promise<DocumentLedgerResponse> {
  const response = await fetch(`${API_BASE}/document-ledger/summary`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<DocumentLedgerResponse>(response);
}

export async function fetchEvidenceVersions(token: string, evidenceId: string): Promise<EvidenceVersionsResponse> {
  const response = await fetch(`${API_BASE}/evidence/${encodeURIComponent(evidenceId)}/versions`, {
    headers: withAuthHeaders(token),
  });
  return parseJsonResponse<EvidenceVersionsResponse>(response);
}

export async function restoreEvidenceVersion(
  token: string,
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
  return parseJsonResponse<{ ok: boolean }>(response);
}
