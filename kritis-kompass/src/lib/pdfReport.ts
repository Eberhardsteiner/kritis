import { jsPDF } from 'jspdf';
import { BRANDING } from '../config/branding';
import { maturityBands, scoreOptions } from '../data/kritisBase';
import { indicatorsConfig } from '../data/indicatorsConfig';
import type {
  AnswerEntry,
  ApplicabilityResult,
  DomainDefinition,
  IndicatorAnswers,
  QuestionDefinition,
  ScoreSnapshot,
  SectorModulePack,
} from '../types';

// ---------------------------------------------------------------------------
// Helper-Pattern, abgeleitet aus SOURCE_REPO/src/lib/exporters.ts:90 ff.
// Bewusst neu geschrieben, weil Branding und Layout fuer den Kompass-Bericht
// anders sind. Die Primitives ensureSpace / addParagraph / addBullets /
// addSection bleiben aber strukturell identisch — wer das Original kennt,
// findet sich hier sofort zurecht.
// ---------------------------------------------------------------------------

interface PdfContext {
  pdf: jsPDF;
  margin: number;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  /** y-Position des naechsten Schreibvorgangs in mm. */
  y: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return [r, g, b];
}

function getMaturityBandLabel(score: number): string {
  let current = maturityBands[0].label;
  for (const band of maturityBands) {
    if (score >= band.min) current = band.label;
  }
  return current;
}

function getScoreOptionText(score: number | null | undefined): string {
  if (score === null || score === undefined) return '— (nicht beantwortet)';
  const option = scoreOptions.find((o) => o.value === score);
  return option ? `${option.label} · ${option.text}` : String(score);
}

