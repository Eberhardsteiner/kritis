# Phase 8

## Schwerpunkt

Phase 8 überführt die App von einer funktionsreichen Arbeitsumgebung in eine steuerbare Programm- und Freigabeplattform. Im Mittelpunkt stehen Transparenz über den Ausbauzustand, revisionssichere Exportpakete und ein belastbarer Dossier-Workflow für die KRITIS-Strecke.

## Umgesetzt

- neuer Bereich **„Programm & Sprints“**
- sichtbare Zuordnung aller Phasen zu Sprints
- serverseitiges **Exportregister** mit JSON-Paketen, Prüfsumme und Downloadstrecke
- **Freigabelogik** für Berichtspakete
- **Zertifizierungsdossiers** im KRITIS-Bereich
- **Mandantenrichtlinien** für Aufbewahrung, Reviewzyklen, Standardklassifikation und Freigabepflichten
- erweiterter Plattform-Bereich mit Exportspur und Freigabeaktionen
- Versionserhöhung auf **0.8.0**

## Fachlicher Nutzen

- Management und Projektleitung sehen sofort, in welchem Sprint sich der Ausbau befindet.
- Berichts- und Auditpakete werden serverseitig nachvollziehbar registriert.
- KRITIS-Dossiers lassen sich vorbereiten, freigeben und reproduzierbar herunterladen.
- Mandantenbezogene Grundregeln für Evidenzen und Freigaben sind nicht mehr nur implizit, sondern administrierbar.

## Testempfehlung in Bolt

1. App starten und den Bereich **„Programm & Sprints“** öffnen
2. im Bereich **„Reporting“** ein Managementpaket und ein Auditpaket registrieren
3. im Bereich **„Plattform & Sync“** die neuen Einträge im Exportregister prüfen
4. eine Freigabenotiz setzen und ein Paket freigeben
5. im Bereich **„KRITIS-Readiness“** ein Zertifizierungsdossier anlegen und herunterladen
6. Mandantenrichtlinien anpassen und prüfen, ob neue Evidenzen die geänderten Standardwerte übernehmen
