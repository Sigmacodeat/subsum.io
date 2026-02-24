import { Service } from '@toeverything/infra';

import type {
  Jurisdiction,
  JurisdictionConfig,
  JurisdictionDetectionResult,
  JurisdictionDetectionSignal,
  JurisdictionDetectionSignalType,
} from '../types';

/**
 * Jurisdiction Service
 *
 * Manages jurisdiction-aware configuration for the entire SaaS platform.
 * When a user selects their jurisdiction, this service provides:
 * - Country-specific court hierarchies
 * - Applicable legal code references
 * - Data protection authorities
 * - Currency & date formatting
 * - Filtering for LegalNormsService, DeadlineAutomationService, etc.
 *
 * National content is strictly separated: Austrian users see only Austrian law,
 * German users see only German law, etc. International comparison (ECHR/EU)
 * is always available as an opt-in overlay in English.
 */

export const JURISDICTION_CONFIGS: Record<Jurisdiction, JurisdictionConfig> = {
  AT: {
    id: 'AT',
    label: 'Österreich',
    flag: '🇦🇹',
    languages: ['de'],
    courtLevels: ['OGH', 'VfGH', 'VwGH', 'OLG', 'LG_AT', 'BG_AT', 'BVwG', 'LVwG', 'ASG'],
    civilCodeRefs: ['ABGB', 'MRG', 'KSchG', 'EKHG', 'PHG', 'UGB'],
    criminalCodeRefs: ['StGB-AT', 'VStG', 'FinStrG', 'SMG'],
    proceduralCodeRefs: ['ZPO-AT', 'StPO-AT', 'AVG', 'VwGVG', 'AußStrG'],
    dataProtectionAuthority: 'Österreichische Datenschutzbehörde (DSB)',
    currency: 'EUR',
    timezone: 'Europe/Vienna',
    dateFormat: 'DD.MM.YYYY',
  },
  DE: {
    id: 'DE',
    label: 'Deutschland',
    flag: '🇩🇪',
    languages: ['de'],
    courtLevels: ['BGH', 'BVerfG', 'BVerwG', 'BAG', 'BSG', 'BFH', 'OLG_DE', 'LG_DE', 'AG_DE'],
    civilCodeRefs: ['BGB', 'HGB', 'UWG', 'ProdHaftG', 'WEG', 'UrhG', 'MarkenG', 'PatG'],
    criminalCodeRefs: ['StGB', 'OWiG', 'BtMG'],
    proceduralCodeRefs: ['ZPO', 'StPO', 'VwGO', 'FGO', 'SGG', 'ArbGG', 'InsO'],
    dataProtectionAuthority: 'Bundesbeauftragte für den Datenschutz (BfDI)',
    currency: 'EUR',
    timezone: 'Europe/Berlin',
    dateFormat: 'DD.MM.YYYY',
  },
  CH: {
    id: 'CH',
    label: 'Schweiz',
    flag: '🇨🇭',
    languages: ['de', 'fr', 'it'],
    courtLevels: ['BGer', 'BVGer_CH', 'BStGer_CH', 'KGer_CH', 'OGer_CH', 'BezGer_CH'],
    civilCodeRefs: ['ZGB', 'OR', 'SchKG', 'IPRG', 'KKG'],
    criminalCodeRefs: ['StGB-CH', 'BetmG', 'SVG'],
    proceduralCodeRefs: ['ZPO-CH', 'StPO-CH', 'VwVG', 'BGG', 'SchKG'],
    dataProtectionAuthority: 'Eidgenössischer Datenschutz- und Öffentlichkeitsbeauftragter (EDÖB)',
    currency: 'CHF',
    timezone: 'Europe/Zurich',
    dateFormat: 'DD.MM.YYYY',
  },
  FR: {
    id: 'FR',
    label: 'France',
    flag: '🇫🇷',
    languages: ['fr'],
    courtLevels: ['CdC', 'CE_FR', 'CC_FR', 'CA_FR', 'TGI_FR', 'TJ_FR'],
    civilCodeRefs: ['Code civil', 'Code de commerce', 'Code de la consommation', 'Code de la propriété intellectuelle'],
    criminalCodeRefs: ['Code pénal', 'Code de procédure pénale'],
    proceduralCodeRefs: ['CPC-FR', 'Code de justice administrative', 'Code de l\'organisation judiciaire'],
    dataProtectionAuthority: 'Commission nationale de l\'informatique et des libertés (CNIL)',
    currency: 'EUR',
    timezone: 'Europe/Paris',
    dateFormat: 'DD/MM/YYYY',
  },
  IT: {
    id: 'IT',
    label: 'Italia',
    flag: '🇮🇹',
    languages: ['it'],
    courtLevels: ['CdC_IT', 'CC_IT', 'CdA_IT', 'Trib_IT', 'GdP_IT'],
    civilCodeRefs: ['Codice civile', 'Codice del consumo', 'Codice della proprietà industriale'],
    criminalCodeRefs: ['Codice penale', 'D.Lgs. 231/2001'],
    proceduralCodeRefs: ['CPC-IT', 'CPP-IT', 'Codice del processo amministrativo'],
    dataProtectionAuthority: 'Garante per la protezione dei dati personali',
    currency: 'EUR',
    timezone: 'Europe/Rome',
    dateFormat: 'DD/MM/YYYY',
  },
  PT: {
    id: 'PT',
    label: 'Portugal',
    flag: '🇵🇹',
    languages: ['pt'],
    courtLevels: ['STJ_PT', 'TC_PT', 'STA_PT', 'TRL_PT', 'TRC_PT', 'TRE_PT', 'TRP_PT'],
    civilCodeRefs: ['Código Civil', 'Código Comercial', 'CIRE'],
    criminalCodeRefs: ['Código Penal', 'RGIT'],
    proceduralCodeRefs: ['CPC-PT', 'CPP-PT', 'CPTA', 'CPPT'],
    dataProtectionAuthority: 'Comissão Nacional de Proteção de Dados (CNPD)',
    currency: 'EUR',
    timezone: 'Europe/Lisbon',
    dateFormat: 'DD/MM/YYYY',
  },
  PL: {
    id: 'PL',
    label: 'Polska',
    flag: '🇵🇱',
    languages: ['pl'],
    courtLevels: ['SN_PL', 'TK_PL', 'NSA_PL', 'SA_PL', 'SO_PL', 'SR_PL'],
    civilCodeRefs: ['KC', 'KSH', 'KRO', 'Prawo upadłościowe'],
    criminalCodeRefs: ['KK', 'KKS', 'Prawo wykroczeń'],
    proceduralCodeRefs: ['KPC', 'KPK', 'PPSA', 'KPA'],
    dataProtectionAuthority: 'Urząd Ochrony Danych Osobowych (UODO)',
    currency: 'PLN',
    timezone: 'Europe/Warsaw',
    dateFormat: 'DD.MM.YYYY',
  },
  EU: {
    id: 'EU',
    label: 'European Union',
    flag: '🇪🇺',
    languages: ['en', 'de', 'fr'],
    courtLevels: ['EuGH', 'EuG'],
    civilCodeRefs: ['DSGVO/GDPR', 'EU-Verordnungen'],
    criminalCodeRefs: [],
    proceduralCodeRefs: ['EuGH-VfO'],
    dataProtectionAuthority: 'European Data Protection Board (EDPB)',
    currency: 'EUR',
    timezone: 'Europe/Brussels',
    dateFormat: 'DD/MM/YYYY',
  },
  ECHR: {
    id: 'ECHR',
    label: 'ECHR / EMRK',
    flag: '🏛️',
    languages: ['en', 'fr'],
    courtLevels: ['EGMR'],
    civilCodeRefs: ['EMRK', 'EMRK-ZP1', 'EMRK-ZP4', 'EMRK-ZP6', 'EMRK-ZP7', 'EMRK-ZP12', 'EMRK-ZP13'],
    criminalCodeRefs: [],
    proceduralCodeRefs: ['EGMR-VfO'],
    dataProtectionAuthority: '',
    currency: 'EUR',
    timezone: 'Europe/Strasbourg',
    dateFormat: 'DD/MM/YYYY',
  },
};

