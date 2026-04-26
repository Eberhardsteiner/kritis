/**
 * ControlView.test.tsx · Beratungs-Tagessatz-Card (C5.4.1)
 *
 * Fokus-Tests für die in C5.4.1 hierher umgesiedelte
 * ConsultingRateSettings-UI. Die übrigen Sektionen (User-Verwaltung,
 * Compliance-Kalender, Fristen-Cockpit, Dokumentenbibliothek) sind
 * über andere Komponenten getestet — hier nur der Tagessatz-
 * Konfigurations-Pfad, der vorher im GapAnalysisDashboard war.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ControlView } from './ControlView';
import { accessProfiles } from '../../../data/workspaceBase';
import type {
  ComplianceCalendar,
  ConsultingRateSettings,
  DeadlineSummary,
  DocumentLibrarySummary,
  UserItem,
} from '../../../types';

const userFixture: UserItem = {
  id: 'user-test',
  name: 'Demo Tester',
  email: 'demo@example.com',
  department: 'IT',
  roleProfile: 'admin',
  status: 'active',
  scope: '',
  notes: '',
};

const complianceCalendarFixture: ComplianceCalendar = {
  registrationDate: '',
  lastRiskAssessmentDate: '',
  lastResiliencePlanUpdate: '',
  lastBsiEvidenceAuditDate: '',
  bsigRegistrationDate: '',
  lastCyberRiskAssessmentDate: '',
  lastIncidentExerciseDate: '',
  incidentContact: '',
  incidentBackupContact: '',
};

const documentLibrarySummaryFixture: DocumentLibrarySummary = {
  total: 0,
  dueReviews: 0,
  expired: 0,
  expiringSoon: 0,
  attachedFiles: 0,
  missingFolder: 0,
  byFolder: [],
};

const deadlineSummaryFixture: DeadlineSummary = {
  total: 0,
  overdue: 0,
  dueSoon: 0,
  regulatory: 0,
  nextItems: [],
};

function renderControlView(overrides: Partial<{
  consultingRate: ConsultingRateSettings | null;
  onConsultingRateChange: (rate: ConsultingRateSettings) => void;
}> = {}) {
  const onConsultingRateChange =
    overrides.onConsultingRateChange ?? vi.fn<(rate: ConsultingRateSettings) => void>();
  return {
    onConsultingRateChange,
    ...render(
      <ControlView
        users={[userFixture]}
        activeUserId={userFixture.id}
        activeAccessProfile={accessProfiles[0]}
        documentLibrarySummary={documentLibrarySummaryFixture}
        deadlineSummary={deadlineSummaryFixture}
        complianceCalendar={complianceCalendarFixture}
        consultingRate={
          overrides.consultingRate === undefined ? null : overrides.consultingRate
        }
        onSelectActiveUser={vi.fn()}
        onCreateUser={vi.fn()}
        onGenerateUsersFromStakeholders={vi.fn()}
        onUpdateUser={vi.fn()}
        onDeleteUser={vi.fn()}
        onUpdateComplianceCalendar={vi.fn()}
        onConsultingRateChange={onConsultingRateChange}
      />,
    ),
  };
}

describe('ControlView · Beratungs-Tagessatz-Card', () => {
  it('rendert die Tagessatz-Card mit Heading und Beschreibung', () => {
    renderControlView();
    expect(screen.getByText('Beratungs-Tagessatz')).toBeInTheDocument();
    expect(
      screen.getByText(/Kalkulationsbasis für Aufwandsschätzung und Angebotsgrundlage/i),
    ).toBeInTheDocument();
  });

  it('zeigt bei consultingRate=null den Default-Wert 1500 EUR plus "noch nicht konfiguriert"-Hinweis', () => {
    renderControlView({ consultingRate: null });
    const rateInput = screen.getByLabelText(/Tagessatz pro PT/i) as HTMLInputElement;
    expect(rateInput.value).toBe('1500');
    expect(screen.getByText(/Noch nicht konfiguriert/i)).toBeInTheDocument();
  });

  it('zeigt bei konfiguriertem consultingRate den hinterlegten Wert', () => {
    renderControlView({
      consultingRate: { ratePerPersonDay: 1850, currency: 'CHF', note: 'UVM-Senior 2026' },
    });
    const rateInput = screen.getByLabelText(/Tagessatz pro PT/i) as HTMLInputElement;
    expect(rateInput.value).toBe('1850');
    const currencySelect = screen.getByLabelText(/Währung/i) as HTMLSelectElement;
    expect(currencySelect.value).toBe('CHF');
    const noteTextarea = screen.getByLabelText('Notiz (optional)') as HTMLTextAreaElement;
    expect(noteTextarea.value).toBe('UVM-Senior 2026');
    expect(screen.getByText(/^Konfiguriert$/i)).toBeInTheDocument();
  });

  it('ruft onConsultingRateChange beim Klick auf "Tagessatz aktualisieren" mit dem aktuellen Form-Wert auf', () => {
    const onConsultingRateChange = vi.fn<(rate: ConsultingRateSettings) => void>();
    renderControlView({ onConsultingRateChange, consultingRate: null });

    const rateInput = screen.getByLabelText(/Tagessatz pro PT/i) as HTMLInputElement;
    fireEvent.change(rateInput, { target: { value: '1800' } });

    fireEvent.click(screen.getByRole('button', { name: /Tagessatz aktualisieren/i }));

    expect(onConsultingRateChange).toHaveBeenCalledTimes(1);
    const submitted = onConsultingRateChange.mock.calls[0][0];
    expect(submitted.ratePerPersonDay).toBe(1800);
    expect(submitted.currency).toBe('EUR');
    expect(submitted.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('schreibt die optionale Notiz nur, wenn sie nicht-leer ist', () => {
    const onConsultingRateChange = vi.fn<(rate: ConsultingRateSettings) => void>();
    renderControlView({ onConsultingRateChange });

    const noteTextarea = screen.getByLabelText('Notiz (optional)') as HTMLTextAreaElement;
    fireEvent.change(noteTextarea, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /Tagessatz aktualisieren/i }));

    const submittedEmpty = onConsultingRateChange.mock.calls[0][0];
    expect(submittedEmpty.note).toBeUndefined();

    fireEvent.change(noteTextarea, { target: { value: 'UVM-Junior-Tagessatz Q2/2026' } });
    fireEvent.click(screen.getByRole('button', { name: /Tagessatz aktualisieren/i }));

    const submittedWithNote = onConsultingRateChange.mock.calls[1][0];
    expect(submittedWithNote.note).toBe('UVM-Junior-Tagessatz Q2/2026');
  });

  it('lehnt ungültige Eingaben ab und zeigt Fehlerhinweis', () => {
    const onConsultingRateChange = vi.fn<(rate: ConsultingRateSettings) => void>();
    renderControlView({ onConsultingRateChange });

    const rateInput = screen.getByLabelText(/Tagessatz pro PT/i) as HTMLInputElement;
    fireEvent.change(rateInput, { target: { value: '-50' } });
    fireEvent.click(screen.getByRole('button', { name: /Tagessatz aktualisieren/i }));

    expect(onConsultingRateChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Bitte einen gültigen Tagessatz/i)).toBeInTheDocument();
  });
});
