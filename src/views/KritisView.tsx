import { AlertCircle, ShieldCheck, Clock3 } from 'lucide-react';
import type {
  KritisApplicability,
  RequirementDefinition,
  RequirementStatus,
  SectorModuleDefinition,
} from '../types';

interface KritisViewProps {
  applicability: KritisApplicability;
  requirements: RequirementDefinition[];
  requirementStates: Record<string, RequirementStatus>;
  module?: SectorModuleDefinition;
  onChangeStatus: (requirementId: string, status: RequirementStatus) => void;
}

const requirementStatuses: RequirementStatus[] = [
  'open',
  'in_progress',
  'ready',
  'not_applicable',
];

const statusLabels: Record<RequirementStatus, string> = {
  open: 'Offen',
  in_progress: 'In Arbeit',
  ready: 'Nachweisfähig',
  not_applicable: 'N/A',
};

export function KritisView({
  applicability,
  requirements,
  requirementStates,
  module,
  onChangeStatus,
}: KritisViewProps) {
  return (
    <div className="view-stack">
      <section className="content-grid two-column">
        <article className="card">
          <p className="eyebrow">KRITIS-Readiness</p>
          <h2>{applicability.title}</h2>
          <p>{applicability.text}</p>
          <div className="inline-note top-gap warning-note">
            <AlertCircle size={16} />
            <span>
              Dieser Bereich bildet eine interne Audit- und Nachweislogik ab. Er ersetzt keine
              hoheitliche Feststellung oder behördliche Zertifizierung.
            </span>
          </div>
          {module?.kritisExtension?.hints?.length ? (
            <div className="top-gap">
              <strong>Branchenhinweise</strong>
              <ul className="plain-list">
                {module.kritisExtension.hints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>

        <article className="card">
          <p className="eyebrow">Zeitkritische Punkte</p>
          <h3>Operative Mindestlogik</h3>
          <div className="timeline-list">
            <div className="timeline-item">
              <Clock3 size={16} />
              <div>
                <strong>Erstmeldung zu Vorfällen</strong>
                <p>Spätestens 24 Stunden nach Kenntnis eines meldepflichtigen Vorfalls.</p>
              </div>
            </div>
            <div className="timeline-item">
              <Clock3 size={16} />
              <div>
                <strong>Ausführlicher Bericht</strong>
                <p>Spätestens innerhalb eines Monats nach Kenntnis des Vorfalls.</p>
              </div>
            </div>
            <div className="timeline-item">
              <ShieldCheck size={16} />
              <div>
                <strong>Risikoanalyse und Resilienzplan</strong>
                <p>Dokumentationslogik aufbauen, damit Audit- und Nachweisfähigkeit früh entsteht.</p>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Prüfbausteine</p>
            <h3>Interne Zertifizierungs- und Nachweisstrecke</h3>
          </div>
        </div>

        <div className="requirement-list">
          {requirements.map((requirement) => {
            const currentStatus = requirementStates[requirement.id] ?? 'open';
            return (
              <article key={requirement.id} className="requirement-card">
                <div className="requirement-head">
                  <div>
                    <div className="question-title-row">
                      <h4>{requirement.title}</h4>
                      {requirement.severity ? (
                        <span className={`chip ${requirement.severity === 'high' ? 'danger' : requirement.severity === 'medium' ? 'warn' : 'success'}`}>
                          {requirement.severity === 'high' ? 'Hoch' : requirement.severity === 'medium' ? 'Mittel' : 'Niedrig'}
                        </span>
                      ) : null}
                    </div>
                    <p>{requirement.description}</p>
                  </div>
                  {requirement.lawRef ? <span className="chip outline">{requirement.lawRef}</span> : null}
                </div>
                <p className="muted">{requirement.guidance}</p>
                {requirement.dueHint ? <p className="muted small">Fristlogik: {requirement.dueHint}</p> : null}
                <div className="status-toggle-row">
                  {requirementStatuses.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`status-toggle ${currentStatus === status ? 'selected' : ''}`}
                      onClick={() => onChangeStatus(requirement.id, status)}
                    >
                      {statusLabels[status]}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
