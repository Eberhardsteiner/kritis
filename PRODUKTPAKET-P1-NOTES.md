# Produktpaket P1 · Branchen-Engine und Industrie-Kerncontainer

## Schwerpunkt

P1 setzt die App auf eine standardisierte Branchen-Engine um. Brancheninhalte werden jetzt in einer einheitlichen JSON-Hülle transportiert und können ohne fachliches Hardcoding in die bestehende Engine geladen werden.

## Umgesetzt

- standardisiertes Containerformat mit `containerVersion`, `manifest`, `module` und optional `targetModuleId`
- integrierte Kernmodule auf Containerformat umgestellt
- neues Referenzpaket **Industrie & Produktion** als Kerncontainer
- Manifest-Metadaten mit:
  - `packId`
  - `packType`
  - `moduleId`
  - `version`
  - `engine` / `engineVersion`
  - `compatibility`
  - `tags`
  - `capabilities`
- Frontend-Parsing für Container und Legacy-JSON
- Backend-Parsing für Container und Legacy-JSON
- Registry speichert jetzt auch Format, Container-Version und Manifest
- Modulverwaltung zeigt Quelle, Pack-ID, Format und Overlay-Anzahl
- Dokumentation und Templates für neue Branchencontainer

## Industrie-Modul

Das integrierte Industriepaket wurde fachlich erweitert um:

- OT-Fernwartung und Fremdzugriffe
- Lieferantenwechsel und Materialfreigaben
- zusätzliche Maßnahmen und Evidenzvorlagen
- OT-Rolle, Auditpunkte und Szenario für kompromittierten Fernzugang
- zusätzliche Dokumentenordner und Prozess-/Abhängigkeitsbausteine

## Hinweise

- Legacy-JSON bleibt lesbar, ist aber nicht mehr das Zielbild.
- Neue Branchen sollten nur noch als Containerpaket angelegt werden.
- Overlay-Container benötigen weiter die serverseitige Registry.

## Geplante Folgeschritte

- **P2**: produktive Identität und Rollenmodell
- **P3**: produktive Daten- und Evidenzplattform
- **P4**: Refactoring, Pilotfreigabe und produktive Teststrecke
