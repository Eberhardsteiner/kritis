# Deutschland-Regelwerk ab Sprint M

## Ziel

Ab Sprint M wird das Deutschland-Regelwerk in der App in zwei getrennte Regime aufgeteilt:

- **KRITIS-Dachgesetz**
- **BSIG / NIS2**

Diese Trennung ist wichtig, weil sich Scoping, Pflichten, Fristen, Evidenzen und Berichtsteile unterscheiden.

## Modell in der App

### Regime 1: KRITIS-Dachgesetz

Verwendet für:
- Scope-Bewertung
- Registrierung
- Risikoanalyse
- Resilienzmaßnahmen
- Resilienzplan
- Nachweise, Audit und Prüfpfad

### Regime 2: BSIG / NIS2

Verwendet für:
- Scope-Bewertung
- Entity-Klassifikation
- Registrierung
- Cyber-Risikomanagement
- Vorfallmeldungen
- IT-bezogene Nachweise und Audits

## Technische Umsetzung

### Frontend

- `src/data/kritisBase.ts`
- `src/lib/regulatory.ts`
- `src/views/KritisView.tsx`
- `src/views/ReportView.tsx`
- `src/lib/exporters.ts`
- `src/lib/workspace.ts`

### Backend

- `server/regulatory-germany.js`
- `server/regulatory-germany.test.js`
- `server/index.js`

## Datenmodell

Neu bzw. erweitert:

- `regulatoryProfile.owner`
- `regulatoryProfile.lastReviewDate`
- `regulatoryProfile.bsigEntityClass`
- `regulatoryProfile.notes`
- `regulatoryProfile.regimeScope`
- `complianceCalendar.bsigRegistrationDate`
- `complianceCalendar.lastCyberRiskAssessmentDate`
- `complianceCalendar.lastIncidentExerciseDate`

## Wirkung auf die App

- nur **aktive Regime** wirken auf Anforderungen, Checklisten und Reports
- der Bereich **KRITIS-Readiness** zeigt jetzt ein **Regelwerks-Cockpit Deutschland**
- Management Report und Audit Pack enthalten eine **eigene Regime-Auswertung**
- offene Anforderungen und Blocker werden je Regime separat gezeigt
