import { useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  Cloud,
  Database,
  Fingerprint,
  HardDriveUpload,
  History,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Users2,
} from 'lucide-react';
import { StatCard } from '../../../components/StatCard';
import type {
  AccessAccountSummary,
  AccessProfileDefinition,
  AuthMode,
  AuthProviderSummary,
  AuditLogEntry,
  AuthSession,
  DocumentLedgerSummaryServer,
  EvidenceRetentionSummary,
  ExportPackageEntry,
  ServerHealth,
  SnapshotInfo,
  TenantPolicy,
  TenantSummary,
  UserItem,
  UserRoleProfile,
} from '../../../types';

interface PlatformViewProps {
  serverMode: 'checking' | 'connected' | 'syncing' | 'offline' | 'error' | 'auth_required';
  serverHealth: ServerHealth | null;
  activeUser: UserItem | null;
  activeAccessProfile: AccessProfileDefinition;
  authSession: AuthSession | null;
  authMode: AuthMode;
  authProviders: AuthProviderSummary[];
  serverAuthRequired: boolean;
  publicTenant: TenantSummary | null;
  availableTenants: TenantSummary[];
  /**
   * Wenn true, rendert der Auth-Block nur ein Ein-Klick-Demo-Login:
   * E-Mail-Input, Passwort-Input, „Demo-Anmeldung"-Button. Kein
   * Mandant-Dropdown, kein SSO-Block, keine Provider-Chips. Aktiviert
   * über `KRISENFEST_DEMO_SIMPLE_AUTH=true` in der Backend-Env.
   */
  demoSimpleAuth: boolean;
  accessAccounts: AccessAccountSummary[];
  documentLedger: DocumentLedgerSummaryServer | null;
  evidenceRetentionSummary: EvidenceRetentionSummary | null;
  users: UserItem[];
  autoSyncEnabled: boolean;
  lastServerLoadAt: string;
  lastServerSyncAt: string;
  syncError: string;
  attachmentCount: number;
  evidenceCount: number;
  auditLog: AuditLogEntry[];
  snapshots: SnapshotInfo[];
  exportPackages: ExportPackageEntry[];
  tenantPolicy: TenantPolicy;
  hasWorkspaceAccess: boolean;
  onToggleAutoSync: (value: boolean) => void;
  onRefreshServer: () => void;
  onSyncNow: () => void;
  onCreateSnapshot: (name: string, comment: string) => void;
  onRestoreSnapshot: (snapshotId: string) => void;
  onLogin: (email: string, password: string, tenantId: string) => void;
  onDemoLogin: (email: string, password: string) => void;
  onStartOidcLogin: (tenantId: string) => void;
  onLogout: () => void;
  onCreateTenant: (payload: {
    name: string;
    slug: string;
    industryLabel: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
  }) => void;
  onCreateAccessAccount: (payload: {
    tenantId?: string;
    name: string;
    email: string;
    password: string;
    roleProfile: UserRoleProfile;
    authSource?: 'local' | 'oidc' | 'hybrid';
    status?: 'active' | 'invited' | 'inactive';
    scope?: string;
    workspaceUserId?: string;
  }) => void;
  onResetAccessAccountPassword: (accountId: string, password: string) => void;
  onUpdateTenantPolicy: (patch: Partial<TenantPolicy>) => void;
  onReleaseExportPackage: (exportId: string, releaseNote: string) => void;
  onDownloadExportPackage: (entry: ExportPackageEntry) => void;
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
  if (mode === 'auth_required') {
    return 'Anmeldung erforderlich';
  }
  return 'Verbindung wird geprüft';
}

function checksumPreview(value: string): string {
  return value ? `${value.slice(0, 12)}…` : '–';
}

