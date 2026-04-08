import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSecurityGatesSummary,
  createObservabilityStore,
  evaluateRequestRisk,
  summarizeRestoreDrills,
} from './hardening.js';

function hashPassword(password, salt) {
  return {
    salt,
    hash: `hashed:${salt}:${password}`,
  };
}

function verifyPassword(password, salt, hash) {
  return hash === `hashed:${salt}:${password}`;
}

test('evaluateRequestRisk blocks traversal and control-byte patterns', () => {
  const traversal = evaluateRequestRisk('/api/files/../../secret.txt');
  assert.equal(traversal.ok, false);
  assert.equal(traversal.rules[0].id, 'path-traversal');

  const nullByte = evaluateRequestRisk('/api/files/test%00.pdf');
  assert.equal(nullByte.ok, false);
  assert.match(nullByte.rules.map((entry) => entry.id).join(','), /control-bytes/);
});

test('observability store aggregates latency and error metrics', async () => {
  const store = createObservabilityStore({ recentEventLimit: 10, maxLatencySamplesPerRoute: 10 });

  async function runRequest(statusCode, waitMs = 0) {
    await new Promise((resolve, reject) => {
      const req = { method: 'GET', path: '/api/test', headers: {}, originalUrl: '/api/test' };
      const finishHandlers = [];
      const res = {
        statusCode,
        locals: {},
        setHeader() {},
        on(event, handler) {
          if (event === 'finish') {
            finishHandlers.push(handler);
          }
        },
      };

      store.middleware(req, res, (error) => {
        if (error) {
          reject(error);
          return;
        }
        setTimeout(() => {
          finishHandlers.forEach((handler) => handler());
          resolve();
        }, waitMs);
      });
    });
  }

  await runRequest(200, 5);
  await runRequest(503, 10);

  const summary = store.buildSummary();
  assert.equal(summary.totalRequests, 2);
  assert.equal(summary.activeRequests, 0);
  assert.equal(summary.routes[0].route, 'GET /api/test');
  assert.equal(summary.routes[0].errorCount, 1);
  assert.ok(summary.errorRatePercent >= 50);
  assert.ok(summary.p95LatencyMs >= 0);
  assert.equal(summary.recentEvents.length, 2);
});

test('buildSecurityGatesSummary warns about default password and missing restore drill', () => {
  const passwordData = hashPassword('Krisenfest2026!', 'salt');
  const summary = buildSecurityGatesSummary({
    runtimeConfig: {
      appMode: 'production',
      authRequired: true,
      anonymousAccessEnabled: false,
      antivirus: { enabled: false, mode: 'off' },
    },
    platformSettings: {
      allowedOrigins: ['*'],
      publicApiEnabled: true,
      requireSignedWebhooks: false,
      observabilityMode: 'off',
      wafLiteEnabled: false,
      restoreDrillCadenceDays: 30,
    },
    accounts: [
      {
        isSystemAdmin: true,
        status: 'active',
        passwordSalt: passwordData.salt,
        passwordHash: passwordData.hash,
      },
    ],
    apiClients: [],
    jobs: [],
    verifyPassword,
    defaultDemoPassword: 'Krisenfest2026!',
    generatedBootstrapPassword: true,
  });

  const defaultPasswordGate = summary.gates.find((entry) => entry.id === 'default-password');
  const restoreGate = summary.gates.find((entry) => entry.id === 'restore-drills');
  assert.equal(defaultPasswordGate?.status, 'warn');
  assert.equal(restoreGate?.status, 'missing');
  assert.ok(summary.blockers >= 1);
});

test('summarizeRestoreDrills derives rollup from artifacts', () => {
  const jobs = [
    {
      id: 'job-1',
      type: 'restore_drill',
      tenantName: 'Systemweit',
      completedAt: '2026-04-07T08:00:00.000Z',
      triggeredBy: 'Admin',
      artifactFileName: 'restore_drill-job-1.json',
      downloadUrl: '/api/system/jobs/job-1/download',
    },
  ];
  const artifactLookup = new Map([
    ['job-1', {
      meta: { tenantCount: 2 },
      tenants: [
        { status: 'passed', latestBackupAvailable: true, backupFresh: true, latestSnapshotAvailable: true },
        { status: 'warning', latestBackupAvailable: false, backupFresh: false, latestSnapshotAvailable: false },
      ],
      recommendations: ['Backup-Kadenz prüfen.'],
    }],
  ]);

  const summaries = summarizeRestoreDrills(jobs, artifactLookup);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].overallStatus, 'warning');
  assert.equal(summaries[0].verifiedBackups, 1);
  assert.equal(summaries[0].missingBackups, 1);
  assert.equal(summaries[0].missingSnapshots, 1);
});
