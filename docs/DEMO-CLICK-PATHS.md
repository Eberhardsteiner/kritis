# Demo-Klick-Pfade und Zeit-Budgets

> **Zweck**: Strukturelle Dokumentation der wichtigsten Klick-Pfade für die UVM-Demo des KRITIS-Readiness-Packs. Dient Dr. Steiner als Referenz beim Durchspielen der App. Keine narrative Storyline — die eigentliche Präsentations-Dramaturgie entwickelt er selbst.

> **Stand**: C5.4 (nach Produktion Healthcare-Pack + Energy-Pack). Gültig für die in C5.1–C5.3b gelandete App-Struktur.

---

## 1 · Vorbereitung

### Reset-Skript verwenden

Zwischen Demos:

```bash
# Variante A · leerer Start, Demo zeigt Tenant-Anlage
npm run demo:reset:fresh

# Variante B · vorbereiteter Tenant bereits da, Demo überspringt Tenant-Anlage
npm run demo:reset:ready
```

Das Reset-Skript stoppt den Server, räumt den Storage, startet den Server neu und wartet bis `/api/health/live` antwortet. Typische Laufzeit: **12–20 Sekunden**.

### Baseline einmalig vorbereiten (für `--demo-ready`)

```bash
# 1. Server starten
npm run dev

# 2. App öffnen (http://localhost:5173), Admin einloggen, Demo-Tenant anlegen
#    (Klinikverbund Donau-Ries gGmbH), Admin-Profil konfigurieren,
#    KEINE Packs importieren.

# 3. Server stoppen (Ctrl+C im npm-run-dev-Terminal)

# 4. Baseline einfrieren
npm run demo:capture-baseline
```

Danach steht `--demo-ready` zur Verfügung. Der erzeugte Ordner `demo-ready-baseline/` kann via Git committed oder lokal in `.gitignore` gehalten werden — Operator-Entscheidung.

### Login-Credentials

- **E-Mail**: `admin@krisenfest.demo`
- **Passwort**: `Krisenfest2026!`
- **Login-Pfad**: Sidebar → **Plattform & Sync** → Sektion **Optionaler Login**
- **Mandant**: Nach Seed automatisch vorhanden (`demo-unternehmen` oder der in der Baseline gesicherte Tenant)

Diese Credentials sind durch `seedDemoAdminIfMissing()` in `server/services/storage-init.js` **bei jedem Server-Start idempotent gesichert**. Sie überleben jedes `--fresh`- und `--demo-ready`-Reset und lassen sich durch einen Restart auf Default zurücksetzen, falls sie manuell geändert wurden. Detail-Doku: `docs/DEMO-ZUGANG.md`.

Legacy-Zugang (optional, wenn nicht explizit benötigt): `admin@krisenfest.local` mit demselben Passwort — nur beim initialen Fresh-Seed vorhanden, nicht idempotent re-seeded.

---

## 2 · Klick-Pfade im Detail

Die Pfade sind in Demo-Reihenfolge sortiert. Jeder Pfad folgt diesem Schema:

- **Navigation**: Sidebar-Klick oder UI-Interaktion
- **Vorbedingung**: Was muss vorher passiert sein
- **Dauer**: Klick bis sichtbares Ergebnis (Sekunden)
- **Sichtbar**: Welche UI-Elemente erscheinen, was zeigt sich im DOM
- **Stolperstein**: Typische Klippen (Debounce, Permission, Loading-Zustand)

---

### Pfad 1 · Login als Admin

**Navigation**: Sidebar → "Plattform & Sync" → Login-Formular ausfüllen → "Lokal anmelden"

**Vorbedingung**: Server läuft, Admin-Account ist geseedet (bei `--fresh` läuft der Seed automatisch beim ersten Server-Start)

**Dauer**: 3–5 Sekunden (Form-Submit + Auth-Response + Session-Hydration)

**Sichtbar**:
- Topbar zeigt "Konto: admin@krisenfest.local"
- Arbeitsprofil-Dropdown umschaltet automatisch auf "Programmadmin"
- "Abmelden"-Button erscheint im Login-Bereich
- Server-Modus-Anzeige wechselt auf "Server verbunden"

**Stolpersteine**:
- "Lokal anmelden"-Button ist kurz disabled, bis der Auth-Bootstrap-Call die verfügbaren Provider geladen hat — 1–2 Sekunden warten
- Falls Server nicht erreichbar: Status-Badge zeigt "Offline" statt "Server verbunden"

