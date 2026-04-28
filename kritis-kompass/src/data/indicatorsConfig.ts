import rawConfig from './kritisIndicators.json';
import type { IndicatorsConfig } from '../types';

// Doppel-Cast noetig: TypeScript leitet aus JSON-Imports breite
// Literal-Typen ab, die unsere diskriminierte Indicator-Union nicht
// passgenau treffen. Die JSON-Struktur ist im Repo kontrolliert; bei
// Erweiterung der Indikator-Schemata Tests in applicability.test.ts
// nachziehen.
export const indicatorsConfig = rawConfig as unknown as IndicatorsConfig;
