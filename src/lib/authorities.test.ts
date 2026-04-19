import { describe, expect, it } from 'vitest';
import { getAuthorityRoleLabel, getPrimaryAuthority, resolveAuthorities } from './authorities';
import {
  SECTOR_WILDCARD,
  authorityAssignments,
  competentAuthorities,
} from '../data/competentAuthorities';
import { KRITIS_ELIGIBLE_SECTORS } from '../data/kritisBase';
import type { AuthorityRole, RegulatoryRegimeId } from '../types';

const DE_REGIMES: RegulatoryRegimeId[] = ['de_kritisdachg', 'de_bsig_nis2'];

describe('resolveAuthorities · Abdeckung der 10 KRITIS-Sektoren', () => {
  it('liefert für jeden KRITIS-Sektor × DE-Regime mindestens eine Behörde', () => {
    for (const sector of KRITIS_ELIGIBLE_SECTORS) {
      for (const regime of DE_REGIMES) {
        const result = resolveAuthorities(regime, sector, 'DE');
        expect(result.length, `Sektor "${sector}" × Regime ${regime} ohne Zuordnung`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('enthält BBK als Koordinationsstelle für jede KRITIS-DachG-Abfrage', () => {
    for (const sector of KRITIS_ELIGIBLE_SECTORS) {
      const result = resolveAuthorities('de_kritisdachg', sector, 'DE');
      const bbk = result.find((entry) => entry.authorityId === 'bbk');
      expect(bbk, `BBK fehlt für Sektor "${sector}"`).toBeDefined();
      expect(bbk?.role).toBe('coordination');
      expect(bbk?.lawRef).toMatch(/§ 3 Abs\. 1 KRITISDachG/);
    }
  });

  it('enthält BSI als Meldestelle für jede KRITIS-DachG-Abfrage', () => {
    for (const sector of KRITIS_ELIGIBLE_SECTORS) {
      const result = resolveAuthorities('de_kritisdachg', sector, 'DE');
      const bsi = result.find((entry) => entry.authorityId === 'bsi');
      expect(bsi, `BSI fehlt für Sektor "${sector}"`).toBeDefined();
      expect(bsi?.role).toBe('incident_reporting');
    }
  });

  it('enthält BSI als Koordinationsstelle für jede BSIG/NIS2-Abfrage', () => {
    for (const sector of KRITIS_ELIGIBLE_SECTORS) {
      const result = resolveAuthorities('de_bsig_nis2', sector, 'DE');
      const bsi = result.find((entry) => entry.authorityId === 'bsi');
      expect(bsi, `BSI fehlt für Sektor "${sector}"`).toBeDefined();
      expect(bsi?.role).toBe('coordination');
    }
  });
});

describe('resolveAuthorities · Sonderfälle', () => {
  it('nennt für Finanzwesen die BaFin mit DORA-Hinweis im note-Feld', () => {
    const result = resolveAuthorities('de_kritisdachg', 'Finanzwesen', 'DE');
    const bafin = result.find((entry) => entry.authorityId === 'bafin');
    expect(bafin).toBeDefined();
    expect(bafin?.role).toBe('sector_supervision');
    expect(bafin?.note).toMatch(/DORA/);
  });

  it('nennt für IT und Telekommunikation die BNetzA mit BSIG-Lex-specialis-Hinweis', () => {
    const result = resolveAuthorities('de_kritisdachg', 'Informationstechnik und Telekommunikation', 'DE');
    const bnetza = result.find((entry) => entry.authorityId === 'bnetza');
    expect(bnetza).toBeDefined();
    expect(bnetza?.note).toMatch(/BSIG/);
  });

  it('kennt für Transport sowohl BMV als auch EBA', () => {
    const result = resolveAuthorities('de_kritisdachg', 'Transport und Verkehr', 'DE');
    const ids = result.map((entry) => entry.authorityId);
    expect(ids).toContain('bmv');
    expect(ids).toContain('eba_de');
  });

  it('nennt für Weltraum das BMFTR mit DLR-Note', () => {
    const result = resolveAuthorities('de_kritisdachg', 'Weltraum', 'DE');
    const bmftr = result.find((entry) => entry.authorityId === 'bmftr');
    expect(bmftr).toBeDefined();
    expect(bmftr?.note).toMatch(/DLR/);
  });

  it('verweist für Light-Regime-Sektoren auf Landesbehörde mit Light-Regime-Hinweis', () => {
    const social = resolveAuthorities(
      'de_kritisdachg',
      'Leistungen der Sozialversicherung und Grundsicherung für Arbeitsuchende',
      'DE',
    );
    const socialEntry = social.find((entry) => entry.authorityId === 'state_social');
    expect(socialEntry?.note).toMatch(/Light-Regime/);

    const waste = resolveAuthorities('de_kritisdachg', 'Siedlungsabfallentsorgung', 'DE');
    const wasteEntry = waste.find((entry) => entry.authorityId === 'state_waste');
    expect(wasteEntry?.note).toMatch(/Light-Regime/);
  });
});

describe('resolveAuthorities · Wildcard- und Unknown-Handling', () => {
  it('kombiniert Wildcard-Einträge mit sektorspezifischen Einträgen ohne Duplikate', () => {
    const result = resolveAuthorities('de_kritisdachg', 'Energie', 'DE');
    const ids = result.map((entry) => entry.authorityId);
    expect(ids).toContain('bbk');
    expect(ids).toContain('bsi');
    expect(ids).toContain('bnetza');
    // Keine doppelte Rollenkombination
    const rolePairs = result.map((entry) => `${entry.authorityId}::${entry.role}::${entry.lawRef}`);
    expect(new Set(rolePairs).size).toBe(rolePairs.length);
  });

  it('gibt bei unbekanntem Sektor ausschließlich Wildcard-Einträge zurück', () => {
    const result = resolveAuthorities('de_kritisdachg', 'Phantasie-Sektor', 'DE');
    const ids = result.map((entry) => entry.authorityId);
    expect(ids).toEqual(expect.arrayContaining(['bbk', 'bsi']));
    expect(ids).not.toContain('bnetza');
    expect(ids).not.toContain('bafin');
  });

  it('bettet das CompetentAuthority-Objekt mit Website-URL in das Ergebnis ein', () => {
    const result = resolveAuthorities('de_kritisdachg', 'Energie', 'DE');
    const bbk = result.find((entry) => entry.authorityId === 'bbk');
    expect(bbk?.authority.shortName).toBe('BBK');
    expect(bbk?.authority.website).toBe('https://www.bbk.bund.de');
    expect(bbk?.authority.jurisdiction).toBe('federal');
  });
});

describe('resolveAuthorities · AT und CH', () => {
  it('liefert für NISG 2026 die AT-NIS-Behörde', () => {
    const result = resolveAuthorities('at_nisg_2026', SECTOR_WILDCARD, 'AT');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].authorityId).toBe('at_nis_authority');
  });

  it('liefert für BACS-Meldepflicht BACS in beiden Rollen (Koordination + Meldestelle)', () => {
    const result = resolveAuthorities('ch_bacs_ci', SECTOR_WILDCARD, 'CH');
    const roles = result.filter((entry) => entry.authorityId === 'ch_bacs').map((entry) => entry.role);
    expect(roles).toEqual(expect.arrayContaining(['coordination', 'incident_reporting']));
  });
});

describe('Daten-Integrität', () => {
  it('jede authorityId in Assignments existiert in der Stammliste', () => {
    const knownIds = new Set(competentAuthorities.map((entry) => entry.id));
    for (const assignment of authorityAssignments) {
      expect(
        knownIds.has(assignment.authorityId),
        `authorityId "${assignment.authorityId}" fehlt in competentAuthorities`,
      ).toBe(true);
    }
  });

  it('jede Assignment-Rolle ist ein gültiger AuthorityRole', () => {
    const validRoles: AuthorityRole[] = ['coordination', 'incident_reporting', 'audit', 'sector_supervision'];
    for (const assignment of authorityAssignments) {
      expect(validRoles).toContain(assignment.role);
    }
  });

  it('jede Assignment-lawRef ist nicht leer', () => {
    for (const assignment of authorityAssignments) {
      expect(assignment.lawRef.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('getPrimaryAuthority', () => {
  it('priorisiert coordination vor sector_supervision (BBK vor BNetzA in Energie)', () => {
    const primary = getPrimaryAuthority('de_kritisdachg', 'Energie', 'DE');
    expect(primary?.authorityId).toBe('bbk');
    expect(primary?.role).toBe('coordination');
  });

  it('priorisiert coordination vor incident_reporting (BSI coordination in BSIG)', () => {
    const primary = getPrimaryAuthority('de_bsig_nis2', 'Energie', 'DE');
    expect(primary?.authorityId).toBe('bsi');
    expect(primary?.role).toBe('coordination');
  });

  it('liefert null, wenn kein Assignment für das Regime existiert', () => {
    const primary = getPrimaryAuthority('phantom' as RegulatoryRegimeId, 'Energie', 'DE');
    expect(primary).toBeNull();
  });
});

describe('getAuthorityRoleLabel', () => {
  it('übersetzt die vier Rollen in deutsche Label', () => {
    expect(getAuthorityRoleLabel('coordination')).toBe('Koordination');
    expect(getAuthorityRoleLabel('sector_supervision')).toBe('Sektoraufsicht');
    expect(getAuthorityRoleLabel('audit')).toBe('Prüfung');
    expect(getAuthorityRoleLabel('incident_reporting')).toBe('Meldestelle');
  });
});
