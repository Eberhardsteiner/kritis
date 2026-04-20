import { useMemo, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { validatePlan } from '../generator';
import {
  ORDERED_RESILIENCE_GOALS,
  PLAN_SECTION_LABELS,
  RESILIENCE_GOAL_DESCRIPTIONS,
  RESILIENCE_GOAL_LABELS,
} from '../template';
import type {
  MeasureReference,
  MeasureStatus,
  ResilienceGoal,
  ResiliencePlan,
  ResiliencePlanContent,
} from '../types';

interface ResiliencePlanEditorProps {
  plan: ResiliencePlan;
  onSave: (plan: ResiliencePlan) => void;
  onCancel?: () => void;
}

type SectionKey = keyof ResiliencePlanContent;

const SECTION_TABS: SectionKey[] = [
  'scope',
  'riskBasis',
  'measuresByGoal',
  'governance',
  'reporting',
  'evidence',
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function ResiliencePlanEditor({ plan, onSave, onCancel }: ResiliencePlanEditorProps) {
  const [draft, setDraft] = useState<ResiliencePlan>(() => clone(plan));
  const [activeTab, setActiveTab] = useState<SectionKey>('scope');

  const validation = useMemo(() => validatePlan(draft), [draft]);

  function updateContent<K extends SectionKey>(key: K, value: ResiliencePlanContent[K]): void {
    setDraft((previous) => ({
      ...previous,
      content: { ...previous.content, [key]: value },
    }));
  }

  function handleScopeField<K extends keyof ResiliencePlanContent['scope']>(
    key: K,
    value: ResiliencePlanContent['scope'][K],
  ): void {
    updateContent('scope', { ...draft.content.scope, [key]: value });
  }

  function handleRiskBasisField<K extends keyof ResiliencePlanContent['riskBasis']>(
    key: K,
    value: ResiliencePlanContent['riskBasis'][K],
  ): void {
    updateContent('riskBasis', { ...draft.content.riskBasis, [key]: value });
  }

  function handleGovernanceField<K extends keyof ResiliencePlanContent['governance']>(
    key: K,
    value: ResiliencePlanContent['governance'][K],
  ): void {
    updateContent('governance', { ...draft.content.governance, [key]: value });
  }

  function handleReportingField<K extends keyof ResiliencePlanContent['reporting']>(
    key: K,
    value: ResiliencePlanContent['reporting'][K],
  ): void {
    updateContent('reporting', { ...draft.content.reporting, [key]: value });
  }

  function handleEvidenceField<K extends keyof ResiliencePlanContent['evidence']>(
    key: K,
    value: ResiliencePlanContent['evidence'][K],
  ): void {
    updateContent('evidence', { ...draft.content.evidence, [key]: value });
  }

  function addMeasure(goal: ResilienceGoal): void {
    const next: MeasureReference = {
      id: `measure-${Date.now().toString(36)}`,
      title: '',
      description: '',
      goal,
      owner: '',
      dueDate: '',
      status: 'planned',
    };
    updateContent('measuresByGoal', {
      ...draft.content.measuresByGoal,
      [goal]: [...draft.content.measuresByGoal[goal], next],
    });
  }

  function updateMeasure(goal: ResilienceGoal, index: number, patch: Partial<MeasureReference>): void {
    const list = [...draft.content.measuresByGoal[goal]];
    list[index] = { ...list[index], ...patch };
    updateContent('measuresByGoal', { ...draft.content.measuresByGoal, [goal]: list });
  }

  function removeMeasure(goal: ResilienceGoal, index: number): void {
    const list = draft.content.measuresByGoal[goal].filter((_, i) => i !== index);
    updateContent('measuresByGoal', { ...draft.content.measuresByGoal, [goal]: list });
  }

  function handleSave(): void {
    onSave({ ...draft, updatedAt: new Date().toISOString() });
  }

  const errorCount = validation.issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = validation.issues.filter((issue) => issue.severity === 'warning').length;

  return (
    <section className="card" aria-label="Resilienzplan bearbeiten">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Editor · § 13 KRITISDachG</p>
          <h3>Resilienzplan {draft.version} · {draft.status}</h3>
        </div>
        <div className="chip-row">
          {errorCount > 0 ? (
            <span className="chip danger">{errorCount} Fehler</span>
          ) : (
            <span className="chip success">Pflichtfelder vollständig</span>
          )}
          {warningCount > 0 ? <span className="chip warn">{warningCount} Hinweise</span> : null}
        </div>
      </div>

      <nav className="chip-row top-gap" role="tablist" aria-label="Abschnitte">
        {SECTION_TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            className={`chip ${activeTab === key ? 'warn' : 'outline'}`}
            onClick={() => setActiveTab(key)}
          >
            {PLAN_SECTION_LABELS[key]}
          </button>
        ))}
      </nav>

      <div className="top-gap">
        {activeTab === 'scope' ? (
          <div className="form-grid two-column">
            <label className="field-label">
              Betreiber
              <input
                type="text"
                value={draft.content.scope.operatorName}
                onChange={(event) => handleScopeField('operatorName', event.target.value)}
              />
            </label>
            <label className="field-label">
              Sektor
              <input
                type="text"
                value={draft.content.scope.sector}
                onChange={(event) => handleScopeField('sector', event.target.value)}
              />
            </label>
            <label className="field-label wide">
              Kritische Dienstleistung
              <input
                type="text"
                value={draft.content.scope.criticalService}
                onChange={(event) => handleScopeField('criticalService', event.target.value)}
              />
            </label>
            <label className="field-label">
              Standorte
              <input
                type="text"
                value={draft.content.scope.locations}
                onChange={(event) => handleScopeField('locations', event.target.value)}
              />
            </label>
            <label className="field-label">
              Mitarbeitende
              <input
                type="text"
                value={draft.content.scope.employees}
                onChange={(event) => handleScopeField('employees', event.target.value)}
              />
            </label>
            <label className="field-label">
              Versorgte Personen
              <input
                type="text"
                value={draft.content.scope.personsServed}
                onChange={(event) => handleScopeField('personsServed', event.target.value)}
              />
            </label>
            <label className="field-label wide">
              Hinweis zum Geltungsbereich
              <textarea
                rows={3}
                value={draft.content.scope.scopeNote}
                onChange={(event) => handleScopeField('scopeNote', event.target.value)}
              />
            </label>
          </div>
        ) : null}

        {activeTab === 'riskBasis' ? (
          <div className="form-grid two-column">
            <label className="field-label wide">
              Methodik
              <textarea
                rows={3}
                value={draft.content.riskBasis.methodology}
                onChange={(event) => handleRiskBasisField('methodology', event.target.value)}
              />
            </label>
            <label className="field-label wide">
              Verweis auf Risikoanalyse
              <textarea
                rows={2}
                value={draft.content.riskBasis.riskAnalysisReference}
                onChange={(event) => handleRiskBasisField('riskAnalysisReference', event.target.value)}
              />
            </label>
            <label className="field-label wide">
              Hinweis zur Risikobasis
              <textarea
                rows={3}
                value={draft.content.riskBasis.riskBasisNote}
                onChange={(event) => handleRiskBasisField('riskBasisNote', event.target.value)}
              />
            </label>
            <div className="wide">
              <p className="field-label">Top-Risiken ({draft.content.riskBasis.topRisks.length})</p>
              {draft.content.riskBasis.topRisks.length === 0 ? (
                <p className="muted small">
                  Aus B3 wird automatisch übernommen. Manuelle Pflege ist im Editor aus B4.4 aktuell nicht
                  vorgesehen.
                </p>
              ) : (
                <ul className="plain-list">
                  {draft.content.riskBasis.topRisks.map((risk, index) => (
                    <li key={`${risk.riskId ?? risk.title}-${index}`}>
                      <strong>{risk.title}</strong> · Initial {risk.initialScore} · Rest {risk.residualScore} ·{' '}
                      {risk.criticality}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === 'measuresByGoal' ? (
          <div className="priority-list">
            {ORDERED_RESILIENCE_GOALS.map((goal) => (
              <article key={goal} className="nested-card">
                <div className="question-title-row">
                  <strong>{RESILIENCE_GOAL_LABELS[goal]}</strong>
                  <button type="button" className="button secondary" onClick={() => addMeasure(goal)}>
                    <Plus size={14} />
                    Maßnahme
                  </button>
                </div>
                <p className="muted small">{RESILIENCE_GOAL_DESCRIPTIONS[goal]}</p>
                {draft.content.measuresByGoal[goal].length === 0 ? (
                  <p className="muted top-gap">Keine Maßnahmen zugeordnet.</p>
                ) : (
                  <div className="priority-list top-gap">
                    {draft.content.measuresByGoal[goal].map((measure, index) => (
                      <article key={measure.id} className="priority-item">
                        <div className="form-grid two-column">
                          <label className="field-label wide">
                            Titel
                            <input
                              type="text"
                              value={measure.title}
                              onChange={(event) => updateMeasure(goal, index, { title: event.target.value })}
                            />
                          </label>
                          <label className="field-label">
                            Owner
                            <input
                              type="text"
                              value={measure.owner}
                              onChange={(event) => updateMeasure(goal, index, { owner: event.target.value })}
                            />
                          </label>
                          <label className="field-label">
                            Fällig
                            <input
                              type="date"
                              value={measure.dueDate}
                              onChange={(event) => updateMeasure(goal, index, { dueDate: event.target.value })}
                            />
                          </label>
                          <label className="field-label">
                            Status
                            <select
                              value={measure.status}
                              onChange={(event) =>
                                updateMeasure(goal, index, { status: event.target.value as MeasureStatus })
                              }
                            >
                              <option value="planned">Geplant</option>
                              <option value="active">In Umsetzung</option>
                              <option value="ready">Umgesetzt</option>
                            </select>
                          </label>
                          <label className="field-label wide">
                            Beschreibung
                            <textarea
                              rows={2}
                              value={measure.description}
                              onChange={(event) =>
                                updateMeasure(goal, index, { description: event.target.value })
                              }
                            />
                          </label>
                        </div>
                        <div className="chip-row top-gap">
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => removeMeasure(goal, index)}
                            aria-label={`Maßnahme "${measure.title || 'Unbenannt'}" entfernen`}
                          >
                            <Trash2 size={14} />
                            Entfernen
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : null}

        {activeTab === 'governance' ? (
          <div className="form-grid two-column">
            <label className="field-label">
              Geschäftsleitung (§ 20)
              <input
                type="text"
                value={draft.content.governance.managementBoardContact}
                onChange={(event) => handleGovernanceField('managementBoardContact', event.target.value)}
              />
            </label>
            <label className="field-label">
              Programmverantwortung
              <input
                type="text"
                value={draft.content.governance.programOwner}
                onChange={(event) => handleGovernanceField('programOwner', event.target.value)}
              />
            </label>
            <label className="field-label wide">
              Eskalationspfad
              <textarea
                rows={2}
                value={draft.content.governance.escalationPath}
                onChange={(event) => handleGovernanceField('escalationPath', event.target.value)}
              />
            </label>
            <label className="field-label wide">
              Review-Kadenz
              <textarea
                rows={2}
                value={draft.content.governance.boardReviewCadence}
                onChange={(event) => handleGovernanceField('boardReviewCadence', event.target.value)}
              />
            </label>
            <label className="field-label wide">
              Hinweis zur Governance
              <textarea
                rows={3}
                value={draft.content.governance.governanceNote}
                onChange={(event) => handleGovernanceField('governanceNote', event.target.value)}
              />
            </label>
          </div>
        ) : null}

        {activeTab === 'reporting' ? (
          <div className="form-grid two-column">
            <label className="field-label">
              Meldekontakt (§ 18)
              <input
                type="text"
                value={draft.content.reporting.incidentContact}
                onChange={(event) => handleReportingField('incidentContact', event.target.value)}
              />
            </label>
            <label className="field-label">
              Ersatzkontakt
              <input
                type="text"
                value={draft.content.reporting.incidentBackupContact}
                onChange={(event) => handleReportingField('incidentBackupContact', event.target.value)}
              />
            </label>
            <label className="field-label wide">
              Hinweis BBK/BSI-Portal
              <textarea
                rows={2}
                value={draft.content.reporting.bsiPortalNote}
                onChange={(event) => handleReportingField('bsiPortalNote', event.target.value)}
              />
            </label>
            <label className="field-label wide">
              Meldelogik
              <textarea
                rows={2}
                value={draft.content.reporting.firstReportingTimeline}
                onChange={(event) => handleReportingField('firstReportingTimeline', event.target.value)}
              />
            </label>
            <label className="field-label wide">
              Hinweis zum Meldewesen
              <textarea
                rows={3}
                value={draft.content.reporting.reportingNote}
                onChange={(event) => handleReportingField('reportingNote', event.target.value)}
              />
            </label>
          </div>
        ) : null}

        {activeTab === 'evidence' ? (
          <div className="form-grid two-column">
            <label className="field-label">
              Review-Zyklus (Jahre)
              <input
                type="number"
                min={1}
                max={10}
                value={draft.content.evidence.reviewCycleYears}
                onChange={(event) =>
                  handleEvidenceField('reviewCycleYears', Number(event.target.value) || 4)
                }
              />
            </label>
            <label className="field-label wide">
              Hinweis § 17 (gleichwertige Nachweise)
              <textarea
                rows={3}
                value={draft.content.evidence.equivalentProofsNote}
                onChange={(event) => handleEvidenceField('equivalentProofsNote', event.target.value)}
              />
            </label>
            <label className="field-label wide">
              Hinweis zu Nachweisen
              <textarea
                rows={3}
                value={draft.content.evidence.evidenceNote}
                onChange={(event) => handleEvidenceField('evidenceNote', event.target.value)}
              />
            </label>
            <div className="wide">
              <p className="field-label">Nachweisreferenzen ({draft.content.evidence.evidenceReferences.length})</p>
              {draft.content.evidence.evidenceReferences.length === 0 ? (
                <p className="muted small">
                  Werden vom Generator aus den Evidenzen automatisch gesetzt; manuelle Pflege erfolgt im
                  Evidenzregister.
                </p>
              ) : (
                <ul className="plain-list">
                  {draft.content.evidence.evidenceReferences.map((ref, index) => (
                    <li key={`${ref.title}-${index}`}>
                      <strong>{ref.title}</strong> · {ref.type}
                      {ref.sourceStandard ? ` · ${ref.sourceStandard}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {validation.issues.length > 0 ? (
        <div className="inline-note top-gap">
          <ul className="plain-list">
            {validation.issues.map((issue) => (
              <li key={`${issue.path}-${issue.message}`} className="muted small">
                <strong>{issue.severity === 'error' ? 'Fehler' : 'Hinweis'}:</strong> {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="hero-actions top-gap">
        <button type="button" className="button" onClick={handleSave}>
          <Save size={14} />
          Plan speichern
        </button>
        {onCancel ? (
          <button type="button" className="button secondary" onClick={onCancel}>
            <X size={14} />
            Abbrechen
          </button>
        ) : null}
      </div>
    </section>
  );
}
