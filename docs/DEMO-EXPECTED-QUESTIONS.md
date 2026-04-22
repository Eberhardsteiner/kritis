# Erwartete Demo-Fragen und Antworten

> **Zweck**: Vorhersehbare Fachfragen von KRITIS-Kollegen mit präzisen Kurz-Antworten. Dient Dr. Steiner beim Durchspielen der App als Referenz — faktisch, nicht marketing-haft. Fragen ohne gute Antwort sind ehrlich markiert.

> **Kategorien**: Architektur · Regulatorik · Pack-Inhalte · Operativ · Kritische Fragen.

> **Stand**: C5.4, nach Produktion Healthcare-Pack + Energy-Pack.

---

## 1 · Architektur-Fragen

### Wie funktioniert die Module-Pack-Engine?

Die App hat eine **Engine** (Parser, Validator, Overlay-Merger, State-Adopt-Operators) und beliebig viele **Branchencontainer** (JSON-Dateien). Container werden via File-Upload importiert, validiert gegen ein JSON-Schema, in die Pack-Registry eingetragen, freigegeben und dann in den Modul-Katalog gehoben. Ein Container trägt Fachinhalte (Fragen, Maßnahmen, Evidenzen, Risiko-Templates, Tabletops, Resilienzplan-Template); die Engine weiß, wie sie diese Inhalte konsumiert und an die App-UIs reicht. Neue Branchen brauchen keine Code-Änderung — nur einen neuen Container.

### Wie unterscheidet sich die Engine von einer Branchen-App?

Eine Branchen-App hat den Inhalt hart-kodiert: Jede neue Branche = neuer App-Build, eigene Release-Zyklen, typisch auch eigenes Code-Fork-Repository. Die Module-Pack-Engine trennt **Infrastruktur** (Frontend, Backend, Engine) von **Inhalt** (Container-Dateien). Der UVM-Demo-Fall zeigt das: Healthcare-Pack und Energy-Pack laufen in derselben App-Instanz, werden zur Laufzeit geladen und können gegeneinander ausgetauscht werden, ohne dass die App neu gebaut wird.

### Kann ich einen eigenen Pack schreiben?

Ja. Der Einstieg ist `docs/custom-module-template.json` (generische Vorlage) oder `docs/module-schema.json` (vollständiges JSON-Schema mit allen 18 Fachinhalts-Feldern inkl. der drei C5.1-Felder `riskCatalogTemplates`, `resiliencePlanTemplate`, `tabletopScenarios`). Pack-Autoren füllen die Felder, importieren die Datei über die App, und erhalten Validierungs-Feedback. Die Validierungs-Logik (Server: `server/module-packs.js`, Frontend: `src/lib/moduleRegistry.ts`) prüft Struktur, Enum-Werte, Semver-Formate und Cross-Feld-Konsistenz.

### Wie validiert der Import?

Dreifache Validierung:
1. **JSON-Parse** (syntaktische Gültigkeit)
2. **Schema-Validierung** (alle Pflichtfelder vorhanden, Enum-Werte gültig, Sub-Strukturen konsistent — u. a. `RiskCategoryId`, `ScenarioPhase`, `ResilienceGoal`)
3. **Compatibility-Check** (Container-Version, App-Version-Mindeststand, Engine-Version-Mindeststand)

Fehler werden pro Feldpfad zurückgegeben (z. B. `riskCatalogTemplates[3].categoryId muss einer von nature, technical, human_intentional, … sein`). Zudem schützt ein **Symmetrie-Self-Check-Test** im Test-Harness gegen TS-Type-Drift zwischen Frontend-Types und Engine-Enums.

### Wie funktioniert die Overlay-Logik?

Ein Pack vom Typ `overlay` erweitert einen Basismodul-Pack: id-basierte Listen werden per `mergeById` zusammengeführt (z. B. zusätzliche Fragen, zusätzliche Maßnahmen), skalare Felder werden überschrieben. Das ermöglicht regionale oder länderspezifische Anpassungen (DE-Overlay, AT-Overlay) ohne Duplizierung des Basis-Packs. Die zwei aktuell ausgelieferten Packs (Healthcare, Energy) sind Vollmodule ohne Overlay; das Overlay-Pattern ist vorbereitet, im Demo aber nicht live vorgeführt.