/**
 * Maps locale strings to their primary Jurisdiction.
 * Used to auto-detect jurisdiction from browser/user locale.
 */
export const LOCALE_TO_JURISDICTION: Record<string, Jurisdiction> = {
  'de-AT': 'AT',
  'de-DE': 'DE',
  'de-CH': 'CH',
  'de': 'DE',
  'fr-FR': 'FR',
  'fr-CH': 'CH',
  'fr': 'FR',
  'it-IT': 'IT',
  'it-CH': 'CH',
  'it': 'IT',
  'pt-PT': 'PT',
  'pt-BR': 'PT',
  'pt': 'PT',
  'pl': 'PL',
  'en': 'EU',
};

/**
 * Court level labels for UI display.
 */
export const COURT_LEVEL_LABELS: Record<string, string> = {
  // Austria
  OGH: 'Oberster Gerichtshof',
  VfGH: 'Verfassungsgerichtshof',
  VwGH: 'Verwaltungsgerichtshof',
  OLG: 'Oberlandesgericht (AT)',
  LG_AT: 'Landesgericht (AT)',
  BG_AT: 'Bezirksgericht (AT)',
  BVwG: 'Bundesverwaltungsgericht (AT)',
  LVwG: 'Landesverwaltungsgericht (AT)',
  ASG: 'Arbeits- und Sozialgericht (AT)',
  // Germany
  BGH: 'Bundesgerichtshof',
  BVerfG: 'Bundesverfassungsgericht',
  BVerwG: 'Bundesverwaltungsgericht',
  BAG: 'Bundesarbeitsgericht',
  BSG: 'Bundessozialgericht',
  BFH: 'Bundesfinanzhof',
  OLG_DE: 'Oberlandesgericht (DE)',
  LG_DE: 'Landgericht (DE)',
  AG_DE: 'Amtsgericht (DE)',
  // Switzerland
  BGer: 'Bundesgericht / Tribunal fédéral',
  BVGer_CH: 'Bundesverwaltungsgericht (CH)',
  BStGer_CH: 'Bundesstrafgericht',
  KGer_CH: 'Kantonsgericht',
  OGer_CH: 'Obergericht',
  BezGer_CH: 'Bezirksgericht (CH)',
  // France
  CdC: 'Cour de cassation',
  CE_FR: 'Conseil d\'État',
  CC_FR: 'Conseil constitutionnel',
  CA_FR: 'Cour d\'appel',
  TGI_FR: 'Tribunal de grande instance',
  TJ_FR: 'Tribunal judiciaire',
  // Italy
  CdC_IT: 'Corte di Cassazione',
  CC_IT: 'Corte Costituzionale',
  CdA_IT: 'Corte d\'Appello',
  Trib_IT: 'Tribunale',
  GdP_IT: 'Giudice di Pace',
  // Portugal
  STJ_PT: 'Supremo Tribunal de Justiça',
  TC_PT: 'Tribunal Constitucional',
  STA_PT: 'Supremo Tribunal Administrativo',
  TRL_PT: 'Tribunal da Relação de Lisboa',
  TRC_PT: 'Tribunal da Relação de Coimbra',
  TRE_PT: 'Tribunal da Relação de Évora',
  TRP_PT: 'Tribunal da Relação do Porto',
  // Poland
  SN_PL: 'Sąd Najwyższy',
  TK_PL: 'Trybunał Konstytucyjny',
  NSA_PL: 'Naczelny Sąd Administracyjny',
  SA_PL: 'Sąd Apelacyjny',
  SO_PL: 'Sąd Okręgowy',
  SR_PL: 'Sąd Rejonowy',
  // EU / International
  EGMR: 'Europäischer Gerichtshof für Menschenrechte / ECHR',
  EuGH: 'Gerichtshof der Europäischen Union / CJEU',
  EuG: 'Gericht der Europäischen Union / General Court',
};

