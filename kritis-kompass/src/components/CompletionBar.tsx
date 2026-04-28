interface CompletionBarProps {
  answered: number;
  total: number;
  /** Prozentwert 0-100; falls nicht uebergeben, wird er aus answered/total berechnet. */
  percent?: number;
  compact?: boolean;
}

export function CompletionBar({ answered, total, percent, compact = false }: CompletionBarProps) {
  const value = percent ?? (total > 0 ? Math.round((answered / total) * 100) : 0);
  return (
    <div>
      <div className={`flex items-baseline justify-between ${compact ? 'text-xs' : 'text-sm'}`}>
        <span className="font-medium text-schwarz">
          {answered} von {total} Fragen beantwortet
        </span>
        <span className="font-semibold text-bordeaux tabular-nums">{value}%</span>
      </div>
      <div
        className={`mt-1.5 overflow-hidden rounded-full bg-mauve/25 ${compact ? 'h-1.5' : 'h-2'}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div
          className="h-full rounded-full bg-bordeaux transition-[width] duration-200"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
