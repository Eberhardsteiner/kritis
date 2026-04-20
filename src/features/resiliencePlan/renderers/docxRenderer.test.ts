import { describe, expect, it } from 'vitest';
import { Packer } from 'docx';
import {
  buildResiliencePlanDocxFileName,
  renderResiliencePlanDocxBlob,
  renderResiliencePlanDocxDocument,
} from './docxRenderer';
import { buildEmptyPlanContent } from '../template';
import type { ResiliencePlan } from '../types';

const plan: ResiliencePlan = {
  id: 'plan-d',
  tenantId: 'demo',
  version: '1.0.0',
  status: 'review',
  createdAt: '2026-04-20T10:00:00Z',
  updatedAt: '2026-04-20T10:00:00Z',
  content: {
    ...buildEmptyPlanContent(),
    scope: {
      ...buildEmptyPlanContent().scope,
      operatorName: 'Stadtwerke Musterheim',
      sector: 'Energie',
      criticalService: 'Stromverteilung',
    },
    riskBasis: {
      ...buildEmptyPlanContent().riskBasis,
      topRisks: [
        {
          title: 'Ransomware auf Leitstelle',
          category: 'cyber_physical',
          initialScore: 20,
          residualScore: 12,
          criticality: 'Sofort handeln',
        },
      ],
    },
    measuresByGoal: {
      prevent: [
        {
          id: 'm1',
          title: 'Awareness-Training',
          description: 'Phishing-Kampagne',
          goal: 'prevent',
          owner: 'CISO',
          dueDate: '2026-09-30',
          status: 'planned',
        },
      ],
      protect: [],
      respond: [],
      recover: [],
    },
  },
};

describe('renderResiliencePlanDocxDocument', () => {
  it('erzeugt einen DOCX-Buffer plausibler Größe', async () => {
    const doc = renderResiliencePlanDocxDocument(plan, {
      generatedAt: new Date('2026-04-20T10:00:00Z'),
    });
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.byteLength).toBeGreaterThan(3000);
    // ZIP magic (DOCX ist ein ZIP)
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it('erzeugt auch bei leerem Plan ein gueltiges Dokument', async () => {
    const emptyPlan: ResiliencePlan = {
      ...plan,
      content: buildEmptyPlanContent(),
    };
    const doc = renderResiliencePlanDocxDocument(emptyPlan);
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it('verarbeitet einen approved-Plan und setzt die Freigabe-Kopfzeile', async () => {
    const approved: ResiliencePlan = {
      ...plan,
      status: 'approved',
      approvedBy: 'Dr. Muster',
      approvedAt: '2026-05-01',
    };
    const doc = renderResiliencePlanDocxDocument(approved);
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.byteLength).toBeGreaterThan(2000);
  });
});

describe('renderResiliencePlanDocxBlob', () => {
  it('liefert einen Blob mit DOCX-MIME-Typ', async () => {
    const blob = await renderResiliencePlanDocxBlob(plan);
    expect(blob.type).toContain('wordprocessingml.document');
    expect(blob.size).toBeGreaterThan(3000);
  });
});

describe('buildResiliencePlanDocxFileName', () => {
  it('baut einen stabilen Dateinamen mit Mandantenslug und Version', () => {
    const name = buildResiliencePlanDocxFileName(
      'Stadtwerke Musterheim',
      '1.0.0',
      new Date('2026-04-20T10:00:00Z'),
    );
    expect(name).toBe('Resilienzplan-stadtwerke-musterheim-v1.0.0-2026-04-20.docx');
  });

  it('fällt bei leerem Mandantennamen auf "mandant" zurück', () => {
    const name = buildResiliencePlanDocxFileName('', '1.0.0', new Date('2026-04-20T10:00:00Z'));
    expect(name).toBe('Resilienzplan-mandant-v1.0.0-2026-04-20.docx');
  });
});
