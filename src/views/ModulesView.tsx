import { CheckCircle2, Layers3, Upload } from 'lucide-react';
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
  const allModules = [...builtInModules, ...uploadedModules];

  return (
    <div className="view-stack">
      <section className="content-grid two-column">
        <article className="card">
          <p className="eyebrow">Containerlösung</p>
          <h2>Branchenparameter per JSON laden</h2>
          <p>
            Phase 4 erweitert die Module zusätzlich um Dokumentenordner, Evidenz-Metadaten,
            Zielprofile, Rollenvorlagen und Audit-Checklist-Einträge. So lassen sich
            branchenspezifische Anforderungen ohne Codeänderung in Analyse, Bibliothek und
            Zertifizierungslogik einspielen.
          </p>
          <label className="upload-box">
            <input type="file" accept="application/json,.json" onChange={(event) => onImportFiles(event.target.files)} />
            <Upload size={20} />
            <div>
              <strong>JSON-Modul importieren</strong>
              <p className="muted">Ein neues Modul wird validiert, gespeichert und direkt aktiviert.</p>
            </div>
          </label>

          {feedback ? (
            <div className={`feedback-box ${feedback.type}`}>
              <strong>{feedback.text}</strong>
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
          <p className="eyebrow">Unterstützte Bausteine</p>
          <h3>Schemaumfang für Branchenmodule</h3>
          <div className="schema-grid top-gap">
            <div>
              <strong>Analyse</strong>
              <p className="muted small">Zusatzfragen, Domain-Gewichte, Fokusbereiche</p>
            </div>
            <div>
              <strong>Umsetzung</strong>
              <p className="muted small">Maßnahmen-, Nachweis- und Dokumentordner-Vorlagen</p>
            </div>
            <div>
              <strong>Governance</strong>
              <p className="muted small">Rollenvorlagen und Ziel-/Benchmarkprofile</p>
            </div>
            <div>
              <strong>Audit</strong>
              <p className="muted small">KRITIS-Hinweise, Zusatzanforderungen und Prüfchecklisten</p>
            </div>
          </div>
        </article>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Verfügbare Module</p>
            <h3>Aktives Branchenprofil auswählen</h3>
          </div>
          <div className="chip-row">
            <span className="chip outline">{allModules.length} Module verfügbar</span>
          </div>
        </div>

        <div className="module-grid">
          {allModules.map((module) => {
            const isSelected = selectedModuleId === module.id;
            const isBuiltIn = builtInModules.some((entry) => entry.id === module.id);

            return (
              <button
                key={module.id}
                type="button"
                className={`module-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectModule(module.id)}
              >
                <div className="module-card-head">
                  <div>
                    <p className="eyebrow">{isBuiltIn ? 'Integriert' : 'Upload'}</p>
                    <h4>{module.name}</h4>
                  </div>
                  {isSelected ? <CheckCircle2 size={18} /> : null}
                </div>
                <p>{module.description}</p>
                <div className="chip-row top-gap">
                  <span className="chip outline">Version {module.version}</span>
                  {module.sectorCategory ? <span className="chip outline">{module.sectorCategory}</span> : null}
                  <span className="chip outline">{module.additionalQuestions?.length ?? 0} Zusatzfragen</span>
                  <span className="chip outline">{module.recommendedActions?.length ?? 0} Maßnahmen</span>
                  <span className="chip outline">{module.evidenceTemplates?.length ?? 0} Nachweise</span>
                  <span className="chip outline">{module.roleTemplates?.length ?? 0} Rollen</span>
                  <span className="chip outline">{module.auditChecklist?.length ?? 0} Auditpunkte</span>
                </div>
                {module.maturityProfile?.targetOverall ? (
                  <p className="muted small top-gap">
                    Zielkorridor gesamt: {module.maturityProfile.targetOverall}%
                  </p>
                ) : null}
                {module.uiHints?.accentLabel ? (
                  <p className="muted small">{module.uiHints.accentLabel}</p>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="inline-note top-gap">
          <Layers3 size={16} />
          <span>Bei gleicher Modul-ID wird ein vorhandenes Upload-Modul aktualisiert.</span>
        </div>
      </section>
    </div>
  );
}
