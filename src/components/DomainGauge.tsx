/**
 * DomainGauge · Halbkreis-Tachometer für Domain-Scores im Dashboard.
 *
 * Bewusst SVG statt Recharts: Recharts ist nicht im Bundle (≈200 KB
 * Mehrgewicht), und ein Halbkreis-Gauge ist mit einer einzigen
 * Pfadberechnung beschrieben. Geometrie steckt vollständig in
 * `describeArc` und ist im Test mit drei Stütz-Scores (0/50/100)
 * sanity-checkbar.
 *
 * Zwei Bögen werden gestapelt:
 *  - Hintergrund: voller Halbkreis in `--line`-Farbe.
 *  - Vordergrund: Anteil des Scores, eingefärbt (Prop `accent`).
 *
 * Der Score steht als Großzahl in der Mitte, das Domain-Label
 * darunter — beides text-anchor: middle, damit die Komponente
 * gleichmäßig in beliebiger Container-Breite zentriert.
 */

interface DomainGaugeProps {
  /** Score-Wert 0..100. Werte außerhalb werden geklammert. */
  score: number;
  /** Anzeige-Label unter dem Tacho (z. B. „Governance & Verantwortung"). */
  label: string;
  /** Kurze Beschreibung über dem Tacho (z. B. „Stärkste Domäne"). */
  caption: string;
  /** Foreground-Farbe (Hex). Default ist neutral-blau. */
  accent?: string;
  /**
   * Erweiterungs-Klassen-Name für das wrapper-`figure`-Element.
   * Erlaubt das Layout (Grid-Span etc.) von außen zu steuern.
   */
  className?: string;
}

const VIEW_WIDTH = 200;
const VIEW_HEIGHT = 130;
const CENTER_X = 100;
const CENTER_Y = 100;
const RADIUS = 80;
const STROKE_WIDTH = 16;

/**
 * Berechnet einen SVG-Arc-Path-`d` für einen Halbkreis von links nach
 * rechts, der bis zu `progress` (0..1) gefüllt ist. progress=0 → leerer
 * Bogen (zero-length arc, SVG-konform), progress=1 → voller Halbkreis.
 *
 * Mathematischer Hintergrund:
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

export function DomainGauge({ score, label, caption, accent = '#1d4ed8', className }: DomainGaugeProps) {
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  const backgroundArc = describeArc(1);
  const foregroundArc = describeArc(safeScore / 100);

  return (
    <figure className={['domain-gauge', className].filter(Boolean).join(' ')}>
      <figcaption className="domain-gauge-caption">{caption}</figcaption>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label={`${caption}: ${label} mit ${safeScore} von 100`}
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
          y={CENTER_Y - 12}
          textAnchor="middle"
          className="domain-gauge-value"
          fill={accent}
        >
          {safeScore}
        </text>
        <text
          x={CENTER_X}
          y={CENTER_Y + 14}
          textAnchor="middle"
          className="domain-gauge-unit"
        >
          / 100
        </text>
      </svg>
      <div className="domain-gauge-label">{label}</div>
    </figure>
  );
}
