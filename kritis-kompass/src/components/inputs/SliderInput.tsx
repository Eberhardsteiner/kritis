import { useId } from 'react';
import type { SliderIndicator } from '../../types';

interface SliderInputProps {
  indicator: SliderIndicator;
  value: number;
  onChange: (value: number) => void;
}

export function SliderInput({ indicator, value, onChange }: SliderInputProps) {
  const id = useId();

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="block text-sm font-medium text-schwarz">
          {indicator.label}
        </label>
        <span className="text-base font-semibold text-bordeaux tabular-nums">{value} %</span>
      </div>
      <input
        id={id}
        type="range"
        min={indicator.min}
        max={indicator.max}
        step={indicator.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-mauve/30 accent-bordeaux"
        style={{ touchAction: 'manipulation' }}
      />
      <div className="mt-1 flex justify-between text-xs text-mauve">
        <span>{indicator.min} %</span>
        <span>{indicator.max} %</span>
      </div>
      {indicator.guidance ? (
        <p className="mt-2 text-xs text-mauve">{indicator.guidance}</p>
      ) : null}
    </div>
  );
}
