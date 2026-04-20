/**
 * Deterministische ID-Erzeugung mit Prefix (z. B. "act-..." fuer Actions,
 * "evi-..." fuer Evidenzen). Nutzt `crypto.randomUUID()` wo verfuegbar,
 * faellt ansonsten auf Timestamp + Random-Suffix zurueck.
 *
 * Cross-Feature-Utility (C2 Feature-Slicing): wird von App-Shell,
 * features/measures und spaeteren Features (evidence, governance, ...)
 * gleichermassen benoetigt. Liegt in src/shared/, damit keine
 * Feature-zu-Feature-Importe entstehen.
 */
export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