---

## 2 · Regulatorische Fragen

### Deckt das alle KRITIS-Paragraphen ab?

Nicht alle, aber die **Kern-Paragraphen** des KRITIS-Dachgesetzes werden strukturell unterstützt:

- **§ 12** (Risikoanalyse nach All-Gefahren-Ansatz) — über Risiko-Katalog mit sechs Gefährdungs-Kategorien und 5×5-Matrix
- **§ 13** (Resilienzplan mit vier Resilienz-Zielen) — über Resilienzplan-Template mit `measuresByGoal` (prevent/protect/respond/recover)
- **§ 16** (Meldefristen 24 h) — in den Tabletop-Szenarien explizit didaktisch durchgespielt; Meldewegs-Vorlagen werden im Resilienzplan-Template referenziert
- **§ 17** (Unterrichtungspflichten an andere KRITIS-Betreiber) — in Energy-Pack Sz 2 als prototypischer Anwendungsfall eingebaut
- **§ 20** (Bußgeldrahmen bis 1 Mio. Euro) — im BSI-Meldeportal-Risiko (Healthcare) und in Tabletop-Decisions adressiert

**Offen** bzw. nicht direkt abgedeckt:
- § 11 (Verantwortliche Stelle) ist konzeptuell im Resilienzplan-Template verankert, aber nicht als eigenständiges UI-Feature
- § 14 (Registrierung bei BSI) — wird indirekt über Tenant-Settings abgebildet, kein eigener Workflow
- § 15 (Mindestanforderungen an Betreiber) — wird indirekt über Maturity-Profile abgedeckt

### Was passiert bei Novellierung des KRITIS-DachG?

Zwei Pfade, je nach Art der Änderung:

1. **Neuer Paragraph / neue Meldeschwelle**: Pack-Update. Der Pack-Autor schreibt einen neuen Container mit angepassten Feldern (z. B. zusätzlichem Fragen-Template, modifizierter Meldefrist im Resilienzplan), importiert ihn als Version `2.0.0` — die App zeigt alte und neue Version parallel in der Pack-Registry, der Operator entscheidet über Rollout-Zeitpunkt.
2. **Struktureller Regulierungs-Umbau** (z. B. zusätzliche Resilienz-Ziele, neue Gefährdungs-Kategorie): Engine-Update nötig. Das ist dann ein App-Release, kein Pack-Release. In der Demo zeigen wir aktuell nur den Pack-Update-Pfad.

### Wie wird DSGVO-Konformität gewährleistet?

Die App verarbeitet zwei Klassen personenbezogener Daten:
- **Nutzungs-Daten** (Admin-Accounts, Audit-Log) — minimalinvasiv, nur was für Betrieb notwendig
- **Tenant-Inhalte** (Stakeholder-Listen, E-Mail-Adressen in Compliance-Calendar) — der Operator befüllt, der Operator bleibt verantwortlich

Technische Schutzmaßnahmen: Rollen-basierte Permissions (6 Rollen), Audit-Log mit Section-Diff, serverseitiger State-Sanitizer (stripped unbekannte Felder), HttpOnly-Session-Cookies, optionaler OIDC-Login. Die DSGVO-Meldepflicht nach Art. 33/34 ist im Resilienzplan und in Tabletop-Sz 1 (KIS-Ransomware) als Meldeworkflow thematisiert, aber nicht im Tool automatisiert (bewusst: Der Operator muss die DSB-Entscheidung treffen, nicht das Tool).

### Wie passt das zu NIS2 / BSIG §8d?

BSIG §8d (Umsetzung NIS2) verlangt Cyber-Vorfall-Meldungen mit gestaffelten Fristen (24 h / 72 h / 1 Monat). Die App deckt das strukturell ab:
- Risiko-Kategorie `cyber_physical` im All-Gefahren-Ansatz
- Tabletop-Szenarien mit expliziten Meldewegs-Entscheidungen (Sz 1 in beiden Packs)
- Resilienzplan-Template-Sektion `reporting` trägt §8d-Meldefrist-Kette
- BSI-Meldeportal-Ausfall als eigenständiges Risiko im Healthcare-Pack (Risiko 15)

