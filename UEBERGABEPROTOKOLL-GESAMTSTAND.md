# Vollständiges Übergabeprotokoll – Gesamtstand der KRITIS-Readiness App

## 1. Zweck dieses Dokuments

Dieses Dokument dient als formale Übergabe des bisherigen Gesamtstands. Es beschreibt:
- das Ziel des Produkts
- den fachlichen und technischen Ist-Stand
- die bisher umgesetzten Phasen, Sprints und Produktpakete
- die offene Restarbeit
- die empfohlene Reihenfolge und Bearbeitungsweise der verbleibenden Phasen

## 2. Zielbild des Produkts

Ziel ist eine **mandantenfähige, modular erweiterbare KRITIS-Readiness-Plattform**, mit der Unternehmen ihre Krisenfestigkeit strukturiert bewerten, dokumentieren, nachweisen und regulatorisch einordnen können.

Das Produkt soll dabei **nicht** als fest verdrahtete Branchen-App gebaut werden, sondern als **Engine mit standardisiertem Inhalts- und Branchencontainer**. Neue Branchen, Overlays und regulatorische Regime sollen über definierte JSON-Strukturen eingebracht werden können, ohne die Kernlogik jedes Mal neu zu schreiben.

Das fachliche Zielbild umfasst insbesondere:
- Resilienzbewertung über strukturierte Domänen und Fragen
- Maßnahmen-, Evidenz- und Auditsteuerung
- BIA, Szenarien, Übungen und Lessons Learned
- Governance, Assets, Standorte, Stakeholder und Dokumente
- KRITIS-Readiness mit regulatorischen Regimen für DACH
- Mandanten-, Rollen- und Authentifizierungslogik
- exportierbare Berichte, Dossiers und Prüfpfade

## 3. Aktueller technischer Systemstand

Abschlusstand dieses Übergabeprotokolls:
- **Produktpaket P3**
- **Version 2.0.1**

Technische Kennzahlen des aktuellen Stands:
- `src/App.tsx`: **5.149 Zeilen**
- `server/index.js`: **4.726 Zeilen**
- `src/views`: **13 Views**
- `src/components`: **12 Komponenten**
- `server/*.test.js`: **8 serverseitige Testdateien**
- API-Endpunkte unter `/api`: **57**
- eingebaute Container-Packs: **4**
- Legacy-Module zur Rückwärtskompatibilität: **4**

Prüfstatus zum Übergabezeitpunkt:
- `npm test`: **37/37 Tests grün**
- `npm run build`: erfolgreich

## 4. Was bisher umgesetzt wurde

## 4.1 Phase 1 bis 10 – fachliches Fundament

### Phase 1
- Grundgerüst der App
- Grundanalyse, Basis-Scoring, erste Branchenlogik
- erster KRITIS-Bereich

### Phase 2
- Maßnahmenmanagement
- Nachweis- und Evidenzmanagement
- erweiterte Analyse- und Reportlogik

### Phase 3
- Governance-Bereich
- Stakeholder, Standorte, kritische Assets
- Soll-Ist-Benchmark und Auditlogik

### Phase 4
- Rollenoberfläche
- Compliance-Kalender
- Dokumentenbibliothek
- PDF-Exporte

### Phase 5
- Express-Backend
- Uploads, Snapshots, Audit-Log
- erste Sync- und Plattformfunktionen

### Phase 6
- Sitzungen, Mandanten, Konten
- Dokumentversionierung
- Grundlage für Mehrmandantenbetrieb

### Phase 7
- offener Arbeitsbereich ohne Pflichtanmeldung
- BIA, Prozesse, Abhängigkeiten, Szenarien, Übungen

### Phase 8
- Programm- und Sprintsicht
- Exportregister
- Freigabeworkflows
- Zertifizierungsdossiers

### Phase 9
- Betrieb & APIs
- Systemprofil, API-Clients, Jobs
- Hosting-Readiness

### Phase 10
- Go-Live & Übergabe
- Rollout-Plan
- Härtungschecklisten
- Runbooks und Release-Gates

## 4.2 Sprint I bis O – Produktivierung und Stabilisierung

### Sprint I
- Sicherheitsbasis
- schreibgeschützter anonymer Modus
- Rollenabsicherung im Backend
- Upload-Allowlist und einfache Sicherheitsmaßnahmen

### Sprint J
- Test- und Engineering-Basis
- Backend-Tests, Frontend-Testbasis, CI-Grundlage

