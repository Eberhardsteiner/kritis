/**
 * featureFlags.ts · Frontend-Feature-Flags für nicht-Backend-gesteuerte
 * UI-Toggles. Anders als `KRISENFEST_DEMO_SIMPLE_AUTH` (Backend-Env,
 * Bootstrap-Response) sind diese Flags rein clientseitig — sie steuern,
 * welche Bestandteile der UI während der Demo-Phase sichtbar sind.
 *
 * Konvention: Konstanten als `const`, kein `let`. Das ermöglicht
 * Tree-Shaking-/Inlining im Vite-Build, sodass abgeschaltete Pfade
 * im Production-Bundle erst gar nicht ausgeliefert werden.
 *
 * Reaktivierungs-Anleitung pro Flag in `docs/DEMO-AUTH-BYPASS.md`
 * Abschnitt „Frontend-Feature-Flags".
 */

/**
 * Wenn `false`, blendet KritisView die `ManagementLiabilityCard` und
 * `PenaltyExposureCard` (Sanktionsrisiko + Bußgeldexposition) aus.
 *
 * Begründung für die Demo: Die Karten zeigen reale Bußgeldgrößen aus
 * §37 BSI-KritisV / NIS2-Umsetzung, was in einer Demo-Situation einen
 * abschreckenden Eindruck hinterlassen kann („wir machen Krisen-
 * Software, schauen Sie sich die Strafen an"). Die Karten gehören
 * inhaltlich später wieder rein — als Teil der Compliance-Dramaturgie
 * für ernsthafte Pilotkunden.
 *
 * Reaktivierung: Diese Konstante auf `true` setzen, kein Code-Pfad
 * geht dadurch verloren — Karten-Komponenten und Datenpfad
 * (`kritisPenaltyEstimate`, `regulatoryProfile`, `kritisMilestones`)
 * bleiben in jedem Branch erhalten.
 */
export const SHOW_PENALTY_EXPOSURE = false;
