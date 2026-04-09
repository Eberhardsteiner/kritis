import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActiveViewPanel, type ActiveViewPanelProps } from './ActiveViewPanel';

vi.mock('../views/ProgramView', () => ({
  ProgramView: () => <div>Programm-Ansicht Mock</div>,
}));

describe('ActiveViewPanel', () => {
  it('shows the read-only hint and renders the selected lazy view', async () => {
    const props: ActiveViewPanelProps = {
      activeView: 'program',
      readOnlyHint: 'Lesemodus aktiv.',
      programViewProps: {
        companyName: 'Musterwerke GmbH',
        moduleName: 'Industrie',
        overallScore: 74,
        requirementScore: 68,
        evidenceCoverage: 71,
        exportCount: 5,
      },
      dashboardViewProps: {} as ActiveViewPanelProps['dashboardViewProps'],
      assessmentViewProps: {} as ActiveViewPanelProps['assessmentViewProps'],
      measuresViewProps: {} as ActiveViewPanelProps['measuresViewProps'],
      governanceViewProps: {} as ActiveViewPanelProps['governanceViewProps'],
      resilienceViewProps: {} as ActiveViewPanelProps['resilienceViewProps'],
      controlViewProps: {} as ActiveViewPanelProps['controlViewProps'],
      platformViewProps: {} as ActiveViewPanelProps['platformViewProps'],
      operationsViewProps: {} as ActiveViewPanelProps['operationsViewProps'],
      rolloutViewProps: {} as ActiveViewPanelProps['rolloutViewProps'],
      modulesViewProps: {} as ActiveViewPanelProps['modulesViewProps'],
      kritisViewProps: {} as ActiveViewPanelProps['kritisViewProps'],
      reportViewProps: {} as ActiveViewPanelProps['reportViewProps'],
    };

    render(<ActiveViewPanel {...props} />);

    expect(screen.getByText('Lesemodus aktiv.')).toBeInTheDocument();
    expect(await screen.findByText('Programm-Ansicht Mock')).toBeInTheDocument();
  });
});
