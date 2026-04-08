# Produktpaket P2 – Notizen

## Schwerpunkt

Produktive Identität, OIDC-SSO, Rollen- und Tenant-Zuordnung auf Basis der bestehenden KRITIS-Readiness-Engine.

## Umgesetzt

- Auth-Provider-Abstraktion für lokale Konten und OIDC
- OIDC-Start mit Discovery, PKCE und State
- OIDC-Callback mit einmaligem Ticket für sichere Rückkehr in die SPA
- serverseitige Auflösung von Konto, Mitgliedschaft, Rolle und Zielmandant
- externe Identitäten an Konten gebunden
- Kontotypen `local`, `oidc` und `hybrid`
- Plattformsicht erweitert um Providerstatus und SSO-Start
- Bootstrap-Antwort erweitert um Auth-Modus und Providerliste
- Roadmap in der App auf **P2 umgesetzt** fortgeschrieben

## Technisch geprüft

- `npm test` erfolgreich
- `npm run build` erfolgreich
- `node --check server/index.js` erfolgreich
- `node --check server/auth-provider.js` erfolgreich
- manueller Smoke für `/api/auth/bootstrap`
- manueller Smoke für `/api/auth/oidc/start` mit lokaler Mock-Discovery

## Nächster Schritt

Produktpaket P3: produktive Daten- und Evidenzplattform mit Datenbank, Objektablage und belastbarer Retention.
