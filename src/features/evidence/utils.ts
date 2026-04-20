/**
 * Liest eine Datei als Base64-DataURL. Wird fuer den lokalen Attachment-
 * Pfad in handleAttachEvidenceFile benoetigt (wenn kein Server verfuegbar
 * ist und die Datei unter MAX_LOCAL_ATTACHMENT_BYTES bleibt).
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}
