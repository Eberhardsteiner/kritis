import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import type {
  ActionItem,
  CertificationProgress,
  CompanyProfile,
  EvidenceSummary,
  KritisApplicability,
  RequirementDefinition,
  RequirementStatus,
  ScoreSnapshot,
  SectorModuleDefinition,
} from '../types';

interface ReportViewProps {
  companyProfile: CompanyProfile;
  module?: SectorModuleDefinition;
  scoreSnapshot: ScoreSnapshot;
  applicability: KritisApplicability;
  requirementProgress: { score: number; openCount: number; readyCount: number };
  requirements: RequirementDefinition[];
  requirementStates: Record<string, RequirementStatus>;
  actionItems: ActionItem[];
  evidenceSummary: EvidenceSummary;
  certificationProgress: CertificationProgress;
  onExportMarkdown: () => void;
  onExportActionCsv: () => void;
  onExportEvidenceCsv: () => void;
}

export function ReportView({
  companyProfile,
  module,
  scoreSnapshot,
  applicability,
  requirementProgress,
  requirements,
  requirementStates,
  actionItems,
  evidenceSummary,
  certificationProgress,
  onExportMarkdown,
  onExportActionCsv,
  onExportEvidenceCsv,
}: ReportViewProps) {
  const companyName = companyProfile.companyName.trim() || 'Unternehmen';
  const lowDomains = [...scoreSnapshot.domainScores].sort((a, b) => a.score - b.score).slice(0, 3);
  const openRequirements = requirements.filter((requirement) => {
    const status = requirementStates[requirement.id] ?? 'open';
    return status !== 'ready' && status !== 'not_applicable';
  });
  const dueActions = [...actionItems]
    .filter((item) => item.status !== 'done')
    .sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31'))
    .slice(0, 6);

  return (
    <div className="view-stack printable-report">
      <section className="card compact no-print">
        <p className="eyebrow">Reporting</p>
        <h2>Management Summary und Export</h2>
        <p>
          Der Bericht ist bewusst druckbar aufgebaut und bündelt Bewertung, Umsetzung,
          Nachweisstand und KRITIS-Readiness in einer Managementsicht.
        </p>
        <div className="hero-actions top-gap">
          <button type="button" className="button primary" onClick={onExportMarkdown}>
            <Download size={16} />
            Markdown exportieren
          </button>
          <button type="button" className="button secondary" onClick={onExportActionCsv}>
            <FileSpreadsheet size={16} />
            Maßnahmen CSV
          </button>
          <button type="button" className="button secondary" onClick={onExportEvidenceCsv}>
            <FileSpreadsheet size={16} />
            Nachweise CSV
          </button>
          <button type="button" className="button secondary" onClick={() => window.print()}>
            <Printer size={16} />
            Drucken
          </button>
        </div>
      </section>

      <section className="card report-sheet">
        <div className="report-head">
          <div>
            <p className="eyebrow">Management Report</p>
            <h2>{companyName}</h2>
            <p className="muted">
              {module?.name ?? 'Basisprofil'} · {companyProfile.industryLabel || 'Branche offen'}
            </p>
          </div>
          <div className="report-metrics">
            <div>
              <strong>{scoreSnapshot.overallScore}%</strong>
              <span>Resilienz</span>
            </div>
            <div>
              <strong>{requirementProgress.score}%</strong>
              <span>KRITIS-Readiness</span>
            </div>
            <div>
              <strong>{certificationProgress.score}%</strong>
              <span>Zertifizierungsreife</span>
            </div>
          </div>
        </div>

        <div className="report-grid">
          <article className="report-card">
            <h3>Unternehmensprofil</h3>
            <div className="mini-list">
              <div className="mini-list-row"><span>Unternehmen</span><strong>{companyName}</strong></div>
              <div className="mini-list-row"><span>Branche</span><strong>{companyProfile.industryLabel || '-'}</strong></div>
              <div className="mini-list-row"><span>Mitarbeitende</span><strong>{companyProfile.employees || '-'}</strong></div>
              <div className="mini-list-row"><span>Standorte</span><strong>{companyProfile.locations || '-'}</strong></div>
              <div className="mini-list-row"><span>Kritische Dienstleistung</span><strong>{companyProfile.criticalService || '-'}</strong></div>
            </div>
          </article>

          <article className="report-card">
            <h3>Einordnung</h3>
            <p>{applicability.title}</p>
            <p className="muted top-gap">{applicability.text}</p>
            <div className="chip-row top-gap">
              <span className={`chip ${applicability.status === 'wahrscheinlich' ? 'danger' : applicability.status === 'prüfbedürftig' ? 'warn' : 'success'}`}>
                {applicability.status}
              </span>
              <span className="chip outline">{openRequirements.length} offene KRITIS-Bausteine</span>
            </div>
          </article>

          <article className="report-card wide">
            <h3>Domänenwerte</h3>
            <div className="domain-score-list compact-list top-gap">
              {scoreSnapshot.domainScores.map((domain) => (
                <div key={domain.domainId} className="domain-score-item">
                  <div className="domain-score-head">
                    <strong>{domain.label}</strong>
                    <span>{domain.score}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${domain.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="report-card">
            <h3>Schwächste Bereiche</h3>
            <div className="mini-list top-gap">
              {lowDomains.map((domain) => (
                <div key={domain.domainId} className="mini-list-row">
                  <span>{domain.label}</span>
                  <strong>{domain.score}%</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="report-card">
            <h3>Maßnahmenstatus</h3>
            <div className="mini-list top-gap">
              <div className="mini-list-row"><span>Gesamt</span><strong>{actionItems.length}</strong></div>
              <div className="mini-list-row"><span>Offen</span><strong>{actionItems.filter((item) => item.status === 'open').length}</strong></div>
              <div className="mini-list-row"><span>In Arbeit</span><strong>{actionItems.filter((item) => item.status === 'in_progress').length}</strong></div>
              <div className="mini-list-row"><span>Erledigt</span><strong>{actionItems.filter((item) => item.status === 'done').length}</strong></div>
            </div>
          </article>

          <article className="report-card wide">
            <h3>Nächste Maßnahmen</h3>
            <div className="priority-list top-gap">
              {dueActions.length ? dueActions.map((action) => (
                <div key={action.id} className="priority-item compact-item">
                  <div>
                    <strong>{action.title}</strong>
                    <p className="muted small">{action.owner || 'Verantwortlich offen'} · {action.priority}</p>
                  </div>
                  <span className="chip outline">{action.dueDate || 'ohne Termin'}</span>
                </div>
              )) : <p className="muted">Noch keine Maßnahmen vorhanden.</p>}
            </div>
          </article>

          <article className="report-card">
            <h3>Nachweisabdeckung</h3>
            <div className="mini-list top-gap">
              <div className="mini-list-row"><span>Abdeckung</span><strong>{evidenceSummary.coverage}%</strong></div>
              <div className="mini-list-row"><span>Freigegeben</span><strong>{evidenceSummary.approved}</strong></div>
              <div className="mini-list-row"><span>In Review</span><strong>{evidenceSummary.review}</strong></div>
              <div className="mini-list-row"><span>Fehlend</span><strong>{evidenceSummary.missing}</strong></div>
            </div>
          </article>

          <article className="report-card">
            <h3>KRITIS-Bausteine</h3>
            <div className="mini-list top-gap">
              <div className="mini-list-row"><span>Nachweisfähig</span><strong>{requirementProgress.readyCount}</strong></div>
              <div className="mini-list-row"><span>Offen</span><strong>{requirementProgress.openCount}</strong></div>
              <div className="mini-list-row"><span>Gesamt</span><strong>{requirements.length}</strong></div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
