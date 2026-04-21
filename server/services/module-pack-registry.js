/**
 * module-pack-registry.js · Tenant-Scoped Module-Pack-Registry-Lifecycle.
 *
 * Extrahiert in C3.1 aus server/index.js (~155 Zeilen). Fünf Funktionen
 * rund um die Verwaltung importierter Modulpakete pro Tenant:
 *
 *   - presentModulePackEntry: Presentation-Layer-Wrapper um
 *     sanitizeModulePackEntry. Semantisch getrennt von der reinen
 *     Format-Sanitize-Schicht, auch wenn aktuell funktional identisch.
 *   - buildRegistryScopedContextLabel: Audit-Actor-Label
 *     (anonym / Account-Name / E-Mail / 'unbekannt').
 *   - upsertImportedModulePack: Import eines neuen Pakets mit
 *     Duplikat-Check (409 bei gleichem packKey+version, aber
 *     unterschiedlichem Checksum) und Audit-Eintrag.
 *   - activateModulePackVersion: Transition 'draft'/'superseded'
 *     -> 'released' mit Supersede-Kaskade über alle Einträge mit
 *     gleichem packKey + Audit.
 *   - retireModulePackVersion: Transition beliebiger Status
 *     -> 'retired' + Audit.
 *
 * Abgrenzung zu server/module-packs.js:
 *   - server/module-packs.js (bestehend, 519 Z.): Pure-Logik-Schicht
 *     (Format-Parser, Validator, Overlay-Engine, Catalog-Builder).
 *     Kein I/O, keine Persistenz-Deps. Deckt sich mit der
 *     module-packs.test.js-Unit-Coverage.
 *   - services/module-pack-registry.js (diese Datei): Stateful-Service-
 *     Schicht für tenant-scoped Registry-CRUD + Audit. I/O-heavy,
 *     E2E-abgedeckt (Szenarien 1 + 15 indirekt).
 *
 * Audit-Log-Import: direkter Import aus persistence-wrappers. Das
 * ist das C3.1-Muster, das für C3.2-C3.5 fortgesetzt wird — Audit ist
 * Service-Layer-Responsibility, nicht Route-Layer-Injection.
 */
import { parseImportedModulePack, sanitizeModulePackEntry } from '../module-packs.js';
import { createId, httpError, nowIso } from './ids.js';
import {
  appendAuditLog,
  readModulePackRegistry,
  writeModulePackRegistry,
} from './persistence-wrappers.js';

export function presentModulePackEntry(entry) {
  return sanitizeModulePackEntry(entry);
}

export function buildRegistryScopedContextLabel(authContext) {
  if (authContext.anonymous) {
    return 'anonym';
  }
  return authContext.account.name || authContext.account.email || 'unbekannt';
}

export async function upsertImportedModulePack(tenantId, authContext, payload) {
  const fileName = String(payload?.fileName || 'module-pack.json').trim() || 'module-pack.json';
  const jsonText = String(payload?.jsonText || '').trim();
  const changeNote = String(payload?.changeNote || '').trim();
  if (!jsonText) {
    throw httpError(400, 'Bitte JSON-Inhalt für das Paket übergeben.');
  }

  const parsed = parseImportedModulePack(jsonText);
  if (!parsed.valid || !parsed.module) {
    throw httpError(400, 'Das Paket konnte nicht validiert werden.', parsed.errors);
  }

  const entries = await readModulePackRegistry(tenantId);
  const duplicate = entries.find((entry) => entry.packKey === parsed.packKey && entry.version === parsed.module.version);
  if (duplicate) {
    if (duplicate.checksumSha256 === parsed.checksumSha256) {
      return presentModulePackEntry(duplicate);
    }
    throw httpError(409, 'Für diesen Paket-Schlüssel existiert bereits dieselbe Versionsnummer mit anderem Inhalt. Bitte Version erhöhen.');
  }

  const nextEntry = sanitizeModulePackEntry({
    id: createId('pkg'),
    packKey: parsed.packKey,
    packType: parsed.packType,
    targetModuleId: parsed.targetModuleId,
    moduleId: String(parsed.packType === 'overlay' ? parsed.module.id : parsed.module.id || '').trim(),
    moduleName: String(parsed.packType === 'overlay' ? (parsed.module.name || parsed.module.id) : (parsed.module.name || parsed.module.id) || '').trim(),
    version: String(parsed.module.version || '').trim(),
    status: 'draft',
    fileName,
    checksumSha256: parsed.checksumSha256,
    uploadedAt: nowIso(),
    uploadedBy: buildRegistryScopedContextLabel(authContext),
    changeNote,
    releaseNote: '',
    sourceScope: 'tenant',
    format: parsed.format || 'legacy',
    containerVersion: parsed.containerVersion,
    manifest: parsed.manifest,
    module: parsed.module,
  });

  await writeModulePackRegistry(tenantId, [nextEntry, ...entries]);
  await appendAuditLog(tenantId, {
    id: createId('audit'),
    at: nowIso(),
    actor: buildRegistryScopedContextLabel(authContext),
    action: 'module_pack_imported',
    resource: 'module-pack-registry',
    summary: `Paket ${nextEntry.packKey}@${nextEntry.version} importiert`,
    details: changeNote || `Datei: ${fileName}`,
  });

  return presentModulePackEntry(nextEntry);
}

