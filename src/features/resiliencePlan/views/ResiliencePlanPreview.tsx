import {
  ORDERED_RESILIENCE_GOALS,
  PLAN_SECTION_LABELS,
  RESILIENCE_GOAL_DESCRIPTIONS,
  RESILIENCE_GOAL_LABELS,
} from '../template';
import type { ResiliencePlan, ResiliencePlanStatus } from '../types';

interface ResiliencePlanPreviewProps {
  plan: ResiliencePlan;
  compact?: boolean;
}

const STATUS_LABELS: Record<ResiliencePlanStatus, string> = {
  draft: 'Entwurf',
  review: 'In Review',
  approved: 'Freigegeben',
  archived: 'Archiviert',
};

function getStatusTone(status: ResiliencePlanStatus): 'outline' | 'warn' | 'success' {
  if (status === 'approved') {
    return 'success';
  }
  if (status === 'review') {
    return 'warn';
  }
  return 'outline';
}

function Paragraph({ text }: { text: string }) {
  const trimmed = text?.trim();
  if (!trimmed) {
    return null;
  }
  return <p className="top-gap">{trimmed}</p>;
}

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <strong>{label}:</strong> {value?.trim() || '—'}
    </p>
  );
}

export function ResiliencePlanPreview({ plan, compact = false }: ResiliencePlanPreviewProps) {
  const { content } = plan;

  return (
    <article className="card" aria-label="Resilienzplan Vorschau">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Vorschau · § 13 KRITISDachG</p>
          <h3>Resilienzplan {plan.version}</h3>
        </div>
        <div className="chip-row">
          <span className={`chip ${getStatusTone(plan.status)}`}>{STATUS_LABELS[plan.status]}</span>
          {plan.approvedBy ? <span className="chip outline">Freigabe durch {plan.approvedBy}</span> : null}
        </div>
      </div>

      {!compact ? (
        <p className="muted small top-gap">
          Erstellt: {plan.createdAt.slice(0, 10)} · Aktualisiert: {plan.updatedAt.slice(0, 10)}
        </p>
      ) : null}

      <section className="top-gap">
        <h4>{PLAN_SECTION_LABELS.scope}</h4>
        <div className="form-grid two-column top-gap">
          <LabelValue label="Betreiber" value={content.scope.operatorName} />
          <LabelValue label="Sektor" value={content.scope.sector} />
          <LabelValue label="Kritische Dienstleistung" value={content.scope.criticalService} />
          <LabelValue label="Standorte" value={content.scope.locations} />
          <LabelValue label="Mitarbeitende" value={content.scope.employees} />
          <LabelValue label="Versorgte Personen" value={content.scope.personsServed} />
        </div>
        <Paragraph text={content.scope.scopeNote} />
      </section>

      <section className="top-gap">
        <h4>{PLAN_SECTION_LABELS.riskBasis}</h4>
        <Paragraph text={content.riskBasis.methodology} />
        <Paragraph text={content.riskBasis.riskAnalysisReference} />
        <Paragraph text={content.riskBasis.riskBasisNote} />
        {content.riskBasis.topRisks.length > 0 ? (
          <div className="top-gap">
            <p className="eyebrow">Top-Risiken</p>
            <ul className="plain-list">
              {content.riskBasis.topRisks.map((risk, index) => (
                <li key={`${risk.riskId ?? risk.title}-${index}`}>
                  <strong>{risk.title}</strong> · {risk.category} · Initial {risk.initialScore} · Rest{' '}
                  {risk.residualScore} · {risk.criticality}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="muted top-gap">Noch keine Top-Risiken referenziert.</p>
        )}
      </section>

      <section className="top-gap">
        <h4>{PLAN_SECTION_LABELS.measuresByGoal}</h4>
        <div className="priority-list top-gap">
          {ORDERED_RESILIENCE_GOALS.map((goal) => {
            const measures = content.measuresByGoal[goal];
            return (
              <article key={goal} className="nested-card">
                <div className="question-title-row">
                  <strong>{RESILIENCE_GOAL_LABELS[goal]}</strong>
                  <span className="chip outline">{measures.length} Maßnahmen</span>
                </div>
                {!compact ? <p className="muted small">{RESILIENCE_GOAL_DESCRIPTIONS[goal]}</p> : null}
                {measures.length === 0 ? (
                  <p className="muted top-gap">Keine Maßnahmen zugeordnet.</p>
                ) : (
                  <ul className="plain-list top-gap">
                    {measures.map((measure) => (
                      <li key={measure.id}>
                        <strong>{measure.title || 'Unbenannt'}</strong> · Owner {measure.owner || 'offen'} ·{' '}
                        fällig {measure.dueDate || '—'} · Status {measure.status}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="top-gap">
        <h4>{PLAN_SECTION_LABELS.governance}</h4>
        <div className="form-grid two-column top-gap">
          <LabelValue label="Geschäftsleitung (§ 20)" value={content.governance.managementBoardContact} />
          <LabelValue label="Programmverantwortung" value={content.governance.programOwner} />
        </div>
        <Paragraph text={content.governance.escalationPath} />
        <Paragraph text={content.governance.boardReviewCadence} />
        <Paragraph text={content.governance.governanceNote} />
      </section>

      <section className="top-gap">
        <h4>{PLAN_SECTION_LABELS.reporting}</h4>
        <div className="form-grid two-column top-gap">
          <LabelValue label="Meldekontakt (§ 18)" value={content.reporting.incidentContact} />
          <LabelValue label="Ersatzkontakt" value={content.reporting.incidentBackupContact} />
        </div>
        <Paragraph text={content.reporting.bsiPortalNote} />
        <Paragraph text={content.reporting.firstReportingTimeline} />
        <Paragraph text={content.reporting.reportingNote} />
      </section>

      <section className="top-gap">
        <h4>{PLAN_SECTION_LABELS.evidence}</h4>
        <p>
          <strong>Review-Zyklus:</strong> alle {content.evidence.reviewCycleYears} Jahre
        </p>
        <Paragraph text={content.evidence.equivalentProofsNote} />
        <Paragraph text={content.evidence.evidenceNote} />
        {content.evidence.evidenceReferences.length > 0 ? (
          <ul className="plain-list top-gap">
            {content.evidence.evidenceReferences.map((ref, index) => (
              <li key={`${ref.title}-${index}`}>
                <strong>{ref.title}</strong> · {ref.type}
                {ref.sourceStandard ? ` · ${ref.sourceStandard}` : ''}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </article>
  );
}
