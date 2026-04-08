import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Network,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import type {
  ActionSummary,
  AuditFindingSummary,
  BenchmarkSnapshot,
  CertificationProgress,
  ChecklistProgress,
  EvidenceSummary,
  GovernanceSummary,
  KritisApplicability,
  ResilienceSummary,
  ScoreSnapshot,
  SectorModuleDefinition,
} from '../types';

interface DashboardViewProps {
  companyName: string;
  module?: SectorModuleDefinition;
  scoreSnapshot: ScoreSnapshot;
  benchmark: BenchmarkSnapshot;
  requirementScore: number;
  actionSummary: ActionSummary;
  evidenceSummary: EvidenceSummary;
  certificationProgress: CertificationProgress;
  applicability: KritisApplicability;
  governanceSummary: GovernanceSummary;
  checklistProgress: ChecklistProgress;
  findingSummary: AuditFindingSummary;
  resilienceSummary: ResilienceSummary;
  onGoToAssessment: () => void;
  onGoToMeasures: () => void;
  onGoToResilience: () => void;
  onGoToGovernance: () => void;
  onGoToKritis: () => void;
}

export function DashboardView({
  companyName,
  module,
  scoreSnapshot,
  benchmark,
  requirementScore,
  actionSummary,
  evidenceSummary,
  certificationProgress,
  applicability,
  governanceSummary,
  checklistProgress,
  findingSummary,
  resilienceSummary,
  onGoToAssessment,
  onGoToMeasures,
  onGoToResilience,
  onGoToGovernance,
  onGoToKritis,
}: DashboardViewProps) {
  const lowDomains = [...scoreSnapshot.domainScores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  const benchmarkGaps = scoreSnapshot.domainScores
    .map((domain) => {
      const target = benchmark.domainTargets[domain.domainId] ?? 0;
      return { ...domain, target, gap: Math.round((target - domain.score) * 10) / 10 };
    })
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 4);

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
            Die App verbindet Reifegradbewertung, Maßnahmensteuerung, Nachweisbibliothek,
            Governance-Struktur und eine interne KRITIS-Readiness-Logik in einer Oberfläche.
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
          <button type="button" className="button secondary" onClick={onGoToResilience}>
            BIA & Szenarien
          </button>
          <button type="button" className="button secondary" onClick={onGoToGovernance}>
            Governance & Struktur
          </button>
          <button type="button" className="button secondary" onClick={onGoToKritis}>
            KRITIS-Bereich öffnen
          </button>
        </div>
      </section>

      <section className="stats-grid phase-three">
        <StatCard
          title="Gesamtwert"
          value={`${scoreSnapshot.overallScore}%`}
          subtitle={`Ziel ${benchmark.overallTarget}% · ${scoreSnapshot.maturityLabel}`}
          tone={scoreSnapshot.overallScore >= benchmark.overallTarget ? 'good' : scoreSnapshot.overallScore >= benchmark.overallTarget - 8 ? 'warn' : 'alert'}
        />
        <StatCard
          title="Bearbeitungsgrad"
          value={`${scoreSnapshot.completion}%`}
          subtitle="Anteil beantworteter Parameter"
          tone={scoreSnapshot.completion >= 80 ? 'good' : 'default'}
        />
        <StatCard
          title="Governance-Reife"
          value={`${governanceSummary.score}%`}
          subtitle={governanceSummary.dueReviews ? `${governanceSummary.dueReviews} Reviewtermine fällig` : 'Reviewkalender gepflegt'}
          tone={governanceSummary.score >= 75 ? 'good' : governanceSummary.score >= 50 ? 'warn' : 'default'}
        />
        <StatCard
          title="Operative Resilienz"
          value={`${resilienceSummary.score}%`}
          subtitle={resilienceSummary.highRiskScenarios ? `${resilienceSummary.highRiskScenarios} Hochrisiko-Szenarien` : 'Szenariobild im grünen Bereich'}
          tone={resilienceSummary.highRiskScenarios ? 'warn' : resilienceSummary.score >= 75 ? 'good' : 'default'}
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
          title="Audit-Checklist"
          value={`${checklistProgress.score}%`}
          subtitle={checklistProgress.blockers ? `${checklistProgress.blockers} Blocker` : 'Keine Blocker'}
          tone={checklistProgress.blockers ? 'alert' : checklistProgress.score >= 75 ? 'good' : 'warn'}
        />
        <StatCard
          title="Feststellungen offen"
          value={`${findingSummary.open}`}
          subtitle={findingSummary.critical ? `${findingSummary.critical} kritisch` : 'Keine kritischen Feststellungen'}
          tone={findingSummary.critical ? 'alert' : findingSummary.open ? 'warn' : 'good'}
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
                  <span>Ziel {benchmark.domainTargets[domain.domainId] ?? 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Benchmark</p>
              <h3>Größte Zielabweichungen</h3>
            </div>
          </div>
          <div className="priority-list">
            {benchmarkGaps.map((entry) => (
              <div key={entry.domainId} className="priority-item compact-item">
                <div>
                  <strong>{entry.label}</strong>
                  <p className="muted small">Ist {entry.score}% · Ziel {entry.target}%</p>
                </div>
                <span className={`chip ${entry.gap <= 0 ? 'success' : entry.gap <= 8 ? 'warn' : 'danger'}`}>
                  {entry.gap <= 0 ? 'im Ziel' : `${entry.gap}% Gap`}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="content-grid three-column">
        <article className="card compact">
          <p className="eyebrow">Governance</p>
          <h3>Organisation im Blick</h3>
          <div className="mini-list">
            <div className="mini-list-row">
              <span>Rollenabdeckung</span>
              <strong>{governanceSummary.stakeholderCoverage}%</strong>
            </div>
            <div className="mini-list-row">
              <span>Strukturabdeckung</span>
              <strong>{governanceSummary.siteCoverage}%</strong>
            </div>
            <div className="mini-list-row">
              <span>Asset-Abdeckung</span>
              <strong>{governanceSummary.assetCoverage}%</strong>
            </div>
          </div>
          <div className="inline-note top-gap">
            <Network size={16} />
            <span>Governance, Standorte und Assets sind jetzt Bestandteil der Bewertungslogik.</span>
          </div>
        </article>

        <article className="card compact">
          <p className="eyebrow">Operative Resilienz</p>
          <h3>BIA, Szenarien und Übungen</h3>
          <div className="mini-list">
            <div className="mini-list-row">
              <span>Prozessabdeckung</span>
              <strong>{resilienceSummary.processCoverage}%</strong>
            </div>
            <div className="mini-list-row">
              <span>Single Points</span>
              <strong>{resilienceSummary.singlePointsOfFailure}</strong>
            </div>
            <div className="mini-list-row">
              <span>Übungen fällig</span>
              <strong>{resilienceSummary.dueExercises}</strong>
            </div>
          </div>
          <div className="inline-note top-gap">
            <AlertTriangle size={16} />
            <span>Die operative Sicht verbindet Geschäftsprozesse, Abhängigkeiten und Krisenszenarien.</span>
          </div>
        </article>

        <article className="card compact">
          <p className="eyebrow">Audit</p>
          <h3>Readiness vor Readiness-Entscheid</h3>
          <div className="mini-list">
            <div className="mini-list-row">
              <span>Evidenzierte Prüfbausteine</span>
              <strong>{checklistProgress.evidenced}/{checklistProgress.total}</strong>
            </div>
            <div className="mini-list-row">
              <span>Überfällige Feststellungen</span>
              <strong>{findingSummary.overdue}</strong>
            </div>
            <div className="mini-list-row">
              <span>Readiness-Reife</span>
              <strong>{certificationProgress.score}%</strong>
            </div>
          </div>
          <div className="inline-note top-gap">
            <ClipboardCheck size={16} />
            <span>Checklist und Feststellungen machen die interne Auditsteuerung deutlich belastbarer.</span>
          </div>
        </article>

        <article className="card compact">
          <p className="eyebrow">Fokus</p>
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
                  ? 'Einordnung prüfen'
                  : 'KRITIS eher fern'}
            </span>
          </div>
        </article>
      </section>
    </div>
  );
}
