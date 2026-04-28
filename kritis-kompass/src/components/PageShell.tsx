import type { ReactNode } from 'react';

interface PageShellProps {
  eyebrow?: string;
  title: string;
  intro?: string;
  children: ReactNode;
}

export function PageShell({ eyebrow, title, intro, children }: PageShellProps) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-schwarz">
      {eyebrow ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-bordeaux">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-3xl font-semibold text-schwarz">{title}</h1>
      {intro ? <p className="mt-4 text-base text-schwarz/70">{intro}</p> : null}
      <div className="mt-8">{children}</div>
    </main>
  );
}