export async function activateModulePackVersion(tenantId, authContext, entryId, releaseNote = '') {
  const entries = await readModulePackRegistry(tenantId);
  const entryIndex = entries.findIndex((entry) => entry.id === entryId);
  if (entryIndex < 0) {
    throw httpError(404, 'Das Modulpaket wurde nicht gefunden.');
  }

  const target = entries[entryIndex];
  if (target.status === 'retired') {
    throw httpError(409, 'Ein stillgelegtes Paket kann nicht aktiviert werden.');
  }

  const now = nowIso();
  const nextEntries = entries.map((entry) => {
    if (entry.packKey !== target.packKey) {
      return entry;
    }

    if (entry.id === target.id) {
      return presentModulePackEntry({
        ...entry,
        status: 'released',
        releasedAt: now,
        releasedBy: buildRegistryScopedContextLabel(authContext),
        releaseNote: releaseNote || entry.releaseNote,
        supersededById: '',
      });
    }

    if (entry.status === 'released' || entry.status === 'superseded' || entry.status === 'draft') {
      return presentModulePackEntry({
        ...entry,
        status: 'superseded',
        supersededById: target.id,
      });
    }

    return entry;
  });

  await writeModulePackRegistry(tenantId, nextEntries);
  await appendAuditLog(tenantId, {
    id: createId('audit'),
    at: now,
    actor: buildRegistryScopedContextLabel(authContext),
    action: 'module_pack_released',
    resource: 'module-pack-registry',
    summary: `Paket ${target.packKey}@${target.version} freigegeben`,
    details: releaseNote || '',
  });

  return presentModulePackEntry(nextEntries.find((entry) => entry.id === target.id));
}

export async function retireModulePackVersion(tenantId, authContext, entryId, note = '') {
  const entries = await readModulePackRegistry(tenantId);
  const entryIndex = entries.findIndex((entry) => entry.id === entryId);
  if (entryIndex < 0) {
    throw httpError(404, 'Das Modulpaket wurde nicht gefunden.');
  }

  const now = nowIso();
  const nextEntries = entries.map((entry) => entry.id === entryId
    ? presentModulePackEntry({
        ...entry,
        status: 'retired',
        retiredAt: now,
        retiredBy: buildRegistryScopedContextLabel(authContext),
        releaseNote: note || entry.releaseNote,
      })
    : entry);

  await writeModulePackRegistry(tenantId, nextEntries);
  await appendAuditLog(tenantId, {
    id: createId('audit'),
    at: now,
    actor: buildRegistryScopedContextLabel(authContext),
    action: 'module_pack_retired',
    resource: 'module-pack-registry',
    summary: `Paket ${entries[entryIndex].packKey}@${entries[entryIndex].version} stillgelegt`,
    details: note || '',
  });

  return presentModulePackEntry(nextEntries.find((entry) => entry.id === entryId));
}
