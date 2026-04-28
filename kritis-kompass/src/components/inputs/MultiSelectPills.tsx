import type { MultiselectIndicator } from '../../types';

interface MultiSelectPillsProps {
  indicator: MultiselectIndicator;
  value: string[];
  onChange: (value: string[]) => void;
}

export function MultiSelectPills({ indicator, value, onChange }: MultiSelectPillsProps) {
  function toggle(option: string) {
    if (value.includes(option)) {
      onChange(value.filter((entry) => entry !== option));
    } else {
      onChange([...value, option]);
    }
  }

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-schwarz">{indicator.label}</legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {indicator.options.map((option) => {
          const active = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(option.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                active
                  ? 'border-bordeaux bg-bordeaux text-white'
                  : 'border-mauve/40 bg-white text-schwarz hover:border-bordeaux'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {indicator.guidance ? (
        <p className="mt-2 text-xs text-mauve">{indicator.guidance}</p>
      ) : null}
    </fieldset>
  );
}
