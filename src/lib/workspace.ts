import { defaultDocumentFolders, getAccessProfile } from '../data/workspaceBase';
import { KRITIS_EARLIEST_REGISTRATION_DATE, computeKritisMilestones, normalizeRegulatoryProfile } from './regulatory';
import type {
  ActionItem,
  ComplianceCalendar,
  DeadlineItem,
  DeadlineSummary,
  DocumentLibrarySummary,
  EvidenceItem,
  ExerciseItem,
  KritisApplicability,
  PermissionKey,
  RegulatoryProfile,
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

function addMonths(value: string, months: number): string {
  const date = normalizeDate(value);
  if (!date) {
    return '';
  }

  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
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

function buildExerciseDeadlines(exercises: ExerciseItem[]): DeadlineItem[] {
  return exercises.map((exercise) => ({
    id: `exercise-${exercise.id}`,
    title: exercise.title || 'Übung / Test',
    category: 'review' as const,
    dueDate: exercise.nextExerciseDate || exercise.exerciseDate,
    status: getStatusFromDate(exercise.nextExerciseDate || exercise.exerciseDate),
    owner: exercise.owner || 'Übungsverantwortung offen',
    sourceLabel: exercise.exerciseType || 'Übung',
    description: exercise.findings || exercise.notes || 'Nächster Übungs- oder Testtermin im operativen Resilienzregister.',
  }));
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
  regulatoryProfile: RegulatoryProfile,
): DeadlineItem[] {
  const deadlines: DeadlineItem[] = [];
  const profile = normalizeRegulatoryProfile(regulatoryProfile);

  if (profile.jurisdiction === 'AT') {
    const nisgScope = profile.scopeByRegime.at_nisg_2026;

    if (nisgScope === 'unknown') {
      deadlines.push({
        id: 'regime-at-nisg-scope',
        title: 'Scope-Prüfung NISG 2026 abschließen',
        category: 'regulatorisch',
        dueDate: '',
        status: 'open',
        owner: profile.owner || complianceCalendar.incidentContact || 'Cyber-Compliance offen',
        sourceLabel: 'NISG 2026',
        description: 'Prüfen Sie, ob die Organisation als wesentliche oder wichtige Einrichtung nach dem österreichischen NISG 2026 einzuordnen ist.',
        regimeId: 'at_nisg_2026',
      });
    }

    if (nisgScope !== 'out_of_scope') {
      if (profile.bsigEntityClass === 'unknown') {
        deadlines.push({
          id: 'at-nisg-entity-class',
          title: 'Einrichtungsklasse für NISG 2026 festlegen',
          category: 'regulatorisch',
          dueDate: '',
          status: 'open',
          owner: profile.owner || complianceCalendar.incidentContact || 'Cyber-Compliance offen',
          sourceLabel: '§ 31 NISG 2026',
          description: 'Dokumentieren Sie, ob die Organisation als wesentliche oder wichtige Einrichtung behandelt wird.',
          regimeId: 'at_nisg_2026',
        });
      }

      deadlines.push({
        id: 'at-nisg-registration',
        title: 'NISG-2026 Registrierung und Stammdatenpflege',
        category: 'regulatorisch',
        dueDate: complianceCalendar.bsigRegistrationDate ? '' : '2027-01-01',
        status: complianceCalendar.bsigRegistrationDate ? 'planned' : 'planned',
        owner: complianceCalendar.incidentContact || profile.owner || 'Cyber-Compliance offen',
        sourceLabel: '§ 29 NISG 2026',
        description: complianceCalendar.bsigRegistrationDate
          ? `Registrierung bzw. Aktualisierung dokumentiert am ${complianceCalendar.bsigRegistrationDate}.`
          : 'Für den Initialbestand ist die Registrierung grundsätzlich innerhalb von drei Monaten nach Inkrafttreten des NISG 2026 vorzubereiten.',
        regimeId: 'at_nisg_2026',
      });

      deadlines.push({
        id: 'at-nisg-risk-cycle',
        title: 'Nächste Cyber-Risikobewertung',
        category: 'regulatorisch',
        dueDate: addYears(complianceCalendar.lastCyberRiskAssessmentDate, 1),
        status: complianceCalendar.lastCyberRiskAssessmentDate
          ? getStatusFromDate(addYears(complianceCalendar.lastCyberRiskAssessmentDate, 1))
          : 'open',
        owner: profile.owner || complianceCalendar.incidentContact || 'Cyber-Risikoverantwortung offen',
        sourceLabel: '§ 32 NISG 2026',
        description: complianceCalendar.lastCyberRiskAssessmentDate
          ? 'Risikomanagementmaßnahmen und Risikoanalyse regelmäßig aktualisieren und auf Wirksamkeit prüfen.'
          : 'Letztes Datum der Cybersicherheits-Risikobewertung fehlt.',
        regimeId: 'at_nisg_2026',
      });

      deadlines.push({
        id: 'at-nisg-self-declaration',
        title: 'Selbstdeklaration vorbereiten',
        category: 'regulatorisch',
        dueDate: complianceCalendar.bsigRegistrationDate ? addYears(complianceCalendar.bsigRegistrationDate, 1) : '2027-10-01',
        status: complianceCalendar.bsigRegistrationDate
          ? getStatusFromDate(addYears(complianceCalendar.bsigRegistrationDate, 1))
          : 'planned',
        owner: complianceCalendar.incidentBackupContact || complianceCalendar.incidentContact || profile.owner || 'Nachweisverantwortung offen',
        sourceLabel: '§ 33 NISG 2026',
        description: 'Strukturierte Wirksamkeitsnachweise und Informationen zu umgesetzten Risikomanagementmaßnahmen vorbereiten.',
        regimeId: 'at_nisg_2026',
      });

      if (!complianceCalendar.incidentContact.trim()) {
        deadlines.push({
          id: 'at-nisg-incident-contact',
          title: 'CSIRT-Meldekontakt und Freigabeweg definieren',
          category: 'regulatorisch',
          dueDate: '',
          status: 'open',
          owner: profile.owner || 'Geschäftsleitung / Compliance',
          sourceLabel: '§ 34 NISG 2026',
          description: 'Frühwarnung, Vorfallmeldung und Abschlussbericht an das zuständige CSIRT organisatorisch absichern.',
          regimeId: 'at_nisg_2026',
        });
      }
    }

    return deadlines;
  }

  if (profile.jurisdiction === 'CH') {
    const chScope = profile.scopeByRegime.ch_bacs_ci;

    if (chScope === 'unknown') {
      deadlines.push({
        id: 'regime-ch-bacs-scope',
        title: 'Scope-Prüfung BACS-Meldepflicht abschließen',
        category: 'regulatorisch',
        dueDate: '',
        status: 'open',
        owner: profile.owner || complianceCalendar.incidentContact || 'Compliance offen',
        sourceLabel: 'Art. 74b ISG',
        description: 'Prüfen Sie, ob die Organisation als Betreiberin oder Betreiber kritischer Infrastruktur der schweizerischen Meldepflicht unterliegt.',
        regimeId: 'ch_bacs_ci',
      });
    }

    if (chScope !== 'out_of_scope') {
      if (!complianceCalendar.incidentContact.trim()) {
        deadlines.push({
          id: 'ch-bacs-contact',
          title: 'BACS-Meldekontakt und Meldekanal hinterlegen',
          category: 'regulatorisch',
          dueDate: '',
          status: 'open',
          owner: profile.owner || 'Geschäftsleitung / Compliance',
          sourceLabel: 'Art. 74b ISG',
          description: 'Cyber Security Hub oder alternativen Meldeweg mit Vertretung und Erreichbarkeit vorbereiten.',
          regimeId: 'ch_bacs_ci',
        });
      }

      deadlines.push({
        id: 'ch-bacs-reporting-playbook',
        title: '24-Stunden-Meldeworkflow verproben',
        category: 'regulatorisch',
        dueDate: complianceCalendar.lastIncidentExerciseDate ? addYears(complianceCalendar.lastIncidentExerciseDate, 1) : '',
        status: complianceCalendar.lastIncidentExerciseDate
          ? getStatusFromDate(addYears(complianceCalendar.lastIncidentExerciseDate, 1))
          : 'open',
        owner: complianceCalendar.incidentBackupContact || complianceCalendar.incidentContact || profile.owner || 'Meldeverantwortung offen',
        sourceLabel: 'Art. 74b ISG / Art. 16 CSV',
        description: complianceCalendar.lastIncidentExerciseDate
          ? 'Meldeweg, 24-Stunden-Frist und 14-Tage-Vervollständigung jährlich oder anlassbezogen üben.'
          : 'Noch keine dokumentierte Übung für den Schweizer Meldeprozess vorhanden.',
        regimeId: 'ch_bacs_ci',
      });

      deadlines.push({
        id: 'ch-bacs-evidence-pack',
        title: 'Vorfallsakte und Behördenkommunikation strukturieren',
        category: 'regulatorisch',
        dueDate: '',
        status: 'open',
        owner: profile.owner || complianceCalendar.incidentContact || 'Incident-Management offen',
        sourceLabel: 'Art. 74b ISG',
        description: 'Meldungen, Wirkungen, Nachreichungen und Lessons Learned für meldepflichtige Cyberangriffe revisionssicher bündeln.',
        regimeId: 'ch_bacs_ci',
      });
    }

    return deadlines;
  }

  const kritisScope = profile.scopeByRegime.de_kritisdachg;
  const bsigScope = profile.scopeByRegime.de_bsig_nis2;

  if (kritisScope === 'unknown' && applicability.status !== 'eher_unwahrscheinlich') {
    deadlines.push({
      id: 'regime-kritisdachg-scope',
      title: 'Scope-Prüfung KRITIS-DachG abschließen',
      category: 'regulatorisch',
      dueDate: '',
      status: 'open',
      owner: profile.owner || complianceCalendar.incidentContact || 'Programmverantwortung offen',
      sourceLabel: 'KRITIS-DachG',
      description: 'Prüfen Sie, ob Betreiberpflichten für kritische Anlagen oder kritische Dienstleistungen greifen.',
      regimeId: 'de_kritisdachg',
    });
  }

  if (kritisScope !== 'out_of_scope' && applicability.status !== 'eher_unwahrscheinlich') {
    const effectiveRegistrationDate =
      profile.kritisRegistrationDate || complianceCalendar.registrationDate || '';

    deadlines.push({
      id: 'compliance-kritis-registration',
      title: 'Registrierung kritischer Anlage',
      category: 'regulatorisch',
      dueDate: effectiveRegistrationDate ? '' : KRITIS_EARLIEST_REGISTRATION_DATE,
      status: effectiveRegistrationDate ? 'planned' : 'soon',
      owner: complianceCalendar.incidentContact || profile.owner || 'Betreiberkontakt offen',
      sourceLabel: '§ 8 KRITISDachG',
      description: effectiveRegistrationDate
        ? `Registrierung dokumentiert am ${effectiveRegistrationDate}.`
        : `Registrierung frühestens ${KRITIS_EARLIEST_REGISTRATION_DATE} möglich (Öffnung der gemeinsamen Plattform BBK/BSI). Stammdaten und 24/7-Kontaktstelle vorbereiten.`,
      regimeId: 'de_kritisdachg',
    });

    if (effectiveRegistrationDate) {
      const milestones = computeKritisMilestones(effectiveRegistrationDate);

      if (milestones.riskAnalysisDueAt) {
        deadlines.push({
          id: 'compliance-kritis-initial-risk-analysis',
          title: 'Erste Betreiber-Risikoanalyse fällig',
          category: 'regulatorisch',
          dueDate: milestones.riskAnalysisDueAt,
          status: getStatusFromDate(milestones.riskAnalysisDueAt),
          owner: profile.owner || complianceCalendar.incidentContact || 'Programmverantwortung offen',
          sourceLabel: '§ 12 KRITISDachG',
          description: `Erste Risikoanalyse innerhalb von 9 Monaten nach Registrierung (${effectiveRegistrationDate}) vorlegen. Danach Regelzyklus mindestens alle vier Jahre.`,
          regimeId: 'de_kritisdachg',
        });
      }

      if (milestones.resilienceMeasuresDueAt) {
        deadlines.push({
          id: 'compliance-kritis-initial-resilience-plan',
          title: 'Erster Resilienzplan fällig',
          category: 'regulatorisch',
          dueDate: milestones.resilienceMeasuresDueAt,
          status: getStatusFromDate(milestones.resilienceMeasuresDueAt),
          owner: complianceCalendar.incidentBackupContact || complianceCalendar.incidentContact || profile.owner || 'Planverantwortung offen',
          sourceLabel: '§ 13 KRITISDachG',
          description: `Resilienzmaßnahmen und Resilienzplan innerhalb von 10 Monaten nach Registrierung (${effectiveRegistrationDate}) vorlegen. Fortschreibung auf Basis der Risikoanalyse.`,
          regimeId: 'de_kritisdachg',
        });
      }

      if (milestones.managementAccountabilityActiveAt) {
        deadlines.push({
          id: 'compliance-kritis-management-active',
          title: 'Geschäftsleitungspflichten aktiv',
          category: 'regulatorisch',
          dueDate: milestones.managementAccountabilityActiveAt,
          status: getStatusFromDate(milestones.managementAccountabilityActiveAt),
          owner: profile.owner || 'Geschäftsleitung',
          sourceLabel: '§ 20 KRITISDachG',
          description: `Umsetzungs- und Überwachungspflicht der Geschäftsleitung greift 10 Monate nach Registrierung (${effectiveRegistrationDate}). Bei Pflichtverletzung kommt persönliche Haftung nach Gesellschaftsrecht in Betracht.`,
          regimeId: 'de_kritisdachg',
        });
      }
    }

    deadlines.push({
      id: 'compliance-kritis-risk',
      title: 'Nächste Betreiber-Risikoanalyse',
      category: 'regulatorisch',
      dueDate: addYears(complianceCalendar.lastRiskAssessmentDate, 4),
      status: complianceCalendar.lastRiskAssessmentDate
        ? getStatusFromDate(addYears(complianceCalendar.lastRiskAssessmentDate, 4))
        : 'open',
      owner: profile.owner || complianceCalendar.incidentContact || 'Programmverantwortung offen',
      sourceLabel: '§ 12 KRITISDachG',
      description: complianceCalendar.lastRiskAssessmentDate
        ? 'Betreiber-Risikoanalyse mindestens alle vier Jahre beziehungsweise anlassbezogen aktualisieren.'
        : 'Letztes Datum der Betreiber-Risikoanalyse fehlt.',
      regimeId: 'de_kritisdachg',
    });

    deadlines.push({
      id: 'compliance-kritis-resilience-plan',
      title: 'Resilienzplan aktualisieren',
      category: 'regulatorisch',
      dueDate: addYears(complianceCalendar.lastResiliencePlanUpdate || complianceCalendar.lastRiskAssessmentDate, 4),
      status: complianceCalendar.lastResiliencePlanUpdate || complianceCalendar.lastRiskAssessmentDate
        ? getStatusFromDate(addYears(complianceCalendar.lastResiliencePlanUpdate || complianceCalendar.lastRiskAssessmentDate, 4))
        : 'open',
      owner: complianceCalendar.incidentBackupContact || complianceCalendar.incidentContact || profile.owner || 'Planverantwortung offen',
      sourceLabel: '§ 13 KRITISDachG',
      description: complianceCalendar.lastResiliencePlanUpdate || complianceCalendar.lastRiskAssessmentDate
        ? 'Plan und Maßnahmenbild nach neuer Risikoanalyse synchron halten.'
        : 'Datum der letzten Planaktualisierung fehlt.',
      regimeId: 'de_kritisdachg',
    });

    if (!complianceCalendar.incidentContact.trim()) {
      deadlines.push({
        id: 'compliance-kritis-incident-contact',
        title: 'Meldekontakt für KRITIS-DachG definieren',
        category: 'regulatorisch',
        dueDate: '',
        status: 'open',
        owner: profile.owner || 'Geschäftsleitung / Compliance',
        sourceLabel: '§ 18 KRITISDachG',
        description: 'Erstmeldung binnen 24 Stunden und ausführlicher Bericht binnen eines Monats organisatorisch absichern.',
        regimeId: 'de_kritisdachg',
      });
    }
  }

  if (bsigScope === 'unknown') {
    deadlines.push({
      id: 'regime-bsig-scope',
      title: 'Scope-Prüfung BSIG / NIS2 abschließen',
      category: 'regulatorisch',
      dueDate: '',
      status: 'open',
      owner: profile.owner || complianceCalendar.incidentContact || 'Cyber-Compliance offen',
      sourceLabel: 'BSIG / NIS2',
      description: 'Ordnen Sie die Organisation als wichtige oder besonders wichtige Einrichtung ein und dokumentieren Sie die Begründung.',
      regimeId: 'de_bsig_nis2',
    });
  }

  if (bsigScope !== 'out_of_scope') {
    if (profile.bsigEntityClass === 'unknown') {
      deadlines.push({
        id: 'bsig-entity-class',
        title: 'Einrichtungsklasse für BSIG / NIS2 festlegen',
        category: 'regulatorisch',
        dueDate: '',
        status: 'open',
        owner: profile.owner || complianceCalendar.incidentContact || 'Cyber-Compliance offen',
        sourceLabel: 'BSIG / NIS2',
        description: 'Dokumentieren Sie, ob die Organisation als wichtige oder besonders wichtige Einrichtung behandelt wird.',
        regimeId: 'de_bsig_nis2',
      });
    }

    deadlines.push({
      id: 'compliance-bsig-registration',
      title: 'BSIG / NIS2 Registrierung und Stammdatenpflege',
      category: 'regulatorisch',
      dueDate: '',
      status: complianceCalendar.bsigRegistrationDate ? 'planned' : 'open',
      owner: complianceCalendar.incidentContact || profile.owner || 'Cyber-Compliance offen',
      sourceLabel: '§ 33 BSIG',
      description: complianceCalendar.bsigRegistrationDate
        ? `Registrierung bzw. Aktualisierung dokumentiert am ${complianceCalendar.bsigRegistrationDate}.`
        : 'Einrichtungen müssen ihre Einordnung und Stammdaten strukturiert registrieren und aktuell halten.',
      regimeId: 'de_bsig_nis2',
    });

    deadlines.push({
      id: 'compliance-bsig-evidence-audit',
      title: 'IT-Nachweis / Audit erneuern',
      category: 'regulatorisch',
      dueDate: addYears(complianceCalendar.lastBsiEvidenceAuditDate, 3),
      status: complianceCalendar.lastBsiEvidenceAuditDate
        ? getStatusFromDate(addYears(complianceCalendar.lastBsiEvidenceAuditDate, 3))
        : 'open',
      owner: complianceCalendar.incidentContact || profile.owner || 'IT-Nachweis offen',
      sourceLabel: '§ 39 BSIG',
      description: complianceCalendar.lastBsiEvidenceAuditDate
        ? 'IT-Nachweise für kritische Anlagen regelmäßig erneuern und revisionssicher ablegen.'
        : 'Letztes IT-/OT-Nachweisdatum fehlt.',
      regimeId: 'de_bsig_nis2',
    });

    if (!complianceCalendar.lastCyberRiskAssessmentDate) {
      deadlines.push({
        id: 'compliance-bsig-cyber-risk-cycle',
        title: 'Regelzyklus für Cyber-Risikobewertung pflegen',
        category: 'regulatorisch',
        dueDate: '',
        status: 'open',
        owner: complianceCalendar.incidentContact || profile.owner || 'Cyber-Risikoverantwortung offen',
        sourceLabel: '§ 30 BSIG',
        description: 'Pflegen Sie eine nachvollziehbare, wiederkehrende Cyber-Risikobewertung als Teil des Maßnahmenprogramms.',
        regimeId: 'de_bsig_nis2',
      });
    }

    if (!complianceCalendar.lastIncidentExerciseDate) {
      deadlines.push({
        id: 'compliance-bsig-incident-exercise',
        title: 'Cyber-Vorfallübung dokumentieren',
        category: 'regulatorisch',
        dueDate: '',
        status: 'open',
        owner: complianceCalendar.incidentBackupContact || complianceCalendar.incidentContact || profile.owner || 'Übungsverantwortung offen',
        sourceLabel: '§ 32 BSIG',
        description: 'Meldelogik und operative Reaktion sollten durch Übungen, Tabletops oder technische Tests belastbar sein.',
        regimeId: 'de_bsig_nis2',
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
  exercises: ExerciseItem[];
  reviewPlan: ReviewPlan;
  complianceCalendar: ComplianceCalendar;
  applicability: KritisApplicability;
  regulatoryProfile: RegulatoryProfile;
}): DeadlineSummary {
  const items = sortDeadlineItems([
    ...buildActionDeadlines(params.actionItems),
    ...buildDocumentDeadlines(params.evidenceItems),
    ...buildExerciseDeadlines(params.exercises),
    ...buildReviewPlanDeadlines(params.reviewPlan),
    ...buildComplianceDeadlines(params.complianceCalendar, params.applicability, params.regulatoryProfile),
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
