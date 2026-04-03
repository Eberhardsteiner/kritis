# Bolt/StackBlitz Import-Hinweis

Dieses Paket enthält bewusst **kein** `package-lock.json`, damit keine fremden oder internen Registry-URLs erzwungen werden.

## Start

```bash
npm install
npm run dev
```

## Falls Bolt eine alte Konfiguration gecacht hat

```bash
rm -f package-lock.json
npm config set registry https://registry.npmjs.org/
npm install
npm run dev
```
