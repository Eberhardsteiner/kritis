/**
 * Public API des resiliencePlan-Feature-Moduls.
 *
 * Das Feature stammt aus **B4** (§ 13-KRITISDachG-Resilienzplan). Es
 * bestand bereits als strukturierter Ordner mit Typen, Generator,
 * Schema, Template und Renderern (JSON/DOCX/PDF). In **C2.11a** sind
 * der Handler-Hook und diese Public-API-Schicht ergaenzt worden —
 * damit hat resiliencePlan jetzt dieselbe Schnittstellen-Homogenitaet
 * wie die in C2 extrahierten Features.
 *
 * Von aussen zu konsumieren:
 *  - useResiliencePlanHandlers + Types (neun Handler: Generator,
 *    Workflow, Exports)
 *  - Generator: generateResiliencePlanDraft
 *  - Renderer: renderResiliencePlanJsonBlob/DocxBlob/PdfBlob +
 *    buildResiliencePlanJsonFileName/DocxFileName/PdfFileName
 *  - Types: ResiliencePlan, ResiliencePlanStatus, ResiliencePlanContent
 */

export {
  useResiliencePlanHandlers,
  type ResiliencePlanHandlerDependencies,
  type ResiliencePlanHandlers,
} from './hooks/useResiliencePlanHandlers';

export { generateDraft as generateResiliencePlanDraft } from './generator';

export {
  renderResiliencePlanJsonBlob,
  buildResiliencePlanJsonFileName,
} from './renderers/jsonRenderer';

export {
  renderResiliencePlanDocxBlob,
  buildResiliencePlanDocxFileName,
} from './renderers/docxRenderer';

export {
  renderResiliencePlanPdfBlob,
  buildResiliencePlanPdfFileName,
} from './renderers/pdfRenderer';

export type {
  ResiliencePlan,
  ResiliencePlanStatus,
  ResiliencePlanContent,
} from './types';