---

### Pfad 2 · Neuen Tenant anlegen (Klinikverbund Donau-Ries)

**Navigation**: Sidebar → "Steuerung & Rechte" → Abschnitt "Mandanten" → "Mandant hinzufügen"

**Vorbedingung**: Login als Admin (Pfad 1), Serverrolle hat System-Admin-Rechte

**Dauer**: 5–10 Sekunden (Form + Server-Anlage + Registry-Refresh)

**Sichtbar**:
- Dialog oder Inline-Formular mit Feldern Name, Slug, Branche, Deployment-Stage
- Nach "Speichern" erscheint der neue Mandant in der Mandanten-Liste
- Audit-Log erhält neuen Eintrag "Mandant angelegt"

**Stolpersteine**:
- Slug wird automatisch aus dem Namen abgeleitet (sonderzeichenbereinigt) — bei "Klinikverbund Donau-Ries gGmbH" entsteht `klinikverbund-donau-ries-ggmbh`, im Demo-Kontext eventuell kürzer setzen
- Bei Wahl eines bereits vergebenen Slugs erscheint Fehlermeldung erst nach Server-Roundtrip

**Überspringen wenn**: `--demo-ready`-Modus verwendet wurde (Tenant ist bereits vorhanden)

---

### Pfad 3 · Pack-Registry aufrufen + Healthcare-Pack importieren

**Navigation**: Sidebar → "Branchenmodule" → Sektion "Container oder Legacy-JSON importieren" → File-Upload

**Vorbedingung**: Login als Admin (Pfad 1), Rolle mit `modules_manage`-Permission

**Dauer**:
- File-Upload lokal: **<1 Sekunde**
- Server-Import + Validierung: **1–3 Sekunden**
- Registry-Anzeige-Refresh: **~500 ms**
- **Gesamt: 2–5 Sekunden** vom Datei-Auswahl-Klick bis zum sichtbaren Registry-Eintrag

**Sichtbar**:
- Success-Notice "Paket 'Gesundheits-Basismodul' wurde in die serverseitige Pack-Registry aufgenommen"
- Details-Liste zeigt Format (Container), Typ (Branchenmodul), Status (Entwurf)
- Neuer Registry-Eintrag in der "Pack-Registry"-Sektion am Ende der Seite
- Noch **keine** neue Modul-Karte in "Verfügbare Module" (erst nach Freigabe)

**Stolpersteine**:
- File-Input ist optisch verborgen hinter dem "Container oder Legacy-JSON importieren"-Label — darauf klicken, nicht danach suchen
- Der Pack wird zunächst als **Entwurf** (`draft`) importiert — **nicht aktiv** bis zum Freigabe-Klick
- Success-Toast verschwindet nach ~8 Sekunden; der Registry-Eintrag bleibt sichtbar

**Ziel-Datei**: `src/module-packs/healthcare-core.container.json` (1.309 Zeilen)

---

### Pfad 4 · Pack aktivieren (Status draft → released)

**Navigation**: Sidebar → "Branchenmodule" → Sektion "Pack-Registry" → Healthcare-Entry → "Freigeben / Rollback"-Button

**Vorbedingung**: Pfad 3 (Pack importiert, Status `draft`)

**Dauer**: 1–2 Sekunden (Server-Write + Response)

**Sichtbar**:
- Status-Label wechselt von "Entwurf" auf "Freigegeben"
- Button-Label wechselt auf "Aktiv"
- Neue Modul-Karte erscheint in der "Verfügbare Module"-Sektion oben
- Anzahl "Wirksame Module" in der Section-Heading erhöht sich um 1
- Audit-Log-Eintrag "Modul-Pack freigegeben"

**Stolpersteine**:
- Nach Freigabe ist das Modul noch **nicht aktiv** — das ist eine separate Auswahl-Aktion (Pfad 5)
- Falls noch eine alte Version desselben Packs als `released` existiert, wechselt diese auf `superseded` (automatisch)

---

### Pfad 5 · Modul aktivieren (Tenant-Modul-Auswahl)

**Navigation**: Topbar → "Aktives Modul"-Dropdown → "Gesundheit & Krankenhaus" auswählen

**ODER**: Sidebar → "Branchenmodule" → Modul-Karte "Gesundheit & Krankenhaus" anklicken

