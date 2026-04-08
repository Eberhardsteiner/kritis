import { CheckCircle2, Clock3, FolderKanban, ShieldCheck } from 'lucide-react';
import { programPhases, sprintDefinitions, type RoadmapStatus } from '../data/programRoadmap';

interface ProgramViewProps {
  companyName: string;
  moduleName: string;
  overallScore: number;
  requirementScore: number;
  evidenceCoverage: number;
  exportCount: number;
}

function statusClass(status: RoadmapStatus): string {
  if (status === 'completed') {
    return 'success';
  }
  if (status === 'current') {
    return 'warn';
  }
  return 'outline';
}

function statusLabel(status: RoadmapStatus): string {
  if (status === 'completed') {
    return 'Erledigt';
  }
  if (status === 'current') {
    return 'Aktuell';
  }
  return 'Geplant';
}

export function ProgramView({
  companyName,
  moduleName,
  overallScore,
  requirementScore,
  evidenceCoverage,
  exportCount,
}: ProgramViewProps) {
  const completedSprints = sprintDefinitions.filter((entry) => entry.status === 'completed').length;
  const plannedSprints = sprintDefinitions.filter((entry) => entry.status === 'planned').length;
  const completedPhases = programPhases.filter((entry) => entry.status === 'completed').length;

  return (
    <div className="view-stack">
      <section className="card">
        <p className="eyebrow">Programmsteuerung</p>
        <h2>Phasen, Sprints und aktueller Ausbaustand</h2>
        <p>
          Diese Sicht ordnet die bereits umgesetzten Pakete in ein konsistentes Programm ein und
          zeigt, welche Ausbauziele bereits abgeschlossen wurden und wie sich die Phasen den Sprints zuordnen.
        </p>
        <div className="stats-grid top-gap">
          <article className="stat-card">
            <div className="stat-icon"><FolderKanban size={18} /></div>
            <div>
              <strong>Aktiver Mandant</strong>
              <p>{companyName || 'Arbeitsbereich'}</p>
            </div>
          </article>
          <article className="stat-card">
            <div className="stat-icon"><ShieldCheck size={18} /></div>
            <div>
              <strong>Modul / Reife</strong>
              <p>{moduleName} · {overallScore}%</p>
            </div>
          </article>
          <article className="stat-card">
            <div className="stat-icon"><CheckCircle2 size={18} /></div>
            <div>
              <strong>KRITIS / Evidenzen</strong>
              <p>{requirementScore}% · {evidenceCoverage}% Nachweisabdeckung</p>
            </div>
          </article>
          <article className="stat-card">
            <div className="stat-icon"><Clock3 size={18} /></div>
            <div>
              <strong>Exportspur</strong>
              <p>{exportCount} registrierte Pakete</p>
            </div>
          </article>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Sprintplan</p>
            <h3>Zuordnung der Phasen zu den Sprints</h3>
          </div>
          <div className="chip-row">
            <span className="chip success">{completedSprints} Sprints abgeschlossen</span>
            <span className="chip success">{completedPhases} Phasen umgesetzt</span>
            <span className="chip outline">{plannedSprints} Sprints geplant</span>
            <span className="chip outline">Produktstand 1.7</span>
          </div>
        </div>

        <div className="roadmap-grid top-gap">
          {sprintDefinitions.map((sprint) => (
            <article key={sprint.id} className="roadmap-card">
              <div className="question-title-row">
                <strong>{sprint.label}</strong>
                <span className={`chip ${statusClass(sprint.status)}`}>{statusLabel(sprint.status)}</span>
              </div>
              <p>{sprint.goal}</p>
              <div className="chip-row top-gap">
                {sprint.phases.map((phaseId) => (
                  <span key={phaseId} className="chip outline">Phase {phaseId}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Phasenübersicht</p>
            <h3>Liefergegenstände je Phase</h3>
          </div>
        </div>
        <div className="work-list phase-list">
          {programPhases.map((phase) => (
            <article key={phase.id} className="work-card roadmap-phase-card">
              <div className="work-card-head">
                <div>
                  <div className="question-title-row">
                    <strong>Phase {phase.id} · {phase.title}</strong>
                    <span className={`chip ${statusClass(phase.status)}`}>{statusLabel(phase.status)}</span>
                  </div>
                  <p className="muted small">{phase.sprint}</p>
                </div>
              </div>
              <p>{phase.focus}</p>
              <ul className="plain-list top-gap">
                {phase.deliverables.map((deliverable) => (
                  <li key={deliverable}>{deliverable}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
