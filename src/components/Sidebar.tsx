import {
  BarChart3,
  ClipboardList,
  FolderCog,
  FileSpreadsheet,
  ListTodo,
  Network,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import type { ViewKey } from '../types';

interface SidebarProps {
  activeView: ViewKey;
  onChange: (view: ViewKey) => void;
}

const items: Array<{
  key: ViewKey;
  label: string;
  icon: typeof BarChart3;
}> = [
  { key: 'dashboard', label: 'Übersicht', icon: BarChart3 },
  { key: 'assessment', label: 'Grundanalyse', icon: ClipboardList },
  { key: 'measures', label: 'Maßnahmen & Bibliothek', icon: ListTodo },
  { key: 'governance', label: 'Governance & Struktur', icon: Network },
  { key: 'control', label: 'Steuerung & Rechte', icon: SlidersHorizontal },
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
          <p className="eyebrow">Paket 4</p>
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
        <p className="eyebrow">Zielbild</p>
        <strong>Rollenmodell, Fristen-Cockpit und PDF-Reporting</strong>
        <p>
          Phase 4 verbindet Dokumentenbibliothek, Nutzerprofile, regulatorische Termine
          und exportfähige Berichte zu einem steuerbaren Arbeitsmodus.
        </p>
      </div>
    </aside>
  );
}
