import type {
  EvidenceAttachment,
  EvidenceClassification,
  EvidenceItem,
  EvidenceType,
} from '../../types';
import { createId } from '../../shared/ids';

/**
 * Normalisiert einen ggf. veralteten Classification-String auf einen
 * gueltigen EvidenceClassification-Wert. Default: 'intern'.
 */
export function normalizeEvidenceClassification(
  value: string | undefined,
): EvidenceClassification {
  if (
    value === 'öffentlich'
    || value === 'intern'
    || value === 'vertraulich'
    || value === 'streng_vertraulich'
  ) {
    return value;
  }
  return 'intern';
}

/**
 * Normalisiert ein lokales Browser-Attachment (DataURL). Gibt undefined
 * zurueck, wenn ein Pflichtfeld fehlt oder falschen Typ hat.
 */
export function normalizeAttachment(value: unknown): EvidenceAttachment | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Partial<EvidenceAttachment>;
  if (
    typeof candidate.fileName !== 'string'
    || typeof candidate.mimeType !== 'string'
    || typeof candidate.sizeKb !== 'number'
    || typeof candidate.dataUrl !== 'string'
  ) {
    return undefined;
  }

  return {
    fileName: candidate.fileName,
    mimeType: candidate.mimeType,
    sizeKb: candidate.sizeKb,
    dataUrl: candidate.dataUrl,
  };
}

/**
 * Normalisiert einen Server-Attachment-Deskriptor (vom Backend gelieferte
 * Version mit Historie + Checksumme). Optionale Felder duerfen fehlen.
 */
export function normalizeServerAttachment(
  value: unknown,
): EvidenceItem['serverAttachment'] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Partial<NonNullable<EvidenceItem['serverAttachment']>>;
  if (
    typeof candidate.id !== 'string'
    || typeof candidate.fileName !== 'string'
    || typeof candidate.storedFileName !== 'string'
    || typeof candidate.mimeType !== 'string'
    || typeof candidate.sizeKb !== 'number'
    || typeof candidate.url !== 'string'
    || typeof candidate.uploadedAt !== 'string'
    || typeof candidate.uploadedBy !== 'string'
  ) {
    return undefined;
  }

  return {
    id: candidate.id,
    fileName: candidate.fileName,
    storedFileName: candidate.storedFileName,
    mimeType: candidate.mimeType,
    sizeKb: candidate.sizeKb,
    url: candidate.url,
    uploadedAt: candidate.uploadedAt,
    uploadedBy: candidate.uploadedBy,
    versionId: typeof candidate.versionId === 'string' ? candidate.versionId : undefined,
    checksumSha256:
      typeof candidate.checksumSha256 === 'string' ? candidate.checksumSha256 : undefined,
    historyCount:
      typeof candidate.historyCount === 'number' && Number.isFinite(candidate.historyCount)
        ? candidate.historyCount
        : undefined,
  };
}

/**
 * Normalisiert einen aus localStorage/Server geladenen Evidence-Array.
 */
export function normalizeLoadedEvidence(
  items: unknown,
  fallbackModuleId: string,
): EvidenceItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<EvidenceItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('evi'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      type: item.type ?? 'other',
      owner: item.owner ?? '',
      reviewer: item.reviewer ?? '',
      version: item.version ?? '1.0',
      classification: normalizeEvidenceClassification(item.classification),
      folder: item.folder ?? 'Allgemein',
      tags: Array.isArray(item.tags)
        ? item.tags.filter(
            (value): value is string => typeof value === 'string' && Boolean(value.trim()),
          )
        : [],
      externalId: item.externalId ?? '',
      link: item.link ?? '',
      status: item.status ?? 'missing',
      reviewDate: item.reviewDate ?? '',
      validUntil: item.validUntil ?? '',
      reviewCycleDays:
        typeof item.reviewCycleDays === 'number' && Number.isFinite(item.reviewCycleDays)
          ? item.reviewCycleDays
          : 180,
      sourceType: item.sourceType ?? 'manual',
      sourceId: item.sourceId,
      sourceLabel: item.sourceLabel ?? 'Manuell',
      relatedQuestionIds: item.relatedQuestionIds ?? [],
      relatedRequirementIds: item.relatedRequirementIds ?? [],
      notes: item.notes ?? '',
      attachment: normalizeAttachment(item.attachment),
      serverAttachment: normalizeServerAttachment(item.serverAttachment),
      createdAt: item.createdAt ?? new Date().toISOString(),
    }));
}

/**
 * Heuristische Ableitung des EvidenceType aus einem Freitext (Fragen-
 * Hinweis, Requirement-Titel). Wird in den Generate-Handlern fuer
 * sinnvolle Defaults verwendet.
 */
export function guessEvidenceType(text: string): EvidenceType {
  const normalized = text.toLowerCase();
  if (normalized.includes('backup') || normalized.includes('restore')) {
    return 'backup';
  }
  if (
    normalized.includes('übung')
    || normalized.includes('test')
    || normalized.includes('protokoll')
  ) {
    return 'test';
  }
  if (normalized.includes('schulung') || normalized.includes('training')) {
    return 'training';
  }
  if (normalized.includes('vertrag') || normalized.includes('sla')) {
    return 'contract';
  }
  if (normalized.includes('richtlinie') || normalized.includes('policy')) {
    return 'policy';
  }
  if (normalized.includes('bericht')) {
    return 'report';
  }
  if (normalized.includes('plan') || normalized.includes('konzept')) {
    return 'plan';
  }
  return 'other';
}