function asciiBar(score: number, width = 8): string {
  const filled = Math.round((Math.max(0, Math.min(100, score)) / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function todayStamp(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = date.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

function safeFilename(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Primitives, die auf dem ctx-Objekt operieren
// ---------------------------------------------------------------------------

function ensureSpace(ctx: PdfContext, required = 10): void {
  if (ctx.y + required <= ctx.pageHeight - ctx.margin) return;
  ctx.pdf.addPage();
  ctx.y = ctx.margin;
}

function addPageBreak(ctx: PdfContext): void {
  ctx.pdf.addPage();
  ctx.y = ctx.margin;
}

function setFillHex(ctx: PdfContext, hex: string): void {
  const [r, g, b] = hexToRgb(hex);
  ctx.pdf.setFillColor(r, g, b);
}

function setTextHex(ctx: PdfContext, hex: string): void {
  const [r, g, b] = hexToRgb(hex);
  ctx.pdf.setTextColor(r, g, b);
}

function setDrawHex(ctx: PdfContext, hex: string): void {
  const [r, g, b] = hexToRgb(hex);
  ctx.pdf.setDrawColor(r, g, b);
}

function addSection(ctx: PdfContext, title: string): void {
  ensureSpace(ctx, 14);
  setTextHex(ctx, BRANDING.colors.bordeaux);
  ctx.pdf.setFont('helvetica', 'bold');
  ctx.pdf.setFontSize(13);
  ctx.pdf.text(title, ctx.margin, ctx.y);
  ctx.y += 5.5;
  setDrawHex(ctx, BRANDING.colors.bordeaux);
  ctx.pdf.setLineWidth(0.4);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.margin + 18, ctx.y);
  ctx.y += 5;
  setTextHex(ctx, BRANDING.colors.black);
}

function addParagraph(ctx: PdfContext, text: string, opts: { italic?: boolean; size?: number; color?: string } = {}): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  ctx.pdf.setFont('helvetica', opts.italic ? 'italic' : 'normal');
  ctx.pdf.setFontSize(opts.size ?? 10);
  setTextHex(ctx, opts.color ?? BRANDING.colors.black);
  const lines = ctx.pdf.splitTextToSize(trimmed, ctx.contentWidth);
  ensureSpace(ctx, lines.length * 5 + 3);
  ctx.pdf.text(lines, ctx.margin, ctx.y);
  ctx.y += lines.length * 5 + 2;
  setTextHex(ctx, BRANDING.colors.black);
}

function addBullets(ctx: PdfContext, items: string[]): void {
  const filtered = items.filter(Boolean);
  if (!filtered.length) return;
  ctx.pdf.setFont('helvetica', 'normal');
  ctx.pdf.setFontSize(10);
  setTextHex(ctx, BRANDING.colors.black);
  filtered.forEach((item) => {
    const lines = ctx.pdf.splitTextToSize(`• ${item}`, ctx.contentWidth);
    ensureSpace(ctx, lines.length * 5 + 2);
    ctx.pdf.text(lines, ctx.margin, ctx.y);
    ctx.y += lines.length * 5;
  });
  ctx.y += 1;
}

function addStatusPill(ctx: PdfContext, label: string, fillHex: string, textHex: string): void {
  ctx.pdf.setFont('helvetica', 'bold');
  ctx.pdf.setFontSize(10);
  const padding = 4;
  const width = ctx.pdf.getTextWidth(label) + padding * 2;
  const height = 6;
  ensureSpace(ctx, height + 2);
  setFillHex(ctx, fillHex);
  ctx.pdf.roundedRect(ctx.margin, ctx.y, width, height, 2, 2, 'F');
  setTextHex(ctx, textHex);
  ctx.pdf.text(label, ctx.margin + padding, ctx.y + height - 1.8);
  ctx.y += height + 3;
  setTextHex(ctx, BRANDING.colors.black);
}

function addDivider(ctx: PdfContext, hex: string = BRANDING.colors.bordeaux): void {
  ensureSpace(ctx, 4);
  setDrawHex(ctx, hex);
  ctx.pdf.setLineWidth(0.5);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.margin + ctx.contentWidth, ctx.y);
  ctx.y += 4;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ReportPayload {
  companyName?: string;
  reportDate: Date;
  applicability: ApplicabilityResult | undefined;
  modulePack: SectorModulePack | undefined;
  score: ScoreSnapshot | undefined;
  questions: QuestionDefinition[];
  answers: Record<string, AnswerEntry>;
  domains: DomainDefinition[];
  indicators: IndicatorAnswers;
}

const STATUS_PILL_COLOR: Record<ApplicabilityResult['status'], { bg: string; fg: string; label: string }> = {
  direkt_betroffen: { bg: BRANDING.colors.bordeaux, fg: '#FFFFFF', label: 'Direkt betroffen' },
  pruefbeduerftig: { bg: BRANDING.colors.bernstein, fg: BRANDING.colors.black, label: 'Prüfbedürftig' },
  indirekt_betroffen: { bg: BRANDING.colors.mauve, fg: '#FFFFFF', label: 'Indirekt betroffen' },
  eher_nicht_betroffen: { bg: BRANDING.colors.muted, fg: '#FFFFFF', label: 'Eher nicht betroffen' },
};

function renderCoverPage(ctx: PdfContext, payload: ReportPayload): void {
  // Bordeaux-Block oben
  setFillHex(ctx, BRANDING.colors.bordeaux);
  ctx.pdf.rect(0, 0, ctx.pageWidth, 60, 'F');

  // Wortmarken zentriert im Bordeaux-Block
  const partnersLine = BRANDING.partner2.url || BRANDING.partner2.contactEmail
    ? `${BRANDING.partner1.name.toUpperCase()}   ·   ${BRANDING.partner2.name.toUpperCase()}`
    : BRANDING.partner1.name.toUpperCase();
  ctx.pdf.setFont('helvetica', 'bold');
  ctx.pdf.setFontSize(14);
  setTextHex(ctx, '#FFFFFF');
  const partnerWidth = ctx.pdf.getTextWidth(partnersLine);
  ctx.pdf.text(partnersLine, (ctx.pageWidth - partnerWidth) / 2, 28);

  ctx.pdf.setFont('helvetica', 'normal');
  ctx.pdf.setFontSize(10);
  const subline = `Lead-Magnet · ${BRANDING.appName}`;
  const subWidth = ctx.pdf.getTextWidth(subline);
  ctx.pdf.text(subline, (ctx.pageWidth - subWidth) / 2, 38);

  // Inhalt unter dem Block
  ctx.y = 75;
  setTextHex(ctx, BRANDING.colors.muted);
  ctx.pdf.setFont('helvetica', 'bold');
  ctx.pdf.setFontSize(9);
  ctx.pdf.text('K R I T I S - S E L B S T A N A L Y S E   ·   R E S I L I E N Z - B E R I C H T', ctx.margin, ctx.y);
  ctx.y += 9;

  setTextHex(ctx, BRANDING.colors.black);
  ctx.pdf.setFont('helvetica', 'bold');
  ctx.pdf.setFontSize(22);
  const title = payload.companyName?.trim()
    ? `Resilienz-Bericht für ${payload.companyName.trim()}`
    : 'Resilienz-Bericht';
  const titleLines = ctx.pdf.splitTextToSize(title, ctx.contentWidth);
  ctx.pdf.text(titleLines, ctx.margin, ctx.y);
  ctx.y += titleLines.length * 9 + 2;

  ctx.pdf.setFont('helvetica', 'normal');
  ctx.pdf.setFontSize(11);
  setTextHex(ctx, BRANDING.colors.muted);
  ctx.pdf.text(`Erstellt am ${todayStamp(payload.reportDate)}`, ctx.margin, ctx.y);
  ctx.y += 8;

  if (payload.modulePack) {
    setTextHex(ctx, BRANDING.colors.black);
    ctx.pdf.setFontSize(12);
    ctx.pdf.text(`Branchenmodul: ${payload.modulePack.name}`, ctx.margin, ctx.y);
    ctx.y += 7;
  }

  if (payload.applicability) {
    const conf = STATUS_PILL_COLOR[payload.applicability.status];
    addStatusPill(ctx, conf.label.toUpperCase(), conf.bg, conf.fg);
  }

  // Bordeaux-Trennlinie weiter unten
  ctx.y = ctx.pageHeight - 30;
  setDrawHex(ctx, BRANDING.colors.bordeaux);
  ctx.pdf.setLineWidth(0.6);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.pageWidth - ctx.margin, ctx.y);
  ctx.y += 6;

  ctx.pdf.setFont('helvetica', 'italic');
  ctx.pdf.setFontSize(10);
  setTextHex(ctx, BRANDING.colors.mauve);
  ctx.pdf.text(BRANDING.tagline, ctx.margin, ctx.y);
}

function renderManagementSummary(ctx: PdfContext, payload: ReportPayload): void {
  addSection(ctx, 'Auf einen Blick');

  if (payload.applicability) {
    ctx.pdf.setFont('helvetica', 'bold');
    ctx.pdf.setFontSize(14);
    setTextHex(ctx, BRANDING.colors.bordeaux);
    const titleLines = ctx.pdf.splitTextToSize(payload.applicability.title, ctx.contentWidth);
    ensureSpace(ctx, titleLines.length * 6 + 4);
    ctx.pdf.text(titleLines, ctx.margin, ctx.y);
    ctx.y += titleLines.length * 6 + 1;
    setTextHex(ctx, BRANDING.colors.black);
    addParagraph(ctx, payload.applicability.text);
  }

  if (payload.score) {
    ensureSpace(ctx, 14);
    ctx.pdf.setFont('helvetica', 'bold');
    ctx.pdf.setFontSize(28);
    setTextHex(ctx, BRANDING.colors.bordeaux);
    const scoreText = `${payload.score.overallScore}/100`;
    ctx.pdf.text(scoreText, ctx.margin, ctx.y + 4);
    const scoreWidth = ctx.pdf.getTextWidth(scoreText);
    ctx.pdf.setFont('helvetica', 'normal');
    ctx.pdf.setFontSize(12);
    setTextHex(ctx, BRANDING.colors.black);
    ctx.pdf.text(payload.score.maturityLabel, ctx.margin + scoreWidth + 6, ctx.y + 2);
    ctx.pdf.setFontSize(9);
    setTextHex(ctx, BRANDING.colors.muted);
    ctx.pdf.text(
      `${payload.score.completion}% beantwortet`,
      ctx.margin + scoreWidth + 6,
      ctx.y + 7,
    );
    ctx.y += 13;
    setTextHex(ctx, BRANDING.colors.black);
  }

  // Domain-Tabelle
  if (payload.score) {
    addParagraph(ctx, 'Domänen im Überblick:', { size: 10 });
    ctx.pdf.setFont('courier', 'normal');
    ctx.pdf.setFontSize(9);
    payload.score.domainScores.forEach((domain) => {
      ensureSpace(ctx, 5);
      const score = `${domain.score.toString().padStart(3, ' ')}/100`;
      const status = getMaturityBandLabel(domain.score).padEnd(10, ' ');
      const bar = asciiBar(domain.score, 10);
      const labelWidth = 60;
      const labelLines = ctx.pdf.splitTextToSize(domain.label, labelWidth);
      ctx.pdf.setFont('helvetica', 'normal');
      ctx.pdf.text(labelLines[0] ?? domain.label, ctx.margin, ctx.y);
      ctx.pdf.setFont('courier', 'normal');
      ctx.pdf.text(score, ctx.margin + 70, ctx.y);
      ctx.pdf.setFont('helvetica', 'normal');
      ctx.pdf.text(status, ctx.margin + 92, ctx.y);
      ctx.pdf.setFont('courier', 'normal');
      ctx.pdf.text(bar, ctx.margin + 130, ctx.y);
      ctx.y += 5;
    });
    ctx.pdf.setFont('helvetica', 'normal');
    ctx.y += 2;
  }

  // Top-3 aus applicability
  if (payload.applicability && payload.applicability.recommendations.length > 0) {
    addParagraph(ctx, 'Wichtigste Schritte aus der KRITIS-Einordnung:', { size: 10 });
    addBullets(ctx, payload.applicability.recommendations.slice(0, 3));
  }

  // Top-3 hoch-prioritäre aus dem Score
  if (payload.score && payload.score.recommendations.length > 0) {
    const topHigh = payload.score.recommendations.filter((r) => r.urgency === 'hoch').slice(0, 3);
    if (topHigh.length > 0) {
      addParagraph(ctx, 'Hochpriorisierte Maßnahmen aus der Resilienz-Analyse:', { size: 10 });
      addBullets(
        ctx,
        topHigh.map((r) => `${r.domainLabel}: ${r.title} — ${r.action}`),
      );
    }
  }
}

function renderKritisEinordnung(ctx: PdfContext, payload: ReportPayload): void {
  addSection(ctx, 'KRITIS-Einordnung Ihres Unternehmens');

  const applicability = payload.applicability;
  if (!applicability) {
    addParagraph(ctx, 'Es liegt noch kein Betroffenheits-Check vor. Eine KRITIS-Einordnung ist daher in diesem Bericht nicht möglich.');
    return;
  }

  switch (applicability.status) {
    case 'direkt_betroffen':
      addParagraph(
        ctx,
        'Ihre Selbstauskunft deutet stark auf eine KRITIS-Pflicht nach KRITISDachG hin. Die folgenden Punkte sollten Sie umgehend mit qualifizierter Beratung klären:',
      );
      addBullets(ctx, [
        'Sektorspezifische Anlagen- und Schwellenwert-Prüfung',
        'Anmeldung beim BBK',
        'Aufbau Resilienzplan und Vorfallmeldewege',
        'Behördliche Dokumentations- und Auskunftsfähigkeit',
      ]);
      break;
    case 'pruefbeduerftig':
      addParagraph(
        ctx,
        'Ihre Angaben zeigen Indikatoren, die eine Einstufung nicht ausschließen. Vor einer Entscheidung über Maßnahmen sollten folgende Punkte geprüft werden:',
      );
      addBullets(ctx, [
        ...applicability.reasons,
        'Externe Begleitung bei der Sektor- und Schwellenwert-Klärung empfohlen',
      ]);
      break;
    case 'indirekt_betroffen':
      addParagraph(
        ctx,
        'Sie sind selbst nicht KRITIS-pflichtig, Ihre Position als Zulieferer löst aber zunehmend NIS2- und vertragliche Resilienz-Pflichten aus. Folgende Punkte werden für Sie relevant:',
      );
      addBullets(ctx, [
        'Vertragliche Pflichten gegenüber KRITIS-Kunden prüfen',
        'Eigene Resilienz auf das vertragliche Niveau heben',
        'Audit-Fähigkeit aufbauen',
      ]);
      break;
    case 'eher_nicht_betroffen':
      addParagraph(
        ctx,
        'Auf Basis Ihrer Angaben ist eine direkte oder indirekte KRITIS-Betroffenheit derzeit nicht erkennbar. Eine periodische Neubewertung bei Geschäftsmodell-Änderungen ist empfehlenswert.',
      );
      break;
  }

  if (applicability.reasons.length > 0 && applicability.status !== 'pruefbeduerftig') {
    addParagraph(ctx, 'Was wir aus Ihrer Selbstauskunft hören:', { size: 10 });
    addBullets(ctx, applicability.reasons);
  }

  // Phase-2 Stage-3-Kontext
  const stage3 = payload.indicators.stage3_context;
  const contextNotes: string[] = [];
  if (stage3.nis2Affected === true) {
    contextNotes.push(
      'Sie haben angegeben, bereits NIS2-betroffen zu sein. NIS2 und KRITISDachG bestehen parallel — Pflichten aus beiden Regimen müssen koordiniert behandelt werden.',
    );
  }
  if (stage3.doraAffected === true) {
    contextNotes.push(
      'DORA-Pflichten ergänzen den finanzsektorspezifischen Resilienzrahmen und können KRITIS-Bausteine voraussetzen oder ablösen.',
    );
  }
  if (stage3.authorityContact === true) {
    contextNotes.push(
      'Sie stehen bereits in Behördenkontakt — gut. Stellen Sie sicher, dass dieser Kontakt mit Ihrer internen Resilienz-Roadmap synchron läuft.',
    );
  }
  if (contextNotes.length > 0) {
    addParagraph(ctx, 'Zusätzlicher Kontext aus Ihrem Check:', { size: 10 });
    contextNotes.forEach((note) => addParagraph(ctx, note));
  }
}

function renderDomainDetail(ctx: PdfContext, payload: ReportPayload): void {
  addSection(ctx, 'Bewertung im Detail');
  addParagraph(
    ctx,
    'Pro Domäne sehen Sie unten Ihre Antworten auf der 0-4-Skala. Notizen werden eingerückt unter der jeweiligen Frage angezeigt.',
    { size: 9, color: BRANDING.colors.muted },
  );

  payload.domains.forEach((domain) => {
    const domainQuestions = payload.questions.filter((q) => q.domainId === domain.id);
    if (!domainQuestions.length) return;

    const domainScore = payload.score?.domainScores.find((d) => d.domainId === domain.id);
    const heading = domainScore ? `${domain.label} (${domainScore.score}/100)` : domain.label;

    ensureSpace(ctx, 10);
    ctx.pdf.setFont('helvetica', 'bold');
    ctx.pdf.setFontSize(11);
    setTextHex(ctx, BRANDING.colors.bordeaux);
    ctx.pdf.text(heading, ctx.margin, ctx.y);
    ctx.y += 6;
    setTextHex(ctx, BRANDING.colors.black);

    domainQuestions.forEach((question) => {
      const answer = payload.answers[question.id];
      const criticalMarker = question.critical ? '  [KRITISCH]' : '';
      const titleLine = `${question.title}${criticalMarker}`;
      const titleLines = ctx.pdf.splitTextToSize(titleLine, ctx.contentWidth);
      ensureSpace(ctx, titleLines.length * 5 + 6);
      ctx.pdf.setFont('helvetica', 'normal');
      ctx.pdf.setFontSize(10);
      ctx.pdf.text(titleLines, ctx.margin, ctx.y);
      ctx.y += titleLines.length * 5;

      ctx.pdf.setFont('helvetica', 'italic');
      ctx.pdf.setFontSize(9);
      setTextHex(ctx, BRANDING.colors.muted);
      ctx.pdf.text(`Antwort: ${getScoreOptionText(answer?.score)}`, ctx.margin + 4, ctx.y);
      ctx.y += 4;
      setTextHex(ctx, BRANDING.colors.black);

      const note = answer?.note?.trim();
      if (note) {
        ctx.pdf.setFont('helvetica', 'italic');
        ctx.pdf.setFontSize(9);
        setTextHex(ctx, BRANDING.colors.mauve);
        const noteLines = ctx.pdf.splitTextToSize(`Notiz: ${note}`, ctx.contentWidth - 6);
        ensureSpace(ctx, noteLines.length * 4 + 2);
        ctx.pdf.text(noteLines, ctx.margin + 4, ctx.y);
        ctx.y += noteLines.length * 4 + 1;
        setTextHex(ctx, BRANDING.colors.black);
      }
      ctx.y += 1;
    });
    ctx.y += 2;
  });
}

function renderRecommendations(ctx: PdfContext, payload: ReportPayload): void {
  addSection(ctx, 'Top-Empfehlungen für Ihre nächsten 90 Tage');

  if (!payload.score || payload.score.recommendations.length === 0) {
    addParagraph(
      ctx,
      'Beantworten Sie die Resilienz-Fragen vollständig, um konkrete Top-Empfehlungen zu erhalten.',
    );
    return;
  }

  payload.score.recommendations.forEach((rec, index) => {
    ensureSpace(ctx, 22);
    if (rec.urgency === 'hoch') {
      setFillHex(ctx, BRANDING.colors.bordeaux);
      ctx.pdf.rect(ctx.margin - 3, ctx.y - 2, 1.5, 18, 'F');
    }

    ctx.pdf.setFont('helvetica', 'normal');
    ctx.pdf.setFontSize(8);
    setTextHex(ctx, BRANDING.colors.muted);
    ctx.pdf.text(rec.domainLabel.toUpperCase(), ctx.margin, ctx.y);
    ctx.pdf.text(
      `PRIORITÄT: ${rec.urgency.toUpperCase()}`,
      ctx.margin + ctx.contentWidth - ctx.pdf.getTextWidth(`PRIORITÄT: ${rec.urgency.toUpperCase()}`),
      ctx.y,
    );
    ctx.y += 4;

    setTextHex(ctx, BRANDING.colors.black);
    ctx.pdf.setFont('helvetica', 'bold');
    ctx.pdf.setFontSize(10.5);
    const titleLines = ctx.pdf.splitTextToSize(`${index + 1}. ${rec.title}`, ctx.contentWidth);
    ctx.pdf.text(titleLines, ctx.margin, ctx.y);
    ctx.y += titleLines.length * 5 + 1;

    ctx.pdf.setFont('helvetica', 'normal');
    ctx.pdf.setFontSize(10);
    const actionLines = ctx.pdf.splitTextToSize(rec.action, ctx.contentWidth);
    ensureSpace(ctx, actionLines.length * 5 + 2);
    ctx.pdf.text(actionLines, ctx.margin, ctx.y);
    ctx.y += actionLines.length * 5 + 4;
  });
}

function renderModuleSection(ctx: PdfContext, payload: ReportPayload): void {
  if (!payload.modulePack) return;
  addPageBreak(ctx);
  const pack = payload.modulePack;
  addSection(ctx, `Ihr Branchenmodul: ${pack.name}`);
  if (pack.description) {
    addParagraph(ctx, pack.description);
  }

  const hints = pack.kritisExtension?.hints ?? [];
  if (hints.length > 0) {
    addParagraph(ctx, 'Branchen-Hinweise zur KRITIS-Einordnung:', { size: 10 });
    addBullets(ctx, hints);
  }

  const requirements = pack.kritisExtension?.additionalRequirements ?? [];
  if (requirements.length > 0) {
    addParagraph(ctx, 'Sektorspezifische Anforderungen:', { size: 10 });
    requirements.forEach((req) => {
      ensureSpace(ctx, 18);
      const severityLabel = `[${req.severity.toUpperCase()}]`;
      ctx.pdf.setFont('helvetica', 'bold');
      ctx.pdf.setFontSize(10.5);
      setTextHex(ctx, BRANDING.colors.bordeaux);
      ctx.pdf.text(severityLabel, ctx.margin, ctx.y);
      const sevWidth = ctx.pdf.getTextWidth(severityLabel);
      setTextHex(ctx, BRANDING.colors.black);
      const titleLines = ctx.pdf.splitTextToSize(`  ${req.title}`, ctx.contentWidth - sevWidth);
      ctx.pdf.text(titleLines, ctx.margin + sevWidth, ctx.y);
      ctx.y += Math.max(5, titleLines.length * 5);

      ctx.pdf.setFont('helvetica', 'normal');
      ctx.pdf.setFontSize(10);
      const descLines = ctx.pdf.splitTextToSize(req.description, ctx.contentWidth);
      ensureSpace(ctx, descLines.length * 5 + 4);
      ctx.pdf.text(descLines, ctx.margin, ctx.y);
      ctx.y += descLines.length * 5 + 1;

      if (req.guidance) {
        ctx.pdf.setFont('helvetica', 'italic');
        ctx.pdf.setFontSize(9);
        setTextHex(ctx, BRANDING.colors.mauve);
        const guidanceLines = ctx.pdf.splitTextToSize(req.guidance, ctx.contentWidth);
        ensureSpace(ctx, guidanceLines.length * 4 + 2);
        ctx.pdf.text(guidanceLines, ctx.margin, ctx.y);
        ctx.y += guidanceLines.length * 4 + 2;
        setTextHex(ctx, BRANDING.colors.black);
      }
      ctx.y += 2;
    });
  }
}

function renderHowToContinue(ctx: PdfContext): void {
  addPageBreak(ctx);

  // Bordeaux-Akzentband oben
  setFillHex(ctx, BRANDING.colors.bordeaux);
  ctx.pdf.rect(0, 0, ctx.pageWidth, 14, 'F');
  ctx.y = 22;

  addSection(ctx, 'Wie geht es weiter?');
  addParagraph(
    ctx,
    'Dieser Bericht ist eine Selbsteinschätzung und ersetzt keine rechtsverbindliche Einordnung. Eine vertiefte Prüfung empfehlen wir gemeinsam mit unserem Team.',
  );

  addParagraph(ctx, 'Drei Schritte, die wir empfehlen:', { size: 10 });
  addBullets(ctx, [
    '1. Dieser Bericht als Diskussionsgrundlage in Ihrer Geschäftsführung.',
    '2. Vertiefte Bewertung der kritischen Punkte mit qualifizierter Beratung.',
    '3. Aufbau einer belastbaren Resilienz-Organisation.',
  ]);

  const partner2HasContact = Boolean(BRANDING.partner2.url) || Boolean(BRANDING.partner2.contactEmail);

  // Beratungs-Block, prominent als eigene Sub-Section
  ensureSpace(ctx, 14);
  ctx.pdf.setFont('helvetica', 'bold');
  ctx.pdf.setFontSize(12);
  setTextHex(ctx, BRANDING.colors.bordeaux);
  ctx.pdf.text('Nächster Schritt: vertiefte Beratung', ctx.margin, ctx.y);
  ctx.y += 6;
  setTextHex(ctx, BRANDING.colors.black);

  addBullets(ctx, [
    'Workshop zur Roadmap-Priorisierung',
    'Aufbau Resilienz-Organisation',
    'Begleitung Gap-Schließung mit Wiedervorlage',
  ]);

  // Klickbarer mailto-Link
  ctx.pdf.setFont('helvetica', 'normal');
  ctx.pdf.setFontSize(10);
  ensureSpace(ctx, 6);
  ctx.pdf.text('Beratungsanfrage senden:', ctx.margin, ctx.y);
  ctx.y += 5;
  setTextHex(ctx, BRANDING.colors.bordeaux);
  if (BRANDING.partner1.contactEmail) {
    ctx.pdf.textWithLink(BRANDING.partner1.contactEmail, ctx.margin + 4, ctx.y, {
      url: BRANDING.consultingUrl,
    });
    ctx.y += 6;
  }
  setTextHex(ctx, BRANDING.colors.black);

  if (partner2HasContact) {
    ctx.pdf.setFont('helvetica', 'bold');
    ctx.pdf.setFontSize(10.5);
    ensureSpace(ctx, 6);
    ctx.pdf.text(BRANDING.partner2.name, ctx.margin, ctx.y);
    ctx.y += 5;
    ctx.pdf.setFont('helvetica', 'normal');
    ctx.pdf.setFontSize(10);
    if (BRANDING.partner2.contactEmail) {
      setTextHex(ctx, BRANDING.colors.bordeaux);
      ctx.pdf.textWithLink(BRANDING.partner2.contactEmail, ctx.margin + 4, ctx.y, {
        url: `mailto:${BRANDING.partner2.contactEmail}`,
      });
      ctx.y += 5;
      setTextHex(ctx, BRANDING.colors.black);
    }
    if (BRANDING.partner2.url) {
      setTextHex(ctx, BRANDING.colors.bordeaux);
      ctx.pdf.textWithLink(BRANDING.partner2.url, ctx.margin + 4, ctx.y, { url: BRANDING.partner2.url });
      ctx.y += 6;
      setTextHex(ctx, BRANDING.colors.black);
    }
  }

  // Allgemeiner Kontakt-Block (Webseiten)
  if (BRANDING.partner1.url) {
    ensureSpace(ctx, 6);
    ctx.pdf.setFont('helvetica', 'normal');
    ctx.pdf.setFontSize(9);
    setTextHex(ctx, BRANDING.colors.muted);
    ctx.pdf.text('Webseite:', ctx.margin, ctx.y);
    setTextHex(ctx, BRANDING.colors.bordeaux);
    ctx.pdf.textWithLink(BRANDING.partner1.url, ctx.margin + 18, ctx.y, {
      url: BRANDING.partner1.url,
    });
    ctx.y += 6;
    setTextHex(ctx, BRANDING.colors.black);
  }

  // Disclaimer ganz unten
  ctx.y = ctx.pageHeight - 16;
  addDivider(ctx, BRANDING.colors.mauve);
  ctx.pdf.setFont('helvetica', 'italic');
  ctx.pdf.setFontSize(8);
  setTextHex(ctx, BRANDING.colors.muted);
  const disclaimer = `Stand der Indikatoren-Konfiguration: ${indicatorsConfig.version}. Schwellenwerte können sich mit Inkrafttreten der KRITIS-Rechtsverordnung ändern.`;
  const disclaimerLines = ctx.pdf.splitTextToSize(disclaimer, ctx.contentWidth);
  ctx.pdf.text(disclaimerLines, ctx.margin, ctx.y);
}

export function buildReportPdf(payload: ReportPayload): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.setProperties({
    title: payload.companyName?.trim()
      ? `KRITIS-Kompass · ${payload.companyName}`
      : 'KRITIS-Kompass · Resilienz-Bericht',
    author: BRANDING.partner1.name,
    creator: BRANDING.appName,
    subject: 'KRITIS-Selbstanalyse · Resilienz-Bericht',
  });
  const margin = 16;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const ctx: PdfContext = {
    pdf,
    margin,
    pageWidth,
    pageHeight,
    contentWidth: pageWidth - margin * 2,
    y: margin,
  };

  renderCoverPage(ctx, payload);
  addPageBreak(ctx);
  renderManagementSummary(ctx, payload);
  addPageBreak(ctx);
  renderKritisEinordnung(ctx, payload);
  addPageBreak(ctx);
  renderDomainDetail(ctx, payload);
  addPageBreak(ctx);
  renderRecommendations(ctx, payload);
  if (payload.modulePack) {
    renderModuleSection(ctx, payload);
  }
  renderHowToContinue(ctx);

  return pdf;
}

export function downloadReportPdf(payload: ReportPayload, filename?: string): void {
  const pdf = buildReportPdf(payload);
  const fname =
    filename ??
    `kritis-kompass-bericht-${payload.companyName ? safeFilename(payload.companyName) + '-' : ''}${payload.reportDate.toISOString().slice(0, 10)}.pdf`;
  pdf.save(fname);
}
