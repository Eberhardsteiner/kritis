import type {
  ApplicabilityResult,
  IndicatorsConfig,
  SelectIndicator,
} from '../types';

// ---------------------------------------------------------------------------
// Phase-2-Bewertungs-Engine.
//
// Entscheidungslogik (erste Match-Regel gewinnt):
//
// 1. direkt_betroffen: Sektor != 'keiner' UND
//    (personsServed >= 500.000) ODER
//    (criticalService gesetzt UND employees >= 250) ODER
//    (criticalService gesetzt UND revenue >= 50)
//
// 2. pruefbeduerftig: Sektor != 'keiner' UND nicht direkt UND
//    (personsServed in [100.000 .. 499.999]) ODER
//    (criticalService gesetzt) ODER
//    (employees in [50 .. 249]) ODER
//    (revenue in [10 .. 49])
//
// 3. indirekt_betroffen (Lieferkette):
//    kritisRevenueShare >= 25 ODER
//    (kritisRevenueShare >= 10 UND (contractualResilienceObligations ODER singleSource))
//
// 4. eher_nicht_betroffen sonst.
//
// Fehlende Indikatoren werden tolerant als 0 / '' / false gewertet — so
// bleibt das System robust gegenueber JSON-Erweiterungen.
// ---------------------------------------------------------------------------

function getNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.\-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getBool(value: unknown): boolean {
  return value === true;
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function findSectorLabel(config: IndicatorsConfig, sectorValue: string): string {
  const indicator = config.stage1_direct.indicators.find(
    (i): i is SelectIndicator => i.id === 'sector' && i.type === 'select',
  );
  const option = indicator?.options?.find((o) => o.value === sectorValue);
  return option?.label ?? sectorValue;
}

function formatPersons(value: number): string {
  return value.toLocaleString('de-DE');
}

function formatRevenueMillions(value: number): string {
  return value.toLocaleString('de-DE');
}

export function evaluateApplicability(
  stage1: Record<string, unknown>,
  stage2: Record<string, unknown>,
  _stage3: Record<string, unknown>,
  config: IndicatorsConfig,
): ApplicabilityResult {
  const sector = getString(stage1.sector);
  const personsServed = getNumber(stage1.personsServed);
  const criticalService = getString(stage1.criticalService);
  const employees = getNumber(stage1.employees);
  const revenue = getNumber(stage1.revenue);

  const kritisRevenueShare = getNumber(stage2.kritisRevenueShare);
  const contractualResilienceObligations = getBool(stage2.contractualResilienceObligations);
  const singleSource = getBool(stage2.singleSource);

  const sectorIsKritis = sector !== '' && sector !== 'keiner';
  const sectorLabel = sectorIsKritis ? findSectorLabel(config, sector) : '';

  // -- Regel 1: direkt_betroffen --------------------------------------------
  if (sectorIsKritis) {
    const directReasons: string[] = [];
    let hit = false;

    if (personsServed >= 500000) {
      directReasons.push(`Sektor ${sectorLabel}`);
      directReasons.push(`${formatPersons(personsServed)} versorgte Personen`);
      hit = true;
    }
    if (criticalService && employees >= 250) {
      if (!directReasons.includes(`Sektor ${sectorLabel}`)) {
        directReasons.push(`Sektor ${sectorLabel}`);
      }
      directReasons.push(`Kritische Dienstleistung: ${criticalService}`);
      directReasons.push(`${formatPersons(employees)} Mitarbeitende`);
      hit = true;
    }
    if (criticalService && revenue >= 50) {
      if (!directReasons.includes(`Sektor ${sectorLabel}`)) {
        directReasons.push(`Sektor ${sectorLabel}`);
      }
      const csReason = `Kritische Dienstleistung: ${criticalService}`;
      if (!directReasons.includes(csReason)) {
        directReasons.push(csReason);
      }
      directReasons.push(`Jahresumsatz ${formatRevenueMillions(revenue)} Mio. €`);
      hit = true;
    }

    if (hit) {
      return {
        status: 'direkt_betroffen',
        title: 'Wahrscheinlich KRITIS-pflichtig',
        text: 'Sektor und Versorgungsreichweite (oder kritische Dienstleistung) sprechen klar für eine Einstufung nach KRITISDachG.',
        reasons: Array.from(new Set(directReasons)),
        recommendations: [
          'Vertiefte Anlagen- und Dienstleistungsbetrachtung',
          'Behördenkontakt mit BBK / BSI vorbereiten',
          'Resilienzplan und Vorfallmeldewege aufbauen',
        ],
      };
    }

    // -- Regel 2: pruefbeduerftig -------------------------------------------
    const checkReasons: string[] = [];

    if (personsServed >= 100000 && personsServed < 500000) {
      checkReasons.push(`Sektor ${sectorLabel}`);
      checkReasons.push(`${formatPersons(personsServed)} versorgte Personen (zwischen 100.000 und 499.999)`);
    }
    if (criticalService) {
      if (!checkReasons.includes(`Sektor ${sectorLabel}`)) {
        checkReasons.push(`Sektor ${sectorLabel}`);
      }
      checkReasons.push(`Kritische Dienstleistung: ${criticalService}`);
    }
    if (employees >= 50 && employees < 250) {
      if (!checkReasons.includes(`Sektor ${sectorLabel}`)) {
        checkReasons.push(`Sektor ${sectorLabel}`);
      }
      checkReasons.push(`${formatPersons(employees)} Mitarbeitende (zwischen 50 und 249)`);
    }
    if (revenue >= 10 && revenue < 50) {
      if (!checkReasons.includes(`Sektor ${sectorLabel}`)) {
        checkReasons.push(`Sektor ${sectorLabel}`);
      }
      checkReasons.push(`Jahresumsatz ${formatRevenueMillions(revenue)} Mio. € (zwischen 10 und 49)`);
    }

    if (checkReasons.length > 0) {
      return {
        status: 'pruefbeduerftig',
        title: 'KRITIS-Relevanz prüfbedürftig',
        text: 'Es liegen Indikatoren vor, die eine vertiefte Einordnung notwendig machen. Schwellenwerte können sektorspezifisch unterhalb der Regelschwelle liegen.',
        reasons: Array.from(new Set(checkReasons)),
        recommendations: [
          'Anlagen und Dienstleistungen exakt erfassen',
          'Sektorspezifische Schwellen prüfen sobald Rechtsverordnung vorliegt',
          'Beratung zu Schwellenwert-Annäherung empfohlen',
        ],
      };
    }
  }

  // -- Regel 3: indirekt_betroffen ------------------------------------------
  const supplyReasons: string[] = [];
  let isIndirect = false;

  if (kritisRevenueShare >= 25) {
    supplyReasons.push(`${kritisRevenueShare} % Umsatz mit KRITIS-Kunden`);
    isIndirect = true;
  } else if (kritisRevenueShare >= 10 && (contractualResilienceObligations || singleSource)) {
    supplyReasons.push(`${kritisRevenueShare} % Umsatz mit KRITIS-Kunden`);
    isIndirect = true;
  }

  if (isIndirect) {
    if (contractualResilienceObligations) {
      supplyReasons.push('Vertragliche Resilienz-Pflichten gegenüber KRITIS-Kunden');
    }
    if (singleSource) {
      supplyReasons.push('Single-Source für mindestens einen KRITIS-Kunden');
    }

    return {
      status: 'indirekt_betroffen',
      title: 'Indirekt betroffen über die Lieferkette',
      text: 'Sie sind selbst nicht KRITIS-pflichtig, aber Ihre Position als Zulieferer löst NIS2- und vertragliche Resilienz-Pflichten aus.',
      reasons: supplyReasons,
      recommendations: [
        'Vertragliche Pflichten gegenüber KRITIS-Kunden prüfen',
        'Eigene Resilienz auf das vertragliche Niveau heben',
        'Audit-Fähigkeit aufbauen',
      ],
    };
  }

  // -- Regel 4: eher_nicht_betroffen ----------------------------------------
  const noReasons: string[] = [];
  if (sector === 'keiner') {
    noReasons.push('Sektor ohne KRITIS-Bezug');
  } else if (sector !== '') {
    noReasons.push(`Sektor ${sectorLabel}, Schwellenwerte aber unterschritten`);
  } else {
    noReasons.push('Keine eindeutigen Sektor-Angaben');
  }
  if (kritisRevenueShare > 0) {
    noReasons.push(`Nur ${kritisRevenueShare} % Umsatz mit KRITIS-Kunden`);
  } else {
    noReasons.push('Kein nennenswerter Umsatzanteil mit KRITIS-Kunden');
  }

  return {
    status: 'eher_nicht_betroffen',
    title: 'Aktuell keine KRITIS-Indikatoren',
    text: 'Auf Basis Ihrer Angaben ist eine direkte oder indirekte KRITIS-Betroffenheit derzeit nicht erkennbar. Das schließt eine periodische Neubewertung nicht aus.',
    reasons: noReasons,
    recommendations: [
      'Bei Geschäftsmodell-Änderungen erneut prüfen',
      'Resilienz-Selbstanalyse trotzdem sinnvoll als Fundament',
    ],
  };
}
