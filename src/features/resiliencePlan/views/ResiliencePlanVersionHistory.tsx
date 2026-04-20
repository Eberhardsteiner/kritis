import { useState } from 'react';
import { Archive, CheckCircle2, FileCheck2, RotateCcw, Send } from 'lucide-react';
import type { ResiliencePlan, ResiliencePlanStatus } from '../types';

interface ResiliencePlanVersionHistoryProps {
  currentPlan: ResiliencePlan;
  archivedVersions?: ResiliencePlan[];
  canTransitionStatus?: boolean;
  onSubmitForReview?: () => void;
  onApprove?: (approvedBy: string) => void;
  onReturnToDraft?: () => void;
  onArchive?: () => void;
}

const STATUS_LABELS: Record<ResiliencePlanStatus, string> = {
  draft: 'Entwurf',
  review: 'In Review',
  approved: 'Freigegeben',
  archived: 'Archiviert',
};

function getStatusTone(status: ResiliencePlanStatus): 'outline' | 'warn' | 'success' {
  if (status === 'approved') {
    return 'success';
  }
  if (status === 'review') {
    return 'warn';
  }
  return 'outline';
}

export function ResiliencePlanVersionHistory({
  currentPlan,
  archivedVersions = [],
  canTransitionStatus = true,
  onSubmitForReview,
  onApprove,
  onReturnToDraft,
  onArchive,
}: ResiliencePlanVersionHistoryProps) {
  const [approverName, setApproverName] = useState('');

  function handleApprove(): void {
    if (!approverName.trim()) {
      return;
    }
    onApprove?.(approverName.trim());
  }

  const status = currentPlan.status;

  return (
    <section className="card" aria-label="Resilienzplan Versionshistorie">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Freigabe-Workflow</p>
          <h3>Versionshistorie und Freigabe</h3>
        </div>
        <div className="chip-row">
          <span className={`chip ${getStatusTone(status)}`}>{STATUS_LABELS[status]}</span>
        </div>
      </div>

      <article className="nested-card top-gap">
        <div className="question-title-row">
          <strong>Aktuelle Version {currentPlan.version}</strong>
          <span className={`chip ${getStatusTone(status)}`}>{STATUS_LABELS[status]}</span>
        </div>
        <p className="muted small">
          Erstellt {currentPlan.createdAt.slice(0, 10)} · Aktualisiert {currentPlan.updatedAt.slice(0, 10)}
          {currentPlan.approvedBy ? ` · Freigegeben durch ${currentPlan.approvedBy}` : ''}
          {currentPlan.approvedAt ? ` (${currentPlan.approvedAt.slice(0, 10)})` : ''}
        </p>

        <div className="chip-row top-gap">
          {status === 'draft' && canTransitionStatus && onSubmitForReview ? (
            <button type="button" className="button" onClick={onSubmitForReview}>
              <Send size={14} />
              Review anfragen
            </button>
          ) : null}
          {status === 'review' && canTransitionStatus ? (
            <>
              <label className="field-label">
                Name der freigebenden Person
                <input
                  type="text"
                  value={approverName}
                  onChange={(event) => setApproverName(event.target.value)}
                  placeholder="z. B. Dr. Muster · CEO"
                />
              </label>
              <button
                type="button"
                className="button"
                onClick={handleApprove}
                disabled={!approverName.trim()}
              >
                <FileCheck2 size={14} />
                Freigeben
              </button>
              {onReturnToDraft ? (
                <button type="button" className="button secondary" onClick={onReturnToDraft}>
                  <RotateCcw size={14} />
                  Zurück in Entwurf
                </button>
              ) : null}
            </>
          ) : null}
          {status === 'approved' && canTransitionStatus ? (
            <>
              {onReturnToDraft ? (
                <button type="button" className="button secondary" onClick={onReturnToDraft}>
                  <RotateCcw size={14} />
                  Freigabe zurückziehen
                </button>
              ) : null}
              {onArchive ? (
                <button type="button" className="button secondary" onClick={onArchive}>
                  <Archive size={14} />
                  Archivieren
                </button>
              ) : null}
            </>
          ) : null}
          {status === 'archived' && canTransitionStatus && onReturnToDraft ? (
            <button type="button" className="button secondary" onClick={onReturnToDraft}>
              <RotateCcw size={14} />
              Reaktivieren
            </button>
          ) : null}
        </div>
      </article>

      <h4 className="top-gap">Archivierte Fassungen ({archivedVersions.length})</h4>
      {archivedVersions.length === 0 ? (
        <p className="muted top-gap">
          Keine archivierten Fassungen vorhanden. Ältere Versionen werden nach einer neuen Freigabe hier
          abgelegt.
        </p>
      ) : (
        <ul className="plain-list top-gap">
          {archivedVersions.map((version) => (
            <li key={version.id}>
              <CheckCircle2 size={14} /> <strong>Version {version.version}</strong> · {STATUS_LABELS[version.status]}{' '}
              · erstellt {version.createdAt.slice(0, 10)}
              {version.approvedBy ? ` · Freigabe ${version.approvedBy}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
