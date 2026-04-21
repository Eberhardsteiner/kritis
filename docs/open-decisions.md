# Offene Entscheidungen

Kurzer Kontext-Speicher für Entscheidungen, die bewusst verschoben sind,
damit sie nicht zwischen den Iterationen verloren gehen.

## Demo-Mode Server-Sync-Verhalten

In der Demo-/Anonym-Konfiguration überschreibt die Server-Sync zweierlei:

- **C2.3 Phase 3 (E2E Szenario 13):** Ein Reload der Seite ersetzt den
  lokalen State (inkl. frisch angelegter Stakeholder, Assessment-Antworten,
  Evidenzen) mit dem leeren Server-State, bevor localStorage greift.
  Das hat bereits Szenario 4 (C4a) betroffen und wiederholt sich seither.
- **C2.5 Fixture-Fix (openFreshApp):** Der Server-SQLite-State akkumuliert
  zwischen E2E-Läufen, sodass Profil-Dropdowns Inhalte aus vorherigen
  Tests halten. Die Fixture toleriert das per best-effort-Reset auf
  `usr-public`.

**Gemeinsame Ursache:** Die Demo-/Anonym-Server-Sync schreibt ohne
Authentifizierungs-Gate. Lokale Änderungen persistieren nicht zuverlässig
durch Reload, Server-Änderungen bleiben ohne Tenant-Isolation liegen.

**Entscheidungspunkt:** C6 · Supabase-Produktionspfad. Dort wird RLS
eingezogen, der Demo-Mode auf reinen Read-Only-Anonymen umgestellt
und der E2E-State per Staging-Projekt isoliert. Bis dahin bleiben die
Beobachtungen dokumentiert, die Workarounds in Fixtures / Tests
markiert.
