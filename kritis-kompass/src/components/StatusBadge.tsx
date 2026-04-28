import type { ApplicabilityStatus } from '../types';

interface StatusBadgeProps {
  status: ApplicabilityStatus;
  label: string;
}

const STATUS_STYLES: Record<ApplicabilityStatus, string> = {
  direkt_betroffen: 'bg-bordeaux text-white',
  pruefbeduerftig: 'bg-[#d09038] text-schwarz',
  indirekt_betroffen: 'bg-mauve text-white',
  eher_nicht_betroffen: 'border-2 border-[#7a5060] text-[#7a5060] bg-transparent',
};

const STATUS_LABEL: Record<ApplicabilityStatus, string> = {
  direkt_betroffen: 'Direkt betroffen',
  pruefbeduerftig: 'Prüfbedürftig',
  indirekt_betroffen: 'Indirekt betroffen',
  eher_nicht_betroffen: 'Eher nicht betroffen',
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-wide ${STATUS_STYLES[status]}`}
      aria-label={`Status: ${STATUS_LABEL[status]}`}
    >
      {label}
    </span>
  );
}

export function getStatusShortLabel(status: ApplicabilityStatus): string {
  return STATUS_LABEL[status];
}
