import { Clock3, Trash2, UserRound } from 'lucide-react';
import type { AssetItem, SiteItem, StructureCriticality } from '../../../types';

interface AssetCardProps {
  asset: AssetItem;
  sites: SiteItem[];
  onUpdate: (assetId: string, patch: Partial<AssetItem>) => void;
  onDelete: (assetId: string) => void;
}

const criticalityOptions: Array<{ value: StructureCriticality; label: string }> = [
  { value: 'kritisch', label: 'Kritisch' },
  { value: 'hoch', label: 'Hoch' },
  { value: 'mittel', label: 'Mittel' },
  { value: 'niedrig', label: 'Niedrig' },
];

export function AssetCard({ asset, sites, onUpdate, onDelete }: AssetCardProps) {
  return (
    <article className="work-card">
      <div className="work-card-head">
        <div>
          <div className="question-title-row">
            <strong>{asset.name || 'Neues Asset / kritischer Service'}</strong>
            <span className={`chip ${asset.criticality === 'kritisch' ? 'danger' : asset.criticality === 'hoch' ? 'warn' : 'outline'}`}>
              {asset.criticality}
            </span>
          </div>
          <p className="muted small">{asset.type || 'Kategorie offen'}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => onDelete(asset.id)}
          aria-label="Asset löschen"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="form-grid two-column">
        <label className="field-label">
          Name
          <input
            type="text"
            value={asset.name}
            placeholder="z. B. Leitwarte, ERP, OP-Bereich"
            onChange={(event) => onUpdate(asset.id, { name: event.target.value })}
          />
        </label>
        <label className="field-label">
          Typ
          <input
            type="text"
            value={asset.type}
            placeholder="z. B. IT-System, Anlage, Service"
            onChange={(event) => onUpdate(asset.id, { type: event.target.value })}
          />
        </label>
        <label className="field-label">
          Zugeordneter Standort
          <select
            value={asset.siteId}
            onChange={(event) => onUpdate(asset.id, { siteId: event.target.value })}
          >
            <option value="">Nicht zugeordnet</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name || site.location || site.id}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Kritikalität
          <select
            value={asset.criticality}
            onChange={(event) => onUpdate(asset.id, { criticality: event.target.value as StructureCriticality })}
          >
            {criticalityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Owner
          <div className="input-with-icon">
            <UserRound size={16} />
            <input
              type="text"
              value={asset.owner}
              placeholder="z. B. IT-Leitung"
              onChange={(event) => onUpdate(asset.id, { owner: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label">
          RTO / Wiederanlauf in Stunden
          <div className="input-with-icon">
            <Clock3 size={16} />
            <input
              type="text"
              value={asset.rtoHours}
              placeholder="z. B. 4"
              onChange={(event) => onUpdate(asset.id, { rtoHours: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label wide">
          Fallback / Ausweichoption
          <input
            type="text"
            value={asset.fallback}
            placeholder="z. B. Zweitstandort, manueller Prozess, Cloud-DR"
            onChange={(event) => onUpdate(asset.id, { fallback: event.target.value })}
          />
        </label>
        <label className="field-label wide">
          Abhängigkeiten
          <textarea
            rows={2}
            value={asset.dependencies}
            placeholder="z. B. Energieversorgung, Dienstleister, Lieferant, Netzwerk"
            onChange={(event) => onUpdate(asset.id, { dependencies: event.target.value })}
          />
        </label>
        <label className="field-label wide">
          Notizen
          <textarea
            rows={2}
            value={asset.notes}
            placeholder="z. B. SPOF, Wartungsfenster, Teststatus"
            onChange={(event) => onUpdate(asset.id, { notes: event.target.value })}
          />
        </label>
      </div>
    </article>
  );
}
