import { describe, expect, test } from 'vitest';
import { Framework } from '@toeverything/infra';

import { DocumentProcessingService } from '../services/document-processing';

const XLSX_BASE64 =
  'UEsDBBQAAAAIAEZ+VFzoIxXfTQAAAF4AAAAUAAAAeGwvc2hhcmVkU3RyaW5ncy54bWyzsa/IzVEoSy0qzszPs1Uy1DNQUkjNS85PycxLt1UKDXHTtVCyt7MpLi4BEpl2NiV23jmJ6ak2+kC+PkgAIuiYV1xQVJqcgRDXB2kBAFBLAwQUAAAACABGflRcWalzZWkAAACkAAAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbLOxr8jNUShLLSrOzM+zVTLUM1BSSM1Lzk/JzEu3VQoNcdO1ULK3synPL8ouzkhNLbGzAVMuiSWJdjZF+eV2NskKJbZKxUp2NmV2Bjb6ZXY2+slAQRDXxAjO1wcrRVdviCavj2S2PsJKAFBLAQIUAxQAAAAIAEZ+VFzoIxXfTQAAAF4AAAAUAAAAAAAAAAAAAACAAQAAAAB4bC9zaGFyZWRTdHJpbmdzLnhtbFBLAQIUAxQAAAAIAEZ+VFxZqXNlaQAAAKQAAAAYAAAAAAAAAAAAAACAAX8AAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWxQSwUGAAAAAAIAAgCIAAAAHgEAAAAA';

const PPTX_BASE64 =
  'UEsDBBQAAAAIAEZ+VFz2ABfFeQAAALAAAAAVAAAAcHB0L3NsaWRlcy9zbGlkZTEueG1ss7GvyM1RKEstKs7Mz7NVMtQzUFJIzUvOT8nMS7dVCg1x07VQsrezKbAqzkkBUcnBELq4IKQoNRXCApElFU75KZV2NolWBSCiCESU2IWlFmUk5qXklOalF5ekFuVm5tnog8RBZBGYBKrWR+jWhxinjzBfH2alPsQJAFBLAQIUAxQAAAAIAEZ+VFz2ABfFeQAAALAAAAAVAAAAAAAAAAAAAACAAQAAAABwcHQvc2xpZGVzL3NsaWRlMS54bWxQSwUGAAAAAAEAAQBDAAAArAAAAAAA';

describe('DocumentProcessingService structured and office extraction', () => {
  const framework = new Framework();
  framework.service(DocumentProcessingService);
  const service = framework.provider().get(DocumentProcessingService);

  test('extracts JSON content with json-parser and creates chunks', async () => {
    const result = await service.processDocumentAsync({
      documentId: 'doc-json-1',
      caseId: 'case-1',
      workspaceId: 'ws-1',
      title: 'aktenlage.json',
      kind: 'note',
      rawContent: '{"forderung":"Schadenersatz","betrag":1200}',
      mimeType: 'application/json',
    });

    expect(result.extractionEngine).toBe('json-parser');
    expect(result.normalizedText).toContain('Schadenersatz');
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.processingStatus).not.toBe('failed');
  });

  test('extracts XML content via xml-stripper', async () => {
    const result = await service.processDocumentAsync({
      documentId: 'doc-xml-1',
      caseId: 'case-1',
      workspaceId: 'ws-1',
      title: 'frist.xml',
      kind: 'note',
      rawContent: '<root><frist>19.02.2026</frist><gericht>LG Wien</gericht></root>',
      mimeType: 'application/xml',
    });

    expect(result.extractionEngine).toBe('xml-stripper');
    expect(result.normalizedText).toContain('19.02.2026');
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  test('extracts CSV content via csv-normalizer', async () => {
    const result = await service.processDocumentAsync({
      documentId: 'doc-csv-1',
      caseId: 'case-1',
      workspaceId: 'ws-1',
      title: 'positionen.csv',
      kind: 'note',
      rawContent: 'position;wert\nKlage;4200',
      mimeType: 'text/csv',
    });

    expect(result.extractionEngine).toBe('csv-normalizer');
    expect(result.normalizedText).toContain('position | wert');
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  test('extracts XLSX base64 payload into semantic text', async () => {
    const result = await service.processDocumentAsync({
      documentId: 'doc-xlsx-1',
      caseId: 'case-1',
      workspaceId: 'ws-1',
      title: 'beweise.xlsx',
      kind: 'other',
      rawContent: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${XLSX_BASE64}`,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    expect(result.extractionEngine).toBe('xlsx-parser');
    expect(result.normalizedText).toContain('Klage');
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  test('extracts PPTX base64 payload into semantic text', async () => {
    const result = await service.processDocumentAsync({
      documentId: 'doc-pptx-1',
      caseId: 'case-1',
      workspaceId: 'ws-1',
      title: 'praesentation.pptx',
      kind: 'other',
      rawContent: `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${PPTX_BASE64}`,
      mimeType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });

    expect(result.extractionEngine).toBe('pptx-parser');
    expect(result.normalizedText).toContain('Verhandlungstermin');
    expect(result.chunks.length).toBeGreaterThan(0);
  });
});
