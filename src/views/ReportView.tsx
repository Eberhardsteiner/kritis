import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Printer, ScrollText, ShieldCheck } from 'lucide-react';
import { getAuthorityRoleLabel } from '../lib/authorities';
import type {
  ActionItem,
  AuditFindingSummary,
  AuthorityAssignmentResolved,
  BenchmarkSnapshot,
  CertificationProgress,
  ChecklistProgress,
  CompanyProfile,
  GapAnalysisSummary,
  RegulatoryProfile,
  RegulatoryRegimeId,
  RegulatoryRegimeSummary,
  DeadlineSummary,
  DocumentLibrarySummary,
  EvidenceSummary,
  ExportPackageEntry,
  GovernanceSummary,
  KritisApplicability,
  RequirementDefinition,
  RequirementStatus,
  ScoreSnapshot,
  SectorModuleDefinition,
  SiteItem,
  StakeholderItem,
} from '../types';
import { getBsigEntityClassLabel, getEntityClassFieldLabel, getJurisdictionLabel, shouldShowEntityClass } from '../lib/regulatory';
import type { KritisMilestones } from '../lib/regulatory';
import type { PenaltyEstimate } from '../lib/penaltyCalculator';
import { SHOW_PENALTY_EXPOSURE } from '../lib/featureFlags';
import { formatCalendarWeeksRange, formatPersonDaysRange } from '../features/gap/utils/formatters';

interface ReportViewProps {
  companyProfile: CompanyProfile;
  regulatoryProfile: RegulatoryProfile;
  regimeSummaries: RegulatoryRegimeSummary[];
  module?: SectorModuleDefinition;
  scoreSnapshot: ScoreSnapshot;
  benchmark: BenchmarkSnapshot;
  governanceSummary: GovernanceSummary;
  applicability: KritisApplicability;
  requirementProgress: { score: number; openCount: number; readyCount: number };
  requirements: RequirementDefinition[];
  requirementStates: Record<string, RequirementStatus>;
  actionItems: ActionItem[];
  evidenceSummary: EvidenceSummary;
  documentLibrarySummary: DocumentLibrarySummary;
  deadlineSummary: DeadlineSummary;
  certificationProgress: CertificationProgress;
  checklistProgress: ChecklistProgress;
  findingSummary: AuditFindingSummary;
  stakeholders: StakeholderItem[];
  sites: SiteItem[];
  kritisMilestones: KritisMilestones;
  kritisPenaltyEstimate: PenaltyEstimate;
  authorityAssignmentsByRegime: Record<RegulatoryRegimeId, AuthorityAssignmentResolved[]>;
  gapAnalysisSummary: GapAnalysisSummary;
  exportPackages: ExportPackageEntry[];
  exportApprovalRequired: boolean;
  onExportMarkdown: () => void;
  onExportManagementPdf: () => void;
  onExportAuditPdf: () => void;
  onExportActionCsv: () => void;
  onExportEvidenceCsv: () => void;
  onExportStakeholderCsv: () => void;
  onExportFindingCsv: () => void;
  onExportFormalHtml: () => void;
  onCreateServerPackage: (
    type: 'management_report' | 'audit_pack' | 'state_snapshot' | 'formal_report',
    options?: { title?: string; note?: string; signOffName?: string; signOffRole?: string },
  ) => void;
  onReleaseExportPackage: (exportId: string, releaseNote: string) => void;
  onDownloadExportPackage: (entry: ExportPackageEntry) => void;
}