### Sprint K
- SQLite-Dokumentenspeicher als bevorzugte Persistenz
- Optimistic Locking
- härtere Mandantengrenzen in der Persistenz

### Sprint L
- Pack-Registry für Module und Overlays
- Container- und Overlay-Versionierung
- optionale Supabase-REST-Persistenz

### Sprint M
- getrennte Deutschland-Regime
- KRITIS-Dachgesetz und BSIG/NIS2 sauber getrennt

### Sprint N
- DACH-Overlays
- Deutschland, Österreich und Schweiz
- jurisdiktionsabhängige Fristen, Checklisten und Reports

### Sprint O
- Hardening, Telemetrie, Restore-Drills, Security Gates
- Live-/Ready-Probes
- Request-Härtung und Observability-Basis

## 4.3 Produktpakete

### Produktpaket P1
- Umstellung auf eine **Branchen-Engine**
- standardisiertes **Containerformat** für Brancheninhalte
- erstes belastbares **Industrie-Kernmodul**
- Basis für weitere Branchencontainer und Overlays

### Produktpaket P2
- produktive Identitätsarchitektur
- lokale Konten plus **OIDC-SSO**
- PKCE, State, Callback-Ticketing
- Rollen-, Mitgliedschafts- und Tenant-Zuordnung

### Produktpaket P3
- austauschbare Objektablage
- vorbereitete Cloud-Objektablage
- Retention- und Review-Logik für Evidenzen
- Speicher- und Lebenszyklusbezug in Plattform und Ledger

## 5. Was das System heute bereits kann

Das System ist heute ein **fachlich breiter Pilot-/Staging-Stand**.

Es kann bereits:
- Unternehmen entlang mehrerer Resilienzdimensionen bewerten
- Maßnahmen und Evidenzen verwalten
- Audit- und Nachweisstrecken abbilden
- BIA, Szenarien und Übungen führen
- Branchen über Containerstrukturen laden
- regulatorische Profile für DACH abbilden
- Rollen, Mandanten und Authentifizierungsarten verwalten
- Uploads, Snapshots, Reports und Dossiers erzeugen
- Evidenzen mit Speicher- und Retentionssicht bewerten

## 6. Was ausdrücklich noch nicht als endgültig produktionsreif gilt

Trotz des breiten Funktionsumfangs ist die Anwendung noch nicht an dem Punkt, an dem sie ohne weitere Arbeit als endgültige Produktionsplattform gelten sollte.

Die wichtigsten Gründe dafür sind:
- sehr große Zentraldateien im Frontend und Backend
- keine vollständige aktive Browser-E2E-Strecke im gelieferten Paket
- noch offene Dependency-Themen
- Cloud-Storage und produktive Plattformpfade nur vorbereitet, nicht als vollständiger Live-Betrieb abgeschlossen
- noch keine endgültige Betriebs- und Rolloutstruktur für reale Kundeneinführung

## 7. Offene Punkte und technische Schulden

### Architektur
- `src/App.tsx` ist zu groß und muss zerlegt werden
- `server/index.js` ist zu groß und muss in Domänenmodule getrennt werden
- API-, Auth-, Storage-, Reporting- und Regulatory-Logik sollten klarer entkoppelt werden

### Test und Qualität
- Frontend-Tests müssen wieder aktiv ausgebaut werden
- Browser-Smoke- und E2E-Strecken müssen stabil in den Regelbetrieb
- Build- und Qualitätsgates müssen erweitert werden

### Betrieb
- echtes Zielhosting und Deployment-Topologie fehlen noch
- externe Observability fehlt noch
- Secret-Management, produktive Restore-Prozesse und Umgebungsprofile müssen finalisiert werden

### Daten und Speicher
- Supabase-Storage ist vorbereitet, aber noch nicht als finaler Live-Standard verdrahtet
- Objektablage, DB und Mandantenrichtlinien müssen in einem Produktivprofil endgültig zusammengeführt werden

### Security / Dependencies
- lokaler Auditstand nach Abschluss: **7 bekannte Paketmeldungen**, keine kritische Meldung mehr
- insbesondere `express`, `vite` und transitive Abhängigkeiten müssen im nächsten Paket weiter bereinigt werden

## 8. Welche Phasen noch anstehen

### 8.1 Formal aus dem aktuellen Plan offen

**Produktpaket P4** ist die noch offene formale Restphase des aktuellen Produktplans.

