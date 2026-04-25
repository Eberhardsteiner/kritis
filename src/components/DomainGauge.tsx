/**
 * DomainGauge · Halbkreis-Tachometer für einen Domain-Score.
 *
 * Bewusst SVG statt Recharts: Recharts ist nicht im Bundle (≈200 KB
 * Mehrgewicht), und ein Halbkreis-Gauge ist mit einer einzigen
 * Pfadberechnung beschrieben. Die Geometrie steckt vollständig in
 * `describeArc` und ist mit drei Stütz-Scores (0/50/100) sanity-
 * checkbar.
 *
 * Die Farbe leitet sich aus dem Score ab — weicher Verlauf von Rot
 * (0) über Gelb (50) nach Grün (100), via HSL-Interpolation. Damit
 * gibt es keine harten Sprungstellen an den 33%/66%-Schwellen, die
 * Wahrnehmung folgt der Score-Skala kontinuierlich.
 *
 * Zwei Bögen werden gestapelt:
 *  - Hintergrund: voller Halbkreis in `--line`-Farbe.
 *  - Vordergrund: Anteil des Scores, eingefärbt via HSL-Lookup.
 *
 * Score und Kurz-Label stehen in der Mitte; das volle Domain-Label
 * landet im `title`-Attribut der `figure`, sodass ein Hover-Tooltip
 * ohne JS-Layer den vollständigen Domain-Namen + Beschreibung zeigt.
 */

interface DomainGaugeProps {
  /** Score-Wert 0..100. Werte außerhalb werden geklammert. */
  score: number;
  /** Kurz-Label unter dem Score (z. B. „Standorte"). */
  shortLabel: string;
  /** Voller Domain-Name + ggf. Beschreibung für den Hover-Tooltip. */
  tooltip: string;
  /** Erweiterungs-Klassen-Name für das wrapper-`figure`-Element. */
  className?: string;
}

const VIEW_WIDTH = 140;
const VIEW_HEIGHT = 92;
const CENTER_X = 70;
const CENTER_Y = 76;
const RADIUS = 56;
const STROKE_WIDTH = 12;

/**
 * SVG-Arc-Path für einen Halbkreis von links nach rechts, gefüllt bis
 * `progress` (0..1). progress=0 → zero-length arc (SVG-konform leer);
 * progress=1 → voller Halbkreis.
 *
 *  - Start fix bei Winkel π (links).
 *  - End-Winkel: π - π·progress (im Uhrzeigersinn auf dem Bildschirm).
 *  - SVG-y ist invertiert, daher `centerY - radius·sin(...)`.
 */
function describeArc(progress: number): string {
  const clamped = Math.max(0, Math.min(1, progress));
  const endAngle = Math.PI - Math.PI * clamped;
  const endX = CENTER_X + RADIUS * Math.cos(endAngle);
  const endY = CENTER_Y - RADIUS * Math.sin(endAngle);
  const sweepFlag = 1; // im Uhrzeigersinn auf dem Bildschirm
  const largeArcFlag = 0; // immer ≤ 180°
  const startX = CENTER_X - RADIUS;
  const startY = CENTER_Y;
  return `M ${startX} ${startY} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} ${sweepFlag} ${endX.toFixed(2)} ${endY.toFixed(2)}`;
}

/**
 * Score-zu-Farbe-Mapping: HSL-Interpolation von Rot (Hue 0) über Gelb
 * (Hue 60) nach Grün (Hue 120). Saturation und Lightness sind fix
 * gewählt für ausreichende Lesbarkeit auf weißem Karten-Hintergrund:
 * S=72%, L=44%. Damit liegen alle Farben im gleichen
 * Wahrnehmungsband.
 */
export function scoreToHslColor(score: number): string {
  const clamped = Math.max(0, Math.min(100, score));
  const hue = clamped * 1.2; // 0 → 0 (rot), 50 → 60 (gelb), 100 → 120 (grün)
  return `hsl(${hue.toFixed(0)}, 72%, 44%)`;
}

export function DomainGauge({ score, shortLabel, tooltip, className }: DomainGaugeProps) {
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  const backgroundArc = describeArc(1);
  const foregroundArc = describeArc(safeScore / 100);
  const accent = scoreToHslColor(safeScore);

  return (
    <figure
      className={['domain-gauge-card', className].filter(Boolean).join(' ')}
      title={tooltip}
    >
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label={`${shortLabel}: ${safeScore}%`}
        className="domain-gauge-svg"
      >
        <path
          d={backgroundArc}
          fill="none"
          stroke="var(--line)"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
        />
        <path
          d={foregroundArc}
          fill="none"
          stroke={accent}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
        />
        <text
          x={CENTER_X}
          y={CENTER_Y - 6}
          textAnchor="middle"
          className="domain-gauge-value"
          fill={accent}
        >
          {safeScore}
          <tspan className="domain-gauge-percent" fill={accent}>%</tspan>
        </text>
      </svg>
      <figcaption className="domain-gauge-shortlabel">{shortLabel}</figcaption>
    </figure>
  );
}
