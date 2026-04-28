# Deployment

Die App ist eine reine Static-SPA — kein Backend, kein Datenbank-Anschluss. Jeder Static-Hoster reicht.

## Build

```bash
npm install
npm run build
```

Ergebnis liegt in `dist/`:

```
dist/
├── index.html
├── favicon.svg
├── og-image.svg
├── assets/
│   ├── index-*.js          ← Hauptbundle (~675 KB raw / ~218 KB gzip)
│   ├── index-*.css         ← Tailwind (~23 KB raw / ~5 KB gzip)
│   └── jspdf-Chunks (3x)   ← lazy-loaded jsPDF-Stack
└── module-packs/           ← 10 Container-JSONs (~1.6 MB)
```

Lokale Vorschau:

```bash
npm run preview            # http://localhost:4173
```

## Hosting-Empfehlung: Vercel

1. GitHub-Repo verbinden (Vercel-Dashboard → "New Project" → Import)
2. Framework Preset: **Vite** (wird automatisch erkannt)
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Auto-Deploy bei Push auf `main`

SPA-Rewrites werden von Vercel automatisch erkannt (Vite-Preset). Falls nicht: `vercel.json` im Repo-Stamm:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

## Alternativ: Netlify

`netlify.toml` im Repo-Stamm:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

GitHub-Repo verbinden, Auto-Deploy aktiv.

## Alternativ: eigener Webhost (Apache / Nginx / FTP)

Inhalt von `dist/` per FTP / SSH / `rsync` hochladen:

```bash
rsync -avz dist/ user@server:/var/www/kritis-kompass/
```

### Apache: SPA-Rewrite via `.htaccess`

Im Server-Root:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### Nginx: SPA-Rewrite

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## DNS / eigene Subdomain

Empfehlung: Subdomain z.B. `kritis.uvm-akademie.de`.

Bei Vercel:

1. Vercel-Projekt → Settings → Domains → `kritis.uvm-akademie.de` hinzufügen
2. DNS-Anbieter (z.B. all-inkl, Strato): CNAME-Record `kritis` → `cname.vercel-dns.com`
3. SSL-Zertifikat wird automatisch von Vercel ausgestellt (Let's Encrypt)

Bei Netlify analog mit `kritis.netlify.app` als Ziel.

## CI / Auto-Deploy

Falls eine GitHub-Action gewünscht ist (statt Vercel/Netlify-Auto-Deploy), Beispiel `.github/workflows/deploy.yml`:

```yaml
name: Build and deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run build
      - name: Deploy via FTP
        uses: SamKirkland/FTP-Deploy-Action@v4
        with:
          server: ${{ secrets.FTP_HOST }}
          username: ${{ secrets.FTP_USER }}
          password: ${{ secrets.FTP_PASSWORD }}
          local-dir: ./dist/
          server-dir: /kritis/
```

Secrets im GitHub-Repo unter Settings → Secrets and variables → Actions konfigurieren.

## Pre-Deploy-Checkliste

Vor dem ersten Live-Gang:

- [ ] `partner2`-Felder in [src/config/branding.ts](../src/config/branding.ts) eintragen oder leer belassen
- [ ] Datenschutz-Texte in [src/views/PrivacyView.tsx](../src/views/PrivacyView.tsx) mit Anwalt abklären
- [ ] `npm run build` lokal testen
- [ ] PDF-Bericht herunterladen, in mind. zwei PDF-Viewern öffnen (Acrobat + Browser-Built-in)
- [ ] OG-Image testen via <https://www.opengraph.xyz/>
- [ ] Lighthouse-Audit auf Production-URL durchführen (Performance + Accessibility ≥ 95)
