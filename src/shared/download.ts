/**
 * Browser-Utility fuer das Ausloesen eines Blob-Downloads.
 *
 * Extrahiert in C2.11a aus src/App.tsx (dortige `triggerFileDownload`-
 * Funktion, byte-identisch). Konsumenten ab C2.11a:
 *  - features/resiliencePlan/hooks/useResiliencePlanHandlers
 *    (handleExportResiliencePlanJson/Docx/Pdf)
 *  - features/tabletopExercise/hooks/useTabletopExerciseHandlers
 *    (handleExportTabletopResultJson)
 *  - features/gap/hooks/useGapHandlers (handleExportGapAnalysisDocx,
 *    vorher eine Inline-Kopie desselben acht-Zeilen-Blocks)
 *
 * Reine DOM-API: URL.createObjectURL, temporaeres <a>-Element mit
 * download-Attribut, click(), Cleanup mit removeChild + revokeObjectURL.
 */
export function triggerFileDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
