import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, X } from 'lucide-react';

interface EmailCaptureDialogProps {
  open: boolean;
  onClose: () => void;
  onProceed: (email: string | null) => void;
}

// Sehr leichter Lead-Magnet: optional, mit prominenter "Direkt herunterladen"-
// Option. Wir speichern die E-Mail aktuell NICHT serverseitig — ein
// `MAILTO:`-Link an den Partner reicht in Phase 5; Phase 7 koennte das durch
// ein echtes Lead-Tracking ersetzen.
export function EmailCaptureDialog({ open, onClose, onProceed }: EmailCaptureDialogProps) {
  const [email, setEmail] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
    setEmail('');
    setTimeout(() => inputRef.current?.focus(), 30);

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      previouslyFocusedRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onProceed(email.trim() || null);
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-capture-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label="Schließen"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-schwarz/80"
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="h-1 bg-bordeaux" aria-hidden />
        <button
          type="button"
          onClick={onClose}
          aria-label="Dialog schließen"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-mauve transition hover:bg-mauve/10 hover:text-bordeaux"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
        <form className="p-6" onSubmit={handleSubmit}>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-hellrosa text-bordeaux">
            <Mail className="h-5 w-5" aria-hidden />
          </span>
          <h2 id="email-capture-title" className="mt-4 text-lg font-semibold text-schwarz">
            Bericht per E-Mail erhalten?
          </h2>
          <p className="mt-2 text-sm text-schwarz/80">
            Optional: Wenn Sie uns Ihre E-Mail-Adresse hinterlassen, melden wir uns mit einer
            kurzen Einordnung Ihrer Antworten. Der Download startet in jedem Fall.
          </p>
          <label htmlFor="email-capture-input" className="sr-only">
            E-Mail-Adresse
          </label>
          <input
            id="email-capture-input"
            ref={inputRef}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ihre.adresse@unternehmen.de"
            className="mt-4 w-full rounded-lg border border-mauve/40 bg-white px-3 py-2.5 text-sm text-schwarz shadow-sm transition focus:border-bordeaux focus:outline-none focus:ring-2 focus:ring-bordeaux/30"
            autoComplete="email"
          />
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onProceed(null)}
              className="rounded-lg border border-mauve/40 px-4 py-2 text-sm font-medium text-schwarz transition hover:border-bordeaux hover:text-bordeaux"
            >
              Direkt herunterladen
            </button>
            <button
              type="submit"
              className="rounded-lg bg-bordeaux px-4 py-2 text-sm font-semibold text-white transition hover:bg-bordeaux/90"
            >
              E-Mail senden &amp; herunterladen
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