export class JurisdictionService extends Service {
  private addSignal(
    signals: JurisdictionDetectionSignal[],
    signal: JurisdictionDetectionSignal
  ) {
    signals.push(signal);
  }

  /**
   * Heuristic jurisdiction detection from text.
   * Designed to be:
   * - fast (regex + scoring)
   * - explainable (signals)
   * - safe (falls back to EU when uncertain)
   */
  detectFromText(text: string): JurisdictionDetectionResult {
    const sample = (text || '').slice(0, 80_000);
    const t = sample.toLowerCase();
    const signals: JurisdictionDetectionSignal[] = [];

    const scores: Record<Jurisdiction, number> = {
      AT: 0, DE: 0, CH: 0, FR: 0, IT: 0, PT: 0, PL: 0, EU: 0, ECHR: 0,
    };

    const add = (j: Jurisdiction, value: string, weight: number, signalType: JurisdictionDetectionSignalType = 'other') => {
      scores[j] += weight;
      this.addSignal(signals, { type: signalType, value, weight });
    };

    // ── Strong AT markers ──────────────────────────────────────────────────
    if (/\bogh\b/.test(t)) add('AT', 'OGH', 5, 'court');
    if (/\bvfgh\b/.test(t)) add('AT', 'VfGH', 5, 'court');
    if (/\bvwgh\b/.test(t)) add('AT', 'VwGH', 5, 'court');
    if (/\babgb\b/.test(t)) add('AT', 'ABGB', 4, 'law_reference');
    if (/\bmrg\b/.test(t)) add('AT', 'MRG', 3, 'law_reference');
    if (/\bkschg\b/.test(t)) add('AT', 'KSchG', 3, 'law_reference');
    if (/\bfinstrg\b/.test(t)) add('AT', 'FinStrG', 3, 'law_reference');
    if (/\bsmg\b/.test(t)) add('AT', 'SMG', 3, 'law_reference');
    if (/\baußstrg\b|\baussstrg\b/.test(t)) add('AT', 'AußStrG', 3, 'law_reference');
    if (/\bris\.bka\.gv\.at\b|\bris\.bgbl\b/.test(t)) add('AT', 'ris.bka.gv.at', 6, 'domain');
    if (/\bstaatsanwaltschaft\s+wien\b|\blandesgericht\s+wien\b/.test(t)) add('AT', 'AT authorities/courts', 3, 'authority');
    if (/\b\d{4}\s+wien\b|\b\d{4}\s+linz\b|\b\d{4}\s+graz\b|\b\d{4}\s+salzburg\b|\b\d{4}\s+innsbruck\b/.test(t)) add('AT', 'AT city/postal', 1, 'address');

    // ── Strong DE markers ──────────────────────────────────────────────────
    if (/\bbgh\b/.test(t)) add('DE', 'BGH', 5, 'court');
    if (/\bbverfg\b/.test(t)) add('DE', 'BVerfG', 5, 'court');
    if (/\bbverwg\b/.test(t)) add('DE', 'BVerwG', 5, 'court');
    if (/\bbgb\b/.test(t)) add('DE', 'BGB', 4, 'law_reference');
    if (/\bhgb\b/.test(t)) add('DE', 'HGB', 3, 'law_reference');
    if (/\buwo?g\b/.test(t)) add('DE', 'UWG', 2, 'law_reference');
    if (/\bins[oö]\b/.test(t)) add('DE', 'InsO', 3, 'law_reference');
    if (/\bgesetze-im-internet\.de\b|\bbundesanzeiger\.de\b/.test(t)) add('DE', 'gesetze-im-internet.de', 6, 'domain');
    if (/\bamtsgericht\b|\blandgericht\b/.test(t)) add('DE', 'DE courts', 2, 'court');
    if (/\b\d{5}\s+berlin\b|\b\d{5}\s+m[üu]nchen\b|\b\d{5}\s+hamburg\b|\b\d{5}\s+frankfurt\b|\b\d{5}\s+k[öo]ln\b/.test(t)) add('DE', 'DE city/postal', 1, 'address');

    // ── Strong CH markers ──────────────────────────────────────────────────
    if (/\bbger\b|\bbundesgericht\b/.test(t) && /\bschweiz|\bsuisse\b|\bsvizzera\b/i.test(t)) add('CH', 'BGer', 5, 'court');
    if (/\bbvger\b/.test(t)) add('CH', 'BVGer', 4, 'court');
    if (/\bbstger\b/.test(t)) add('CH', 'BStGer', 4, 'court');
    if (/\bzgb\b/.test(t)) add('CH', 'ZGB', 4, 'law_reference');
    if (/\b(?:obligationenrecht|or\s+art)\b/.test(t)) add('CH', 'OR', 3, 'law_reference');
    if (/\bschkg\b/.test(t)) add('CH', 'SchKG', 3, 'law_reference');
    if (/\biprg\b/.test(t)) add('CH', 'IPRG', 3, 'law_reference');
    if (/\bbgg\b/.test(t)) add('CH', 'BGG', 3, 'law_reference');
    if (/\badmin\.ch\b|\bfedlex\.admin\.ch\b/.test(t)) add('CH', 'admin.ch', 6, 'domain');
    if (/\bkanton\b|\bkantonal\b|\bkantonsrat\b/.test(t)) add('CH', 'CH canton', 3, 'authority');
    if (/\b\d{4}\s+z[üu]rich\b|\b\d{4}\s+bern\b|\b\d{4}\s+gen[èe]ve\b|\b\d{4}\s+basel\b|\b\d{4}\s+lausanne\b/.test(t)) add('CH', 'CH city/postal', 2, 'address');

    // ── Strong FR markers ──────────────────────────────────────────────────
    if (/\bcour\s+de\s+cassation\b/.test(t)) add('FR', 'Cour de cassation', 5, 'court');
    if (/\bconseil\s+d['']?\s*[ée]tat\b/.test(t)) add('FR', 'Conseil d\'État', 5, 'court');
    if (/\bconseil\s+constitutionnel\b/.test(t)) add('FR', 'Conseil constitutionnel', 5, 'court');
    if (/\bcode\s+civil\b/.test(t)) add('FR', 'Code civil', 4, 'law_reference');
    if (/\bcode\s+p[ée]nal\b/.test(t)) add('FR', 'Code pénal', 4, 'law_reference');
    if (/\bcode\s+de\s+commerce\b/.test(t)) add('FR', 'Code de commerce', 3, 'law_reference');
    if (/\bcode\s+de\s+la\s+consommation\b/.test(t)) add('FR', 'Code de la consommation', 3, 'law_reference');
    if (/\blegifrance\.gouv\.fr\b/.test(t)) add('FR', 'legifrance.gouv.fr', 6, 'domain');
    if (/\btribunal\s+judiciaire\b|\btribunal\s+de\s+grande\s+instance\b/.test(t)) add('FR', 'FR courts', 3, 'court');
    if (/\b\d{5}\s+paris\b|\b\d{5}\s+lyon\b|\b\d{5}\s+marseille\b/.test(t)) add('FR', 'FR city/postal', 1, 'address');

    // ── Strong IT markers ──────────────────────────────────────────────────
    if (/\bcorte\s+di\s+cassazione\b/.test(t)) add('IT', 'Corte di Cassazione', 5, 'court');
    if (/\bcorte\s+costituzionale\b/.test(t)) add('IT', 'Corte Costituzionale', 5, 'court');
    if (/\bcodice\s+civile\b/.test(t)) add('IT', 'Codice civile', 4, 'law_reference');
    if (/\bcodice\s+penale\b/.test(t)) add('IT', 'Codice penale', 4, 'law_reference');
    if (/\bcodice\s+del\s+consumo\b/.test(t)) add('IT', 'Codice del consumo', 3, 'law_reference');
    if (/\bnormattiva\.it\b|\bgazzettaufficiale\.it\b/.test(t)) add('IT', 'normattiva.it', 6, 'domain');
    if (/\btribunale\b|\bgiudice\s+di\s+pace\b/.test(t)) add('IT', 'IT courts', 2, 'court');
    if (/\b\d{5}\s+roma\b|\b\d{5}\s+milano\b|\b\d{5}\s+napoli\b/.test(t)) add('IT', 'IT city/postal', 1, 'address');

    // ── Strong PT markers ──────────────────────────────────────────────────
    if (/\bsupremo\s+tribunal\b/.test(t)) add('PT', 'Supremo Tribunal', 5, 'court');
    if (/\btribunal\s+constitucional\b/.test(t)) add('PT', 'Tribunal Constitucional', 5, 'court');
    if (/\bc[óo]digo\s+civil\b/.test(t)) add('PT', 'Código Civil', 4, 'law_reference');
    if (/\bc[óo]digo\s+penal\b/.test(t)) add('PT', 'Código Penal', 4, 'law_reference');
    if (/\bdre\.pt\b|\bpgdlisboa\.pt\b/.test(t)) add('PT', 'dre.pt', 6, 'domain');
    if (/\b\d{4}-\d{3}\s+lisboa\b|\b\d{4}-\d{3}\s+porto\b/.test(t)) add('PT', 'PT city/postal', 1, 'address');

    // ── Strong PL markers ──────────────────────────────────────────────────
    if (/\bs[ąa]d\s+najwy[żz]szy\b/.test(t)) add('PL', 'Sąd Najwyższy', 5, 'court');
    if (/\btrybuna[łl]\s+konstytucyjny\b/.test(t)) add('PL', 'Trybunał Konstytucyjny', 5, 'court');
    if (/\bkodeks\s+cywilny\b|\bkc\b/.test(t)) add('PL', 'KC', 4, 'law_reference');
    if (/\bkodeks\s+karny\b|\bkk\b/.test(t)) add('PL', 'KK', 4, 'law_reference');
    if (/\bkodeks\s+post[ęe]powania\s+cywilnego\b|\bkpc\b/.test(t)) add('PL', 'KPC', 3, 'law_reference');
    if (/\bisap\.sejm\.gov\.pl\b|\bdziennikustaw\.gov\.pl\b/.test(t)) add('PL', 'isap.sejm.gov.pl', 6, 'domain');
    if (/\bs[ąa]d\s+okr[ęe]gowy\b|\bs[ąa]d\s+rejonowy\b/.test(t)) add('PL', 'PL courts', 2, 'court');
    if (/\b\d{2}-\d{3}\s+warszawa\b|\b\d{2}-\d{3}\s+krak[óo]w\b/.test(t)) add('PL', 'PL city/postal', 1, 'address');

    // ── EU / ECHR markers ──────────────────────────────────────────────────
    if (/\beugh\b|\bcjeu\b|\bgerichtshof\s+der\s+europ[äa]ischen\s+union\b/.test(t)) add('EU', 'EuGH/CJEU', 4, 'court');
    if (/\bdsgvo\b|\bgdpr\b/.test(t)) add('EU', 'DSGVO/GDPR', 3, 'law_reference');
    if (/\begmr\b|\bechr\b|\bemrk\b/.test(t)) add('ECHR', 'EGMR/ECHR', 4, 'court');

    // ── Decide: pick jurisdiction with highest score ─────────────────────
    const nationalJurisdictions: Jurisdiction[] = ['AT', 'DE', 'CH', 'FR', 'IT', 'PT', 'PL'];
    let bestJurisdiction: Jurisdiction = 'EU';
    let bestScore = 0;

    for (const j of nationalJurisdictions) {
      if (scores[j] > bestScore) {
        bestScore = scores[j];
        bestJurisdiction = j;
      }
    }

    // If ECHR is the only signal, use that
    if (bestScore === 0 && scores.ECHR > 0) {
      return { jurisdiction: 'ECHR', confidence: Math.min(1, scores.ECHR / 10), signals };
    }
    if (bestScore === 0 && scores.EU > 0) {
      return { jurisdiction: 'EU', confidence: Math.min(1, scores.EU / 10), signals };
    }
    if (bestScore <= 0) {
      return { jurisdiction: 'EU', confidence: 0, signals };
    }

    // Compute confidence: how much the winner leads over the runner-up
    let runnerUpScore = 0;
    for (const j of nationalJurisdictions) {
      if (j !== bestJurisdiction && scores[j] > runnerUpScore) {
        runnerUpScore = scores[j];
      }
    }
    const confidence = Math.min(1, (bestScore - runnerUpScore) / Math.max(6, bestScore));

    return { jurisdiction: bestJurisdiction, confidence, signals };
  }

