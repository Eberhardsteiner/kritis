export const regimeDefinitionsByJurisdiction = {
  DE: [
    {
      id: 'de_kritisdachg',
      incidentWindows: ['24h', '1m'],
    },
    {
      id: 'de_bsig_nis2',
      incidentWindows: ['24h', '72h', '1m'],
    },
  ],
  AT: [
    {
      id: 'at_nisg_2026',
      incidentWindows: ['24h', '72h', '1m'],
    },
  ],
  CH: [
    {
      id: 'ch_bacs_ci',
      incidentWindows: ['24h', '14d'],
    },
  ],
};

export const defaultRegulatoryProfile = {
  jurisdiction: 'DE',
  scopeByRegime: {
    de_kritisdachg: 'unknown',
    de_bsig_nis2: 'unknown',
    at_nisg_2026: 'unknown',
    ch_bacs_ci: 'unknown',
  },
  bsigEntityClass: 'unknown',
  lastReviewDate: '',
  owner: '',
  notes: '',
  kritisRegistrationDate: '',
  kritisEntityStatus: 'not_identified',
  kritisSectorOverrideRegime: 'none',
  managementBoardContact: '',
};

function normalizeScopeStatus(value) {
  return value === 'in_scope' || value === 'out_of_scope' || value === 'unknown' ? value : 'unknown';
}

function normalizeJurisdiction(value) {
  return value === 'AT' || value === 'CH' || value === 'DE' ? value : 'DE';
}

function normalizeEntityClass(value) {
  return value === 'important' || value === 'essential' || value === 'not_applicable' || value === 'unknown'
    ? value
    : 'unknown';
}

function normalizeKritisEntityStatus(value) {
  return value === 'identified_not_registered' ||
    value === 'registered' ||
    value === 'obligations_active' ||
    value === 'not_identified'
    ? value
    : 'not_identified';
}

function normalizeKritisSectorOverride(value) {
  return value === 'dora' || value === 'bsig_nis2' || value === 'light_regime' || value === 'none'
    ? value
    : 'none';
}

function normalizeIsoDate(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return '';
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? value : '';
}

export function normalizeRegulatoryProfile(input) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const rawScope = raw.scopeByRegime && typeof raw.scopeByRegime === 'object' && !Array.isArray(raw.scopeByRegime)
    ? raw.scopeByRegime
    : {};

  return {
    jurisdiction: normalizeJurisdiction(raw.jurisdiction),
    scopeByRegime: {
      de_kritisdachg: normalizeScopeStatus(rawScope.de_kritisdachg),
      de_bsig_nis2: normalizeScopeStatus(rawScope.de_bsig_nis2),
      at_nisg_2026: normalizeScopeStatus(rawScope.at_nisg_2026),
      ch_bacs_ci: normalizeScopeStatus(rawScope.ch_bacs_ci),
    },
    bsigEntityClass: normalizeEntityClass(raw.bsigEntityClass),
    lastReviewDate: typeof raw.lastReviewDate === 'string' ? raw.lastReviewDate : '',
    owner: typeof raw.owner === 'string' ? raw.owner : '',
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    kritisRegistrationDate: normalizeIsoDate(raw.kritisRegistrationDate),
    kritisEntityStatus: normalizeKritisEntityStatus(raw.kritisEntityStatus),
    kritisSectorOverrideRegime: normalizeKritisSectorOverride(raw.kritisSectorOverrideRegime),
    managementBoardContact: typeof raw.managementBoardContact === 'string' ? raw.managementBoardContact : '',
  };
}

export function getApplicableRegimes(profile) {
  const normalized = normalizeRegulatoryProfile(profile);
  return (regimeDefinitionsByJurisdiction[normalized.jurisdiction] ?? [])
    .map((definition) => definition.id)
    .filter((regimeId) => normalized.scopeByRegime[regimeId] !== 'out_of_scope');
}

export function getIncidentTimelineLength(profile, regimeId) {
  const normalized = normalizeRegulatoryProfile(profile);
  const definition = (regimeDefinitionsByJurisdiction[normalized.jurisdiction] ?? [])
    .find((entry) => entry.id === regimeId);
  if (!definition) {
    return 0;
  }
  if (normalized.scopeByRegime[regimeId] === 'out_of_scope') {
    return 0;
  }
  return definition.incidentWindows.length;
}
