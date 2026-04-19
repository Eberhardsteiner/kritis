import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthorityCard } from './AuthorityCard';
import type { AuthorityAssignmentResolved } from '../types';

const bbkAssignment: AuthorityAssignmentResolved = {
  regimeId: 'de_kritisdachg',
  sector: '*',
  authorityId: 'bbk',
  role: 'coordination',
  lawRef: '§ 3 Abs. 1 KRITISDachG',
  note: 'Zentrale Koordinations- und Aufsichtsstelle des Bundes.',
  authority: {
    id: 'bbk',
    shortName: 'BBK',
    fullName: 'Bundesamt für Bevölkerungsschutz und Katastrophenhilfe',
    jurisdiction: 'federal',
    website: 'https://www.bbk.bund.de',
    contactPath: '/DE/Service/Kontakt/kontakt_node.html',
  },
};

const stateAssignment: AuthorityAssignmentResolved = {
  regimeId: 'de_kritisdachg',
  sector: 'Gesundheit',
  authorityId: 'state_health',
  role: 'sector_supervision',
  lawRef: '§ 5 KRITISDachG',
  note: 'Konkrete Zuständigkeit ist landesrechtlich zu klären.',
  authority: {
    id: 'state_health',
    shortName: 'Landesbehörde (Gesundheit)',
    fullName: 'Zuständige Landesbehörde für Gesundheitswesen',
    jurisdiction: 'state',
    website: '',
    contactPath: '',
  },
};

describe('AuthorityCard', () => {
  it('zeigt Kurz- und Langform des Behördennamens', () => {
    render(<AuthorityCard assignment={bbkAssignment} />);
    expect(screen.getByText('BBK')).toBeInTheDocument();
    expect(screen.getByText('Bundesamt für Bevölkerungsschutz und Katastrophenhilfe')).toBeInTheDocument();
  });

  it('übersetzt die Rolle ins Deutsche und markiert sie als Chip', () => {
    render(<AuthorityCard assignment={bbkAssignment} />);
    expect(screen.getByText('Koordination')).toBeInTheDocument();
  });

  it('zeigt Rechtsgrundlage und optionale Note', () => {
    render(<AuthorityCard assignment={bbkAssignment} />);
    expect(screen.getByText(/§ 3 Abs\. 1 KRITISDachG/)).toBeInTheDocument();
    expect(screen.getByText(/Zentrale Koordinations- und Aufsichtsstelle/)).toBeInTheDocument();
  });

  it('rendert einen Website-Link mit sicherer rel- und target-Konfiguration', () => {
    render(<AuthorityCard assignment={bbkAssignment} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://www.bbk.bund.de/DE/Service/Kontakt/kontakt_node.html');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.textContent).toContain('www.bbk.bund.de');
  });

  it('zeigt bei fehlender Website einen Fallback-Hinweis statt Link', () => {
    render(<AuthorityCard assignment={stateAssignment} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/kein zentraler Kontaktpfad hinterlegt/)).toBeInTheDocument();
  });

  it('rendert ohne Note, wenn das Note-Feld fehlt', () => {
    const minimalAssignment: AuthorityAssignmentResolved = {
      ...bbkAssignment,
      note: undefined,
    };
    render(<AuthorityCard assignment={minimalAssignment} />);
    expect(screen.queryByText(/Zentrale Koordinations/)).toBeNull();
    expect(screen.getByText(/§ 3 Abs\. 1 KRITISDachG/)).toBeInTheDocument();
  });
});
