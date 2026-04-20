import { Dices, Library, PlayCircle } from 'lucide-react';
import { ExerciseReview } from '../features/tabletopExercise/views/ExerciseReview';
import { ExerciseSession } from '../features/tabletopExercise/views/ExerciseSession';
import { ScenarioLibrary } from '../features/tabletopExercise/views/ScenarioLibrary';
import type {
  ExerciseSession as ExerciseSessionState,
  Scenario,
} from '../features/tabletopExercise/types';

type TabletopTab = 'library' | 'session' | 'review';

export interface TabletopExerciseViewProps {
  builtInScenarios: Scenario[];
  importedScenarios: Scenario[];
  currentSession: ExerciseSessionState | null;
  activeScenario: Scenario | null;
  archivedSessions: ExerciseSessionState[];
  canEdit: boolean;
  canExport: boolean;
  activeTab: TabletopTab;
  onSelectTab: (tab: TabletopTab) => void;
  onStartExercise: (scenario: Scenario) => void;
  onImportScenario: (scenario: Scenario) => void;
  onRemoveImportedScenario: (scenarioId: string) => void;
  onBeginSession: () => void;
  onAcknowledgeInject: (injectId: string) => void;
  onRecordDecision: (decisionId: string, optionId: string) => void;
  onAdvanceStep: () => void;
  onCompleteSession: () => void;
  onAbandonSession: () => void;
  onUpdateNotes: (notes: string) => void;
  onCreateEvidenceFromResult: () => void;
  onExportResultJson: () => void;
}

export function TabletopExerciseView({
  builtInScenarios,
  importedScenarios,
  currentSession,
  activeScenario,
  archivedSessions,
  canEdit,
  canExport,
  activeTab,
  onSelectTab,
  onStartExercise,
  onImportScenario,
  onRemoveImportedScenario,
  onBeginSession,
  onAcknowledgeInject,
  onRecordDecision,
  onAdvanceStep,
  onCompleteSession,
  onAbandonSession,
  onUpdateNotes,
  onCreateEvidenceFromResult,
  onExportResultJson,
}: TabletopExerciseViewProps) {
  const hasSession = Boolean(currentSession && activeScenario);
  const hasResult = Boolean(currentSession?.result);

  return (
    <div className="view-stack">
      <section className="card" aria-label="Tabletop-Übungen · § 18 KRITISDachG">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Tabletop-Übung · § 18 KRITISDachG</p>
            <h2>Krisenstabs-Übungen durchführen und nachweisen</h2>
          </div>
          <span className="chip outline">
            <Dices size={12} />
            {builtInScenarios.length + importedScenarios.length} Szenarien
          </span>
        </div>
        <p className="top-gap">
          Führen Sie kuratierte oder mandantenspezifische Tabletop-Szenarien durch, bewerten Sie
          die Entscheidungen strukturiert und hinterlegen Sie das Ergebnis als § 18-Übungsnachweis.
        </p>
        <nav className="chip-row top-gap" role="tablist" aria-label="Tabletop-Ansichten">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'library'}
            className={`chip ${activeTab === 'library' ? 'warn' : 'outline'}`}
            onClick={() => onSelectTab('library')}
          >
            <Library size={12} />
            Szenario-Bibliothek
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'session'}
            className={`chip ${activeTab === 'session' ? 'warn' : 'outline'}`}
            onClick={() => onSelectTab('session')}
            disabled={!hasSession}
          >
            <PlayCircle size={12} />
            Laufende Übung
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'review'}
            className={`chip ${activeTab === 'review' ? 'warn' : 'outline'}`}
            onClick={() => onSelectTab('review')}
            disabled={!hasResult}
          >
            Auswertung
          </button>
        </nav>
      </section>

      {activeTab === 'library' ? (
        <ScenarioLibrary
          builtInScenarios={builtInScenarios}
          importedScenarios={importedScenarios}
          activeSessionScenarioId={currentSession?.scenarioId}
          onStartExercise={onStartExercise}
          onImportScenario={canEdit ? onImportScenario : undefined}
          onRemoveImported={canEdit ? onRemoveImportedScenario : undefined}
          canEdit={canEdit}
        />
      ) : null}

      {activeTab === 'session' ? (
        currentSession && activeScenario ? (
          <ExerciseSession
            session={currentSession}
            scenario={activeScenario}
            onStart={onBeginSession}
            onAcknowledgeInject={onAcknowledgeInject}
            onRecordDecision={onRecordDecision}
            onAdvanceStep={onAdvanceStep}
            onCompleteSession={onCompleteSession}
            onAbandonSession={onAbandonSession}
            onUpdateNotes={onUpdateNotes}
          />
        ) : (
          <section className="card" aria-label="Keine aktive Übung">
            <p className="muted">
              Keine aktive Übung. Starten Sie eine Übung aus der Szenario-Bibliothek.
            </p>
          </section>
        )
      ) : null}

      {activeTab === 'review' ? (
        currentSession && activeScenario ? (
          <ExerciseReview
            session={currentSession}
            scenario={activeScenario}
            onCreateEvidence={canEdit ? onCreateEvidenceFromResult : undefined}
            onExportJson={canExport ? onExportResultJson : undefined}
          />
        ) : (
          <section className="card" aria-label="Keine Auswertung">
            <p className="muted">Noch keine Auswertung verfügbar.</p>
          </section>
        )
      ) : null}

      {archivedSessions.length > 0 ? (
        <section className="card" aria-label="Archivierte Übungsläufe">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Archivierte Übungen</p>
              <h3>{archivedSessions.length} abgeschlossene Übungsläufe</h3>
            </div>
          </div>
          <ul className="plain-list top-gap">
            {archivedSessions.slice(0, 10).map((archived) => (
              <li key={archived.id}>
                <strong>{archived.scenarioId}</strong>
                <p className="muted small">
                  {archived.status === 'completed'
                    ? `Abgeschlossen · ${archived.result?.percentage.toFixed(1).replace('.', ',') ?? '—'} %`
                    : 'Abgebrochen'}
                  {archived.endedAt ? ` · ${new Date(archived.endedAt).toLocaleString('de-DE')}` : null}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
