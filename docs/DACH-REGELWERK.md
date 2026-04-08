# DACH-Regelwerk ab Sprint N

Ab Sprint N unterstützt die App drei Jurisdiktionen im Bereich **KRITIS-Readiness**:

- **DE**: KRITIS-Dachgesetz sowie BSIG / NIS2
- **AT**: NISG 2026
- **CH**: Meldepflicht für Cyberangriffe auf kritische Infrastrukturen

## Deutschland

Deutschland bleibt in zwei getrennte Regime aufgeteilt:

- **KRITIS-Dachgesetz** für physische und organisatorische Resilienz
- **BSIG / NIS2** für Cyber-, Governance- und Meldepflichten

## Österreich

Für Österreich führt die App ein separates Regime **NISG 2026**.

Im Fokus stehen insbesondere:

- Scope und Einordnung als wichtige oder wesentliche Einrichtung
- Registrierung und Selbsterklärung
- Risikomanagementmaßnahmen
- gestufte Vorfallmeldung
- Nachweisfähigkeit und Governance

## Schweiz

Für die Schweiz führt die App ein eigenes Melde- und Nachweisregime.

Im Fokus stehen insbesondere:

- Scope kritischer Infrastruktur
- Meldekanal und Kontaktfähigkeit
- 24-Stunden-Erstmeldung
- Nachreichung fehlender Informationen
- Evidenz- und Kommunikationsakte

## Wirkung in der App

Die Jurisdiktionswahl beeinflusst jetzt:

- sichtbare Regime im Cockpit
- Scope-Status je Regime
- Anforderungen und Auditchecklisten
- Fristen im Compliance-Kalender
- Berichtstitel und Exportsektionen
- länderspezifische Einordnungstexte

## Relevante Dateien

- `src/data/kritisBase.ts`
- `src/lib/regulatory.ts`
- `src/lib/workspace.ts`
- `src/lib/scoring.ts`
- `src/views/KritisView.tsx`
- `src/views/ReportView.tsx`
- `src/lib/exporters.ts`
- `server/regulatory-dach.js`
- `server/regulatory-dach.test.js`
