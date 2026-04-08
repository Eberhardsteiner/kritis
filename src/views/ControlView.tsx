import {
  BellRing,
  CalendarClock,
  FolderArchive,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  Users2,
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { UserCard } from '../components/UserCard';
import { accessProfiles, permissionLabels } from '../data/workspaceBase';
import type {
  AccessProfileDefinition,
  ComplianceCalendar,
  DeadlineItem,
  DeadlineSummary,
  DocumentLibrarySummary,
  UserItem,
} from '../types';

interface ControlViewProps {
  users: UserItem[];
  activeUserId: string;
  activeAccessProfile: AccessProfileDefinition;
  documentLibrarySummary: DocumentLibrarySummary;
  deadlineSummary: DeadlineSummary;
  complianceCalendar: ComplianceCalendar;
  onSelectActiveUser: (userId: string) => void;
  userSelectionLocked?: boolean;
  onCreateUser: () => void;
  onGenerateUsersFromStakeholders: () => void;
  onUpdateUser: (userId: string, patch: Partial<UserItem>) => void;
  onDeleteUser: (userId: string) => void;
  onUpdateComplianceCalendar: (field: keyof ComplianceCalendar, value: string) => void;
}

function getDeadlineTone(item: DeadlineItem): 'alert' | 'warn' | 'good' | 'default' {
  if (item.status === 'overdue' || item.status === 'open') {
    return 'alert';
  }
  if (item.status === 'soon') {
    return 'warn';
  }
  if (item.category === 'regulatorisch') {
    return 'good';
  }
  return 'default';
}

function getDeadlineLabel(item: DeadlineItem): string {
  if (item.status === 'open') {
    return 'Basisdatum offen';
  }
  if (item.status === 'overdue') {
    return 'überfällig';
  }
  if (item.status === 'soon') {
    return 'fällig ≤ 30 Tage';
  }
  return 'geplant';
}

export function ControlView({
  users,
  activeUserId,
  activeAccessProfile,
  documentLibrarySummary,
  deadlineSummary,
  complianceCalendar,
  onSelectActiveUser,
  onCreateUser,
  onGenerateUsersFromStakeholders,
  onUpdateUser,
  onDeleteUser,
  onUpdateComplianceCalendar,
  userSelectionLocked = false,
}: ControlViewProps) {
  const activeUser = users.find((user) => user.id === activeUserId) ?? users[0];

  return (
    <div className="view-stack">
      <section className="hero card">
        <div>
          <p className="eyebrow">Steuerung & Rechte</p>
          <h2>Arbeitsmodell, Fristen-Cockpit und Dokumentensteuerung</h2>
          <p className="hero-text">
            Dieser Bereich bündelt Rollenmodell, Nutzerprofile, regulatorische Fristen und die
            Dokumentenbibliothek in einem eigenen Steuerungsbereich. KRITIS-Dachgesetz und
            BSIG / NIS2 werden dabei mit getrennten Basisdaten, Fristen und Meldekontakten geführt.
          </p>
          <div className="chip-row top-gap">
            <span className="chip outline">Aktives Profil: {activeAccessProfile.label}</span>
            <span className="chip outline">{activeAccessProfile.permissions.length} Rechte</span>
            <span className="chip outline">{users.length} Nutzer</span>
          </div>
        </div>
        <div className="hero-actions">
          <label className="field-label compact-label min-width-280">
            Aktiver Benutzer in der Vorschau
            <select
              value={activeUserId}
              onChange={(event) => onSelectActiveUser(event.target.value)}
              disabled={userSelectionLocked}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {(user.name || 'Unbenannter Nutzer')} · {user.email || user.roleProfile}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-note">
            <ShieldCheck size={16} />
            <span>
              {userSelectionLocked
                ? 'Bei aktiver Serversitzung wird das Arbeitsprofil durch die Anmeldung festgelegt.'
                : activeUser
                  ? `${activeUser.name || 'Nutzer'} arbeitet im Profil ${activeAccessProfile.label}.`
                  : 'Nutzerprofil auswählen'}
            </span>
          </div>
        </div>
      </section>

      <section className="stats-grid phase-three">
        <StatCard
          title="Nutzer aktiv"
          value={`${users.filter((user) => user.status === 'active').length}`}
          subtitle={`${users.length} Profile insgesamt`}
          tone="default"
        />
        <StatCard
          title="Fristen kritisch"
          value={`${deadlineSummary.overdue}`}
          subtitle={deadlineSummary.regulatory ? `${deadlineSummary.regulatory} regulatorische Termine` : 'Keine regulatorischen Termine erkannt'}
          tone={deadlineSummary.overdue ? 'alert' : 'good'}
        />
        <StatCard
          title="Fristen ≤ 30 Tage"
          value={`${deadlineSummary.dueSoon}`}
          subtitle="Review, Dokumente und Maßnahmen"
          tone={deadlineSummary.dueSoon ? 'warn' : 'good'}
        />
        <StatCard
          title="Dokumentenreviews"
          value={`${documentLibrarySummary.dueReviews}`}
          subtitle={documentLibrarySummary.expired ? `${documentLibrarySummary.expired} Dokumente abgelaufen` : 'Keine abgelaufenen Dokumente'}
          tone={documentLibrarySummary.expired ? 'alert' : documentLibrarySummary.dueReviews ? 'warn' : 'good'}
        />
        <StatCard
          title="Anhänge lokal"
          value={`${documentLibrarySummary.attachedFiles}`}
          subtitle={`${documentLibrarySummary.total} Registereinträge`}
          tone="default"
        />
        <StatCard
          title="Ordner offen"
          value={`${documentLibrarySummary.missingFolder}`}
          subtitle="Dokumente ohne Bibliothekszuordnung"
          tone={documentLibrarySummary.missingFolder ? 'warn' : 'good'}
        />
      </section>

      <section className="content-grid two-column">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Arbeitsmodell</p>
              <h3>Nutzerprofile und Zuständigkeiten</h3>
            </div>
            <div className="inline-actions">
              <button type="button" className="button secondary" onClick={onGenerateUsersFromStakeholders}>
                <Sparkles size={16} />
                Aus Stakeholdern erzeugen
              </button>
              <button type="button" className="button primary" onClick={onCreateUser}>
                <PlusCircle size={16} />
                Nutzer anlegen
              </button>
            </div>
          </div>

          <div className="summary-strip bottom-gap">
            <span>{users.filter((user) => user.status === 'active').length} aktiv</span>
            <span>{users.filter((user) => user.status === 'invited').length} eingeladen</span>
            <span>{users.filter((user) => user.roleProfile === 'lead' || user.roleProfile === 'admin').length} Steuerungsrollen</span>
          </div>

          <div className="work-list">
            {users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                onUpdate={onUpdateUser}
                onDelete={onDeleteUser}
              />
            ))}
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Rechtematrix</p>
              <h3>Profile und Berechtigungen</h3>
            </div>
            <div className="chip-row">
              <span className="chip outline">{activeAccessProfile.label} aktiv</span>
            </div>
          </div>

          <div className="permission-matrix top-gap">
            <div className="permission-row header">
              <span>Berechtigung</span>
              {accessProfiles.map((profile) => (
                <strong key={profile.id} className={profile.id === activeAccessProfile.id ? 'active-profile' : ''}>
                  {profile.label}
                </strong>
              ))}
            </div>

            {Object.entries(permissionLabels).map(([permission, label]) => (
              <div key={permission} className="permission-row">
                <span>{label}</span>
                {accessProfiles.map((profile) => (
                  <span key={profile.id} className={`permission-badge ${profile.permissions.includes(permission as keyof typeof permissionLabels) ? 'granted' : 'denied'} ${profile.id === activeAccessProfile.id ? 'active-profile' : ''}`}>
                    {profile.permissions.includes(permission as keyof typeof permissionLabels) ? 'Ja' : '–'}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="content-grid two-column">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Compliance-Kalender</p>
              <h3>Regulatorische Basisdaten für Deutschland</h3>
            </div>
            <div className="inline-note">
              <BellRing size={16} />
              <span>Aus diesen Daten wird das Fristen-Cockpit automatisch abgeleitet.</span>
            </div>
          </div>

          <div className="form-grid two-column top-gap">
            <label className="field-label">
              Registrierung dokumentiert am
              <input
                type="date"
                value={complianceCalendar.registrationDate}
                onChange={(event) => onUpdateComplianceCalendar('registrationDate', event.target.value)}
              />
            </label>
            <label className="field-label">
              Letzte Betreiber-Risikoanalyse
              <input
                type="date"
                value={complianceCalendar.lastRiskAssessmentDate}
                onChange={(event) => onUpdateComplianceCalendar('lastRiskAssessmentDate', event.target.value)}
              />
            </label>
            <label className="field-label">
              Letzte Planaktualisierung
              <input
                type="date"
                value={complianceCalendar.lastResiliencePlanUpdate}
                onChange={(event) => onUpdateComplianceCalendar('lastResiliencePlanUpdate', event.target.value)}
              />
            </label>
            <label className="field-label">
              Letzter IT-/OT-Nachweis
              <input
                type="date"
                value={complianceCalendar.lastBsiEvidenceAuditDate}
                onChange={(event) => onUpdateComplianceCalendar('lastBsiEvidenceAuditDate', event.target.value)}
              />
            </label>
            <label className="field-label">
              BSIG / NIS2 Registrierung dokumentiert am
              <input
                type="date"
                value={complianceCalendar.bsigRegistrationDate}
                onChange={(event) => onUpdateComplianceCalendar('bsigRegistrationDate', event.target.value)}
              />
            </label>
            <label className="field-label">
              Letzte Cyber-Risikobewertung
              <input
                type="date"
                value={complianceCalendar.lastCyberRiskAssessmentDate}
                onChange={(event) => onUpdateComplianceCalendar('lastCyberRiskAssessmentDate', event.target.value)}
              />
            </label>
            <label className="field-label">
              Letzte Vorfallübung / Meldetest
              <input
                type="date"
                value={complianceCalendar.lastIncidentExerciseDate}
                onChange={(event) => onUpdateComplianceCalendar('lastIncidentExerciseDate', event.target.value)}
              />
            </label>
            <label className="field-label">
              Primärer Vorfallkontakt
              <input
                type="text"
                value={complianceCalendar.incidentContact}
                placeholder="z. B. ciso@unternehmen.de"
                onChange={(event) => onUpdateComplianceCalendar('incidentContact', event.target.value)}
              />
            </label>
            <label className="field-label">
              Stellvertretung Vorfallkontakt
              <input
                type="text"
                value={complianceCalendar.incidentBackupContact}
                placeholder="z. B. bcm@unternehmen.de"
                onChange={(event) => onUpdateComplianceCalendar('incidentBackupContact', event.target.value)}
              />
            </label>
          </div>

          <div className="chip-row top-gap">
            <span className="chip outline">Regulatorische Termine: {deadlineSummary.regulatory}</span>
            <span className="chip outline">Dokumente: {documentLibrarySummary.total}</span>
            <span className="chip outline">Ordner: {documentLibrarySummary.byFolder.length}</span>
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Dokumentenbibliothek</p>
              <h3>Ordnerstruktur und Reviewdruck</h3>
            </div>
            <div className="inline-note">
              <FolderArchive size={16} />
              <span>Die Bibliothek basiert auf dem Evidenzregister im Arbeitsbereich.</span>
            </div>
          </div>

          <div className="mini-list top-gap">
            <div className="mini-list-row"><span>Registereinträge</span><strong>{documentLibrarySummary.total}</strong></div>
            <div className="mini-list-row"><span>Reviews fällig</span><strong>{documentLibrarySummary.dueReviews}</strong></div>
            <div className="mini-list-row"><span>Abgelaufen</span><strong>{documentLibrarySummary.expired}</strong></div>
            <div className="mini-list-row"><span>Ablauf ≤ 30 Tage</span><strong>{documentLibrarySummary.expiringSoon}</strong></div>
            <div className="mini-list-row"><span>Anhänge</span><strong>{documentLibrarySummary.attachedFiles}</strong></div>
            <div className="mini-list-row"><span>Ohne Ordner</span><strong>{documentLibrarySummary.missingFolder}</strong></div>
          </div>

          <div className="folder-shelf top-gap">
            {documentLibrarySummary.byFolder.length ? documentLibrarySummary.byFolder.map((entry) => (
              <div key={entry.folder} className="folder-pill">
                <FolderArchive size={14} />
                <span>{entry.folder}</span>
                <strong>{entry.count}</strong>
              </div>
            )) : (
              <p className="muted">Noch keine Dokumente im Register.</p>
            )}
          </div>
        </article>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Fristen-Cockpit</p>
            <h3>Nächste Termine und kritische Punkte</h3>
          </div>
          <div className="chip-row">
            <span className="chip outline">{deadlineSummary.total} erkannte Termine</span>
            <span className={`chip ${deadlineSummary.overdue ? 'danger' : deadlineSummary.dueSoon ? 'warn' : 'success'}`}>
              {deadlineSummary.overdue ? 'kritisch' : deadlineSummary.dueSoon ? 'beobachten' : 'stabil'}
            </span>
          </div>
        </div>

        <div className="deadline-grid top-gap">
          {deadlineSummary.nextItems.length ? deadlineSummary.nextItems.map((item) => (
            <article key={item.id} className="deadline-card">
              <div className="deadline-card-head">
                <div>
                  <div className="question-title-row">
                    <strong>{item.title}</strong>
                    <span className={`chip ${getDeadlineTone(item)}`}>{getDeadlineLabel(item)}</span>
                  </div>
                  <p className="muted small">{item.sourceLabel}</p>
                </div>
                <div className="deadline-date">
                  <CalendarClock size={16} />
                  <span>{item.dueDate || 'Basisdatum offen'}</span>
                </div>
              </div>
              <p>{item.description}</p>
              <div className="chip-row top-gap">
                <span className="chip outline">{item.category}</span>
                <span className="chip outline">{item.owner || 'Verantwortung offen'}</span>
              </div>
            </article>
          )) : (
            <div className="empty-state panel-empty">
              <Users2 size={20} />
              <div>
                <strong>Noch keine Fristen ableitbar</strong>
                <p>Pflegen Sie Reviewdaten, Dokumente und Compliance-Basisdaten, damit das Cockpit belastbar wird.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
