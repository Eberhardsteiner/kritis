import { FileText, ListTodo, PlusCircle, Sparkles } from 'lucide-react';
import { ActionCard } from '../components/ActionCard';
import { EvidenceCard } from '../components/EvidenceCard';
import type {
  ActionItem,
  ActionSummary,
  EvidenceItem,
  EvidenceSummary,
  RecommendationItem,
  RequirementDefinition,
  RequirementStatus,
  SectorModuleDefinition,
} from '../types';

interface MeasuresViewProps {
  module?: SectorModuleDefinition;
  recommendations: RecommendationItem[];
  requirements: RequirementDefinition[];
  requirementStates: Record<string, RequirementStatus>;
  actionItems: ActionItem[];
  evidenceItems: EvidenceItem[];
  actionSummary: ActionSummary;
  evidenceSummary: EvidenceSummary;
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
}: MeasuresViewProps) {
  const openRequirements = requirements.filter((requirement) => {
    const status = requirementStates[requirement.id] ?? 'open';
    return status !== 'ready' && status !== 'not_applicable';
  });

  return (
    <div className="view-stack">
      <section className="card compact">
        <p className="eyebrow">Maßnahmen & Nachweise</p>
        <h2>Arbeitsbereich für Umsetzung und Auditfähigkeit</h2>
        <p>
          Dieser Bereich verbindet Erkenntnisse aus Analyse und KRITIS-Readiness mit einem
          belastbaren Maßnahmenplan und einem strukturierten Nachweisregister.
        </p>
        <div className="summary-strip top-gap">
          <span>{actionSummary.total} Maßnahmen</span>
          <span>{actionSummary.overdue} überfällig</span>
          <span>{evidenceSummary.total} Nachweise</span>
          <span>{evidenceSummary.coverage}% Nachweisabdeckung</span>
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
              <FileText size={18} />
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
            <p className="eyebrow">Nachweisregister</p>
            <h3>Dokumente, Tests und Evidenzen</h3>
          </div>
          <button type="button" className="button primary" onClick={onCreateEmptyEvidence}>
            <PlusCircle size={16} />
            Leerer Nachweis
          </button>
        </div>

        <div className="work-list">
          {evidenceItems.length ? (
            evidenceItems.map((evidence) => (
              <EvidenceCard
                key={evidence.id}
                evidence={evidence}
                onUpdate={onUpdateEvidence}
                onDelete={onDeleteEvidence}
              />
            ))
          ) : (
            <div className="empty-state panel-empty">
              <FileText size={20} />
              <div>
                <strong>Noch keine Nachweise angelegt</strong>
                <p>
                  Ergänzen Sie Dokumentreferenzen, Testprotokolle, Übungsberichte und Auditunterlagen.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