### 8.2 Empfohlene Folgepakete nach P4

Nach P4 empfehle ich zwei weitere Umsetzungsphasen, damit aus dem sehr guten Staging-Stand ein belastbares Produkt wird:

- **Produktpaket P5 – Produktionsplattform**
- **Produktpaket P6 – Pilotbetrieb und Rollout**

## 9. Wie die verbleibenden Phasen bearbeitet werden sollen

## 9.1 Produktpaket P4 – Refactoring und Pilotfreigabe

### Ziel
Die Codebasis wartbar, testbar und pilotfähig machen.

### Inhalt
- Zerlegung von `App.tsx` in fachliche Feature-Module
- Zerlegung von `server/index.js` in API-, Auth-, Storage-, Reporting- und Regulatory-Module
- Wiederaufbau und Ausbau der Frontend-Teststrecke
- Rückführung einer stabilen Browser-Smoke-/E2E-Strecke
- Dependency-Bereinigung und Update-Runde
- Code-Splitting und erste Performance-Bereinigung
- Pilotfreigabe-Dokumente und UAT-Paket

### Abnahmekriterien
- zentrale Großdateien deutlich reduziert
- CI baut stabil und testet Frontend und Backend
- Pilot-Durchlauf für mindestens einen Mandanten komplett möglich
- keine kritischen oder hohen, unbehandelten Paketrisiken im Kernpfad

## 9.2 Produktpaket P5 – Produktionsplattform

### Ziel
Die Plattform technisch in einen echten Betriebsmodus überführen.

### Inhalt
- finale Anbindung von produktiver Datenbank und Objektablage
- Secret-Management je Umgebung
- echtes SSO mit realem IdP im Staging-/Produktivprofil
- produktive Umgebungsprofile und Konfigurationspfade
- externe Observability und Alarme
- Backup-/Restore-Automatisierung
- finale Mandanten- und Rollenrichtlinien

### Abnahmekriterien
- Produktivprofil läuft außerhalb von Bolt stabil
- Datenbank und Objektablage sind live und tenant-sicher verdrahtet
- Restore-Prozess ist nachweisbar
- SSO für Pilotkunden ist funktionsfähig

## 9.3 Produktpaket P6 – Pilotbetrieb und Rollout

### Ziel
Ersten Kundeneinsatz und geregelte Übergabe ermöglichen.

### Inhalt
- Pilotmandant aufsetzen
- Datenübernahme- und Importpfade klären
- UAT-Protokolle und Pilot-Feedback-Schleife
- Betriebsdokumentation, Supportpfade und Verantwortlichkeiten
- Release- und Rolloutmodell
- Schulungs- und Übergabeunterlagen

### Abnahmekriterien
- ein Pilotkunde kann einen vollständigen Arbeitszyklus stabil durchführen
- Betriebsrollen und Supportpfade sind klar geregelt
- fachliche und technische Übergabe an Betrieb und Produktverantwortung ist dokumentiert

## 10. Empfohlene unmittelbare Reihenfolge

Die nächsten Schritte sollten in genau dieser Reihenfolge erfolgen:

1. **P4 starten**
2. große Dateien zerlegen und Testbasis ausbauen
3. Dependency-Risiken weiter reduzieren
4. Pilotfreigabe herstellen
5. danach **P5** mit produktiver Plattformanbindung
6. danach **P6** mit Pilotbetrieb und Rollout

## 11. Was in der nächsten Bearbeitungsrunde nicht passieren sollte

Nicht sinnvoll wäre jetzt:
- weitere Fachoberflächen ohne Refactoring aufzubauen
- neue Branchenmodule ohne saubere Test- und Wartungsbasis hineinzuschieben
- die App bereits als endgültig produktionsreif zu behandeln
- produktive Kundennutzung auf dem aktuellen Bolt-Stand aufzusetzen

## 12. Übergabeentscheidung

Der bisherige Projektstand wird mit diesem Dokument wie folgt übergeben:

- **fachlich breit und belastbar als Staging-/Pilotbasis**
- **P3 sauber abgeschlossen**
- **Branchen-Engine, OIDC-Basis und Evidenzplattform vorhanden**
- **Restarbeit klar abgegrenzt auf P4, P5 und P6**

Damit ist der Stand nicht nur dokumentiert, sondern auch so strukturiert, dass eine nächste Entwicklungsrunde ohne Orientierungsverlust anschließen kann.
