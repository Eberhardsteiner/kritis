import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { LocalObjectStorage } from './object-storage.js';

test('local object storage stores, reads and removes files', async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'krisenfest-obj-'));
  t.after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const storage = await new LocalObjectStorage({ baseDir: tempDir }).initialize();
  const tempFile = path.join(tempDir, 'temp-upload.txt');
  await fs.writeFile(tempFile, 'hello storage', 'utf8');

  const result = await storage.storeTempFile(tempFile, {
    tenantId: 'tenant-a',
    storedFileName: 'stored.txt',
    mimeType: 'text/plain',
  });

  assert.equal(result.driver, 'filesystem');
  const payload = await storage.getDownloadPayload({ storedFileName: 'stored.txt' });
  assert.equal(payload.type, 'file');
  const content = await fs.readFile(payload.filePath, 'utf8');
  assert.equal(content, 'hello storage');

  await storage.removeObject({ storedFileName: 'stored.txt' });
  await assert.rejects(() => storage.getDownloadPayload({ storedFileName: 'stored.txt' }));
});
