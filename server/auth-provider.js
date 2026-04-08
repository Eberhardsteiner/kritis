import crypto from 'node:crypto';

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function parseScopes(value, fallback = ['openid', 'profile', 'email']) {
  const normalized = String(value || '')
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return normalized.length ? normalized : [...fallback];
}

function normalizeUrl(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function decodeJwtPart(part) {
  const buffer = base64UrlDecode(part);
  return JSON.parse(buffer.toString('utf8'));
}

function splitJwt(token) {
  const raw = String(token || '').trim();
  const parts = raw.split('.');
  if (parts.length !== 3) {
    throw new Error('OIDC-ID-Token ist nicht im JWT-Format vorhanden.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  return {
    encodedHeader,
    encodedPayload,
    encodedSignature,
    header: decodeJwtPart(encodedHeader),
    payload: decodeJwtPart(encodedPayload),
    signature: base64UrlDecode(encodedSignature),
    signingInput: `${encodedHeader}.${encodedPayload}`,
  };
}

function createExpiry(minutes) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

const jwtVerifyAlgorithms = {
  RS256: 'RSA-SHA256',
  RS384: 'RSA-SHA384',
  RS512: 'RSA-SHA512',
};

function normalizeAuthMode(localEnabled, oidcEnabled) {
  if (localEnabled && oidcEnabled) {
    return 'hybrid';
  }
  if (oidcEnabled) {
    return 'oidc_only';
  }
  return 'local_only';
}

export function buildAuthStrategyConfig(env = {}, runtimeConfig = {}) {
  const localEnabled = normalizeBoolean(env.KRISENFEST_LOCAL_LOGIN_ENABLED, true);
  const issuer = normalizeUrl(env.KRISENFEST_OIDC_ISSUER);
  const discoveryUrl = normalizeUrl(env.KRISENFEST_OIDC_DISCOVERY_URL || (issuer ? `${issuer}/.well-known/openid-configuration` : ''));
  const callbackUrl = normalizeUrl(env.KRISENFEST_OIDC_CALLBACK_URL || (env.KRISENFEST_API_BASE_URL ? `${normalizeUrl(env.KRISENFEST_API_BASE_URL)}/api/auth/oidc/callback` : 'http://localhost:8787/api/auth/oidc/callback'));
  const clientId = String(env.KRISENFEST_OIDC_CLIENT_ID || '').trim();
  const clientSecret = String(env.KRISENFEST_OIDC_CLIENT_SECRET || '').trim();
  const oidcEnabled = normalizeBoolean(env.KRISENFEST_OIDC_ENABLED, Boolean(discoveryUrl && clientId));
  const defaultRole = ['admin', 'lead', 'editor', 'reviewer', 'auditor', 'viewer'].includes(String(env.KRISENFEST_OIDC_DEFAULT_ROLE || '').trim())
    ? String(env.KRISENFEST_OIDC_DEFAULT_ROLE || '').trim()
    : 'viewer';

  const oidcProvider = {
    id: 'oidc',
    type: 'oidc',
    label: String(env.KRISENFEST_OIDC_LABEL || 'Unternehmens-SSO').trim() || 'Unternehmens-SSO',
    description: String(env.KRISENFEST_OIDC_DESCRIPTION || 'Single Sign-on über Ihren bestehenden Identity Provider.').trim()
      || 'Single Sign-on über Ihren bestehenden Identity Provider.',
    enabled: oidcEnabled,
    configured: Boolean(discoveryUrl && clientId && callbackUrl),
    issuer,
    discoveryUrl,
    clientId,
    clientSecret,
    callbackUrl,
    scopes: parseScopes(env.KRISENFEST_OIDC_SCOPES),
    prompt: String(env.KRISENFEST_OIDC_PROMPT || '').trim(),
    autoCreateAccounts: normalizeBoolean(env.KRISENFEST_OIDC_AUTO_CREATE_ACCOUNTS, false),
    linkByEmail: normalizeBoolean(env.KRISENFEST_OIDC_LINK_BY_EMAIL, true),
    defaultTenantId: String(env.KRISENFEST_OIDC_DEFAULT_TENANT_ID || '').trim(),
    defaultRoleProfile: defaultRole,
    tenantClaim: String(env.KRISENFEST_OIDC_TENANT_CLAIM || 'krisenfest_tenant').trim() || 'krisenfest_tenant',
    roleClaim: String(env.KRISENFEST_OIDC_ROLE_CLAIM || 'krisenfest_role').trim() || 'krisenfest_role',
    scopeClaim: String(env.KRISENFEST_OIDC_SCOPE_CLAIM || 'krisenfest_scope').trim() || 'krisenfest_scope',
    emailClaim: String(env.KRISENFEST_OIDC_EMAIL_CLAIM || 'email').trim() || 'email',
    nameClaim: String(env.KRISENFEST_OIDC_NAME_CLAIM || 'name').trim() || 'name',
    usernameClaim: String(env.KRISENFEST_OIDC_USERNAME_CLAIM || 'preferred_username').trim() || 'preferred_username',
    authTicketMinutes: Number.isFinite(Number(env.KRISENFEST_OIDC_AUTH_TICKET_MINUTES))
      ? Math.min(Math.max(Math.round(Number(env.KRISENFEST_OIDC_AUTH_TICKET_MINUTES)), 1), 30)
      : 5,
    transactionMinutes: Number.isFinite(Number(env.KRISENFEST_OIDC_TRANSACTION_MINUTES))
      ? Math.min(Math.max(Math.round(Number(env.KRISENFEST_OIDC_TRANSACTION_MINUTES)), 1), 30)
      : 10,
  };

  const localProvider = {
    id: 'local',
    type: 'password',
    label: String(env.KRISENFEST_LOCAL_LOGIN_LABEL || 'Lokales Konto').trim() || 'Lokales Konto',
    description: String(env.KRISENFEST_LOCAL_LOGIN_DESCRIPTION || 'Mandantenkonto mit E-Mail und Passwort.').trim()
      || 'Mandantenkonto mit E-Mail und Passwort.',
    enabled: localEnabled,
    configured: true,
  };

  return {
    mode: normalizeAuthMode(localProvider.enabled, oidcProvider.enabled),
    local: localProvider,
    oidc: oidcProvider,
    demoFallbackEnabled: runtimeConfig.appMode === 'demo',
  };
}

export function buildPublicAuthProviders(strategy) {
  return [strategy.local, strategy.oidc]
    .filter((provider) => provider.enabled || provider.id === 'oidc')
    .map((provider) => ({
      id: provider.id,
      type: provider.type,
      label: provider.label,
      description: provider.description,
      enabled: Boolean(provider.enabled),
      configured: Boolean(provider.configured),
      supportsTenantSelection: provider.id === 'oidc' || provider.id === 'local',
    }));
}

const discoveryCache = new Map();
const jwksCache = new Map();

export async function fetchOidcDiscovery(provider, fetchImpl = fetch) {
  if (!provider?.enabled) {
    throw new Error('OIDC-Provider ist nicht aktiviert.');
  }
  if (!provider.discoveryUrl) {
    throw new Error('OIDC-Discovery-URL fehlt.');
  }

  const cached = discoveryCache.get(provider.discoveryUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const response = await fetchImpl(provider.discoveryUrl, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`OIDC-Discovery konnte nicht geladen werden (${response.status}).`);
  }

  const payload = await response.json();
  const requiredFields = ['authorization_endpoint', 'token_endpoint'];
  for (const field of requiredFields) {
    if (!payload?.[field]) {
      throw new Error(`OIDC-Discovery ist unvollständig. Feld ${field} fehlt.`);
    }
  }

  if (!payload?.issuer && provider.issuer) {
    payload.issuer = provider.issuer;
  }

  discoveryCache.set(provider.discoveryUrl, {
    value: payload,
    expiresAt: Date.now() + 10 * 60_000,
  });

  return payload;
}

async function fetchJwks(jwksUri, fetchImpl = fetch) {
  if (!jwksUri) {
    throw new Error('JWKS-URI fehlt in der OIDC-Discovery.');
  }

  const cached = jwksCache.get(jwksUri);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const response = await fetchImpl(jwksUri, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`JWKS konnte nicht geladen werden (${response.status}).`);
  }

  const payload = await response.json();
  const value = Array.isArray(payload?.keys) ? payload : { keys: [] };
  jwksCache.set(jwksUri, {
    value,
    expiresAt: Date.now() + 10 * 60_000,
  });
  return value;
}

export function createPkcePair() {
  const verifier = base64UrlEncode(crypto.randomBytes(48));
  const challenge = base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());
  return {
    verifier,
    challenge,
    method: 'S256',
  };
}

