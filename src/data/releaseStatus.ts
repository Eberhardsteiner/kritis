export const releaseStatus = {
  appVersion: '2.1.0',
  currentSprintLabel: 'Sprint P4',
  currentPackageId: 'P4',
  currentPackageLabel: 'Produktpaket P4',
  currentHeadline: 'Refactoring, Testausbau und Pilotfreigabe',
  currentSummary:
    'P3 ist abgeschlossen. Aktuell läuft P4 mit Backend-Refactoring, App-Entzerrung, stabilerer Testbasis und Pilotfreigabe.',
  nextMilestones: [
    'P4: Server weiter modularisieren und App.tsx zerlegen',
    'P4: Frontend-Smoke- und E2E-Grundlage aufbauen',
    'P5: Produktionsplattform mit Zielhosting, SSO und Objektablage',
    'P6: Pilotbetrieb, UAT und Rollout',
  ],
} as const;
