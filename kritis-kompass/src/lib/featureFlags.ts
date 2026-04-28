// Phase-7-Stub fuer Feature-Flags. Bewusst statisch — kein Remote-Toggle,
// kein localStorage. Aenderungen erfordern einen Re-Deploy. Wenn die App
// in Phase 8+ ein echtes Toggle-System bekommt (Remote Config, GrowthBook,
// LaunchDarkly), wird diese Datei zur Schnittstelle.

export const FEATURES = {
  /** Phase-8+: Vertiefter Premium-Bereich mit Roadmap, Audit-Trail, Benchmark. */
  PREMIUM_DEEP_DIVE: false,
  /** Alternative Export-Formate ueber jsPDF hinaus. */
  EXPORT_DOCX: false,
  /** i18n-Erweiterung. App ist heute deutsch. */
  MULTI_LANGUAGE: false,
  /** Wenn true, kann die App E-Mails fuer Updates sammeln. Default off,
   *  damit das Datenschutz-Versprechen aus Phase 6 eingehalten bleibt. */
  LEAD_TRACKING_OPT_IN: false,
} as const;

export type FeatureFlag = keyof typeof FEATURES;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURES[flag];
}
