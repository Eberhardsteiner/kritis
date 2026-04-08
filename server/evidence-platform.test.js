import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEvidenceRetentionInfo, buildEvidenceRetentionSummary } from './evidence-platform.js';

test('retention info marks overdue review and expiring evidence', () => {
  const info = buildEvidenceRetentionInfo({
    id: 'ev-1',
    title: 'Resilienzplan',
    createdAt: '2026-01-01T00:00:00.000Z',
    reviewCycleDays: 30,
    serverAttachment: {
      uploadedAt: '2026-01-01T00:00:00.000Z',
      storageDriver: 'filesystem',
    },
  }, {
    retentionDays: 60,
    evidenceReviewCadenceDays: 90,
  }, new Date('2026-02-20T00:00:00.000Z'));

  assert.equal(info.reviewStatus, 'overdue');
  assert.equal(info.retentionStatus, 'expiring_soon');
  assert.equal(info.storageDriver, 'filesystem');
});

test('retention summary aggregates critical states', () => {
  const summary = buildEvidenceRetentionSummary({
    evidenceItems: [
      {
        id: 'ev-1',
        title: 'Notfallplan',
        owner: 'BCM',
        status: 'draft',
        createdAt: '2026-01-01T00:00:00.000Z',
        reviewCycleDays: 30,
        serverAttachment: {
          uploadedAt: '2026-01-01T00:00:00.000Z',
          storageDriver: 'filesystem',
        },
      },
      {
        id: 'ev-2',
        title: 'OT-Handbuch',
        owner: 'OT',
        status: 'missing',
        createdAt: '2026-01-10T00:00:00.000Z',
      },
    ],
  }, {
    retentionDays: 60,
    evidenceReviewCadenceDays: 45,
  }, new Date('2026-02-20T00:00:00.000Z'));

  assert.equal(summary.total, 2);
  assert.equal(summary.withServerAttachment, 1);
  assert.equal(summary.missingAttachment, 1);
  assert.equal(summary.dueForReview, 1);
  assert.equal(summary.expiringSoon, 1);
  assert.ok(summary.criticalItems.length >= 1);
});
