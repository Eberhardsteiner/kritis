/**
 * SplashScreen · UVM-Splash für den Eintritt in die Plattform (C5.5)
 *
 * Schwarz-Bordeaux-Splash mit subtilem Hexagon-Raster, UVM-Slogan
 * "Zukunftsfähigkeit ist kein Zufall" und einem Plattform-öffnen-CTA.
 * Erscheint einmal pro Browser-Session (sessionStorage-gepuffert in
 * AppShell), kann via Ctrl+Shift+S für Demos zurückgesetzt werden.
 *
 * Layout: vollflächig (position: fixed, inset: 0). Hintergrund per
 * linear-gradient (180° Schwarz mit Bordeaux-Stich). Hexagon-Raster
 * als inline-SVG ohne externe Asset-Abhängigkeit, mit zentraler
 * radialer Aura für räumliche Tiefe. Vordergrund-Inhalte zentriert
 * via Flexbox, responsive für Mobile (< 600 px) mit reduzierten
 * Schriftgrößen.
 *
 * Designspezifikation aus C5.5 (mit Dr. Steiner abgestimmt):
 * - Gradient: #1a0a14 → #0d0612 → #050308
 * - Aura: #8b1538 mit Opacity 0.25
 * - Hexagon-Raster: Stroke #3a1825, Opacity 0.5
 * - Hervorgehobenes Hexagon: Fill #c43960, Pulsations-Animation 3s
 * - Akzent-Linien und Border: #c43960
 * - Haupt-Titel: #f5ebef
 * - Untertitel: #b08090
 */
import { useEffect, useState } from 'react';

interface SplashScreenProps {
  /**
   * Wird beim Klick auf "Plattform öffnen" oder bei Enter/Space-Tastendruck
   * aufgerufen. Die AppShell setzt darin den `showSplash`-State auf false
   * und schreibt in `sessionStorage` den Marker `uvm-splash-seen=true`.
   */
  onStart: () => void;
}

const SPLASH_KEYFRAMES = `
@keyframes uvm-splash-pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 0.4; }
}
`;

/**
 * Berechnet die SVG-Polygon-Punkte für ein Hexagon mit "spitzer Oberkante"
 * (pointy-top Layout): Spitze oben, gerade Ober- und Unterseite mit je
 * 60° Innenwinkel. Hexagon-Breite 60 px, Höhe 50 px.
 */
function hexagonPoints(x: number, y: number): string {
  return `${x},${y} ${x + 30},${y - 15} ${x + 60},${y} ${x + 60},${y + 35} ${x + 30},${y + 50} ${x},${y + 35}`;
}

/**
 * Hexagon-Raster mit drei Reihen à 6 Sechsecken. Mittlere Reihe versetzt,
 * sodass eine Bienenwaben-Anordnung entsteht. Zentrum bei x=300, y=215
 * (im 680×480-viewBox), an dem das hervorgehobene Hexagon sitzt.
 */
function HexagonGrid() {
  const rows: Array<{ y: number; offset: number }> = [
    { y: 60, offset: 0 },
    { y: 145, offset: 30 },
    { y: 230, offset: 0 },
    { y: 315, offset: 30 },
    { y: 400, offset: 0 },
  ];
  const xStart = 60;
  const xStep = 90;
  const cols = 7;
  const polygons: JSX.Element[] = [];
  rows.forEach((row, rowIdx) => {
    for (let col = 0; col < cols; col += 1) {
      const x = xStart + row.offset + col * xStep;
      const y = row.y;
      // Zentrum-Hexagon erkennen (zweite Mittelreihe, mittlere Spalte)
      const isCenter = rowIdx === 2 && col === 3;
      if (isCenter) {
        polygons.push(
          <polygon
            key={`hex-center-${rowIdx}-${col}`}
            points={hexagonPoints(x, y)}
            fill="#c43960"
            stroke="#c43960"
            strokeWidth={1}
            style={{ animation: 'uvm-splash-pulse 3s ease-in-out infinite' }}
          />,
        );
      } else {
        polygons.push(
          <polygon
            key={`hex-${rowIdx}-${col}`}
            points={hexagonPoints(x, y)}
            fill="none"
            stroke="#3a1825"
            strokeWidth={0.6}
            opacity={0.5}
          />,
        );
      }
    }
  });
  return <>{polygons}</>;
}

