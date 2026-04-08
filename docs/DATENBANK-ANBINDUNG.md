# Datenbankanbindung der KRITIS-Readiness App

Diese App unterstützt ab Sprint L drei Persistenzpfade in fester Reihenfolge:

1. **Supabase REST Store**
2. **SQLite-Dokumentenspeicher**
3. **tenantbezogener Dateifallback**

Für Bolt ist derzeit der **Supabase-Weg** die saubere Datenbankanbindung, weil die App diesen Pfad ohne native Datenbanktreiber direkt über HTTP/REST nutzen kann.

## Empfohlener Weg in Bolt: Supabase

### Schritt 1: Supabase-Projekt anlegen

Legen Sie in Supabase ein neues Projekt an.

Notieren Sie sich danach:
- **Project URL**
- **Service Role Key**

Sie finden beides im Supabase-Dashboard unter den API-Einstellungen Ihres Projekts.

### Schritt 2: SQL-Schema einspielen

Öffnen Sie im Supabase-Projekt den SQL Editor und führen Sie die Datei `docs/supabase-schema.sql` vollständig aus.

Damit werden angelegt:
- Tabelle `krisenfest_documents`
- Tabelle `krisenfest_audit_events`
- RPC-Funktionen
  - `krisenfest_upsert_document`
  - `krisenfest_append_audit_event`
  - `krisenfest_replace_audit_events`

### Schritt 3: Variablen in Bolt setzen

Setzen Sie in Bolt die folgenden Variablen. Am einfachsten über die `.env` im Projektroot oder über die Secrets-/Environment-Ansicht:

```env
KRISENFEST_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
KRISENFEST_SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
KRISENFEST_SUPABASE_SCHEMA=public
```

Weitere Beispielvariablen finden Sie in `.env.example`.

### Schritt 4: App neu starten

```bash
npm install --userconfig ./.npmrc
npm run dev
```

### Schritt 5: Prüfen, ob die Datenbank aktiv ist

Rufen Sie auf:

```text
/api/health
```

Erwartet wird im JSON:

```json
{
  "mode": "supabase-rest-store"
}
```

Wenn stattdessen `sqlite-document-store` oder `filesystem-fallback` erscheint, sind die Supabase-Variablen nicht vollständig oder das Schema wurde nicht korrekt angelegt.

## Was die App in Supabase speichert

### 1. Dokumente

Tabelle: `krisenfest_documents`

Darin speichert die App alle zentralen JSON-Dokumente, zum Beispiel:
- Systemzustand
- tenantbezogenen Arbeitsstand
- Einstellungen
- Exportregister
- Modul-Registry

Schlüssel:
- `scope_kind` = `system` oder `tenant`
- `scope_id` = `system` oder Tenant-ID
- `namespace` = Dokumenttyp

### 2. Audit-Ereignisse

Tabelle: `krisenfest_audit_events`

Darin liegen tenantbezogene Audit- und Änderungsereignisse in zeitlicher Reihenfolge.

## Wie Konflikte behandelt werden

Die App verwendet **Optimistic Locking**.

Das bedeutet:
- jedes Dokument hat `version` und `updated_at`
- beim Schreiben kann die App eine `expectedVersion` mitgeben
- wenn inzwischen schon ein neuer Stand gespeichert wurde, löst die Datenbankfunktion einen Versionskonflikt aus
- die API liefert dann **409 Konflikt** an das Frontend zurück

So werden stille Überschreibungen verhindert.

## Wie Sie testen können

### Test 1: Datenbank aktiv

- App starten
- `/api/health` aufrufen
- `mode` muss `supabase-rest-store` sein

### Test 2: Zustand speichern

- in der App eine Änderung vornehmen
- Seite neu laden
- prüfen, ob der Zustand erhalten bleibt

### Test 3: Pack-Registry

- in **Module** ein JSON-Paket importieren
- Paket freigeben
- Seite neu laden
- prüfen, ob die Registry erhalten bleibt

### Test 4: Audit

- eine Änderung speichern
- in Supabase prüfen, ob in `krisenfest_audit_events` neue Datensätze entstanden sind

## Fehlerbilder und Ursachen

### `/api/health` zeigt nicht `supabase-rest-store`

Ursachen:
- `KRISENFEST_SUPABASE_URL` fehlt
- `KRISENFEST_SUPABASE_SERVICE_ROLE_KEY` fehlt
- App wurde nach dem Setzen der Variablen nicht neu gestartet

### RPC-Fehler bei Schreibvorgängen

Ursache:
- SQL aus `docs/supabase-schema.sql` wurde nicht vollständig ausgeführt

### 401 oder 403 gegen Supabase

Ursache:
- falscher API-Key
- statt **Service Role Key** wurde ein öffentlicher Schlüssel verwendet

### 409 Konflikt beim Speichern

Ursache:
- zwei Stände wurden gleichzeitig bearbeitet
- das ist erwartetes Schutzverhalten

## Für späteren Produktivbetrieb außerhalb von Bolt

Der aktuelle Sprint-L-Stand ist bewusst so gebaut, dass er in Bolt ohne native Datenbanktreiber lauffähig bleibt. Für ein späteres Hosting außerhalb von Bolt können wir zusätzlich einen direkten Postgres-/ORM-Pfad einbauen, zum Beispiel mit Prisma oder Drizzle. Dafür wäre dann ein weiterer Persistenzadapter sinnvoll.
