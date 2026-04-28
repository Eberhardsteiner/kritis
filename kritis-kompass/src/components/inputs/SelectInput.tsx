import { useId } from 'react';
import type { IndicatorOption, SelectIndicator } from '../../types';

interface SelectInputProps {
  indicator: SelectIndicator;
  value: string;
  onChange: (value: string) => void;
  contextValues?: Record<string, unknown>;
}

function resolveOptions(
  indicator: SelectIndicator,
  contextValues?: Record<string, unknown>,
): IndicatorOption[] {
  if (indicator.optionsBySector && indicator.dependsOn && contextValues) {
    const dep = contextValues[indicator.dependsOn];
    if (typeof dep === 'string') {
      const list = indicator.optionsBySector[dep];
      if (list) {
        return list.map((entry) => ({ value: entry, label: entry }));
      }
    }
    return [];
  }
  return indicator.options ?? [];
}

export function SelectInput({ indicator, value, onChange, contextValues }: SelectInputProps) {
  const id = useId();
  const options = resolveOptions(indicator, contextValues);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-schwarz">
        {indicator.label}
        {indicator.required ? <span className="ml-1 text-bordeaux">*</span> : null}
      </label>
      <div className="relative mt-2">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-lg border border-mauve/40 bg-white px-4 py-3 pr-10 text-sm text-schwarz shadow-sm transition focus:border-bordeaux focus:outline-none focus:ring-2 focus:ring-bordeaux/30"
        >
          <option value="">Bitte auswählen …</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-bordeaux"
        >
          ▾
        </span>
      </div>
      {indicator.guidance ? (
        <p className="mt-2 text-xs text-mauve">{indicator.guidance}</p>
      ) : null}
    </div>
  );
}
