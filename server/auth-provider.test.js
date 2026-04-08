import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  buildAuthStrategyConfig,
  buildOidcAuthorizationUrl,
  buildPublicAuthProviders,
  createAuthCallbackTicket,
  createOidcTransaction,
  createPkcePair,
  extractOidcProfile,
  fetchOidcDiscovery,
  isTimedRecordActive,
  sanitizeAuthCallbackTicket,
  sanitizeAuthTransaction,
  verifyOidcIdToken,
} from './auth-provider.js';

function buildSignedJwt(payload, { kid = 'kid-1', issuer = 'https://issuer.example', audience = 'client-id' } = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const completePayload = {
    iss: issuer,
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 300,
    sub: 'sub-123',
    ...payload,
  };

  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const signingInput = `${encode(header)}.${encode(completePayload)}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput, 'utf8'), privateKey).toString('base64url');

  return {
    token: `${signingInput}.${signature}`,
    jwk: publicKey.export({ format: 'jwk' }),
  };
}

test('buildAuthStrategyConfig enables hybrid mode for local plus OIDC', () => {
  const strategy = buildAuthStrategyConfig({
    KRISENFEST_LOCAL_LOGIN_ENABLED: 'true',
    KRISENFEST_OIDC_ENABLED: 'true',
    KRISENFEST_OIDC_ISSUER: 'https://issuer.example',
    KRISENFEST_OIDC_CLIENT_ID: 'client-id',
    KRISENFEST_OIDC_CALLBACK_URL: 'http://localhost:8787/api/auth/oidc/callback',
  }, { appMode: 'production' });

  assert.equal(strategy.mode, 'hybrid');
  assert.equal(strategy.local.enabled, true);
  assert.equal(strategy.oidc.enabled, true);
  assert.equal(strategy.oidc.configured, true);
  assert.deepEqual(strategy.oidc.scopes, ['openid', 'profile', 'email']);
});

test('buildPublicAuthProviders returns local and oidc summaries', () => {
  const providers = buildPublicAuthProviders(buildAuthStrategyConfig({
    KRISENFEST_OIDC_ENABLED: 'true',
    KRISENFEST_OIDC_ISSUER: 'https://issuer.example',
    KRISENFEST_OIDC_CLIENT_ID: 'client-id',
    KRISENFEST_OIDC_CALLBACK_URL: 'http://localhost:8787/api/auth/oidc/callback',
  }));

  assert.equal(providers.length, 2);
  assert.equal(providers[0].id, 'local');
  assert.equal(providers[1].id, 'oidc');
  assert.equal(providers[1].type, 'oidc');
});

test('createPkcePair and transaction include verifier and challenge', () => {
  const pkce = createPkcePair();
  assert.ok(pkce.verifier.length > 20);
  assert.ok(pkce.challenge.length > 20);
  const transaction = createOidcTransaction({ transactionMinutes: 5 }, 'tenant-1');
  assert.equal(transaction.tenantId, 'tenant-1');
  assert.equal(transaction.codeChallengeMethod, 'S256');
  assert.ok(isTimedRecordActive(transaction));
});

test('buildOidcAuthorizationUrl includes PKCE and tenant selection', () => {
  const transaction = {
    state: 'state-1',
    codeChallenge: 'challenge-1',
    codeChallengeMethod: 'S256',
  };
  const url = buildOidcAuthorizationUrl({
    clientId: 'client-id',
    callbackUrl: 'http://localhost:8787/api/auth/oidc/callback',
    scopes: ['openid', 'profile', 'email'],
    prompt: 'login',
  }, {
    authorization_endpoint: 'https://issuer.example/authorize',
  }, transaction);

  assert.ok(url.includes('response_type=code'));
  assert.ok(url.includes('client_id=client-id'));
  assert.ok(url.includes('code_challenge=challenge-1'));
  assert.ok(url.includes('prompt=login'));
});

test('fetchOidcDiscovery validates discovery payload', async () => {
  const discovery = await fetchOidcDiscovery({
    enabled: true,
    discoveryUrl: 'https://issuer.example/.well-known/openid-configuration',
    issuer: 'https://issuer.example',
  }, async () => ({
    ok: true,
    async json() {
      return {
        issuer: 'https://issuer.example',
        authorization_endpoint: 'https://issuer.example/authorize',
        token_endpoint: 'https://issuer.example/token',
        jwks_uri: 'https://issuer.example/jwks',
      };
    },
  }));

  assert.equal(discovery.issuer, 'https://issuer.example');
  assert.equal(discovery.token_endpoint, 'https://issuer.example/token');
});

test('verifyOidcIdToken accepts valid RS256 token', async () => {
  const signed = buildSignedJwt({ email: 'person@example.com', name: 'Person' });
  const claims = await verifyOidcIdToken({
    issuer: 'https://issuer.example',
    clientId: 'client-id',
  }, {
    issuer: 'https://issuer.example',
    jwks_uri: 'https://issuer.example/jwks',
  }, signed.token, async () => ({
    ok: true,
    async json() {
      return { keys: [{ ...signed.jwk, kid: 'kid-1' }] };
    },
  }));

  assert.equal(claims.email, 'person@example.com');
  assert.equal(claims.sub, 'sub-123');
});

test('extractOidcProfile maps tenant and role hints', () => {
  const profile = extractOidcProfile({
    id: 'oidc',
    issuer: 'https://issuer.example',
    tenantClaim: 'tenant',
    roleClaim: 'role',
    scopeClaim: 'scope',
    emailClaim: 'email',
    nameClaim: 'display_name',
    usernameClaim: 'preferred_username',
  }, {
    sub: 'abc',
    email: 'lead@example.com',
    display_name: 'Leitung',
    tenant: 'tenant-1',
    role: 'lead',
    scope: 'Werk A',
  });

  assert.equal(profile.subject, 'abc');
  assert.equal(profile.email, 'lead@example.com');
  assert.equal(profile.tenantHint, 'tenant-1');
  assert.equal(profile.roleHint, 'lead');
  assert.equal(profile.scopeHint, 'Werk A');
});

test('sanitizeAuthTransaction and callback ticket keep only expected fields', () => {
  const transaction = sanitizeAuthTransaction({
    id: 'txn-1',
    state: 'state-1',
    providerId: 'oidc',
    codeVerifier: 'verifier',
    codeChallenge: 'challenge',
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    unknown: 'x',
  });
  assert.equal(transaction.id, 'txn-1');
  assert.equal(transaction.providerId, 'oidc');
  assert.equal(transaction.codeVerifier, 'verifier');

  const ticket = sanitizeAuthCallbackTicket(createAuthCallbackTicket({ id: 'oidc', authTicketMinutes: 5 }, 'session-token'));
  assert.equal(ticket.providerId, 'oidc');
  assert.equal(ticket.sessionToken, 'session-token');
  assert.ok(isTimedRecordActive(ticket));
});