export function PlatformView({
  serverMode,
  serverHealth,
  activeUser,
  activeAccessProfile,
  authSession,
  authMode,
  authProviders,
  serverAuthRequired,
  publicTenant,
  availableTenants,
  demoSimpleAuth,
  accessAccounts,
  documentLedger,
  evidenceRetentionSummary,
  users,
  autoSyncEnabled,
  lastServerLoadAt,
  lastServerSyncAt,
  syncError,
  attachmentCount,
  evidenceCount,
  auditLog,
  snapshots,
  exportPackages,
  tenantPolicy,
  hasWorkspaceAccess,
  onToggleAutoSync,
  onRefreshServer,
  onSyncNow,
  onCreateSnapshot,
  onRestoreSnapshot,
  onLogin,
  onDemoLogin,
  onStartOidcLogin,
  onLogout,
  onCreateTenant,
  onCreateAccessAccount,
  onResetAccessAccountPassword,
  onUpdateTenantPolicy,
  onReleaseExportPackage,
  onDownloadExportPackage,
}: PlatformViewProps) {
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotComment, setSnapshotComment] = useState('');
  const [loginEmail, setLoginEmail] = useState(authSession?.email || 'admin@krisenfest.local');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginTenantId, setLoginTenantId] = useState(authSession?.tenantId || availableTenants[0]?.id || '');

  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantIndustry, setTenantIndustry] = useState('');
  const [tenantAdminName, setTenantAdminName] = useState('');
  const [tenantAdminEmail, setTenantAdminEmail] = useState('');
  const [tenantAdminPassword, setTenantAdminPassword] = useState('');

  const [selectedWorkspaceUserId, setSelectedWorkspaceUserId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountRole, setAccountRole] = useState<UserRoleProfile>('editor');
  const [accountAuthSource, setAccountAuthSource] = useState<'local' | 'oidc' | 'hybrid'>('local');
  const [accountScope, setAccountScope] = useState('');
  const [passwordResetMap, setPasswordResetMap] = useState<Record<string, string>>({});
  const [exportReleaseNotes, setExportReleaseNotes] = useState<Record<string, string>>({});
  const [policyDraft, setPolicyDraft] = useState<TenantPolicy>(tenantPolicy);

  const serverTone = serverMode === 'connected'
    ? 'good'
    : serverMode === 'syncing'
      ? 'warn'
      : serverMode === 'error' || serverMode === 'offline'
        ? 'alert'
        : 'default';

  const currentTenant = useMemo(
    () => availableTenants.find((tenant) => tenant.id === authSession?.tenantId) ?? publicTenant ?? null,
    [availableTenants, authSession, publicTenant],
  );
  const recentExports = exportPackages.slice(0, 10);
  const localProvider = authProviders.find((provider) => provider.id === 'local') ?? null;
  const oidcProvider = authProviders.find((provider) => provider.id === 'oidc') ?? null;
  const localLoginEnabled = Boolean(localProvider?.enabled && localProvider?.configured);
  const oidcLoginEnabled = Boolean(oidcProvider?.enabled && oidcProvider?.configured);

  useEffect(() => {
    if (authSession?.tenantId) {
      setLoginTenantId(authSession.tenantId);
      setLoginEmail(authSession.email);
      return;
    }

    if (!loginTenantId && availableTenants.length) {
      setLoginTenantId(availableTenants[0].id);
    }
  }, [authSession, availableTenants, loginTenantId]);


  useEffect(() => {
    setPolicyDraft(tenantPolicy);
  }, [tenantPolicy]);

  const workspaceUserOptions = users.map((user) => ({
    id: user.id,
    label: user.name || user.email || 'Unbenannter Nutzer',
    email: user.email,
    roleProfile: user.roleProfile,
    scope: user.scope,
  }));

  const handleWorkspaceUserSelection = (userId: string) => {
    setSelectedWorkspaceUserId(userId);
    const selectedUser = users.find((user) => user.id === userId);
    if (!selectedUser) {
      return;
    }

    setAccountName(selectedUser.name || accountName);
    setAccountEmail(selectedUser.email || accountEmail);
    setAccountRole(selectedUser.roleProfile);
    setAccountScope(selectedUser.scope || accountScope);
  };

  return (
    <div className="view-stack">
      <section className="hero card">
        <div>
          <p className="eyebrow">Plattform, Sync & Arbeitsbereiche</p>
          <h2>Lesemodus ohne Login, geschützte Bearbeitung, Objektablage und versionierte Dokumente</h2>
          <p className="hero-text">
            Die Plattformsicht bündelt offenen Lesemodus, produktive Identität, SSO-Startpfade,
            Mandantenrichtlinien, Exportregister und Dokumentversionierung. Die in Produktpaket P3
            eingeführte Objektablage und der Evidenz-Lebenszyklus werden in P4 nun auf eine
            wartbarere und pilotfähige Struktur überführt.
          </p>
          <div className="chip-row top-gap">
            <span className="chip outline">{authSession ? describeMode(serverMode) : serverMode === 'connected' ? 'Offener Lesemodus' : describeMode(serverMode)}</span>
            <span className="chip outline">Arbeitsprofil: {activeAccessProfile.label}</span>
            {!authSession && publicTenant ? <span className="chip outline">Arbeitsbereich: {publicTenant.name}</span> : null}
            {authSession ? <span className="chip outline">Mandant: {authSession.tenantName}</span> : null}
            {authSession ? <span className="chip outline">Konto: {authSession.email}</span> : null}
          </div>
        </div>
        <div className="hero-actions">
          <button type="button" className="button secondary" onClick={onRefreshServer}>
            <RefreshCw size={16} />
            Server neu laden
          </button>
          <button
            type="button"
            className="button primary"
            onClick={onSyncNow}
            disabled={serverMode === 'offline' || serverMode === 'checking' || serverMode === 'auth_required'}
          >
            <Save size={16} />
            Jetzt synchronisieren
          </button>
        </div>
      </section>

      <section className="stats-grid phase-three">
        <StatCard
          title="Backend"
          value={serverHealth?.mode === 'sqlite-document-store' ? 'SQLite-Dokumentstore' : serverHealth?.mode === 'tenant-filesystem' ? 'Mandanten-Storage' : '–'}
          subtitle={describeMode(serverMode)}
          tone={serverTone}
        />
        <StatCard
          title="Mandanten"
          value={`${serverHealth?.tenantCount ?? availableTenants.length}`}
          subtitle={currentTenant ? `Aktiv: ${currentTenant.name}` : 'Mandantenkatalog geladen'}
          tone={availableTenants.length ? 'good' : 'default'}
        />
        <StatCard
          title="Aktive Sitzungen"
          value={`${serverHealth?.sessionCount ?? 0}`}
          subtitle={authSession ? `Eingeloggt bis ${formatDateTime(authSession.expiresAt)}` : 'Keine aktive Sitzung im Browser'}
          tone={authSession ? 'good' : 'warn'}
        />
        <StatCard
          title="Dokumentversionen"
          value={`${documentLedger?.totalVersions ?? 0}`}
          subtitle={documentLedger?.evidenceWithHistory ? `${documentLedger.evidenceWithHistory} Evidenzen mit Historie` : 'Noch keine Historie'}
          tone={documentLedger?.totalVersions ? 'good' : 'default'}
        />
        <StatCard
          title="Aktive Dateireferenzen"
          value={`${documentLedger?.currentAttachments ?? attachmentCount}`}
          subtitle={`${evidenceCount} Evidenzen im Register`}
          tone={documentLedger?.currentAttachments ? 'good' : 'default'}
        />
        <StatCard
          title="Retention kritisch"
          value={`${(evidenceRetentionSummary?.expired ?? 0) + (evidenceRetentionSummary?.expiringSoon ?? 0)}`}
          subtitle={evidenceRetentionSummary ? `${evidenceRetentionSummary.dueForReview} Review überfällig` : 'Lebenszyklus wird geladen'}
          tone={(evidenceRetentionSummary?.expired ?? 0) > 0 ? 'alert' : (evidenceRetentionSummary?.expiringSoon ?? 0) > 0 || (evidenceRetentionSummary?.dueForReview ?? 0) > 0 ? 'warn' : 'good'}
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
          title="Exportregister"
          value={`${exportPackages.length}`}
          subtitle={exportPackages.length ? 'Registrierte Berichtspakete' : 'Noch keine Pakete'}
          tone={exportPackages.length ? 'good' : 'default'}
        />
        <StatCard
          title="Zugriffskonten"
          value={`${accessAccounts.length}`}
          subtitle={hasWorkspaceAccess ? 'Für aktuellen Mandanten sichtbar' : 'Lesemodus'}
          tone={accessAccounts.length ? 'default' : 'warn'}
        />
      </section>

      <section className="content-grid two-column">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Authentifizierung</p>
              <h3>Optionaler Login für Administration und Mehrmandantenbetrieb</h3>
            </div>
            <div className="inline-note">
              <Fingerprint size={16} />
              <span>{authSession ? 'Sitzung aktiv' : serverAuthRequired ? 'Login erforderlich' : 'Login optional'}</span>
            </div>
          </div>

          {!authSession ? (
            demoSimpleAuth ? (
              /* Demo-Simple-Auth · Ein-Klick-Admin-Zugang.
                 Die Full-Auth-Kette (Tenant-Dropdown, SSO, Provider-Chips)
                 ist bewusst ausgeblendet, bleibt aber code-seitig intakt
                 im sonst-Zweig unten. Reaktivierung via
                 KRISENFEST_DEMO_SIMPLE_AUTH=false. Siehe
                 docs/DEMO-AUTH-BYPASS.md. */
              <div className="view-stack top-gap">
                <div className="chip-row">
                  <span className="chip outline">Demo-Modus · Ein-Klick-Login</span>
                </div>
                <div className="form-grid two-column">
                  <label className="field-label wide">
                    E-Mail
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                      placeholder="demo@krisenfest.local"
                    />
                  </label>
                  <label className="field-label">
                    Passwort
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="Passwort"
                    />
                  </label>
                  <div className="inline-actions align-end wide">
                    <button
                      type="button"
                      className="button primary"
                      onClick={() => onDemoLogin(loginEmail, loginPassword)}
                      disabled={!loginEmail || !loginPassword || serverMode === 'offline' || serverMode === 'checking'}
                    >
                      <LockKeyhole size={16} />
                      Demo-Anmeldung
                    </button>
                  </div>
                  <div className="feedback-box wide top-gap">
                    <strong>Vereinfachter Demo-Zugang</strong>
                    <p className="top-gap">
                      Für die UVM-Demo ist der Login auf ein Paar aus E-Mail und Passwort reduziert. Default-Tenant und Admin-Rolle werden serverseitig aufgelöst. Passwort: wie im Demo-Briefing (<code>docs/DEMO-ZUGANG.md</code>).
                    </p>
                  </div>
                </div>
              </div>
            ) : (
            <div className="view-stack top-gap">
              <div className="chip-row">
                <span className="chip outline">Auth-Modus: {authMode}</span>
                {localProvider ? <span className={`chip ${localLoginEnabled ? 'success' : 'outline'}`}>Lokal {localLoginEnabled ? 'bereit' : 'deaktiviert'}</span> : null}
                {oidcProvider ? <span className={`chip ${oidcLoginEnabled ? 'success' : 'warn'}`}>SSO {oidcLoginEnabled ? 'bereit' : 'konfigurationsbereit'}</span> : null}
              </div>

              <div className="form-grid two-column">
                <label className="field-label wide">
                  Mandant
                  <select
                    value={loginTenantId}
                    onChange={(event) => setLoginTenantId(event.target.value)}
                  >
                    {availableTenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="feedback-box wide">
                  <strong>{serverAuthRequired ? 'Anmeldung erforderlich' : 'Anmeldung optional'}</strong>
                  <p className="top-gap">
                    {serverAuthRequired
                      ? 'Dieser Server verlangt eine Anmeldung, bevor Bearbeitung oder Verwaltung möglich sind.'
                      : 'Ohne Login steht ein offener Lesemodus bereit. Für Bearbeitung, Kontoverwaltung oder den Wechsel in andere Mandanten ist eine Anmeldung erforderlich.'}
                  </p>
                </div>
              </div>

              {oidcProvider ? (
                <div className="feedback-box success">
                  <strong>{oidcProvider.label}</strong>
                  <p className="top-gap">{oidcProvider.description}</p>
                  <div className="inline-actions top-gap">
                    <button
                      type="button"
                      className="button primary"
                      onClick={() => onStartOidcLogin(loginTenantId)}
                      disabled={serverMode === 'offline' || serverMode === 'checking' || !oidcLoginEnabled || !loginTenantId}
                    >
                      <Fingerprint size={16} />
                      Mit SSO anmelden
                    </button>
                  </div>
                </div>
              ) : null}

              {localProvider ? (
                <div className="form-grid two-column">
                  <label className="field-label wide">
                    E-Mail
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                      placeholder="admin@krisenfest.local"
                      disabled={!localLoginEnabled}
                    />
                  </label>
                  <label className="field-label">
                    Passwort
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="Passwort"
                      disabled={!localLoginEnabled}
                    />
                  </label>
                  <div className="inline-actions align-end wide">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => onLogin(loginEmail, loginPassword, loginTenantId)}
                      disabled={serverMode === 'offline' || serverMode === 'checking' || !localLoginEnabled || !availableTenants.length || !loginTenantId}
                    >
                      <LockKeyhole size={16} />
                      Lokal anmelden
                    </button>
                  </div>
                  <div className="feedback-box wide top-gap">
                    <strong>{localProvider.label}</strong>
                    <p className="top-gap">{localProvider.description}</p>
                    <p className="top-gap">
                      Demo-Konto: <code>admin@krisenfest.local</code>. Das Passwort wird bewusst nicht über Oberfläche oder Bootstrap-Endpunkt offengelegt.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
            )
          ) : (
            <div className="mini-list top-gap">
              <div className="mini-list-row"><span>Angemeldet als</span><strong>{authSession.name} · {authSession.email}</strong></div>
              <div className="mini-list-row"><span>Mandant</span><strong>{authSession.tenantName}</strong></div>
              <div className="mini-list-row"><span>Serverrolle</span><strong>{activeAccessProfile.label}</strong></div>
              <div className="mini-list-row"><span>Authentifizierungsweg</span><strong>{authSession.authProvider === 'oidc' ? 'SSO / OIDC' : 'Lokales Konto'}</strong></div>
              <div className="mini-list-row"><span>Ablauf der Sitzung</span><strong>{formatDateTime(authSession.expiresAt)}</strong></div>
              <div className="mini-list-row"><span>Arbeitsprofil in der App</span><strong>{activeUser?.name || '–'}</strong></div>
              <div className="inline-actions top-gap">
                <button type="button" className="button secondary" onClick={onLogout}>
                  <LockKeyhole size={16} />
                  Abmelden
                </button>
              </div>
            </div>
          )}
        </article>

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
            <div className="mini-list-row"><span>Arbeitsmodus</span><strong>{authSession ? 'Authentifizierte Sitzung' : serverAuthRequired ? 'Login erforderlich' : 'Offener Lesemodus'}</strong></div>
            <div className="mini-list-row"><span>Letzter Server-Load</span><strong>{formatDateTime(lastServerLoadAt)}</strong></div>
            <div className="mini-list-row"><span>Letzter Sync</span><strong>{formatDateTime(lastServerSyncAt)}</strong></div>
            <div className="mini-list-row"><span>Funktionen</span><strong>{serverHealth?.features?.join(', ') || '–'}</strong></div>
          </div>

          <label className="checkbox-row top-gap">
            <input
              type="checkbox"
              checked={autoSyncEnabled}
              onChange={(event) => onToggleAutoSync(event.target.checked)}
              disabled={serverMode === 'offline' || serverMode === 'checking' || serverMode === 'auth_required'}
            />
            <span>
              Änderungen automatisch an den Server übertragen. Der lokale Browserstand bleibt zusätzlich als
              Fallback erhalten.
            </span>
          </label>

          {syncError ? (
            <div className="feedback-box error top-gap">
              <strong>Letzter Hinweis</strong>
              <p className="top-gap">{syncError}</p>
            </div>
          ) : (
            <div className="feedback-box success top-gap">
              <strong>{authSession ? 'Authentifizierter Mandantenmodus' : 'Offener Lesemodus aktiv'}</strong>
              <p className="top-gap">
                {authSession
                  ? 'Der Server trennt Arbeitsstände mandantenweise und prüft Schreibrechte anhand der angemeldeten Rolle, nicht nur anhand der Frontend-Auswahl.'
                  : 'Der Server stellt ohne Anmeldung ausschließlich einen lesenden Arbeitsbereich bereit. Änderungen, Kontoverwaltung und Mehrmandantenfunktionen erfordern eine authentifizierte Rolle.'}
              </p>
            </div>
          )}
        </article>
      </section>

      <section className="content-grid two-column">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Mandantenrichtlinien</p>
              <h3>Vorgaben für Evidenzen, Exporte und Freigaben</h3>
            </div>
            <div className="inline-note">
              <ShieldCheck size={16} />
              <span>{currentTenant ? currentTenant.name : 'Arbeitsbereich'}</span>
            </div>
          </div>

          <div className="form-grid two-column top-gap">
            <label className="field-label">
              Aufbewahrungstage
              <input
                type="number"
                min={30}
                value={policyDraft.retentionDays}
                onChange={(event) => setPolicyDraft((current) => ({ ...current, retentionDays: Number(event.target.value || 0) }))}
              />
            </label>
            <label className="field-label">
              Evidenz-Review-Zyklus
              <input
                type="number"
                min={30}
                value={policyDraft.evidenceReviewCadenceDays}
                onChange={(event) => setPolicyDraft((current) => ({ ...current, evidenceReviewCadenceDays: Number(event.target.value || 0) }))}
              />
            </label>
            <label className="field-label">
              Standard-Klassifikation
              <select
                value={policyDraft.defaultClassification}
                onChange={(event) => setPolicyDraft((current) => ({ ...current, defaultClassification: event.target.value as TenantPolicy['defaultClassification'] }))}
              >
                <option value="öffentlich">öffentlich</option>
                <option value="intern">intern</option>
                <option value="vertraulich">vertraulich</option>
                <option value="streng_vertraulich">streng vertraulich</option>
              </select>
            </label>
            <label className="field-label">
Readiness-Prüfstelle
              <input
                type="text"
                value={policyDraft.certificationAuthorityLabel}
                onChange={(event) => setPolicyDraft((current) => ({ ...current, certificationAuthorityLabel: event.target.value }))}
              />
            </label>
            <label className="field-label wide">
              Incident-Mailbox / Kontakt
              <input
                type="text"
                value={policyDraft.incidentMailbox}
                onChange={(event) => setPolicyDraft((current) => ({ ...current, incidentMailbox: event.target.value }))}
                placeholder="z. B. kritis-meldung@unternehmen.de"
              />
            </label>
          </div>

          <label className="checkbox-row top-gap">
            <input
              type="checkbox"
              checked={policyDraft.exportApprovalRequired}
              onChange={(event) => setPolicyDraft((current) => ({ ...current, exportApprovalRequired: event.target.checked }))}
            />
            <span>Berichtspakete sollen vor offizieller Verwendung freigegeben werden.</span>
          </label>
          <label className="checkbox-row top-gap">
            <input
              type="checkbox"
              checked={policyDraft.requireReleaseForCertification}
              onChange={(event) => setPolicyDraft((current) => ({ ...current, requireReleaseForCertification: event.target.checked }))}
            />
            <span>Readiness-Dossiers sollen nur nach formaler Freigabe als final gelten.</span>
          </label>

          <div className="inline-actions top-gap">
            <button
              type="button"
              className="button primary"
              onClick={() => onUpdateTenantPolicy(policyDraft)}
              disabled={!hasWorkspaceAccess || serverMode === 'offline' || serverMode === 'checking' || serverMode === 'auth_required'}
            >
              <ShieldCheck size={16} />
              Richtlinien speichern
            </button>
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Exportregister</p>
              <h3>Revisionssichere Pakete und Freigaben</h3>
            </div>
            <div className="inline-note">
              <Fingerprint size={16} />
              <span>{recentExports.length} Einträge sichtbar</span>
            </div>
          </div>

          <div className="work-list top-gap">
            {recentExports.length ? recentExports.map((entry) => (
              <article key={entry.id} className="work-card compact-card">
                <div className="work-card-head">
                  <div>
                    <strong>{entry.title}</strong>
                    <p className="muted small">{formatDateTime(entry.createdAt)} · {entry.type} · {entry.userName}</p>
                  </div>
                  <span className={`chip ${entry.releaseStatus === 'released' ? 'success' : 'outline'}`}>
                    {entry.releaseStatus === 'released' ? 'freigegeben' : 'Entwurf'}
                  </span>
                </div>
                <div className="chip-row top-gap">
                  <span className="chip outline">SHA-256: {checksumPreview(entry.checksumSha256)}</span>
                  <span className="chip outline">{Math.round(entry.sizeKb)} KB</span>
                  {entry.signOffRole ? <span className="chip outline">{entry.signOffRole}</span> : null}
                </div>
                {entry.note ? <p className="muted top-gap">{entry.note}</p> : null}
                <div className="form-grid two-column top-gap">
                  <label className="field-label wide">
                    Freigabenotiz
                    <input
                      type="text"
                      value={exportReleaseNotes[entry.id] ?? ''}
                      onChange={(event) => setExportReleaseNotes((current) => ({ ...current, [entry.id]: event.target.value }))}
                      placeholder="z. B. für Managementreview freigegeben"
                    />
                  </label>
                </div>
                <div className="inline-actions top-gap">
                  <button type="button" className="button secondary" onClick={() => onDownloadExportPackage(entry)}>
                    <HardDriveUpload size={16} />
                    Paket laden
                  </button>
                  {entry.releaseStatus !== 'released' ? (
                    <button type="button" className="button tertiary" onClick={() => onReleaseExportPackage(entry.id, exportReleaseNotes[entry.id] ?? '')}>
                      <ShieldCheck size={16} />
                      Freigeben
                    </button>
                  ) : null}
                </div>
              </article>
            )) : <p className="muted">Noch keine registrierten Exportpakete vorhanden.</p>}
          </div>
        </article>
      </section>

      <section className="content-grid two-column">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Mandantenkatalog</p>
              <h3>Verfügbare Arbeitsräume</h3>
            </div>
            <div className="inline-note">
              <Database size={16} />
              <span>{availableTenants.length} Arbeitsbereiche erkannt</span>
            </div>
          </div>

          <div className="work-list top-gap">
            {availableTenants.map((tenant) => (
              <article key={tenant.id} className="work-card compact-card">
                <div className="work-card-head">
                  <div>
                    <strong>{tenant.name}</strong>
                    <p className="muted small">{tenant.companyName || tenant.industryLabel || tenant.slug}</p>
                  </div>
                  {authSession?.tenantId === tenant.id ? <span className="chip success">aktiv</span> : !authSession && publicTenant?.id === tenant.id ? <span className="chip success">offen</span> : <span className="chip outline">bereit</span>}
                </div>
                <div className="chip-row top-gap">
                  <span className="chip outline">{tenant.userCount} Nutzer</span>
                  <span className="chip outline">{tenant.evidenceCount} Evidenzen</span>
                  <span className="chip outline">{tenant.versionCount} Versionen</span>
                  <span className="chip outline">Aktualisiert: {tenant.updatedAt ? formatDateTime(tenant.updatedAt) : '–'}</span>
                </div>
              </article>
            ))}
          </div>

          {authSession?.isSystemAdmin ? (
            <div className="top-gap">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Neuer Mandant</p>
                  <h3>Mandantenanlage</h3>
                </div>
              </div>
              <div className="form-grid two-column top-gap">
                <label className="field-label wide">
                  Mandantenname
                  <input type="text" value={tenantName} onChange={(event) => setTenantName(event.target.value)} />
                </label>
                <label className="field-label">
                  Slug / Kürzel
                  <input type="text" value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} placeholder="optional" />
                </label>
                <label className="field-label">
                  Branche
                  <input type="text" value={tenantIndustry} onChange={(event) => setTenantIndustry(event.target.value)} />
                </label>
                <label className="field-label">
                  Mandantenadmin
                  <input type="text" value={tenantAdminName} onChange={(event) => setTenantAdminName(event.target.value)} />
                </label>
                <label className="field-label">
                  Admin-E-Mail
                  <input type="email" value={tenantAdminEmail} onChange={(event) => setTenantAdminEmail(event.target.value)} />
                </label>
                <label className="field-label">
                  Initialpasswort
                  <input type="password" value={tenantAdminPassword} onChange={(event) => setTenantAdminPassword(event.target.value)} />
                </label>
              </div>
              <div className="inline-actions top-gap">
                <button
                  type="button"
                  className="button primary"
                  onClick={() => onCreateTenant({
                    name: tenantName,
                    slug: tenantSlug,
                    industryLabel: tenantIndustry,
                    adminName: tenantAdminName,
                    adminEmail: tenantAdminEmail,
                    adminPassword: tenantAdminPassword,
                  })}
                >
                  <Database size={16} />
                  Mandant anlegen
                </button>
              </div>
            </div>
          ) : null}
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Zugriffskonten</p>
              <h3>Serverseitige Logins je Mandant</h3>
            </div>
            <div className="inline-note">
              <KeyRound size={16} />
              <span>{accessAccounts.length} Konten sichtbar</span>
            </div>
          </div>

          {!authSession && !serverAuthRequired ? (
            <div className="feedback-box success top-gap">
              <strong>Kontoverwaltung ist optional</strong>
              <p className="top-gap">
                Zugriffskonten werden nur nach Anmeldung geladen. Der operative Arbeitsbereich kann dennoch ohne Login genutzt werden.
              </p>
            </div>
          ) : null}

          <div className="work-list top-gap">
            {accessAccounts.length ? accessAccounts.map((account) => (
              <article key={account.id} className="work-card compact-card">
                <div className="work-card-head">
                  <div>
                    <strong>{account.name}</strong>
                    <p className="muted small">{account.email}</p>
                  </div>
                  <span className={`chip ${account.status === 'active' ? 'success' : account.status === 'invited' ? 'warn' : 'danger'}`}>
                    {account.status}
                  </span>
                </div>
                <div className="chip-row top-gap">
                  {account.isSystemAdmin ? <span className="chip outline">Systemadmin</span> : null}
                  <span className="chip outline">Auth: {account.authSource}</span>
                  {account.lastAuthProvider ? <span className="chip outline">Letzter Provider: {account.lastAuthProvider}</span> : null}
                  {account.memberships.map((membership) => (
                    <span key={`${account.id}-${membership.tenantId}`} className="chip outline">
                      {membership.tenantName}: {membership.roleProfile}
                    </span>
                  ))}
                </div>
                {account.identities.length ? (
                  <div className="mini-list top-gap">
                    {account.identities.map((identity) => (
                      <div key={`${account.id}-${identity.providerId}-${identity.subject}`} className="mini-list-row">
                        <span>{identity.providerId} · {identity.subject}</span>
                        <strong>{identity.email || identity.issuer || 'ohne Profilhinweis'}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="form-grid two-column top-gap">
                  <label className="field-label wide">
                    Passwort neu setzen
                    <input
                      type="password"
                      value={passwordResetMap[account.id] ?? ''}
                      onChange={(event) => setPasswordResetMap((current) => ({ ...current, [account.id]: event.target.value }))}
                      placeholder="Neues Passwort"
                    />
                  </label>
                  <div className="inline-actions align-end">
                    <button
                      type="button"
                      className="button tertiary"
                      onClick={() => onResetAccessAccountPassword(account.id, passwordResetMap[account.id] ?? '')}
                    >
                      <KeyRound size={16} />
                      Passwort setzen
                    </button>
                  </div>
                </div>
              </article>
            )) : (
              <p className="muted">Noch keine serverseitigen Zugriffskonten sichtbar.</p>
            )}
          </div>

          {hasWorkspaceAccess ? (
            <div className="top-gap">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Konto anlegen</p>
                  <h3>Login aus Nutzerprofil ableiten</h3>
                </div>
                <div className="inline-note">
                  <Users2 size={16} />
                  <span>Die Zuordnung bleibt mandantenspezifisch.</span>
                </div>
              </div>
              <div className="form-grid two-column top-gap">
                <label className="field-label wide">
                  Aus Nutzerprofil
                  <select value={selectedWorkspaceUserId} onChange={(event) => handleWorkspaceUserSelection(event.target.value)}>
                    <option value="">Manuell</option>
                    {workspaceUserOptions.map((user) => (
                      <option key={user.id} value={user.id}>{user.label}</option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Rolle
                  <select value={accountRole} onChange={(event) => setAccountRole(event.target.value as UserRoleProfile)}>
                    <option value="admin">Admin</option>
                    <option value="lead">Leitung</option>
                    <option value="editor">Bearbeitung</option>
                    <option value="reviewer">Review</option>
                    <option value="auditor">Audit</option>
                    <option value="viewer">Leser</option>
                  </select>
                </label>
                <label className="field-label">
                  Authentifizierung
                  <select value={accountAuthSource} onChange={(event) => setAccountAuthSource(event.target.value as 'local' | 'oidc' | 'hybrid')}>
                    <option value="local">Lokal</option>
                    <option value="oidc">Nur SSO / OIDC</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </label>
                <label className="field-label">
                  Name
                  <input type="text" value={accountName} onChange={(event) => setAccountName(event.target.value)} />
                </label>
                <label className="field-label">
                  E-Mail
                  <input type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} />
                </label>
                <label className="field-label">
                  Initialpasswort
                  <input type="password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} placeholder={accountAuthSource === 'oidc' ? 'Optional, falls Hybrid gewünscht' : ''} />
                </label>
                <label className="field-label">
                  Scope
                  <input type="text" value={accountScope} onChange={(event) => setAccountScope(event.target.value)} placeholder={authSession?.tenantName || 'Mandant'} />
                </label>
              </div>
              <div className="inline-actions top-gap">
                <button
                  type="button"
                  className="button primary"
                  onClick={() => onCreateAccessAccount({
                    name: accountName,
                    email: accountEmail,
                    password: accountPassword,
                    roleProfile: accountRole,
                    authSource: accountAuthSource,
                    scope: accountScope,
                    workspaceUserId: selectedWorkspaceUserId || undefined,
                    status: 'active',
                  })}
                >
                  <KeyRound size={16} />
                  Zugriffskonto speichern
                </button>
              </div>
            </div>
          ) : null}
        </article>
      </section>

      <section className="content-grid two-column">
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
                disabled={!hasWorkspaceAccess || serverMode === 'offline' || serverMode === 'checking' || serverMode === 'auth_required'}
              />
            </label>
            <label className="field-label wide">
              Kommentar
              <textarea
                rows={3}
                placeholder="z. B. Management-Review freigegeben, Nachweisstand eingefroren"
                value={snapshotComment}
                onChange={(event) => setSnapshotComment(event.target.value)}
                disabled={!hasWorkspaceAccess || serverMode === 'offline' || serverMode === 'checking' || serverMode === 'auth_required'}
              />
            </label>
          </div>
          <div className="inline-actions top-gap">
            <button
              type="button"
              className="button primary"
              onClick={() => {
                onCreateSnapshot(snapshotName, snapshotComment);
                setSnapshotName('');
                setSnapshotComment('');
              }}
              disabled={!snapshotName.trim() || !hasWorkspaceAccess || serverMode === 'offline' || serverMode === 'checking' || serverMode === 'auth_required'}
            >
              <Save size={16} />
              Snapshot erzeugen
            </button>
          </div>

          <div className="work-list top-gap">
            {snapshots.length ? snapshots.map((snapshot) => (
              <article key={snapshot.id} className="work-card compact-card">
                <div className="work-card-head">
                  <div>
                    <strong>{snapshot.name}</strong>
                    <p className="muted small">{formatDateTime(snapshot.createdAt)} · {snapshot.userName}</p>
                  </div>
                  <button type="button" className="button tertiary" onClick={() => onRestoreSnapshot(snapshot.id)}>
                    <RotateCcw size={16} />
                    Wiederherstellen
                  </button>
                </div>
                {snapshot.comment ? <p className="muted top-gap">{snapshot.comment}</p> : null}
              </article>
            )) : (
              <p className="muted">Noch keine Snapshots vorhanden.</p>
            )}
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Dokumentenledger</p>
              <h3>Versionen, Checksummen und letzte Aktivitäten</h3>
            </div>
            <div className="inline-note">
              <ShieldCheck size={16} />
              <span>Unveränderte Historie je Evidenz</span>
            </div>
          </div>

          <div className="mini-list top-gap">
            <div className="mini-list-row"><span>Letzte Aktivität</span><strong>{formatDateTime(documentLedger?.latestActivityAt ?? '')}</strong></div>
            <div className="mini-list-row"><span>Versionen gesamt</span><strong>{documentLedger?.totalVersions ?? 0}</strong></div>
            <div className="mini-list-row"><span>Evidenzen mit Historie</span><strong>{documentLedger?.evidenceWithHistory ?? 0}</strong></div>
            <div className="mini-list-row"><span>Aktive Dateireferenzen</span><strong>{documentLedger?.currentAttachments ?? 0}</strong></div>
          </div>

          <div className="work-list top-gap">
            {documentLedger?.recentEntries?.length ? documentLedger.recentEntries.map((entry) => (
              <article key={entry.id} className="work-card compact-card">
                <div className="work-card-head">
                  <div>
                    <strong>{entry.fileName}</strong>
                    <p className="muted small">{formatDateTime(entry.uploadedAt)} · {entry.uploadedBy}</p>
                  </div>
                  <span className={`chip ${entry.current ? 'success' : 'outline'}`}>{entry.current ? 'aktiv' : 'historisch'}</span>
                </div>
                <div className="chip-row top-gap">
                  {entry.versionLabel ? <span className="chip outline">Version {entry.versionLabel}</span> : null}
                  <span className="chip outline">{entry.classification}</span>
                  <span className="chip outline">SHA-256: {checksumPreview(entry.checksumSha256)}</span>
                  <span className="chip outline">{Math.round(entry.sizeKb)} KB</span>
                </div>
              </article>
            )) : (
              <p className="muted">Noch keine serverseitigen Dokumentversionen vorhanden.</p>
            )}
          </div>
        </article>
      </section>

      <article className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Audit-Log</p>
            <h3>Letzte serverseitige Aktivitäten</h3>
          </div>
          <div className="inline-note">
            <Clock3 size={16} />
            <span>{auditLog.length} Einträge</span>
          </div>
        </div>

        <div className="work-list top-gap">
          {auditLog.length ? auditLog.slice(0, 14).map((entry) => (
            <article key={entry.id} className="work-card compact-card">
              <div className="work-card-head">
                <div>
                  <strong>{entry.action}</strong>
                  <p className="muted small">{formatDateTime(entry.at)} · {entry.userName}</p>
                </div>
                <span className="chip outline">{entry.resource}</span>
              </div>
              <p className="top-gap">{entry.summary}</p>
              {entry.sections?.length ? (
                <div className="chip-row top-gap">
                  {entry.sections.map((section) => (
                    <span key={`${entry.id}-${section}`} className="chip outline">{section}</span>
                  ))}
                </div>
              ) : null}
            </article>
          )) : (
            <p className="muted">Noch keine Audit-Einträge vorhanden.</p>
          )}
        </div>
      </article>
    </div>
  );
}
