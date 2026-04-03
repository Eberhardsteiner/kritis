# Phase 4 – Notizen

Version: 0.4.0

## Schwerpunkt dieser Phase
- Rollen- und Rechtebereich mit Nutzerprofilen
- aktives Arbeitsprofil im Topbar
- Steuerungsansicht für Compliance-Kalender, Dokumentenbibliothek und Fristen-Cockpit
- erweiterte Nachweisbibliothek mit Ordnern, Tags, externer ID, Gültigkeit und Review-Zyklus
- PDF-Exporte für Management Report und Audit Pack
- aktualisierte JSON-Containerlogik für Dokumentenordner und Evidenz-Metadaten

## Neue Kernbereiche
### 1. Steuerung & Rechte
- Nutzerverwaltung mit Rollenprofilen:
  - Programmadmin
  - Programmleitung
  - Fachbearbeitung
  - Review / Freigabe
  - Audit / Prüfung
  - Leser
- Rechte-Matrix als transparente Referenz
- automatische Nutzerableitung aus Stakeholdern

### 2. Compliance-Kalender
- KRITIS-Registrierung
- letzte Risikoanalyse
- letzte Aktualisierung Resilienzplan
- letzter IT-/BSI-Nachweis bzw. Audit
- Meldekontakte

### 3. Dokumentenbibliothek
- Dokumentenordner
- Tags
- externe Dokument-ID
- Review-Datum
- Gültig-bis-Datum
- Review-Zyklus in Tagen
- lokale Dateianhänge für den Prototyp

### 4. Reporting
- Management-PDF
- Auditpack-PDF
- vorhandene CSV- und HTML-Exporte weiter nutzbar

## Technische Hinweise
- Build lokal erfolgreich geprüft
- `jspdf` ist als neue Abhängigkeit enthalten
- `.npmrc` verweist auf die öffentliche npm-Registry
- das Paket enthält bewusst kein problematisches Lockfile aus einer internen Registry

## Start in Bolt
```bash
npm install
npm run dev
```

## Build-Test
```bash
npm run build
```

## Sinnvolle Prüfschritte in Bolt
1. aktives Arbeitsprofil oben wechseln
2. Bereich „Steuerung & Rechte“ öffnen
3. Nutzer anlegen und aus Stakeholdern generieren
4. Compliance-Termine pflegen
5. in „Maßnahmen & Bibliothek“ Ordner, Tags, Review- und Gültigkeitsdaten prüfen
6. im Reporting Management-PDF und Auditpack-PDF exportieren
