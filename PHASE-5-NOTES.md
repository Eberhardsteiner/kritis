# Phase 5 – Backend, Rechteprüfung und persistente Ablage

## Neu in Phase 5

### 1. Leichtgewichtiges API-Backend
- Express-Server unter `server/index.js`
- Start gemeinsam mit dem Frontend über `npm run dev`
- Vite-Proxy für `/api` auf Port `8787`
- Dateisystembasierte Speicherung für den Prototyp

### 2. Serverseitige Datenhaltung
- zentraler Zustand in `server-storage/state.json`
- Audit-Log in `server-storage/audit-log.json`
- Snapshots in `server-storage/snapshots`
- Anhänge in `server-storage/uploads`

### 3. Serverseitige Rechteprüfung
Zusätzlich zur Frontend-Sperre prüft das Backend Schreibzugriffe anhand des aktiven Nutzerprofils.

Unterstützte Rollen:
- Programmadmin
- Programmleitung
- Fachbearbeitung
- Review / Freigabe
- Audit / Prüfung
- Leser

Geprüfte Berechtigungen:
- Analyse bearbeiten
- Maßnahmen steuern
- Nachweise pflegen
- Governance bearbeiten
- Rechte und Fristen verwalten
- Branchenmodule verwalten
- KRITIS-Workflow pflegen
- Berichte exportieren

### 4. Datei-Uploads für Evidenzen
- Upload direkt an das Backend
- serverseitige Referenz statt reiner Browser-Ablage
- Entfernen von Anhängen auch über API
- automatische Bereinigung verwaister Uploads bei Zustandswechseln

### 5. Plattform- und Sync-Bereich
Neuer Bereich **„Plattform & Sync“** mit:
- Serverstatus
- letzter Server-Load
- letzter Sync
- Snapshot-Erstellung und Wiederherstellung
- Audit-Log-Ansicht
- Autosync-Schalter

## Wichtige Dateien
- `server/index.js` – Backend und Dateispeicher
- `src/lib/serverApi.ts` – API-Client im Frontend
- `src/views/PlatformView.tsx` – neue Plattformoberfläche
- `src/App.tsx` – Sync-Logik, Notices und Rechte-Gates
- `src/types.ts` – Server-, Snapshot- und Attachment-Typen

## Start in Bolt
```bash
npm install
npm run dev
```

## Hinweise
- Phase 5 ist bewusst als belastbarer Prototyp aufgebaut.
- Für den Produktivbetrieb sollten Authentifizierung, echte Mandantentrennung, Datenbank, Objekt-Storage, Verschlüsselung, Backup und revisionssichere Protokollierung im nächsten Schritt ergänzt werden.