export function createOidcTransaction(provider, tenantId = '') {
  const pkce = createPkcePair();
  return {
    id: crypto.randomBytes(18).toString('hex'),
    state: crypto.randomBytes(18).toString('hex'),
    tenantId: String(tenantId || '').trim(),
    codeVerifier: pkce.verifier,
    codeChallenge: pkce.challenge,
    codeChallengeMethod: pkce.method,
    createdAt: new Date().toISOString(),
    expiresAt: createExpiry(provider?.transactionMinutes || 10),
  };
}

export function buildOidcAuthorizationUrl(provider, discovery, transaction) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: provider.clientId,
    redirect_uri: provider.callbackUrl,
    scope: provider.scopes.join(' '),
    state: transaction.state,
    code_challenge: transaction.codeChallenge,
    code_challenge_method: transaction.codeChallengeMethod,
  });

  if (provider.prompt) {
    params.set('prompt', provider.prompt);
  }

  return `${discovery.authorization_endpoint}?${params.toString()}`;
}

export async function exchangeOidcCode(provider, discovery, { code, codeVerifier }, fetchImpl = fetch) {
  if (!code) {
    throw new Error('Autorisierungscode fehlt.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: provider.callbackUrl,
    client_id: provider.clientId,
    code_verifier: codeVerifier,
  });
  if (provider.clientSecret) {
    body.set('client_secret', provider.clientSecret);
  }

  const response = await fetchImpl(discovery.token_endpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OIDC-Codeaustausch fehlgeschlagen (${response.status}). ${detail}`.trim());
  }

  const payload = await response.json();
  if (!payload?.access_token && !payload?.id_token) {
    throw new Error('OIDC-Tokenantwort enthält weder Access Token noch ID Token.');
  }
  return payload;
}

export async function verifyOidcIdToken(provider, discovery, idToken, fetchImpl = fetch) {
  const token = splitJwt(idToken);
  const verifyAlgorithm = jwtVerifyAlgorithms[token.header.alg];
  if (!verifyAlgorithm) {
    throw new Error(`OIDC-ID-Token-Algorithmus ${token.header.alg || 'unbekannt'} wird nicht unterstützt.`);
  }

  const jwks = await fetchJwks(discovery.jwks_uri, fetchImpl);
  const jwk = (jwks.keys || []).find((entry) => entry?.kid === token.header.kid) || (jwks.keys || [])[0];
  if (!jwk) {
    throw new Error('Passender Signaturschlüssel für das ID Token wurde nicht gefunden.');
  }

  const keyObject = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const verified = crypto.verify(verifyAlgorithm, Buffer.from(token.signingInput, 'utf8'), keyObject, token.signature);
  if (!verified) {
    throw new Error('OIDC-ID-Token-Signatur ist ungültig.');
  }

  const now = Math.floor(Date.now() / 1000);
  const issuer = String(token.payload.iss || '');
  const allowedIssuer = provider.issuer || discovery.issuer || '';
  if (allowedIssuer && issuer && issuer !== allowedIssuer) {
    throw new Error('OIDC-ID-Token stammt von einem unerwarteten Issuer.');
  }

  const audiences = Array.isArray(token.payload.aud) ? token.payload.aud : [token.payload.aud];
  if (!audiences.filter(Boolean).includes(provider.clientId)) {
    throw new Error('OIDC-ID-Token ist nicht für diesen Client ausgestellt.');
  }

  if (Number.isFinite(Number(token.payload.exp)) && Number(token.payload.exp) <= now) {
    throw new Error('OIDC-ID-Token ist abgelaufen.');
  }

  if (Number.isFinite(Number(token.payload.nbf)) && Number(token.payload.nbf) > now) {
    throw new Error('OIDC-ID-Token ist noch nicht gültig.');
  }

  return token.payload;
}

export async function fetchOidcUserProfile(provider, discovery, tokenSet, fetchImpl = fetch) {
  if (discovery.userinfo_endpoint && tokenSet?.access_token) {
    const response = await fetchImpl(discovery.userinfo_endpoint, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${tokenSet.access_token}`,
      },
    });
    if (response.ok) {
      return response.json();
    }
  }

  if (tokenSet?.id_token) {
    return verifyOidcIdToken(provider, discovery, tokenSet.id_token, fetchImpl);
  }

  throw new Error('OIDC-Benutzerprofil konnte weder über userinfo noch ID-Token ermittelt werden.');
}