**Vorbedingung**: Pfad 4 (Pack freigegeben, Modul in Liste sichtbar)

**Dauer**: 1–2 Sekunden (State-Update + Server-Sync)

**Sichtbar**:
- Karte erhält `selected`-Class + Checkmark-Icon
- Topbar-Dropdown zeigt "Gesundheit & Krankenhaus" als selected
- Section "Ausgewähltes Branchenprofil" aktualisiert Inhalt auf Gesundheitsmodul
- **Adopt-Panel** erscheint unterhalb des "Ausgewähltes Branchenprofil"-Blocks

**Stolpersteine**:
- Dropdown und Karten-Klick referenzieren dieselbe State-Property `selectedModuleId` — ein Klick an einer Stelle spiegelt sich an der anderen
- Nach Modulwechsel triggert der Server-Sync die 900-ms-Debounce-Schleife — Folgeaktionen sollten 1–2 Sekunden warten

---

### Pfad 6 · Adopt-Panel öffnen + "Alle Templates übernehmen"

**Navigation**: Sidebar → "Branchenmodule" → scroll zu "Branchen-Inhalte übernehmen"-Card → "Alle Templates übernehmen"-Button

**Vorbedingung**: Pfad 5 (Modul aktiv ausgewählt, Adopt-Panel sichtbar)

**Dauer**:
- Klick auf Master-Button: **<100 ms** (reiner UI-Click)
- Copy-Operator + setState: **<100 ms**
- pushStateToServer (Sync): **200–500 ms** Netzwerk-Latenz
- applyRemoteState + Re-Render: **<200 ms**
- **Gesamt: 0,5–1 Sekunde** bis Success-Notice

**Sichtbar**:
- Notice-Toast "Alle Templates aus 'Gesundheit & Krankenhaus' übernommen. X Risiko-Einträge hinzugefügt · Resilienzplan übernommen · Y Tabletop-Szenarios hinzugefügt"
- Adopt-Panel bleibt sichtbar mit enabled Buttons (wiederholte Adopt-Aktionen möglich)
- Audit-Log-Eintrag "Synchronisierung" mit sections-Liste: `['riskEntries', 'resiliencePlan', 'archivedResiliencePlans', 'importedTabletopScenarios']`

**Stolpersteine**:
- Master-Button ist disabled, wenn Modul keine Templates enthält (z. B. noch für nicht-C5.3-Kern-Module)
- Button fordert `governance_edit` UND `kritis_edit`; im Admin-Profil beide vorhanden
- Nach Klick erscheint Toast kurz — Demo-Moment nutzen, bevor Toast verschwindet

---

### Pfad 7 · Risikomatrix-View mit 15 Templates

**Navigation**: Sidebar → "KRITIS-Readiness" → Jurisdiktion DE + KRITISDachG-Scope "in_scope" setzen → scroll zu "All-Gefahren-Risikokatalog"

**Vorbedingung**: Pfad 6 (Templates adoptiert, `state.riskEntries.length > 0`)

**Dauer**: 
- Navigation + View-Render: **500–800 ms** (Lazy-Import der View)
- Scope-Einstellungen: **2x State-Update à 200 ms**
- Scroll zu Risikokatalog: **<300 ms**
- **Gesamt: 2–3 Sekunden** bis Matrix mit Einträgen sichtbar

**Sichtbar**:
- 5×5-Matrix mit 25 Zellen (Eintritt 1–5 × Auswirkung 1–5)
- Zellen gefüllt entsprechend der 15 Healthcare-Risiken (z. B. KIS-Ransomware bei Zelle 4×5)
- Zellzähler je Zelle (1, 2, 3 Einträge)
- Risk-Register darunter mit Titel + Kategorie + Bewertung jeder Zeile
- Export-Buttons JSON + DOCX oben rechts

**Stolpersteine**:
- Jurisdiktion und Scope-Status müssen korrekt gesetzt sein, sonst wird der Risikokatalog-Block eingeklappt
- Bei großen Listen (15 Einträge) ist keine Pagination nötig — alle sichtbar
- Matrix-Zellen sind anklickbar → filtern auf ausgewählte Zelle; für Demo aber meist als statische Übersicht belassen

---

### Pfad 8 · Resilienzplan-View mit adoptiertem Plan

**Navigation**: Sidebar → "Resilienzplan"

**Vorbedingung**: Pfad 6 (Plan adoptiert, `state.resiliencePlan !== null`)

