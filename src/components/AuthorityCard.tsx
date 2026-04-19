import { Building2, ExternalLink } from 'lucide-react';
import { getAuthorityRoleLabel } from '../lib/authorities';
import type { AuthorityAssignmentResolved, AuthorityRole } from '../types';

interface AuthorityCardProps {
  assignment: AuthorityAssignmentResolved;
}

function getRoleTone(role: AuthorityRole): 'warn' | 'outline' | 'success' {
  if (role === 'coordination') {
    return 'warn';
  }
  if (role === 'sector_supervision') {
    return 'outline';
  }
  if (role === 'incident_reporting') {
    return 'success';
  }
  return 'outline';
}

export function AuthorityCard({ assignment }: AuthorityCardProps) {
  const { authority, role, lawRef, note } = assignment;
  const fullUrl = authority.website
    ? `${authority.website}${authority.contactPath || ''}`
    : '';

  return (
    <article className="card compact-card">
      <div className="work-card-head">
        <div>
          <div className="question-title-row">
            <strong>{authority.shortName}</strong>
            <span className={`chip ${getRoleTone(role)}`}>{getAuthorityRoleLabel(role)}</span>
          </div>
          <p className="muted small">{authority.fullName}</p>
        </div>
        <div className="stage-icon">
          <Building2 size={18} />
        </div>
      </div>
      <p className="muted small top-gap">
        <strong>Rechtsgrundlage:</strong> {lawRef}
      </p>
      {note ? <p className="muted small">{note}</p> : null}
      {fullUrl ? (
        <p className="top-gap">
          <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="link-button">
            <ExternalLink size={14} />
            <span>{authority.website.replace(/^https?:\/\//, '')}</span>
          </a>
        </p>
      ) : (
        <p className="muted small top-gap">
          Zuständigkeit landesrechtlich zu klären; kein zentraler Kontaktpfad hinterlegt.
        </p>
      )}
    </article>
  );
}
