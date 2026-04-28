// Gemeinsamer Farb-Selektor fuer Maturity-Badge und Domain-Gauges.
// Skala wie in src/data/kritisBase.ts -> maturityBands:
//   0-39  -> Fragil    (Bordeaux)
//   40-59 -> Reaktiv   (Bernstein)
//   60-79 -> Stabil    (Mauve)
//   80+   -> Resilient (Gruen)

export interface MaturityColorTokens {
  /** Tailwind-Klasse fuer Solid-Hintergrund. */
  bgClass: string;
  /** Tailwind-Klasse fuer Text auf dem Solid-Hintergrund. */
  fgClass: string;
  /** Tailwind-Klasse fuer Text in Outline-Variante. */
  textClass: string;
}

export function getMaturityColorTokens(score: number): MaturityColorTokens {
  if (score >= 80) {
    return { bgClass: 'bg-gruen', fgClass: 'text-white', textClass: 'text-gruen' };
  }
  if (score >= 60) {
    return { bgClass: 'bg-mauve', fgClass: 'text-white', textClass: 'text-mauve' };
  }
  if (score >= 40) {
    return { bgClass: 'bg-bernstein', fgClass: 'text-schwarz', textClass: 'text-bernstein' };
  }
  return { bgClass: 'bg-bordeaux', fgClass: 'text-white', textClass: 'text-bordeaux' };
}
