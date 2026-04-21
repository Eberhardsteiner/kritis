import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileArchive,
  LockKeyhole,
  RefreshCw,
  Rocket,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import { StatCard } from '../../../components/StatCard';
import type {
  ExportPackageEntry,
  HardeningCheckItem,
  IntegritySummary,
  ReleaseGateItem,
  RolloutPlan,
  RunbookItem,
} from '../../../types';

interface RolloutViewProps {
  companyName: string;
  moduleName: string;
  rolloutPlan: RolloutPlan;
  hardeningChecks: HardeningCheckItem[];
  runbooks: RunbookItem[];
  releaseGates: ReleaseGateItem[];
  integritySummary: IntegritySummary | null;
  handoverBundles: ExportPackageEntry[];
  exportApprovalRequired: boolean;
  serverMode: 'checking' | 'connected' | 'syncing' | 'offline' | 'error' | 'auth_required';
  onUpdateRolloutPlan: (field: keyof RolloutPlan, value: string) => void;
  onCreateEmptyHardeningCheck: () => void;
  onGenerateHardeningBaseline: () => void;
  onUpdateHardeningCheck: (checkId: string, patch: Partial<HardeningCheckItem>) => void;
  onDeleteHardeningCheck: (checkId: string) => void;
  onCreateEmptyRunbook: () => void;
  onGenerateRunbookTemplates: () => void;
  onUpdateRunbook: (runbookId: string, patch: Partial<RunbookItem>) => void;
  onDeleteRunbook: (runbookId: string) => void;
  onCreateEmptyReleaseGate: () => void;
  onGenerateReleaseGateBaseline: () => void;
  onUpdateReleaseGate: (gateId: string, patch: Partial<ReleaseGateItem>) => void;
  onDeleteReleaseGate: (gateId: string) => void;
  onRefreshIntegritySummary: () => void;
  onCreateHandoverBundle: () => void;
  onReleaseExportPackage: (exportId: string, releaseNote: string) => void;
  onDownloadExportPackage: (entry: ExportPackageEntry) => void;
}

