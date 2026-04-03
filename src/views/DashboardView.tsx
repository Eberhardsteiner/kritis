import { AlertTriangle, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import type { KritisApplicability, ScoreSnapshot, SectorModuleDefinition } from '../types';

interface DashboardViewProps {
  companyName: string;
  module?: SectorModuleDefinition;
  scoreSnapshot: ScoreSnapshot;
  requirementScore: number;
  applicability: KritisApplicability;
  onGoToAssessment: () => void;
  onGoToKritis: () => void;
}

export function DashboardView({
  companyName,
  module,
  scoreSnapshot,
  requirementScore,
  applicability,
  onGoToAssessment,
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
            Dieser Prototyp kombiniert eine belastbare Grundanalyse mit branchenspezifischen
            Parametern und einer separaten KRITIS-Readiness-Strecke.
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button primary" onClick={onGoToAssessment}>
            Grundanalyse öffnen
            <ArrowRight size={16} />
          </button>
          <button type="button" className="button secondary" onClick={onGoToKritis}>
            KRITIS-Bereich öffnen
          </button>
        </div>
      </section>

      <section className="stats-grid">
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
          title="KRITIS-Readiness"
          value={`${requirementScore}%`}
          subtitle={applicability.title}
          tone={requirementScore >= 75 ? 'good' : applicability.status === 'wahrscheinlich' ? 'warn' : 'default'}
        />
        <StatCard
          title="Branchenprofil"
          value={module?.name ?? 'Basis'}
          subtitle={module?.description ?? 'Nur Grundanalyse aktiv'}
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
                  <span>{domain.answeredCount} / {domain.totalCount} beantwortet</span>
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
          <p className="eyebrow">KRITIS-Einordnung</p>
          <h3>{applicability.title}</h3>
          <p>{applicability.text}</p>
          <div className="chip-row top-gap">
            <span className={`chip ${applicability.status === 'wahrscheinlich' ? 'danger' : applicability.status === 'prüfbedürftig' ? 'warn' : 'success'}`}>
              {applicability.status === 'wahrscheinlich'
                ? 'Vertiefte Prüfung empfohlen'
                : applicability.status === 'prüfbedürftig'
                  ? 'Prüfung nötig'
                  : 'Niedrige Relevanz'}
            </span>
            <span className="chip outline">Interne Readiness, keine hoheitliche Zertifizierung</span>
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
          <div className="inline-note top-gap">
            <ShieldCheck size={16} />
            <span>
              Paket 1 liefert eine belastbare Bewertungsgrundlage. In Paket 2 sollten wir
              Reporting, Rollenrechte und PDF-Export ergänzen.
            </span>
          </div>
        </article>
      </section>
    </div>
  );
}
