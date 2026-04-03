import { AlertCircle, FileText, PlusCircle, ShieldCheck, Clock3 } from 'lucide-react';
import { CertificationStageCard } from '../components/CertificationStageCard';
import { kritisCertificationStages } from '../data/kritisBase';
import type {
  CertificationProgress,
  CertificationStageState,
  CertificationState,
  KritisApplicability,
  RequirementDefinition,
  RequirementStatus,
  SectorModuleDefinition,
} from '../types';

interface KritisViewProps {
  applicability: KritisApplicability;
  requirements: RequirementDefinition[];
  requirementStates: Record<string, RequirementStatus>;
  requirementActionCounts: Record<string, number>;
  requirementEvidenceCounts: Record<string, number>;
  certificationState: CertificationState;
  certificationProgress: CertificationProgress;
  module?: SectorModuleDefinition;
  onChangeStatus: (requirementId: string, status: RequirementStatus) => void;
  onCreateAction: (requirementId: string) => void;
  onCreateEvidence: (requirementId: string) => void;
  onUpdateCertificationField: (field: 'auditLead' | 'targetDate' | 'decisionNote', value: string) => void;
  onUpdateCertificationStage: (stageId: string, patch: Partial<CertificationStageState>) => void;
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
  requirementActionCounts,
  requirementEvidenceCounts,
  certificationState,
  certificationProgress,
  module,
  onChangeStatus,
  onCreateAction,
  onCreateEvidence,
  onUpdateCertificationField,
  onUpdateCertificationStage,
}: KritisViewProps) {
  return (
    <div className="view-stack">
      <section className="content-grid two-column">
        <article className="card">
          <p className="eyebrow">KRITIS-Readiness</p>
          <h2>{applicability.title}</h2>
          <p>{applicability.text}</p>
          <div className="chip-row top-gap">
            <span className={`chip ${applicability.status === 'wahrscheinlich' ? 'danger' : applicability.status === 'prüfbedürftig' ? 'warn' : 'success'}`}>
              {applicability.status === 'wahrscheinlich'
                ? 'Vertiefte Betreiberprüfung'
                : applicability.status === 'prüfbedürftig'
                  ? 'Einordnung offen'
                  : 'Derzeit gering'}
            </span>
            <span className="chip outline">Interne Audit- und Zertifizierungslogik</span>
          </div>
          <div className="inline-note top-gap warning-note">
            <AlertCircle size={16} />
            <span>
              Dieser Bereich ersetzt keine hoheitliche Feststellung, sondern strukturiert Ihre
              interne Prüfung, Nachweisführung und Managemententscheidung.
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
          <p className="eyebrow">Zeitkritische Mindestlogik</p>
          <h3>Fristen und Nachweisdruck</h3>
          <div className="timeline-list">
            <div className="timeline-item">
              <Clock3 size={16} />
              <div>
                <strong>Registrierung</strong>
                <p>Spätestens drei Monate nach Eintritt der KRITIS-Eigenschaft organisieren.</p>
              </div>
            </div>
            <div className="timeline-item">
              <Clock3 size={16} />
              <div>
                <strong>Vorfälle melden</strong>
                <p>Erstmeldung innerhalb von 24 Stunden, ausführlicher Bericht innerhalb eines Monats.</p>
              </div>
            </div>
            <div className="timeline-item">
              <ShieldCheck size={16} />
              <div>
                <strong>Risikoanalyse und Resilienzplan</strong>
                <p>Methodik, Maßnahmen und Evidenzen so strukturieren, dass Audits belastbar vorbereitet werden können.</p>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Interner Zertifizierungsworkflow</p>
            <h3>Steuerung der Freigabestrecke</h3>
          </div>
          <div className="chip-row">
            <span className={`chip ${certificationProgress.score >= 75 ? 'success' : certificationProgress.score >= 50 ? 'warn' : 'danger'}`}>
              Reife {certificationProgress.score}%
            </span>
            <span className="chip outline">{certificationProgress.readyStages}/6 Stufen abgeschlossen</span>
          </div>
        </div>

        <div className="form-grid two-column top-gap">
          <label className="field-label">
            Audit Lead / Programmverantwortung
            <input
              type="text"
              placeholder="z. B. CISO, Krisenstab, Compliance"
              value={certificationState.auditLead}
              onChange={(event) => onUpdateCertificationField('auditLead', event.target.value)}
            />
          </label>
          <label className="field-label">
            Zieltermin interne Zertifizierungsentscheidung
            <input
              type="date"
              value={certificationState.targetDate}
              onChange={(event) => onUpdateCertificationField('targetDate', event.target.value)}
            />
          </label>
          <label className="field-label wide">
            Management-Entscheid / Restrisiko
            <textarea
              rows={3}
              placeholder="z. B. Freigabe unter Auflagen, Restlücken, Budgetentscheidung"
              value={certificationState.decisionNote}
              onChange={(event) => onUpdateCertificationField('decisionNote', event.target.value)}
            />
          </label>
        </div>

        <div className="stage-grid top-gap">
          {kritisCertificationStages.map((stage) => (
            <CertificationStageCard
              key={stage.id}
              stage={stage}
              state={certificationState.stageStates[stage.id]}
              onUpdate={onUpdateCertificationStage}
            />
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Prüfbausteine</p>
            <h3>KRITIS-Nachweisstrecke</h3>
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

                <div className="question-actions-row top-gap">
                  <div className="chip-row">
                    {requirementActionCounts[requirement.id] ? (
                      <span className="chip outline">Maßnahmen: {requirementActionCounts[requirement.id]}</span>
                    ) : null}
                    {requirementEvidenceCounts[requirement.id] ? (
                      <span className="chip outline">Nachweise: {requirementEvidenceCounts[requirement.id]}</span>
                    ) : null}
                  </div>
                  <div className="inline-actions">
                    <button type="button" className="button tertiary" onClick={() => onCreateAction(requirement.id)}>
                      <PlusCircle size={16} />
                      Maßnahme anlegen
                    </button>
                    <button type="button" className="button tertiary" onClick={() => onCreateEvidence(requirement.id)}>
                      <FileText size={16} />
                      Nachweis anlegen
                    </button>
                  </div>
                </div>

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
