import type { RecommendationItem } from '../types';

const URGENCY_LABELS: Record<RecommendationItem['urgency'], string> = {
  hoch: 'Hoch',
  mittel: 'Mittel',
  niedrig: 'Niedrig',
};

const URGENCY_CLASSES: Record<RecommendationItem['urgency'], string> = {
  hoch: 'bg-bordeaux text-white',
  mittel: 'bg-bernstein text-schwarz',
  niedrig: 'bg-mauve text-white',
};

interface RecommendationCardProps {
  item: RecommendationItem;
}

export function RecommendationCard({ item }: RecommendationCardProps) {
  return (
    <article
      className="rounded-xl border border-mauve/25 bg-white p-3"
      title={item.rationale}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-mauve">
            {item.domainLabel}
          </p>
          <h4 className="mt-1 text-sm font-semibold leading-tight text-schwarz">{item.title}</h4>
        </div>
        <span
          className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${URGENCY_CLASSES[item.urgency]}`}
        >
          {URGENCY_LABELS[item.urgency]}
        </span>
      </div>
      <p className="mt-2 text-xs leading-snug text-schwarz/70">{item.action}</p>
    </article>
  );
}
