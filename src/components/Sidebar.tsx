import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Dices,
  FolderCog,
  FileSpreadsheet,
  GanttChartSquare,
  ListTodo,
  Network,
  Database,
  CloudCog,
  CheckCircle2,
  Siren,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import type { ViewKey } from '../types';
import { releaseStatus } from '../data/releaseStatus';

interface SidebarProps {
  activeView: ViewKey;
  onChange: (view: ViewKey) => void;
  /**
   * Wird beim Klick auf das Brand-Logo („KF Krisenfestigkeit Monitor") aufgerufen.
   * Die App-Shell setzt darin `showSplash` auf true, sodass der UVM-Splash
   * als „Zurück zur Startseite"-Anker erneut erscheint. Die `sessionStorage`-
   * Markierung bleibt bewusst erhalten — der User kann den Splash über
   * „Plattform öffnen" einfach wieder schließen, ohne dass beim nächsten
   * Reload erneut der Splash erscheint.
   */
  onLogoClick?: () => void;
}

/**
 * Reihenfolge der Sidebar-Einträge folgt dem operativen Workflow:
 * Übersicht → Grundanalyse → Maßnahmen → BIA → Governance → Plattform
 * → Betrieb → Go-Live → Module → KRITIS → Resilienzplan → Tabletop →
 * Reporting. „Steuerung & Rechte" ist als letzter Eintrag bewusst
 * abgesetzt: es ist ein Admin-Bereich, der vom inhaltlich-fachlichen
 * Workflow getrennt ist. Die `admin`-Markierung steuert den dezenten
 * CSS-Akzent (siehe `.nav-item-admin` in `src/styles.css`).
 */
const items: Array<{
  key: ViewKey;
  label: string;
  icon: typeof BarChart3;
  admin?: boolean;
}> = [
  { key: 'dashboard', label: 'Übersicht', icon: BarChart3 },
  { key: 'assessment', label: 'Grundanalyse', icon: ClipboardList },
  { key: 'measures', label: 'Maßnahmen & Bibliothek', icon: ListTodo },
  { key: 'resilience', label: 'BIA & Szenarien', icon: Siren },
  { key: 'governance', label: 'Governance & Struktur', icon: Network },
  { key: 'platform', label: 'Plattform & Sync', icon: Database },
  { key: 'operations', label: 'Betrieb & APIs', icon: CloudCog },
  { key: 'rollout', label: 'Go-Live & Übergabe', icon: CheckCircle2 },
  { key: 'modules', label: 'Branchenmodule', icon: FolderCog },
  { key: 'kritis', label: 'KRITIS-Readiness', icon: ShieldCheck },
  { key: 'resilience_plan', label: 'Resilienzplan', icon: BookOpen },
  { key: 'tabletop_exercise', label: 'Tabletop-Übungen', icon: Dices },
  { key: 'report', label: 'Reporting', icon: FileSpreadsheet },
  { key: 'control', label: 'Steuerung & Rechte', icon: SlidersHorizontal, admin: true },
];

export function Sidebar({ activeView, onChange, onLogoClick }: SidebarProps) {
  const brandContent = (
    <>
      <div className="brand-mark">KF</div>
      <div className="sidebar-brand-text">
        <p className="eyebrow">{releaseStatus.currentSprintLabel}</p>
        <h1>Krisenfestigkeit Monitor</h1>
      </div>
    </>
  );

  return (
    <aside className="sidebar">
      {onLogoClick ? (
        <button
          type="button"
          className="sidebar-brand sidebar-brand-button"
          onClick={onLogoClick}
          aria-label="Zurück zur Splash-Startseite"
        >
          {brandContent}
        </button>
      ) : (
        <div className="sidebar-brand">{brandContent}</div>
      )}

      <nav className="sidebar-nav">
        {items.map((item) => {
          const Icon = item.icon;
          const classNames = [
            'nav-item',
            activeView === item.key ? 'active' : '',
            item.admin ? 'nav-item-admin' : '',
          ].filter(Boolean).join(' ');
          return (
            <button
              key={item.key}
              type="button"
              className={classNames}
              onClick={() => onChange(item.key)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer card">
        <p className="eyebrow">Status {releaseStatus.appVersion}</p>
        <strong>{releaseStatus.currentHeadline}</strong>
        <p>
          {releaseStatus.currentSummary}
        </p>
        <button
          type="button"
          className={`sidebar-footer-link ${activeView === 'program' ? 'active' : ''}`}
          onClick={() => onChange('program')}
          aria-label="Programm & Sprints öffnen"
        >
          <GanttChartSquare size={14} />
          <span>Programm &amp; Sprints</span>
        </button>
      </div>
    </aside>
  );
}
