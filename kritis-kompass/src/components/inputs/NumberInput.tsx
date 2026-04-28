import { useEffect, useId, useState } from 'react';
import type { NumberIndicator } from '../../types';

interface NumberInputProps {
  indicator: NumberIndicator;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

function formatGrouped(n: number): string {
  return n.toLocaleString('de-DE');
}

function parseDigits(input: string): number | undefined {
  const cleaned = input.replace(/[^\d]/g, '');
  if (!cleaned) {
    return undefined;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function NumberInput({ indicator, value, onChange }: NumberInputProps) {
  const id = useId();
  const [draft, setDraft] = useState<string>(value !== undefined ? String(value) : '');
  const [focused, setFocused] = useState(false);

  // Wert von außen synchronisieren, wenn nicht gerade getippt wird.
  useEffect(() => {
    if (!focused) {
      setDraft(value !== undefined ? String(value) : '');
    }
  }, [value, focused]);

  const display = focused
    ? draft
    : value !== undefined
      ? formatGrouped(value)
      : '';

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-schwarz">
        {indicator.label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        onFocus={() => {
          setFocused(true);
          setDraft(value !== undefined ? String(value) : '');
        }}
        onChange={(event) => {
          const next = parseDigits(event.target.value);
          setDraft(event.target.value.replace(/[^\d]/g, ''));
          onChange(next);
        }}
        onBlur={() => setFocused(false)}
        className="mt-2 w-full rounded-lg border border-mauve/40 bg-white px-4 py-3 text-sm text-schwarz shadow-sm transition focus:border-bordeaux focus:outline-none focus:ring-2 focus:ring-bordeaux/30"
        placeholder="0"
      />
      {indicator.guidance ? (
        <p className="mt-2 text-xs text-mauve">{indicator.guidance}</p>
      ) : null}
    </div>
  );
}
