import { useState } from 'react';
import {
  Clock3,
  Cloud,
  Database,
  HardDriveUpload,
  History,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import type {
  AccessProfileDefinition,
  AuditLogEntry,
  ServerHealth,
  SnapshotInfo,
  UserItem,
} from '../types';

interface PlatformViewProps {
  serverMode: 'checking' | 'connected' | 'syncing' | 'offline' | 'error';
  serverHealth: ServerHealth | null;
  activeUser: UserItem | null;
  activeAccessProfile: AccessProfileDefinition;
  autoSyncEnabled: boolean;
  lastServerLoadAt: string;
  lastServerSyncAt: string;
  syncError: string;
  attachmentCount: number;
  evidenceCount: number;
  auditLog: AuditLogEntry[];
  snapshots: SnapshotInfo[];
  hasWorkspaceAccess: boolean;
  onToggleAutoSync: (value: boolean) => void;
  onRefreshServer: () => void;
  onSyncNow: () => void;
  onCreateSnapshot: (name: string, comment: string) => void;
  onRestoreSnapshot: (snapshotId: string) => void;
}

function formatDateTime(value: string): string {
  if (!value) {
    return '–';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('de-DE');
}

function describeMode(mode: PlatformViewProps['serverMode']): string {
  if (mode === 'connected') {
    return 'Server verbunden';
  }
  if (mode === 'syncing') {
    return 'Synchronisierung läuft';
  }
  if (mode === 'offline') {
    return 'Kein Server erreichbar';
  }
  if (mode === 'error') {
    return 'Serverfehler';
  }
  return 'Verbindung wird geprüft';
}

export function PlatformView({
  serverMode,
  serverHealth,
  activeUser,
  activeAccessProfile,
  autoSyncEnabled,
  lastServerLoadAt,
  lastServerSyncAt,
  syncError,
  attachmentCount,
  evidenceCount,
  auditLog,
  snapshots,
  hasWorkspaceAccess,
  onToggleAutoSync,
  onRefreshServer,
  onSyncNow,
  onCreateSnapshot,
  onRestoreSnapshot,
}: PlatformViewProps) {
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotComment, setSnapshotComment] = useState('');

  const serverTone = serverMode === 'connected'
    ? 'good'
    : serverMode === 'syncing'
      ? 'warn'
      : serverMode === 'error'
        ? 'alert'
        : 'default';

  return (
    <div className="view-stack">
      <section className="hero card">
        <div>
          <p className="eyebrow">Plattform & Sync</p>
          <h2>Backend, Dateispeicher und serverseitige Nachvollziehbarkeit</h2>
          <p className="hero-text">
            Dieser Bereich verbindet den Frontend-Prototyp mit einem leichtgewichtigen API-Backend,
            serverseitigem Dokumentenspeicher, Snapshots und Audit-Log.
          </p>
          <div className="chip-row top-gap">
            <span className="chip outline">{describeMode(serverMode)}</span>
            <span className="chip outline">Arbeitsprofil: {activeAccessProfile.label}</span>
            <span className="chip outline">Aktiver Nutzer: {activeUser?.name || 'Nicht gesetzt'}</span>
          </div>
        </div>
        <div className="hero-actions">
          <button type="button" className="button secondary" onClick={onRefreshServer}>
            <RefreshCw size={16} />
            Server neu laden
          </button>
          <button type="button" className="button primary" onClick={onSyncNow} disabled={serverMode === 'offline' || serverMode === 'checking'}>
            <Save size={16} />
            Jetzt synchronisieren
          </button>
        </div>
      </section>

      <section className="stats-grid phase-three">
        <StatCard
          title="Backend"
          value={serverHealth?.mode === 'filesystem' ? 'Dateisystem' : '–'}
          subtitle={describeMode(serverMode)}
          tone={serverTone}
        />
        <StatCard
          title="Letzter Server-Load"
          value={lastServerLoadAt ? formatDateTime(lastServerLoadAt) : '–'}
          subtitle="Initiale Datenübernahme"
          tone={lastServerLoadAt ? 'default' : 'warn'}
        />
        <StatCard
          title="Letzter Sync"
          value={lastServerSyncAt ? formatDateTime(lastServerSyncAt) : '–'}
          subtitle={autoSyncEnabled ? 'Autosync aktiv' : 'Autosync aus'}
          tone={lastServerSyncAt ? 'good' : 'default'}
        />
        <StatCard
          title="Server-Dateien"
          value={`${attachmentCount}`}
          subtitle={`${evidenceCount} Evidenzen im Register`}
          tone={attachmentCount ? 'good' : 'default'}
        />
        <StatCard
          title="Snapshots"
          value={`${snapshots.length}`}
          subtitle="Wiederherstellbare Stände"
          tone={snapshots.length ? 'good' : 'default'}
        />
        <StatCard
          title="Audit-Log"
          value={`${auditLog.length}`}
          subtitle="Serverseitige Änderungsnachweise"
          tone={auditLog.length ? 'good' : 'default'}
        />
        <StatCard
          title="Uploads gesamt"
          value={`${serverHealth?.uploadCount ?? 0}`}
          subtitle="Dateien im Server-Speicher"
          tone={serverHealth?.uploadCount ? 'good' : 'default'}
        />
        <StatCard
          title="Rechteprofil"
          value={`${activeAccessProfile.permissions.length}`}
          subtitle="Server prüft Schreibrechte zusätzlich"
          tone={activeAccessProfile.permissions.length ? 'default' : 'warn'}
        />
      </section>

      <section className="content-grid two-column">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Synchronisierung</p>
              <h3>Betriebsmodus und Schreibverhalten</h3>
            </div>
            <div className="inline-note">
              <Cloud size={16} />
              <span>{describeMode(serverMode)}</span>
            </div>
          </div>

          <div className="mini-list top-gap">
            <div className="mini-list-row"><span>Serverzeit</span><strong>{formatDateTime(serverHealth?.serverTime ?? '')}</strong></div>
            <div className="mini-list-row"><span>Letzter Stand auf Server</span><strong>{formatDateTime(serverHealth?.savedAt ?? '')}</strong></div>
            <div className="mini-list-row"><span>Funktionen</span><strong>{serverHealth?.features?.join(', ') || '–'}</strong></div>
            <div className="mini-list-row"><span>Autosync</span><strong>{autoSyncEnabled ? 'Ein' : 'Aus'}</strong></div>
          </div>

          <label className="checkbox-row top-gap">
            <input
              type="checkbox"
              checked={autoSyncEnabled}
              onChange={(event) => onToggleAutoSync(event.target.checked)}
              disabled={serverMode === 'offline' || serverMode === 'checking'}
            />
            <span>
              Änderungen automatisch an den Server übertragen. Ohne Verbindung bleibt die lokale
              Browser-Speicherung als Fallback aktiv.
            </span>
          </label>

          {syncError ? (
            <div className="feedback-box error top-gap">
              <strong>Letzter Sync-Fehler</strong>
              <p className="top-gap">{syncError}</p>
            </div>
          ) : (
            <div className="feedback-box success top-gap">
              <strong>Serverlogik aktiv</strong>
              <p className="top-gap">
                Schreibvorgänge werden prototypisch doppelt abgesichert: im Frontend über
                Profilrechte und im Backend über serverseitige Abschnittsprüfungen.
              </p>
            </div>
          )}
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Snapshot-Management</p>
              <h3>Wiederherstellbare Arbeitsstände</h3>
            </div>
            <div className="inline-note">
              <History size={16} />
              <span>Geeignet für Auditpunkte, Reviewstände und Freigaben.</span>
            </div>
          </div>

          <div className="form-grid two-column top-gap">
            <label className="field-label wide">
              Snapshot-Name
              <input
                type="text"
                placeholder="z. B. Vor-Audit April 2026"
                value={snapshotName}
                onChange={(event) => setSnapshotName(event.target.value)}
                disabled={!hasWorkspaceAccess || serverMode === 'offline' || serverMode === 'checking'}
              />
            </label>
            <label className="field-label wide">
              Kommentar
              <textarea
                rows={3}
                placeholder="z. B. Management-Review freigegeben, Nachweisstand eingefroren"
                value={snapshotComment}
                onChange={(event) => setSnapshotComment(event.target.value)}
                disabled={!hasWorkspaceAccess || serverMode === 'offline' || serverMode === 'checking'}
              />
            </label>
          </div>

          <div className="inline-actions top-gap">
            <button
              type="button"
              className="button primary"
              disabled={!hasWorkspaceAccess || !snapshotName.trim() || serverMode === 'offline' || serverMode === 'checking'}
              onClick={() => {
                onCreateSnapshot(snapshotName.trim(), snapshotComment.trim());
                setSnapshotName('');
                setSnapshotComment('');
              }}
            >
              <HardDriveUpload size={16} />
              Snapshot erzeugen
            </button>
            {!hasWorkspaceAccess ? (
              <div className="inline-note warning-note">
                <ShieldCheck size={16} />
                <span>Für Snapshots ist das Recht „Steuerung & Rechte“ erforderlich.</span>
              </div>
            ) : null}
          </div>

          <div className="work-list top-gap">
            {snapshots.length ? snapshots.map((snapshot) => (
              <article key={snapshot.id} className="work-card">
                <div className="work-card-head">
                  <div>
                    <strong>{snapshot.name}</strong>
                    <p className="muted small">
                      {formatDateTime(snapshot.createdAt)} · {snapshot.userName || snapshot.createdBy}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="button tertiary"
                    onClick={() => onRestoreSnapshot(snapshot.id)}
                    disabled={!hasWorkspaceAccess || serverMode === 'offline' || serverMode === 'checking'}
                  >
                    <RotateCcw size={16} />
                    Wiederherstellen
                  </button>
                </div>
                <p>{snapshot.comment || 'Ohne Kommentar.'}</p>
              </article>
            )) : (
              <div className="empty-state panel-empty">
                <History size={20} />
                <div>
                  <strong>Noch keine Snapshots gespeichert</strong>
                  <p>Erzeugen Sie einen festen Arbeitsstand für Audits, Freigaben oder Zwischenstände.</p>
                </div>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="content-grid two-column">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Audit-Log</p>
              <h3>Serverseitige Änderungsnachweise</h3>
            </div>
            <div className="inline-note">
              <Database size={16} />
              <span>Zeigt die letzten Synchronisations- und Speicherereignisse.</span>
            </div>
          </div>

          <div className="timeline-list top-gap">
            {auditLog.length ? auditLog.slice(0, 12).map((entry) => (
              <article key={entry.id} className="timeline-item">
                <div className="stage-icon">
                  <Clock3 size={16} />
                </div>
                <div>
                  <strong>{entry.action}</strong>
                  <p className="muted small">
                    {formatDateTime(entry.at)} · {entry.userName || entry.userId} · {entry.resource}
                  </p>
                  <p>{entry.summary}</p>
                  {entry.sections.length ? (
                    <div className="chip-row top-gap">
                      {entry.sections.map((section) => (
                        <span key={section} className="chip outline">{section}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            )) : (
              <div className="empty-state panel-empty">
                <Database size={20} />
                <div>
                  <strong>Audit-Log noch leer</strong>
                  <p>Nach der ersten Serversynchronisierung werden hier Änderungsereignisse sichtbar.</p>
                </div>
              </div>
            )}
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Rechtewirkung</p>
              <h3>Was serverseitig geprüft wird</h3>
            </div>
            <div className="inline-note">
              <ShieldCheck size={16} />
              <span>Die API lehnt nicht autorisierte Schreibvorgänge ab.</span>
            </div>
          </div>

          <div className="priority-list top-gap">
            <div className="priority-item compact-item">
              <div>
                <strong>Analyse & Unternehmensprofil</strong>
                <p className="muted small">Antworten, Notizen und Profilangaben</p>
              </div>
              <span className="chip outline">assessment_edit</span>
            </div>
            <div className="priority-item compact-item">
              <div>
                <strong>Maßnahmen & Evidenzen</strong>
                <p className="muted small">Maßnahmenregister, Evidenzregister, Dateiupload</p>
              </div>
              <span className="chip outline">actions_edit / evidence_edit</span>
            </div>
            <div className="priority-item compact-item">
              <div>
                <strong>Governance & Struktur</strong>
                <p className="muted small">Stakeholder, Standorte, Assets, Reviewplan</p>
              </div>
              <span className="chip outline">governance_edit</span>
            </div>
            <div className="priority-item compact-item">
              <div>
                <strong>Steuerung & Plattform</strong>
                <p className="muted small">Nutzer, Compliance-Kalender, Snapshots, Wiederherstellung</p>
              </div>
              <span className="chip outline">workspace_edit</span>
            </div>
            <div className="priority-item compact-item">
              <div>
                <strong>KRITIS-Workflow</strong>
                <p className="muted small">Bausteinstatus, Checklisten, Feststellungen, Zertifizierungsstufen</p>
              </div>
              <span className="chip outline">kritis_edit</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
