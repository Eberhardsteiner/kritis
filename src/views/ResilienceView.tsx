import { AlertTriangle, Layers3, Route, ShieldAlert, Siren, Wrench } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import type {
  AssetItem,
  BusinessProcessItem,
  BusinessProcessTemplateDefinition,
  DependencyCategory,
  DependencyItem,
  DependencyTemplateDefinition,
  ExerciseItem,
  ExerciseTemplateDefinition,
  ResilienceSummary,
  ScenarioItem,
  ScenarioTemplateDefinition,
  StructureCriticality,
} from '../types';

interface ResilienceViewProps {
  moduleName: string;
  summary: ResilienceSummary;
  businessProcesses: BusinessProcessItem[];
  dependencies: DependencyItem[];
  scenarios: ScenarioItem[];
  exercises: ExerciseItem[];
  assets: AssetItem[];
  processTemplates: BusinessProcessTemplateDefinition[];
  dependencyTemplates: DependencyTemplateDefinition[];
  scenarioTemplates: ScenarioTemplateDefinition[];
  exerciseTemplates: ExerciseTemplateDefinition[];
  onCreateProcess: () => void;
  onUpdateProcess: (id: string, patch: Partial<BusinessProcessItem>) => void;
  onDeleteProcess: (id: string) => void;
  onCreateDependency: () => void;
  onUpdateDependency: (id: string, patch: Partial<DependencyItem>) => void;
  onDeleteDependency: (id: string) => void;
  onCreateScenario: () => void;
  onUpdateScenario: (id: string, patch: Partial<ScenarioItem>) => void;
  onDeleteScenario: (id: string) => void;
  onCreateExercise: () => void;
  onUpdateExercise: (id: string, patch: Partial<ExerciseItem>) => void;
  onDeleteExercise: (id: string) => void;
  onGenerateProcessTemplates: () => void;
  onGenerateDependencyTemplates: () => void;
  onGenerateScenarioTemplates: () => void;
  onGenerateExerciseTemplates: () => void;
}

const criticalityOptions: StructureCriticality[] = ['kritisch', 'hoch', 'mittel', 'niedrig'];
const dependencyCategories: DependencyCategory[] = [
  'lieferant',
  'it',
  'ot',
  'personal',
  'energie',
  'logistik',
  'kommunikation',
  'gebäude',
  'dienstleister',
];
const exerciseTypes: ExerciseItem['exerciseType'][] = ['tabletop', 'simulation', 'technical', 'alarm', 'supplier'];
const exerciseResults: ExerciseItem['result'][] = ['planned', 'passed', 'partial', 'failed'];
const scenarioStatuses: ScenarioItem['exerciseStatus'][] = ['not_tested', 'planned', 'tested'];

function riskChipClass(score: number): string {
  if (score >= 16) {
    return 'danger';
  }
  if (score >= 9) {
    return 'warn';
  }
  return 'success';
}

function scoreTone(value: number): 'good' | 'warn' | 'alert' | 'default' {
  if (value >= 75) {
    return 'good';
  }
  if (value >= 55) {
    return 'warn';
  }
  if (value > 0) {
    return 'default';
  }
  return 'alert';
}

function formatStatus(value: ScenarioItem['exerciseStatus']): string {
  if (value === 'tested') {
    return 'getestet';
  }
  if (value === 'planned') {
    return 'geplant';
  }
  return 'nicht getestet';
}

function formatExerciseResult(value: ExerciseItem['result']): string {
  if (value === 'passed') {
    return 'bestanden';
  }
  if (value === 'partial') {
    return 'teilweise';
  }
  if (value === 'failed') {
    return 'nicht bestanden';
  }
  return 'geplant';
}

function getSelectedValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions).map((option) => option.value);
}

