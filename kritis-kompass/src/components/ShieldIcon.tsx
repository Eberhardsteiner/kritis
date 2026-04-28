// Schild-Icon, das im Radar-Zentrum, im AppHeader und (optional) als
// Markenelement im PDF-Cover wiederverwendet wird. Die Pfad-Geometrie
// ist auf einem 26x32-Schild zentriert auf (0,0) gezeichnet — beim
// Einbau muss die Komponente per Wrapper-SVG positioniert werden.

interface ShieldIconProps {
  className?: string;
  size?: number;
  /** Stroke- und Schriftfarbe. Default = Bordeaux. */
  color?: string;
  /** Darunter liegende Fuellfarbe der Schild-Form. Default = transparent. */
  fillColor?: string;
  /** Farbe der "K"-Beschriftung. Default = #f5ebef. */
  letterColor?: string;
  /** Wenn true, wird der "K"-Text gerendert. */
  withLetter?: boolean;
}

export function ShieldIcon({
  className,
  size = 26,
  color = '#c43960',
  fillColor = 'transparent',
  letterColor = '#f5ebef',
  withLetter = true,
}: ShieldIconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size * (32 / 26)}
      viewBox="-13 -16 26 32"
      fill="none"
      stroke={color}
      strokeWidth={1.4}
      aria-hidden
    >
      <path
        d="M0,-13 L11,-8 L11,3 C11,12 5,16 0,18 C-5,16 -11,12 -11,3 L-11,-8 Z"
        fill={fillColor}
        strokeLinejoin="round"
      />
      {withLetter ? (
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fill={letterColor}
          stroke="none"
          fontSize="11"
          fontWeight="500"
          fontFamily="Inter, system-ui, sans-serif"
        >
          K
        </text>
      ) : null}
    </svg>
  );
}
