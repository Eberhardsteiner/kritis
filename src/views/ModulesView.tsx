import { Upload, CheckCircle2, Layers3 } from 'lucide-react';
import type { SectorModuleDefinition } from '../types';

interface ImportFeedback {
  type: 'success' | 'error';
  text: string;
  details?: string[];
}

interface ModulesViewProps {
  builtInModules: SectorModuleDefinition[];
  uploadedModules: SectorModuleDefinition[];
  selectedModuleId: string;
  onSelectModule: (moduleId: string) => void;
  onImportFiles: (files: FileList | null) => void;
  feedback: ImportFeedback | null;
}

export function ModulesView({
  builtInModules,
  uploadedModules,
  selectedModuleId,
  onSelectModule,
  onImportFiles,
  feedback,
}: ModulesViewProps) {
  return (
    <div className="view-stack">
      <section className="content-grid two-column">
        <article className="card">
          <p className="eyebrow">Containerlösung</p>
          <h2>Branchenparameter per JSON laden</h2>
          <p>
            Phase 2 unterstützt additive Branchenmodule mit Zusatzfragen, Gewichtslogik,
            KRITIS-Erweiterungen sowie optionalen Maßnahmen- und Nachweisvorlagen.
          </p>
          <label className="upload-box">
            <input type="file" accept="application/json,.json" onChange={(event) => onImportFiles(event.target.files)} />
            <Upload size={18} />
            <div>
              <strong>JSON-Modul importieren</strong>
              <p>Unterstützt werden schemaVersion 1 sowie optionale Templates für Maßnahmen und Nachweise.</p>
            </div>
          </label>

          {feedback ? (
            <div className={`feedback-box ${feedback.type}`}>
              <strong>{feedback.type === 'success' ? 'Import erfolgreich' : 'Importfehler'}</strong>
              <p>{feedback.text}</p>
              {feedback.details?.length ? (
                <ul>
                  {feedback.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </article>

        <article className="card">
          <p className="eyebrow">Schema v1</p>
          <h3>Unterstützte Felder</h3>
          <div className="schema-grid">
            <div>
              <strong>Pflichtfelder</strong>
              <p>schemaVersion, id, name, version, description</p>
            </div>
            <div>
              <strong>Optional</strong>
              <p>sectorCategory, domainWeightAdjustments, additionalQuestions, kritisExtension</p>
            </div>
            <div>
              <strong>Phase 2 erweitert</strong>
              <p>recommendedActions, evidenceTemplates, uiHints.focusAreas, uiHints.accentLabel</p>
            </div>
            <div>
              <strong>Grenzen aktuell</strong>
              <p>Keine neuen Domains, keine Mehrmandanten- oder Rechte-Logik, keine Server-Persistenz</p>
            </div>
          </div>
        </article>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Verfügbare Module</p>
            <h3>Profile auswählen</h3>
          </div>
          <div className="inline-note">
            <Layers3 size={16} />
            <span>Importierte Module überschreiben frühere Uploads mit gleicher ID.</span>
          </div>
        </div>

        <div className="module-grid">
          {[...builtInModules, ...uploadedModules].map((module) => {
            const isSelected = selectedModuleId === module.id;
            return (
              <button
                key={module.id}
                type="button"
                className={`module-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectModule(module.id)}
              >
                <div className="module-card-head">
                  <div>
                    <p className="eyebrow">{uploadedModules.some((entry) => entry.id === module.id) ? 'Upload' : 'Integriert'}</p>
                    <h4>{module.name}</h4>
                  </div>
                  {isSelected ? <CheckCircle2 size={18} /> : null}
                </div>
                <p>{module.description}</p>
                <div className="chip-row top-gap">
                  <span className="chip outline">Version {module.version}</span>
                  {module.sectorCategory ? <span className="chip outline">{module.sectorCategory}</span> : null}
                  <span className="chip outline">{module.additionalQuestions?.length ?? 0} Zusatzfragen</span>
                  <span className="chip outline">{module.recommendedActions?.length ?? 0} Maßnahmenvorlagen</span>
                  <span className="chip outline">{module.evidenceTemplates?.length ?? 0} Nachweisvorlagen</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
