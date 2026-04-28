import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface PageNavProps {
  back?: string;
  next?: string;
  nextLabel?: string;
  backLabel?: string;
}

export function PageNav({
  back,
  next,
  nextLabel = 'Weiter',
  backLabel = 'Zurück',
}: PageNavProps) {
  const navigate = useNavigate();

  return (
    <div className="mt-12 flex items-center justify-between">
      <button
        type="button"
        disabled={!back}
        onClick={() => back && navigate(back)}
        className="inline-flex items-center gap-2 rounded-lg border border-mauve/40 px-4 py-2 text-sm font-medium text-schwarz transition hover:border-bordeaux hover:text-bordeaux disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </button>
      <button
        type="button"
        disabled={!next}
        onClick={() => next && navigate(next)}
        className="inline-flex items-center gap-2 rounded-lg bg-bordeaux px-4 py-2 text-sm font-medium text-white transition hover:bg-bordeaux/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {nextLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