function formatDate(value: string): string {
  if (!value) {
    return '–';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('de-DE');
}

function formatDateTime(value: string): string {
  if (!value) {
    return '–';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('de-DE');
}

function decisionLabel(status: RolloutPlan['decisionStatus']): string {
  if (status === 'ready_for_go_live') {
    return 'Go-Live bereit';
  }
  if (status === 'released') {
    return 'Ausgerollt';
  }
  if (status === 'postponed') {
    return 'Verschoben';
  }
  return 'In Vorbereitung';
}

function decisionTone(status: RolloutPlan['decisionStatus']): 'success' | 'warn' | 'danger' | 'outline' {
  if (status === 'released') {
    return 'success';
  }
  if (status === 'ready_for_go_live') {
    return 'warn';
  }
  if (status === 'postponed') {
    return 'danger';
  }
  return 'outline';
}

function hardeningStatusLabel(status: HardeningCheckItem['status']): string {
  if (status === 'planned') {
    return 'Geplant';
  }
  if (status === 'done') {
    return 'Erledigt';
  }
  if (status === 'blocked') {
    return 'Blockiert';
  }
  if (status === 'not_applicable') {
    return 'Nicht relevant';
  }
  return 'Offen';
}

function hardeningStatusTone(status: HardeningCheckItem['status']): 'success' | 'warn' | 'danger' | 'outline' {
  if (status === 'done' || status === 'not_applicable') {
    return 'success';
  }
  if (status === 'planned') {
    return 'warn';
  }
  if (status === 'blocked') {
    return 'danger';
  }
  return 'outline';
}

function runbookStatusLabel(status: RunbookItem['status']): string {
  if (status === 'review') {
    return 'In Review';
  }
  if (status === 'approved') {
    return 'Freigegeben';
  }
  if (status === 'retired') {
    return 'Außer Betrieb';
  }
  return 'Entwurf';
}

function runbookStatusTone(status: RunbookItem['status']): 'success' | 'warn' | 'danger' | 'outline' {
  if (status === 'approved') {
    return 'success';
  }
  if (status === 'review') {
    return 'warn';
  }
  if (status === 'retired') {
    return 'danger';
  }
  return 'outline';
}

function gateStatusLabel(status: ReleaseGateItem['status']): string {
  if (status === 'ready') {
    return 'Erfüllt';
  }
  if (status === 'blocked') {
    return 'Blockiert';
  }
  if (status === 'waived') {
    return 'Freigestellt';
  }
  return 'Offen';
}

function gateStatusTone(status: ReleaseGateItem['status']): 'success' | 'warn' | 'danger' | 'outline' {
  if (status === 'ready' || status === 'waived') {
    return 'success';
  }
  if (status === 'blocked') {
    return 'danger';
  }
  return 'warn';
}

export function RolloutView({
  companyName,
  moduleName,
  rolloutPlan,
  hardeningChecks,
  runbooks,
  releaseGates,
  integritySummary,
  handoverBundles,
  exportApprovalRequired,
  serverMode,
  onUpdateRolloutPlan,
  onCreateEmptyHardeningCheck,
  onGenerateHardeningBaseline,
  onUpdateHardeningCheck,
  onDeleteHardeningCheck,
  onCreateEmptyRunbook,
  onGenerateRunbookTemplates,
  onUpdateRunbook,
  onDeleteRunbook,
  onCreateEmptyReleaseGate,
  onGenerateReleaseGateBaseline,
  onUpdateReleaseGate,
  onDeleteReleaseGate,
  onRefreshIntegritySummary,
  onCreateHandoverBundle,
  onReleaseExportPackage,
  onDownloadExportPackage,
}: RolloutViewProps) {
  const [releaseNoteMap, setReleaseNoteMap] = useState<Record<string, string>>({});

  const hardeningSummary = useMemo(() => {
    const relevantDone = hardeningChecks.filter((item) => item.status === 'done' || item.status === 'not_applicable').length;
    const blocked = hardeningChecks.filter((item) => item.status === 'blocked').length;
    const criticalOpen = hardeningChecks.filter((item) => item.critical && item.status !== 'done' && item.status !== 'not_applicable').length;
    return {
      total: hardeningChecks.length,
      done: relevantDone,
      blocked,
      criticalOpen,
      percent: hardeningChecks.length ? Math.round((relevantDone / hardeningChecks.length) * 100) : 0,
    };
  }, [hardeningChecks]);

  const runbookSummary = useMemo(() => {
    const approved = runbooks.filter((item) => item.status === 'approved').length;
    const review = runbooks.filter((item) => item.status === 'review').length;
    return {
      total: runbooks.length,
      approved,
      review,
      percent: runbooks.length ? Math.round((approved / runbooks.length) * 100) : 0,
    };
  }, [runbooks]);

  const gateSummary = useMemo(() => {
    const required = releaseGates.filter((item) => item.required);
    const readyRequired = required.filter((item) => item.status === 'ready' || item.status === 'waived').length;
    const blocked = releaseGates.filter((item) => item.status === 'blocked').length;
    return {
      total: releaseGates.length,
      required: required.length,
      readyRequired,
      blocked,
      percent: required.length ? Math.round((readyRequired / required.length) * 100) : 0,
    };
  }, [releaseGates]);

  const latestBundle = handoverBundles[0] ?? null;
  const isServerAvailable = serverMode === 'connected' || serverMode === 'syncing';
  const goLiveReady = gateSummary.required === gateSummary.readyRequired
    && hardeningSummary.criticalOpen === 0
    && (integritySummary?.highCount ?? 0) === 0
    && rolloutPlan.decisionStatus !== 'postponed';

  return (
    <div className="view-stack">
      <section className="hero card">
        <div>
          <p className="eyebrow">Go-Live & Übergabe</p>
          <h2>Härtung, Betriebsfreigabe und Abschlussübergabe für {moduleName}</h2>
          <p className="hero-text">
            Phase 10 bündelt den finalen Go-Live-Plan, technische Härtung, Runbooks,
            Freigabegates, Integritätsprüfung und das revisionssichere Übergabebündel
            für {companyName.trim() || 'den aktuellen Arbeitsbereich'}.
          </p>
        </div>
        <div className="chip-row top-gap">
          <span className={`chip ${decisionTone(rolloutPlan.decisionStatus)}`}>{decisionLabel(rolloutPlan.decisionStatus)}</span>
          <span className={`chip ${goLiveReady ? 'success' : 'warn'}`}>
            {goLiveReady ? 'Go-Live fachlich bereit' : 'Offene Go-Live-Punkte'}
          </span>
          <span className={`chip ${isServerAvailable ? 'success' : 'outline'}`}>
            {isServerAvailable ? 'Server erreichbar' : 'Nur lokaler Modus'}
          </span>
          <span className={`chip ${exportApprovalRequired ? 'warn' : 'outline'}`}>
            {exportApprovalRequired ? 'Freigabeprozess aktiv' : 'Freigabe optional'}
          </span>
        </div>
        <div className="hero-actions top-gap">
          <button type="button" className="button secondary" onClick={onRefreshIntegritySummary}>
            <RefreshCw size={16} />
            Integrität aktualisieren
          </button>
          <button type="button" className="button primary" onClick={onCreateHandoverBundle}>
            <FileArchive size={16} />
            Übergabebündel registrieren
          </button>
          {latestBundle ? (
            <button type="button" className="button secondary" onClick={() => onDownloadExportPackage(latestBundle)}>
              <Download size={16} />
              Letztes Bündel laden
            </button>
          ) : null}
        </div>
      </section>

      <section className="stats-grid phase-three">
        <StatCard
          title="Härtung"
          value={`${hardeningSummary.done}/${hardeningSummary.total || 0}`}
          subtitle={hardeningSummary.total ? `${hardeningSummary.percent}% abgeschlossen` : 'Noch keine Checks angelegt'}
          tone={hardeningSummary.criticalOpen === 0 && hardeningSummary.blocked === 0 ? 'good' : hardeningSummary.blocked > 0 ? 'alert' : 'warn'}
        />
        <StatCard
          title="Runbooks"
          value={`${runbookSummary.approved}/${runbookSummary.total || 0}`}
          subtitle={runbookSummary.total ? `${runbookSummary.percent}% freigegeben` : 'Noch keine Runbooks angelegt'}
          tone={runbookSummary.percent >= 80 ? 'good' : runbookSummary.review > 0 ? 'warn' : 'default'}
        />
        <StatCard
          title="Release Gates"
          value={`${gateSummary.readyRequired}/${gateSummary.required || 0}`}
          subtitle={gateSummary.required ? `${gateSummary.percent}% der Pflichtgates erfüllt` : 'Noch keine Pflichtgates definiert'}
          tone={gateSummary.blocked > 0 ? 'alert' : gateSummary.required > 0 && gateSummary.readyRequired === gateSummary.required ? 'good' : 'warn'}
        />
        <StatCard
          title="Integrität"
          value={integritySummary ? `${integritySummary.issueCount}` : '–'}
          subtitle={integritySummary ? `${integritySummary.filesChecked} Artefakte geprüft` : 'Noch kein Scan geladen'}
          tone={!integritySummary ? 'default' : integritySummary.highCount > 0 ? 'alert' : integritySummary.issueCount > 0 ? 'warn' : 'good'}
        />
      </section>

      <div className="content-grid two-column">
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Rollout-Plan</p>
              <h3>Freigabe- und Go-Live-Steuerung</h3>
            </div>
            <span className="chip outline">Version {rolloutPlan.releaseVersion || '1.0.0'}</span>
          </div>
          <div className="form-grid two-column">
            <label className="field-label">
              Release-Version
              <input
                type="text"
                value={rolloutPlan.releaseVersion}
                onChange={(event) => onUpdateRolloutPlan('releaseVersion', event.target.value)}
              />
            </label>
            <label className="field-label">
              Ziel-Go-Live
              <input
                type="date"
                value={rolloutPlan.targetGoLiveDate}
                onChange={(event) => onUpdateRolloutPlan('targetGoLiveDate', event.target.value)}
              />
            </label>
            <label className="field-label">
              Freeze-Datum
              <input
                type="date"
                value={rolloutPlan.freezeDate}
                onChange={(event) => onUpdateRolloutPlan('freezeDate', event.target.value)}
              />
            </label>
            <label className="field-label">
              Deployment-Fenster
              <input
                type="text"
                placeholder="z. B. Samstag 20:00 bis 23:00"
                value={rolloutPlan.deploymentWindow}
                onChange={(event) => onUpdateRolloutPlan('deploymentWindow', event.target.value)}
              />
            </label>
            <label className="field-label">
              Hypercare in Tagen
              <input
                type="text"
                value={rolloutPlan.hypercareDays}
                onChange={(event) => onUpdateRolloutPlan('hypercareDays', event.target.value)}
              />
            </label>
            <label className="field-label">
              Entscheidungsstatus
              <select
                value={rolloutPlan.decisionStatus}
                onChange={(event) => onUpdateRolloutPlan('decisionStatus', event.target.value)}
              >
                <option value="draft">In Vorbereitung</option>
                <option value="ready_for_go_live">Bereit für Go-Live</option>
                <option value="released">Ausgerollt</option>
                <option value="postponed">Verschoben</option>
              </select>
            </label>
            <label className="field-label">
              Rollback-Verantwortung
              <input
                type="text"
                value={rolloutPlan.rollbackOwner}
                onChange={(event) => onUpdateRolloutPlan('rollbackOwner', event.target.value)}
              />
            </label>
            <label className="field-label">
              Support Lead / Hypercare
              <input
                type="text"
                value={rolloutPlan.supportLead}
                onChange={(event) => onUpdateRolloutPlan('supportLead', event.target.value)}
              />
            </label>
            <label className="field-label wide">
              Kommunikationsplan
              <textarea
                placeholder="Stakeholder, Verteiler, Go-Live-Kommunikation, Eskalation"
                value={rolloutPlan.communicationPlan}
                onChange={(event) => onUpdateRolloutPlan('communicationPlan', event.target.value)}
              />
            </label>
            <label className="field-label wide">
              Entscheidungsnotiz
              <textarea
                placeholder="Go-Live-Entscheidung, Restpunkte, Auflagen"
                value={rolloutPlan.decisionNote}
                onChange={(event) => onUpdateRolloutPlan('decisionNote', event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Abschlussstatus</p>
              <h3>Freigabe- und Übergabebild</h3>
            </div>
            <Rocket size={18} />
          </div>
          <div className="priority-list">
            <article className="priority-item">
              <div className="priority-icon"><Rocket size={18} /></div>
              <div>
                <strong>Zieltermin</strong>
                <p className="muted small">{formatDate(rolloutPlan.targetGoLiveDate)} · Freeze: {formatDate(rolloutPlan.freezeDate)}</p>
                <p className="muted small">Deployment-Fenster: {rolloutPlan.deploymentWindow || 'noch nicht definiert'}</p>
              </div>
            </article>
            <article className="priority-item">
              <div className="priority-icon"><ShieldCheck size={18} /></div>
              <div>
                <strong>Kritische Restpunkte</strong>
                <p className="muted small">{hardeningSummary.criticalOpen} kritische Härtungspunkte offen · {gateSummary.blocked} blockierte Gates</p>
                <p className="muted small">{integritySummary ? `${integritySummary.highCount} hohe Integritätsbefunde` : 'Integritätsstatus noch nicht geladen'}</p>
              </div>
            </article>
            <article className="priority-item">
              <div className="priority-icon"><ScrollText size={18} /></div>
              <div>
                <strong>Runbook- und Übergabereife</strong>
                <p className="muted small">{runbookSummary.approved} freigegebene Runbooks · {handoverBundles.length} registrierte Übergabebündel</p>
                <p className="muted small">Rollback Owner: {rolloutPlan.rollbackOwner || 'nicht benannt'} · Support Lead: {rolloutPlan.supportLead || 'nicht benannt'}</p>
              </div>
            </article>
          </div>
          <div className="chip-row top-gap">
            <span className={`chip ${goLiveReady ? 'success' : 'warn'}`}>{goLiveReady ? 'Bereit für Freigabeentscheidung' : 'Vor Go-Live noch offen'}</span>
            <span className="chip outline">Hypercare: {rolloutPlan.hypercareDays || '–'} Tage</span>
            <span className="chip outline">Letztes Bündel: {latestBundle ? formatDateTime(latestBundle.createdAt) : 'noch keines'}</span>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Härtungscheckliste</p>
            <h3>Technische und organisatorische Produktionsreife</h3>
          </div>
          <div className="hero-actions">
            <button type="button" className="button secondary" onClick={onGenerateHardeningBaseline}>
              <ShieldCheck size={16} />
              Baseline erzeugen
            </button>
            <button type="button" className="button primary" onClick={onCreateEmptyHardeningCheck}>
              <CheckCircle2 size={16} />
              Check anlegen
            </button>
          </div>
        </div>
        <div className="work-list">
          {hardeningChecks.length ? hardeningChecks.map((item) => (
            <article key={item.id} className="work-card">
              <div className="work-card-head">
                <div>
                  <div className="question-title-row">
                    <strong>{item.title || 'Neuer Härtungscheck'}</strong>
                    <span className={`chip ${hardeningStatusTone(item.status)}`}>{hardeningStatusLabel(item.status)}</span>
                    {item.critical ? <span className="chip danger">Kritisch</span> : <span className="chip outline">Standard</span>}
                  </div>
                  <p className="muted small">Bereich: {item.area || 'Allgemein'} · Fällig: {formatDate(item.dueDate)}</p>
                </div>
                <button type="button" className="icon-button" onClick={() => onDeleteHardeningCheck(item.id)} aria-label="Härtungscheck löschen">
                  ×
                </button>
              </div>
              <div className="form-grid two-column">
                <label className="field-label">
                  Bereich
                  <input type="text" value={item.area} onChange={(event) => onUpdateHardeningCheck(item.id, { area: event.target.value })} />
                </label>
                <label className="field-label">
                  Eigentümer
                  <input type="text" value={item.owner} onChange={(event) => onUpdateHardeningCheck(item.id, { owner: event.target.value })} />
                </label>
                <label className="field-label wide">
                  Titel
                  <input type="text" value={item.title} onChange={(event) => onUpdateHardeningCheck(item.id, { title: event.target.value })} />
                </label>
                <label className="field-label">
                  Fällig am
                  <input type="date" value={item.dueDate} onChange={(event) => onUpdateHardeningCheck(item.id, { dueDate: event.target.value })} />
                </label>
                <label className="field-label">
                  Status
                  <select value={item.status} onChange={(event) => onUpdateHardeningCheck(item.id, { status: event.target.value as HardeningCheckItem['status'] })}>
                    <option value="open">Offen</option>
                    <option value="planned">Geplant</option>
                    <option value="done">Erledigt</option>
                    <option value="blocked">Blockiert</option>
                    <option value="not_applicable">Nicht relevant</option>
                  </select>
                </label>
                <label className="field-label wide">
                  Evidenz / Referenz
                  <input type="text" value={item.evidenceRef} onChange={(event) => onUpdateHardeningCheck(item.id, { evidenceRef: event.target.value })} />
                </label>
                <label className="field-label wide">
                  Notizen
                  <textarea value={item.notes} onChange={(event) => onUpdateHardeningCheck(item.id, { notes: event.target.value })} />
                </label>
                <label className="checkbox-row wide">
                  <input type="checkbox" checked={item.critical} onChange={(event) => onUpdateHardeningCheck(item.id, { critical: event.target.checked })} />
                  Kritischer Go-Live-Blocker
                </label>
              </div>
            </article>
          )) : (
            <p className="muted">Noch keine Härtungschecks vorhanden.</p>
          )}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Runbooks</p>
            <h3>Betriebs-, Notfall- und Übergabedokumentation</h3>
          </div>
          <div className="hero-actions">
            <button type="button" className="button secondary" onClick={onGenerateRunbookTemplates}>
              <ScrollText size={16} />
              Vorlagen erzeugen
            </button>
            <button type="button" className="button primary" onClick={onCreateEmptyRunbook}>
              <CheckCircle2 size={16} />
              Runbook anlegen
            </button>
          </div>
        </div>
        <div className="work-list">
          {runbooks.length ? runbooks.map((item) => (
            <article key={item.id} className="work-card">
              <div className="work-card-head">
                <div>
                  <div className="question-title-row">
                    <strong>{item.title || 'Neues Runbook'}</strong>
                    <span className={`chip ${runbookStatusTone(item.status)}`}>{runbookStatusLabel(item.status)}</span>
                    <span className="chip outline">{item.category || 'Betrieb'}</span>
                  </div>
                  <p className="muted small">Version {item.version || '1.0'} · Review {formatDate(item.reviewDate)}</p>
                </div>
                <button type="button" className="icon-button" onClick={() => onDeleteRunbook(item.id)} aria-label="Runbook löschen">
                  ×
                </button>
              </div>
              <div className="form-grid two-column">
                <label className="field-label wide">
                  Titel
                  <input type="text" value={item.title} onChange={(event) => onUpdateRunbook(item.id, { title: event.target.value })} />
                </label>
                <label className="field-label">
                  Kategorie
                  <input type="text" value={item.category} onChange={(event) => onUpdateRunbook(item.id, { category: event.target.value })} />
                </label>
                <label className="field-label">
                  Eigentümer
                  <input type="text" value={item.owner} onChange={(event) => onUpdateRunbook(item.id, { owner: event.target.value })} />
                </label>
                <label className="field-label">
                  Version
                  <input type="text" value={item.version} onChange={(event) => onUpdateRunbook(item.id, { version: event.target.value })} />
                </label>
                <label className="field-label">
                  Review-Datum
                  <input type="date" value={item.reviewDate} onChange={(event) => onUpdateRunbook(item.id, { reviewDate: event.target.value })} />
                </label>
                <label className="field-label">
                  Status
                  <select value={item.status} onChange={(event) => onUpdateRunbook(item.id, { status: event.target.value as RunbookItem['status'] })}>
                    <option value="draft">Entwurf</option>
                    <option value="review">In Review</option>
                    <option value="approved">Freigegeben</option>
                    <option value="retired">Außer Betrieb</option>
                  </select>
                </label>
                <label className="field-label wide">
                  Ablage / Link
                  <input type="text" value={item.location} onChange={(event) => onUpdateRunbook(item.id, { location: event.target.value })} />
                </label>
                <label className="field-label wide">
                  Notizen
                  <textarea value={item.notes} onChange={(event) => onUpdateRunbook(item.id, { notes: event.target.value })} />
                </label>
              </div>
            </article>
          )) : (
            <p className="muted">Noch keine Runbooks vorhanden.</p>
          )}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Release Gates</p>
            <h3>Formale Freigabepunkte vor dem Go-Live</h3>
          </div>
          <div className="hero-actions">
            <button type="button" className="button secondary" onClick={onGenerateReleaseGateBaseline}>
              <LockKeyhole size={16} />
              Baseline erzeugen
            </button>
            <button type="button" className="button primary" onClick={onCreateEmptyReleaseGate}>
              <CheckCircle2 size={16} />
              Gate anlegen
            </button>
          </div>
        </div>
        <div className="work-list">
          {releaseGates.length ? releaseGates.map((item) => (
            <article key={item.id} className="work-card">
              <div className="work-card-head">
                <div>
                  <div className="question-title-row">
                    <strong>{item.title || 'Neues Gate'}</strong>
                    <span className={`chip ${gateStatusTone(item.status)}`}>{gateStatusLabel(item.status)}</span>
                    {item.required ? <span className="chip warn">Pflichtgate</span> : <span className="chip outline">Optional</span>}
                  </div>
                  <p className="muted small">Eigentümer: {item.owner || '–'}</p>
                </div>
                <button type="button" className="icon-button" onClick={() => onDeleteReleaseGate(item.id)} aria-label="Gate löschen">
                  ×
                </button>
              </div>
              <div className="form-grid two-column">
                <label className="field-label wide">
                  Titel
                  <input type="text" value={item.title} onChange={(event) => onUpdateReleaseGate(item.id, { title: event.target.value })} />
                </label>
                <label className="field-label">
                  Eigentümer
                  <input type="text" value={item.owner} onChange={(event) => onUpdateReleaseGate(item.id, { owner: event.target.value })} />
                </label>
                <label className="field-label">
                  Status
                  <select value={item.status} onChange={(event) => onUpdateReleaseGate(item.id, { status: event.target.value as ReleaseGateItem['status'] })}>
                    <option value="open">Offen</option>
                    <option value="ready">Erfüllt</option>
                    <option value="blocked">Blockiert</option>
                    <option value="waived">Freigestellt</option>
                  </select>
                </label>
                <label className="field-label wide">
                  Evidenz / Referenz
                  <input type="text" value={item.evidenceRef} onChange={(event) => onUpdateReleaseGate(item.id, { evidenceRef: event.target.value })} />
                </label>
                <label className="field-label wide">
                  Notizen
                  <textarea value={item.notes} onChange={(event) => onUpdateReleaseGate(item.id, { notes: event.target.value })} />
                </label>
                <label className="checkbox-row wide">
                  <input type="checkbox" checked={item.required} onChange={(event) => onUpdateReleaseGate(item.id, { required: event.target.checked })} />
                  Pflichtgate für Go-Live
                </label>
              </div>
            </article>
          )) : (
            <p className="muted">Noch keine Release Gates vorhanden.</p>
          )}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Integrität & Übergabe</p>
            <h3>Scanbefunde und registrierte Übergabebündel</h3>
          </div>
          <div className="chip-row">
            <span className={`chip ${integritySummary?.ok ? 'success' : integritySummary ? 'warn' : 'outline'}`}>
              {integritySummary ? (integritySummary.ok ? 'Integrität ohne Befund' : 'Integritätsbefunde vorhanden') : 'Integrität noch nicht geladen'}
            </span>
            <span className="chip outline">{handoverBundles.length} Bündel</span>
          </div>
        </div>

        <div className="content-grid two-column">
          <div>
            {integritySummary ? (
              <div className="priority-list">
                <article className="priority-item">
                  <div className="priority-icon">
                    {integritySummary.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  </div>
                  <div>
                    <strong>Letzter Integritätsscan</strong>
                    <p className="muted small">{formatDateTime(integritySummary.scannedAt)} · Scope: {integritySummary.scopeLabel}</p>
                    <p className="muted small">{integritySummary.filesChecked} Artefakte geprüft · {integritySummary.highCount} hoch · {integritySummary.mediumCount} mittel · {integritySummary.lowCount} niedrig</p>
                  </div>
                </article>
                {integritySummary.issues.length ? integritySummary.issues.slice(0, 8).map((issue) => (
                  <article key={`${issue.category}-${issue.relatedId || issue.message}`} className="priority-item">
                    <div className="priority-icon"><AlertTriangle size={18} /></div>
                    <div>
                      <strong>{issue.category}</strong>
                      <p className="muted small">{issue.message}</p>
                    </div>
                    <span className={`chip ${issue.severity === 'high' ? 'danger' : issue.severity === 'medium' ? 'warn' : 'outline'}`}>
                      {issue.severity}
                    </span>
                  </article>
                )) : (
                  <p className="muted">Keine offenen Integritätsbefunde.</p>
                )}
              </div>
            ) : (
              <p className="muted">Noch kein Integritätsscan geladen.</p>
            )}
          </div>

          <div>
            <div className="work-list">
              {handoverBundles.length ? handoverBundles.slice(0, 8).map((entry) => (
                <article key={entry.id} className="work-card">
                  <div className="work-card-head">
                    <div>
                      <div className="question-title-row">
                        <strong>{entry.title}</strong>
                        <span className={`chip ${entry.releaseStatus === 'released' ? 'success' : 'outline'}`}>
                          {entry.releaseStatus === 'released' ? 'Freigegeben' : 'Entwurf'}
                        </span>
                      </div>
                      <p className="muted small">{formatDateTime(entry.createdAt)} · {entry.sizeKb} KB</p>
                      <p className="muted small">Checksumme: {entry.checksumSha256 ? `${entry.checksumSha256.slice(0, 14)}…` : '–'}</p>
                    </div>
                    <button type="button" className="button secondary" onClick={() => onDownloadExportPackage(entry)}>
                      <Download size={16} />
                      Laden
                    </button>
                  </div>
                  <p className="muted small">{entry.note || 'Ohne Notiz'}</p>
                  {entry.releaseStatus !== 'released' ? (
                    <div className="inline-actions">
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
                    </div>
                  ) : null}
                </article>
              )) : (
                <p className="muted">Noch keine serverseitig registrierten Übergabebündel vorhanden.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
