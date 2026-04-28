import type { Indicator } from '../types';
import { SelectInput } from './inputs/SelectInput';
import { NumberInput } from './inputs/NumberInput';
import { BooleanToggle } from './inputs/BooleanToggle';
import { SliderInput } from './inputs/SliderInput';
import { MultiSelectPills } from './inputs/MultiSelectPills';

interface IndicatorRendererProps {
  indicator: Indicator;
  value: unknown;
  onChange: (value: unknown) => void;
  contextValues?: Record<string, unknown>;
}

function shouldHide(
  indicator: Indicator,
  contextValues: Record<string, unknown> | undefined,
): boolean {
  if (indicator.type !== 'select') {
    return false;
  }
  // dependsOn: nur anzeigen, wenn das Abhaengigkeits-Feld einen Wert hat.
  if (indicator.dependsOn) {
    const dep = contextValues?.[indicator.dependsOn];
    if (typeof dep !== 'string' || dep === '') {
      return true;
    }
  }
  // hideWhen: ausblenden, wenn ein Kontext-Wert exakt matched.
  if (indicator.hideWhen && contextValues) {
    for (const [key, hideValue] of Object.entries(indicator.hideWhen)) {
      if (contextValues[key] === hideValue) {
        return true;
      }
    }
  }
  return false;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBool(value: unknown): boolean {
  return value === true;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export function IndicatorRenderer({
  indicator,
  value,
  onChange,
  contextValues,
}: IndicatorRendererProps) {
  if (shouldHide(indicator, contextValues)) {
    return null;
  }

  switch (indicator.type) {
    case 'select':
      return (
        <SelectInput
          indicator={indicator}
          value={asString(value)}
          onChange={onChange}
          contextValues={contextValues}
        />
      );
    case 'number':
      return <NumberInput indicator={indicator} value={asNumber(value)} onChange={onChange} />;
    case 'boolean':
      return <BooleanToggle indicator={indicator} value={asBool(value)} onChange={onChange} />;
    case 'slider': {
      const current = asNumber(value);
      return (
        <SliderInput
          indicator={indicator}
          value={current ?? indicator.default}
          onChange={onChange}
        />
      );
    }
    case 'multiselect':
      return (
        <MultiSelectPills
          indicator={indicator}
          value={asStringArray(value)}
          onChange={onChange}
        />
      );
    default: {
      // Erschoepfender Switch-Check zur Kompilierzeit.
      const _exhaustive: never = indicator;
      return _exhaustive;
    }
  }
}