**Nicht abgedeckt**: Automatische Meldung an BSI-Meldeportal. Die App produziert Meldewegs-Vorlagen und Lagebilder; der Operator reicht sie manuell ein.

### Müssen wir einen Pack für jeden regulatorischen Rahmen (KRITISDachG, NIS2, EnWG) schreiben?

Nein. Ein Pack kann **mehrere Regime parallel** referenzieren, das sehen Sie in der C5.3-Analyse: Healthcare-Pack referenziert KRITISDachG, BSIG, DSGVO, IfSG; Energy-Pack referenziert KRITISDachG, BSIG, EnWG. Über das `applicableRegimes`-Feld pro Scenario und die `regulatoryProfile`-Struktur im Tenant-State kann die App mehrere Rahmen gleichzeitig führen.

---

## 3 · Inhaltliche Fragen zu den Packs

### Warum sind in Healthcare die interdependency-Risiken dominant?

Krankenhäuser sind operativ dicht verwoben mit externen Dienstleistern: Wäscherei, Blutspendedienst, Apothekenverbund für Zytostatika, KIS/PACS-Hosting, Medizintechnik-Wartung. Das Healthcare-Pack reflektiert diese Wirklichkeit mit 5 interdependency-Einträgen. Energy ist **technisch anders strukturiert** — der Sektor verlässt sich stärker auf eigene Infrastruktur (Umspannwerke, Leitsystem-Steuerung, Schutztechnik), daher nur 2 interdependency-Einträge, aber 5 technical + 2 cyber_physical.

### Wie realistisch sind die Tabletop-Szenarien?

Die Szenarien sind aus öffentlicher KRITIS-Literatur abgeleitet:
- **Ransomware-auf-KIS**: Referenziert Vorfälle Düsseldorf 2020, Neuss 2021, Schwäbisch Hall 2022, Leipzig 2024 (dokumentiert in KommunalWiki + BSI-Lagebild)
- **Strom+MANV**: Kombiniert typische Kaskaden-Szenarien aus BBK-Bevölkerungsschutz-Publikationen
- **Cyberangriff-Netzleitstelle**: Referenziert Industroyer-Klasse, Sandworm-Attribution, ENISA Threat Landscape 2025
- **Blackout-Kaskade**: Basiert auf europäischen Netzaufspaltungen 2006 und 2021

Die Timeline-Zeitkompression (180 bzw. 150 Minuten simulieren mehrtägige Vorfälle) ist bewusst didaktisch — sie komprimiert Entscheidungs-Weichenstellungen auf Übungs-Zeit.

### Wie wurden die Bewertungen (Eintritt, Auswirkung, Residual) kalibriert?

Quellen-gestützt:
- **Eintrittswahrscheinlichkeit**: BSI-Lagebild + sektorspezifische Statistiken (67 % Gesundheits-Organisationen 2024 mit Ransomware-Vorfällen → KIS-Ransomware E=4; 769 KRITIS-Vorfälle 2024 insgesamt +43 % → höhere Wahrscheinlichkeit in Cyber-Kategorien)
- **Auswirkung**: Patientensicherheits- bzw. Versorgungs-Konsequenzen skaliert (Verlust der kritischen Dienstleistung = A=5; lokale Einschränkung = A=3)
- **Residual**: Nach Maßnahmen-Annahme mit Good-Practice-Standards (BSI IT-SiKat, BDEW-Whitepaper, IEC 62443, ISO 27019). Blackout-Residual > Initial als Ausnahme — physikalische Schwarzstart-Dauer ist nicht durch betreiber-seitige Maßnahmen senkbar.

Die Kalibrierung ist **Template-Vorschlag** — jeder Operator kann nach eigener Lage anpassen. Cross-Reference-Arrays bleiben leer, damit Pack-IDs nicht mit Tenant-IDs kollidieren.

