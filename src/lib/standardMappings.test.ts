import { describe, expect, it } from 'vitest';
import {
  ALL_STANDARD_IDS,
  enrichRequirementsWithMappings,
  findRequirementsCoveredByStandard,
  getRelevanceLabel,
  groupMappingsByStandard,
  hasPrimaryMapping,
  standardLabels,
} from './standardMappings';
import {
  requirementControlMappings,
  standardControlCatalog,
} from '../data/standardMappings';
import { baseKritisRequirements } from '../data/kritisBase';
import type { RequirementDefinition, StandardControlReference } from '../types';

describe('Integrität des Kontroll-Katalogs', () => {
  it('jede Mapping-Zuordnung referenziert eine Kontrolle aus dem Katalog', () => {
    const catalogKeys = new Set(
      standardControlCatalog.map((entry) => `${entry.standardId}::${entry.controlId}`),
    );
    for (const [requirementId, mappings] of Object.entries(requirementControlMappings)) {
      for (const mapping of mappings) {
        const key = `${mapping.standardId}::${mapping.controlId}`;
        expect(
          catalogKeys.has(key),
          `Requirement "${requirementId}" verweist auf unbekannte Kontrolle ${mapping.standardId}/${mapping.controlId}`,
        ).toBe(true);
      }
    }
  });

  it('jede Mapping-Zuordnung trägt einen controlTitle, der zum Katalog passt', () => {
    const titleIndex = new Map(
      standardControlCatalog.map((entry) => [`${entry.standardId}::${entry.controlId}`, entry.controlTitle]),
    );
    for (const mappings of Object.values(requirementControlMappings)) {
      for (const mapping of mappings) {
        expect(titleIndex.get(`${mapping.standardId}::${mapping.controlId}`)).toBe(mapping.controlTitle);
      }
    }
  });

  it('stellt für jeden StandardId ein Label bereit', () => {
    for (const id of ALL_STANDARD_IDS) {
      expect(standardLabels[id]).toBeDefined();
      expect(standardLabels[id].length).toBeGreaterThan(0);
    }
  });
});

describe('enrichRequirementsWithMappings', () => {
  it('fügt mappedControls aus der Zuordnung hinzu, wenn das Requirement keine hat', () => {
    const input: RequirementDefinition[] = baseKritisRequirements.filter(
      (requirement) => requirement.id === 'de_kritis_risk_assessment',
    );
    const enriched = enrichRequirementsWithMappings(input);
    expect(enriched[0].mappedControls?.length).toBeGreaterThanOrEqual(3);
  });

  it('lässt bestehende mappedControls unverändert', () => {
    const existing: StandardControlReference[] = [
      {
        standardId: 'iso_27001_2022',
        controlId: 'A.5.1',
        controlTitle: 'Richtlinien für Informationssicherheit',
        relevance: 'primary',
      },
    ];
    const input: RequirementDefinition[] = [
      {
        id: 'de_kritis_registration',
        title: '',
        description: '',
        guidance: '',
        mappedControls: existing,
      },
    ];
    const enriched = enrichRequirementsWithMappings(input);
    expect(enriched[0].mappedControls).toBe(existing);
  });

  it('lässt Requirements ohne hinterlegte Mappings unverändert', () => {
    const input: RequirementDefinition[] = [
      {
        id: 'fantasie_requirement',
        title: '',
        description: '',
        guidance: '',
      },
    ];
    const enriched = enrichRequirementsWithMappings(input);
    expect(enriched[0].mappedControls).toBeUndefined();
  });

  it('mutiert das Original-Array nicht', () => {
    const input: RequirementDefinition[] = baseKritisRequirements.slice(0, 1);
    const snapshot = JSON.parse(JSON.stringify(input));
    enrichRequirementsWithMappings(input);
    expect(input).toEqual(snapshot);
  });
});