export function extractOidcProfile(provider, rawProfile = {}) {
  const subject = String(rawProfile?.sub || '').trim();
  const email = String(rawProfile?.[provider.emailClaim] || rawProfile?.email || '').trim().toLowerCase();
  const preferredName = String(
    rawProfile?.[provider.nameClaim]
      || rawProfile?.[provider.usernameClaim]
      || rawProfile?.preferred_username
      || rawProfile?.given_name
      || email
      || subject,
  ).trim();

  if (!subject) {
    throw new Error('OIDC-Benutzerprofil enthält kein Subject (sub).');
  }

  return {
    providerId: provider.id,
    issuer: String(rawProfile?.iss || provider.issuer || '').trim(),
    subject,
    email,
    name: preferredName,
    tenantHint: String(rawProfile?.[provider.tenantClaim] || '').trim(),
    roleHint: String(rawProfile?.[provider.roleClaim] || '').trim(),
    scopeHint: String(rawProfile?.[provider.scopeClaim] || '').trim(),
    rawProfile,
  };
}

export function createAuthCallbackTicket(provider, sessionToken) {
  return {
    id: crypto.randomBytes(18).toString('hex'),
    providerId: provider.id,
    sessionToken,
    createdAt: new Date().toISOString(),
    expiresAt: createExpiry(provider?.authTicketMinutes || 5),
  };
}

export function sanitizeAuthTransaction(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    id: String(raw.id || '').trim(),
    state: String(raw.state || '').trim(),
    providerId: String(raw.providerId || 'oidc').trim() || 'oidc',
    tenantId: String(raw.tenantId || '').trim(),
    codeVerifier: String(raw.codeVerifier || '').trim(),
    codeChallenge: String(raw.codeChallenge || '').trim(),
    codeChallengeMethod: String(raw.codeChallengeMethod || 'S256').trim() || 'S256',
    createdAt: String(raw.createdAt || '').trim(),
    expiresAt: String(raw.expiresAt || '').trim(),
  };
}

export function sanitizeAuthCallbackTicket(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    id: String(raw.id || '').trim(),
    providerId: String(raw.providerId || 'oidc').trim() || 'oidc',
    sessionToken: String(raw.sessionToken || '').trim(),
    createdAt: String(raw.createdAt || '').trim(),
    expiresAt: String(raw.expiresAt || '').trim(),
  };
}

export function isTimedRecordActive(value) {
  const expiresAt = new Date(String(value?.expiresAt || '')).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}
