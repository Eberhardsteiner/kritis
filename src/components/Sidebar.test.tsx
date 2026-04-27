import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('shows the current sprint status and allows navigation', () => {
    const onChange = vi.fn();

    render(<Sidebar activeView="program" onChange={onChange} />);

    expect(screen.getByText('Sprint P4')).toBeInTheDocument();
    expect(screen.getByText(/Status 2.1.0/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /übersicht/i }));
    expect(onChange).toHaveBeenCalledWith('dashboard');
  });

  it('rendert das Brand-Logo als statisches div, wenn onLogoClick fehlt', () => {
    const onChange = vi.fn();
    render(<Sidebar activeView="dashboard" onChange={onChange} />);

    // Kein Splash-Anker-Button vorhanden, wenn onLogoClick nicht gesetzt
    expect(
      screen.queryByRole('button', { name: /Zurück zur Splash-Startseite/i }),
    ).not.toBeInTheDocument();
    // Logo-Inhalt ist trotzdem da
    expect(screen.getByText('KF')).toBeInTheDocument();
    expect(screen.getByText('Krisenfestigkeit Monitor')).toBeInTheDocument();
  });

  it('rendert das Brand-Logo als Button mit aria-label, wenn onLogoClick gesetzt ist', () => {
    const onChange = vi.fn();
    const onLogoClick = vi.fn();
    render(
      <Sidebar activeView="dashboard" onChange={onChange} onLogoClick={onLogoClick} />,
    );

    const splashButton = screen.getByRole('button', {
      name: /Zurück zur Splash-Startseite/i,
    });
    expect(splashButton).toBeInTheDocument();
    // Button enthält die KF-Markierung und den Titel
    expect(splashButton).toHaveTextContent('KF');
    expect(splashButton).toHaveTextContent('Krisenfestigkeit Monitor');
  });

  it('Klick auf das Logo triggert onLogoClick (Splash-Navigations-Anker)', () => {
    const onChange = vi.fn();
    const onLogoClick = vi.fn();
    render(
      <Sidebar activeView="dashboard" onChange={onChange} onLogoClick={onLogoClick} />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Zurück zur Splash-Startseite/i }),
    );

    expect(onLogoClick).toHaveBeenCalledTimes(1);
    // onChange darf nicht versehentlich getriggert werden
    expect(onChange).not.toHaveBeenCalled();
  });
});
