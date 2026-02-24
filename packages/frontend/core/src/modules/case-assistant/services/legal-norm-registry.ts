import { Service } from '@toeverything/infra';

import type { Jurisdiction, LegalNormRegistryRecord } from '../types';
import type { CaseAssistantStore } from '../stores/case-assistant';
import type { LegalNormsService } from './legal-norms';

/**
 * LegalNormRegistryService
 *
 * DB-ready sync/export service for Legal norms.
 * Converts the in-memory NORM_DATABASE into persisted, jurisdiction-separated
 * LegalNormRegistryRecord entries — ready for DB ingestion or JSON export.
 */
export class LegalNormRegistryService extends Service {
  constructor(
    private readonly store: CaseAssistantStore,
    private readonly normsService: LegalNormsService
  ) {
    super();
  }

  /**
   * Build registry records from the in-memory norm database.
   * Deduplicates jurisdictions and normalises text fields.
   */
  buildRegistryRecords(options: { jurisdictions?: Jurisdiction[] } = {}): LegalNormRegistryRecord[] {
    const now = new Date().toISOString();
    const jurisdictions = options.jurisdictions
      ? [...new Set(options.jurisdictions)]
      : undefined;

    const norms = this.normsService.getAllNorms({ jurisdictions });

    return norms.map(norm => ({
      id: norm.id,
      jurisdiction: (norm.jurisdiction ?? this.resolveJurisdictionFromLaw(norm.law)) as Jurisdiction,
      law: norm.law.trim(),
      paragraph: norm.paragraph.trim(),
      title: norm.title.trim(),
      shortDescription: norm.shortDescription.trim(),
      legalAreas: [],
      keywords: (norm.keywords ?? [])
        .map(k => k.trim())
        .filter((k, i, arr) => k.length > 0 && arr.indexOf(k) === i),
      limitationPeriodYears: norm.limitationPeriodYears,
      burdenOfProof: norm.burdenOfProof,
      equivalentNorms: [],
      leadingCaseIds: [],
      recentCaseIds: [],
      sourceUrl: undefined,
      importedAt: now,
      updatedAt: now,
    }));
  }

  /**
   * Sync all (or filtered) norms into the persistent store.
   * Returns deep-copied records so callers cannot mutate the persisted state.
   */
  async syncRegistry(options: { jurisdictions?: Jurisdiction[] } = {}): Promise<LegalNormRegistryRecord[]> {
    const records = this.buildRegistryRecords(options);
    await this.store.setLegalNormRegistry(records);
    return records.map(r => ({ ...r, keywords: [...r.keywords], equivalentNorms: [...(r.equivalentNorms ?? [])] }));
  }

  /**
   * Upsert a single record (e.g. after RIS/BGH ingestion enriches a norm).
   * Validates required fields and normalises text before persisting.
   */
  async upsertRecord(record: LegalNormRegistryRecord): Promise<LegalNormRegistryRecord> {
    const normalised: LegalNormRegistryRecord = {
      ...record,
      law: record.law.trim(),
      paragraph: record.paragraph.trim(),
      title: record.title.trim(),
      shortDescription: record.shortDescription.trim(),
      keywords: (record.keywords ?? [])
        .map(k => k.trim())
        .filter((k, i, arr) => k.length > 0 && arr.indexOf(k) === i),
      sourceUrl: record.sourceUrl?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    if (!normalised.title) {
      throw new Error('Titel darf nicht leer sein.');
    }

    await this.store.upsertLegalNormRegistryRecord(normalised);
    return { ...normalised, keywords: [...normalised.keywords] };
  }

  /**
   * Retrieve persisted registry records, optionally filtered by jurisdiction.
   * Returns deep copies to prevent external mutation.
   */
  async getRegistry(options: { jurisdictions?: Jurisdiction[] } = {}): Promise<LegalNormRegistryRecord[]> {
    const all = await this.store.getLegalNormRegistry();
    const filtered =
      options.jurisdictions && options.jurisdictions.length > 0
        ? all.filter(item => options.jurisdictions!.includes(item.jurisdiction))
        : all;
    return filtered.map(r => ({ ...r, keywords: [...r.keywords], equivalentNorms: [...(r.equivalentNorms ?? [])] }));
  }

  /**
   * Export all registry records as a JSON string, grouped by jurisdiction.
   * Suitable for DB pipeline ingestion or file export.
   */
  async exportAsJson(options: { jurisdictions?: Jurisdiction[] } = {}): Promise<string> {
    const records = await this.getRegistry(options);
    const grouped: Partial<Record<Jurisdiction, LegalNormRegistryRecord[]>> = {};
    for (const record of records) {
      if (!grouped[record.jurisdiction]) {
        grouped[record.jurisdiction] = [];
      }
      grouped[record.jurisdiction]!.push(record);
    }
    return JSON.stringify(grouped, null, 2);
  }

  private resolveJurisdictionFromLaw(law: string): Jurisdiction {
    const upper = law.toUpperCase();
    if (upper.includes('(AT)') || upper === 'BAO' || upper === 'ABGB' || upper === 'STGB (AT)') return 'AT';
    if (upper.includes('(CH)') || upper === 'DBG' || upper === 'MWSTG' || upper === 'OR') return 'CH';
    if (upper === 'EMRK' || upper === 'ECHR') return 'ECHR';
    return 'DE';
  }
}
