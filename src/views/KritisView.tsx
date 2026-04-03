import {
  AlertCircle,
  Clock3,
  FileText,
  PlusCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { CertificationStageCard } from '../components/CertificationStageCard';
import { FindingCard } from '../components/FindingCard';
import { kritisCertificationStages } from '../data/kritisBase';
import type {
  AuditChecklistItemDefinition,
  AuditChecklistState,
  AuditFindingItem,
  AuditFindingSummary,
  CertificationProgress,
  CertificationStageState,
  CertificationState,
  ChecklistProgress,
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
  auditChecklist: AuditChecklistItemDefinition[];
  auditChecklistStates: Record<string, AuditChecklistState>;
  checklistProgress: ChecklistProgress;
  findingSummary: AuditFindingSummary;
  findings: AuditFindingItem[];
  onChangeStatus: (requirementId: string, status: RequirementStatus) => void;
  onCreateAction: (requirementId: string) => void;
  onCreateEvidence: (requirementId: string) => void;
  onUpdateCertificationField: (field: 'auditLead' | 'targetDate' | 'decisionNote', value: string) => void;
  onUpdateCertificationStage: (stageId: string, patch: Partial<CertificationStageState>) => void;
  onUpdateChecklistState: (itemId: string, patch: Partial<AuditChecklistState>) => void;
  onCreateFinding: () => void;
  onGenerateFindingsFromChecklist: () => void;
  onUpdateFinding: (findingId: string, patch: Partial<AuditFindingItem>) => void;
  onDeleteFinding: (findingId: string) => void;
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

const checklistStatuses = [
  { value: 'not_started', label: 'Offen' },
  { value: 'in_progress', label: 'In Arbeit' },
  { value: 'evidenced', label: 'Evidenziert' },
  { value: 'closed', label: 'Geschlossen' },
  { value: 'not_applicable', label: 'N/A' },
] as const;

function getGateStatus(checklistProgress: ChecklistProgress, findingSummary: AuditFindingSummary) {
  if (checklistProgress.blockers === 0 && findingSummary.critical === 0 && findingSummary.overdue === 0) {
    return {
      label: 'Vor-Audit bereit',
      tone: 'success',
      text: 'Keine offenen Blocker, keine kritischen Feststellungen und keine überfälligen Punkte.',
    };
  }

  if (checklistProgress.blockers <= 2 && findingSummary.critical === 0) {
    return {
      label: 'Bedingt bereit',
      tone: 'warn',
      text: 'Es bleiben noch einzelne Blocker oder operative Restpunkte vor dem internen Audit.',
    };
  }

  return {
    label: 'Noch nicht bereit',
    tone: 'danger',
    text: 'Es bestehen kritische offene Punkte oder eine zu geringe Audit-Abdeckung.',
  };
}

export function KritisView({
  applicability,
  requirements,
  requirementStates,
  requirementActionCounts,
  requirementEvidenceCounts,
  certificationState,
  certificationProgress,
  module,
  auditChecklist,
  auditChecklistStates,
  checklistProgress,
  findingSummary,
  findings,
  onChangeStatus,
  onCreateAction,
  onCreateEvidence,
  onUpdateCertificationField,
  onUpdateCertificationStage,
  onUpdateChecklistState,
  onCreateFinding,
  onGenerateFindingsFromChecklist,
  onUpdateFinding,
  onDeleteFinding,
}: KritisViewProps) {
  const gateStatus = getGateStatus(checklistProgress, findingSummary);

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
            <span className={`chip ${gateStatus.tone}`}>{gateStatus.label}</span>
            <span className="chip outline">{checklistProgress.score}% Audit-Checklist</span>
          </div>
          <div className="inline-note top-gap warning-note">
            <AlertCircle size={16} />
            <span>
              Dieser Bereich ersetzt keine hoheitliche Feststellung, sondern strukturiert Ihre
              interne Prüfung, Nachweisführung, Feststellungen und Managemententscheidung.
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
          <p className="eyebrow">Gate-Logik</p>
          <h3>Audit- und Zertifizierungssteuerung</h3>
          <p>{gateStatus.text}</p>
          <div className="mini-list top-gap">
            <div className="mini-list-row"><span>Checklist-Blocker</span><strong>{checklistProgress.blockers}</strong></div>
            <div className="mini-list-row"><span>Evidenzierte Prüfbausteine</span><strong>{checklistProgress.evidenced}/{checklistProgress.total}</strong></div>
            <div className="mini-list-row"><span>Offene Feststellungen</span><strong>{findingSummary.open}</strong></div>
            <div className="mini-list-row"><span>Kritische Feststellungen</span><strong>{findingSummary.critical}</strong></div>
            <div className="mini-list-row"><span>Überfällige Feststellungen</span><strong>{findingSummary.overdue}</strong></div>
          </div>
          <div className="timeline-list top-gap">
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
                <strong>Auditfähigkeit</strong>
                <p>Checklist, Feststellungen, Evidenzen und Managementfreigaben müssen zusammenpassen.</p>
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
            <p className="eyebrow">Audit-Checklist</p>
            <h3>Prüfkatalog für internes Audit und Zertifizierungsentscheidung</h3>
          </div>
          <div className="inline-actions">
            <button type="button" className="button secondary" onClick={onGenerateFindingsFromChecklist}>
              <Sparkles size={16} />
              Blocker in Feststellungen überführen
            </button>
          </div>
        </div>

        <div className="work-list">
          {auditChecklist.map((item) => {
            const currentState = auditChecklistStates[item.id] ?? { status: 'not_started', notes: '' };
            return (
              <article key={item.id} className="work-card">
                <div className="work-card-head">
                  <div>
                    <div className="question-title-row">
                      <strong>{item.title}</strong>
                      <span className={`chip ${item.severity === 'high' ? 'danger' : item.severity === 'medium' ? 'warn' : 'outline'}`}>
                        {item.severity === 'high' ? 'Blocker-relevant' : item.severity === 'medium' ? 'Wichtig' : 'Ergänzend'}
                      </span>
                    </div>
                    <p className="muted small">{item.area}</p>
                  </div>
                  <span className="chip outline">{currentState.status}</span>
                </div>

                <p>{item.guidance}</p>
                <div className="chip-row">
                  {item.relatedRequirementIds?.length ? (
                    <span className="chip outline">Anforderungen: {item.relatedRequirementIds.length}</span>
                  ) : null}
                  {item.relatedQuestionIds?.length ? (
                    <span className="chip outline">Fragen: {item.relatedQuestionIds.length}</span>
                  ) : null}
                </div>

                <div className="status-toggle-row">
                  {checklistStatuses.map((status) => (
                    <button
                      key={status.value}
                      type="button"
                      className={`status-toggle ${currentState.status === status.value ? 'selected' : ''}`}
                      onClick={() => onUpdateChecklistState(item.id, { status: status.value })}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>

                <label className="field-label">
                  Notizen / Auditkommentar
                  <textarea
                    rows={2}
                    value={currentState.notes}
                    placeholder="z. B. Nachweis liegt vor, Freigabe fehlt, Nachtest geplant"
                    onChange={(event) => onUpdateChecklistState(item.id, { notes: event.target.value })}
                  />
                </label>
              </article>
            );
          })}
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

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Feststellungen</p>
            <h3>Mängel, Blocker und interne Auditfeststellungen</h3>
          </div>
          <button type="button" className="button primary" onClick={onCreateFinding}>
            <PlusCircle size={16} />
            Feststellung anlegen
          </button>
        </div>

        <div className="work-list">
          {findings.length ? (
            findings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                onUpdate={onUpdateFinding}
                onDelete={onDeleteFinding}
              />
            ))
          ) : (
            <div className="empty-state panel-empty">
              <AlertCircle size={20} />
              <div>
                <strong>Noch keine Feststellungen gepflegt</strong>
                <p>Blocker aus der Audit-Checklist lassen sich automatisiert oder manuell als Feststellungen führen.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
