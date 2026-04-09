import { Cloud, CloudOff, Download, RefreshCw, Save } from 'lucide-react';
import type { AuthSession, CompanyProfile } from '../types';

interface UserOption {
  id: string;
  label: string;
}

interface ModuleOption {
  id: string;
  name: string;
}

export interface ProjectTopbarProps {
  activeUserId: string;
  userOptions: UserOption[];
  authSession: AuthSession | null;
  serverStatusConnected: boolean;
  serverStatusLabel: string;
  activeAccessProfileLabel: string;
  tenantChipLabel: string;
  accountChipLabel: string;
  canSync: boolean;
  canExportJson: boolean;
  companyProfile: CompanyProfile;
  selectedModuleId: string;
  moduleOptions: ModuleOption[];
  onSelectActiveUser: (userId: string) => void;
  onSyncNow: () => void;
  onExportJson: () => void;
  onProfileFieldChange: (field: keyof CompanyProfile, value: string) => void;
  onSelectModule: (moduleId: string) => void;
}

export function ProjectTopbar({
  activeUserId,
  userOptions,
  authSession,
  serverStatusConnected,
  serverStatusLabel,
  activeAccessProfileLabel,
  tenantChipLabel,
  accountChipLabel,
  canSync,
  canExportJson,
  companyProfile,
  selectedModuleId,
  moduleOptions,
  onSelectActiveUser,
  onSyncNow,
  onExportJson,
  onProfileFieldChange,
  onSelectModule,
}: ProjectTopbarProps) {
  return (
    <header className="topbar card">
      <div className="topbar-head">
        <div>
          <p className="eyebrow">Projektsteuerung</p>
          <h2>Unternehmensprofil und aktives Branchenmodul</h2>
        </div>
        <div className="topbar-actions">
          <label className="field-label topbar-selector">
            Arbeitsprofil
            <select
              value={activeUserId}
              onChange={(event) => onSelectActiveUser(event.target.value)}
              disabled={Boolean(authSession)}
            >
              {userOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.label}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-note">
            <Save size={16} />
            <span>Automatisch lokal gespeichert</span>
          </div>
          <div className="inline-note">
            {serverStatusConnected ? <Cloud size={16} /> : <CloudOff size={16} />}
            <span>{serverStatusLabel}</span>
          </div>
          <span className="chip outline">{activeAccessProfileLabel}</span>
          {tenantChipLabel ? <span className="chip outline">{tenantChipLabel}</span> : null}
          {accountChipLabel ? <span className="chip outline">{accountChipLabel}</span> : null}
          <button type="button" className="button secondary" onClick={onSyncNow} disabled={!canSync}>
            <RefreshCw size={16} />
            Jetzt synchronisieren
          </button>
          <button type="button" className="button secondary" onClick={onExportJson} disabled={!canExportJson}>
            <Download size={16} />
            JSON exportieren
          </button>
        </div>
      </div>

      <div className="profile-grid">
        <label className="field-label">
          Unternehmen
          <input
            type="text"
            placeholder="z. B. Musterwerke GmbH"
            value={companyProfile.companyName}
            onChange={(event) => onProfileFieldChange('companyName', event.target.value)}
          />
        </label>
        <label className="field-label">
          Branche / Segment
          <input
            type="text"
            placeholder="z. B. Krankenhaus, Produktion, Energie"
            value={companyProfile.industryLabel}
            onChange={(event) => onProfileFieldChange('industryLabel', event.target.value)}
          />
        </label>
        <label className="field-label">
          Aktives Modul
          <select
            value={selectedModuleId}
            onChange={(event) => onSelectModule(event.target.value)}
          >
            {moduleOptions.map((module) => (
              <option key={module.id} value={module.id}>
                {module.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Mitarbeitende
          <input
            type="text"
            placeholder="z. B. 850"
            value={companyProfile.employees}
            onChange={(event) => onProfileFieldChange('employees', event.target.value)}
          />
        </label>
        <label className="field-label">
          Standorte / Werke
          <input
            type="text"
            placeholder="z. B. 3 Standorte, 1 Rechenzentrum"
            value={companyProfile.locations}
            onChange={(event) => onProfileFieldChange('locations', event.target.value)}
          />
        </label>
        <label className="field-label wide">
          Kritische Dienstleistung / Versorgung
          <input
            type="text"
            placeholder="z. B. Notfallversorgung, Stromverteilung, Trinkwasserversorgung"
            value={companyProfile.criticalService}
            onChange={(event) => onProfileFieldChange('criticalService', event.target.value)}
          />
        </label>
        <label className="field-label">
          Versorgte Personen
          <input
            type="text"
            placeholder="z. B. 500000"
            value={companyProfile.personsServed}
            onChange={(event) => onProfileFieldChange('personsServed', event.target.value)}
          />
        </label>
      </div>
    </header>
  );
}
