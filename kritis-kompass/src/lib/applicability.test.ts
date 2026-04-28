import { describe, expect, it } from 'vitest';
import { evaluateApplicability } from './applicability';
import { indicatorsConfig } from '../data/indicatorsConfig';

describe('evaluateApplicability', () => {
  it('Energie-Versorger mit 800k Personen, 300 MA, 100 Mio EUR -> direkt_betroffen', () => {
    const result = evaluateApplicability(
      {
        sector: 'energie',
        personsServed: 800000,
        criticalService: 'Stromerzeugung > 100 MW',
        employees: 300,
        revenue: 100,
      },
      {},
      {},
      indicatorsConfig,
    );

    expect(result.status).toBe('direkt_betroffen');
    expect(result.title).toBe('Wahrscheinlich KRITIS-pflichtig');
    expect(result.reasons).toContain('800.000 versorgte Personen');
    expect(result.reasons).toContain('Sektor Energie');
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('Mittelstand-IT-Dienstleister, 30% KRITIS-Umsatz, Single Source -> indirekt_betroffen', () => {
    const result = evaluateApplicability(
      {
        sector: 'keiner',
      },
      {
        kritisRevenueShare: 30,
        singleSource: true,
        contractualResilienceObligations: false,
      },
      {},
      indicatorsConfig,
    );

    expect(result.status).toBe('indirekt_betroffen');
    expect(result.reasons).toContain('30 % Umsatz mit KRITIS-Kunden');
    expect(result.reasons).toContain('Single-Source für mindestens einen KRITIS-Kunden');
  });

  it('Bauunternehmen ohne KRITIS-Bezug, 20 MA, 5 Mio EUR -> eher_nicht_betroffen', () => {
    const result = evaluateApplicability(
      {
        sector: 'keiner',
        employees: 20,
        revenue: 5,
      },
      {
        kritisRevenueShare: 0,
      },
      {},
      indicatorsConfig,
    );

    expect(result.status).toBe('eher_nicht_betroffen');
    expect(result.title).toBe('Aktuell keine KRITIS-Indikatoren');
    expect(result.reasons).toContain('Sektor ohne KRITIS-Bezug');
  });

  it('Wasser-Versorger mit 200k Personen, kritischer Dienstleistung -> pruefbeduerftig', () => {
    const result = evaluateApplicability(
      {
        sector: 'wasser',
        personsServed: 200000,
        criticalService: 'Trinkwasserversorgung',
      },
      {},
      {},
      indicatorsConfig,
    );

    expect(result.status).toBe('pruefbeduerftig');
    expect(result.reasons).toContain('Kritische Dienstleistung: Trinkwasserversorgung');
  });

  it('Tolerant gegenueber fehlenden Indikatoren', () => {
    const result = evaluateApplicability({}, {}, {}, indicatorsConfig);
    expect(result.status).toBe('eher_nicht_betroffen');
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