export function ResilienceView({
  moduleName,
  summary,
  businessProcesses,
  dependencies,
  scenarios,
  exercises,
  assets,
  processTemplates,
  dependencyTemplates,
  scenarioTemplates,
  exerciseTemplates,
  onCreateProcess,
  onUpdateProcess,
  onDeleteProcess,
  onCreateDependency,
  onUpdateDependency,
  onDeleteDependency,
  onCreateScenario,
  onUpdateScenario,
  onDeleteScenario,
  onCreateExercise,
  onUpdateExercise,
  onDeleteExercise,
  onGenerateProcessTemplates,
  onGenerateDependencyTemplates,
  onGenerateScenarioTemplates,
  onGenerateExerciseTemplates,
}: ResilienceViewProps) {
  const processLookup = new Map(businessProcesses.map((item) => [item.id, item.title || 'Prozess']));
  const dependencyLookup = new Map(dependencies.map((item) => [item.id, item.title || 'Abhängigkeit']));
  const assetLookup = new Map(assets.map((item) => [item.id, item.name || 'Asset']));
  const scenarioLookup = new Map(scenarios.map((item) => [item.id, item.title || 'Szenario']));

  return (
    <div className="view-stack">
      <section className="hero card">
        <div>
          <p className="eyebrow">Operative Resilienz</p>
          <h2>BIA, Abhängigkeiten, Szenarien und Übungen für {moduleName}</h2>
          <p className="hero-text">
            Dieser Bereich verbindet geschäftskritische Prozesse, externe und interne Abhängigkeiten,
            Krisenszenarien und Übungsnachweise. Damit wird die Grundanalyse um eine operative
            Umsetzungs- und Testlogik ergänzt.
          </p>
          <div className="chip-row top-gap">
            <span className="chip outline">Prozessabdeckung {summary.processCoverage}%</span>
            <span className="chip outline">Hochrisiko-Szenarien {summary.highRiskScenarios}</span>
            <span className="chip outline">Single Points of Failure {summary.singlePointsOfFailure}</span>
            <span className="chip outline">Übungen fällig {summary.dueExercises}</span>
          </div>
        </div>
        <div className="hero-actions">
          <button type="button" className="button primary" onClick={onCreateScenario}>
            <Siren size={16} />
            Neues Szenario
          </button>
          <button type="button" className="button secondary" onClick={onCreateExercise}>
            <Wrench size={16} />
            Neue Übung
          </button>
        </div>
      </section>

      <section className="stats-grid phase-three">
        <StatCard
          title="Operative Resilienz"
          value={`${summary.score}%`}
          subtitle="BIA, Abhängigkeiten, Szenarien und Tests"
          tone={scoreTone(summary.score)}
        />
        <StatCard
          title="Kritische Prozesse"
          value={`${summary.criticalProcesses}`}
          subtitle={`${businessProcesses.length} Prozesse im Register`}
          tone={businessProcesses.length ? 'default' : 'alert'}
        />
        <StatCard
          title="Single Points"
          value={`${summary.singlePointsOfFailure}`}
          subtitle={`${dependencies.length} Abhängigkeiten im Register`}
          tone={summary.singlePointsOfFailure ? 'alert' : dependencies.length ? 'good' : 'default'}
        />
        <StatCard
          title="Übungsstatus"
          value={`${scenarios.length - summary.untestedScenarios}/${scenarios.length || 0}`}
          subtitle={summary.untestedScenarios ? `${summary.untestedScenarios} ungetestet` : 'Alle Szenarien adressiert'}
          tone={summary.untestedScenarios ? 'warn' : 'good'}
        />
      </section>

      <section className="content-grid two-column">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Vorlagen aus Branchenmodul</p>
              <h3>Operative Resilienzbausteine einspielen</h3>
            </div>
          </div>
          <div className="generator-grid">
            <button type="button" className="generator-card" onClick={onGenerateProcessTemplates}>
              <div className="report-head compact-heading">
                <div>
                  <h3>Prozessvorlagen</h3>
                  <p className="muted small">{processTemplates.length} Vorlagen verfügbar</p>
                </div>
                <Layers3 size={18} />
              </div>
            </button>
            <button type="button" className="generator-card" onClick={onGenerateDependencyTemplates}>
              <div className="report-head compact-heading">
                <div>
                  <h3>Abhängigkeitsvorlagen</h3>
                  <p className="muted small">{dependencyTemplates.length} Vorlagen verfügbar</p>
                </div>
                <Route size={18} />
              </div>
            </button>
            <button type="button" className="generator-card" onClick={onGenerateScenarioTemplates}>
              <div className="report-head compact-heading">
                <div>
                  <h3>Szenariovorlagen</h3>
                  <p className="muted small">{scenarioTemplates.length} Vorlagen verfügbar</p>
                </div>
                <AlertTriangle size={18} />
              </div>
            </button>
            <button type="button" className="generator-card" onClick={onGenerateExerciseTemplates}>
              <div className="report-head compact-heading">
                <div>
                  <h3>Übungsvorlagen</h3>
                  <p className="muted small">{exerciseTemplates.length} Vorlagen verfügbar</p>
                </div>
                <Wrench size={18} />
              </div>
            </button>
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Heatmap</p>
              <h3>Risikobild aus Szenarien</h3>
            </div>
          </div>
          <div className="heatmap-grid">
            {Array.from({ length: 5 }, (_, impactIndex) => {
              const impact = 5 - impactIndex;
              return Array.from({ length: 5 }, (_, likelihoodIndex) => {
                const likelihood = likelihoodIndex + 1;
                const count = scenarios.filter((item) => item.impact === impact && item.likelihood === likelihood).length;
                const score = impact * likelihood;
                return (
                  <div key={`${impact}-${likelihood}`} className={`heatmap-cell ${riskChipClass(score)}`}>
                    <strong>{count || '–'}</strong>
                    <span>I{impact} · W{likelihood}</span>
                  </div>
                );
              });
            }).flat()}
          </div>
          <p className="muted small top-gap">
            Die Matrix zeigt, wie viele Szenarien je Kombination aus Auswirkung und Wahrscheinlichkeit erfasst sind.
          </p>
        </article>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BIA</p>
            <h3>Geschäftskritische Prozesse</h3>
          </div>
          <button type="button" className="button secondary" onClick={onCreateProcess}>Prozess hinzufügen</button>
        </div>
        <div className="work-list">
          {businessProcesses.map((process) => (
            <article key={process.id} className="work-card">
              <div className="work-card-head">
                <div>
                  <strong>{process.title || 'Neuer Prozess'}</strong>
                  <p className="muted small">MTPD {process.mtpdHours || '–'} h · RTO {process.rtoHours || '–'} h · RPO {process.rpoHours || '–'} h</p>
                </div>
                <div className="chip-row">
                  <span className={`chip ${process.criticality === 'kritisch' ? 'danger' : process.criticality === 'hoch' ? 'warn' : 'outline'}`}>{process.criticality}</span>
                  <button type="button" className="icon-button" onClick={() => onDeleteProcess(process.id)}>×</button>
                </div>
              </div>
              <div className="form-grid two-column">
                <label>
                  Prozessbezeichnung
                  <input value={process.title} onChange={(event) => onUpdateProcess(process.id, { title: event.target.value })} />
                </label>
                <label>
                  Verantwortlich
                  <input value={process.owner} onChange={(event) => onUpdateProcess(process.id, { owner: event.target.value })} />
                </label>
                <label>
                  Kritikalität
                  <select value={process.criticality} onChange={(event) => onUpdateProcess(process.id, { criticality: event.target.value as StructureCriticality })}>
                    {criticalityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Manueller Workaround
                  <div className="checkbox-row top-gap">
                    <input type="checkbox" checked={process.manualWorkaround} onChange={(event) => onUpdateProcess(process.id, { manualWorkaround: event.target.checked })} />
                    <span>Für diesen Prozess gibt es einen dokumentierten manuellen Notbetrieb.</span>
                  </div>
                </label>
                <label>
                  MTPD in Stunden
                  <input value={process.mtpdHours} onChange={(event) => onUpdateProcess(process.id, { mtpdHours: event.target.value })} />
                </label>
                <label>
                  RTO in Stunden
                  <input value={process.rtoHours} onChange={(event) => onUpdateProcess(process.id, { rtoHours: event.target.value })} />
                </label>
                <label>
                  RPO in Stunden
                  <input value={process.rpoHours} onChange={(event) => onUpdateProcess(process.id, { rpoHours: event.target.value })} />
                </label>
                <label>
                  Outputs / Services
                  <input value={process.outputs} onChange={(event) => onUpdateProcess(process.id, { outputs: event.target.value })} />
                </label>
                <label className="wide">
                  Kritische Abhängigkeiten
                  <textarea rows={2} value={process.dependencies} onChange={(event) => onUpdateProcess(process.id, { dependencies: event.target.value })} />
                </label>
                <label className="wide">
                  Hinweise
                  <textarea rows={3} value={process.notes} onChange={(event) => onUpdateProcess(process.id, { notes: event.target.value })} />
                </label>
              </div>
            </article>
          ))}
          {!businessProcesses.length ? <div className="inline-note"><ShieldAlert size={16} /><span>Noch keine Prozesse erfasst.</span></div> : null}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Abhängigkeiten</p>
            <h3>Single Points of Failure sichtbar machen</h3>
          </div>
          <button type="button" className="button secondary" onClick={onCreateDependency}>Abhängigkeit hinzufügen</button>
        </div>
        <div className="work-list">
          {dependencies.map((dependency) => (
            <article key={dependency.id} className="work-card">
              <div className="work-card-head">
                <div>
                  <strong>{dependency.title || 'Neue Abhängigkeit'}</strong>
                  <p className="muted small">{dependency.category} · Fallback {dependency.fallback || 'offen'}</p>
                </div>
                <div className="chip-row">
                  {dependency.singlePointOfFailure ? <span className="chip danger">Single Point</span> : <span className="chip success">Redundanz</span>}
                  <button type="button" className="icon-button" onClick={() => onDeleteDependency(dependency.id)}>×</button>
                </div>
              </div>
              <div className="form-grid two-column">
                <label>
                  Bezeichnung
                  <input value={dependency.title} onChange={(event) => onUpdateDependency(dependency.id, { title: event.target.value })} />
                </label>
                <label>
                  Kategorie
                  <select value={dependency.category} onChange={(event) => onUpdateDependency(dependency.id, { category: event.target.value as DependencyCategory })}>
                    {dependencyCategories.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Kritikalität
                  <select value={dependency.criticality} onChange={(event) => onUpdateDependency(dependency.id, { criticality: event.target.value as StructureCriticality })}>
                    {criticalityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  SPOF
                  <div className="checkbox-row top-gap">
                    <input type="checkbox" checked={dependency.singlePointOfFailure} onChange={(event) => onUpdateDependency(dependency.id, { singlePointOfFailure: event.target.checked })} />
                    <span>Abhängigkeit ist derzeit ohne belastbare Alternative.</span>
                  </div>
                </label>
                <label>
                  Fallback
                  <input value={dependency.fallback} onChange={(event) => onUpdateDependency(dependency.id, { fallback: event.target.value })} />
                </label>
                <label>
                  Vertrag / SLA
                  <input value={dependency.contractReference} onChange={(event) => onUpdateDependency(dependency.id, { contractReference: event.target.value })} />
                </label>
                <label>
                  Kontakt
                  <input value={dependency.contact} onChange={(event) => onUpdateDependency(dependency.id, { contact: event.target.value })} />
                </label>
                <label className="wide">
                  Hinweise
                  <textarea rows={3} value={dependency.notes} onChange={(event) => onUpdateDependency(dependency.id, { notes: event.target.value })} />
                </label>
              </div>
            </article>
          ))}
          {!dependencies.length ? <div className="inline-note"><Route size={16} /><span>Noch keine Abhängigkeiten erfasst.</span></div> : null}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Krisenszenarien</p>
            <h3>Risikobild und Playbooks</h3>
          </div>
          <button type="button" className="button secondary" onClick={onCreateScenario}>Szenario hinzufügen</button>
        </div>
        <div className="work-list">
          {scenarios.map((scenario) => {
            const riskScore = scenario.likelihood * scenario.impact;
            return (
              <article key={scenario.id} className="work-card">
                <div className="work-card-head">
                  <div>
                    <strong>{scenario.title || 'Neues Szenario'}</strong>
                    <p className="muted small">{scenario.category || 'Kategorie offen'} · Status {formatStatus(scenario.exerciseStatus)}</p>
                  </div>
                  <div className="chip-row">
                    <span className={`chip ${riskChipClass(riskScore)}`}>Risiko {riskScore}</span>
                    <button type="button" className="icon-button" onClick={() => onDeleteScenario(scenario.id)}>×</button>
                  </div>
                </div>
                <div className="form-grid two-column">
                  <label>
                    Szenario
                    <input value={scenario.title} onChange={(event) => onUpdateScenario(scenario.id, { title: event.target.value })} />
                  </label>
                  <label>
                    Kategorie
                    <input value={scenario.category} onChange={(event) => onUpdateScenario(scenario.id, { category: event.target.value })} />
                  </label>
                  <label>
                    Verantwortlich
                    <input value={scenario.owner} onChange={(event) => onUpdateScenario(scenario.id, { owner: event.target.value })} />
                  </label>
                  <label>
                    Übungsstatus
                    <select value={scenario.exerciseStatus} onChange={(event) => onUpdateScenario(scenario.id, { exerciseStatus: event.target.value as ScenarioItem['exerciseStatus'] })}>
                      {scenarioStatuses.map((option) => <option key={option} value={option}>{formatStatus(option)}</option>)}
                    </select>
                  </label>
                  <label>
                    Wahrscheinlichkeit
                    <select value={String(scenario.likelihood)} onChange={(event) => onUpdateScenario(scenario.id, { likelihood: Number(event.target.value) })}>
                      {[1, 2, 3, 4, 5].map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Auswirkung
                    <select value={String(scenario.impact)} onChange={(event) => onUpdateScenario(scenario.id, { impact: Number(event.target.value) })}>
                      {[1, 2, 3, 4, 5].map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Letzte Übung
                    <input type="date" value={scenario.lastExerciseDate} onChange={(event) => onUpdateScenario(scenario.id, { lastExerciseDate: event.target.value })} />
                  </label>
                  <label>
                    Nächste Übung
                    <input type="date" value={scenario.nextExerciseDate} onChange={(event) => onUpdateScenario(scenario.id, { nextExerciseDate: event.target.value })} />
                  </label>
                  <label className="wide">
                    Beschreibung
                    <textarea rows={3} value={scenario.description} onChange={(event) => onUpdateScenario(scenario.id, { description: event.target.value })} />
                  </label>
                  <label className="wide">
                    Playbook / Reaktionslogik
                    <textarea rows={3} value={scenario.playbook} onChange={(event) => onUpdateScenario(scenario.id, { playbook: event.target.value })} />
                  </label>
                  <label>
                    Betroffene Prozesse
                    <select multiple size={Math.min(Math.max(businessProcesses.length, 2), 6)} value={scenario.linkedProcessIds} onChange={(event) => onUpdateScenario(scenario.id, { linkedProcessIds: getSelectedValues(event.currentTarget) })}>
                      {businessProcesses.map((item) => <option key={item.id} value={item.id}>{item.title || 'Prozess'}</option>)}
                    </select>
                  </label>
                  <label>
                    Betroffene Abhängigkeiten
                    <select multiple size={Math.min(Math.max(dependencies.length, 2), 6)} value={scenario.linkedDependencyIds} onChange={(event) => onUpdateScenario(scenario.id, { linkedDependencyIds: getSelectedValues(event.currentTarget) })}>
                      {dependencies.map((item) => <option key={item.id} value={item.id}>{item.title || 'Abhängigkeit'}</option>)}
                    </select>
                  </label>
                  <label className="wide">
                    Betroffene Assets
                    <select multiple size={Math.min(Math.max(assets.length, 2), 6)} value={scenario.linkedAssetIds} onChange={(event) => onUpdateScenario(scenario.id, { linkedAssetIds: getSelectedValues(event.currentTarget) })}>
                      {assets.map((item) => <option key={item.id} value={item.id}>{item.name || 'Asset'}</option>)}
                    </select>
                  </label>
                  <label className="wide">
                    Hinweise
                    <textarea rows={3} value={scenario.notes} onChange={(event) => onUpdateScenario(scenario.id, { notes: event.target.value })} />
                  </label>
                </div>
                <div className="summary-strip">
                  <span>Prozesse: {scenario.linkedProcessIds.map((id) => processLookup.get(id)).filter(Boolean).join(', ') || '–'}</span>
                  <span>Abhängigkeiten: {scenario.linkedDependencyIds.map((id) => dependencyLookup.get(id)).filter(Boolean).join(', ') || '–'}</span>
                  <span>Assets: {scenario.linkedAssetIds.map((id) => assetLookup.get(id)).filter(Boolean).join(', ') || '–'}</span>
                </div>
              </article>
            );
          })}
          {!scenarios.length ? <div className="inline-note"><AlertTriangle size={16} /><span>Noch keine Krisenszenarien erfasst.</span></div> : null}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Übungen & Tests</p>
            <h3>Lernschleife und Nachsteuerung</h3>
          </div>
          <button type="button" className="button secondary" onClick={onCreateExercise}>Übung hinzufügen</button>
        </div>
        <div className="work-list">
          {exercises.map((exercise) => (
            <article key={exercise.id} className="work-card">
              <div className="work-card-head">
                <div>
                  <strong>{exercise.title || 'Neue Übung'}</strong>
                  <p className="muted small">{exercise.exerciseType} · {formatExerciseResult(exercise.result)}</p>
                </div>
                <div className="chip-row">
                  <span className={`chip ${exercise.result === 'passed' ? 'success' : exercise.result === 'failed' ? 'danger' : 'warn'}`}>{formatExerciseResult(exercise.result)}</span>
                  <button type="button" className="icon-button" onClick={() => onDeleteExercise(exercise.id)}>×</button>
                </div>
              </div>
              <div className="form-grid two-column">
                <label>
                  Übungstitel
                  <input value={exercise.title} onChange={(event) => onUpdateExercise(exercise.id, { title: event.target.value })} />
                </label>
                <label>
                  Zugeordnetes Szenario
                  <select value={exercise.scenarioId} onChange={(event) => onUpdateExercise(exercise.id, { scenarioId: event.target.value })}>
                    <option value="">Kein Szenario</option>
                    {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.title || 'Szenario'}</option>)}
                  </select>
                </label>
                <label>
                  Übungstyp
                  <select value={exercise.exerciseType} onChange={(event) => onUpdateExercise(exercise.id, { exerciseType: event.target.value as ExerciseItem['exerciseType'] })}>
                    {exerciseTypes.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Ergebnis
                  <select value={exercise.result} onChange={(event) => onUpdateExercise(exercise.id, { result: event.target.value as ExerciseItem['result'] })}>
                    {exerciseResults.map((option) => <option key={option} value={option}>{formatExerciseResult(option)}</option>)}
                  </select>
                </label>
                <label>
                  Termin
                  <input type="date" value={exercise.exerciseDate} onChange={(event) => onUpdateExercise(exercise.id, { exerciseDate: event.target.value })} />
                </label>
                <label>
                  Nächster Termin
                  <input type="date" value={exercise.nextExerciseDate} onChange={(event) => onUpdateExercise(exercise.id, { nextExerciseDate: event.target.value })} />
                </label>
                <label>
                  Verantwortlich
                  <input value={exercise.owner} onChange={(event) => onUpdateExercise(exercise.id, { owner: event.target.value })} />
                </label>
                <label>
                  Teilnehmer
                  <input value={exercise.participants} onChange={(event) => onUpdateExercise(exercise.id, { participants: event.target.value })} />
                </label>
                <label className="wide">
                  Findings / Lessons Learned
                  <textarea rows={3} value={exercise.findings} onChange={(event) => onUpdateExercise(exercise.id, { findings: event.target.value })} />
                </label>
                <label className="wide">
                  Folgeaktionen (IDs, kommagetrennt)
                  <input value={exercise.followUpActionIds.join(', ')} onChange={(event) => onUpdateExercise(exercise.id, { followUpActionIds: event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean) })} />
                </label>
                <label className="wide">
                  Hinweise
                  <textarea rows={3} value={exercise.notes} onChange={(event) => onUpdateExercise(exercise.id, { notes: event.target.value })} />
                </label>
              </div>
              <div className="summary-strip">
                <span>Szenario: {scenarioLookup.get(exercise.scenarioId) || '–'}</span>
                <span>Folgeaktionen: {exercise.followUpActionIds.length ? exercise.followUpActionIds.join(', ') : '–'}</span>
              </div>
            </article>
          ))}
          {!exercises.length ? <div className="inline-note"><Wrench size={16} /><span>Noch keine Übungen dokumentiert.</span></div> : null}
        </div>
      </section>
    </div>
  );
}
