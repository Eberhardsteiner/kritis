# Authentifizierung, OIDC und Rollenmodell

## Ziel

Die App unterstützt zwei Arten von Anmeldung:

1. **Lokales Konto** mit E-Mail und Passwort
2. **Unternehmens-SSO über OIDC**

Beide Wege laufen in dieselbe serverseitige Rollen- und Mandantenlogik.

## Auth-Modi

Der effektive Modus wird aus den Umgebungsvariablen gebildet:

- `local_only`
- `hybrid`
- `oidc_only`

## Minimale OIDC-Konfiguration

```env
KRISENFEST_LOCAL_LOGIN_ENABLED=true
KRISENFEST_OIDC_ENABLED=true
KRISENFEST_OIDC_DISCOVERY_URL=https://YOUR-IDP/.well-known/openid-configuration
KRISENFEST_OIDC_CLIENT_ID=YOUR_CLIENT_ID
KRISENFEST_OIDC_CLIENT_SECRET=YOUR_CLIENT_SECRET
KRISENFEST_OIDC_CALLBACK_URL=https://YOUR-API/api/auth/oidc/callback
```

Alternativ kann statt `KRISENFEST_OIDC_DISCOVERY_URL` ein `KRISENFEST_OIDC_ISSUER` gesetzt werden. Dann wird die Discovery-URL daraus gebildet.

## Wichtige Variablen

```env
KRISENFEST_LOCAL_LOGIN_ENABLED=true
KRISENFEST_OIDC_ENABLED=true
KRISENFEST_OIDC_LABEL=Unternehmens-SSO
KRISENFEST_OIDC_DESCRIPTION=Single Sign-on über den Unternehmens-IdP
KRISENFEST_OIDC_ISSUER=
KRISENFEST_OIDC_DISCOVERY_URL=
KRISENFEST_OIDC_CALLBACK_URL=http://localhost:8787/api/auth/oidc/callback
KRISENFEST_OIDC_CLIENT_ID=
KRISENFEST_OIDC_CLIENT_SECRET=
KRISENFEST_OIDC_SCOPES=openid profile email
KRISENFEST_OIDC_PROMPT=
KRISENFEST_OIDC_AUTO_CREATE_ACCOUNTS=false
KRISENFEST_OIDC_LINK_BY_EMAIL=true
KRISENFEST_OIDC_DEFAULT_TENANT_ID=
KRISENFEST_OIDC_DEFAULT_ROLE=viewer
KRISENFEST_OIDC_TENANT_CLAIM=krisenfest_tenant
KRISENFEST_OIDC_ROLE_CLAIM=krisenfest_role
KRISENFEST_OIDC_SCOPE_CLAIM=krisenfest_scope
KRISENFEST_OIDC_EMAIL_CLAIM=email
KRISENFEST_OIDC_NAME_CLAIM=name
KRISENFEST_OIDC_USERNAME_CLAIM=preferred_username
KRISENFEST_OIDC_AUTH_TICKET_MINUTES=5
KRISENFEST_OIDC_TRANSACTION_MINUTES=10
```

## Ablauf

### 1. SSO-Start

`GET /api/auth/oidc/start?tenantId=...`

Der Server erzeugt:
- PKCE-Code-Verifier und Challenge
- State
- temporären Login-Flow mit Ablaufzeit
- Redirect-URL zum Identity Provider

### 2. Callback vom Identity Provider

`GET /api/auth/oidc/callback`

Der Server prüft:
- State
- Code gegen Token-Endpunkt
- ID-Token
- OIDC-Profil
- Zielmandant und Mitgliedschaft

Danach wird **kein Session-Token in die URL** geschrieben. Stattdessen erzeugt der Server ein kurzes **Auth-Ticket** und leitet die SPA mit diesem Ticket zurück.

### 3. Abschluss in der SPA

`POST /api/auth/oidc/complete`

Die SPA tauscht das einmalige Ticket gegen die normale App-Session aus.

## Rollen- und Tenant-Zuordnung

Die Auflösung läuft in dieser Reihenfolge:

1. vorhandene externe Identität
2. optionales Linking über E-Mail
3. optionales Auto-Creating eines Kontos
4. Membership-Auflösung über
   - angeforderten Mandanten
   - Tenant-Claim
   - Standardmandant
   - erste aktive Mitgliedschaft

## Kontotypen

- `local` – nur Passwortanmeldung
- `oidc` – nur externer Provider
- `hybrid` – beides möglich

## Demo und Produktion

- Im **Demo-Modus** bleibt lesender Zugriff ohne Login möglich.
- Im **Produktivmodus** sollte `KRISENFEST_ANONYMOUS_ACCESS=false` gesetzt werden.
- OIDC kann parallel zum lokalen Fallback laufen oder als alleiniger Login verwendet werden.

## Lokaler Test in Bolt

```bash
npm install --userconfig ./.npmrc
npm test
npm run build
npm run dev
```

Dann OIDC-Variablen setzen und `/api/auth/bootstrap` prüfen.