**Dauer**: 500–1200 ms (View-Lazy-Load + Plan-Deserialize)

**Sichtbar**:
- Header "Version 1.0.0 · Entwurf" mit Statusanzeige
- Drei Tabs: "Vorschau" (default), "Editor", "Versionshistorie"
- **Vorschau-Tab**: Strukturierte Anzeige aller 6 Sektionen (Scope, Risikobasis, Maßnahmen nach 4 Zielen, Governance, Meldewesen, Nachweise)
- Operator-Name "Klinikverbund Donau-Ries gGmbH" in Scope-Sektion sichtbar
- 14 Maßnahmen in measuresByGoal sichtbar (je Ziel aufklappbar)
- Export-Buttons JSON, DOCX, PDF oben rechts

**Stolpersteine**:
- Default-Tab ist "Vorschau"; falls "Editor" sichtbar sein soll, explizit Tab-Klick
- Plan-Status-Workflow (draft → review → approved → archived) wird in der Demo nicht traversiert — bleibt auf `draft`
- PDF-Export dauert 2–4 Sekunden (jspdf rendert)

---

### Pfad 9 · Tabletop-Library mit adoptierten Szenarien

**Navigation**: Sidebar → "Tabletop-Übungen"

**Vorbedingung**: Pfad 6 (Szenarien adoptiert, `state.importedTabletopScenarios.length > 0`)

**Dauer**: 500–800 ms (View-Lazy-Load + Scenario-List-Render)

**Sichtbar**:
- Scenario-Library mit Karten pro Szenario (gebaut + importiert)
- **2 importierte Healthcare-Szenarien**: "Ransomware-Angriff auf das zentrale KIS" (180 min) + "Kaskadierender Stromausfall mit Notaufnahme-Überlastung" (150 min)
- Plus ggf. eingebaute Built-In-Szenarien (separate Liste)
- Klick auf Karte → Detail-Ansicht mit Timeline, Injects, Decisions, Evaluation-Criteria

**Stolpersteine**:
- Default-Tab/Liste-Modus muss eventuell umgeschaltet werden (je nach View-Struktur)
- Detailansicht zeigt viele Injects pro Timeline-Step — für Demo nicht jede einzelne aufklappen; Überblick reicht

---

### Pfad 10 · Audit-Log mit Section-Diff

**Navigation**: Sidebar → "Plattform & Sync" → scroll zu Audit-Log-Sektion

**Vorbedingung**: Pfad 6 (Adopt-Aktion bereits erfolgt, Audit-Eintrag existiert)

**Dauer**: 500–1000 ms (Audit-Log-Fetch + Render)

**Sichtbar**:
- Liste der letzten Audit-Einträge (newest first)
- Neuester Eintrag: "Synchronisierung" mit
  - Zeitstempel
  - User: admin@krisenfest.local
  - Sections-Liste: `riskEntries, resiliencePlan, archivedResiliencePlans, importedTabletopScenarios`
- Ältere Einträge: "Modul-Pack freigegeben", "Mandant angelegt"

**Stolpersteine**:
- Audit-Log zeigt nur aktive Tenant-Einträge, nicht System-weit
- Mehrere Adopt-Klicks erzeugen mehrere Einträge — demo-seitig einen reichen lassen

---

### Pfad 11 · Pack-Wechsel: Healthcare retiren + Energy importieren/aktivieren

**Navigation**:
1. Sidebar → "Branchenmodule" → Pack-Registry → Healthcare-Entry → "Stilllegen"
2. Sidebar → "Branchenmodule" → "Container importieren" → Energy-Pack hochladen
3. Energy-Registry-Entry → "Freigeben / Rollback"
4. Topbar-Dropdown "Aktives Modul" → "Energie & Versorgung"

**Vorbedingung**: Healthcare-Pack aktiv, Energy-Pack noch nicht importiert

**Dauer**:
- Healthcare-Stilllegung: 1–2 Sekunden
- Energy-Upload + Validierung: 2–5 Sekunden
- Energy-Freigabe: 1–2 Sekunden
- Modul-Wechsel: 1–2 Sekunden
- **Gesamt: 6–12 Sekunden** für den vollständigen Pack-Wechsel