### Wer pflegt die Packs?

In der aktuellen C5-Phase: UVM-interne Redaktion (Dr. Steiner + Mitarbeiter). Mittelfristig vorstellbar:
- **Sektor-Konsortien** (BDEW für Energy, DKG für Healthcare) — Multi-Autor-Pack-Verwaltung mit Versionierung
- **Zertifizierungsstellen** (TÜV, DQS) — als Third-Party-Reviewer
- **BSI / BBK** als fachliche Empfehlungs-Basis

Technisch unterstützt die Pack-Registry mehrere Release-Channels (`core`, `sector`, `overlay`, `custom`) für ein solches gestuftes Modell. **Offen** ist die konkrete Governance-Struktur — das muss in der Pilotphase mit ersten Partnern erarbeitet werden.

### Warum sind die Cross-Referenz-Felder leer?

Pack-Zeit-IDs sind nicht identisch mit Tenant-Zeit-IDs. Ein Risiko-Template kann nicht vorab auf ein `assetId` verweisen, weil die Assets des Tenants erst nach Pack-Import entstehen. Unsere Konvention für Pack 1.0: Cross-Reference-Arrays sind **leer**, der Operator verknüpft nach "Übernehmen" manuell (UI-Hinweis vorhanden). Pack 2.0 könnte symbolische Platzhalter unterstützen (`@template:asset-kis`) — das ist aber für C5 nicht implementiert.

---

## 4 · Operative Fragen

### Wie geht der Betrieb in der Pilotphase?

Aktueller Stand: Der Server läuft lokal (SQLite-Document-Store), Vite-Dev-Server als Frontend. Für einen Pilot-Betrieb mit echtem Tenant:
- **Deployment**: Als Single-Node-Betrieb auf einem Linux-Server; Docker-Container möglich (vorbereitet, aber nicht produktiv ausgerollt)
- **Persistenz**: SQLite reicht für <10 Tenants mit <1M State-Einträgen; darüber hinaus Migration auf PostgreSQL (Adapter geplant, nicht implementiert)
- **Backup**: Tenant-spezifische Snapshots werden ohnehin vom Tool angelegt; zusätzlich muss `server-storage/` in ein Backup-System eingebunden werden

**Offen**: Konkretes SRE-Konzept für den Pilot (Monitoring, Alerting, Incident-Response-SLAs). Das muss mit Pilot-Partnern definiert werden.

### Wie sieht ein Rollout aus?

Typischer Pilot-Rollout:
1. **Woche 1–2**: Installation + Tenant-Anlage + Admin-Onboarding
2. **Woche 3**: Pack-Import (sektor-passend), erste Adoption der Templates
3. **Woche 4–6**: Operator-Nutzung, Maßnahmen anpassen, Risiken bewerten, Evidenz sammeln
4. **Woche 7**: Erste Tabletop-Übung mit dem eingebauten Szenario
5. **Woche 8**: Review + Lessons-Learned, Anpassungen am Pack-Content (Custom-Overlay)

Der technische Rollout ist also **kurz** (Installation + Tenant-Anlage = 1 Tag); die fachliche Pflege (Maßnahmen, Evidenz, Verantwortliche) ist ein Dauer-Prozess.

### Wer schult die Operator?

Das ist in der aktuellen Phase noch nicht systematisch aufgesetzt. Denkbar:
- **Dr. Steiner als Onboarding-Berater** in der Pilotphase (parallel zum Pilot-Support)
- **Self-Service über die Dokumentation** (README, BRANCHEN-ENGINE.md) + die Tabletops selbst als Schulungsmaterial
- **Mittelfristig**: Video-Tutorial oder Online-Schulung mit UVM-Branding

**Offen**: Formales Schulungskonzept für Skalierung > 5 Tenants.

### Gibt es eine API für Integration in bestehende Systeme?

Ja, begrenzt:
- `/api/state` (GET + PUT) für bidirektionalen State-Sync (nutzt das Frontend selbst)
- `/api/modules/registry` (GET) für Pack-Listen-Abfrage
- `/api/health/*` für Monitoring
- `/api/audit-log` (GET) für Audit-Datenabruf
- OIDC-Provider-Einbindung als Auth-Alternative

