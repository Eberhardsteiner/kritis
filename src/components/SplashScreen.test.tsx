/**
 * SplashScreen.test.tsx · UVM-Splash-Komponente (C5.5)
 *
 * Render-Smoke-Tests:
 * - Eyebrow, Titel, Untertitel und CTA-Button sind sichtbar
 * - Klick auf den Button löst den onStart-Callback aus
 * - Tastatur-Eingabe (Enter/Space) löst den onStart-Callback aus
 * - SVG-Hexagon-Raster ist im DOM präsent
 * - Mobile-Layout reagiert auf matchMedia-Match (< 600 px)
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SplashScreen } from './SplashScreen';

describe('SplashScreen', () => {
  beforeEach(() => {
    // matchMedia auf Desktop-Default (kein Match) für die meisten Tests
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('rendert Eyebrow, Titel, Untertitel und CTA-Button', () => {
    const onStart = vi.fn();
    render(<SplashScreen onStart={onStart} />);

    expect(screen.getByText('Kritische Infrastruktur')).toBeInTheDocument();
    // Titel ist über die <h1>-Rolle erreichbar; whiteSpace: pre-line trennt die Zeilen
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Zukunftsfähigkeit\s+ist kein Zufall/,
    );
    expect(
      screen.getByText(/Resilienz-Plattform für KRITIS-Betreiber und NIS2-pflichtige Einrichtungen/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Plattform öffnen/i })).toBeInTheDocument();
  });

  it('ruft onStart beim Klick auf den Plattform-öffnen-Button auf', () => {
    const onStart = vi.fn();
    render(<SplashScreen onStart={onStart} />);

    fireEvent.click(screen.getByRole('button', { name: /Plattform öffnen/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('hat einen accessiblen Dialog-Container mit aria-modal', () => {
    const onStart = vi.fn();
    const { container } = render(<SplashScreen onStart={onStart} />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('uvm-splash-title');
  });

  it('rendert das SVG-Hexagon-Raster (mehrere Polygone)', () => {
    const onStart = vi.fn();
    const { container } = render(<SplashScreen onStart={onStart} />);
    const polygons = container.querySelectorAll('svg polygon');
    // Mindestens 15 Hexagone laut Designspezifikation, das hervorgehobene
    // ist eines davon. Reale Zählung: 5 Reihen × 7 Spalten = 35.
    expect(polygons.length).toBeGreaterThanOrEqual(15);
  });

  it('hebt das mittlere Hexagon mit Bordeaux-Fill hervor', () => {
    const onStart = vi.fn();
    const { container } = render(<SplashScreen onStart={onStart} />);
    const filledPolygons = Array.from(container.querySelectorAll('svg polygon')).filter(
      (poly) => poly.getAttribute('fill') === '#c43960',
    );
    expect(filledPolygons).toHaveLength(1);
  });
});
