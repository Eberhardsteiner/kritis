import { useState } from 'react';
import { Download, FileText, History, PlayCircle, Sparkles } from 'lucide-react';
import { ResiliencePlanEditor } from '../features/resiliencePlan/views/ResiliencePlanEditor';
import { ResiliencePlanPreview } from '../features/resiliencePlan/views/ResiliencePlanPreview';
import { ResiliencePlanVersionHistory } from '../features/resiliencePlan/views/ResiliencePlanVersionHistory';
import type { ResiliencePlan } from '../features/resiliencePlan/types';

type ResiliencePlanTab = 'editor' | 'preview' | 'history';

export interface ResiliencePlanViewProps {
  plan: ResiliencePlan | null;
  archivedPlans: ResiliencePlan[];
  canEdit: boolean;
  canExport: boolean;
  onGenerateDraft: () => void;
  onSavePlan: (plan: ResiliencePlan) => void;
  onSubmitForReview: () => void;
  onApprove: (approvedBy: string) => void;
  onReturnToDraft: () => void;
  onArchive: () => void;
  onExportJson: () => void;
  onExportDocx: () => void;
  onExportPdf: () => void;
}

export function ResiliencePlanView({
  plan,
  archivedPlans,
  canEdit,
  canExport,
  onGenerateDraft,
  onSavePlan,
  onSubmitForReview,
  onApprove,
  onReturnToDraft,
  onArchive,
  onExportJson,
  onExportDocx,
  onExportPdf,
}: ResiliencePlanViewProps) {
  const [activeTab, setActiveTab] = useState<ResiliencePlanTab>('preview');

  if (!plan) {
    return (
      <div className="view-stack">
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Resilienzplan · § 13 KRITISDachG</p>
              <h2>Kein Resilienzplan vorhanden</h2>
            </div>
          </div>
          <p className="top-gap">
            Der Resilienzplan fasst Geltungsbereich, Risikobasis, Maßnahmen nach den vier
            Resilienzzielen, Governance, Meldewesen und Nachweise in einem § 13-konformen Dokument
            zusammen. UVM-Berater können aus den bestehenden Mandantendaten (Risikoanalyse aus B3,
            Maßnahmen, Evidenzen, Stammdaten) einen vorbefüllten Entwurf erzeugen.
          </p>
          <p className="muted small top-gap">
            Zum Stand April 2026 liegt das BBK-Muster nach § 13 KRITISDachG noch nicht vor;
            dieser Generator ist damit ein UVM-Alleinstellungsvorteil in der Beratungspraxis.
          </p>
          <div className="hero-actions top-gap">
            <button
              type="button"
              className="button"
              onClick={onGenerateDraft}
              disabled={!canEdit}
            >
              <Sparkles size={14} />
              Plan-Entwurf aus Mandantendaten erzeugen
            </button>
          </div>
          {!canEdit ? (
            <p className="muted small top-gap">
              Für die Plan-Erstellung fehlt das Recht kritis_edit. Bitte an die Programmleitung
              wenden.
            </p>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="view-stack">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Resilienzplan · § 13 KRITISDachG</p>
            <h2>Version {plan.version} · {plan.status}</h2>
          </div>
          <div className="chip-row">
            <button type="button" className="button secondary" onClick={onExportPdf} disabled={!canExport}>
              <Download size={14} />
              PDF
            </button>
            <button type="button" className="button secondary" onClick={onExportDocx} disabled={!canExport}>
              <FileText size={14} />
              DOCX
            </button>
            <button type="button" className="button secondary" onClick={onExportJson} disabled={!canExport}>
              <Download size={14} />
              JSON
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={onGenerateDraft}
              disabled={!canEdit}
              title="Plan neu aus Mandantendaten generieren (Maßnahmen und Vertiefungen werden überschrieben)"
            >
              <PlayCircle size={14} />
              Neu generieren
            </button>
          </div>
        </div>

        <nav className="chip-row top-gap" role="tablist" aria-label="Resilienzplan-Ansichten">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'preview'}
            className={`chip ${activeTab === 'preview' ? 'warn' : 'outline'}`}
            onClick={() => setActiveTab('preview')}
          >
            Vorschau
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'editor'}
            className={`chip ${activeTab === 'editor' ? 'warn' : 'outline'}`}
            onClick={() => setActiveTab('editor')}
            disabled={!canEdit}
          >
            Editor
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            className={`chip ${activeTab === 'history' ? 'warn' : 'outline'}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={12} /> Versionshistorie
          </button>
        </nav>
      </section>

      {activeTab === 'preview' ? <ResiliencePlanPreview plan={plan} /> : null}

      {activeTab === 'editor' ? (
        <ResiliencePlanEditor plan={plan} onSave={onSavePlan} />
      ) : null}

      {activeTab === 'history' ? (
        <ResiliencePlanVersionHistory
          currentPlan={plan}
          archivedVersions={archivedPlans}
          canTransitionStatus={canEdit}
          onSubmitForReview={onSubmitForReview}
          onApprove={onApprove}
          onReturnToDraft={onReturnToDraft}
          onArchive={onArchive}
        />
      ) : null}
    </div>
  );
}
