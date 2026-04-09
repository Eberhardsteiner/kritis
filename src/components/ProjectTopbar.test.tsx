import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectTopbar } from './ProjectTopbar';

describe('ProjectTopbar', () => {
  it('renders the project controls and forwards key actions', () => {
    const onSelectActiveUser = vi.fn();
    const onSyncNow = vi.fn();
    const onExportJson = vi.fn();
    const onProfileFieldChange = vi.fn();
    const onSelectModule = vi.fn();

    render(
      <ProjectTopbar
        activeUserId="usr-1"
        userOptions={[{ id: 'usr-1', label: 'Max Mustermann · Programmadmin' }]}
        authSession={null}
        serverStatusConnected
        serverStatusLabel="Offener Arbeitsbereich aktiv"
        activeAccessProfileLabel="Programmadmin"
        tenantChipLabel="Arbeitsbereich: Musterwerke"
        accountChipLabel=""
        canSync
        canExportJson
        companyProfile={{
          companyName: 'Musterwerke GmbH',
          industryLabel: 'Industrie',
          locations: '3 Standorte',
          employees: '850',
          criticalService: 'Versorgung',
          personsServed: '500000',
        }}
        selectedModuleId="industry-core"
        moduleOptions={[{ id: 'industry-core', name: 'Industrie' }]}
        onSelectActiveUser={onSelectActiveUser}
        onSyncNow={onSyncNow}
        onExportJson={onExportJson}
        onProfileFieldChange={onProfileFieldChange}
        onSelectModule={onSelectModule}
      />,
    );

    expect(screen.getByText(/Unternehmensprofil und aktives Branchenmodul/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Musterwerke GmbH')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /jetzt synchronisieren/i }));
    fireEvent.click(screen.getByRole('button', { name: /json exportieren/i }));
    fireEvent.change(screen.getByDisplayValue('Musterwerke GmbH'), { target: { value: 'Neue Werke AG' } });

    expect(onSyncNow).toHaveBeenCalledTimes(1);
    expect(onExportJson).toHaveBeenCalledTimes(1);
    expect(onProfileFieldChange).toHaveBeenCalledWith('companyName', 'Neue Werke AG');
  });
});
