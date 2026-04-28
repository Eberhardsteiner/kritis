import { useId } from 'react';
import type { BooleanIndicator } from '../../types';

interface BooleanToggleProps {
  indicator: BooleanIndicator;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function BooleanToggle({ indicator, value, onChange }: BooleanToggleProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <label htmlFor={id} className="block text-sm font-medium text-schwarz">
          {indicator.label}
        </label>
        {indicator.guidance ? (
          <p className="mt-1 text-xs text-mauve">{indicator.guidance}</p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition ${
          value ? 'bg-bordeaux' : 'bg-mauve/40'
        }`}
      >
        <span className="sr-only">{value ? 'Ja' : 'Nein'}</span>
        <span
          aria-hidden
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
