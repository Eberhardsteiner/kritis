import { useState } from 'react';
import {
  CalendarDays,
  Download,
  FolderOpen,
  History,
  Link2,
  Paperclip,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import type {
  DocumentVersionEntry,
  EvidenceClassification,
  EvidenceItem,
  EvidenceStatus,
  EvidenceType,
} from '../types';

interface EvidenceCardProps {
  evidence: EvidenceItem;
  folderSuggestions: string[];
  onDownloadServerFile?: (url: string, fileName: string) => void;
  versionEntries?: DocumentVersionEntry[];
  serverVersioningEnabled?: boolean;
  onUpdate: (evidenceId: string, patch: Partial<EvidenceItem>) => void;
  onDelete: (evidenceId: string) => void;
  onAttachFile: (evidenceId: string, file: File | null) => void;
  onRemoveAttachment: (evidenceId: string) => void;
  onLoadVersions?: (evidenceId: string) => void;
  onRestoreVersion?: (evidenceId: string, versionId: string) => void;
}

const statusOptions: Array<{ value: EvidenceStatus; label: string }> = [
  { value: 'missing', label: 'Fehlt' },
  { value: 'draft', label: 'Entwurf' },
  { value: 'review', label: 'In Review' },
  { value: 'approved', label: 'Freigegeben' },
];

const typeOptions: Array<{ value: EvidenceType; label: string }> = [
  { value: 'policy', label: 'Richtlinie' },
  { value: 'plan', label: 'Plan' },
  { value: 'report', label: 'Bericht' },
  { value: 'test', label: 'Test/Übung' },
  { value: 'training', label: 'Schulung' },
  { value: 'contract', label: 'Vertrag/SLA' },
  { value: 'backup', label: 'Backup/Restore' },
  { value: 'other', label: 'Sonstiges' },
];

const classificationOptions: Array<{ value: EvidenceClassification; label: string }> = [
  { value: 'öffentlich', label: 'Öffentlich' },
  { value: 'intern', label: 'Intern' },
  { value: 'vertraulich', label: 'Vertraulich' },
  { value: 'streng_vertraulich', label: 'Streng vertraulich' },
];


function checksumPreview(value?: string): string {
  return value ? `${value.slice(0, 12)}…` : '–';
}

function formatDateTime(value: string): string {
  if (!value) {
    return '–';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('de-DE');
}

export function EvidenceCard({
  evidence,
  folderSuggestions,
  onDownloadServerFile,
  versionEntries,
  serverVersioningEnabled = false,
  onUpdate,
  onDelete,
  onAttachFile,
  onRemoveAttachment,
  onLoadVersions,
  onRestoreVersion,
}: EvidenceCardProps) {
  const [showVersions, setShowVersions] = useState(false);
  const folderListId = `evidence-folder-list-${evidence.id}`;
  const statusTone =
    evidence.status === 'approved'
      ? 'success'
      : evidence.status === 'review'
        ? 'warn'
        : evidence.status === 'draft'
          ? 'default'
          : 'danger';

  const tagValue = evidence.tags.join(', ');
  const hasVersionHistory = Boolean((evidence.serverAttachment?.historyCount ?? 0) || versionEntries?.length);

  return (
    <article className="work-card">
      <div className="work-card-head">
        <div>
          <div className="question-title-row">
            <strong>{evidence.title || 'Neuer Nachweis'}</strong>
            <span className={`chip ${statusTone}`}>{evidence.status}</span>
          </div>
          <p className="muted small">Quelle: {evidence.sourceLabel}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => onDelete(evidence.id)}
          aria-label="Nachweis löschen"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="form-grid two-column">
        <label className="field-label wide">
          Titel
          <input
            type="text"
            value={evidence.title}
            onChange={(event) => onUpdate(evidence.id, { title: event.target.value })}
          />
        </label>
        <label className="field-label">
          Typ
          <select
            value={evidence.type}
            onChange={(event) => onUpdate(evidence.id, { type: event.target.value as EvidenceType })}
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Status
          <select
            value={evidence.status}
            onChange={(event) => onUpdate(evidence.id, { status: event.target.value as EvidenceStatus })}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Version
          <input
            type="text"
            placeholder="z. B. 1.0"
            value={evidence.version}
            onChange={(event) => onUpdate(evidence.id, { version: event.target.value })}
          />
        </label>
        <label className="field-label">
          Dokumentklasse
          <select
            value={evidence.classification}
            onChange={(event) => onUpdate(evidence.id, { classification: event.target.value as EvidenceClassification })}
          >
            {classificationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Dokumentenordner
          <div className="input-with-icon">
            <FolderOpen size={16} />
            <input
              type="text"
              list={folderListId}
              placeholder="z. B. Resilienzplan"
              value={evidence.folder}
              onChange={(event) => onUpdate(evidence.id, { folder: event.target.value })}
            />
          </div>
          <datalist id={folderListId}>
            {folderSuggestions.map((folder) => (
              <option key={folder} value={folder} />
            ))}
          </datalist>
        </label>
        <label className="field-label">
          Verantwortlich
          <div className="input-with-icon">
            <UserRound size={16} />
            <input
              type="text"
              placeholder="z. B. QMB, CISO, Facility"
              value={evidence.owner}
              onChange={(event) => onUpdate(evidence.id, { owner: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label">
          Reviewer / Freigabe
          <div className="input-with-icon">
            <UserRound size={16} />
            <input
              type="text"
              placeholder="z. B. Leitung Compliance"
              value={evidence.reviewer}
              onChange={(event) => onUpdate(evidence.id, { reviewer: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label">
          Review-Datum
          <div className="input-with-icon">
            <CalendarDays size={16} />
            <input
              type="date"
              value={evidence.reviewDate}
              onChange={(event) => onUpdate(evidence.id, { reviewDate: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label">
          Gültig bis
          <div className="input-with-icon">
            <CalendarDays size={16} />
            <input
              type="date"
              value={evidence.validUntil}
              onChange={(event) => onUpdate(evidence.id, { validUntil: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label">
          Review-Zyklus in Tagen
          <input
            type="number"
            min="0"
            step="1"
            value={evidence.reviewCycleDays || 0}
            onChange={(event) => onUpdate(evidence.id, { reviewCycleDays: Math.max(0, Number(event.target.value) || 0) })}
          />
        </label>
        <label className="field-label">
          Externe ID / DMS-ID
          <input
            type="text"
            placeholder="z. B. DOC-2026-014"
            value={evidence.externalId}
            onChange={(event) => onUpdate(evidence.id, { externalId: event.target.value })}
          />
        </label>
        <label className="field-label wide">
          Referenz / Link / Ablageort
          <div className="input-with-icon">
            <Link2 size={16} />
            <input
              type="text"
              placeholder="z. B. SharePoint-Link, DMS-ID, Pfad"
              value={evidence.link}
              onChange={(event) => onUpdate(evidence.id, { link: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label wide">
          Tags
          <input
            type="text"
            placeholder="z. B. KRITIS, Audit, BCM"
            value={tagValue}
            onChange={(event) => onUpdate(evidence.id, {
              tags: event.target.value
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            })}
          />
        </label>
        <label className="field-label wide">
          Notizen
          <textarea
            rows={2}
            placeholder="z. B. letzter Test, Freigabestand, fehlende Anlagen"
            value={evidence.notes}
            onChange={(event) => onUpdate(evidence.id, { notes: event.target.value })}
          />
        </label>
      </div>

      <div className="attachment-row">
        <label className="button tertiary file-button">
          <Paperclip size={16} />
          Datei hinterlegen
          <input
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              onAttachFile(evidence.id, file);
              event.currentTarget.value = '';
            }}
          />
        </label>

        {serverVersioningEnabled ? (
          <button
            type="button"
            className="button tertiary"
            onClick={() => {
              const nextShow = !showVersions;
              setShowVersions(nextShow);
              if (nextShow && !versionEntries?.length) {
                onLoadVersions?.(evidence.id);
              }
            }}
          >
            <History size={16} />
            Historie {evidence.serverAttachment?.historyCount ? `(${evidence.serverAttachment.historyCount})` : ''}
          </button>
        ) : null}

        {evidence.serverAttachment ? (
          <div className="attachment-pill">
            <div>
              <strong>{evidence.serverAttachment.fileName}</strong>
              <p className="muted small">
                {evidence.serverAttachment.sizeKb} KB · serverseitig gespeichert · {evidence.serverAttachment.uploadedBy}
              </p>
              <p className="muted small">
                Speicher: {evidence.serverAttachment.storageDriver || 'filesystem'}
                {evidence.serverAttachment.retentionUntil ? ` · Retention bis ${evidence.serverAttachment.retentionUntil}` : ''}
              </p>
              {evidence.serverAttachment.checksumSha256 ? (
                <p className="muted small">SHA-256: {checksumPreview(evidence.serverAttachment.checksumSha256)}</p>
              ) : null}
            </div>
            <div className="inline-actions">
              <button
                type="button"
                className="button tertiary"
                onClick={() => onDownloadServerFile?.(evidence.serverAttachment!.url, evidence.serverAttachment!.fileName)}
                disabled={!onDownloadServerFile}
              >
                <Download size={16} />
                Download
              </button>
              <button type="button" className="button tertiary" onClick={() => onRemoveAttachment(evidence.id)}>
                <Trash2 size={16} />
                Entfernen
              </button>
            </div>
          </div>
        ) : evidence.attachment ? (
          <div className="attachment-pill">
            <div>
              <strong>{evidence.attachment.fileName}</strong>
              <p className="muted small">{evidence.attachment.sizeKb} KB · lokal gespeichert</p>
            </div>
            <div className="inline-actions">
              <a
                className="button tertiary"
                href={evidence.attachment.dataUrl}
                download={evidence.attachment.fileName}
              >
                <Download size={16} />
                Download
              </a>
              <button type="button" className="button tertiary" onClick={() => onRemoveAttachment(evidence.id)}>
                <Trash2 size={16} />
                Entfernen
              </button>
            </div>
          </div>
        ) : (
          <p className="muted small">Dateien werden bei aktiver Serververbindung im Dateispeicher abgelegt, sonst lokal im Browser-Prototyp.</p>
        )}
      </div>

      {showVersions ? (
        <div className="version-timeline">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Dokumentenhistorie</p>
              <h3>Versionen und Checksummen</h3>
            </div>
            <div className="inline-note">
              <ShieldCheck size={16} />
              <span>{hasVersionHistory ? 'Historie verfügbar' : 'Noch keine Historie geladen'}</span>
            </div>
          </div>
          {versionEntries?.length ? versionEntries.map((entry) => (
            <div key={entry.id} className="timeline-row">
              <div>
                <strong>{entry.fileName}</strong>
                <p className="muted small">{formatDateTime(entry.uploadedAt)} · {entry.uploadedBy}</p>
                <p className="muted small">SHA-256: {checksumPreview(entry.checksumSha256)}</p>
              </div>
              <div className="inline-actions">
                {entry.versionLabel ? <span className={`chip ${entry.current ? 'success' : 'outline'}`}>Version {entry.versionLabel}</span> : null}
                {entry.current ? <span className="chip success">aktiv</span> : <span className="chip outline">historisch</span>}
                <button
                  type="button"
                  className="button tertiary"
                  onClick={() => onDownloadServerFile?.(entry.downloadUrl, entry.fileName)}
                  disabled={!onDownloadServerFile}
                >
                  <Download size={16} />
                  Datei
                </button>
                {!entry.current && onRestoreVersion ? (
                  <button type="button" className="button tertiary" onClick={() => onRestoreVersion(evidence.id, entry.id)}>
                    <RotateCcw size={16} />
                    Aktiv setzen
                  </button>
                ) : null}
              </div>
            </div>
          )) : (
            <p className="muted small">Noch keine Historie geladen oder noch keine serverseitige Version vorhanden.</p>
          )}
        </div>
      ) : null}

      <div className="chip-row">
        <span className="chip outline">Version {evidence.version || 'offen'}</span>
        <span className="chip outline">{evidence.classification}</span>
        <span className="chip outline">Ordner: {evidence.folder || 'offen'}</span>
        {evidence.externalId ? <span className="chip outline">ID: {evidence.externalId}</span> : null}
        {evidence.tags.length ? evidence.tags.map((tag) => (
          <span key={tag} className="chip outline">#{tag}</span>
        )) : null}
        {evidence.relatedQuestionIds.length ? (
          <span className="chip outline">Fragen: {evidence.relatedQuestionIds.length}</span>
        ) : null}
        {evidence.relatedRequirementIds.length ? (
          <span className="chip outline">KRITIS-Bausteine: {evidence.relatedRequirementIds.length}</span>
        ) : null}
        {evidence.serverAttachment ? <span className="chip outline">Server-Datei</span> : null}
        {evidence.serverAttachment?.storageDriver ? <span className="chip outline">Speicher: {evidence.serverAttachment.storageDriver}</span> : null}
        {evidence.serverAttachment?.retentionUntil ? <span className="chip outline">Retention bis {evidence.serverAttachment.retentionUntil}</span> : null}
        {evidence.serverAttachment?.retentionStatus ? <span className="chip outline">Retention: {evidence.serverAttachment.retentionStatus}</span> : null}
        {evidence.serverAttachment?.historyCount ? <span className="chip outline">Historie: {evidence.serverAttachment.historyCount}</span> : null}
      </div>
    </article>
  );
}
