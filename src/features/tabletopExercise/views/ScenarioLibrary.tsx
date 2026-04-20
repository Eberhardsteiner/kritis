import { useState } from 'react';
import { FileUp, PlayCircle, Trash2 } from 'lucide-react';
import { safeParseScenario } from '../schema';
import type { Scenario } from '../types';

interface ScenarioLibraryProps {
  builtInScenarios: Scenario[];
  importedScenarios: Scenario[];
  activeSessionScenarioId?: string;
  onStartExercise: (scenario: Scenario) => void;
  onImportScenario?: (scenario: Scenario) => void;
  onRemoveImported?: (scenarioId: string) => void;
  canEdit: boolean;
}

export function ScenarioLibrary({
  builtInScenarios,
  importedScenarios,
  activeSessionScenarioId,
  onStartExercise,
  onImportScenario,
  onRemoveImported,
  canEdit,
}: ScenarioLibraryProps) {
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  function handleFileImport(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setImportError(null);
    setImportSuccess(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result ?? ''));
        const result = safeParseScenario(raw);
        if (!result.success) {
          const firstIssue = result.error.issues[0];
          setImportError(
            `Importfehler${firstIssue?.path?.length ? ` unter ${firstIssue.path.join('.')}` : ''}: ${firstIssue?.message ?? 'unbekannt'}`,
          );
          return;
        }
        onImportScenario?.(result.data as Scenario);
        setImportSuccess(`Szenario „${result.data.title}" importiert.`);
      } catch (error) {
        setImportError(`JSON konnte nicht gelesen werden: ${String(error)}`);
      }
    };
    reader.onerror = () => {
      setImportError(`Datei konnte nicht gelesen werden: ${String(reader.error)}`);
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function renderScenarioCard(scenario: Scenario, isCustom: boolean) {
    const isActive = scenario.id === activeSessionScenarioId;
    return (
      <article key={scenario.id} className="nested-card">
        <div className="question-title-row">
          <strong>{scenario.title}</strong>
          <div className="chip-row">
            <span className="chip outline">{scenario.sectors.join(', ')}</span>
            <span className="chip outline">{scenario.durationMinutes} min</span>
            {isCustom ? <span className="chip warn">Importiert</span> : null}
            {isActive ? <span className="chip success">Läuft gerade</span> : null}
          </div>
        </div>
        <p className="muted small top-gap">{scenario.summary}</p>
        <div className="chip-row top-gap">
          <span className="chip outline">{scenario.roles.length} Rollen</span>
          <span className="chip outline">{scenario.timeline.length} Phasen</span>
          <span className="chip outline">{scenario.evaluationCriteria.length} Kriterien</span>
        </div>
        <div className="hero-actions top-gap">
          <button
            type="button"
            className="button"
            onClick={() => onStartExercise(scenario)}
            disabled={!canEdit || isActive}
          >
            <PlayCircle size={14} />
            {isActive ? 'Übung läuft' : 'Übung starten'}
          </button>
          {isCustom && onRemoveImported ? (
            <button
              type="button"
              className="button secondary"
              onClick={() => onRemoveImported(scenario.id)}
              disabled={!canEdit || isActive}
              aria-label={`Importiertes Szenario "${scenario.title}" entfernen`}
            >
              <Trash2 size={14} />
              Entfernen
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <section className="card" aria-label="Szenario-Bibliothek">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Tabletop-Bibliothek · § 18 KRITISDachG</p>
          <h3>Szenarien ({builtInScenarios.length + importedScenarios.length})</h3>
        </div>
        {onImportScenario ? (
          <label className="button secondary" aria-disabled={!canEdit}>
            <FileUp size={14} />
            JSON importieren
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleFileImport}
              disabled={!canEdit}
            />
          </label>
        ) : null}
      </div>

      {importError ? (
        <div className="inline-note top-gap">
          <strong>Import fehlgeschlagen:</strong> {importError}
        </div>
      ) : null}
      {importSuccess ? (
        <div className="inline-note top-gap">
          <strong>Import erfolgreich:</strong> {importSuccess}
        </div>
      ) : null}

      <div className="top-gap">
        <p className="eyebrow">Startfertige Szenarien</p>
        <div className="priority-list top-gap">
          {builtInScenarios.map((scenario) => renderScenarioCard(scenario, false))}
        </div>
      </div>

      <div className="top-gap">
        <p className="eyebrow">Mandantenspezifisch</p>
        {importedScenarios.length === 0 ? (
          <p className="muted top-gap">
            Noch keine mandantenspezifischen Szenarien importiert. Nutzen Sie „JSON importieren", um
            eigene Übungsvorlagen hinzuzufügen.
          </p>
        ) : (
          <div className="priority-list top-gap">
            {importedScenarios.map((scenario) => renderScenarioCard(scenario, true))}
          </div>
        )}
      </div>
    </section>
  );
}
