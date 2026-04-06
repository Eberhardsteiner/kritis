import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CloudCog,
  DatabaseZap,
  Download,
  Fingerprint,
  HardDriveDownload,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import type {
  ApiClientScope,
  ApiClientSummary,
  AuthSession,
  HostingReadinessSummary,
  JobRunSummary,
  JobRunType,
  ServerHealth,
  SystemSettings,
  TenantSummary,
} from '../types';

interface OperationsViewProps {
  serverMode: 'checking' | 'connected' | 'syncing' | 'offline' | 'error' | 'auth_required';
  serverHealth: ServerHealth | null;
  authSession: AuthSession | null;
  availableTenants: TenantSummary[];
  systemSettings: SystemSettings;
  readinessSummary: HostingReadinessSummary | null;
  apiClients: ApiClientSummary[];
  jobRuns: JobRunSummary[];
  issuedClientSecret: { label: string; secret: string; mode: 'created' | 'rotated' } | null;
  hasSystemAdminAccess: boolean;
  onRefreshServer: () => void;
  onUpdateSystemSettings: (patch: Partial<SystemSettings>) => void;
  onCreateApiClient: (payload: {
    label: string;
    tenantId?: string;
    integrationType: 'reporting' | 'backup' | 'siem' | 'bi' | 'custom';
    scopes: ApiClientScope[];
    expiresAt?: string;
    note?: string;
  }) => void;
  onRotateApiClient: (clientId: string) => void;
  onRevokeApiClient: (clientId: string) => void;
  onRunSystemJob: (payload: { type: JobRunType; tenantId?: string }) => void;
  onUpdateTenant: (tenantId: string, patch: Partial<TenantSummary>) => void;
  onDownloadJobArtifact: (job: JobRunSummary) => void;
  onClearIssuedSecret: () => void;
}

const scopeOptions: Array<{ value: ApiClientScope; label: string }> = [
  { value: 'readiness:read', label: 'Readiness lesen' },
  { value: 'tenant:read', label: 'Mandanten lesen' },
  { value: 'exports:read', label: 'Exporte lesen' },
  { value: 'state:read', label: 'Arbeitsstand lesen' },
];

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

function readinessTone(status: HostingReadinessSummary['status'] | undefined): 'good' | 'warn' | 'alert' | 'default' {
  if (status === 'ready') {
    return 'good';
  }
  if (status === 'progressing') {
    return 'warn';
  }
  if (status === 'foundation') {
    return 'alert';
  }
  return 'default';
}

function readinessLabel(status: HostingReadinessSummary['status'] | undefined): string {
  if (status === 'ready') {
    return 'Betriebsreif';
  }
  if (status === 'progressing') {
    return 'Auf gutem Weg';
  }
  return 'Grundlagen fehlen';
}

function checkTone(status: 'ok' | 'warn' | 'missing'): 'success' | 'warn' | 'danger' {
  if (status === 'ok') {
    return 'success';
  }
  if (status === 'warn') {
    return 'warn';
  }
  return 'danger';
}

