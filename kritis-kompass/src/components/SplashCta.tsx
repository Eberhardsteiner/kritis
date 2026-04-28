import { forwardRef, type MouseEvent } from 'react';

interface SplashCtaProps {
  primaryLabel: string;
  /**
   * Wird beim Klick aufgerufen. Bekommt das Event, damit der Aufrufer ggf.
   * preventDefault auslösen kann.
   */
  onPrimaryClick: (event: MouseEvent<HTMLButtonElement>) => void;
  helperQuestion: string;
  helperLinkLabel: string;
  onHelperClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  helperHref: string;
  privacyText?: string;
}

export const SplashCta = forwardRef<HTMLButtonElement, SplashCtaProps>(
  (
    {
      primaryLabel,
      onPrimaryClick,
      helperQuestion,
      helperLinkLabel,
      onHelperClick,
      helperHref,
      privacyText,
    },
    ref,
  ) => {
    return (
      <div className="flex w-full flex-col items-center text-center">
        <button
          ref={ref}
          type="button"
          onClick={onPrimaryClick}
          className="inline-flex h-11 w-full max-w-[260px] items-center justify-center rounded-md bg-bordeaux px-6 text-sm font-medium uppercase text-schwarz shadow-sm transition hover:bg-bordeaux/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-bordeaux focus-visible:ring-offset-2 focus-visible:ring-offset-schwarz sm:max-w-[220px]"
          style={{ letterSpacing: '0.18em' }}
        >
          {primaryLabel}
        </button>

        <p className="mt-5 text-xs text-mauve">
          {helperQuestion}{' '}
          <a
            href={helperHref}
            onClick={onHelperClick}
            className="border-b border-bordeaux/60 pb-px text-bordeaux transition hover:border-bordeaux hover:text-bordeaux/90"
          >
            {helperLinkLabel}
          </a>
        </p>

        {privacyText ? (
          <p
            className="mt-4 text-[10px] uppercase text-[#7a5060]"
            style={{ letterSpacing: '0.12em' }}
          >
            {privacyText}
          </p>
        ) : null}
      </div>
    );
  },
);

SplashCta.displayName = 'SplashCta';
