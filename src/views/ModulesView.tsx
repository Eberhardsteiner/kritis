import { CheckCircle2, Layers3, Package, Upload } from 'lucide-react';
import type { ModulePackContainer, ModulePackManifest, ModulePackRegistryEntry, SectorModuleDefinition } from '../types';
import { buildSyntheticManifestFromModule } from '../lib/moduleRegistry';

interface ImportFeedback {
  type: 'success' | 'error';
  text: string;
  details?: string[];
}

interface ModulesViewProps {
  builtInContainers: ModulePackContainer[];
  availableModules: SectorModuleDefinition[];
  registryEntries: ModulePackRegistryEntry[];
  selectedModuleId: string;
  onSelectModule: (moduleId: string) => void;
  onImportFiles: (files: FileList | null) => void;
  onActivatePack: (entryId: string) => void;
  onRetirePack: (entryId: string) => void;
  canManageRegistry: boolean;
  feedback: ImportFeedback | null;
}

function buildPackStatusLabel(status: ModulePackRegistryEntry['status']): string {
  if (status === 'released') return 'Freigegeben';
  if (status === 'superseded') return 'Überholt';
  if (status === 'retired') return 'Stillgelegt';
  return 'Entwurf';
}

function groupRegistryEntries(entries: ModulePackRegistryEntry[]) {
  const groups = new Map<string, ModulePackRegistryEntry[]>();
  entries.forEach((entry) => {
    const key = entry.packKey;
    const current = groups.get(key) ?? [];
    current.push(entry);
    groups.set(key, current);
  });

  return [...groups.entries()]
    .map(([packKey, versions]) => ({
      packKey,
      versions: [...versions].sort((left, right) => {
        const rightTime = right.releasedAt || right.uploadedAt;
        const leftTime = left.releasedAt || left.uploadedAt;
        return String(rightTime).localeCompare(String(leftTime));
      }),
    }))
    .sort((left, right) => left.packKey.localeCompare(right.packKey));
}

function describeModuleSource(
  module: SectorModuleDefinition,
  builtInContainers: ModulePackContainer[],
  registryEntries: ModulePackRegistryEntry[],
): {
  manifest: ModulePackManifest;
  sourceLabel: string;
  releasedOverlayCount: number;
  formatLabel: string;
} {
  const builtInContainer = builtInContainers.find((entry) => entry.manifest.moduleId === module.id);
  const releasedModuleEntries = registryEntries.filter((entry) => entry.status === 'released' && entry.packType === 'module' && entry.moduleId === module.id);
  const latestReleased = [...releasedModuleEntries].sort((left, right) => right.version.localeCompare(left.version))[0];
  const releasedOverlayCount = registryEntries.filter((entry) => entry.status === 'released' && entry.packType === 'overlay' && entry.targetModuleId === module.id).length;

  if (latestReleased?.manifest) {
    return {
      manifest: latestReleased.manifest,
      sourceLabel: 'Freigegeben aus Registry',
      releasedOverlayCount,
      formatLabel: latestReleased.format === 'container' ? 'Container' : 'Legacy',
    };
  }

  if (builtInContainer?.manifest) {
    return {
      manifest: builtInContainer.manifest,
      sourceLabel: 'Integrierter Kerncontainer',
      releasedOverlayCount,
      formatLabel: 'Container',
    };
  }

  return {
    manifest: buildSyntheticManifestFromModule(module),
    sourceLabel: 'Lokal importiert',
    releasedOverlayCount,
    formatLabel: 'Legacy',
  };
}

