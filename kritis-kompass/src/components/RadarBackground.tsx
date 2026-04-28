import { BRANDING } from '../config/branding';

interface RadarBackgroundProps {
  /** SVG-Renderbreite in CSS-Pixeln. Default 320 — das interne viewBox bleibt 680x480. */
  size?: number;
  sweepEnabled?: boolean;
  pulseEnabled?: boolean;
  /**
   * Wenn true (Mobile-Modus), werden die Kurzlabels (`short`) statt der
   * Voll-Labels gezeichnet. Vermeidet Überlappung bei < 600 px Viewport.
   */
  useShortLabels?: boolean;
  className?: string;
}

// Pre-berechnete Dot-Positionen auf Radius 120 vom Zentrum (340, 250).
// Reihenfolge: 12 Uhr im Uhrzeigersinn.
interface DotSpec {
  cx: number;
  cy: number;
  /** SVG text-anchor */
  anchor: 'start' | 'middle' | 'end';
  /** Versatz vom Dot (in SVG-Einheiten) zum Label-Anker. */
  dx: number;
  dy: number;
  /** Pulse-Gruppe 0/1/2 — bestimmt animation-delay. */
  pulseGroup: 0 | 1 | 2;
}

const DOT_SPECS: readonly DotSpec[] = [
  { cx: 340, cy: 130, anchor: 'middle', dx: 0, dy: -12, pulseGroup: 0 }, // GOV  - 12 Uhr
  { cx: 425, cy: 165, anchor: 'start', dx: 10, dy: -6, pulseGroup: 1 },   // OPS  - 1.30
  { cx: 460, cy: 250, anchor: 'start', dx: 12, dy: 4, pulseGroup: 2 },    // PER  - 3 Uhr
  { cx: 425, cy: 335, anchor: 'start', dx: 10, dy: 14, pulseGroup: 0 },   // STD  - 4.30
  { cx: 340, cy: 370, anchor: 'middle', dx: 0, dy: 18, pulseGroup: 1 },   // CYB  - 6 Uhr
  { cx: 255, cy: 335, anchor: 'end', dx: -10, dy: 14, pulseGroup: 2 },    // SUP  - 7.30
  { cx: 220, cy: 250, anchor: 'end', dx: -12, dy: 4, pulseGroup: 0 },     // FIN  - 9 Uhr
  { cx: 255, cy: 165, anchor: 'end', dx: -10, dy: -6, pulseGroup: 1 },    // BCM  - 10.30
];

export function RadarBackground({
  size = 320,
  sweepEnabled = true,
  pulseEnabled = true,
  useShortLabels = false,
  className,
}: RadarBackgroundProps) {
  const dimensions = BRANDING.dimensions;
  return (
    <svg
      viewBox="0 0 680 480"
      width={size}
      height={(size * 480) / 680}
      className={className}
      role="img"
      aria-label="Resilienz-Radar mit acht Bewertungs-Dimensionen"
    >
      <defs>
        <radialGradient id="radar-aura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8b1538" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#8b1538" stopOpacity={0} />
        </radialGradient>
        <linearGradient
          id="sweep-gradient"
          gradientUnits="userSpaceOnUse"
          x1="340"
          y1="250"
          x2="470"
          y2="250"
        >
          <stop offset="0" stopColor="#c43960" stopOpacity={0} />
          <stop offset="1" stopColor="#c43960" stopOpacity={0.5} />
        </linearGradient>
      </defs>

      <style>{`
        .sweep-arm {
          transform-origin: 340px 250px;
          ${sweepEnabled ? 'animation: kk-sweep 6s linear infinite;' : 'transform: rotate(30deg);'}
        }
        @keyframes kk-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .pulse-dot {
          transform-box: fill-box;
          transform-origin: center;
          ${pulseEnabled ? 'animation: kk-pulse 2.5s ease-in-out infinite;' : ''}
        }
        .pulse-dot[data-group="1"] { animation-delay: 0.8s; }
        .pulse-dot[data-group="2"] { animation-delay: 1.6s; }
        @keyframes kk-pulse {
          0%   { transform: scale(1);   opacity: 0.85; }
          50%  { transform: scale(1.5); opacity: 1;    }
          100% { transform: scale(1);   opacity: 0.85; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sweep-arm { animation: none; transform: rotate(30deg); }
          .pulse-dot { animation: none; }
        }
      `}</style>

      {/* Hintergrund */}
      <rect x={0} y={0} width={680} height={480} fill="#0a0510" />
      <rect x={0} y={0} width={680} height={480} fill="url(#radar-aura)" />

      {/* Crosshairs */}
      <g stroke="#3a1825" strokeWidth={0.5}>
        <line x1={340} y1={70} x2={340} y2={430} />
        <line x1={140} y1={250} x2={540} y2={250} />
        <line x1={199} y1={109} x2={481} y2={391} />
        <line x1={481} y1={109} x2={199} y2={391} />
      </g>

      {/* Konzentrische Ringe */}
      <g stroke="#3a1825" strokeWidth={0.6} fill="none">
        <circle cx={340} cy={250} r={40} />
        <circle cx={340} cy={250} r={80} />
        <circle cx={340} cy={250} r={120} />
      </g>
      <circle
        cx={340}
        cy={250}
        r={130}
        stroke="#c43960"
        strokeWidth={0.8}
        strokeDasharray="2 4"
        fill="none"
      />

      {/* Sweep-Strahl */}
      <g className="sweep-arm">
        <path
          d="M 340 250 L 470 250 A 130 130 0 0 0 408 138 Z"
          fill="url(#sweep-gradient)"
        />
        <line
          x1={340}
          y1={250}
          x2={470}
          y2={250}
          stroke="#c43960"
          strokeWidth={1}
          opacity={0.7}
        />
      </g>

      {/* Acht Dimensions-Dots + Labels */}
      {DOT_SPECS.map((dot, index) => {
        const dim = dimensions[index];
        const labelText = useShortLabels ? dim.short : dim.label;
        return (
          <g key={dim.key}>
            <circle
              className="pulse-dot"
              cx={dot.cx}
              cy={dot.cy}
              r={4}
              fill="#c43960"
              data-group={dot.pulseGroup}
            />
            <text
              x={dot.cx + dot.dx}
              y={dot.cy + dot.dy}
              fill="#f5ebef"
              fontSize={9}
              fontFamily="Inter, system-ui, sans-serif"
              fontWeight="500"
              letterSpacing="0.5"
              textAnchor={dot.anchor}
            >
              {labelText}
            </text>
          </g>
        );
      })}

      {/* Zentrum: kleines Schild */}
      <circle cx={340} cy={250} r={20} fill="#1a0a14" stroke="#c43960" strokeWidth={1.2} />
      <g transform="translate(340 250)">
        <path
          d="M0,-13 L11,-8 L11,3 C11,12 5,16 0,18 C-5,16 -11,12 -11,3 L-11,-8 Z"
          fill="none"
          stroke="#c43960"
          strokeWidth={1}
          strokeLinejoin="round"
        />
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#f5ebef"
          fontSize={11}
          fontWeight="500"
          fontFamily="Inter, system-ui, sans-serif"
        >
          K
        </text>
      </g>
    </svg>
  );
}
