import { describe, expect, it } from 'vitest';
import { Packer } from 'docx';
import {
  buildRiskAnalysisBlob,
  buildRiskAnalysisDocument,
  buildRiskAnalysisFileName,
} from './riskAnalysisDocx';
import type { RiskEntry } from '../types';
import type { CompanyProfile } from '../../../types';

const companyProfile: CompanyProfile = {
  companyName: 'Stadtwerke Musterheim',
  industryLabel: 'Energie',
  employees: '420',
  locations: '3 Standorte, 1 Leitstelle',
  criticalService: 'Stromverteilung',
  personsServed: '520000',
};

const entries: RiskEntry[] = [
  {
    id: 'r1',
    categoryId: 'nature',
    subCategoryId: 'flooding',
    titel: 'Hochwasser am Standort West',
    beschreibung: 'HQ100-Zone',
    eintrittswahrscheinlichkeit: 3,
    auswirkung: 4,
    affectedAssetIds: [],
    affectedProcessIds: [],
    affectedInterdependencies: [],
    mitigationMeasureIds: [],
    residualRisk: 2,
    reviewDate: '2026-12-31',
    owner: 'BCM',
  },
  {
    id: 'r2',
    categoryId: 'cyber_physical',
    subCategoryId: 'ransomware_production',
    titel: 'Ransomware auf Leitstellen-IT',
    beschreibung: '',
    eintrittswahrscheinlichkeit: 4,
    auswirkung: 5,
    affectedAssetIds: [],
    affectedProcessIds: [],
    affectedInterdependencies: [],
    mitigationMeasureIds: [],
    residualRisk: 3,
    reviewDate: '',
    owner: 'OT-Security',
  },
];

describe('buildRiskAnalysisDocument', () => {
  it('erzeugt ein DOCX-Dokument plausibler Groesse', async () => {
    const document = buildRiskAnalysisDocument({
      companyProfile,
      riskEntries: entries,
      generatedAt: new Date('2026-04-20T10:00:00Z'),
    });
    const buffer = await Packer.toBuffer(document);
    expect(buffer.byteLength).toBeGreaterThan(2000);
    // ZIP magic (DOCX ist ZIP)
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it('erzeugt auch bei leerer Eingabe ein gueltiges Dokument', async () => {
    const document = buildRiskAnalysisDocument({
      companyProfile,
      riskEntries: [],
    });
    const buffer = await Packer.toBuffer(document);
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});

describe('buildRiskAnalysisBlob', () => {
  it('liefert einen Blob mit DOCX-MIME-Typ', async () => {
    const blob = await buildRiskAnalysisBlob({
      companyProfile,
      riskEntries: entries,
    });
    expect(blob.size).toBeGreaterThan(2000);
    expect(blob.type).toContain('wordprocessingml.document');
  });
});

describe('buildRiskAnalysisFileName', () => {
  it('baut einen stabilen Dateinamen aus Mandant und Datum', () => {
    const name = buildRiskAnalysisFileName(companyProfile, new Date('2026-04-20T10:00:00Z'));
    expect(name).toBe('Betreiber-Risikoanalyse-stadtwerke-musterheim-2026-04-20.docx');
  });

  it('faellt auf "mandant" zurueck, wenn der Mandantenname leer ist', () => {
    const name = buildRiskAnalysisFileName(
      { ...companyProfile, companyName: '' },
      new Date('2026-04-20T10:00:00Z'),
    );
    expect(name).toBe('Betreiber-Risikoanalyse-mandant-2026-04-20.docx');
  });

  it('saeubert nicht-ASCII-Zeichen aus dem Mandantennamen', () => {
    const name = buildRiskAnalysisFileName(
      { ...companyProfile, companyName: 'Müller & Söhne GmbH' },
      new Date('2026-04-20T10:00:00Z'),
    );
    expect(name).toMatch(/^Betreiber-Risikoanalyse-m-ller-s-hne-gmbh-2026-04-20\.docx$/);
  });
});
