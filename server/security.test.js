import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildRuntimeConfig,
  buildUploadPolicy,
  EICAR_TEST_STRING,
  isOriginAllowed,
  normalizeAppMode,
  runAntivirusScan,
  validateUploadCandidate,
} from './security.js';

const RETRYABLE_FS_CODES = new Set(['EPERM', 'EBUSY']);

async function removeWithRetry(targetPath, attempts = 6, delayMs = 50) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!RETRYABLE_FS_CODES.has(error?.code) || attempt === attempts - 1) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

test('normalizeAppMode distinguishes demo and production', () => {
  assert.equal(normalizeAppMode('demo'), 'demo');
  assert.equal(normalizeAppMode('production'), 'production');
  assert.equal(normalizeAppMode('prod'), 'production');
  assert.equal(normalizeAppMode('anything-else'), 'demo');
});

test('buildRuntimeConfig enables anonymous read-only access only in demo mode', () => {
  const demo = buildRuntimeConfig({ KRISENFEST_APP_MODE: 'demo' });
  assert.equal(demo.appMode, 'demo');
  assert.equal(demo.authRequired, false);
  assert.equal(demo.anonymousAccessEnabled, true);

  const prod = buildRuntimeConfig({ KRISENFEST_APP_MODE: 'production' });
  assert.equal(prod.appMode, 'production');
  assert.equal(prod.authRequired, true);
  assert.equal(prod.anonymousAccessEnabled, false);
});

test('isOriginAllowed respects allow list without wildcard by default', () => {
  assert.equal(isOriginAllowed('https://app.example.com', ['https://app.example.com']), true);
  assert.equal(isOriginAllowed('https://evil.example.com', ['https://app.example.com']), false);
  assert.equal(isOriginAllowed('', ['https://app.example.com']), true);
});

test('validateUploadCandidate accepts allowed office document and rejects mismatched extension', () => {
  const policy = buildUploadPolicy(12 * 1024 * 1024);

  const accepted = validateUploadCandidate({
    originalname: 'readiness-report.pdf',
    mimetype: 'application/pdf',
    size: 1_024,
  }, policy);
  assert.equal(accepted.ok, true);

  const rejected = validateUploadCandidate({
    originalname: 'malware.exe',
    mimetype: 'application/pdf',
    size: 1_024,
  }, policy);
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /Dateiendung/i);
});

test('validateUploadCandidate rejects disallowed MIME types', () => {
  const policy = buildUploadPolicy(12 * 1024 * 1024);
  const result = validateUploadCandidate({
    originalname: 'archive.zip',
    mimetype: 'application/zip',
    size: 1_024,
  }, policy);

  assert.equal(result.ok, false);
  assert.match(result.reason, /nicht freigegeben/i);
});


test('runAntivirusScan blocks EICAR test file in mock mode', async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'krisenfest-av-'));
  t.after(() => removeWithRetry(tempDir));
  const filePath = path.join(tempDir, 'eicar.txt');
  await fs.writeFile(filePath, EICAR_TEST_STRING, 'utf8');

  const result = await runAntivirusScan(filePath, {
    antivirus: {
      enabled: true,
      mode: 'mock-eicar',
    },
  });

  assert.equal(result.status, 'blocked');
});
