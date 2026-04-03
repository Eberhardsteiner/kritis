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
            Paket 1 unterstützt additive Branchenmodule. Ein Modul kann Domänengewichte
            anpassen, Zusatzfragen ergänzen und KRITIS-Hinweise erweitern.
          </p>
          <label className="upload-box">
            <input type="file" accept="application/json,.json" onChange={(event) => onImportFiles(event.target.files)} />
            <Upload size={18} />
            <div>
              <strong>JSON-Modul importieren</strong>
              <p>Unterstützt werden aktuell schemaVersion 1, Zusatzfragen und Gewichtslogik.</p>
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
              <strong>Zusatzfragen</strong>
              <p>domainId, title, prompt, guidance, recommendation, weight, evidenceHint</p>
            </div>
            <div>
              <strong>Grenzen in Paket 1</strong>
              <p>Keine neuen Domains, keine Backend-Persistenz, keine Rechte-Logik</p>
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
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
