import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Clock3,
  Download,
  FileText,
  PlusCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { CertificationStageCard } from '../components/CertificationStageCard';
import { FindingCard } from '../components/FindingCard';
import { kritisCertificationStages } from '../data/kritisBase';
import {
  getBsigEntityClassLabel,
  getEntityClassFieldLabel,
  getJurisdictionLabel,
  getRegimeScopeLabel,
  shouldShowEntityClass,
} from '../lib/regulatory';
import type {
  AuditChecklistItemDefinition,
  AuditChecklistState,
  AuditFindingItem,
  AuditFindingSummary,
  CertificationProgress,
  CertificationStageState,
  CertificationState,
  ChecklistProgress,
  ExportPackageEntry,
  GermanyBsigEntityClass,
  GermanyRegimeId,
  KritisApplicability,
  RegulatoryProfile,
  RegulatoryRegimeDefinition,
  RegulatoryRegimeSummary,
  RegimeScopeStatus,
  RequirementDefinition,
  RequirementStatus,
  SectorModuleDefinition,
} from '../types';

interface KritisViewProps {
  applicability: KritisApplicability;
  regulatoryProfile: RegulatoryProfile;
  regimeDefinitions: RegulatoryRegimeDefinition[];
  regimeSummaries: RegulatoryRegimeSummary[];
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
  exportPackages: ExportPackageEntry[];
  exportApprovalRequired: boolean;
  certificationAuthorityLabel: string;
  onUpdateJurisdiction: (value: RegulatoryProfile['jurisdiction']) => void;
  onUpdateRegulatoryProfileField: (
    field: 'bsigEntityClass' | 'lastReviewDate' | 'owner' | 'notes',
    value: string,
  ) => void;
  onUpdateRegimeScope: (regimeId: GermanyRegimeId, value: RegimeScopeStatus) => void;
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
  onCreateCertificationDossier: (
    type: 'certification_dossier',
    options?: { title?: string; note?: string; signOffName?: string; signOffRole?: string },
  ) => void;
  onReleaseExportPackage: (exportId: string, releaseNote: string) => void;
  onDownloadExportPackage: (entry: ExportPackageEntry) => void;
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

const scopeOptions: Array<{ value: RegimeScopeStatus; label: string }> = [
  { value: 'unknown', label: 'Einordnung offen' },
  { value: 'in_scope', label: 'Im Scope' },
  { value: 'out_of_scope', label: 'Derzeit nicht im Scope' },
];

const jurisdictionOptions: Array<{ value: RegulatoryProfile['jurisdiction']; label: string }> = [
  { value: 'DE', label: 'Deutschland' },
  { value: 'AT', label: 'Österreich' },
  { value: 'CH', label: 'Schweiz' },
];

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

function getRequirementTone(status: RequirementStatus): 'outline' | 'warn' | 'success' {
  if (status === 'ready') {
    return 'success';
  }
  if (status === 'in_progress') {
    return 'warn';
  }
  return 'outline';
}

function getScopeTone(status: RegimeScopeStatus): 'outline' | 'warn' | 'success' {
  if (status === 'in_scope') {
    return 'warn';
  }
  if (status === 'out_of_scope') {
    return 'outline';
  }
  return 'outline';
}

function getRegimeTone(summary: RegulatoryRegimeSummary): 'success' | 'warn' | 'danger' | 'outline' {
  if (summary.scopeStatus === 'out_of_scope') {
    return 'outline';
  }
  if (summary.openRequirements === 0 && summary.checklistBlockers === 0) {
    return 'success';
  }
  if (summary.checklistBlockers <= 1) {
    return 'warn';
  }
  return 'danger';
}

export function KritisView({
  applicability,
  regulatoryProfile,
  regimeDefinitions,
  regimeSummaries,
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
  exportPackages,
  exportApprovalRequired,
  certificationAuthorityLabel,
  onUpdateJurisdiction,
  onUpdateRegulatoryProfileField,
  onUpdateRegimeScope,
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
  onCreateCertificationDossier,
  onReleaseExportPackage,
  onDownloadExportPackage,
}: KritisViewProps) {
  const gateStatus = getGateStatus(checklistProgress, findingSummary);
  const [dossierTitle, setDossierTitle] = useState('');
  const [dossierNote, setDossierNote] = useState('');
  const [dossierSignOffName, setDossierSignOffName] = useState(certificationState.auditLead || '');
  const [releaseNoteMap, setReleaseNoteMap] = useState<Record<string, string>>({});
  const dossiers = exportPackages.filter((item) => item.type === 'certification_dossier');
  const showEntityClass = shouldShowEntityClass(regulatoryProfile);
  const entityFieldLabel = getEntityClassFieldLabel(regulatoryProfile);
  const jurisdictionLabel = getJurisdictionLabel(regulatoryProfile.jurisdiction);
  const entityClassOptions: Array<{ value: GermanyBsigEntityClass; label: string }> = [
    { value: 'unknown', label: 'Noch nicht zugeordnet' },
    { value: 'important', label: getBsigEntityClassLabel('important', regulatoryProfile) },
    { value: 'essential', label: getBsigEntityClassLabel('essential', regulatoryProfile) },
    { value: 'not_applicable', label: 'Nicht anwendbar' },
  ];

  const requirementsByRegime = useMemo(
    () => regimeDefinitions.map((regime) => ({
      regime,
      summary: regimeSummaries.find((item) => item.regimeId === regime.id),
      items: requirements.filter((item) => item.regimeId === regime.id),
    })),
    [regimeDefinitions, regimeSummaries, requirements],
  );

  const checklistByRegime = useMemo(
    () => regimeDefinitions.map((regime) => ({
      regime,
      summary: regimeSummaries.find((item) => item.regimeId === regime.id),
      items: auditChecklist.filter((item) => item.regimeId === regime.id),
    })),
    [regimeDefinitions, regimeSummaries, auditChecklist],
  );

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
              Dieser Bereich ersetzt keine hoheitliche Feststellung. Er strukturiert die interne
              Readiness, die Nachweisführung und die saubere Trennung der DACH-Regime.
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
          <div className="section-heading">
            <div>
              <p className="eyebrow">Regelwerks-Cockpit</p>
              <h3>Jurisdiktion, Regime und Verantwortlichkeit</h3>
            </div>
            <div className="chip-row">
              <span className="chip outline">Jurisdiktion: {jurisdictionLabel}</span>
              <span className={`chip ${gateStatus.tone}`}>{gateStatus.label}</span>
            </div>
          </div>

          <div className="form-grid two-column top-gap">
            <label className="field-label">
              Jurisdiktion
              <select
                value={regulatoryProfile.jurisdiction}
                onChange={(event) => onUpdateJurisdiction(event.target.value as RegulatoryProfile['jurisdiction'])}
              >
                {jurisdictionOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Verantwortlich
              <input
                type="text"
                value={regulatoryProfile.owner}
                placeholder="z. B. BCM-Leitung, CISO, Compliance"
                onChange={(event) => onUpdateRegulatoryProfileField('owner', event.target.value)}
              />
            </label>
            <label className="field-label">
              Letzte Regime-Review
              <input
                type="date"
                value={regulatoryProfile.lastReviewDate}
                onChange={(event) => onUpdateRegulatoryProfileField('lastReviewDate', event.target.value)}
              />
            </label>
            {showEntityClass ? (
              <label className="field-label">
                {entityFieldLabel}
                <select
                  value={regulatoryProfile.bsigEntityClass}
                  onChange={(event) => onUpdateRegulatoryProfileField('bsigEntityClass', event.target.value)}
                >
                  {entityClassOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="inline-note">
                <AlertCircle size={16} />
                <span>Für die Schweiz wird keine NIS-Einrichtungsklasse gepflegt. Fokus liegt auf Scope, Meldekanal und 24h/14-Tage-Meldeweg.</span>
              </div>
            )}
            <label className="field-label wide">
              Notizen zur Regime-Einordnung
              <textarea
                rows={3}
                value={regulatoryProfile.notes}
                placeholder="z. B. Begründung, Scope-Notizen, externe Rechtsprüfung"
                onChange={(event) => onUpdateRegulatoryProfileField('notes', event.target.value)}
              />
            </label>
          </div>

          <div className="priority-list top-gap">
            {regimeDefinitions.map((regime) => {
              const summary = regimeSummaries.find((item) => item.regimeId === regime.id);
              const scopeValue = regulatoryProfile.scopeByRegime[regime.id];
              return (
                <article key={regime.id} className="priority-item">
                  <div>
                    <div className="question-title-row">
                      <strong>{regime.shortLabel}</strong>
                      <span className={`chip ${summary ? getRegimeTone(summary) : 'outline'}`}>
                        {summary ? getRegimeScopeLabel(summary.scopeStatus) : getRegimeScopeLabel(scopeValue)}
                      </span>
                    </div>
                    <p className="muted">{regime.focus}</p>
                    <p className="muted small">{regime.defaultScopeHint}</p>
                    {summary?.entityClassLabel ? (
                      <p className="muted small">Einrichtungsklasse: {summary.entityClassLabel}</p>
                    ) : null}
                  </div>
                  <div className="inline-actions align-start">
                    <label className="field-label compact-label min-width-220">
                      Scope-Status
                      <select
                        value={scopeValue}
                        onChange={(event) => onUpdateRegimeScope(regime.id, event.target.value as RegimeScopeStatus)}
                      >
                        {scopeOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    {summary ? (
                      <div className="summary-strip vertical compact">
                        <span>{summary.totalRequirements} Bausteine</span>
                        <span>{summary.openRequirements} offen</span>
                        <span>{summary.checklistBlockers} Blocker</span>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </article>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Meldelogik je Regime</p>
            <h3>Vorfallfristen und Berichtsstufen</h3>
          </div>
          <div className="chip-row">
            {regimeDefinitions.map((regime) => (
              <span key={regime.id} className="chip outline">
                {regime.shortLabel}: {regime.incidentTimeline.map((step) => step.dueLabel).join(' / ')}
              </span>
            ))}
          </div>
        </div>

        <div className="content-grid two-column top-gap">
          {regimeDefinitions.map((regime) => (
            <article key={regime.id} className="card nested-card">
              <div className="question-title-row">
                <strong>{regime.label}</strong>
                <span className={`chip ${getScopeTone(regulatoryProfile.scopeByRegime[regime.id])}`}>
                  {getRegimeScopeLabel(regulatoryProfile.scopeByRegime[regime.id])}
                </span>
              </div>
              <p className="muted">{regime.description}</p>
              <div className="timeline-list top-gap">
                {regime.incidentTimeline.map((step) => (
                  <div key={step.id} className="timeline-item">
                    <Clock3 size={16} />
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.dueLabel}</p>
                      <p className="muted small">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Interner Readiness-Workflow</p>
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
            Zieltermin interne Readiness-Entscheidung
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
              state={certificationState.stageStates[stage.id] ?? { status: 'not_started', notes: '' }}
              onUpdate={onUpdateCertificationStage}
            />
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">KRITIS-Readiness-Dossiers</p>
            <h3>Dossiers, Freigaben und Exportregister</h3>
          </div>
          <div className="chip-row">
            <span className={`chip ${exportApprovalRequired ? 'warn' : 'success'}`}>
              {exportApprovalRequired ? 'Freigabe empfohlen' : 'Freigabe optional'}
            </span>
            <span className="chip outline">Prüfstelle: {certificationAuthorityLabel}</span>
          </div>
        </div>

        <div className="form-grid two-column top-gap">
          <label className="field-label">
            Titel
            <input
              type="text"
              value={dossierTitle}
              placeholder="z. B. KRITIS-Readiness-Dossier Vor-Audit 2026"
              onChange={(event) => setDossierTitle(event.target.value)}
            />
          </label>
          <label className="field-label">
            Sign-off Name
            <input
              type="text"
              value={dossierSignOffName}
              placeholder="z. B. Programmleitung"
              onChange={(event) => setDossierSignOffName(event.target.value)}
            />
          </label>
          <label className="field-label wide">
            Dossier-Notiz
            <textarea
              rows={3}
              value={dossierNote}
              placeholder="z. B. Fokus auf BSIG / NIS2, noch offene Nachweise, erwartete Freigabe"
              onChange={(event) => setDossierNote(event.target.value)}
            />
          </label>
        </div>

        <div className="hero-actions top-gap">
          <button
            type="button"
            className="button primary"
            onClick={() => onCreateCertificationDossier('certification_dossier', {
              title: dossierTitle,
              note: dossierNote,
              signOffName: dossierSignOffName,
              signOffRole: certificationAuthorityLabel,
            })}
          >
            <FileText size={16} />
            Dossier registrieren
          </button>
        </div>

        <div className="priority-list top-gap">
          {dossiers.length ? dossiers.map((entry) => (
            <article key={entry.id} className="priority-item">
              <div>
                <div className="question-title-row">
                  <strong>{entry.title}</strong>
                  <span className={`chip ${entry.releaseStatus === 'released' ? 'success' : 'outline'}`}>
                    {entry.releaseStatus === 'released' ? 'Freigegeben' : 'Entwurf'}
                  </span>
                </div>
                <p className="muted small">
                  {entry.createdAt ? new Date(entry.createdAt).toLocaleString('de-DE') : 'ohne Zeitstempel'}
                  {' · '}
                  {entry.sizeKb} KB
                </p>
                <p className="muted small">{entry.note || 'Keine Zusatznotiz'}</p>
              </div>
              <div className="inline-actions align-start">
                <button type="button" className="button secondary" onClick={() => onDownloadExportPackage(entry)}>
                  <Download size={16} />
                  Paket laden
                </button>
                {entry.releaseStatus !== 'released' ? (
                  <>
                    <input
                      type="text"
                      placeholder="Freigabenotiz"
                      value={releaseNoteMap[entry.id] ?? ''}
                      onChange={(event) => setReleaseNoteMap((current) => ({ ...current, [entry.id]: event.target.value }))}
                    />
                    <button type="button" className="button secondary" onClick={() => onReleaseExportPackage(entry.id, releaseNoteMap[entry.id] ?? '')}>
                      <ShieldCheck size={16} />
                      Freigeben
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          )) : <p className="muted">Noch kein KRITIS-Readiness-Dossier registriert.</p>}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pflichten je Regime</p>
            <h3>Bausteine, Maßnahmen und Evidenzen</h3>
          </div>
          <div className="chip-row">
            <span className="chip outline">Maßnahmen aus Anforderungen ableitbar</span>
            <span className="chip outline">Evidenzen direkt an Anforderungen ankoppeln</span>
          </div>
        </div>

        <div className="content-grid two-column top-gap">
          {requirementsByRegime.map(({ regime, summary, items }) => {
            const isOutOfScope = regulatoryProfile.scopeByRegime[regime.id] === 'out_of_scope';
            return (
              <article key={regime.id} className="card nested-card">
                <div className="question-title-row">
                  <strong>{regime.label}</strong>
                  <span className={`chip ${summary ? getRegimeTone(summary) : 'outline'}`}>
                    {summary ? `${summary.openRequirements} offen` : getRegimeScopeLabel(regulatoryProfile.scopeByRegime[regime.id])}
                  </span>
                </div>
                <p className="muted">{regime.focus}</p>
                {isOutOfScope ? (
                  <p className="muted top-gap">Dieses Regime ist aktuell als nicht im Scope markiert. Die Bausteine bleiben daher aus der Arbeitsliste ausgeblendet.</p>
                ) : items.length ? (
                  <div className="work-list top-gap">
                    {items.map((requirement) => {
                      const currentStatus = requirementStates[requirement.id] ?? 'open';
                      return (
                        <article key={requirement.id} className="work-card compact-card">
                          <div className="work-card-head">
                            <div>
                              <div className="question-title-row">
                                <strong>{requirement.title}</strong>
                                <span className={`chip ${getRequirementTone(currentStatus)}`}>{statusLabels[currentStatus]}</span>
                              </div>
                              <p className="muted small">{requirement.lawRef || 'ohne Referenz'}{requirement.dueHint ? ` · ${requirement.dueHint}` : ''}</p>
                            </div>
                            <div className="chip-row">
                              <span className="chip outline">{requirementActionCounts[requirement.id] ?? 0} Maßnahmen</span>
                              <span className="chip outline">{requirementEvidenceCounts[requirement.id] ?? 0} Evidenzen</span>
                            </div>
                          </div>
                          <p>{requirement.description}</p>
                          <p className="muted small top-gap">{requirement.guidance}</p>
                          <div className="form-grid two-column top-gap">
                            <label className="field-label">
                              Status
                              <select
                                value={currentStatus}
                                onChange={(event) => onChangeStatus(requirement.id, event.target.value as RequirementStatus)}
                              >
                                {requirementStatuses.map((status) => (
                                  <option key={status} value={status}>{statusLabels[status]}</option>
                                ))}
                              </select>
                            </label>
                            <div className="hero-actions compact-actions align-end">
                              <button type="button" className="button secondary" onClick={() => onCreateAction(requirement.id)}>
                                <PlusCircle size={16} />
                                Maßnahme
                              </button>
                              <button type="button" className="button secondary" onClick={() => onCreateEvidence(requirement.id)}>
                                <Sparkles size={16} />
                                Evidenz
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted top-gap">Für dieses Regime sind derzeit keine aktiven Pflichtbausteine im Arbeitsbereich vorhanden.</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Audit-Checklist je Regime</p>
            <h3>Prüfbausteine, Blocker und Evidenzstatus</h3>
          </div>
          <div className="inline-actions">
            <button type="button" className="button secondary" onClick={onGenerateFindingsFromChecklist}>
              <Sparkles size={16} />
              Feststellungen aus Checklist ableiten
            </button>
          </div>
        </div>

        <div className="content-grid two-column top-gap">
          {checklistByRegime.map(({ regime, summary, items }) => {
            const isOutOfScope = regulatoryProfile.scopeByRegime[regime.id] === 'out_of_scope';
            return (
              <article key={regime.id} className="card nested-card">
                <div className="question-title-row">
                  <strong>{regime.label}</strong>
                  <span className={`chip ${summary ? getRegimeTone(summary) : 'outline'}`}>
                    {summary ? `${summary.checklistBlockers} Blocker` : 'Checklist'}
                  </span>
                </div>
                {isOutOfScope ? (
                  <p className="muted top-gap">Checklist ausgeblendet, weil das Regime aktuell als nicht im Scope markiert ist.</p>
                ) : items.length ? (
                  <div className="work-list top-gap">
                    {items.map((item) => {
                      const state = auditChecklistStates[item.id] ?? { status: 'not_started', notes: '' };
                      return (
                        <article key={item.id} className="work-card compact-card">
                          <div className="work-card-head">
                            <div>
                              <div className="question-title-row">
                                <strong>{item.title}</strong>
                                <span className={`chip ${item.severity === 'high' ? 'warn' : 'outline'}`}>{item.area}</span>
                              </div>
                              <p className="muted small">{item.guidance}</p>
                            </div>
                          </div>
                          <div className="form-grid two-column top-gap">
                            <label className="field-label">
                              Status
                              <select
                                value={state.status}
                                onChange={(event) => onUpdateChecklistState(item.id, { status: event.target.value as AuditChecklistState['status'] })}
                              >
                                {checklistStatuses.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                            <label className="field-label wide">
                              Checklist-Notiz
                              <textarea
                                rows={2}
                                value={state.notes}
                                placeholder="z. B. Nachweis liegt vor, Scope noch zu schärfen"
                                onChange={(event) => onUpdateChecklistState(item.id, { notes: event.target.value })}
                              />
                            </label>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted top-gap">Für dieses Regime sind derzeit keine aktiven Prüfbausteine vorhanden.</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Auditfeststellungen</p>
            <h3>Blocker, Restpunkte und Nachverfolgung</h3>
          </div>
          <div className="inline-actions">
            <button type="button" className="button secondary" onClick={onCreateFinding}>
              <PlusCircle size={16} />
              Feststellung anlegen
            </button>
          </div>
        </div>

        <div className="summary-strip top-gap">
          <span>{findingSummary.total} gesamt</span>
          <span>{findingSummary.open} offen</span>
          <span>{findingSummary.critical} kritisch</span>
          <span>{findingSummary.overdue} überfällig</span>
          {showEntityClass ? <span>{getBsigEntityClassLabel(regulatoryProfile.bsigEntityClass, regulatoryProfile)}</span> : <span>{jurisdictionLabel}</span>}
        </div>

        <div className="work-list top-gap">
          {findings.length ? findings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              onUpdate={onUpdateFinding}
              onDelete={onDeleteFinding}
            />
          )) : <p className="muted">Noch keine Feststellungen dokumentiert.</p>}
        </div>
      </section>
    </div>
  );
}