  /**
   * Get the configuration for a specific jurisdiction.
   */
  getConfig(jurisdiction: Jurisdiction): JurisdictionConfig {
    return JURISDICTION_CONFIGS[jurisdiction];
  }

  /**
   * Get all available jurisdiction configurations.
   */
  getAllConfigs(): JurisdictionConfig[] {
    return Object.values(JURISDICTION_CONFIGS);
  }

  /**
   * Get all national jurisdictions (excluding EU/ECHR supranational).
   */
  getNationalJurisdictions(): JurisdictionConfig[] {
    return this.getAllConfigs().filter(
      c => c.id !== 'EU' && c.id !== 'ECHR'
    );
  }

  /**
   * Detect jurisdiction from a locale string.
   * Falls back to EU if no match.
   */
  detectFromLocale(locale: string): Jurisdiction {
    if (LOCALE_TO_JURISDICTION[locale]) {
      return LOCALE_TO_JURISDICTION[locale];
    }
    const base = locale.split('-')[0];
    return LOCALE_TO_JURISDICTION[base] ?? 'EU';
  }

  /**
   * Get the court label for display.
   */
  getCourtLabel(court: string): string {
    return COURT_LEVEL_LABELS[court] ?? court;
  }

  /**
   * Get all courts for a specific jurisdiction.
   */
  getCourtsForJurisdiction(jurisdiction: Jurisdiction): { id: string; label: string }[] {
    const config = this.getConfig(jurisdiction);
    return config.courtLevels.map(c => ({
      id: c,
      label: COURT_LEVEL_LABELS[c] ?? c,
    }));
  }

