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
import { StatCard } from '../components/StatCard';
import type {
  AccessAccountSummary,
  AccessProfileDefinition,
  AuditLogEntry,
  AuthSession,
  DocumentLedgerSummaryServer,
  ServerHealth,
  SnapshotInfo,
  TenantSummary,
  UserItem,
  UserRoleProfile,
} from '../types';

interface PlatformViewProps {
  serverMode: 'checking' | 'connected' | 'syncing' | 'offline' | 'error' | 'auth_required';
  serverHealth: ServerHealth | null;
  activeUser: UserItem | null;
  activeAccessProfile: AccessProfileDefinition;
  authSession: AuthSession | null;
  availableTenants: TenantSummary[];
  accessAccounts: AccessAccountSummary[];
  documentLedger: DocumentLedgerSummaryServer | null;
  defaultPasswordHint: string;
  users: UserItem[];
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
  onLogin: (email: string, password: string, tenantId: string) => void;
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
    status?: 'active' | 'invited' | 'inactive';
    scope?: string;
    workspaceUserId?: string;
  }) => void;
  onResetAccessAccountPassword: (accountId: string, password: string) => void;
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
  availableTenants,
  accessAccounts,
  documentLedger,
  defaultPasswordHint,
  users,
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
  onLogin,
  onLogout,
  onCreateTenant,
  onCreateAccessAccount,
  onResetAccessAccountPassword,
}: PlatformViewProps) {
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotComment, setSnapshotComment] = useState('');
  const [loginEmail, setLoginEmail] = useState(authSession?.email || 'admin@krisenfest.local');
  const [loginPassword, setLoginPassword] = useState(defaultPasswordHint || '');
  const [loginTenantId, setLoginTenantId] = useState(authSession?.tenantId || availableTenants[0]?.id || '');

  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantIndustry, setTenantIndustry] = useState('');
  const [tenantAdminName, setTenantAdminName] = useState('');
  const [tenantAdminEmail, setTenantAdminEmail] = useState('');
  const [tenantAdminPassword, setTenantAdminPassword] = useState(defaultPasswordHint || '');

  const [selectedWorkspaceUserId, setSelectedWorkspaceUserId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState(defaultPasswordHint || '');
  const [accountRole, setAccountRole] = useState<UserRoleProfile>('editor');
  const [accountScope, setAccountScope] = useState('');
  const [passwordResetMap, setPasswordResetMap] = useState<Record<string, string>>({});

  const serverTone = serverMode === 'connected'
    ? 'good'
    : serverMode === 'syncing'
      ? 'warn'
      : serverMode === 'error' || serverMode === 'offline'
        ? 'alert'
        : 'default';

  const currentTenant = useMemo(
    () => availableTenants.find((tenant) => tenant.id === authSession?.tenantId) ?? null,
    [availableTenants, authSession],
  );

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
    if (!authSession && defaultPasswordHint && !loginPassword) {
      setLoginPassword(defaultPasswordHint);
    }
    if (defaultPasswordHint && !tenantAdminPassword) {
      setTenantAdminPassword(defaultPasswordHint);
    }
    if (defaultPasswordHint && !accountPassword) {
      setAccountPassword(defaultPasswordHint);
    }
  }, [authSession, defaultPasswordHint, loginPassword, tenantAdminPassword, accountPassword]);

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
          <p className="eyebrow">Plattform, Mandanten & Zugriff</p>
          <h2>Mehrmandantenbetrieb, Anmeldung und versionierte Dokumentenablage</h2>
          <p className="hero-text">
            Phase 6 erweitert den Monitor um echte Serveranmeldung, Mandantentrennung,
            Zugriffskonten und eine revisionsfähige Dokumentenhistorie mit Checksummen.
          </p>
          <div className="chip-row top-gap">
            <span className="chip outline">{describeMode(serverMode)}</span>
            <span className="chip outline">Arbeitsprofil: {activeAccessProfile.label}</span>
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
          value={serverHealth?.mode === 'tenant-filesystem' ? 'Mandanten-Storage' : '–'}
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
              <h3>Anmeldung und Serversitzung</h3>
            </div>
            <div className="inline-note">
              <Fingerprint size={16} />
              <span>{authSession ? 'Sitzung aktiv' : 'Servermodus mit Login'}</span>
            </div>
          </div>

          {!authSession ? (
            <div className="form-grid two-column top-gap">
              <label className="field-label wide">
                E-Mail
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder="admin@krisenfest.local"
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
              <label className="field-label">
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
              <div className="inline-actions align-end">
                <button
                  type="button"
                  className="button primary"
                  onClick={() => onLogin(loginEmail, loginPassword, loginTenantId)}
                  disabled={serverMode === 'offline' || serverMode === 'checking' || !availableTenants.length || !loginTenantId}
                >
                  <LockKeyhole size={16} />
                  Anmelden
                </button>
              </div>
              <div className="feedback-box success wide top-gap">
                <strong>Demo-Zugang für Bolt</strong>
                <p className="top-gap">
                  Standardkonto: <code>admin@krisenfest.local</code>. Standardpasswort: <code>{defaultPasswordHint || 'Krisenfest2026!'}</code>.
                </p>
              </div>
            </div>
          ) : (
            <div className="mini-list top-gap">
              <div className="mini-list-row"><span>Angemeldet als</span><strong>{authSession.name} · {authSession.email}</strong></div>
              <div className="mini-list-row"><span>Mandant</span><strong>{authSession.tenantName}</strong></div>
              <div className="mini-list-row"><span>Serverrolle</span><strong>{activeAccessProfile.label}</strong></div>
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
              Änderungen automatisch an den Server übertragen. Ohne aktive Serversitzung bleibt die lokale
              Browser-Speicherung als Fallback aktiv.
            </span>
          </label>

          {syncError ? (
            <div className="feedback-box error top-gap">
              <strong>Letzter Hinweis</strong>
              <p className="top-gap">{syncError}</p>
            </div>
          ) : (
            <div className="feedback-box success top-gap">
              <strong>Mandantenmodus aktiv</strong>
              <p className="top-gap">
                Der Server trennt Arbeitsstände mandantenweise und prüft Schreibrechte anhand der
                angemeldeten Rolle, nicht nur anhand der Frontend-Auswahl.
              </p>
            </div>
          )}
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
              <span>{availableTenants.length} Mandanten erkannt</span>
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
                  {authSession?.tenantId === tenant.id ? <span className="chip success">aktiv</span> : <span className="chip outline">bereit</span>}
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
                  {account.memberships.map((membership) => (
                    <span key={`${account.id}-${membership.tenantId}`} className="chip outline">
                      {membership.tenantName}: {membership.roleProfile}
                    </span>
                  ))}
                </div>
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
                  Name
                  <input type="text" value={accountName} onChange={(event) => setAccountName(event.target.value)} />
                </label>
                <label className="field-label">
                  E-Mail
                  <input type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} />
                </label>
                <label className="field-label">
                  Initialpasswort
                  <input type="password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} />
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
