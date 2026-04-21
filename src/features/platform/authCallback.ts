/**
 * Liest OIDC-Callback-Parameter aus der URL-Suche. Wird im App-Start
 * ausgewertet, um eine Weiterleitung vom Identity-Provider (mit
 * auth_ticket, auth_error, auth_provider) zu verarbeiten. Serverseite
 * signiert das Ticket vorab, hier wird nur gelesen.
 */
export function readAuthCallbackSearch(): {
  ticket: string;
  error: string;
  provider: string;
} {
  if (typeof window === 'undefined') {
    return { ticket: '', error: '', provider: '' };
  }

  const url = new URL(window.location.href);
  return {
    ticket: url.searchParams.get('auth_ticket') || '',
    error: url.searchParams.get('auth_error') || '',
    provider: url.searchParams.get('auth_provider') || '',
  };
}

/**
 * Entfernt die OIDC-Callback-Parameter aus der URL, nachdem sie
 * verarbeitet wurden. History-API statt location.assign, damit kein
 * Reload entsteht.
 */
export function clearAuthCallbackSearch(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  ['auth_ticket', 'auth_error', 'auth_provider'].forEach((key) =>
    url.searchParams.delete(key),
  );
  window.history.replaceState(
    {},
    document.title,
    `${url.pathname}${url.search}${url.hash}`,
  );
}
