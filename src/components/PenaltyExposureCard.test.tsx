import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PenaltyExposureCard } from './PenaltyExposureCard';

describe('PenaltyExposureCard', () => {
  it('zeigt 0 € und einen grünen Ton, wenn keine offenen Tatbestände vorliegen', () => {
    const { container } = render(
      <PenaltyExposureCard penaltyEstimate={{ upperBound: 0, rationale: [] }} />,
    );
    expect(screen.getByText('0 €')).toBeInTheDocument();
    expect(screen.getByText(/Keine offenen Tatbestände/)).toBeInTheDocument();
    expect(container.querySelector('.stat-card.success')).not.toBeNull();
  });

  it('zeigt warn-Ton für Expositionen unter 500.000 €', () => {
    const { container } = render(
      <PenaltyExposureCard
        penaltyEstimate={{
          upperBound: 200_000,
          rationale: ['Verstoß gegen Anordnungen zu Nachweisen: bis 200.000 € (§ 24 KRITISDachG).'],
        }}
      />,
    );
    expect(screen.getByText('200.000 €')).toBeInTheDocument();
    expect(container.querySelector('.stat-card.warn')).not.toBeNull();
  });

  it('zeigt danger-Ton für Expositionen über 500.000 €', () => {
    const { container } = render(
      <PenaltyExposureCard
        penaltyEstimate={{
          upperBound: 1_100_000,
          rationale: [
            'Verstoß gegen Auskunftspflichten: bis 1.000.000 € (§ 24 KRITISDachG).',
            'Unvollständige Registrierung: bis 100.000 € (§ 24 KRITISDachG).',
          ],
        }}
      />,
    );
    expect(screen.getByText('1.100.000 €')).toBeInTheDocument();
    expect(container.querySelector('.stat-card.danger')).not.toBeNull();
  });

  it('listet die Begründungen aus dem PenaltyEstimate als Aufzählung', () => {
    render(
      <PenaltyExposureCard
        penaltyEstimate={{
          upperBound: 500_000,
          rationale: ['Nichtvorlage von Auditergebnissen: bis 500.000 € (§ 24 KRITISDachG).'],
        }}
      />,
    );
    expect(screen.getByText(/Nichtvorlage von Auditergebnissen/)).toBeInTheDocument();
  });

  it('verweist auf den Disclaimer zur Einzelfallbewertung und Sanktionsstart 2027', () => {
    render(<PenaltyExposureCard penaltyEstimate={{ upperBound: 0, rationale: [] }} />);
    expect(screen.getByText(/ab 2027 wirksam/)).toBeInTheDocument();
  });
});
