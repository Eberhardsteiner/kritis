// Marken- und Kontaktdaten fuer die Kritis-Kompass-App und das PDF-Output.
// Schaeuble-Felder werden vom Kunden in Phase 7 selbst befuellt; das PDF
// rendert sie nur, wenn sie nicht-leer sind.

export const BRANDING = {
  appName: 'KRITIS-Kompass',
  tagline: 'Zukunftsfähigkeit ist kein Zufall.',
  partner1: {
    name: 'UVM-Institut',
    url: 'https://uvm-akademie.de',
    contactEmail: 'info@uvm-akademie.de',
  },
  partner2: {
    name: 'Schäuble Consulting GmbH',
    url: '',
    contactEmail: '',
  },
  colors: {
    bordeaux: '#c43960',
    deepBordeaux: '#8b1538',
    black: '#0a0510',
    offwhite: '#f5ebef',
    mauve: '#b08090',
    muted: '#7a5060',
    bernstein: '#d09038',
    gruen: '#4a8f5e',
  },
  privacyUrl: '/privacy',
  consultingUrl: 'mailto:info@uvm-akademie.de?subject=KRITIS-Kompass%3A%20Beratungsanfrage',
  splash: {
    eyebrow: 'LAGEBILD KRITIS-RESILIENZ',
    title: 'Wo stehen Sie wirklich?',
    subtitle: 'Acht Dimensionen · Eine Selbstanalyse · 15 Minuten',
    primaryCta: 'ANALYSE STARTEN',
    helperQuestion: 'Unsicher, ob Sie KRITIS-betroffen sind?',
    helperLink: 'Vorab kurz prüfen →',
    privacy: 'Selbstanalyse, kein Server, keine Anmeldung — Sie behalten Ihre Daten lokal.',
  },
  // Reihenfolge muss zu baseDomains passen: 12 Uhr im Uhrzeigersinn.
  // GOV → OPS → PER → STD → CYB → SUP → FIN → BCM
  dimensions: [
    { key: 'governance', label: 'GOVERNANCE', short: 'GOV' },
    { key: 'operations', label: 'OPERATIONS', short: 'OPS' },
    { key: 'people', label: 'PERSONAL', short: 'PER' },
    { key: 'physical', label: 'STANDORTE', short: 'STD' },
    { key: 'cyber', label: 'CYBER & IT', short: 'CYB' },
    { key: 'supply', label: 'LIEFERKETTE', short: 'SUP' },
    { key: 'finance', label: 'FINANZEN', short: 'FIN' },
    { key: 'bcm', label: 'KRISEN-MGMT', short: 'BCM' },
  ],
} as const;