export function ReportView({
  companyProfile,
  regulatoryProfile,
  regimeSummaries,
  module,
  scoreSnapshot,
  benchmark,
  governanceSummary,
  applicability,
  requirementProgress,
  requirements,
  requirementStates,
  actionItems,
  evidenceSummary,
  documentLibrarySummary,
  deadlineSummary,
  certificationProgress,
  checklistProgress,
  findingSummary,
  stakeholders,
  sites,
  kritisMilestones,
  kritisPenaltyEstimate,
  authorityAssignmentsByRegime,
  gapAnalysisSummary,
  exportPackages,
  exportApprovalRequired,
  onExportMarkdown,
  onExportManagementPdf,
  onExportAuditPdf,
  onExportActionCsv,
  onExportEvidenceCsv,
  onExportStakeholderCsv,
  onExportFindingCsv,
  onExportFormalHtml,
  onCreateServerPackage,
  onReleaseExportPackage,
  onDownloadExportPackage,
}: ReportViewProps) {
  const companyName = companyProfile.companyName.trim() || 'Unternehmen';
  const lowDomains = [...scoreSnapshot.domainScores].sort((a, b) => a.score - b.score).slice(0, 3);
  const openRequirements = requirements.filter((requirement) => {
    const status = requirementStates[requirement.id] ?? 'open';
    return status !== 'ready' && status !== 'not_applicable';
  });
  const openByRegime = regimeSummaries.map((summary) => ({
    ...summary,
    openItems: openRequirements.filter((requirement) => requirement.regimeId === summary.regimeId),
  }));
  const dueActions = [...actionItems]
    .filter((item) => item.status !== 'done')
    .sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31'))
    .slice(0, 6);
  const [releaseNoteMap, setReleaseNoteMap] = useState<Record<string, string>>({});
  const recentExports = exportPackages.slice(0, 8);
  const jurisdictionLabel = getJurisdictionLabel(regulatoryProfile.jurisdiction);
  const showEntityClass = shouldShowEntityClass(regulatoryProfile);
  const entityFieldLabel = getEntityClassFieldLabel(regulatoryProfile);

  return (
    <div className="view-stack printable-report">
      <section className="card compact no-print">
        <p className="eyebrow">Reporting</p>
        <h2>Management Summary, Auditpack und Export</h2>
        <p>
          Der Bericht bündelt Bewertung, Struktur, Umsetzung, Dokumentenbibliothek,
          Fristensteuerung und die getrennte Sicht auf KRITIS-Dachgesetz sowie BSIG / NIS2 in einer druckbaren Managementsicht.
        </p>
        <div className="hero-actions top-gap">
          <button type="button" className="button primary" onClick={onExportManagementPdf}>
            <FileText size={16} />
            Management-PDF
          </button>
          <button type="button" className="button secondary" onClick={onExportAuditPdf}>
            <FileText size={16} />
            Auditpack-PDF
          </button>
          <button type="button" className="button secondary" onClick={onExportMarkdown}>
            <Download size={16} />
            Markdown exportieren
          </button>
          <button type="button" className="button secondary" onClick={onExportFormalHtml}>
            <ScrollText size={16} />
            Formales Audit-HTML
          </button>
          <button type="button" className="button secondary" onClick={onExportActionCsv}>
            <FileSpreadsheet size={16} />
            Maßnahmen CSV
          </button>
          <button type="button" className="button secondary" onClick={onExportEvidenceCsv}>
            <FileSpreadsheet size={16} />
            Nachweise CSV
          </button>
          <button type="button" className="button secondary" onClick={onExportStakeholderCsv}>
            <FileSpreadsheet size={16} />
            Stakeholder CSV
          </button>
          <button type="button" className="button secondary" onClick={onExportFindingCsv}>
            <FileSpreadsheet size={16} />
            Feststellungen CSV
          </button>
          <button type="button" className="button primary" onClick={() => onCreateServerPackage('management_report')}>
            <ShieldCheck size={16} />
            Revisionssicheres Managementpaket
          </button>
          <button type="button" className="button secondary" onClick={() => onCreateServerPackage('audit_pack')}>
            <ShieldCheck size={16} />
            Revisionssicheres Auditpaket
          </button>
          <button type="button" className="button secondary" onClick={() => onCreateServerPackage('state_snapshot')}>
            <ShieldCheck size={16} />
            Status-Snapshot registrieren
          </button>
          <button type="button" className="button secondary" onClick={() => window.print()}>
            <Printer size={16} />
            Drucken / PDF
          </button>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Exportregister</p>
            <h3>Serverseitig registrierte Berichtspakete</h3>
          </div>
          <div className="chip-row">
            <span className="chip outline">{recentExports.length} letzte Pakete</span>
            <span className={`chip ${exportApprovalRequired ? 'warn' : 'success'}`}>
              {exportApprovalRequired ? 'Freigabe empfohlen' : 'Freigabe optional'}
            </span>
          </div>
        </div>

        <div className="priority-list top-gap">
          {recentExports.length ? recentExports.map((entry) => (
            <article key={entry.id} className="priority-item">
              <div>
                <div className="question-title-row">
                  <strong>{entry.title}</strong>
                  <span className={`chip ${entry.releaseStatus === 'released' ? 'success' : 'outline'}`}>
                    {entry.releaseStatus === 'released' ? 'Freigegeben' : 'Entwurf'}
                  </span>
                </div>
                <p className="muted small">
                  {entry.createdAt ? new Date(entry.createdAt).toLocaleString('de-DE') : 'ohne Zeitstempel'}
                  {' · '}
                  {entry.type}
                  {' · '}
                  {entry.sizeKb} KB
                </p>
                <p className="muted small">Checksumme: {entry.checksumSha256 ? `${entry.checksumSha256.slice(0, 14)}…` : '–'}</p>
              </div>
              <div className="inline-actions">
                <button type="button" className="button secondary" onClick={() => onDownloadExportPackage(entry)}>
                  <Download size={16} />
                  Paket laden
                </button>
                {entry.releaseStatus !== 'released' ? (
                  <>
                    <input
                      type="text"
                      placeholder="Freigabenotiz"
                      value={releaseNoteMap[entry.id] ?? ''}
                      onChange={(event) => setReleaseNoteMap((current) => ({ ...current, [entry.id]: event.target.value }))}
                    />
                    <button type="button" className="button secondary" onClick={() => onReleaseExportPackage(entry.id, releaseNoteMap[entry.id] ?? '')}>
                      <ShieldCheck size={16} />
                      Freigeben
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          )) : <p className="muted">Noch keine serverseitig registrierten Berichtspakete vorhanden.</p>}
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
              <strong>{benchmark.overallTarget}%</strong>
              <span>Zielwert</span>
            </div>
            <div>
              <strong>{requirementProgress.score}%</strong>
              <span>KRITIS-Readiness</span>
            </div>
            <div>
              <strong>{certificationProgress.dataAvailable ? `${certificationProgress.score}%` : '—'}</strong>
              <span>Readiness-Reife</span>
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

          <article className="report-card">
            <h3>{jurisdictionLabel}-Regime</h3>
            <div className="mini-list top-gap">
              {openByRegime.map((summary) => (
                <div key={summary.regimeId} className="mini-list-row">
                  <span>{summary.shortLabel}</span>
                  <strong>{summary.scopeStatus === 'out_of_scope' ? 'außer Scope' : `${summary.openRequirements} offen / ${summary.checklistBlockers} Blocker`}</strong>
                </div>
              ))}
              {showEntityClass ? (
                <div className="mini-list-row"><span>{entityFieldLabel}</span><strong>{getBsigEntityClassLabel(regulatoryProfile.bsigEntityClass, regulatoryProfile)}</strong></div>
              ) : (
                <div className="mini-list-row"><span>Jurisdiktion</span><strong>{jurisdictionLabel}</strong></div>
              )}
            </div>
          </article>

          <article className="report-card">
            <h3>Governance & Struktur</h3>
            <div className="mini-list top-gap">
              <div className="mini-list-row"><span>Governance-Reife</span><strong>{governanceSummary.dataAvailable ? `${governanceSummary.score}%` : '—'}</strong></div>
              <div className="mini-list-row"><span>Stakeholder</span><strong>{stakeholders.length}</strong></div>
              <div className="mini-list-row"><span>Standorte</span><strong>{sites.length}</strong></div>
              <div className="mini-list-row"><span>Fällige Reviews</span><strong>{governanceSummary.dueReviews}</strong></div>
            </div>
          </article>

          <article className="report-card">
            <h3>Auditstatus</h3>
            <div className="mini-list top-gap">
              <div className="mini-list-row"><span>Checklist-Score</span><strong>{checklistProgress.score}%</strong></div>
              <div className="mini-list-row"><span>Blocker</span><strong>{checklistProgress.blockers}</strong></div>
              <div className="mini-list-row"><span>Feststellungen offen</span><strong>{findingSummary.open}</strong></div>
              <div className="mini-list-row"><span>Kritische Feststellungen</span><strong>{findingSummary.critical}</strong></div>
            </div>
          </article>

          <article className="report-card wide">
            <h3>Domänenwerte und Ziele</h3>
            <div className="domain-score-list compact-list top-gap">
              {scoreSnapshot.domainScores.map((domain) => {
                const target = benchmark.domainTargets[domain.domainId] ?? 0;
                const gap = Math.round((target - domain.score) * 10) / 10;
                return (
                  <div key={domain.domainId} className="domain-score-item">
                    <div className="domain-score-head">
                      <strong>{domain.label}</strong>
                      <span>{domain.score}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${domain.score}%` }} />
                    </div>
                    <div className="domain-score-foot">
                      <span>Ziel {target}%</span>
                      <span>{gap <= 0 ? 'im Ziel' : `${gap}% offen`}</span>
                    </div>
                  </div>
                );
              })}
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

          <article className="report-card wide">
            <h3>Offene Pflichtbausteine je Regime</h3>
            <div className="priority-list compact-list top-gap">
              {openByRegime.map((summary) => (
                <article key={summary.regimeId} className="priority-item">
                  <div>
                    <strong>{summary.label}</strong>
                    <p className="muted small">{summary.focus}</p>
                  </div>
                  <div>
                    {summary.openItems.length ? (
                      <div className="mini-list">
                        {summary.openItems.slice(0, 3).map((item) => (
                          <div key={item.id} className="mini-list-row"><span>{item.title}</span><strong>{item.lawRef || '-'}</strong></div>
                        ))}
                      </div>
                    ) : <p className="muted small">Keine offenen Pflichtbausteine.</p>}
                  </div>
                </article>
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
              <div className="mini-list-row"><span>Abdeckung</span><strong>{evidenceSummary.dataAvailable ? `${evidenceSummary.coverage}%` : '—'}</strong></div>
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

          <article className="report-card">
            <h3>Dokumentenbibliothek</h3>
            <div className="mini-list top-gap">
              <div className="mini-list-row"><span>Einträge</span><strong>{documentLibrarySummary.total}</strong></div>
              <div className="mini-list-row"><span>Anhänge</span><strong>{documentLibrarySummary.attachedFiles}</strong></div>
              <div className="mini-list-row"><span>Reviews fällig</span><strong>{documentLibrarySummary.dueReviews}</strong></div>
              <div className="mini-list-row"><span>Abgelaufen</span><strong>{documentLibrarySummary.expired}</strong></div>
            </div>
          </article>

          <article className="report-card">
            <h3>Fristen-Cockpit</h3>
            <div className="mini-list top-gap">
              <div className="mini-list-row"><span>Gesamt</span><strong>{deadlineSummary.total}</strong></div>
              <div className="mini-list-row"><span>Überfällig</span><strong>{deadlineSummary.overdue}</strong></div>
              <div className="mini-list-row"><span>Ohne Fälligkeitsdatum</span><strong>{deadlineSummary.undated}</strong></div>
              <div className="mini-list-row"><span>≤ 30 Tage</span><strong>{deadlineSummary.dueSoon}</strong></div>
              <div className="mini-list-row"><span>Regulatorisch</span><strong>{deadlineSummary.regulatory}</strong></div>
            </div>
          </article>

          <article className="report-card wide">
            <h3>Zuständige Behörden</h3>
            {regimeSummaries
              .filter((summary) => summary.scopeStatus !== 'out_of_scope')
              .map((summary) => {
                const assignments = authorityAssignmentsByRegime[summary.regimeId] ?? [];
                return (
                  <div key={summary.regimeId} className="top-gap">
                    <strong>{summary.label}</strong>
                    {assignments.length ? (
                      <ul className="plain-list">
                        {assignments.map((assignment, index) => (
                          <li key={`${assignment.authorityId}-${assignment.role}-${index}`}>
                            <strong>{assignment.authority.shortName}</strong>
                            {' — '}
                            {getAuthorityRoleLabel(assignment.role)}
                            {' · '}
                            {assignment.lawRef}
                            {assignment.note ? (
                              <>
                                <br />
                                <span className="muted small">{assignment.note}</span>
                              </>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">Keine Behördenzuordnung hinterlegt.</p>
                    )}
                  </div>
                );
              })}
          </article>

          <article className="report-card wide">
            <h3>Gap-Analyse und Aufwandsschätzung</h3>
            <p className="top-gap">
              <strong>Geschätzter Restaufwand:</strong>{' '}
              {formatPersonDaysRange(gapAnalysisSummary.minPersonDays, gapAnalysisSummary.maxPersonDays)}
              {gapAnalysisSummary.totalPersonDays > 0
                ? ` · ≈ ${formatCalendarWeeksRange(gapAnalysisSummary.minCalendarWeeks, gapAnalysisSummary.maxCalendarWeeks)}`
                : ''}
            </p>
            {gapAnalysisSummary.byRegime.length > 0 ? (
              <ul className="plain-list top-gap">
                {gapAnalysisSummary.byRegime.map((regime) => (
                  <li key={regime.regimeId}>
                    <strong>{regime.regimeLabel}:</strong>{' '}
                    {formatPersonDaysRange(regime.minPersonDays, regime.maxPersonDays)}
                    {Object.keys(regime.byCategory).length > 0 ? (
                      <span className="muted small">
                        {' '}(
                        {Object.entries(regime.byCategory)
                          .map(([category, range]) => `${category}: ${formatPersonDaysRange(range.minPersonDays, range.maxPersonDays)}`)
                          .join(', ')}
                        )
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Keine Pflichten im aktuellen Mandantenbild.</p>
            )}
            <p className="muted small top-gap">
              Aufwandsschätzung pro Anforderung mit Bandbreite (Min – Max). Status der
              Anforderungen wird primär aus expliziten Setzungen, sekundär aus den Antworten der
              Grundanalyse abgeleitet. Detail-Aufschlüsselung pro Anforderung im Dashboard und
              im DOCX-Angebotsdokument.
            </p>
          </article>

          <article className="report-card wide">
            <h3>Nächste Fristen</h3>
            <div className="priority-list top-gap">
              {deadlineSummary.nextItems.length ? deadlineSummary.nextItems.slice(0, 6).map((item) => (
                <div key={item.id} className="priority-item compact-item">
                  <div>
                    <strong>{item.title}</strong>
                    <p className="muted small">{item.category} · {item.owner}</p>
                  </div>
                  <span className="chip outline">{item.dueDate || 'offen'}</span>
                </div>
              )) : <p className="muted">Noch keine Fristen gepflegt.</p>}
            </div>
          </article>

          {regulatoryProfile.jurisdiction === 'DE' &&
          regulatoryProfile.scopeByRegime.de_kritisdachg !== 'out_of_scope' ? (
            <>
              <article className="report-card">
                <h3>Geschäftsleitungshaftung (§ 20 KRITISDachG)</h3>
                <ul className="plain-list top-gap">
                  <li>
                    <strong>Entity-Status:</strong>{' '}
                    {regulatoryProfile.kritisEntityStatus === 'obligations_active'
                      ? 'Pflichten aktiv'
                      : regulatoryProfile.kritisEntityStatus === 'registered'
                        ? 'Registriert'
                        : regulatoryProfile.kritisEntityStatus === 'identified_not_registered'
                          ? 'Identifiziert, noch nicht registriert'
                          : 'Kritikalität noch nicht geprüft'}
                  </li>
                  <li>
                    <strong>Pflichten aktiv ab:</strong>{' '}
                    {kritisMilestones.managementAccountabilityActiveAt ?? 'offen (Registrierung steht aus)'}
                  </li>
                  <li>
                    <strong>Geschäftsleitung (benannt):</strong>{' '}
                    {regulatoryProfile.managementBoardContact?.trim() || 'Noch nicht hinterlegt'}
                  </li>
                  <li>
                    <strong>Programmverantwortung:</strong> {regulatoryProfile.owner?.trim() || 'Noch nicht hinterlegt'}
                  </li>
                </ul>
                <p className="muted small top-gap">
                  Bei Pflichtverletzung kommt eine persönliche Haftung der Leitungsorgane nach
                  allgemeinem Gesellschaftsrecht in Betracht.
                </p>
              </article>

              {SHOW_PENALTY_EXPOSURE ? (
                <article className="report-card">
                  <h3>Bußgeldrahmen (§ 24 KRITISDachG)</h3>
                  <p className="top-gap">
                    <strong>Potenzielle Oberschwelle:</strong>{' '}
                    {kritisPenaltyEstimate.upperBound.toLocaleString('de-DE')} €
                  </p>
                  {kritisPenaltyEstimate.rationale.length ? (
                    <ul className="plain-list top-gap">
                      {kritisPenaltyEstimate.rationale.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Keine offenen Tatbestände erkannt.</p>
                  )}
                  <p className="muted small top-gap">
                    Die Oberschwelle ist kumulativ; Sanktionen werden ab 2027 wirksam. Behördliche
                    Einzelfallbewertung bleibt vorbehalten.
                  </p>
                </article>
              ) : null}
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
