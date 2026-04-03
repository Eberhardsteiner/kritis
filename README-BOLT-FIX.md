# Bolt/StackBlitz Import-Hinweis

Dieses Paket enthält bewusst **kein** `package-lock.json`, damit keine fremden oder internen Registry-URLs erzwungen werden.

## Empfohlener Import

1. ZIP lokal entpacken
2. leeres Bolt- oder StackBlitz-Projekt öffnen
3. entpackte Dateien in das Projekt ziehen
4. dann im Terminal starten

```bash
npm install
npm run dev
```

## Falls Bolt oder die Umgebung trotzdem auf eine falsche Registry zeigt

```bash
rm -f package-lock.json
npm config set registry https://registry.npmjs.org/
npm install --userconfig ./.npmrc
npm run dev
```
