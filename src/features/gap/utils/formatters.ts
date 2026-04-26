/**
 * formatters.ts · Zentrale Formatierungs-Helfer für Gap-Analyse-Anzeigen
 *
 * In C5.4.6 aus den dupliziert vorhandenen Definitionen in
 * `GapAnalysisDashboard.tsx` und `gapAnalysisDocx.ts` extrahiert.
 * Vor der Extraktion gab es zwei identische Implementierungen — bei
 * jeder zukünftigen Anpassung wäre Drift entstanden. Mit diesem Modul
 * gibt es eine Quelle der Wahrheit für PT-/Stunden-/Euro-Bandbreiten.
 *
 * Zusätzlich nutzt `ReportView.tsx` (C5.4.6 Bug 3) `formatPersonDaysRange`,
 * damit alle drei Anzeigeflächen — Dashboard, Report-View und DOCX —
 * identische Formatierung produzieren.
 */
import type { ConsultingRateSettings } from '../../../types';

/**
 * Mappt Currency-Codes auf die anzuzeigende Symbol-Schreibweise.
 * Vor C5.4.6 in beiden Konsumenten dupliziert.
 */
export const CURRENCY_LABELS: Record<ConsultingRateSettings['currency'], string> = {
  EUR: '€',
  CHF: 'CHF',
};

/**
 * Formatiert einen einzelnen PT-Wert als „X,Y PT" (de-DE-Locale).
 */
export function formatPersonDays(value: number): string {
  return `${value.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} PT`;
}

/**
 * Formatiert eine PT-Bandbreite als „min – max PT". Bei min ≈ max
 * (point-Estimate ohne Bandbreite, z. B. reine Heuristik) gibt nur eine
 * Zahl aus. Toleranz 0.01 PT (= 4.8 Minuten) — feiner als die
 * Anzeige-Auflösung von 0.1 PT.
 */
export function formatPersonDaysRange(min: number, max: number): string {
  if (Math.abs(min - max) < 0.01) {
    return formatPersonDays(min);
  }
  const minStr = min.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const maxStr = max.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  return `${minStr} – ${maxStr} PT`;
}

/**
 * Formatiert eine Stunden-Bandbreite als „min – max h". Verwendung in
 * der Tätigkeits-Tabelle (Brutto- und Restaufwand-Spalten).
 */
export function formatHoursRange(min: number, max: number): string {
  if (Math.abs(min - max) < 0.01) {
    return `${min.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} h`;
  }
  const minStr = min.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const maxStr = max.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  return `${minStr} – ${maxStr} h`;
}

/**
 * Formatiert einen einzelnen Euro-Betrag mit Currency-Suffix.
 * Bewusst ohne Nachkomma — Beratungs-Tagessätze sind üblicherweise
 * volle Euro-Beträge.
 */
export function formatEuro(value: number, currency: ConsultingRateSettings['currency']): string {
  const formatted = value.toLocaleString('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${formatted} ${CURRENCY_LABELS[currency]}`;
}

/**
 * Formatiert eine Euro-Bandbreite als „min – max €/CHF". Bei min ≈ max
 * (Toleranz < 1 Einheit) wird nur eine Zahl ausgegeben.
 */
export function formatEuroRange(
  min: number,
  max: number,
  currency: ConsultingRateSettings['currency'],
): string {
  if (Math.abs(min - max) < 1) {
    return formatEuro(min, currency);
  }
  return `${formatEuro(min, currency)} – ${formatEuro(max, currency)}`;
}
