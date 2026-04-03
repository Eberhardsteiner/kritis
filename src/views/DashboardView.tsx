import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import type {
  ActionSummary,
  CertificationProgress,
  EvidenceSummary,
  KritisApplicability,
  ScoreSnapshot,
  SectorModuleDefinition,
} from '../types';

interface DashboardViewProps {
  companyName: string;
  module?: SectorModuleDefinition;
  scoreSnapshot: ScoreSnapshot;
  requirementScore: number;
  actionSummary: ActionSummary;
  evidenceSummary: EvidenceSummary;
  certificationProgress: CertificationProgress;
  applicability: KritisApplicability;
  onGoToAssessment: () => void;
  onGoToMeasures: () => void;
  onGoToKritis: () => void;
}

export function DashboardView({
  companyName,
  module,
  scoreSnapshot,
  requirementScore,
  actionSummary,
  evidenceSummary,
  certificationProgress,
  applicability,
  onGoToAssessment,
  onGoToMeasures,
  onGoToKritis,
}: DashboardViewProps) {
  const lowDomains = [...scoreSnapshot.domainScores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  return (
    <div className="view-stack">
      <section className="hero card">
        <div>
          <p className="eyebrow">Unternehmensanalyse</p>
          <h2>
            {companyName.trim() || 'Unternehmen'}
            {module ? ` · ${module.name}` : ''}
          </h2>
          <p className="hero-text">
            Die App verbindet Reifegradbewertung, Maßnahmensteuerung, Evidenzregister und eine
            interne KRITIS-Zertifizierungslogik in einer Oberfläche.
          </p>
          {module?.uiHints?.focusAreas?.length ? (
            <div className="chip-row top-gap">
              {module.uiHints.focusAreas.map((area) => (
                <span key={area} className="chip outline">
                  Fokus: {area}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="hero-actions">
          <button type="button" className="button primary" onClick={onGoToAssessment}>
            Analyse öffnen
            <ArrowRight size={16} />
          </button>
          <button type="button" className="button secondary" onClick={onGoToMeasures}>
            Maßnahmen & Nachweise
          </button>
          <button type="button" className="button secondary" onClick={onGoToKritis}>
            KRITIS-Bereich öffnen
          </button>
        </div>
      </section>

      <section className="stats-grid phase-two">
        <StatCard
          title="Gesamtwert"
          value={`${scoreSnapshot.overallScore}%`}
          subtitle={`Reifegrad: ${scoreSnapshot.maturityLabel}`}
          tone={scoreSnapshot.overallScore >= 75 ? 'good' : scoreSnapshot.overallScore >= 50 ? 'warn' : 'alert'}
        />
        <StatCard
          title="Bearbeitungsgrad"
          value={`${scoreSnapshot.completion}%`}
          subtitle="Anteil beantworteter Parameter"
          tone={scoreSnapshot.completion >= 80 ? 'good' : 'default'}
        />
        <StatCard
          title="Maßnahmen offen"
          value={`${actionSummary.total - actionSummary.done}`}
          subtitle={actionSummary.overdue ? `${actionSummary.overdue} überfällig` : 'Keine Überfälligkeit'}
          tone={actionSummary.overdue ? 'alert' : actionSummary.total ? 'warn' : 'good'}
        />
        <StatCard
          title="Nachweisabdeckung"
          value={`${evidenceSummary.coverage}%`}
          subtitle={`${evidenceSummary.approved} freigegeben`}
          tone={evidenceSummary.coverage >= 75 ? 'good' : evidenceSummary.coverage >= 50 ? 'warn' : 'default'}
        />
        <StatCard
          title="KRITIS-Readiness"
          value={`${requirementScore}%`}
          subtitle={applicability.title}
          tone={requirementScore >= 75 ? 'good' : applicability.status === 'wahrscheinlich' ? 'warn' : 'default'}
        />
        <StatCard
          title="Zertifizierungsreife"
          value={`${certificationProgress.score}%`}
          subtitle={`${certificationProgress.readyStages} Stufen abgeschlossen`}
          tone={certificationProgress.score >= 75 ? 'good' : certificationProgress.score >= 50 ? 'warn' : 'default'}
        />
      </section>

      <section className="content-grid two-column">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Domains</p>
              <h3>Stärken und Schwachstellen</h3>
            </div>
          </div>
          <div className="domain-score-list">
            {scoreSnapshot.domainScores.map((domain) => (
              <div key={domain.domainId} className="domain-score-item">
                <div className="domain-score-head">
                  <strong>{domain.label}</strong>
                  <span>{domain.score}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${domain.score}%` }} />
                </div>
                <div className="domain-score-foot">
                  <span>
                    {domain.answeredCount} / {domain.totalCount} beantwortet
                  </span>
                  <span>{domain.completion}% vollständig</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Fokus</p>
              <h3>Nächste Prioritäten</h3>
            </div>
          </div>
          <div className="priority-list">
            {scoreSnapshot.recommendations.slice(0, 4).map((recommendation) => (
              <div key={recommendation.questionId} className="priority-item">
                <div className="priority-icon">
                  {recommendation.urgency === 'hoch' ? (
                    <AlertTriangle size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                </div>
                <div>
                  <strong>{recommendation.title}</strong>
                  <p className="muted small">{recommendation.domainLabel}</p>
                  <p>{recommendation.action}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="content-grid two-column">
        <article className="card compact">
          <p className="eyebrow">Arbeitsmodus</p>
          <h3>Was Phase 2 ergänzt</h3>
          <div className="mini-list">
            <div className="mini-list-row">
              <span>Maßnahmenplan</span>
              <strong>{actionSummary.total}</strong>
            </div>
            <div className="mini-list-row">
              <span>Nachweisregister</span>
              <strong>{evidenceSummary.total}</strong>
            </div>
            <div className="mini-list-row">
              <span>Interne Zertifizierungsstufen</span>
              <strong>{certificationProgress.readyStages}/6</strong>
            </div>
          </div>
          <div className="inline-note top-gap">
            <ClipboardCheck size={16} />
            <span>
              Empfehlungen aus der Analyse lassen sich jetzt direkt in Maßnahmen und Nachweise überführen.
            </span>
          </div>
        </article>

        <article className="card compact">
          <p className="eyebrow">Niedrigste Domains</p>
          <h3>Wo zuerst investiert werden sollte</h3>
          <div className="mini-list">
            {lowDomains.map((domain) => (
              <div key={domain.domainId} className="mini-list-row">
                <span>{domain.label}</span>
                <strong>{domain.score}%</strong>
              </div>
            ))}
          </div>
          <div className="chip-row top-gap">
            <span className={`chip ${applicability.status === 'wahrscheinlich' ? 'danger' : applicability.status === 'prüfbedürftig' ? 'warn' : 'success'}`}>
              {applicability.status === 'wahrscheinlich'
                ? 'Vertiefte Prüfung empfohlen'
                : applicability.status === 'prüfbedürftig'
                  ? 'Prüfung nötig'
                  : 'Niedrige Relevanz'}
            </span>
            <span className="chip outline">
              <ShieldCheck size={14} /> Interne Readiness
            </span>
          </div>
        </article>
      </section>
    </div>
  );
}
