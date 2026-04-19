import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ManagementLiabilityCard } from './ManagementLiabilityCard';
import { defaultRegulatoryProfile } from '../lib/regulatory';
import type { KritisMilestones } from '../lib/regulatory';
import type { RegulatoryProfile } from '../types';

const emptyMilestones: KritisMilestones = { earliestRegistrationAt: '2026-07-17' };

function withProfile(overrides: Partial<RegulatoryProfile> = {}): RegulatoryProfile {
  return { ...defaultRegulatoryProfile, ...overrides };
}

describe('ManagementLiabilityCard', () => {
  it('verweist auf § 20 KRITISDachG und die persönliche Haftung nach Gesellschaftsrecht', () => {
    render(<ManagementLiabilityCard regulatoryProfile={withProfile()} milestones={emptyMilestones} />);
    expect(screen.getByRole('heading', { name: /§ 20 KRITISDachG/ })).toBeInTheDocument();
    expect(screen.getByText(/persönliche Haftung der Leitungsorgane nach/)).toBeInTheDocument();
  });

  it('zeigt bei not_identified den Default-Status und keinen Aktivierungstermin', () => {
    render(<ManagementLiabilityCard regulatoryProfile={withProfile({ kritisEntityStatus: 'not_identified' })} milestones={emptyMilestones} />);
    expect(screen.getByText('Kritikalität noch nicht geprüft')).toBeInTheDocument();
    expect(screen.getByText(/Registrierung offen/)).toBeInTheDocument();
  });

  it('zeigt bei registered den Aktivierungstermin aus den Milestones', () => {
    render(
      <ManagementLiabilityCard
        regulatoryProfile={withProfile({ kritisEntityStatus: 'registered' })}
        milestones={{ earliestRegistrationAt: '2026-07-17', managementAccountabilityActiveAt: '2027-07-01' }}
      />,
    );
    expect(screen.getByText('Registriert, Pflichten aktivieren sich')).toBeInTheDocument();
    expect(screen.getByText('Pflichten aktiv ab 2027-07-01')).toBeInTheDocument();
  });

  it('zeigt managementBoardContact und owner, wenn gesetzt', () => {
    render(
      <ManagementLiabilityCard
        regulatoryProfile={withProfile({
          managementBoardContact: 'Dr. Muster · CEO',
          owner: 'Team Compliance',
        })}
        milestones={emptyMilestones}
      />,
    );
    expect(screen.getByText('Dr. Muster · CEO')).toBeInTheDocument();
    expect(screen.getByText('Team Compliance')).toBeInTheDocument();
  });

  it('zeigt "Noch nicht hinterlegt", wenn Kontaktangaben fehlen', () => {
    render(<ManagementLiabilityCard regulatoryProfile={withProfile()} milestones={emptyMilestones} />);
    expect(screen.getAllByText('Noch nicht hinterlegt')).toHaveLength(2);
  });
});
