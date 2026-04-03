import type {
  AppState,
  AuditLogEntry,
  ServerAttachmentRef,
  ServerHealth,
  ServerSyncResult,
  SnapshotInfo,
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

function withUserHeaders(userId: string): HeadersInit {
  return userId ? { 'x-user-id': userId } : {};
}

export interface ServerBootstrapResponse {
  ok: boolean;
  state: Partial<AppState> | null;
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

export async function fetchServerHealth(): Promise<ServerHealth> {
  const response = await fetch(`${API_BASE}/health`);
  return parseJsonResponse<ServerHealth>(response);
}

export async function fetchServerState(): Promise<ServerBootstrapResponse> {
  const response = await fetch(`${API_BASE}/state`);
  return parseJsonResponse<ServerBootstrapResponse>(response);
}

export async function syncStateToServer(state: AppState, userId: string): Promise<ServerSyncResponse> {
  const response = await fetch(`${API_BASE}/state`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...withUserHeaders(userId),
    },
    body: JSON.stringify({ state }),
  });

  return parseJsonResponse<ServerSyncResponse>(response);
}

export async function fetchAuditLog(): Promise<{ ok: boolean; entries: AuditLogEntry[] }> {
  const response = await fetch(`${API_BASE}/audit-log`);
  return parseJsonResponse<{ ok: boolean; entries: AuditLogEntry[] }>(response);
}

export async function fetchSnapshots(): Promise<{ ok: boolean; snapshots: SnapshotInfo[] }> {
  const response = await fetch(`${API_BASE}/snapshots`);
  return parseJsonResponse<{ ok: boolean; snapshots: SnapshotInfo[] }>(response);
}

export async function createSnapshot(
  userId: string,
  name: string,
  comment: string,
): Promise<SnapshotCreateResponse> {
  const response = await fetch(`${API_BASE}/snapshots`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...withUserHeaders(userId),
    },
    body: JSON.stringify({ name, comment }),
  });

  return parseJsonResponse<SnapshotCreateResponse>(response);
}

export async function restoreSnapshot(
  userId: string,
  snapshotId: string,
): Promise<SnapshotRestoreResponse> {
  const response = await fetch(`${API_BASE}/snapshots/${snapshotId}/restore`, {
    method: 'POST',
    headers: withUserHeaders(userId),
  });

  return parseJsonResponse<SnapshotRestoreResponse>(response);
}

export async function uploadEvidenceAttachment(
  userId: string,
  evidenceId: string,
  file: File,
): Promise<ServerAttachmentResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/evidence/${encodeURIComponent(evidenceId)}/attachment`, {
    method: 'POST',
    headers: withUserHeaders(userId),
    body: formData,
  });

  return parseJsonResponse<ServerAttachmentResponse>(response);
}

export async function removeEvidenceAttachment(
  userId: string,
  evidenceId: string,
): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE}/evidence/${encodeURIComponent(evidenceId)}/attachment`, {
    method: 'DELETE',
    headers: withUserHeaders(userId),
  });

  return parseJsonResponse<{ ok: boolean }>(response);
}
