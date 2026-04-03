import { CalendarDays, Link2, Trash2, UserRound } from 'lucide-react';
import type { EvidenceItem, EvidenceStatus, EvidenceType } from '../types';

interface EvidenceCardProps {
  evidence: EvidenceItem;
  onUpdate: (evidenceId: string, patch: Partial<EvidenceItem>) => void;
  onDelete: (evidenceId: string) => void;
}

const statusOptions: Array<{ value: EvidenceStatus; label: string }> = [
  { value: 'missing', label: 'Fehlt' },
  { value: 'draft', label: 'Entwurf' },
  { value: 'review', label: 'In Review' },
  { value: 'approved', label: 'Freigegeben' },
];

const typeOptions: Array<{ value: EvidenceType; label: string }> = [
  { value: 'policy', label: 'Richtlinie' },
  { value: 'plan', label: 'Plan' },
  { value: 'report', label: 'Bericht' },
  { value: 'test', label: 'Test/Übung' },
  { value: 'training', label: 'Schulung' },
  { value: 'contract', label: 'Vertrag/SLA' },
  { value: 'backup', label: 'Backup/Restore' },
  { value: 'other', label: 'Sonstiges' },
];

export function EvidenceCard({ evidence, onUpdate, onDelete }: EvidenceCardProps) {
  const statusTone =
    evidence.status === 'approved'
      ? 'success'
      : evidence.status === 'review'
        ? 'warn'
        : evidence.status === 'draft'
          ? 'default'
          : 'danger';

  return (
    <article className="work-card">
      <div className="work-card-head">
        <div>
          <div className="question-title-row">
            <strong>{evidence.title || 'Neuer Nachweis'}</strong>
            <span className={`chip ${statusTone}`}>{evidence.status}</span>
          </div>
          <p className="muted small">Quelle: {evidence.sourceLabel}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => onDelete(evidence.id)}
          aria-label="Nachweis löschen"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="form-grid two-column">
        <label className="field-label wide">
          Titel
          <input
            type="text"
            value={evidence.title}
            onChange={(event) => onUpdate(evidence.id, { title: event.target.value })}
          />
        </label>
        <label className="field-label">
          Typ
          <select
            value={evidence.type}
            onChange={(event) => onUpdate(evidence.id, { type: event.target.value as EvidenceType })}
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Status
          <select
            value={evidence.status}
            onChange={(event) => onUpdate(evidence.id, { status: event.target.value as EvidenceStatus })}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Verantwortlich
          <div className="input-with-icon">
            <UserRound size={16} />
            <input
              type="text"
              placeholder="z. B. QMB, CISO, Facility"
              value={evidence.owner}
              onChange={(event) => onUpdate(evidence.id, { owner: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label">
          Review-Datum
          <div className="input-with-icon">
            <CalendarDays size={16} />
            <input
              type="date"
              value={evidence.reviewDate}
              onChange={(event) => onUpdate(evidence.id, { reviewDate: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label wide">
          Referenz / Link / Ablageort
          <div className="input-with-icon">
            <Link2 size={16} />
            <input
              type="text"
              placeholder="z. B. SharePoint-Link, DMS-ID, Pfad"
              value={evidence.link}
              onChange={(event) => onUpdate(evidence.id, { link: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label wide">
          Notizen
          <textarea
            rows={2}
            placeholder="z. B. letzter Test, Freigabestand, fehlende Anlagen"
            value={evidence.notes}
            onChange={(event) => onUpdate(evidence.id, { notes: event.target.value })}
          />
        </label>
      </div>

      <div className="chip-row">
        {evidence.relatedQuestionIds.length ? (
          <span className="chip outline">Fragen: {evidence.relatedQuestionIds.length}</span>
        ) : null}
        {evidence.relatedRequirementIds.length ? (
          <span className="chip outline">KRITIS-Bausteine: {evidence.relatedRequirementIds.length}</span>
        ) : null}
      </div>
    </article>
  );
}
