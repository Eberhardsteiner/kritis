function sanitizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + Number(days || 0));
  return next;
}

function diffDays(fromDate, toDate) {
  return Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000);
}

export function buildEvidenceRetentionInfo(evidence, policy = {}, now = new Date()) {
  const nowDate = safeDate(now) || new Date();
  const attachment = evidence?.serverAttachment || null;
  const anchorDate = safeDate(attachment?.uploadedAt) || safeDate(evidence?.createdAt) || nowDate;
  const reviewCycleDays = Math.max(0, Number(evidence?.reviewCycleDays || policy?.evidenceReviewCadenceDays || 0));
  const retentionDays = Math.max(0, Number(policy?.retentionDays || 0));
  const reviewBase = safeDate(evidence?.reviewDate) || anchorDate;
  const reviewDueAt = reviewCycleDays ? addDays(reviewBase, reviewCycleDays) : null;
  const retentionUntilDate = retentionDays ? addDays(anchorDate, retentionDays) : null;
  const reviewDueSoon = reviewDueAt ? diffDays(nowDate, reviewDueAt) <= 14 && diffDays(nowDate, reviewDueAt) >= 0 : false;
  const reviewOverdue = reviewDueAt ? reviewDueAt.getTime() < nowDate.getTime() : false;
  const retentionDaysRemaining = retentionUntilDate ? diffDays(nowDate, retentionUntilDate) : null;
  let retentionStatus = 'active';
  if (!attachment) {
    retentionStatus = 'no_attachment';
  }

  if (attachment && retentionDaysRemaining !== null) {
    if (retentionDaysRemaining < 0) {
      retentionStatus = 'expired';
    } else if (retentionDaysRemaining <= 30) {
      retentionStatus = 'expiring_soon';
    }
  }

  const reviewStatus = reviewOverdue ? 'overdue' : reviewDueSoon ? 'due_soon' : 'ok';
  return {
    storageDriver: attachment?.storageDriver || 'filesystem',
    reviewDueAt: reviewDueAt ? reviewDueAt.toISOString().slice(0, 10) : '',
    reviewStatus,
    retentionUntil: retentionUntilDate ? retentionUntilDate.toISOString().slice(0, 10) : '',
    retentionStatus,
    retentionDaysRemaining,
  };
}

export function buildEvidenceRetentionSummary(state, policy = {}, now = new Date()) {
  const items = sanitizeArray(state?.evidenceItems);
  const summary = {
    total: items.length,
    withServerAttachment: 0,
    missingAttachment: 0,
    dueForReview: 0,
    reviewDueSoon: 0,
    expired: 0,
    expiringSoon: 0,
    byStorageDriver: [],
    criticalItems: [],
  };

  const byDriver = {};
  const criticalItems = [];

  for (const item of items) {
    const info = buildEvidenceRetentionInfo(item, policy, now);
    if (item?.serverAttachment) {
      summary.withServerAttachment += 1;
    } else {
      summary.missingAttachment += 1;
    }
    if (info.reviewStatus === 'overdue') {
      summary.dueForReview += 1;
    } else if (info.reviewStatus === 'due_soon') {
      summary.reviewDueSoon += 1;
    }
    if (info.retentionStatus === 'expired') {
      summary.expired += 1;
    } else if (info.retentionStatus === 'expiring_soon') {
      summary.expiringSoon += 1;
    }

    const driver = info.storageDriver || 'filesystem';
    byDriver[driver] = (byDriver[driver] || 0) + 1;

    if (info.reviewStatus !== 'ok' || ['expired', 'expiring_soon', 'no_attachment'].includes(info.retentionStatus)) {
      criticalItems.push({
        id: item?.id,
        title: item?.title || 'Nachweis',
        owner: item?.owner || '',
        status: item?.status || 'draft',
        storageDriver: driver,
        reviewDueAt: info.reviewDueAt,
        reviewStatus: info.reviewStatus,
        retentionUntil: info.retentionUntil,
        retentionStatus: info.retentionStatus,
      });
    }
  }

  summary.byStorageDriver = Object.entries(byDriver)
    .map(([driver, count]) => ({ driver, count }))
    .sort((left, right) => String(left.driver).localeCompare(String(right.driver)));
  summary.criticalItems = criticalItems.slice(0, 12);
  return summary;
}
