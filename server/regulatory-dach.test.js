import test from 'node:test';
import assert from 'node:assert/strict';

import {
  defaultRegulatoryProfile,
  getApplicableRegimes,
  getIncidentTimelineLength,
  normalizeRegulatoryProfile,
} from './regulatory-dach.js';

test('normalizeRegulatoryProfile preserves supported DACH fields and resets invalid values', () => {
  const normalized = normalizeRegulatoryProfile({
    jurisdiction: 'AT',
    scopeByRegime: { de_kritisdachg: 'in_scope', at_nisg_2026: 'invalid' },
    bsigEntityClass: 'broken',
    owner: 'Compliance',
  });

  assert.deepEqual(normalized, {
    ...defaultRegulatoryProfile,
    jurisdiction: 'AT',
    scopeByRegime: {
      ...defaultRegulatoryProfile.scopeByRegime,
      de_kritisdachg: 'in_scope',
      at_nisg_2026: 'unknown',
    },
    owner: 'Compliance',
  });
});

test('getApplicableRegimes returns only current-jurisdiction regimes that are not out of scope', () => {
  const applicable = getApplicableRegimes({
    jurisdiction: 'AT',
    scopeByRegime: {
      at_nisg_2026: 'in_scope',
      de_bsig_nis2: 'in_scope',
    },
  });

  assert.deepEqual(applicable, ['at_nisg_2026']);
});

test('incident timelines reflect DACH-specific reporting windows', () => {
  assert.equal(getIncidentTimelineLength(defaultRegulatoryProfile, 'de_kritisdachg'), 2);
  assert.equal(getIncidentTimelineLength({ jurisdiction: 'AT' }, 'at_nisg_2026'), 3);
  assert.equal(getIncidentTimelineLength({ jurisdiction: 'CH' }, 'ch_bacs_ci'), 2);
  assert.equal(getIncidentTimelineLength({ jurisdiction: 'CH', scopeByRegime: { ch_bacs_ci: 'out_of_scope' } }, 'ch_bacs_ci'), 0);
  assert.equal(getIncidentTimelineLength({ jurisdiction: 'AT' }, 'de_bsig_nis2'), 0);
});

test('normalizeRegulatoryProfile defaults and validates new KRITIS fields', () => {
  const empty = normalizeRegulatoryProfile({});
  assert.equal(empty.kritisRegistrationDate, '');
  assert.equal(empty.kritisEntityStatus, 'not_identified');
  assert.equal(empty.kritisSectorOverrideRegime, 'none');

  const valid = normalizeRegulatoryProfile({
    kritisRegistrationDate: '2026-09-01',
    kritisEntityStatus: 'registered',
    kritisSectorOverrideRegime: 'dora',
  });
  assert.equal(valid.kritisRegistrationDate, '2026-09-01');
  assert.equal(valid.kritisEntityStatus, 'registered');
  assert.equal(valid.kritisSectorOverrideRegime, 'dora');

  const invalid = normalizeRegulatoryProfile({
    kritisRegistrationDate: 'nicht-ein-datum',
    kritisEntityStatus: 'phantasie',
    kritisSectorOverrideRegime: 'nis1',
  });
  assert.equal(invalid.kritisRegistrationDate, '');
  assert.equal(invalid.kritisEntityStatus, 'not_identified');
  assert.equal(invalid.kritisSectorOverrideRegime, 'none');

  const withContact = normalizeRegulatoryProfile({ managementBoardContact: 'Dr. Muster · CEO' });
  assert.equal(withContact.managementBoardContact, 'Dr. Muster · CEO');
  assert.equal(empty.managementBoardContact, '');
});