export function ModulesView({
  builtInContainers,
  availableModules,
  registryEntries,
  selectedModuleId,
  onSelectModule,
  onImportFiles,
  onActivatePack,
  onRetirePack,
  canManageRegistry,
  feedback,
}: ModulesViewProps) {
  const allModules = availableModules;
  const groupedRegistryEntries = groupRegistryEntries(registryEntries);
  const selectedModule = allModules.find((module) => module.id === selectedModuleId) ?? allModules[0];
  const selectedModuleDescriptor = selectedModule
    ? describeModuleSource(selectedModule, builtInContainers, registryEntries)
    : null;

  return (
    <div className="view-stack">
      <section className="content-grid two-column">
        <article className="card">
          <p className="eyebrow">Branchen-Engine</p>
          <h2>Module werden als standardisierte Inhaltscontainer geladen</h2>
          <p>
            Die App arbeitet jetzt nicht mehr mit fest verdrahteten Branchenprofilen, sondern mit einem
            einheitlichen Containerformat. Dasselbe Format gilt für integrierte Kernmodule, freigegebene
            Registry-Pakete und künftige Branchen-Overlays.
          </p>
          <label className="upload-box">
            <input type="file" accept="application/json,.json" onChange={(event) => onImportFiles(event.target.files)} />
            <Upload size={20} />
            <div>
              <strong>Container oder Legacy-JSON importieren</strong>
              <p className="muted">
                Standard ist der Inhaltscontainer mit <code>containerVersion</code>, <code>manifest</code> und{' '}
                <code>module</code>. Legacy-JSON bleibt aus Kompatibilitätsgründen lesbar.
              </p>
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
          <p className="eyebrow">Standardstruktur</p>
          <h3>Containerfelder für alle Branchen gleich</h3>
          <div className="schema-grid top-gap">
            <div>
              <strong>containerVersion</strong>
              <p className="muted small">Version des Containerformats. Aktuell 1.</p>
            </div>
            <div>
              <strong>manifest</strong>
              <p className="muted small">Pack-ID, Typ, Modul-ID, Version, Kompatibilität, Tags und Fähigkeiten.</p>
            </div>
            <div>
              <strong>module</strong>
              <p className="muted small">Der eigentliche Brancheninhalt mit Fragen, Maßnahmen, Evidenzen und Szenarien.</p>
            </div>
            <div>
              <strong>targetModuleId</strong>
              <p className="muted small">Nur bei Overlay-Containern nötig. Legt fest, welches Basismodul erweitert wird.</p>
            </div>
          </div>
        </article>
      </section>

      {selectedModule && selectedModuleDescriptor ? (
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Ausgewähltes Branchenprofil</p>
              <h3>{selectedModule.name}</h3>
              <p className="muted small">{selectedModuleDescriptor.sourceLabel}</p>
            </div>
            <div className="chip-row">
              <span className="chip outline">{selectedModuleDescriptor.manifest.packId}</span>
              <span className="chip outline">{selectedModuleDescriptor.formatLabel}</span>
              <span className="chip outline">Modul {selectedModule.version}</span>
            </div>
          </div>

          <div className="schema-grid top-gap">
            <div>
              <strong>Branche und Einordnung</strong>
              <p className="muted small">
                {selectedModule.sectorCategory || 'Allgemein'}
                {selectedModuleDescriptor.manifest.industryClass ? ` · ${selectedModuleDescriptor.manifest.industryClass}` : ''}
              </p>
            </div>
            <div>
              <strong>Kompatibilität</strong>
              <p className="muted small">
                App ab {selectedModuleDescriptor.manifest.compatibility?.minAppVersion || 'offen'} · Engine ab{' '}
                {selectedModuleDescriptor.manifest.compatibility?.minEngineVersion || 'offen'}
              </p>
            </div>
            <div>
              <strong>Fähigkeiten</strong>
              <p className="muted small">
                {(selectedModuleDescriptor.manifest.capabilities || []).join(', ') || 'nicht hinterlegt'}
              </p>
            </div>
            <div>
              <strong>Inhalt</strong>
              <p className="muted small">
                {(selectedModule.additionalQuestions?.length ?? 0)} Zusatzfragen · {(selectedModule.recommendedActions?.length ?? 0)} Maßnahmen ·{' '}
                {(selectedModule.evidenceTemplates?.length ?? 0)} Nachweise · {selectedModuleDescriptor.releasedOverlayCount} aktive Overlays
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Verfügbare Module</p>
            <h3>Aktives Branchenprofil auswählen</h3>
          </div>
          <div className="chip-row">
            <span className="chip outline">{allModules.length} wirksame Module</span>
            <span className="chip outline">{groupedRegistryEntries.length} Paketstränge</span>
          </div>
        </div>

        <div className="module-grid">
          {allModules.map((module) => {
            const isSelected = selectedModuleId === module.id;
            const descriptor = describeModuleSource(module, builtInContainers, registryEntries);

            return (
              <button
                key={module.id}
                type="button"
                className={`module-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectModule(module.id)}
              >
                <div className="module-card-head">
                  <div>
                    <p className="eyebrow">{descriptor.sourceLabel}</p>
                    <h4>{module.name}</h4>
                  </div>
                  {isSelected ? <CheckCircle2 size={18} /> : <Package size={18} />}
                </div>
                <p>{module.description}</p>
                <div className="chip-row top-gap">
                  <span className="chip outline">{descriptor.manifest.packId}</span>
                  <span className="chip outline">{descriptor.formatLabel}</span>
                  {module.sectorCategory ? <span className="chip outline">{module.sectorCategory}</span> : null}
                  <span className="chip outline">{module.additionalQuestions?.length ?? 0} Zusatzfragen</span>
                  <span className="chip outline">{descriptor.releasedOverlayCount} Overlays</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="inline-note top-gap">
          <Layers3 size={16} />
          <span>
            Freigegebene Container wirken sofort auf die fachliche Modulliste. Overlay-Container werden additiv auf das Zielmodul angewendet.
          </span>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pack-Registry</p>
            <h3>Versionen, Freigaben und Rollback</h3>
          </div>
          <div className="chip-row">
            <span className="chip outline">{registryEntries.length} Einträge</span>
          </div>
        </div>

        {groupedRegistryEntries.length ? (
          <div className="work-list">
            {groupedRegistryEntries.map(({ packKey, versions }) => (
              <article key={packKey} className="work-card">
                <div className="work-card-head">
                  <div>
                    <p className="eyebrow">{versions[0]?.packType === 'overlay' ? 'Overlay-Container' : 'Branchen-Container'}</p>
                    <h4>{versions[0]?.moduleName || versions[0]?.manifest?.name || versions[0]?.moduleId || packKey}</h4>
                    <p className="muted small">{packKey}</p>
                  </div>
                  <div className="chip-row">
                    {versions[0]?.targetModuleId ? <span className="chip outline">Ziel {versions[0].targetModuleId}</span> : null}
                    <span className="chip outline">{versions.length} Versionen</span>
                  </div>
                </div>

                <div className="work-list">
                  {versions.map((entry) => (
                    <div key={entry.id} className="card">
                      <div className="section-heading">
                        <div>
                          <strong>{entry.version}</strong>
                          <p className="muted small">
                            {buildPackStatusLabel(entry.status)} · importiert am {entry.uploadedAt || 'unbekannt'}
                          </p>
                        </div>
                        <div className="chip-row">
                          <span className="chip outline">SHA {entry.checksumSha256.slice(0, 12)}</span>
                          <span className="chip outline">{entry.format === 'container' ? 'Container' : 'Legacy'}</span>
                          {entry.containerVersion ? <span className="chip outline">Container v{entry.containerVersion}</span> : null}
                        </div>
                      </div>
                      <p className="muted small">
                        {entry.manifest?.packId || entry.packKey}
                        {entry.manifest?.compatibility?.minAppVersion ? ` · App ab ${entry.manifest.compatibility.minAppVersion}` : ''}
                        {entry.manifest?.compatibility?.minEngineVersion ? ` · Engine ab ${entry.manifest.compatibility.minEngineVersion}` : ''}
                      </p>
                      {entry.changeNote ? <p className="muted small">Änderung: {entry.changeNote}</p> : null}
                      {entry.releaseNote ? <p className="muted small">Freigabenotiz: {entry.releaseNote}</p> : null}
                      <div className="inline-actions top-gap">
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => onActivatePack(entry.id)}
                          disabled={!canManageRegistry || entry.status === 'retired'}
                        >
                          {entry.status === 'released' ? 'Aktiv' : 'Freigeben / Rollback'}
                        </button>
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => onRetirePack(entry.id)}
                          disabled={!canManageRegistry || entry.status === 'retired'}
                        >
                          Stilllegen
                        </button>
                        {entry.packType === 'overlay' ? <span className="chip outline">Overlay</span> : <span className="chip outline">Vollprofil</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Noch keine serverseitigen Pakete vorhanden.</p>
        )}
      </section>
    </div>
  );
}
