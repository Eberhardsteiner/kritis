import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Vor Oeffnen aktiv fokussiertes Element merken; nach Schliessen restoren.
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
    confirmRef.current?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      previouslyFocusedRef.current?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label="Schließen"
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-schwarz/80"
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="h-1 bg-bordeaux" aria-hidden />
        <div className="p-6">
          <h2 id="confirm-dialog-title" className="text-lg font-semibold text-schwarz">
            {title}
          </h2>
          <p className="mt-3 text-sm text-schwarz/80">{body}</p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-mauve/40 px-4 py-2 text-sm font-medium text-schwarz transition hover:border-bordeaux hover:text-bordeaux"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              ref={confirmRef}
              onClick={onConfirm}
              className="rounded-lg bg-bordeaux px-4 py-2 text-sm font-semibold text-white transition hover:bg-bordeaux/90"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
