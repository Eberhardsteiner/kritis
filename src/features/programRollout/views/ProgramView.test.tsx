import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgramView } from './ProgramView';

describe('ProgramView', () => {
  it('shows the current P4 status and the next roadmap steps', () => {
    render(
      <ProgramView
        companyName="Musterwerke GmbH"
        moduleName="Industrie"
        overallScore={74}
        requirementScore={68}
        evidenceCoverage={71}
        exportCount={5}
      />,
    );

    expect(screen.getByText(/Produktpaket P4 ist aktuell aktiv/i)).toBeInTheDocument();
    expect(screen.getByText(/Version 2.1.0/i)).toBeInTheDocument();
    expect(screen.getByText(/P5: Produktionsplattform/i)).toBeInTheDocument();
    expect(screen.getByText(/P6: Pilotbetrieb, UAT und Rollout/i)).toBeInTheDocument();
  });
});
