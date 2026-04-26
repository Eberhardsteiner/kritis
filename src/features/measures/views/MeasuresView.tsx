import { useMemo, useState } from 'react';
import { FileText, LibraryBig, ListTodo, PlusCircle, Search, Sparkles } from 'lucide-react';
import { ActionCard } from '../components/ActionCard';
// EvidenceCard wird seit C2.4 aus dem evidence-Feature bezogen (einziger
// Feature-zu-Feature-Import, durch die evidence-Public-API abgesichert).
import { EvidenceCard } from '../../evidence';
import type {
  ActionItem,
  ActionSummary,
  DocumentLibrarySummary,
  EvidenceItem,
  EvidenceStatus,
  EvidenceSummary,
  DocumentVersionEntry,
  RecommendationItem,
  RequirementDefinition,
  RequirementStatus,
  SectorModuleDefinition,
} from '../../../types';

interface MeasuresViewProps {
  module?: SectorModuleDefinition;
  recommendations: RecommendationItem[];
  requirements: RequirementDefinition[];
  requirementStates: Record<string, RequirementStatus>;
  actionItems: ActionItem[];
  evidenceItems: EvidenceItem[];
  actionSummary: ActionSummary;
  evidenceSummary: EvidenceSummary;
  documentFolders: string[];
  documentLibrarySummary: DocumentLibrarySummary;
  onCreateEmptyAction: () => void;
  onCreateEmptyEvidence: () => void;
  onGenerateRecommendationActions: () => void;
  onGenerateRequirementActions: () => void;
  onGenerateModuleActionTemplates: () => void;
  onGenerateCriticalQuestionEvidence: () => void;
  onGenerateRequirementEvidence: () => void;
  onGenerateModuleEvidenceTemplates: () => void;
  onUpdateAction: (actionId: string, patch: Partial<ActionItem>) => void;
  onDeleteAction: (actionId: string) => void;
  onUpdateEvidence: (evidenceId: string, patch: Partial<EvidenceItem>) => void;
  onDeleteEvidence: (evidenceId: string) => void;
  onAttachEvidenceFile: (evidenceId: string, file: File | null) => void;
  onRemoveEvidenceFile: (evidenceId: string) => void;
  evidenceVersions: Record<string, DocumentVersionEntry[]>;
  serverVersioningEnabled: boolean;
  onDownloadServerFile?: (url: string, fileName: string) => void;
  onLoadEvidenceVersions: (evidenceId: string) => void;
  onRestoreEvidenceVersion: (evidenceId: string, versionId: string) => void;
}

function isDueWithin30Days(dateValue: string): boolean {
  if (!dateValue) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  date.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 30;
}

