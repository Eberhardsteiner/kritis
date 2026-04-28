import { Link } from 'react-router-dom';
import { ShieldIcon } from './ShieldIcon';
import { BRANDING } from '../config/branding';

const PARTNER_LINE = (() => {
  if (BRANDING.partner2.url || BRANDING.partner2.contactEmail) {
    return `${BRANDING.partner1.name} · ${BRANDING.partner2.name}`;
  }
  return BRANDING.partner1.name;
})();

interface AppHeaderProps {
  /** Zusaetzliche Tailwind-Klassen am Wurzel-Element. */
  className?: string;
}

export function AppHeader({ className }: AppHeaderProps) {
  return (
    <header className={`mb-6 flex items-center justify-between gap-3 ${className ?? ''}`}>
      <Link
        to="/"
        aria-label="Zur Startseite"
        className="group flex items-center gap-2 transition hover:opacity-80"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-bordeaux/10">
          <ShieldIcon size={16} color="#c43960" letterColor="#c43960" />
        </span>
        <span className="text-sm font-medium text-schwarz">{BRANDING.appName}</span>
      </Link>
      <div className="hidden items-center gap-2 text-[11px] text-[#7a5060] sm:flex">
        <span aria-hidden>·</span>
        <span>{PARTNER_LINE}</span>
      </div>
    </header>
  );
}
