/**
 * ISO-Datum (YYYY-MM-DD) mit Tages-Offset ab heute. Standard fuer
 * Default-Due-Dates in Action- und Evidence-Drafts.
 */
export function getDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
