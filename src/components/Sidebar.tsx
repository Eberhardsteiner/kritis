import {
  BarChart3,
  ClipboardList,
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
}

const items: Array<{
  key: ViewKey;
  label: string;
  icon: typeof BarChart3;
}> = [
  { key: 'program', label: 'Programm & Sprints', icon: GanttChartSquare },
  { key: 'dashboard', label: 'Übersicht', icon: BarChart3 },
  { key: 'assessment', label: 'Grundanalyse', icon: ClipboardList },
  { key: 'measures', label: 'Maßnahmen & Bibliothek', icon: ListTodo },
  { key: 'resilience', label: 'BIA & Szenarien', icon: Siren },
  { key: 'governance', label: 'Governance & Struktur', icon: Network },
  { key: 'control', label: 'Steuerung & Rechte', icon: SlidersHorizontal },
  { key: 'platform', label: 'Plattform & Sync', icon: Database },
  { key: 'operations', label: 'Betrieb & APIs', icon: CloudCog },
  { key: 'rollout', label: 'Go-Live & Übergabe', icon: CheckCircle2 },
  { key: 'modules', label: 'Branchenmodule', icon: FolderCog },
  { key: 'kritis', label: 'KRITIS-Readiness', icon: ShieldCheck },
  { key: 'report', label: 'Reporting', icon: FileSpreadsheet },
];

export function Sidebar({ activeView, onChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">KF</div>
        <div>
          <p className="eyebrow">{releaseStatus.currentSprintLabel}</p>
          <h1>Krisenfestigkeit Monitor</h1>
        </div>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              className={`nav-item ${activeView === item.key ? 'active' : ''}`}
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
      </div>
    </aside>
  );
}
