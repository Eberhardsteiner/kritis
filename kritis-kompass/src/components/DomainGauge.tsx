import type { DomainScore } from '../types';
import { getMaturityColorTokens } from '../lib/maturityColor';

// Kurzlabels fuer den engen Cockpit-Platz. Volltext-Label bleibt im
// title-Attribut (Tooltip).
const DOMAIN_SHORT_LABELS: Record<string, string> = {
  governance: 'Governance',
  operations: 'Betrieb',
  people: 'Personal',
  physical: 'Standorte',
  cyber: 'IT & Cyber',
  supply: 'Lieferkette',
  finance: 'Finanzen',
  bcm: 'Krisenmgmt.',
};

interface DomainGaugeProps {
  domainScore: DomainScore;
}

export function DomainGauge({ domainScore }: DomainGaugeProps) {
  const tokens = getMaturityColorTokens(domainScore.score);
  const shortLabel = DOMAIN_SHORT_LABELS[domainScore.domainId] ?? domainScore.label;
  const tooltip = `${domainScore.label} · ${domainScore.answeredCount}/${domainScore.totalCount} beantwortet`;

  return (
    <div
      className="rounded-xl border border-mauve/20 bg-white p-3"
      title={tooltip}
      aria-label={tooltip}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium text-schwarz">{shortLabel}</span>
        <span className={`text-sm font-semibold tabular-nums ${tokens.textClass}`}>
          {domainScore.score}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mauve/15">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${tokens.bgClass}`}
          style={{ width: `${Math.max(domainScore.score, 0)}%` }}
        />
      </div>
    </div>
  );
}
