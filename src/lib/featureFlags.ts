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

/**
 * Wenn `true`, gibt `hasPermission(...)` für jede angefragte Permission
 * `true` zurück und `getReadOnlyHint(...)` immer einen leeren String.
 * Effekt: Jeder Browser-Besucher hat in der Demo-Phase Admin-äquivalente
 * Rechte; alle Buttons sind aktiv, der Pack-Import ist sichtbar, kein
 * Lesemodus-Banner erscheint.
 *
 * Begründung für die Demo: Solange der Demo-Login (Backend
 * `KRISENFEST_DEMO_SIMPLE_AUTH` + `/api/auth/demo-login`) in Bolts
 * Preview noch nicht zuverlässig zur Admin-Session führt, würde die
 * normale Permission-Logik die Demo blockieren. Dieses Flag entkoppelt
 * die UI vom Auth-Zustand: selbst ohne funktionierenden Login bleibt
 * die App vollständig bedienbar.
 *
 * Reaktivierung der echten Permission-Logik vor Produktivbetrieb:
 *   1. Demo-Login-Funktionalität für alle Rollen verifizieren
 *   2. Diese Konstante auf `false` setzen
 *   3. Pro Rolle (Admin, Lead, Editor, Reviewer, Auditor, Viewer)
 *      testen, dass die korrekten Permissions greifen
 *   4. Lesemodus-Banner-Texte in `getReadOnlyHint` prüfen
 *
 * Sicherheits-Hinweis: Mit diesem Flag aktiv ist die App **nicht
 * produktionstauglich**. Vor jedem Internet-exponierten Deployment
 * muss das Flag auf `false` stehen — analog zum Auth-Bypass in
 * `KRISENFEST_DEMO_SIMPLE_AUTH`.
 */
export const DEMO_MODE_ALL_PERMISSIONS = true;
