import { MapPin, Trash2 } from 'lucide-react';
import type { SiteItem, StructureCriticality } from '../types';

interface SiteCardProps {
  site: SiteItem;
  onUpdate: (siteId: string, patch: Partial<SiteItem>) => void;
  onDelete: (siteId: string) => void;
}

const criticalityOptions: Array<{ value: StructureCriticality; label: string }> = [
  { value: 'kritisch', label: 'Kritisch' },
  { value: 'hoch', label: 'Hoch' },
  { value: 'mittel', label: 'Mittel' },
  { value: 'niedrig', label: 'Niedrig' },
];

export function SiteCard({ site, onUpdate, onDelete }: SiteCardProps) {
  return (
    <article className="work-card">
      <div className="work-card-head">
        <div>
          <div className="question-title-row">
            <strong>{site.name || 'Neuer Standort'}</strong>
            <span className={`chip ${site.criticality === 'kritisch' ? 'danger' : site.criticality === 'hoch' ? 'warn' : 'outline'}`}>
              {site.criticality}
            </span>
          </div>
          <p className="muted small">{site.type || 'Standorttyp offen'}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => onDelete(site.id)}
          aria-label="Standort löschen"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="form-grid two-column">
        <label className="field-label">
          Standort
          <input
            type="text"
            value={site.name}
            placeholder="z. B. Werk Nord"
            onChange={(event) => onUpdate(site.id, { name: event.target.value })}
          />
        </label>
        <label className="field-label">
          Typ
          <input
            type="text"
            value={site.type}
            placeholder="z. B. Werk, Leitstelle, Lager"
            onChange={(event) => onUpdate(site.id, { type: event.target.value })}
          />
        </label>
        <label className="field-label">
          Ort
          <div className="input-with-icon">
            <MapPin size={16} />
            <input
              type="text"
              value={site.location}
              placeholder="z. B. Hamburg"
              onChange={(event) => onUpdate(site.id, { location: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label">
          Kritikalität
          <select
            value={site.criticality}
            onChange={(event) => onUpdate(site.id, { criticality: event.target.value as StructureCriticality })}
          >
            {criticalityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label wide">
          Primäre Leistung / Rolle des Standorts
          <input
            type="text"
            value={site.primaryService}
            placeholder="z. B. Primärproduktion, Leitstelle, Rechenzentrum"
            onChange={(event) => onUpdate(site.id, { primaryService: event.target.value })}
          />
        </label>
        <label className="field-label wide">
          Ausweichstandort / Fallback
          <input
            type="text"
            value={site.fallbackSite}
            placeholder="z. B. Werk Süd oder externer Dienstleister"
            onChange={(event) => onUpdate(site.id, { fallbackSite: event.target.value })}
          />
        </label>
        <label className="field-label wide">
          Notizen
          <textarea
            rows={2}
            value={site.notes}
            placeholder="z. B. Notstrom, lokale Besonderheiten, Zugangsbeschränkungen"
            onChange={(event) => onUpdate(site.id, { notes: event.target.value })}
          />
        </label>
      </div>
    </article>
  );
}
