/**
 * DomainGaugeCockpit · 2×4-Tachometer-Raster für alle 8 Domänen.
 *
 * Reihenfolge folgt der Definitions-Reihenfolge in
 * `data/baseDomains.ts` (governance, operations, people, physical,
 * cyber, supply, finance, bcm) — nicht der dynamischen Score-
 * Reihenfolge. Das ist Absicht: die Reihenfolge ist Teil der
 * inhaltlichen Identität jeder Domäne, nicht ihrer aktuellen
 * Performance.
 *
 * Pro Domäne wird ein {@link DomainGauge} gerendert. Der Score wird
 * über `domainScores.find(...)` aus dem Snapshot gezogen — Domänen
 * ohne aktuellen Score-Eintrag fallen auf 0% zurück (das ist auch
 * der Effective-Default in `scoreSnapshot.domainScores`-Aufbau).
 *
 * Layout: Display-Grid mit `repeat(4, 1fr)` auf Desktop, kollabiert
 * über Media Queries auf 2 bzw. 1 Spalte (siehe `.gauge-cockpit-grid`
 * in `src/styles.css`).
 */
import { baseDomains } from '../data/baseDomains';
import type { DomainScore } from '../types';
import { DomainGauge } from './DomainGauge';

interface DomainGaugeCockpitProps {
  domainScores: DomainScore[];
}

/**
 * Kurz-Label-Mapping für die enge Tacho-Beschriftung (max. ~14 Zeichen).
 * Vollständige Bezeichnung steht via `tooltip`-Prop weiterhin im
 * Hover-Layer, sodass keine Information verloren geht.
 */
const SHORT_LABEL_BY_DOMAIN_ID: Record<string, string> = {
  governance: 'Governance',
  operations: 'Betrieb',
  people: 'Personal',
  physical: 'Standorte',
  cyber: 'IT & Cyber',
  supply: 'Lieferkette',
  finance: 'Finanzen',
  bcm: 'Krisenmgmt.',
};

export function DomainGaugeCockpit({ domainScores }: DomainGaugeCockpitProps) {
  const scoreById = new Map(domainScores.map((entry) => [entry.domainId, entry]));

  return (
    <div className="gauge-cockpit-grid" role="list" aria-label="Reifegrad je Domäne">
      {baseDomains.map((domain) => {
        const score = scoreById.get(domain.id)?.score ?? 0;
        const shortLabel = SHORT_LABEL_BY_DOMAIN_ID[domain.id] ?? domain.label;
        const tooltip = `${domain.label} — ${domain.description}`;
        return (
          <div key={domain.id} role="listitem" className="gauge-cockpit-cell">
            <DomainGauge
              score={score}
              shortLabel={shortLabel}
              tooltip={tooltip}
            />
          </div>
        );
      })}
    </div>
  );
}