**API-Client-Permissions**: Vier definierte Scopes (`readiness:read`, `tenant:read`, `exports:read`, `state:read`) via separaten API-Clients.

**Nicht vorhanden**: Webhook-Outbound (App sendet keine Events an Drittsysteme), GraphQL-Schicht, REST-API-Versionierung. Bei konkretem Integrations-Bedarf muss das im Pilot mit dem Partner definiert werden.

### Gibt es einen Export für Audit-Pakete?

Ja, zentral im **Export-Register** sichtbar: Management-Report, Audit-Pack, Formal-Report, State-Snapshot, Zertifizierungs-Dossier, Handover-Bundle. Jeder Export wird signiert archiviert mit Hash-Kette und kann zur externen Prüfung bereitgestellt werden. PDF-/DOCX-Render ist vorhanden; revisionssichere Signaturkette ist in der aktuellen C5-Version **einfach** (Hash-only, keine Zertifikat-basierte Signatur) — das ist ein bewusster Pilot-Trade-off.

---

## 5 · Kritische Fragen

### Was kann die App NICHT?

Präzise Liste (Stand C5.4):
- **Kein automatischer Pull** von externen Feeds (BSI-Lagebild, BfArM-Meldungen, BDEW-Störfallmeldungen). Alle Daten muss der Operator manuell pflegen.
- **Keine Workflow-Engine** für mehrstufige Freigabe-Prozesse (außer dem bestehenden draft/review/approved-Pattern beim Resilienzplan).
- **Keine Mandanten-übergreifenden Berichte** (jeder Tenant ist ein eigener Scope).
- **Keine automatisierte Behörden-Meldung** — die App bereitet Meldungen vor, der Operator reicht manuell ein.
- **Keine Multi-Cloud-Persistenz** (SQLite lokal, Postgres-Adapter geplant, Cloud-First nicht vorgesehen).
- **Keine Mobile-App** — Web-App-only, responsive Design vorhanden, native App nicht.
- **Keine Real-Time-Collaboration** (mehrere Nutzer gleichzeitig im gleichen Tenant-State mit Conflict-Resolution). Der aktuelle State-Sync nutzt optimistisches Locking mit Version-Conflict-Detection.

### Wo sind die bekannten Grenzen?

- **Skalierung**: SQLite-Dokumentstore ist bis ~50 Tenants × 1 M State-Einträge stabil; darüber hinaus gemessene Performance-Degradation. Postgres-Adapter als Upgrade-Pfad geplant.
- **Pack-Größe**: Aktuell getestet bis ~1.500 Zeilen JSON pro Pack (Healthcare-Pack). Theoretische Obergrenze ~20 MB per JSON-Limit, praktisch problemlos bis 3–5 MB.
- **Tenant-Wechsel-Performance**: Bei Tenants mit sehr großem State (> 10 k Einträge in einer Sektion) ist der Frontend-Re-Render beim Mandanten-Wechsel > 1 Sekunde spürbar.
- **Browser-Support**: Moderne Browser (Chrome 98+, Firefox 94+, Safari 15.4+). IE11 nicht unterstützt.

### Welche KRITIS-Features fehlen noch?

Gemäß der internen Feature-Landkarte:
- **KRITIS-Dachgesetz § 11 Abs. 1b** (Meldepflicht-Integration direkt an BSI-Portal) — geplant Pilot-Phase
- **KRITIS-Dachgesetz § 15** (Mindestanforderungen an Betreiber) — strukturell abdeckbar, UI-Gestaltung offen
- **NIS2 Art. 21 Abs. 4** (Incident-Registration-Workflow mit eindeutiger Vorfall-ID) — geplant
- **ESG-Resilienz-Reporting** (Nachhaltigkeitsberichte verlangen zunehmend Resilienz-Daten) — geplant, nicht prioritär

### Wie reif ist das Produkt?

Ehrlich: **Pilot-reif, nicht Produkt-reif.**

