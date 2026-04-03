import { ClipboardCheck } from 'lucide-react';
import type {
  CertificationStageDefinition,
  CertificationStageState,
  CertificationStageStatus,
} from '../types';

interface CertificationStageCardProps {
  stage: CertificationStageDefinition;
  state: CertificationStageState;
  onUpdate: (stageId: string, patch: Partial<CertificationStageState>) => void;
}

const statusOptions: Array<{ value: CertificationStageStatus; label: string }> = [
  { value: 'not_started', label: 'Nicht gestartet' },
  { value: 'in_progress', label: 'In Arbeit' },
  { value: 'ready', label: 'Abgeschlossen' },
];

export function CertificationStageCard({ stage, state, onUpdate }: CertificationStageCardProps) {
  const tone =
    state.status === 'ready'
      ? 'success'
      : state.status === 'in_progress'
        ? 'warn'
        : 'outline';

  return (
    <article className="stage-card">
      <div className="work-card-head">
        <div>
          <div className="question-title-row">
            <strong>{stage.label}</strong>
            <span className={`chip ${tone}`}>{statusOptions.find((option) => option.value === state.status)?.label}</span>
          </div>
          <p className="muted">{stage.description}</p>
        </div>
        <div className="stage-icon">
          <ClipboardCheck size={18} />
        </div>
      </div>

      <div className="form-grid two-column">
        <label className="field-label">
          Status
          <select
            value={state.status}
            onChange={(event) => onUpdate(stage.id, { status: event.target.value as CertificationStageStatus })}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label wide">
          Notiz zur Stufe
          <textarea
            rows={2}
            placeholder="z. B. Scope freigegeben, Audit offen, Nachweise ergänzt"
            value={state.notes}
            onChange={(event) => onUpdate(stage.id, { notes: event.target.value })}
          />
        </label>
      </div>
    </article>
  );
}