**Sichtbar**:
- Healthcare-Karte verschwindet aus "Verfügbare Module" (bleibt in Registry mit Status "Stillgelegt")
- Neue Energy-Karte erscheint nach Freigabe
- Adopt-Panel zeigt nach Modul-Wechsel Energy-Counts (15 Risiken, 1 Plan, 2 Tabletops)
- **Wichtig für Demo-Narrativ**: Bereits adoptierte Healthcare-Inhalte (riskEntries etc.) bleiben im Tenant-State erhalten — das Pack-Retire löscht KEINE Tenant-Daten

**Stolpersteine**:
- Reihenfolge ist wichtig: Healthcare zuerst stilllegen, dann Energy importieren. Bei umgekehrter Reihenfolge sind kurzzeitig beide Module gleichzeitig aktiv.
- Fachliche Nachricht für Demo: "Der Pack-Wechsel zeigt strukturelle Identität der Engine"

**Ziel-Datei Energy**: `src/module-packs/energy-core.container.json` (1.330 Zeilen)

---

### Pfad 12 · Adoption für Energy-Pack durchspielen

**Navigation**: Sidebar → "Branchenmodule" → Adopt-Panel → "Alle Templates übernehmen"

**Vorbedingung**: Energy-Pack aktiviert (Pfad 11), Adopt-Panel sichtbar mit Energy-Counts

**Dauer**: 0,5–1 Sekunde (identisch zu Pfad 6)

**Sichtbar**:
- Success-Notice mit Energy-Counts
- **Wichtig**: `state.riskEntries` enthält jetzt Healthcare-Risiken (behalten, 15) **plus** Energy-Risiken (neu, 15) — **insgesamt 30 Einträge** nach dem zweiten Adopt
- `state.resiliencePlan` wird **ersetzt** durch Energy-Plan; der Healthcare-Plan wandert in `state.archivedResiliencePlans` (Archiv-Tab sichtbar!)
- `state.importedTabletopScenarios` enthält nach MergeById alle 4 Szenarien (Healthcare 2 + Energy 2)

**Stolpersteine**:
- Die Append-Semantik für Risiken führt zu Dubletten wenn Operator sich nicht bewusst ist — Demo-Moment: hier zeigen, dass das Operator-Kontrolle erfordert
- Der Archiv-Tab im Resilienzplan zeigt den Healthcare-Plan — guter Demo-Beweis für die "Lossless"-Eigenschaft

---

### Pfad 13 · Vergleich der Inhalts-Struktur beider Packs

**Navigation**:
- Sidebar → "KRITIS-Readiness" → Risikokatalog (zeigt alle 30 Einträge, nach Kategorie gruppiert)
- Sidebar → "Tabletop-Übungen" (zeigt 4 Szenarien)
- Sidebar → "Resilienzplan" → "Versionshistorie"-Tab (zeigt aktuellen Energy-Plan + archivierten Healthcare-Plan)

**Vorbedingung**: Pfad 12 durchgeführt, beide Packs adoptiert

**Dauer**: 3 × Navigate + Render, zusammen ca. 3–5 Sekunden

**Sichtbar** (der **Demo-Kernpunkt**):
- Risikomatrix: Kategorie-Verteilung zeigt **Kontrast**
  - Healthcare: interdependency 5 (Wäscherei, Blutbank, Hoster, Zytostatika, Medtech)
  - Energy: cyber_physical 2 + technical 5 (SCADA, Schutztechnik, Redispatch etc.)
- Tabletops: 4 Szenarien mit unterschiedlicher Phasen-Tiefe, aber derselben Datenstruktur
- Resilienzplan-Archiv zeigt beide Pläne (Healthcare und Energy) parallel — Demo-Beweis für Pack-Wechsel ohne Datenverlust

**Didaktische Kernbotschaft**: Dieselbe Engine, unterschiedliche Sektoren, vergleichbare Tiefe. Die KRITIS-Fachleute sehen sofort den Kontrast.

---

## 3 · Zeit-Budgets · Zusammenfassende Tabelle

Wichtig für Dr. Steiner, um zu wissen, wann er reden kann und wann die App die Bühne füllt.

### Einzel-Aktionen