Vorhandene Reife:
- Architektur stabil (getestete Backend-State-Persistenz, typisierte Frontend-Pipeline, 83 Server-Tests, 368 Vitest-Tests, 17 E2E-Tests)
- Zwei Sektor-Packs mit inhaltlicher Tiefe (je 15 Risiken, je 2 Tabletops, je 14 Resilienzplan-Maßnahmen)
- Grundlegende DSGVO-/Audit-Funktionalität

Lücken für Produkt-Reife:
- Monitoring + SRE noch nicht produktiv
- Skalierungs-Adapter (Postgres) noch nicht implementiert
- Formale Schulungs- und Support-Struktur nicht aufgesetzt
- Produkt-Marketing-Material (Website, Vertriebs-Dokumentation) nicht erstellt

Die UVM-Demo zeigt die Pilot-Reife. Ein produktiver Einsatz in einem realen KRITIS-Betreiber ist **nach einer Pilotphase** möglich, nicht unmittelbar.

### Wie unterscheidet sich das von Excel-Tabellen?

Zentrale Unterschiede:
- **Typisierung**: Jedes Feld hat definierten Datentyp, Enum-Werte werden erzwungen, Cross-Feld-Konsistenz ist geprüft. Excel erlaubt beliebigen Inhalt.
- **Versionierung**: Jeder State-Wechsel wird versioniert mit Audit-Trail, inkl. Sections-Diff für Nachvollziehbarkeit. Excel-Dateien werden üblicherweise per Dateinamen-Suffix versioniert.
- **Rollen-Kontrolle**: Sechs Rollen mit feldbezogenen Permissions. Excel hat nur Dateifreigaben.
- **Pack-Updates**: Strukturierte Updates auf Template-Ebene bei KRITIS-Novellierungen. Excel-Templates werden manuell aktualisiert.
- **Export-Signatur**: Exports werden mit Hash-Kette archiviert. Excel bietet nativ keine revisionssichere Signatur.

Der Demo-Punkt: Excel erlaubt 90 % der KRITIS-Dokumentation — die letzten 10 % (Nachvollziehbarkeit, strukturelle Updates, revisionssichere Nachweise) sind die Professionalisierung, die diese Engine leistet.

### Gibt es vergleichbare Produkte am Markt?

Ja, mehrere:
- **GRC-Suiten** (OneTrust, RSA Archer, SAP GRC) — umfassend, aber sektor-generisch ohne KRITIS-spezifische Taxonomie
- **Sektor-Tools** (einige Klinikverbands-Tools für IT-Sicherheit im Gesundheitswesen) — sektor-spezifisch, aber nicht cross-sektoral
- **In-House-Entwicklungen** bei größeren KRITIS-Betreibern — hoher Custom-Aufwand, nicht community-fähig

Unser Ansatz: **Cross-sektoral über Pack-Engine, KRITIS-spezifisch über Content-Tiefe, Community-fähig über offenes Pack-Format.** Das positioniert uns **zwischen** GRC-Suite und Sektor-Tool.

**Offen**: Konkreter Markt-Benchmark mit Feature-Vergleichstabelle ist nicht erstellt. Für seriöse Vertriebs-Kommunikation nötig.

---

## 6 · Notiz für Dr. Steiner

Diese Q&A-Liste ist absichtlich **faktisch und restriktiv**. Ehrlichkeit bei „offenen" oder „nicht vorhandenen" Funktionen ist strategisch richtig:
- UVM-KRITIS-Fachleute erkennen Marketing-Sprech sofort
- Pilot-Konversionen profitieren von realistischen Erwartungen
- Die Lücken-Liste ist gleichzeitig die Roadmap für Pilot-Gespräche

Falls in der Demo Fragen auftauchen, die hier nicht abgedeckt sind: **„Das muss ich im Pilot-Gespräch vertiefen" oder „Da bin ich aktuell offen — lassen Sie uns nach der Demo konkret sprechen"** sind legitime Antworten. Nichts ist schädlicher als eine fundierte Frage mit einer halbfertigen Antwort zu beantworten.
