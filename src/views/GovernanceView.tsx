import { Building2, Network, PlusCircle, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { AssetCard } from '../components/AssetCard';
import { SiteCard } from '../components/SiteCard';
import { StakeholderCard } from '../components/StakeholderCard';
import type {
  AssetItem,
  BenchmarkSnapshot,
  GovernanceSummary,
  ReviewPlan,
  RoleTemplateDefinition,
  ScoreSnapshot,
  SectorModuleDefinition,
  SiteItem,
  StakeholderItem,
} from '../types';

interface GovernanceViewProps {
  module?: SectorModuleDefinition;
  stakeholders: StakeholderItem[];
  sites: SiteItem[];
  assets: AssetItem[];
  reviewPlan: ReviewPlan;
  benchmark: BenchmarkSnapshot;
  scoreSnapshot: ScoreSnapshot;
  governanceSummary: GovernanceSummary;
  roleTemplates: RoleTemplateDefinition[];
  onCreateStakeholder: () => void;
  onCreateSite: () => void;
  onCreateAsset: () => void;
  onGenerateRoleTemplates: () => void;
  onUpdateStakeholder: (stakeholderId: string, patch: Partial<StakeholderItem>) => void;
  onDeleteStakeholder: (stakeholderId: string) => void;
  onUpdateSite: (siteId: string, patch: Partial<SiteItem>) => void;
  onDeleteSite: (siteId: string) => void;
  onUpdateAsset: (assetId: string, patch: Partial<AssetItem>) => void;
  onDeleteAsset: (assetId: string) => void;
  onUpdateReviewPlan: (field: keyof ReviewPlan, value: string) => void;
}

export function GovernanceView({
  module,
  stakeholders,
  sites,
  assets,
  reviewPlan,
  benchmark,
  scoreSnapshot,
  governanceSummary,
  roleTemplates,
  onCreateStakeholder,
  onCreateSite,
  onCreateAsset,
  onGenerateRoleTemplates,
  onUpdateStakeholder,
  onDeleteStakeholder,
  onUpdateSite,
  onDeleteSite,
  onUpdateAsset,
  onDeleteAsset,
  onUpdateReviewPlan,
}: GovernanceViewProps) {
  const domainGaps = scoreSnapshot.domainScores
    .map((domain) => {
      const target = benchmark.domainTargets[domain.domainId] ?? 0;
      return {
        ...domain,
        target,
        gap: Math.round((target - domain.score) * 10) / 10,
      };
    })
    .sort((a, b) => b.gap - a.gap);

  return (
    <div className="view-stack">
      <section className="card compact">
        <p className="eyebrow">Governance & Struktur</p>
        <h2>Rollen, Standorte, kritische Assets und Reviewkalender</h2>
        <p>
          Phase 3 erweitert die App um die organisatorische und strukturelle Steuerung der
          Krisenfestigkeit. Damit werden Bewertungen, Verantwortungen und Auditfähigkeit enger
          miteinander verbunden.
        </p>
        <div className="summary-strip top-gap">
          <span>{stakeholders.length} Stakeholder</span>
          <span>{sites.length} Standorte</span>
          <span>{assets.length} kritische Assets/Services</span>
          <span>{governanceSummary.score}% Governance-Reife</span>
          <span>{benchmark.overallTarget}% Zielkorridor</span>
        </div>
      </section>

      <section className="content-grid two-column">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Reviewkalender</p>
              <h3>Sponsor, Approver und Regeltermine</h3>
            </div>
            <span className={`chip ${governanceSummary.dueReviews ? 'danger' : 'success'}`}>
              {governanceSummary.dueReviews ? `${governanceSummary.dueReviews} fällig` : 'Keine fälligen Reviews'}
            </span>
          </div>

          <div className="form-grid two-column">
            <label className="field-label">
              Executive Sponsor
              <input
                type="text"
                value={reviewPlan.executiveSponsor}
                placeholder="z. B. COO, Klinikleitung"
                onChange={(event) => onUpdateReviewPlan('executiveSponsor', event.target.value)}
              />
            </label>
            <label className="field-label">
              Freigabeverantwortung
              <input
                type="text"
                value={reviewPlan.approver}
                placeholder="z. B. Geschäftsführung, CISO"
                onChange={(event) => onUpdateReviewPlan('approver', event.target.value)}
              />
            </label>
            <label className="field-label">
              Nächstes internes Audit
              <input
                type="date"
                value={reviewPlan.nextInternalAuditDate}
                onChange={(event) => onUpdateReviewPlan('nextInternalAuditDate', event.target.value)}
              />
            </label>
            <label className="field-label">
              Nächster Management-Review
              <input
                type="date"
                value={reviewPlan.nextManagementReviewDate}
                onChange={(event) => onUpdateReviewPlan('nextManagementReviewDate', event.target.value)}
              />
            </label>
            <label className="field-label">
              Nächste Übung
              <input
                type="date"
                value={reviewPlan.nextExerciseDate}
                onChange={(event) => onUpdateReviewPlan('nextExerciseDate', event.target.value)}
              />
            </label>
            <label className="field-label">
              Nächster Evidenz-Review
              <input
                type="date"
                value={reviewPlan.nextEvidenceReviewDate}
                onChange={(event) => onUpdateReviewPlan('nextEvidenceReviewDate', event.target.value)}
              />
            </label>
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Benchmark</p>
              <h3>Zielprofil für das aktive Branchenmodul</h3>
            </div>
            <span className={`chip ${benchmark.overallGap <= 0 ? 'success' : benchmark.overallGap <= 8 ? 'warn' : 'danger'}`}>
              Gap {benchmark.overallGap}%
            </span>
          </div>

          <div className="mini-list">
            <div className="mini-list-row">
              <span>Modul</span>
              <strong>{module?.name ?? 'Basisprofil'}</strong>
            </div>
            <div className="mini-list-row">
              <span>Größenklasse</span>
              <strong>{benchmark.sizeBand}</strong>
            </div>
            <div className="mini-list-row">
              <span>Ist / Ziel gesamt</span>
              <strong>{scoreSnapshot.overallScore}% / {benchmark.overallTarget}%</strong>
            </div>
            <div className="mini-list-row">
              <span>Governance-Reife</span>
              <strong>{governanceSummary.score}%</strong>
            </div>
          </div>

          <div className="priority-list top-gap">
            {domainGaps.slice(0, 4).map((item) => (
              <div key={item.domainId} className="priority-item compact-item">
                <div>
                  <strong>{item.label}</strong>
                  <p className="muted small">Ist {item.score}% · Ziel {item.target}%</p>
                </div>
                <span className={`chip ${item.gap <= 0 ? 'success' : item.gap <= 8 ? 'warn' : 'danger'}`}>
                  {item.gap <= 0 ? 'im Ziel' : `${item.gap}% offen`}
                </span>
              </div>
            ))}
          </div>

          {benchmark.notes.length ? (
            <ul className="plain-list top-gap">
              {benchmark.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </article>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Stakeholder-Matrix</p>
            <h3>Rollen, Verantwortungen und Freigabebereiche</h3>
          </div>
          <div className="inline-actions">
            <button type="button" className="button secondary" onClick={onGenerateRoleTemplates}>
              <Sparkles size={16} />
              Standardrollen laden
            </button>
            <button type="button" className="button primary" onClick={onCreateStakeholder}>
              <PlusCircle size={16} />
              Rolle / Person anlegen
            </button>
          </div>
        </div>

        <div className="summary-strip bottom-gap">
          <span>{roleTemplates.length} verfügbare Rollenvorlagen</span>
          <span>{governanceSummary.stakeholderCoverage}% Abdeckung</span>
          <span>{stakeholders.filter((item) => item.isPrimary).length} Primärrollen</span>
        </div>

        <div className="work-list">
          {stakeholders.length ? (
            stakeholders.map((stakeholder) => (
              <StakeholderCard
                key={stakeholder.id}
                stakeholder={stakeholder}
                onUpdate={onUpdateStakeholder}
                onDelete={onDeleteStakeholder}
              />
            ))
          ) : (
            <div className="empty-state panel-empty">
              <Network size={20} />
              <div>
                <strong>Noch keine Governance-Rollen gepflegt</strong>
                <p>Nutzen Sie Rollenvorlagen des Moduls oder legen Sie Personen und Freigaben manuell an.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="content-grid two-column">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Standortregister</p>
              <h3>Werke, Leitstellen, Lager und kritische Orte</h3>
            </div>
            <button type="button" className="button primary" onClick={onCreateSite}>
              <PlusCircle size={16} />
              Standort anlegen
            </button>
          </div>

          <div className="summary-strip bottom-gap">
            <span>{governanceSummary.siteCoverage}% Strukturabdeckung</span>
            <span>{sites.filter((site) => site.criticality === 'kritisch').length} kritische Standorte</span>
          </div>

          <div className="work-list">
            {sites.length ? (
              sites.map((site) => (
                <SiteCard
                  key={site.id}
                  site={site}
                  onUpdate={onUpdateSite}
                  onDelete={onDeleteSite}
                />
              ))
            ) : (
              <div className="empty-state panel-empty">
                <Building2 size={20} />
                <div>
                  <strong>Noch keine Standorte gepflegt</strong>
                  <p>Hinterlegen Sie die Orte, von denen kritische Leistungen abhängen.</p>
                </div>
              </div>
            )}
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Asset- und Service-Register</p>
              <h3>Kritische Systeme, Anlagen und Services</h3>
            </div>
            <button type="button" className="button primary" onClick={onCreateAsset}>
              <PlusCircle size={16} />
              Asset / Service anlegen
            </button>
          </div>

          <div className="summary-strip bottom-gap">
            <span>{governanceSummary.assetCoverage}% Asset-Abdeckung</span>
            <span>{assets.filter((asset) => asset.criticality === 'kritisch').length} kritische Assets</span>
          </div>

          <div className="work-list">
            {assets.length ? (
              assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  sites={sites}
                  onUpdate={onUpdateAsset}
                  onDelete={onDeleteAsset}
                />
              ))
            ) : (
              <div className="empty-state panel-empty">
                <ShieldCheck size={20} />
                <div>
                  <strong>Noch keine kritischen Assets oder Services gepflegt</strong>
                  <p>Erfassen Sie kritische Systeme, Anlagen, Services, RTO und Fallback-Optionen.</p>
                </div>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
