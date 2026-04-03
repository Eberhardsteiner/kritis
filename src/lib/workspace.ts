import { defaultDocumentFolders, getAccessProfile } from '../data/workspaceBase';
import type {
  ActionItem,
  ComplianceCalendar,
  DeadlineItem,
  DeadlineSummary,
  DocumentLibrarySummary,
  EvidenceItem,
  KritisApplicability,
  PermissionKey,
  ReviewPlan,
  UserRoleProfile,
} from '../types';

function normalizeDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addYears(value: string, years: number): string {
  const date = normalizeDate(value);
  if (!date) {
    return '';
  }

  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return formatDate(next);
}

function todayStart(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function diffDays(value: string): number | null {
  const date = normalizeDate(value);
  if (!date) {
    return null;
  }

  const ms = date.getTime() - todayStart().getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function getStatusFromDate(value: string): 'overdue' | 'soon' | 'planned' | 'open' {
  const days = diffDays(value);
  if (days === null) {
    return 'open';
  }
  if (days < 0) {
    return 'overdue';
  }
  if (days <= 30) {
    return 'soon';
  }
  return 'planned';
}

function buildActionDeadlines(actions: ActionItem[]): DeadlineItem[] {
  return actions
    .filter((action) => action.status !== 'done')
    .map((action) => ({
      id: `action-${action.id}`,
      title: action.title || 'Maßnahme offen',
      category: 'maßnahme' as const,
      dueDate: action.dueDate,
      status: getStatusFromDate(action.dueDate),
      owner: action.owner || 'Verantwortung offen',
      sourceLabel: action.sourceLabel,
      description: action.description || action.notes || 'Offene Maßnahme ohne zusätzliche Beschreibung.',
    }));
}

function buildDocumentDeadlines(evidenceItems: EvidenceItem[]): DeadlineItem[] {
  const deadlines: DeadlineItem[] = [];

  evidenceItems.forEach((item) => {
    if (item.reviewDate) {
      deadlines.push({
        id: `review-${item.id}`,
        title: item.title || 'Dokumentenreview',
        category: 'review',
        dueDate: item.reviewDate,
        status: getStatusFromDate(item.reviewDate),
        owner: item.reviewer || item.owner || 'Review offen',
        sourceLabel: item.folder || item.sourceLabel,
        description: 'Reviewtermin für Dokument, Nachweis oder Evidenz.',
      });
    }

    if (item.validUntil) {
      deadlines.push({
        id: `validity-${item.id}`,
        title: `${item.title || 'Dokument'} - Gültigkeit`,
        category: 'dokument',
        dueDate: item.validUntil,
        status: getStatusFromDate(item.validUntil),
        owner: item.owner || 'Verantwortung offen',
        sourceLabel: item.folder || item.sourceLabel,
        description: 'Ablauf- oder Gültigkeitsdatum des Dokuments.',
      });
    }
  });

  return deadlines;
}

function buildReviewPlanDeadlines(reviewPlan: ReviewPlan): DeadlineItem[] {
  return [
    {
      id: 'review-internal-audit',
      title: 'Internes Audit',
      category: 'review',
      dueDate: reviewPlan.nextInternalAuditDate,
      status: getStatusFromDate(reviewPlan.nextInternalAuditDate),
      owner: reviewPlan.executiveSponsor || reviewPlan.approver || 'Auditverantwortung offen',
      sourceLabel: 'Reviewplan',
      description: 'Geplanter Termin für das interne Audit.',
    },
    {
      id: 'review-management',
      title: 'Management-Review',
      category: 'review',
      dueDate: reviewPlan.nextManagementReviewDate,
      status: getStatusFromDate(reviewPlan.nextManagementReviewDate),
      owner: reviewPlan.approver || reviewPlan.executiveSponsor || 'Freigabe offen',
      sourceLabel: 'Reviewplan',
      description: 'Regeltermin für Review, Restrisiko und Managemententscheid.',
    },
    {
      id: 'review-exercise',
      title: 'Übung / Test',
      category: 'review',
      dueDate: reviewPlan.nextExerciseDate,
      status: getStatusFromDate(reviewPlan.nextExerciseDate),
      owner: reviewPlan.executiveSponsor || 'Übungsverantwortung offen',
      sourceLabel: 'Reviewplan',
      description: 'Nächster Übungs- oder Testtermin.',
    },
    {
      id: 'review-evidence-library',
      title: 'Evidenz-Review',
      category: 'review',
      dueDate: reviewPlan.nextEvidenceReviewDate,
      status: getStatusFromDate(reviewPlan.nextEvidenceReviewDate),
      owner: reviewPlan.approver || 'Bibliotheksreview offen',
      sourceLabel: 'Reviewplan',
      description: 'Regeltermin für die Durchsicht des Evidenz- und Dokumentenregisters.',
    },
  ];
}

function buildComplianceDeadlines(
  complianceCalendar: ComplianceCalendar,
  applicability: KritisApplicability,
): DeadlineItem[] {
  const deadlines: DeadlineItem[] = [];

  if (applicability.status !== 'eher_unwahrscheinlich') {
    deadlines.push({
      id: 'compliance-registration',
      title: 'Registrierung kritischer Anlage',
      category: 'regulatorisch',
      dueDate: complianceCalendar.registrationDate ? '' : '2026-07-17',
      status: complianceCalendar.registrationDate ? 'planned' : 'soon',
      owner: complianceCalendar.incidentContact || 'Betreiberkontakt offen',
      sourceLabel: '§ 8 KRITISDachG',
      description: complianceCalendar.registrationDate
        ? `Registrierung dokumentiert am ${complianceCalendar.registrationDate}.`
        : 'Registrierung spätestens bis 17.07.2026 bzw. drei Monate nach Eintritt der KRITIS-Eigenschaft vorbereiten.',
    });

    deadlines.push({
      id: 'compliance-risk',
      title: 'Nächste Betreiber-Risikoanalyse',
      category: 'regulatorisch',
      dueDate: addYears(complianceCalendar.lastRiskAssessmentDate, 4),
      status: complianceCalendar.lastRiskAssessmentDate
        ? getStatusFromDate(addYears(complianceCalendar.lastRiskAssessmentDate, 4))
        : 'open',
      owner: complianceCalendar.incidentContact || 'Programmverantwortung offen',
      sourceLabel: '§ 12 KRITISDachG',
      description: complianceCalendar.lastRiskAssessmentDate
        ? 'Mindestens alle vier Jahre, bei Bedarf früher.'
        : 'Letztes Risikoanalyse-Datum fehlt. Turnus sollte mindestens alle vier Jahre nachvollziehbar sein.',
    });

    deadlines.push({
      id: 'compliance-resilience-plan',
      title: 'Resilienzplan aktualisieren',
      category: 'regulatorisch',
      dueDate: addYears(
        complianceCalendar.lastResiliencePlanUpdate || complianceCalendar.lastRiskAssessmentDate,
        4,
      ),
      status: complianceCalendar.lastResiliencePlanUpdate || complianceCalendar.lastRiskAssessmentDate
        ? getStatusFromDate(
            addYears(
              complianceCalendar.lastResiliencePlanUpdate || complianceCalendar.lastRiskAssessmentDate,
              4,
            ),
          )
        : 'open',
      owner: complianceCalendar.incidentBackupContact || complianceCalendar.incidentContact || 'Planverantwortung offen',
      sourceLabel: '§ 13 KRITISDachG',
      description: complianceCalendar.lastResiliencePlanUpdate || complianceCalendar.lastRiskAssessmentDate
        ? 'Aktualisierung bei Bedarf und nach neuer Risikoanalyse.'
        : 'Datum der letzten Planaktualisierung fehlt.',
    });

    deadlines.push({
      id: 'compliance-it-audit',
      title: 'IT-/OT-Nachweise erneuern',
      category: 'regulatorisch',
      dueDate: addYears(complianceCalendar.lastBsiEvidenceAuditDate, 3),
      status: complianceCalendar.lastBsiEvidenceAuditDate
        ? getStatusFromDate(addYears(complianceCalendar.lastBsiEvidenceAuditDate, 3))
        : 'open',
      owner: complianceCalendar.incidentContact || 'IT-Nachweis offen',
      sourceLabel: '§ 39 BSIG',
      description: complianceCalendar.lastBsiEvidenceAuditDate
        ? 'Nachweise durch Audits, Prüfungen oder Zertifizierungen danach alle drei Jahre.'
        : 'Letztes IT-/OT-Nachweisdatum fehlt.',
    });

    if (!complianceCalendar.incidentContact.trim()) {
      deadlines.push({
        id: 'compliance-incident-contact',
        title: 'Meldekontakt für Vorfälle definieren',
        category: 'regulatorisch',
        dueDate: '',
        status: 'open',
        owner: 'Geschäftsleitung / Compliance',
        sourceLabel: '§ 18 KRITISDachG',
        description: 'Erstmeldung innerhalb von 24 Stunden und ausführlicher Bericht innerhalb eines Monats müssen organisatorisch abgesichert sein.',
      });
    }
  }

  return deadlines;
}

function sortDeadlineItems(items: DeadlineItem[]): DeadlineItem[] {
  const statusRank = { overdue: 0, open: 1, soon: 2, planned: 3 };
  return [...items].sort((a, b) => {
    const statusDelta = statusRank[a.status] - statusRank[b.status];
    if (statusDelta !== 0) {
      return statusDelta;
    }

    if (!a.dueDate && !b.dueDate) {
      return a.title.localeCompare(b.title);
    }
    if (!a.dueDate) {
      return -1;
    }
    if (!b.dueDate) {
      return 1;
    }

    return a.dueDate.localeCompare(b.dueDate);
  });
}

export function buildDeadlineSummary(params: {
  actionItems: ActionItem[];
  evidenceItems: EvidenceItem[];
  reviewPlan: ReviewPlan;
  complianceCalendar: ComplianceCalendar;
  applicability: KritisApplicability;
}): DeadlineSummary {
  const items = sortDeadlineItems([
    ...buildActionDeadlines(params.actionItems),
    ...buildDocumentDeadlines(params.evidenceItems),
    ...buildReviewPlanDeadlines(params.reviewPlan),
    ...buildComplianceDeadlines(params.complianceCalendar, params.applicability),
  ]);

  return {
    total: items.length,
    overdue: items.filter((item) => item.status === 'overdue' || item.status === 'open').length,
    dueSoon: items.filter((item) => item.status === 'soon').length,
    regulatory: items.filter((item) => item.category === 'regulatorisch').length,
    nextItems: items.slice(0, 12),
  };
}

export function buildDocumentLibrarySummary(evidenceItems: EvidenceItem[]): DocumentLibrarySummary {
  const folderCount = new Map<string, number>();
  let attachedFiles = 0;
  let dueReviews = 0;
  let expired = 0;
  let expiringSoon = 0;
  let missingFolder = 0;

  evidenceItems.forEach((item) => {
    const folder = item.folder?.trim() || 'Nicht zugeordnet';
    folderCount.set(folder, (folderCount.get(folder) ?? 0) + 1);

    if (!item.folder?.trim()) {
      missingFolder += 1;
    }
    if (item.attachment || item.serverAttachment) {
      attachedFiles += 1;
    }

    const reviewDays = diffDays(item.reviewDate);
    if (reviewDays !== null && reviewDays <= 30) {
      dueReviews += 1;
    }

    const validDays = diffDays(item.validUntil);
    if (validDays !== null) {
      if (validDays < 0) {
        expired += 1;
      } else if (validDays <= 30) {
        expiringSoon += 1;
      }
    }
  });

  const byFolder = [...folderCount.entries()]
    .map(([folder, count]) => ({ folder, count }))
    .sort((a, b) => b.count - a.count || a.folder.localeCompare(b.folder));

  return {
    total: evidenceItems.length,
    attachedFiles,
    dueReviews,
    expired,
    expiringSoon,
    missingFolder,
    byFolder,
  };
}

export function getDocumentFolderSuggestions(
  moduleFolders: string[] | undefined,
  evidenceItems: EvidenceItem[],
): string[] {
  const entries = new Set<string>(defaultDocumentFolders);
  (moduleFolders ?? []).forEach((folder) => {
    if (folder.trim()) {
      entries.add(folder.trim());
    }
  });
  evidenceItems.forEach((item) => {
    if (item.folder.trim()) {
      entries.add(item.folder.trim());
    }
  });

  return [...entries].sort((a, b) => a.localeCompare(b));
}

export function hasPermission(roleProfile: UserRoleProfile, permission: PermissionKey): boolean {
  return getAccessProfile(roleProfile).permissions.includes(permission);
}
