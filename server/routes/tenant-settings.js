/**
 * tenant-settings.js · Route-Modul für Mandantenrichtlinien.
 *
 * Extrahiert in C3.3 als kleinste Route-Extraktion der C3-Reihe.
 * Enthält zwei Endpoints:
 *   - GET /api/tenant-settings   (read, anonymous-fähig)
 *   - PUT /api/tenant-settings   (write, 'workspace_edit' + Audit)
 *
 * Null-Deps-Muster analog zu routes/modules.js (C3.1) und
 * routes/reporting.js (C3.2). Keine eigene services/-Datei, weil die
 * gesamte Logik bereits in services/persistence-wrappers.js
 * (readTenantSettings, writeTenantSettings — beide mit eigenem
 * Sanitize-on-Write) und services/sanitizers.js (sanitizeObject) lebt.
 *
 * Audit-Log-Text-Invariante: Der Eintrag beim PUT-Endpoint nutzt
 * action="Mandantenrichtlinien aktualisiert", resource="tenant-settings"
 * und section="tenant-settings" — byte-identisch zur monolithischen
 * Version. Audit-Log-Strings sind Produkt-Fakten und bestandteile der
 * Audit-Trail-Verträge, keine Style-Entscheidungen.
 */
import { asyncRoute } from './utils.js';
import { assertPermissions, getAuthContext } from '../services/auth-session.js';
import {
  appendAuditLog,
  readTenantSettings,
  writeTenantSettings,
} from '../services/persistence-wrappers.js';
import { sanitizeObject } from '../services/sanitizers.js';
import { createId, nowIso } from '../services/ids.js';

export function registerTenantSettingsRoutes(app) {
  app.get('/api/tenant-settings', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    const settings = await readTenantSettings(authContext.membership.tenantId);
    res.json({ ok: true, settings });
  }));

  app.put('/api/tenant-settings', asyncRoute(async (req, res) => {
    const authContext = await getAuthContext(req, true);
    assertPermissions(['workspace_edit'], authContext);
    const current = await readTenantSettings(authContext.membership.tenantId);
    const nextSettings = await writeTenantSettings(authContext.membership.tenantId, {
      ...current,
      ...sanitizeObject(req.body?.settings),
    });
    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: nowIso(),
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Mandantenrichtlinien aktualisiert',
      resource: 'tenant-settings',
      summary: 'Mandantenrichtlinien für Export, Evidenzen und Readiness-/Auditlogik wurden aktualisiert.',
      sections: ['tenant-settings'],
    });
    res.json({ ok: true, settings: nextSettings });
  }));
}