export function MeasuresView({
  module,
  recommendations,
  requirements,
  requirementStates,
  actionItems,
  evidenceItems,
  actionSummary,
  evidenceSummary,
  documentFolders,
  documentLibrarySummary,
  onCreateEmptyAction,
  onCreateEmptyEvidence,
  onGenerateRecommendationActions,
  onGenerateRequirementActions,
  onGenerateModuleActionTemplates,
  onGenerateCriticalQuestionEvidence,
  onGenerateRequirementEvidence,
  onGenerateModuleEvidenceTemplates,
  onUpdateAction,
  onDeleteAction,
  onUpdateEvidence,
  onDeleteEvidence,
  onAttachEvidenceFile,
  onRemoveEvidenceFile,
  evidenceVersions,
  serverVersioningEnabled,
  onDownloadServerFile,
  onLoadEvidenceVersions,
  onRestoreEvidenceVersion,
}: MeasuresViewProps) {
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | EvidenceStatus>('all');
  const [showDueOnly, setShowDueOnly] = useState(false);

  const openRequirements = requirements.filter((requirement) => {
    const status = requirementStates[requirement.id] ?? 'open';
    return status !== 'ready' && status !== 'not_applicable';
  });

  const localAttachments = evidenceItems.filter((item) => item.attachment || item.serverAttachment).length;

  const filteredEvidenceItems = useMemo(() => {
    return evidenceItems.filter((item) => {
      const haystack = `${item.title} ${item.folder} ${item.tags.join(' ')} ${item.notes} ${item.externalId}`.toLowerCase();
      const searchMatches = !search.trim() || haystack.includes(search.toLowerCase());
      const folderMatches = folderFilter === 'all' || item.folder === folderFilter;
      const statusMatches = statusFilter === 'all' || item.status === statusFilter;
      const dueMatches = !showDueOnly || isDueWithin30Days(item.reviewDate) || isDueWithin30Days(item.validUntil);

      return searchMatches && folderMatches && statusMatches && dueMatches;
    });
  }, [evidenceItems, search, folderFilter, statusFilter, showDueOnly]);

  return (
    <div className="view-stack">
      <section className="card compact">
        <p className="eyebrow">Maßnahmen & Bibliothek</p>
        <h2>Arbeitsbereich für Umsetzung, Dokumentation und Auditfähigkeit</h2>
        <p>
          Dieser Bereich verbindet Erkenntnisse aus Analyse und KRITIS-Readiness mit einem
          belastbaren Maßnahmenplan und einer dokumentenorientierten Nachweisbibliothek.
        </p>
        <div className="summary-strip top-gap">
          <span>{actionSummary.total} Maßnahmen</span>
          <span>{actionSummary.overdue} überfällig</span>
          <span>{evidenceSummary.total} Nachweise</span>
          <span>{evidenceSummary.dataAvailable ? `${evidenceSummary.coverage}% Nachweisabdeckung` : 'Nachweisabdeckung: noch nicht erfasst'}</span>
          <span>{localAttachments} Anhänge</span>
        </div>
      </section>

      <section className="content-grid two-column">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Schnellstart</p>
              <h3>Automatische Generierung</h3>
            </div>
          </div>
          <div className="generator-grid">
            <button type="button" className="generator-card" onClick={onGenerateRecommendationActions}>
              <Sparkles size={18} />
              <strong>Maßnahmen aus Top-Lücken</strong>
              <p>Erzeugt Maßnahmen aus priorisierten Empfehlungen der Analyse.</p>
            </button>
            <button type="button" className="generator-card" onClick={onGenerateRequirementActions}>
              <ListTodo size={18} />
              <strong>Maßnahmen aus KRITIS-Bausteinen</strong>
              <p>Erzeugt Maßnahmen für offene regulatorische oder interne Nachweislücken.</p>
            </button>
            <button type="button" className="generator-card" onClick={onGenerateModuleActionTemplates}>
              <Sparkles size={18} />
              <strong>Branchen-Maßnahmen laden</strong>
              <p>Übernimmt vordefinierte Maßnahmen aus dem aktuellen Branchenmodul.</p>
            </button>
            <button type="button" className="generator-card" onClick={onGenerateCriticalQuestionEvidence}>
              <FileText size={18} />
              <strong>Nachweise aus kritischen Fragen</strong>
              <p>Leitet fehlende Evidenzen aus kritischen und schwach bewerteten Fragen ab.</p>
            </button>
            <button type="button" className="generator-card" onClick={onGenerateRequirementEvidence}>
              <FileText size={18} />
              <strong>Nachweise aus KRITIS-Bausteinen</strong>
              <p>Erstellt Nachweiskandidaten für offene KRITIS-Anforderungen.</p>
            </button>
            <button type="button" className="generator-card" onClick={onGenerateModuleEvidenceTemplates}>
              <LibraryBig size={18} />
              <strong>Branchen-Nachweise laden</strong>
              <p>Übernimmt modulbasierte Nachweisvorlagen in das Register.</p>
            </button>
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Signalbild</p>
              <h3>Was aktuell drängt</h3>
            </div>
          </div>

          <div className="priority-list">
            {recommendations.slice(0, 3).map((recommendation) => (
              <div key={recommendation.questionId} className="priority-item compact-item">
                <div>
                  <strong>{recommendation.title}</strong>
                  <p className="muted small">{recommendation.domainLabel}</p>
                  <p>{recommendation.action}</p>
                </div>
                <span className={`chip ${recommendation.urgency === 'hoch' ? 'danger' : recommendation.urgency === 'mittel' ? 'warn' : 'success'}`}>
                  {recommendation.urgency}
                </span>
              </div>
            ))}
          </div>

          <div className="divider" />

          <div className="mini-list">
            <div className="mini-list-row">
              <span>Offene KRITIS-Bausteine</span>
              <strong>{openRequirements.length}</strong>
            </div>
            <div className="mini-list-row">
              <span>Aktives Branchenmodul</span>
              <strong>{module?.name ?? 'Basisprofil'}</strong>
            </div>
            <div className="mini-list-row">
              <span>Modul-Fokus</span>
              <strong>{module?.uiHints?.accentLabel ?? 'Standard'}</strong>
            </div>
            <div className="mini-list-row">
              <span>Reviews ≤ 30 Tage</span>
              <strong>{documentLibrarySummary.dueReviews}</strong>
            </div>
            <div className="mini-list-row">
              <span>Dokumente abgelaufen</span>
              <strong>{documentLibrarySummary.expired}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Maßnahmenplan</p>
            <h3>Priorisierte Umsetzung</h3>
          </div>
          <button type="button" className="button primary" onClick={onCreateEmptyAction}>
            <PlusCircle size={16} />
            Leere Maßnahme
          </button>
        </div>

        <div className="work-list">
          {actionItems.length ? (
            actionItems.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onUpdate={onUpdateAction}
                onDelete={onDeleteAction}
              />
            ))
          ) : (
            <div className="empty-state panel-empty">
              <ListTodo size={20} />
              <div>
                <strong>Noch keine Maßnahmen angelegt</strong>
                <p>
                  Nutzen Sie die Generatoren oder leiten Sie Maßnahmen direkt aus Fragen und
                  KRITIS-Bausteinen ab.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Nachweisbibliothek</p>
            <h3>Dokumente, Tests, Evidenzen und lokale Anhänge</h3>
          </div>
          <button type="button" className="button primary" onClick={onCreateEmptyEvidence}>
            <PlusCircle size={16} />
            Neuer Nachweis
          </button>
        </div>

        <div className="library-toolbar top-gap">
          <label className="field-label wide">
            Bibliothek durchsuchen
            <div className="input-with-icon">
              <Search size={16} />
              <input
                type="text"
                value={search}
                placeholder="Titel, Ordner, Tags oder Dokument-ID durchsuchen"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </label>
          <label className="field-label">
            Ordner
            <select
              value={folderFilter}
              onChange={(event) => setFolderFilter(event.target.value)}
            >
              <option value="all">Alle Ordner</option>
              {documentFolders.map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | EvidenceStatus)}
            >
              <option value="all">Alle Status</option>
              <option value="missing">Fehlt</option>
              <option value="draft">Entwurf</option>
              <option value="review">In Review</option>
              <option value="approved">Freigegeben</option>
            </select>
          </label>
        </div>

        <div className="toggle-row top-gap">
          <button
            type="button"
            className={`toggle-chip ${showDueOnly ? 'selected' : ''}`}
            onClick={() => setShowDueOnly((current) => !current)}
          >
            Nur Review-/Ablauffristen ≤ 30 Tage
          </button>
        </div>

        <div className="folder-shelf top-gap">
          {documentLibrarySummary.byFolder.length ? documentLibrarySummary.byFolder.map((entry) => (
            <div key={entry.folder} className="folder-pill">
              <LibraryBig size={14} />
              <span>{entry.folder}</span>
              <strong>{entry.count}</strong>
            </div>
          )) : (
            <p className="muted">Noch keine Ordnerstruktur vorhanden.</p>
          )}
        </div>

        <div className="work-list top-gap">
          {filteredEvidenceItems.length ? (
            filteredEvidenceItems.map((evidence) => (
              <EvidenceCard
                key={evidence.id}
                evidence={evidence}
                folderSuggestions={documentFolders}
                onDownloadServerFile={onDownloadServerFile}
                versionEntries={evidenceVersions[evidence.id]}
                serverVersioningEnabled={serverVersioningEnabled}
                onUpdate={onUpdateEvidence}
                onDelete={onDeleteEvidence}
                onAttachFile={onAttachEvidenceFile}
                onRemoveAttachment={onRemoveEvidenceFile}
                onLoadVersions={onLoadEvidenceVersions}
                onRestoreVersion={onRestoreEvidenceVersion}
              />
            ))
          ) : (
            <div className="empty-state panel-empty">
              <FileText size={20} />
              <div>
                <strong>Kein Nachweis im aktuellen Bibliotheksfilter</strong>
                <p>
                  Passen Sie Suche oder Filter an oder legen Sie einen neuen Registereintrag an.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
