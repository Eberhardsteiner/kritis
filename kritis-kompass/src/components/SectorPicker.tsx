import { Check } from 'lucide-react';
import { MODULE_PACK_CATALOG } from '../data/modulePackCatalog';
import { SectorIcon } from './SectorIcons';

interface SectorPickerProps {
  onSelect: (id: string) => void;
  onSkip?: () => void;
  selectedId?: string;
  suggestedId?: string;
}

export function SectorPicker({ onSelect, onSkip, selectedId, suggestedId }: SectorPickerProps) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {MODULE_PACK_CATALOG.map((entry) => {
          const isSelected = entry.id === selectedId;
          const isSuggested = entry.id === suggestedId && !isSelected;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect(entry.id)}
              aria-pressed={isSelected}
              className={`group relative flex h-full flex-col items-start rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-bordeaux ${
                isSelected
                  ? 'border-2 border-bordeaux bg-bordeaux/5'
                  : 'border-mauve/25'
              }`}
            >
              {isSelected ? (
                <span
                  className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-bordeaux text-white"
                  aria-hidden
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
              ) : isSuggested ? (
                <span className="absolute right-3 top-3 rounded-full bg-mauve px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Vorgeschlagen
                </span>
              ) : null}

              <span className="text-bordeaux">
                <SectorIcon iconKey={entry.icon} />
              </span>
              <h3 className="mt-3 text-base font-medium text-schwarz">{entry.label}</h3>
              <p className="mt-1 text-[13px] leading-snug text-mauve">{entry.short}</p>
            </button>
          );
        })}
      </div>

      {onSkip ? (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-medium text-bordeaux underline-offset-4 hover:underline"
          >
            Ich überspringe das Modul und antworte nur auf die Basisfragen
          </button>
        </div>
      ) : null}
    </div>
  );
}
