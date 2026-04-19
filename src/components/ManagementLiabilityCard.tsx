import { Gavel } from 'lucide-react';
import type { KritisMilestones } from '../lib/regulatory';
import type { KritisEntityStatus, RegulatoryProfile } from '../types';

interface ManagementLiabilityCardProps {
  regulatoryProfile: RegulatoryProfile;
  milestones: KritisMilestones;
}

const entityStatusLabels: Record<KritisEntityStatus, string> = {
  not_identified: 'Kritikalität noch nicht geprüft',
  identified_not_registered: 'Identifiziert, noch nicht registriert',
  registered: 'Registriert, Pflichten aktivieren sich',
  obligations_active: 'Pflichten aktiv',
};

function getStatusTone(status: KritisEntityStatus): 'outline' | 'warn' | 'danger' {
  if (status === 'obligations_active') {
    return 'danger';
  }
  if (status === 'registered') {
    return 'warn';
  }
  return 'outline';
}

export function ManagementLiabilityCard({ regulatoryProfile, milestones }: ManagementLiabilityCardProps) {
  const status: KritisEntityStatus = regulatoryProfile.kritisEntityStatus ?? 'not_identified';
  const statusLabel = entityStatusLabels[status];
  const activeAt = milestones.managementAccountabilityActiveAt;
  const boardContact = regulatoryProfile.managementBoardContact?.trim();
  const programOwner = regulatoryProfile.owner?.trim();

  return (
    <article className="card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Geschäftsleitung</p>
          <h3>Haftung nach § 20 KRITISDachG</h3>
        </div>
        <div className="stage-icon">
          <Gavel size={18} />
        </div>
      </div>

      <div className="chip-row top-gap">
        <span className={`chip ${getStatusTone(status)}`}>{statusLabel}</span>
        {activeAt ? (
          <span className="chip outline">Pflichten aktiv ab {activeAt}</span>
        ) : (
          <span className="chip outline">Pflichten aktiv: Registrierung offen</span>
        )}
      </div>

      <p className="top-gap">
        Die Geschäftsleitung stellt die Umsetzung und Überwachung der Resilienzmaßnahmen sicher.
        Bei Pflichtverletzung kommt eine <strong>persönliche Haftung der Leitungsorgane nach
        allgemeinem Gesellschaftsrecht</strong> in Betracht.
      </p>

      <div className="priority-list top-gap">
        <div className="priority-item compact-item">
          <div>
            <strong>Geschäftsleitung (benannt)</strong>
            <p className="muted small">Adressat der persönlichen Haftung nach § 20 KRITISDachG.</p>
          </div>
          <span className="chip outline">{boardContact || 'Noch nicht hinterlegt'}</span>
        </div>
        <div className="priority-item compact-item">
          <div>
            <strong>Programmverantwortung</strong>
            <p className="muted small">Operativer Owner für Compliance und Nachweisführung.</p>
          </div>
          <span className="chip outline">{programOwner || 'Noch nicht hinterlegt'}</span>
        </div>
      </div>

      <ul className="plain-list top-gap">
        <li>Berichtswege und Entscheidungen der Leitungsebene protokollieren.</li>
        <li>Budget- und Ressourcenentscheidungen zu Resilienzmaßnahmen dokumentieren.</li>
        <li>Kadenz für Managementreviews und Restrisiko-Freigaben festlegen.</li>
      </ul>
    </article>
  );
}
