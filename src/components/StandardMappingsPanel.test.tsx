import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StandardMappingsPanel } from './StandardMappingsPanel';
import type { StandardControlReference } from '../types';

const mixedMappings: StandardControlReference[] = [
  {
    standardId: 'iso_27001_2022',
    controlId: 'A.5.24',
    controlTitle: 'Planung und Vorbereitung des Managements von Informationssicherheitsvorfällen',
    relevance: 'primary',
  },
  {
    standardId: 'iso_27001_2022',
    controlId: 'A.6.8',
    controlTitle: 'Meldung von Informationssicherheitsereignissen',
    relevance: 'secondary',
    note: 'Mitarbeiterebene, flankierend zum Regime-Prozess.',
  },
  {
    standardId: 'bsi_grundschutz_2023',
    controlId: 'DER.2.1',
    controlTitle: 'Behandlung von Sicherheitsvorfällen',
    relevance: 'primary',
  },
];

describe('StandardMappingsPanel', () => {
  it('rendert nichts bei leerer Mapping-Liste', () => {
    const { container } = render(<StandardMappingsPanel mappings={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('zeigt die Trefferzahl und die Zahl der betroffenen Standards', () => {
    render(<StandardMappingsPanel mappings={mixedMappings} />);
    expect(screen.getByText(/3 Treffer/)).toBeInTheDocument();
    expect(screen.getByText(/in 2 Standards/)).toBeInTheDocument();
  });

  it('ist standardmäßig eingeklappt und zeigt keine Controls', () => {
    render(<StandardMappingsPanel mappings={mixedMappings} />);
    expect(screen.queryByText('A.5.24')).toBeNull();
    const toggle = screen.getByRole('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('klappt beim Klick auf und zeigt Controls gruppiert nach Standard mit Relevanz-Chip', () => {
    render(<StandardMappingsPanel mappings={mixedMappings} />);
    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('ISO/IEC 27001:2022')).toBeInTheDocument();
    expect(screen.getByText('BSI IT-Grundschutz 2023')).toBeInTheDocument();
    expect(screen.getByText('A.5.24')).toBeInTheDocument();
    expect(screen.getByText('DER.2.1')).toBeInTheDocument();
    expect(screen.getAllByText('Direkt abgedeckt').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Teilweise abgedeckt')).toBeInTheDocument();
  });

  it('zeigt die Note, wenn vorhanden', () => {
    render(<StandardMappingsPanel mappings={mixedMappings} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/Mitarbeiterebene, flankierend/)).toBeInTheDocument();
  });

  it('startet offen, wenn defaultOpen=true', () => {
    render(<StandardMappingsPanel mappings={mixedMappings} defaultOpen />);
    expect(screen.getByText('A.5.24')).toBeInTheDocument();
  });
});