export function SplashScreen({ onStart }: SplashScreenProps) {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 600px)').matches;
  });
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 600px)');
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const titleSize = isMobile ? 32 : 42;
  const subtitleSize = isMobile ? 13 : 14;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="uvm-splash-title"
      style={{
        position: 'fixed',
        inset: 0,
        background:
          'linear-gradient(180deg, #1a0a14 0%, #0d0612 60%, #050308 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        zIndex: 9999,
      }}
    >
      {/* Keyframe-Animation für das pulsierende Zentrum-Hexagon */}
      <style>{SPLASH_KEYFRAMES}</style>

      {/* Hintergrund-SVG: Hexagon-Raster mit zentraler Aura */}
      <svg
        viewBox="0 0 680 480"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="uvm-splash-aura" cx="0.5" cy="0.5" r="0.6">
            <stop offset="0%" stopColor="#8b1538" stopOpacity={0.25} />
            <stop offset="60%" stopColor="#8b1538" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#8b1538" stopOpacity={0} />
          </radialGradient>
        </defs>
        {/* Aura-Schicht hinter dem Hexagon-Raster */}
        <rect x={0} y={0} width={680} height={480} fill="url(#uvm-splash-aura)" />
        <HexagonGrid />
      </svg>

      {/* Vordergrund-Inhalt zentriert */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '2rem',
          maxWidth: 540,
        }}
      >
        {/* Eyebrow-Zeile mit flankierenden Akzent-Linien */}
        {!isMobile ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: '1.5rem',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'block',
                width: 32,
                height: 1,
                background: '#c43960',
              }}
            />
            <span
              style={{
                color: '#c43960',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.4em',
                textTransform: 'uppercase',
              }}
            >
              Kritische Infrastruktur
            </span>
            <span
              aria-hidden="true"
              style={{
                display: 'block',
                width: 32,
                height: 1,
                background: '#c43960',
              }}
            />
          </div>
        ) : (
          <div
            style={{
              color: '#c43960',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.4em',
              textTransform: 'uppercase',
              marginBottom: '1.25rem',
            }}
          >
            Kritische Infrastruktur
          </div>
        )}

        {/* Haupt-Titel: "Zukunftsfähigkeit / ist kein Zufall" */}
        <h1
          id="uvm-splash-title"
          style={{
            color: '#f5ebef',
            fontSize: titleSize,
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            margin: 0,
            marginBottom: '1rem',
            whiteSpace: 'pre-line',
          }}
        >
          {'Zukunftsfähigkeit\nist kein Zufall'}
        </h1>

        {/* Untertitel */}
        <p
          style={{
            color: '#b08090',
            fontSize: subtitleSize,
            lineHeight: 1.6,
            margin: 0,
            marginBottom: '2.5rem',
            maxWidth: 440,
          }}
        >
          Resilienz-Plattform für KRITIS-Betreiber und NIS2-pflichtige Einrichtungen.
        </p>

        {/* CTA-Button "Plattform öffnen" */}
        <button
          type="button"
          onClick={onStart}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onFocus={() => setHover(true)}
          onBlur={() => setHover(false)}
          style={{
            background: hover ? 'rgba(196, 57, 96, 0.1)' : 'transparent',
            border: '1px solid #c43960',
            borderRadius: 2,
            color: '#f5ebef',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '0.15em',
            padding: '14px 40px',
            textTransform: 'uppercase',
            transition: 'background 160ms ease',
          }}
        >
          Plattform öffnen
        </button>
      </div>
    </div>
  );
}
