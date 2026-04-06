import { Mail, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import type {
  UserItem,
  UserRoleProfile,
  UserStatus,
} from '../types';

interface UserCardProps {
  user: UserItem;
  onUpdate: (userId: string, patch: Partial<UserItem>) => void;
  onDelete: (userId: string) => void;
}

const roleOptions: Array<{ value: UserRoleProfile; label: string }> = [
  { value: 'admin', label: 'Programmadmin' },
  { value: 'lead', label: 'Programmleitung' },
  { value: 'editor', label: 'Fachbearbeitung' },
  { value: 'reviewer', label: 'Review / Freigabe' },
  { value: 'auditor', label: 'Audit / Prüfung' },
  { value: 'viewer', label: 'Leser' },
];

const statusOptions: Array<{ value: UserStatus; label: string }> = [
  { value: 'active', label: 'Aktiv' },
  { value: 'invited', label: 'Eingeladen' },
  { value: 'inactive', label: 'Inaktiv' },
];

export function UserCard({ user, onUpdate, onDelete }: UserCardProps) {
  const roleTone =
    user.roleProfile === 'admin'
      ? 'danger'
      : user.roleProfile === 'lead'
        ? 'warn'
        : user.roleProfile === 'reviewer'
          ? 'success'
          : 'outline';

  return (
    <article className="work-card">
      <div className="work-card-head">
        <div>
          <div className="question-title-row">
            <strong>{user.name || 'Neuer Nutzer'}</strong>
            <span className={`chip ${roleTone}`}>{roleOptions.find((option) => option.value === user.roleProfile)?.label}</span>
          </div>
          <p className="muted small">{user.email || 'E-Mail offen'}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => onDelete(user.id)}
          aria-label="Nutzer löschen"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="form-grid two-column">
        <label className="field-label">
          Name
          <div className="input-with-icon">
            <UserRound size={16} />
            <input
              type="text"
              value={user.name}
              placeholder="z. B. Anna Beispiel"
              onChange={(event) => onUpdate(user.id, { name: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label">
          E-Mail
          <div className="input-with-icon">
            <Mail size={16} />
            <input
              type="email"
              value={user.email}
              placeholder="name@unternehmen.de"
              onChange={(event) => onUpdate(user.id, { email: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label">
          Bereich
          <input
            type="text"
            value={user.department}
            placeholder="z. B. Compliance, IT, Operations"
            onChange={(event) => onUpdate(user.id, { department: event.target.value })}
          />
        </label>
        <label className="field-label">
          Rollenprofil
          <select
            value={user.roleProfile}
            onChange={(event) => onUpdate(user.id, { roleProfile: event.target.value as UserRoleProfile })}
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Status
          <select
            value={user.status}
            onChange={(event) => onUpdate(user.id, { status: event.target.value as UserStatus })}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Scope
          <div className="input-with-icon">
            <ShieldCheck size={16} />
            <input
              type="text"
              value={user.scope}
              placeholder="z. B. Gesamtprogramm, KRITIS, Standort Nord"
              onChange={(event) => onUpdate(user.id, { scope: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label wide">
          Notizen
          <textarea
            rows={2}
            value={user.notes}
            placeholder="z. B. Freigabestrecke, Einschränkungen, Vertreterregelung"
            onChange={(event) => onUpdate(user.id, { notes: event.target.value })}
          />
        </label>
      </div>
    </article>
  );
}
