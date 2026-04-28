import { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import type { SectorAdditionalRequirement, SectorModulePack } from '../types';

interface ModuleContextPanelProps {
  pack: SectorModulePack;
  showRequirements: boolean;
}

const SEVERITY_BORDER: Record<SectorAdditionalRequirement['severity'], string> = {
  high: 'border-l-bordeaux',
  medium: 'border-l-bernstein',
  low: 'border-l-mauve',
};

const SEVERITY_LABEL: Record<SectorAdditionalRequirement['severity'], string> = {
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
};

export function ModuleContextPanel({ pack, showRequirements }: ModuleContextPanelProps) {
  const hints = pack.kritisExtension?.hints ?? [];
  const requirements = pack.kritisExtension?.additionalRequirements ?? [];
  const [hintsOpen, setHintsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hintsOpen) return;
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setHintsOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setHintsOpen(false);
    }
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [hintsOpen]);

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="relative flex items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-bordeaux px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-bordeaux">
          {pack.name}
        </span>
        {hints.length > 0 ? (
          <>
            <button
              type="button"
              onClick={() => setHintsOpen((v) => !v)}
              aria-expanded={hintsOpen}
              aria-label="Branchen-Hinweise anzeigen"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-mauve/40 text-bordeaux transition hover:border-bordeaux"
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
            </button>
            {hintsOpen ? (
              <div
                role="dialog"
                className="absolute left-0 top-full z-20 mt-2 w-72 rounded-xl border border-mauve/30 bg-mauve/15 p-3 text-xs text-schwarz shadow-lg"
              >
                <p className="mb-2 font-semibold uppercase tracking-wider text-bordeaux">
                  Branchen-Hinweise
                </p>
                <ul className="space-y-1.5">
                  {hints.slice(0, 4).map((hint, index) => (
                    <li key={`${hint}-${index}`} className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-bordeaux"
                      />
                      <span>{hint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {showRequirements && requirements.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-bordeaux">
            KRITIS-Indikatoren dieses Sektors
          </p>
          <p className="mt-1 text-[11px] text-mauve">Informativ — fließen nicht in den Score ein.</p>
          <ul className="mt-3 space-y-2">
            {requirements.map((requirement) => (
              <li
                key={requirement.id}
                className={`rounded-xl border border-mauve/25 border-l-4 bg-white p-3 ${SEVERITY_BORDER[requirement.severity]}`}
                title={requirement.guidance ?? requirement.description}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-schwarz">{requirement.title}</h4>
                  <span className="flex-shrink-0 rounded-full bg-mauve/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-schwarz">
                    {SEVERITY_LABEL[requirement.severity]}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-snug text-schwarz/70">{requirement.description}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