  /**
   * Get all applicable law references for a jurisdiction.
   * Combines civil, criminal, and procedural codes.
   */
  getLawReferences(jurisdiction: Jurisdiction): string[] {
    const config = this.getConfig(jurisdiction);
    return [
      ...config.civilCodeRefs,
      ...config.criminalCodeRefs,
      ...config.proceduralCodeRefs,
    ];
  }

  /**
   * Check if a law reference belongs to a jurisdiction.
   */
  isLawInJurisdiction(law: string, jurisdiction: Jurisdiction): boolean {
    return this.getLawReferences(jurisdiction).some(
      ref => ref.toLowerCase() === law.toLowerCase()
    );
  }

  /**
   * Get the jurisdictions where international comparison is available.
   * Always includes EU and ECHR for cross-border cases.
   */
  getInternationalOverlays(): Jurisdiction[] {
    return ['EU', 'ECHR'];
  }

  /**
   * Format a date according to the jurisdiction's date format.
   */
  formatDate(date: Date, jurisdiction: Jurisdiction): string {
    const config = this.getConfig(jurisdiction);
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear().toString();

    switch (config.dateFormat) {
      case 'DD/MM/YYYY':
        return `${d}/${m}/${y}`;
      case 'DD.MM.YYYY':
      default:
        return `${d}.${m}.${y}`;
    }
  }
}
