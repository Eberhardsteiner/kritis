import { Check } from 'lucide-react';

interface DomainTabProps {
  label: string;
  shortLabel: string;
  answered: number;
  total: number;
  active: boolean;
  onClick: () => void;
}

export function DomainTab({ label, shortLabel, answered, total, active, onClick }: DomainTabProps) {
  const isComplete = total > 0 && answered === total;

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-current={active ? 'step' : undefined}
      className={`group flex flex-shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition ${
        active
          ? 'border-bordeaux text-bordeaux'
          : 'border-transparent text-schwarz/70 hover:border-mauve/40 hover:text-schwarz'
      }`}
    >
      <span className={active ? 'font-semibold' : 'font-medium'}>{shortLabel}</span>
      <span
        className={`text-[11px] tabular-nums ${
          active ? 'text-bordeaux/70' : 'text-mauve'
        }`}
      >
        {answered}/{total}
      </span>
      {isComplete ? (
        <Check className="h-3.5 w-3.5 text-bordeaux" aria-hidden aria-label="vollständig" />
      ) : null}
    </button>
  );
}