describe('hasPrimaryMapping · Abdeckungsversprechen', () => {
  it('für jedes der 9 KRITISDachG-Requirements existiert entweder eine primary-Zuordnung oder eine explizite Begründung', () => {
    const kritisDachRequirements = baseKritisRequirements.filter(
      (requirement) => requirement.regimeId === 'de_kritisdachg',
    );
    expect(kritisDachRequirements.length).toBeGreaterThanOrEqual(9);
    const withoutPrimary = kritisDachRequirements.filter((requirement) => !hasPrimaryMapping(requirement));
    // Dokumentierte Ausnahmen: Länderöffnungsklausel (§5, reines Scope-Thema) und
    // Gleichwertige Nachweise (§17, Meta-Requirement). Beide sind nur related/primary-arm gemappt.
    const expectedExceptionIds = ['de_kritis_land_opening_clause'];
    for (const requirement of withoutPrimary) {
      expect(
        expectedExceptionIds,
        `Requirement "${requirement.id}" hat keine primary-Zuordnung und ist nicht als dokumentierte Ausnahme gelistet`,
      ).toContain(requirement.id);
    }
  });

  it('alle 6 BSIG/NIS2-Requirements haben mindestens eine primary-Zuordnung', () => {
    const bsigRequirements = baseKritisRequirements.filter(
      (requirement) => requirement.regimeId === 'de_bsig_nis2',
    );
    expect(bsigRequirements.length).toBeGreaterThanOrEqual(6);
    for (const requirement of bsigRequirements) {
      expect(hasPrimaryMapping(requirement), `BSIG-Requirement "${requirement.id}" ohne primary-Mapping`).toBe(true);
    }
  });
});

describe('groupMappingsByStandard', () => {
  it('gruppiert und sortiert nach Relevanz und controlId', () => {
    const mixed: StandardControlReference[] = [
      { standardId: 'iso_27001_2022', controlId: 'A.5.26', controlTitle: '...', relevance: 'primary' },
      { standardId: 'iso_27001_2022', controlId: 'A.5.24', controlTitle: '...', relevance: 'primary' },
      { standardId: 'iso_27001_2022', controlId: 'A.6.8', controlTitle: '...', relevance: 'secondary' },
      { standardId: 'bsi_grundschutz_2023', controlId: 'DER.2.1', controlTitle: '...', relevance: 'primary' },
    ];
    const grouped = groupMappingsByStandard(mixed);
    expect(grouped.iso_27001_2022.map((entry) => entry.controlId)).toEqual(['A.5.24', 'A.5.26', 'A.6.8']);
    expect(grouped.bsi_grundschutz_2023.map((entry) => entry.controlId)).toEqual(['DER.2.1']);
    expect(grouped.iso_22301_2019).toEqual([]);
  });
});

describe('findRequirementsCoveredByStandard', () => {
  const enrichedRequirements = enrichRequirementsWithMappings(baseKritisRequirements);

  it('findet Requirements, die von einer ISO-27001-Kontrolle adressiert werden', () => {
    const hits = findRequirementsCoveredByStandard(
      'iso_27001_2022',
      ['A.5.24', 'A.5.25', 'A.5.26'],
      enrichedRequirements,
    );
    const ids = hits.map((hit) => hit.requirementId);
    expect(ids).toContain('de_kritis_incident_reporting');
    expect(ids).toContain('de_bsig_incident_reporting');
  });

  it('findet § 20-Requirement für die Leadership-Klausel', () => {
    const hits = findRequirementsCoveredByStandard(
      'iso_27001_2022',
      ['Clause 5.1'],
      enrichedRequirements,
    );
    const ids = hits.map((hit) => hit.requirementId);
    expect(ids).toContain('de_kritis_management_accountability');
    expect(ids).toContain('de_bsig_management_governance');
  });

  it('findet BSIG-Audit-Requirement für BSI-Baustein DER.3', () => {
    const hits = findRequirementsCoveredByStandard(
      'bsi_grundschutz_2023',
      ['DER.3'],
      enrichedRequirements,
    );
    const ids = hits.map((hit) => hit.requirementId);
    expect(ids).toEqual(['de_bsig_evidence_audit']);
    expect(hits[0].strongestRelevance).toBe('primary');
  });

  it('meldet die stärkste Relevanz unter mehreren Treffern', () => {
    const hits = findRequirementsCoveredByStandard(
      'iso_27001_2022',
      ['A.5.19', 'Clause 6.1.2'],
      enrichedRequirements,
    );
    const bsigRisk = hits.find((hit) => hit.requirementId === 'de_bsig_risk_management');
    expect(bsigRisk?.strongestRelevance).toBe('primary');
  });

  it('gibt leere Liste zurück, wenn kein Requirement passt', () => {
    const hits = findRequirementsCoveredByStandard(
      'iso_27001_2022',
      ['A.99.99'],
      enrichedRequirements,
    );
    expect(hits).toEqual([]);
  });
});

describe('getRelevanceLabel', () => {
  it('übersetzt die drei Relevanzstufen', () => {
    expect(getRelevanceLabel('primary')).toBe('Direkt abgedeckt');
    expect(getRelevanceLabel('secondary')).toBe('Teilweise abgedeckt');
    expect(getRelevanceLabel('related')).toBe('Flankierend');
  });
});