| Aktion | Zeit | Charakteristik |
|---|---|---|
| Login-Formular ausfüllen + Submit | 3–5 s | UI-Interaktion, kurz |
| Pack-Import (File-Upload + Validierung) | 2–5 s | Kurze Redezeit möglich |
| Pack-Aktivierung (draft → released) | 1–2 s | Zu kurz für Rede |
| Modul aktivieren (Dropdown/Karten-Klick) | 1–2 s | Zu kurz für Rede |
| Adopt "Alle Templates übernehmen" | 0,5–1 s | **Sekunde fürs Highlight** |
| View-Rendering (KRITIS/Resilienzplan/Tabletop) | 0,5–1,5 s | Lazy-Import + Paint |
| Pack-Stilllegung | 1–2 s | Zu kurz für Rede |
| Mandant anlegen | 5–10 s | Gute Redezeit für Kontext-Erklärung |

### Demo-Blöcke

| Block | Zeit | Inhalte |
|---|---|---|
| **Healthcare-Pack-Komplett-Durchlauf** | **6–10 Minuten** | Login → Pack-Import → Freigabe → Modul-Aktiv → Adopt → Risikomatrix → Resilienzplan → Tabletop → Audit-Log |
| **Pack-Wechsel auf Energy** | **2–4 Minuten** | Retire Healthcare → Import Energy → Freigabe → Aktiv → Adopt |
| **Vergleichs-Demo (beide Packs sichtbar)** | **2–3 Minuten** | 3 Views im Wechsel mit Kontrast-Kommentaren |
| **Gesamt-Demo** | **10–17 Minuten** | Komfortabel in 20-Minuten-Slot |

### Reset zwischen Demos

| Aktion | Zeit |
|---|---|
| `npm run demo:reset:fresh` | 12–20 s |
| `npm run demo:reset:ready` | 12–20 s (identisch — Copy statt Delete) |
| Manueller Reset über Ctrl+C + Löschen + Neustart | 30–60 s |

### Redepausen im Ablauf

Klassische Momente für Erklärung:
- Während File-Upload (2–5 s): "Hier sehen Sie, wie der Parser den Container validiert"
- Während Mandant-Anlage (5–10 s): "Hinter den Kulissen wird der Mandant im Document-Store angelegt und bekommt einen eigenen State-Scope"
- Während Reset-Skript läuft (12–20 s): Übergang in den nächsten Demo-Block erklären

Keine Redezeit:
- Pack-Freigabe / Modul-Aktivierung (<2 s) — einfach durchklicken
- Adopt-Button (0,5–1 s) — direkt zum Ergebnis navigieren

---

## 4 · Vorbereitungs-Checkliste für die UVM-Demo

- [ ] Reset-Skript einmalig gestestet (`npm run demo:reset:fresh` läuft grün, Server startet, Health-Check antwortet)
- [ ] Baseline vorbereitet (`demo-ready-baseline/` via `npm run demo:capture-baseline`) — falls `--demo-ready` genutzt werden soll
- [ ] Browser-Tab offen auf `http://localhost:5173` (Vite-Dev-Server läuft)
- [ ] Zweiter Browser-Tab offen auf `http://localhost:8787/api/health/live` (als Fallback für schnellen Server-Status-Check)
- [ ] Pack-Dateien verfügbar:
  - `src/module-packs/healthcare-core.container.json`
  - `src/module-packs/energy-core.container.json`
- [ ] Login-Credentials bereit (`admin@krisenfest.local` / `Krisenfest2026!`)
- [ ] Terminal-Fenster sichtbar für Reset-Kommando
- [ ] Fragen-Sammlung griffbereit (`docs/DEMO-EXPECTED-QUESTIONS.md`)

## 5 · Bekannte Einschränkungen

- Der **Audit-Log-View** zeigt nur aktive Tenant-Einträge, nicht system-weite Ereignisse. Demo-Kernpunkt daher über `sections`-Diff, nicht über Detail-Log.
- Der **Pack-Retire** belässt die Tenant-State-Inhalte (Risiken, Plan, Tabletops). Das ist gewollte Semantik (Lossless), muss aber in der Demo erklärt werden, wenn "sauberer Pack-Wechsel" suggeriert wird.
- **Cross-Reference-Arrays** (affectedAssetIds, affectedProcessIds, mitigationMeasureIds) sind bei allen adoptierten Templates **leer** (Entscheidung B.1 aus C5.1). Wenn ein Demo-Gast danach fragt: "Der Operator verknüpft nach Adoption manuell — Pack-Zeit-IDs sind nicht identisch mit Tenant-Zeit-IDs."
- Die **Append-Semantik** beim wiederholten Adopt der Risiken führt zu Dubletten. Demo bewusst nur **einmal** adopten pro Pack, oder die Dubletten-Frage proaktiv thematisieren.
