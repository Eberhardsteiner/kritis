/**
 * Public API des Assessment-Feature-Moduls (C2.6).
 *
 * Umfasst die Domaene "Grundanalyse": 0-bis-4-Skala-Bewertung je
 * Frage, Domain-Scores, Filter. Die zentrale Scoring-Bibliothek
 * (src/lib/scoring.ts) bleibt bewusst ausserhalb des Features,
 * weil ihre Exporte von measures, evidence, governance, operations
 * und regulatory ebenfalls benoetigt werden.
 *
 * ControlView, UserCard und die fuenf User-Management-Handler
 * werden NICHT hier extrahiert -- sie wandern mit C2.7 in platform/,
 * entsprechend ihrer Zugehoerigkeit zur Zugriffs-/Rechte-Verwaltung.
 *
 * Von aussen zu konsumieren:
 *  - AssessmentView (Top-Level-View)
 *  - QuestionCard (feature-extern nutzbar, z. B. fuer C2.9 regulatory)
 *  - useAssessmentHandlers + AssessmentHandlerDependencies +
 *    AssessmentHandlers
 *
 * ScoreSelector bleibt feature-intern -- er ist reiner
 * Implementierungs-Detail von QuestionCard.
 */

export { AssessmentView } from './views/AssessmentView';
export { QuestionCard } from './components/QuestionCard';

export {
  useAssessmentHandlers,
  type AssessmentHandlers,
} from './hooks/useAssessmentHandlers';
