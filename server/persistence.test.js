import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createPersistenceLayer, readJsonFromDiskForTests } from './persistence.js';

async function createTempLayer(t) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'krisenfest-persistence-'));
  t.after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const layer = await createPersistenceLayer({
    dbPath: path.join(tempDir, 'krisenfest.sqlite'),
    logger: { warn() {} },
  });

  return { layer, tempDir };
}

test('document store versions increment and mirror files are updated', async (t) => {
  const { layer, tempDir } = await createTempLayer(t);
  const mirrorPath = path.join(tempDir, 'tenant-a', 'state.json');
  const ref = { kind: 'tenant', tenantId: 'tenant-a', namespace: 'state' };

  const firstWrite = await layer.writeDocument(ref, { value: 1 }, {
    mirrorPath,
    updatedAt: '2026-04-06T10:00:00.000Z',
  });
  assert.equal(firstWrite.version, 1);

  const secondWrite = await layer.writeDocument(ref, { value: 2 }, {
    mirrorPath,
    expectedVersion: 1,
    updatedAt: '2026-04-06T10:05:00.000Z',
  });
  assert.equal(secondWrite.version, 2);

  const stored = await layer.readDocument(ref, {});
  assert.deepEqual(stored.value, { value: 2 });
  assert.equal(stored.version, 2);
  assert.equal(stored.updatedAt, '2026-04-06T10:05:00.000Z');

  const mirrored = await readJsonFromDiskForTests(mirrorPath, null);
  assert.deepEqual(mirrored, { value: 2 });
});

test('tenant documents stay isolated across tenants', async (t) => {
  const { layer } = await createTempLayer(t);

  await layer.writeDocument({ kind: 'tenant', tenantId: 'tenant-a', namespace: 'state' }, { company: 'A' });
  await layer.writeDocument({ kind: 'tenant', tenantId: 'tenant-b', namespace: 'state' }, { company: 'B' });

  const tenantA = await layer.readDocument({ kind: 'tenant', tenantId: 'tenant-a', namespace: 'state' }, null);
  const tenantB = await layer.readDocument({ kind: 'tenant', tenantId: 'tenant-b', namespace: 'state' }, null);

  assert.deepEqual(tenantA.value, { company: 'A' });
  assert.deepEqual(tenantB.value, { company: 'B' });
  assert.notDeepEqual(tenantA.value, tenantB.value);
});

test('optimistic locking rejects stale expected versions', async (t) => {
  const { layer } = await createTempLayer(t);
  const ref = { kind: 'tenant', tenantId: 'tenant-a', namespace: 'state' };

  await layer.writeDocument(ref, { revision: 1 });
  await layer.writeDocument(ref, { revision: 2 }, { expectedVersion: 1 });

  await assert.rejects(
    () => layer.writeDocument(ref, { revision: 3 }, { expectedVersion: 1 }),
    (error) => {
      assert.equal(error?.code, 'VERSION_CONFLICT');
      assert.equal(error?.currentVersion, 2);
      return true;
    },
  );
});

test('audit ledger keeps newest entries first and enforces the configured limit', async (t) => {
  const { layer, tempDir } = await createTempLayer(t);
  const mirrorPath = path.join(tempDir, 'tenant-a', 'audit-log.json');

  await layer.appendAuditEvent('tenant-a', { id: 'audit-1', at: '2026-04-06T09:00:00.000Z', action: 'one' }, {
    mirrorPath,
    limit: 2,
  });
  await layer.appendAuditEvent('tenant-a', { id: 'audit-2', at: '2026-04-06T09:05:00.000Z', action: 'two' }, {
    mirrorPath,
    limit: 2,
  });
  const entries = await layer.appendAuditEvent('tenant-a', { id: 'audit-3', at: '2026-04-06T09:10:00.000Z', action: 'three' }, {
    mirrorPath,
    limit: 2,
  });

  assert.equal(entries.length, 2);
  assert.equal(entries[0].id, 'audit-3');
  assert.equal(entries[1].id, 'audit-2');

  const mirrored = await readJsonFromDiskForTests(mirrorPath, []);
  assert.equal(mirrored.length, 2);
  assert.equal(mirrored[0].id, 'audit-3');
  assert.equal(mirrored[1].id, 'audit-2');
});


test('file-mirror fallback keeps document meta and rejects stale versions', async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'krisenfest-persistence-fallback-'));
  t.after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const layer = await createPersistenceLayer({
    dbPath: path.join(tempDir, 'krisenfest.sqlite'),
    logger: { warn() {} },
    forceFallback: true,
  });

  const ref = { kind: 'tenant', tenantId: 'tenant-a', namespace: 'state' };
  const mirrorPath = path.join(tempDir, 'tenant-a', 'state.json');

  const firstWrite = await layer.writeDocument(ref, { version: 1 }, {
    mirrorPath,
    updatedAt: '2026-04-06T11:00:00.000Z',
  });
  assert.equal(firstWrite.version, 1);

  const stored = await layer.readDocument(ref, null, { mirrorPath });
  assert.deepEqual(stored.value, { version: 1 });
  assert.equal(stored.version, 1);
  assert.equal(stored.updatedAt, '2026-04-06T11:00:00.000Z');

  await assert.rejects(
    () => layer.writeDocument(ref, { version: 2 }, {
      mirrorPath,
      expectedVersion: 0,
    }),
    (error) => {
      assert.equal(error?.code, 'VERSION_CONFLICT');
      assert.equal(error?.currentVersion, 1);
      return true;
    },
  );
});
