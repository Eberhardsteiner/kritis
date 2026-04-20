import { describe, expect, it } from 'vitest';
import {
  buildResiliencePlanPdfFileName,
  renderResiliencePlanPdf,
  renderResiliencePlanPdfBlob,
} from './pdfRenderer';
import { buildEmptyPlanContent } from '../template';
import type { ResiliencePlan } from '../types';

const plan: ResiliencePlan = {
  id: 'plan-p',
  tenantId: 'demo',
  version: '1.0.0',
  status: 'draft',
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
    measuresByGoal: {
      prevent: [
        {
          id: 'm1',
          title: 'Awareness-Training',
          description: '',
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

describe('renderResiliencePlanPdf', () => {
  it('erzeugt ein jsPDF-Dokument mit mehreren Seiten und Text', () => {
    const pdf = renderResiliencePlanPdf(plan, { generatedAt: new Date('2026-04-20T10:00:00Z') });
    const pageCount = pdf.getNumberOfPages();
    expect(pageCount).toBeGreaterThan(0);
    const output = pdf.output('arraybuffer');
    expect(output.byteLength).toBeGreaterThan(1000);
  });

  it('rendert auch einen leeren Plan ohne Fehler', () => {
    const emptyPlan: ResiliencePlan = { ...plan, content: buildEmptyPlanContent() };
    const pdf = renderResiliencePlanPdf(emptyPlan);
    expect(pdf.getNumberOfPages()).toBeGreaterThan(0);
  });
});

describe('renderResiliencePlanPdfBlob', () => {
  it('liefert einen Blob mit application/pdf', () => {
    const blob = renderResiliencePlanPdfBlob(plan);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
  });
});

describe('buildResiliencePlanPdfFileName', () => {
  it('baut einen stabilen Dateinamen', () => {
    const name = buildResiliencePlanPdfFileName(
      'Stadtwerke Musterheim',
      '1.0.0',
      new Date('2026-04-20T10:00:00Z'),
    );
    expect(name).toBe('Resilienzplan-stadtwerke-musterheim-v1.0.0-2026-04-20.pdf');
  });

  it('fällt bei leerem Mandantennamen auf "mandant" zurück', () => {
    const name = buildResiliencePlanPdfFileName('', '1.0.0', new Date('2026-04-20T10:00:00Z'));
    expect(name).toBe('Resilienzplan-mandant-v1.0.0-2026-04-20.pdf');
  });
});