export function OperationsView({
  serverMode,
  serverHealth,
  authSession,
  availableTenants,
  systemSettings,
  readinessSummary,
  apiClients,
  jobRuns,
  issuedClientSecret,
  hasSystemAdminAccess,
  onRefreshServer,
  onUpdateSystemSettings,
  onCreateApiClient,
  onRotateApiClient,
  onRevokeApiClient,
  onRunSystemJob,
  onUpdateTenant,
  onDownloadJobArtifact,
  onClearIssuedSecret,
}: OperationsViewProps) {
  const [settingsDraft, setSettingsDraft] = useState<SystemSettings>(systemSettings);
  const [clientLabel, setClientLabel] = useState('');
  const [clientTenantId, setClientTenantId] = useState('');
  const [clientType, setClientType] = useState<'reporting' | 'backup' | 'siem' | 'bi' | 'custom'>('reporting');
  const [clientScopes, setClientScopes] = useState<ApiClientScope[]>(['readiness:read', 'tenant:read']);
  const [clientExpiresAt, setClientExpiresAt] = useState('');
  const [clientNote, setClientNote] = useState('');
  const [tenantDrafts, setTenantDrafts] = useState<Record<string, Partial<TenantSummary>>>({});

  useEffect(() => {
    setSettingsDraft(systemSettings);
  }, [systemSettings]);

  useEffect(() => {
    setTenantDrafts(
      Object.fromEntries(
        availableTenants.map((tenant) => [
          tenant.id,
          {
            deploymentStage: tenant.deploymentStage || 'pilot',
            serviceTier: tenant.serviceTier || 'standard',
            dataRegion: tenant.dataRegion || 'DE',
            primaryContactName: tenant.primaryContactName || '',
            primaryContactEmail: tenant.primaryContactEmail || '',
            technicalContactName: tenant.technicalContactName || '',
            technicalContactEmail: tenant.technicalContactEmail || '',
            notes: tenant.notes || '',
            active: tenant.active,
          },
        ]),
      ),
    );
  }, [availableTenants]);

  const productionTenantCount = useMemo(
    () => availableTenants.filter((tenant) => tenant.deploymentStage === 'production').length,
    [availableTenants],
  );

  const activeClientCount = useMemo(
    () => apiClients.filter((client) => client.status === 'active').length,
    [apiClients],
  );

  const latestJob = jobRuns[0] ?? null;

  const handleScopeToggle = (scope: ApiClientScope) => {
    setClientScopes((current) => (
      current.includes(scope)
        ? current.filter((entry) => entry !== scope)
        : [...current, scope]
    ));
  };

  const handleCreateClient = () => {
    if (!clientLabel.trim() || !clientScopes.length) {
      return;
    }

    onCreateApiClient({
      label: clientLabel.trim(),
      tenantId: clientTenantId || undefined,
      integrationType: clientType,
      scopes: clientScopes,
      expiresAt: clientExpiresAt || undefined,
      note: clientNote.trim() || undefined,
    });

    setClientLabel('');
    setClientExpiresAt('');
    setClientNote('');
    setClientScopes(['readiness:read', 'tenant:read']);
  };

  const integrationExample = issuedClientSecret
    ? `curl -H "x-api-key: ${issuedClientSecret.secret}" http://localhost:8787/api/integration/manifest`
    : 'Nach dem Erzeugen oder Rotieren eines API-Clients wird hier ein Beispielaufruf angezeigt.';

  return (
    <div className="view-stack">
      <section className="hero card">
        <div>
          <p className="eyebrow">Betrieb & APIs</p>
          <h2>Produktionsnahe Persistenzschicht, Hosting-Vorbereitung und belastbare Mandantenverwaltung</h2>
          <p className="hero-text">
            Phase 9 ergänzt den Arbeitsbereich um systemweite Betriebsparameter, API-Clients,
            Jobläufe und eine stärkere Mandantenpflege. Damit wird der Übergang von Bolt in
            ein späteres Hosting deutlich sauberer vorbereitet.
          </p>
          <div className="chip-row top-gap">
            <span className="chip outline">Servermodus: {serverMode}</span>
            <span className="chip outline">Persistenz: {systemSettings.persistenceDriver}</span>
            <span className="chip outline">Umgebung: {systemSettings.environmentLabel || 'nicht gesetzt'}</span>
            <span className="chip outline">API: {systemSettings.publicApiEnabled ? 'vorbereitet' : 'deaktiviert'}</span>
            {authSession ? <span className="chip outline">Systemkonto: {authSession.email}</span> : null}
          </div>
        </div>
        <div className="hero-actions">
          <button type="button" className="button secondary" onClick={onRefreshServer}>
            <RefreshCw size={16} />
            Betrieb neu laden
          </button>
        </div>
      </section>

      <section className="stats-grid phase-three">
        <StatCard
          title="Hosting-Readiness"
          value={`${readinessSummary?.overallScore ?? 0}%`}
          subtitle={readinessLabel(readinessSummary?.status)}
          tone={readinessTone(readinessSummary?.status)}
        />
        <StatCard
          title="Aktive Mandanten"
          value={`${readinessSummary?.activeTenantCount ?? availableTenants.length}`}
          subtitle={`${productionTenantCount} in Produktion markiert`}
          tone={availableTenants.length ? 'good' : 'default'}
        />
        <StatCard
          title="API-Clients"
          value={`${activeClientCount}`}
          subtitle={apiClients.length ? `${apiClients.length} Einträge im Katalog` : 'Noch keine Integration'}
          tone={activeClientCount ? 'good' : 'warn'}
        />
        <StatCard
          title="Letzter Joblauf"
          value={latestJob ? latestJob.label : '–'}
          subtitle={latestJob ? formatDateTime(latestJob.completedAt || latestJob.startedAt) : 'Noch kein Job'}
          tone={latestJob ? 'good' : 'default'}
        />
        <StatCard
          title="Basis-URL"
          value={systemSettings.appBaseUrl || '–'}
          subtitle={systemSettings.allowedOrigins.length ? `${systemSettings.allowedOrigins.length} erlaubte Origins` : 'Noch keine Origins'}
          tone={systemSettings.appBaseUrl ? 'default' : 'warn'}
        />
        <StatCard
          title="Serverfeatures"
          value={`${serverHealth?.features.length ?? 0}`}
          subtitle={serverHealth?.mode === 'tenant-filesystem' ? 'Mandantenfähiger Dateispeicher aktiv' : 'Server nicht verbunden'}
          tone={serverHealth ? 'good' : 'default'}
        />
      </section>

      {!hasSystemAdminAccess ? (
        <div className="feedback-box warn">
          <strong>Administrationsfunktionen sind aktuell schreibgeschützt.</strong>
          <p className="top-gap">
            Der normale Arbeitsbereich bleibt ohne Anmeldung nutzbar. Für Betriebsparameter,
            API-Clients, Mandantenpflege und manuelle Jobläufe ist jedoch ein angemeldetes
            Systemadministrationskonto erforderlich.
          </p>
        </div>
      ) : null}

      {issuedClientSecret ? (
        <div className="feedback-box success">
          <strong>API-Secret {issuedClientSecret.mode === 'created' ? 'erstellt' : 'rotiert'}: {issuedClientSecret.label}</strong>
          <p className="top-gap">Dieses Secret wird aus Sicherheitsgründen nur einmal vollständig angezeigt.</p>
          <p className="top-gap"><code>{issuedClientSecret.secret}</code></p>
          <p className="top-gap"><code>{integrationExample}</code></p>
          <div className="inline-actions top-gap">
            <button type="button" className="button secondary" onClick={onClearIssuedSecret}>
              Ausblendung bestätigen
            </button>
          </div>
        </div>
      ) : null}

      <section className="content-grid two-column">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Readiness</p>
              <h3>Technische Betriebsreife</h3>
            </div>
            <div className="inline-note">
              <ShieldCheck size={16} />
              <span>{readinessLabel(readinessSummary?.status)}</span>
            </div>
          </div>
          <div className="mini-list top-gap">
            {(readinessSummary?.checks || []).map((check) => (
              <div key={check.id} className="timeline-row">
                <div>
                  <strong>{check.label}</strong>
                  <p className="muted small top-gap">{check.detail}</p>
                </div>
                <span className={`chip ${checkTone(check.status)}`}>{check.status}</span>
              </div>
            ))}
            {!readinessSummary?.checks.length ? <p className="muted">Noch keine Prüfung verfügbar.</p> : null}
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Integrationspfade</p>
              <h3>Vorbereitete API-Endpunkte</h3>
            </div>
            <div className="inline-note">
              <Fingerprint size={16} />
              <span>{systemSettings.publicApiEnabled ? 'Öffentliche API vorbereitet' : 'Öffentliche API deaktiviert'}</span>
            </div>
          </div>
          <div className="work-list top-gap">
            <article className="work-card">
              <div className="work-card-head">
                <div>
                  <strong>/api/integration/manifest</strong>
                  <p className="muted small">Systemmanifest, Features und Basisparameter</p>
                </div>
                <Server size={18} />
              </div>
            </article>
            <article className="work-card">
              <div className="work-card-head">
                <div>
                  <strong>/api/integration/tenant-summary</strong>
                  <p className="muted small">Mandantenübersicht mit Betriebs- und Kontaktdaten</p>
                </div>
                <Building2 size={18} />
              </div>
            </article>
            <article className="work-card">
              <div className="work-card-head">
                <div>
                  <strong>/api/integration/exports</strong>
                  <p className="muted small">Freigegebene oder registrierte Exportpakete je Mandant</p>
                </div>
                <HardDriveDownload size={18} />
              </div>
            </article>
          </div>
          <p className="muted small top-gap"><code>{integrationExample}</code></p>
        </article>
      </section>

      <section className="content-grid two-column">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Systemprofil</p>
              <h3>Persistenz-, Hosting- und API-Parameter</h3>
            </div>
            <div className="inline-note">
              <CloudCog size={16} />
              <span>{systemSettings.maintenanceMode ? 'Wartungsmodus aktiv' : 'Normalbetrieb'}</span>
            </div>
          </div>
          <div className="form-grid two-column top-gap">
            <label className="field-label">
              Umgebungslabel
              <input
                value={settingsDraft.environmentLabel}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, environmentLabel: event.target.value }))}
                placeholder="z. B. Pilot / Hosting EU"
                disabled={!hasSystemAdminAccess}
              />
            </label>
            <label className="field-label">
              Deployment-Stufe
              <select
                value={settingsDraft.deploymentStage}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, deploymentStage: event.target.value as SystemSettings['deploymentStage'] }))}
                disabled={!hasSystemAdminAccess}
              >
                <option value="local">Local</option>
                <option value="pilot">Pilot</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </label>
            <label className="field-label wide">
              Basis-URL
              <input
                value={settingsDraft.appBaseUrl}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, appBaseUrl: event.target.value }))}
                placeholder="https://krisenfest.example.com"
                disabled={!hasSystemAdminAccess}
              />
            </label>
            <label className="field-label wide">
              Erlaubte Origins, kommagetrennt
              <input
                value={settingsDraft.allowedOrigins.join(', ')}
                onChange={(event) => setSettingsDraft((current) => ({
                  ...current,
                  allowedOrigins: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
                }))}
                placeholder="https://app.example.com, https://admin.example.com"
                disabled={!hasSystemAdminAccess}
              />
            </label>
            <label className="field-label">
              Persistenztreiber
              <select
                value={settingsDraft.persistenceDriver}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, persistenceDriver: event.target.value as SystemSettings['persistenceDriver'] }))}
                disabled={!hasSystemAdminAccess}
              >
                <option value="tenant-filesystem">tenant-filesystem</option>
                <option value="json-adapter">json-adapter</option>
                <option value="external-adapter">external-adapter</option>
              </select>
            </label>
            <label className="field-label">
              Persistenzziel
              <input
                value={settingsDraft.persistenceTarget}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, persistenceTarget: event.target.value }))}
                placeholder="server-storage/tenants"
                disabled={!hasSystemAdminAccess}
              />
            </label>
            <label className="field-label">
              Backup-Kadenz in Stunden
              <input
                type="number"
                min={1}
                value={settingsDraft.backupCadenceHours}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, backupCadenceHours: Number(event.target.value) || 1 }))}
                disabled={!hasSystemAdminAccess}
              />
            </label>
            <label className="field-label wide">
              Betriebsnotiz
              <textarea
                value={settingsDraft.notes}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Hinweise zu Hosting, Secrets, Proxy, CDN oder Rollout"
                disabled={!hasSystemAdminAccess}
              />
            </label>
          </div>
          <div className="inline-actions top-gap">
            <button
              type="button"
              className="button secondary"
              onClick={() => setSettingsDraft(systemSettings)}
              disabled={!hasSystemAdminAccess}
            >
              <RotateCcw size={16} />
              Entwurf zurücksetzen
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => onUpdateSystemSettings(settingsDraft)}
              disabled={!hasSystemAdminAccess}
            >
              <DatabaseZap size={16} />
              Systemprofil speichern
            </button>
          </div>
          <div className="chip-row top-gap">
            <button
              type="button"
              className={`status-toggle ${settingsDraft.maintenanceMode ? 'selected' : ''}`}
              onClick={() => hasSystemAdminAccess && setSettingsDraft((current) => ({ ...current, maintenanceMode: !current.maintenanceMode }))}
              disabled={!hasSystemAdminAccess}
            >
              Wartungsmodus
            </button>
            <button
              type="button"
              className={`status-toggle ${settingsDraft.publicApiEnabled ? 'selected' : ''}`}
              onClick={() => hasSystemAdminAccess && setSettingsDraft((current) => ({ ...current, publicApiEnabled: !current.publicApiEnabled }))}
              disabled={!hasSystemAdminAccess}
            >
              Öffentliche API
            </button>
            <button
              type="button"
              className={`status-toggle ${settingsDraft.requireSignedWebhooks ? 'selected' : ''}`}
              onClick={() => hasSystemAdminAccess && setSettingsDraft((current) => ({ ...current, requireSignedWebhooks: !current.requireSignedWebhooks }))}
              disabled={!hasSystemAdminAccess}
            >
              Signierte Webhooks
            </button>
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">API-Clients</p>
              <h3>Servicezugänge für Reporting, Backup und Integration</h3>
            </div>
            <div className="inline-note">
              <KeyRound size={16} />
              <span>{activeClientCount} aktive Clients</span>
            </div>
          </div>
          <div className="form-grid two-column top-gap">
            <label className="field-label wide">
              Bezeichnung
              <input
                value={clientLabel}
                onChange={(event) => setClientLabel(event.target.value)}
                placeholder="z. B. BI-Export, Backup-Agent, SIEM-Feed"
                disabled={!hasSystemAdminAccess}
              />
            </label>
            <label className="field-label">
              Mandant
              <select value={clientTenantId} onChange={(event) => setClientTenantId(event.target.value)} disabled={!hasSystemAdminAccess}>
                <option value="">Systemweit</option>
                {availableTenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Typ
              <select value={clientType} onChange={(event) => setClientType(event.target.value as typeof clientType)} disabled={!hasSystemAdminAccess}>
                <option value="reporting">Reporting</option>
                <option value="backup">Backup</option>
                <option value="siem">SIEM</option>
                <option value="bi">BI</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="field-label">
              Gültig bis
              <input type="date" value={clientExpiresAt} onChange={(event) => setClientExpiresAt(event.target.value)} disabled={!hasSystemAdminAccess} />
            </label>
            <label className="field-label wide">
              Notiz
              <input value={clientNote} onChange={(event) => setClientNote(event.target.value)} placeholder="Verwendungszweck oder Rotationshinweis" disabled={!hasSystemAdminAccess} />
            </label>
          </div>
          <div className="chip-row top-gap">
            {scopeOptions.map((scope) => (
              <button
                key={scope.value}
                type="button"
                className={`status-toggle ${clientScopes.includes(scope.value) ? 'selected' : ''}`}
                onClick={() => hasSystemAdminAccess && handleScopeToggle(scope.value)}
                disabled={!hasSystemAdminAccess}
              >
                {scope.label}
              </button>
            ))}
          </div>
          <div className="inline-actions top-gap">
            <button type="button" className="button primary" onClick={handleCreateClient} disabled={!hasSystemAdminAccess || !clientLabel.trim() || !clientScopes.length}>
              <KeyRound size={16} />
              API-Client anlegen
            </button>
          </div>
          <div className="work-list top-gap">
            {apiClients.map((client) => (
              <article key={client.id} className="work-card">
                <div className="work-card-head">
                  <div>
                    <div className="question-title-row">
                      <strong>{client.label}</strong>
                      <span className={`chip ${client.status === 'active' ? 'success' : 'warn'}`}>{client.status === 'active' ? 'aktiv' : 'widerrufen'}</span>
                    </div>
                    <p className="muted small top-gap">{client.integrationType} · {client.tenantName || 'systemweit'} · {client.secretHint}</p>
                  </div>
                </div>
                <div className="chip-row">
                  {client.scopes.map((scope) => <span key={scope} className="chip outline">{scope}</span>)}
                </div>
                <div className="mini-list">
                  <div className="mini-list-row"><span>Erstellt</span><strong>{formatDateTime(client.createdAt)}</strong></div>
                  <div className="mini-list-row"><span>Zuletzt genutzt</span><strong>{formatDateTime(client.lastUsedAt)}</strong></div>
                  <div className="mini-list-row"><span>Gültig bis</span><strong>{formatDateTime(client.expiresAt)}</strong></div>
                </div>
                <div className="inline-actions">
                  <button type="button" className="button secondary" onClick={() => onRotateApiClient(client.id)} disabled={!hasSystemAdminAccess || client.status !== 'active'}>
                    <RotateCcw size={16} />
                    Secret rotieren
                  </button>
                  <button type="button" className="button secondary" onClick={() => onRevokeApiClient(client.id)} disabled={!hasSystemAdminAccess || client.status !== 'active'}>
                    <AlertTriangle size={16} />
                    Client widerrufen
                  </button>
                </div>
              </article>
            ))}
            {!apiClients.length ? <p className="muted">Noch keine API-Clients angelegt.</p> : null}
          </div>
        </article>
      </section>

      <section className="content-grid two-column">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Systemjobs</p>
              <h3>Backups, Integritätsscans und Exportinventar</h3>
            </div>
            <div className="inline-note">
              <HardDriveDownload size={16} />
              <span>{jobRuns.length} registrierte Läufe</span>
            </div>
          </div>
          <div className="inline-actions top-gap">
            <button type="button" className="button secondary" onClick={() => onRunSystemJob({ type: 'tenant_backup' })} disabled={!hasSystemAdminAccess}>
              <CheckCircle2 size={16} />
              Mandantenbackup erzeugen
            </button>
            <button type="button" className="button secondary" onClick={() => onRunSystemJob({ type: 'integrity_scan' })} disabled={!hasSystemAdminAccess}>
              <ShieldCheck size={16} />
              Integrität prüfen
            </button>
            <button type="button" className="button secondary" onClick={() => onRunSystemJob({ type: 'export_inventory' })} disabled={!hasSystemAdminAccess}>
              <Download size={16} />
              Exportinventar erzeugen
            </button>
          </div>
          <div className="work-list top-gap">
            {jobRuns.map((job) => (
              <article key={job.id} className="work-card">
                <div className="work-card-head">
                  <div>
                    <div className="question-title-row">
                      <strong>{job.label}</strong>
                      <span className={`chip ${job.status === 'done' ? 'success' : job.status === 'running' ? 'warn' : 'danger'}`}>{job.status}</span>
                    </div>
                    <p className="muted small top-gap">{job.tenantName || 'systemweit'} · {job.summary}</p>
                  </div>
                </div>
                <div className="mini-list">
                  <div className="mini-list-row"><span>Gestartet</span><strong>{formatDateTime(job.startedAt)}</strong></div>
                  <div className="mini-list-row"><span>Beendet</span><strong>{formatDateTime(job.completedAt)}</strong></div>
                  <div className="mini-list-row"><span>Ausgelöst von</span><strong>{job.triggeredBy}</strong></div>
                </div>
                <div className="inline-actions">
                  {job.downloadUrl ? (
                    <button type="button" className="button secondary" onClick={() => onDownloadJobArtifact(job)}>
                      <Download size={16} />
                      Artefakt laden
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
            {!jobRuns.length ? <p className="muted">Noch keine Jobläufe vorhanden.</p> : null}
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Mandantenregister</p>
              <h3>Betriebsdaten, Kontakte und Rollout-Stufe</h3>
            </div>
            <div className="inline-note">
              <Building2 size={16} />
              <span>{availableTenants.length} Mandanten</span>
            </div>
          </div>
          <div className="work-list top-gap">
            {availableTenants.map((tenant) => {
              const draft = tenantDrafts[tenant.id] || {};
              return (
                <article key={tenant.id} className="work-card">
                  <div className="work-card-head">
                    <div>
                      <div className="question-title-row">
                        <strong>{tenant.name}</strong>
                        <span className={`chip ${tenant.active ? 'success' : 'warn'}`}>{tenant.active ? 'aktiv' : 'pausiert'}</span>
                      </div>
                      <p className="muted small top-gap">{tenant.slug} · {tenant.industryLabel || 'ohne Branche'} · aktualisiert {formatDateTime(tenant.updatedAt)}</p>
                    </div>
                  </div>
                  <div className="form-grid two-column">
                    <label className="field-label">
                      Rollout-Stufe
                      <select
                        value={String(draft.deploymentStage || 'pilot')}
                        onChange={(event) => setTenantDrafts((current) => ({ ...current, [tenant.id]: { ...current[tenant.id], deploymentStage: event.target.value as TenantSummary['deploymentStage'] } }))}
                        disabled={!hasSystemAdminAccess}
                      >
                        <option value="pilot">Pilot</option>
                        <option value="staging">Staging</option>
                        <option value="production">Production</option>
                      </select>
                    </label>
                    <label className="field-label">
                      Service-Tier
                      <select
                        value={String(draft.serviceTier || 'standard')}
                        onChange={(event) => setTenantDrafts((current) => ({ ...current, [tenant.id]: { ...current[tenant.id], serviceTier: event.target.value as TenantSummary['serviceTier'] } }))}
                        disabled={!hasSystemAdminAccess}
                      >
                        <option value="standard">Standard</option>
                        <option value="plus">Plus</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </label>
                    <label className="field-label">
                      Datenregion
                      <input
                        value={String(draft.dataRegion || '')}
                        onChange={(event) => setTenantDrafts((current) => ({ ...current, [tenant.id]: { ...current[tenant.id], dataRegion: event.target.value } }))}
                        placeholder="z. B. DE, EU-West"
                        disabled={!hasSystemAdminAccess}
                      />
                    </label>
                    <label className="field-label">
                      Primärer Ansprechpartner
                      <input
                        value={String(draft.primaryContactName || '')}
                        onChange={(event) => setTenantDrafts((current) => ({ ...current, [tenant.id]: { ...current[tenant.id], primaryContactName: event.target.value } }))}
                        disabled={!hasSystemAdminAccess}
                      />
                    </label>
                    <label className="field-label">
                      Primäre E-Mail
                      <input
                        type="email"
                        value={String(draft.primaryContactEmail || '')}
                        onChange={(event) => setTenantDrafts((current) => ({ ...current, [tenant.id]: { ...current[tenant.id], primaryContactEmail: event.target.value } }))}
                        disabled={!hasSystemAdminAccess}
                      />
                    </label>
                    <label className="field-label">
                      Technischer Ansprechpartner
                      <input
                        value={String(draft.technicalContactName || '')}
                        onChange={(event) => setTenantDrafts((current) => ({ ...current, [tenant.id]: { ...current[tenant.id], technicalContactName: event.target.value } }))}
                        disabled={!hasSystemAdminAccess}
                      />
                    </label>
                    <label className="field-label wide">
                      Technische E-Mail
                      <input
                        type="email"
                        value={String(draft.technicalContactEmail || '')}
                        onChange={(event) => setTenantDrafts((current) => ({ ...current, [tenant.id]: { ...current[tenant.id], technicalContactEmail: event.target.value } }))}
                        disabled={!hasSystemAdminAccess}
                      />
                    </label>
                    <label className="field-label wide">
                      Notiz
                      <textarea
                        value={String(draft.notes || '')}
                        onChange={(event) => setTenantDrafts((current) => ({ ...current, [tenant.id]: { ...current[tenant.id], notes: event.target.value } }))}
                        disabled={!hasSystemAdminAccess}
                      />
                    </label>
                  </div>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="button primary"
                      onClick={() => onUpdateTenant(tenant.id, draft)}
                      disabled={!hasSystemAdminAccess}
                    >
                      <Building2 size={16} />
                      Mandant speichern
                    </button>
                  </div>
                </article>
              );
            })}
            {!availableTenants.length ? <p className="muted">Noch keine Mandanten vorhanden.</p> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
