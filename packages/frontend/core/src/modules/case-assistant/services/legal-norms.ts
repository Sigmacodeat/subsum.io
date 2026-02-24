import { Service } from '@toeverything/infra';

import type { Jurisdiction } from '../types';

/**
 * Legal Norms Reference Service
 *
 * Provides a structured German law reference database for:
 * - Norm lookups (BGB, StGB, ZPO, VwGO, GG, HGB, etc.)
 * - Anspruchsgrundlagen matching
 * - Verjährungsfristen
 * - Fristberechnungen nach BGB/ZPO
 * - Beweislast-Zuordnung
 */

export type LegalDomain =
  | 'civil'
  | 'criminal'
  | 'administrative'
  | 'labor'
  | 'tax'
  | 'constitutional'
  | 'commercial'
  | 'family'
  | 'social'
  | 'insolvency';

export type NormType =
  | 'anspruchsgrundlage'
  | 'einwendung'
  | 'einrede'
  | 'verfahrensvorschrift'
  | 'beweislast'
  | 'frist'
  | 'definition'
  | 'strafnorm'
  | 'straftatbestand'
  | 'schutzgesetz'
  | 'ordnungswidrigkeiten';

export interface TatbestandsMerkmal {
  id: string;
  label: string;
  description: string;
  /** Keywords/phrases that indicate this element is present in facts */
  indicators: string[];
  /** 0-1 weight for overall norm matching */
  weight: number;
  /** Whether this element MUST be present for the norm to apply */
  required: boolean;
}

export interface LegalNorm {
  id: string;
  jurisdiction?: Jurisdiction;
  law: string;
  paragraph: string;
  title: string;
  shortDescription: string;
  domain: LegalDomain;
  type: NormType;
  prerequisites: string[];
  legalConsequence: string;
  relatedNorms: string[];
  limitationPeriodYears?: number;
  limitationStart?: string;
  burdenOfProof?: 'claimant' | 'defendant' | 'shared';
  keywords: string[];
  /** ID of the base norm this qualifies (e.g. schwerer Betrug → Betrug) */
  qualificationOf?: string;
  /** IDs of norms that qualify this one (e.g. Betrug → [schwerer Betrug, Bandenbetrug]) */
  qualifiedBy?: string[];
  /** 0=Grundtatbestand, 1=Qualifikation, 2=Besonders schwerer Fall, 3=Privilegierung */
  qualificationLevel?: number;
  /** Structured elements of the offense for automated checking */
  tatbestandsMerkmale?: TatbestandsMerkmal[];
  /** Sentencing range for criminal norms */
  strafrahmen?: {
    min?: string;
    max?: string;
    unit: 'freiheitsstrafe' | 'geldstrafe' | 'freiheitsstrafe_oder_geldstrafe';
  };
  /** Indicators that EXCLUDE this norm (speak against applicability) */
  exclusionIndicators?: string[];
}

export interface NormMatchResult {
  norm: LegalNorm;
  matchScore: number;
  matchedKeywords: string[];
  matchContext: string;
}

export interface AnspruchsgrundlageChain {
  id: string;
  title: string;
  anspruchsgrundlage: LegalNorm;
  einwendungen: LegalNorm[];
  einreden: LegalNorm[];
  beweislast: string;
  successProbabilityHint: 'high' | 'medium' | 'low' | 'uncertain';
}

export interface VerjährungsResult {
  normId: string;
  paragraph: string;
  periodYears: number;
  startEvent: string;
  calculatedExpiry?: string;
  isExpired: boolean;
  daysRemaining: number | null;
  hemmungHints: string[];
  neubeginnHints: string[];
}

type NormSearchOptions = {
  jurisdictions?: Jurisdiction[];
};

const NORM_DATABASE: LegalNorm[] = [
  // ═══ BGB - Allgemeiner Teil ═══
  {
    id: 'bgb-104',
    law: 'BGB',
    paragraph: '§ 104',
    title: 'Geschäftsunfähigkeit',
    shortDescription: 'Geschäftsunfähigkeit von Personen unter 7 Jahren und bei dauerhafter Störung der Geistestätigkeit.',
    domain: 'civil',
    type: 'definition',
    prerequisites: ['Person unter 7 Jahre', 'oder dauerhafte krankhafte Störung der Geistestätigkeit'],
    legalConsequence: 'Willenserklärungen sind nichtig (§ 105 BGB).',
    relatedNorms: ['bgb-105', 'bgb-106'],
    keywords: ['geschäftsunfähig', 'minderjährig', 'geistestätigkeit', 'nichtig'],
  },
  {
    id: 'bgb-119',
    law: 'BGB',
    paragraph: '§ 119',
    title: 'Anfechtbarkeit wegen Irrtums',
    shortDescription: 'Anfechtung einer Willenserklärung bei Inhalts- oder Erklärungsirrtum.',
    domain: 'civil',
    type: 'einwendung',
    prerequisites: ['Willenserklärung abgegeben', 'Inhaltsirrtum oder Erklärungsirrtum', 'Kausalität'],
    legalConsequence: 'Anfechtung macht Erklärung von Anfang an nichtig (§ 142 BGB), Schadensersatzpflicht (§ 122 BGB).',
    relatedNorms: ['bgb-120', 'bgb-122', 'bgb-142', 'bgb-143'],
    keywords: ['anfechtung', 'irrtum', 'willenserklärung', 'inhaltsirrtum', 'erklärungsirrtum'],
  },
  {
    id: 'bgb-123',
    law: 'BGB',
    paragraph: '§ 123',
    title: 'Anfechtbarkeit wegen Täuschung oder Drohung',
    shortDescription: 'Anfechtung bei arglistiger Täuschung oder widerrechtlicher Drohung.',
    domain: 'civil',
    type: 'einwendung',
    prerequisites: ['Arglistige Täuschung oder widerrechtliche Drohung', 'Kausalität für Willenserklärung'],
    legalConsequence: 'Anfechtung führt zur Nichtigkeit ex tunc.',
    relatedNorms: ['bgb-124', 'bgb-142'],
    keywords: ['täuschung', 'arglist', 'drohung', 'anfechtung'],
  },
  // ═══ BGB - Schuldrecht Allgemeiner Teil ═══
  {
    id: 'bgb-195',
    law: 'BGB',
    paragraph: '§ 195',
    title: 'Regelmäßige Verjährungsfrist',
    shortDescription: 'Die regelmäßige Verjährungsfrist beträgt drei Jahre.',
    domain: 'civil',
    type: 'frist',
    prerequisites: [],
    legalConsequence: 'Anspruch verjährt nach 3 Jahren.',
    relatedNorms: ['bgb-199', 'bgb-203', 'bgb-204'],
    limitationPeriodYears: 3,
    limitationStart: 'Ende des Jahres der Kenntnis (§ 199 BGB)',
    keywords: ['verjährung', 'drei jahre', 'regelfrist', 'frist'],
  },
  {
    id: 'bgb-199',
    law: 'BGB',
    paragraph: '§ 199',
    title: 'Beginn der regelmäßigen Verjährungsfrist',
    shortDescription: 'Verjährung beginnt mit Schluss des Jahres, in dem Anspruch entstanden und Gläubiger Kenntnis erlangt.',
    domain: 'civil',
    type: 'frist',
    prerequisites: ['Anspruch entstanden', 'Kenntnis oder grob fahrlässige Unkenntnis'],
    legalConsequence: 'Fristbeginn zum Jahresende.',
    relatedNorms: ['bgb-195', 'bgb-203', 'bgb-204'],
    keywords: ['verjährungsbeginn', 'kenntnis', 'jahresende', 'entstehung'],
  },
  {
    id: 'bgb-204',
    law: 'BGB',
    paragraph: '§ 204',
    title: 'Hemmung der Verjährung durch Rechtsverfolgung',
    shortDescription: 'Klageerhebung, Mahnbescheid u.a. hemmen die Verjährung.',
    domain: 'civil',
    type: 'frist',
    prerequisites: ['Rechtshängigkeit oder Mahnbescheid'],
    legalConsequence: 'Verjährung ist gehemmt während der Dauer der Rechtsverfolgung.',
    relatedNorms: ['bgb-195', 'bgb-199', 'bgb-203'],
    keywords: ['hemmung', 'klage', 'mahnbescheid', 'rechtshängigkeit', 'verjährungshemmung'],
  },
  // ═══ BGB - Vertragliche Ansprüche ═══
  {
    id: 'bgb-280-1',
    law: 'BGB',
    paragraph: '§ 280 Abs. 1',
    title: 'Schadensersatz wegen Pflichtverletzung',
    shortDescription: 'Schadensersatz bei Verletzung einer Pflicht aus dem Schuldverhältnis.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: [
      'Schuldverhältnis',
      'Pflichtverletzung',
      'Vertretenmüssen (vermutet)',
      'Schaden',
      'Kausalität',
    ],
    legalConsequence: 'Anspruch auf Schadensersatz.',
    relatedNorms: ['bgb-281', 'bgb-282', 'bgb-283', 'bgb-249'],
    burdenOfProof: 'shared',
    keywords: ['schadensersatz', 'pflichtverletzung', 'vertrag', 'haftung', 'schaden'],
  },
  {
    id: 'bgb-281',
    law: 'BGB',
    paragraph: '§ 281',
    title: 'Schadensersatz statt der Leistung',
    shortDescription: 'SE statt Leistung bei Nicht- oder Schlechtleistung nach Fristsetzung.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: [
      'Fälliger durchsetzbarer Anspruch',
      'Nicht- oder Schlechtleistung',
      'Erfolgloser Fristablauf',
      'Vertretenmüssen',
    ],
    legalConsequence: 'Anspruch auf Schadensersatz statt der Leistung.',
    relatedNorms: ['bgb-280-1', 'bgb-323'],
    burdenOfProof: 'shared',
    keywords: ['schadensersatz statt leistung', 'fristsetzung', 'nachfrist', 'nichtleistung'],
  },
  {
    id: 'bgb-311-2',
    law: 'BGB',
    paragraph: '§ 311 Abs. 2',
    title: 'Vorvertragliches Schuldverhältnis (culpa in contrahendo)',
    shortDescription: 'Haftung aus vorvertraglichem Schuldverhältnis (c.i.c.).',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: [
      'Vertragsverhandlungen / Vertragsanbahnung',
      'Pflichtverletzung',
      'Schaden',
      'Kausalität',
      'Vertretenmüssen',
    ],
    legalConsequence: 'Schadensersatz (negatives Interesse).',
    relatedNorms: ['bgb-280-1', 'bgb-241-2'],
    burdenOfProof: 'claimant',
    keywords: ['culpa in contrahendo', 'vorvertragliches schuldverhältnis', 'vertragsanbahnung'],
  },
  {
    id: 'bgb-323',
    law: 'BGB',
    paragraph: '§ 323',
    title: 'Rücktritt wegen nicht oder nicht vertragsgemäß erbrachter Leistung',
    shortDescription: 'Rücktritt nach erfolglosem Fristablauf bei Nicht- oder Schlechtleistung.',
    domain: 'civil',
    type: 'einwendung',
    prerequisites: ['Gegenseitiger Vertrag', 'Nicht-/Schlechtleistung', 'Erfolgloser Fristablauf'],
    legalConsequence: 'Rücktrittsrecht, Rückgewähr (§§ 346 ff. BGB).',
    relatedNorms: ['bgb-281', 'bgb-346'],
    keywords: ['rücktritt', 'fristsetzung', 'leistungsstörung', 'rückabwicklung'],
  },
  // ═══ BGB - Deliktsrecht ═══
  {
    id: 'bgb-823-1',
    law: 'BGB',
    paragraph: '§ 823 Abs. 1',
    title: 'Schadensersatzpflicht (deliktisch)',
    shortDescription: 'Wer vorsätzlich oder fahrlässig Leben, Körper, Gesundheit, Freiheit, Eigentum oder ein sonstiges Recht verletzt.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: [
      'Verletzungshandlung',
      'Rechtsgutsverletzung (Leben, Körper, Gesundheit, Freiheit, Eigentum, sonst. Recht)',
      'Haftungsbegründende Kausalität',
      'Rechtswidrigkeit',
      'Verschulden (Vorsatz oder Fahrlässigkeit)',
      'Schaden',
      'Haftungsausfüllende Kausalität',
    ],
    legalConsequence: 'Schadensersatz (§§ 249 ff. BGB).',
    relatedNorms: ['bgb-823-2', 'bgb-831', 'bgb-249'],
    limitationPeriodYears: 3,
    burdenOfProof: 'claimant',
    keywords: ['delikt', 'unerlaubte handlung', 'schadensersatz', 'fahrlässigkeit', 'vorsatz', 'rechtsgut'],
  },
  {
    id: 'bgb-823-2',
    law: 'BGB',
    paragraph: '§ 823 Abs. 2',
    title: 'Schadensersatz bei Schutzgesetzverletzung',
    shortDescription: 'Schadensersatz bei Verstoß gegen ein Schutzgesetz.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Verstoß gegen Schutzgesetz', 'Schutzzweck erfasst Kläger', 'Verschulden', 'Schaden'],
    legalConsequence: 'Schadensersatz wie § 823 Abs. 1 BGB.',
    relatedNorms: ['bgb-823-1'],
    burdenOfProof: 'claimant',
    keywords: ['schutzgesetz', 'delikt', 'schutznorm'],
  },
  {
    id: 'bgb-826',
    law: 'BGB',
    paragraph: '§ 826',
    title: 'Sittenwidrige vorsätzliche Schädigung',
    shortDescription: 'Schadensersatz bei vorsätzlicher sittenwidriger Schädigung.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Sittenwidrige Handlung', 'Vorsatz', 'Schaden', 'Kausalität'],
    legalConsequence: 'Schadensersatz.',
    relatedNorms: ['bgb-823-1'],
    burdenOfProof: 'claimant',
    keywords: ['sittenwidrig', 'vorsatz', 'schädigung'],
  },
  {
    id: 'bgb-831',
    law: 'BGB',
    paragraph: '§ 831',
    title: 'Haftung für den Verrichtungsgehilfen',
    shortDescription: 'Geschäftsherr haftet für Schäden durch Verrichtungsgehilfen.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Verrichtungsgehilfe', 'Schaden in Ausführung der Verrichtung', 'Vermutetes Verschulden des Geschäftsherrn'],
    legalConsequence: 'Schadensersatz (Exkulpation möglich).',
    relatedNorms: ['bgb-823-1', 'bgb-278'],
    burdenOfProof: 'defendant',
    keywords: ['verrichtungsgehilfe', 'geschäftsherr', 'arbeitgeber', 'exkulpation'],
  },
  // ═══ BGB - Bereicherungsrecht ═══
  {
    id: 'bgb-812-1-1-alt1',
    law: 'BGB',
    paragraph: '§ 812 Abs. 1 S. 1 Alt. 1',
    title: 'Leistungskondiktion',
    shortDescription: 'Herausgabe des durch Leistung ohne Rechtsgrund Erlangten.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Etwas erlangt', 'Durch Leistung', 'Ohne Rechtsgrund'],
    legalConsequence: 'Herausgabeanspruch des Erlangten.',
    relatedNorms: ['bgb-818', 'bgb-819'],
    burdenOfProof: 'claimant',
    keywords: ['bereicherung', 'leistungskondiktion', 'kondiktionsanspruch', 'rechtsgrund'],
  },
  // ═══ BGB - Sachenrecht ═══
  {
    id: 'bgb-985',
    law: 'BGB',
    paragraph: '§ 985',
    title: 'Herausgabeanspruch des Eigentümers',
    shortDescription: 'Der Eigentümer kann vom Besitzer die Herausgabe der Sache verlangen.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Eigentum des Anspruchstellers', 'Besitz des Anspruchsgegners', 'Kein Recht zum Besitz (§ 986)'],
    legalConsequence: 'Herausgabe der Sache.',
    relatedNorms: ['bgb-986', 'bgb-1004'],
    burdenOfProof: 'claimant',
    keywords: ['eigentum', 'herausgabe', 'vindikation', 'besitz'],
  },
  {
    id: 'bgb-1004',
    law: 'BGB',
    paragraph: '§ 1004',
    title: 'Beseitigungs- und Unterlassungsanspruch',
    shortDescription: 'Beseitigung der Beeinträchtigung und Unterlassung künftiger Beeinträchtigungen.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Eigentum', 'Beeinträchtigung (nicht Entziehung)', 'Wiederholungsgefahr (bei Unterlassung)'],
    legalConsequence: 'Beseitigungs- und/oder Unterlassungsanspruch.',
    relatedNorms: ['bgb-985'],
    burdenOfProof: 'claimant',
    keywords: ['unterlassung', 'beseitigung', 'beeinträchtigung', 'eigentum'],
  },
  // ═══ BGB - Mietrecht ═══
  {
    id: 'bgb-535',
    law: 'BGB',
    paragraph: '§ 535',
    title: 'Inhalt und Hauptpflichten des Mietvertrags',
    shortDescription: 'Pflichten von Vermieter (Gebrauchsüberlassung) und Mieter (Mietzahlung).',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Mietvertrag', 'Gebrauchsüberlassung / Mietzahlung'],
    legalConsequence: 'Gebrauchsüberlassungspflicht des Vermieters, Mietzahlungspflicht des Mieters.',
    relatedNorms: ['bgb-536', 'bgb-543', 'bgb-573'],
    keywords: ['miete', 'mietvertrag', 'vermieter', 'mieter', 'wohnung'],
  },
  {
    id: 'bgb-536',
    law: 'BGB',
    paragraph: '§ 536',
    title: 'Mietminderung bei Sach- und Rechtsmängeln',
    shortDescription: 'Mietminderung kraft Gesetzes bei erheblichem Mangel.',
    domain: 'civil',
    type: 'einrede',
    prerequisites: ['Mietvertrag', 'Sach- oder Rechtsmangel', 'Erheblichkeit'],
    legalConsequence: 'Miete ist gemindert für die Dauer des Mangels.',
    relatedNorms: ['bgb-535', 'bgb-536a'],
    keywords: ['mietminderung', 'mangel', 'sachmangel', 'miete', 'minderung'],
  },
  {
    id: 'bgb-573',
    law: 'BGB',
    paragraph: '§ 573',
    title: 'Ordentliche Kündigung des Vermieters (Wohnraum)',
    shortDescription: 'Kündigung nur bei berechtigtem Interesse (Eigenbedarf, Pflichtverletzung, wirtschaftliche Verwertung).',
    domain: 'civil',
    type: 'verfahrensvorschrift',
    prerequisites: ['Wohnraummietvertrag', 'Berechtigtes Interesse', 'Schriftform', 'Kündigungsfristen'],
    legalConsequence: 'Beendigung des Mietverhältnisses nach Ablauf der Frist.',
    relatedNorms: ['bgb-535', 'bgb-574'],
    keywords: ['kündigung', 'eigenbedarf', 'vermieter', 'wohnraum'],
  },
  // ═══ BGB - Arbeitsrecht-Bezug ═══
  {
    id: 'bgb-611a',
    law: 'BGB',
    paragraph: '§ 611a',
    title: 'Arbeitsvertrag',
    shortDescription: 'Definition und Hauptpflichten des Arbeitsvertrags.',
    domain: 'labor',
    type: 'definition',
    prerequisites: ['Arbeitsvertrag', 'Weisungsgebundenheit'],
    legalConsequence: 'Vergütungspflicht des Arbeitgebers, Leistungspflicht des Arbeitnehmers.',
    relatedNorms: ['bgb-626', 'kschg-1'],
    keywords: ['arbeitsvertrag', 'arbeitnehmer', 'arbeitgeber', 'weisungsgebunden'],
  },
  {
    id: 'bgb-626',
    law: 'BGB',
    paragraph: '§ 626',
    title: 'Fristlose Kündigung aus wichtigem Grund',
    shortDescription: 'Außerordentliche Kündigung bei Unzumutbarkeit der Fortsetzung.',
    domain: 'labor',
    type: 'verfahrensvorschrift',
    prerequisites: ['Wichtiger Grund', 'Interessenabwägung', 'Frist 2 Wochen ab Kenntnis'],
    legalConsequence: 'Sofortige Beendigung des Dienst-/Arbeitsverhältnisses.',
    relatedNorms: ['bgb-611a', 'kschg-1'],
    limitationPeriodYears: 0,
    keywords: ['fristlose kündigung', 'wichtiger grund', 'außerordentliche kündigung'],
  },
  // ═══ Amtshaftung ═══
  {
    id: 'bgb-839',
    law: 'BGB',
    paragraph: '§ 839',
    title: 'Haftung bei Amtspflichtverletzung',
    shortDescription: 'Beamtenhaftung bei vorsätzlicher oder fahrlässiger Amtspflichtverletzung.',
    domain: 'administrative',
    type: 'anspruchsgrundlage',
    prerequisites: [
      'Beamter im haftungsrechtlichen Sinn',
      'Ausübung eines öffentlichen Amtes',
      'Amtspflichtverletzung',
      'Drittbezogenheit',
      'Verschulden',
      'Schaden',
      'Kausalität',
      'Keine anderweitige Ersatzmöglichkeit (Subsidiarität bei Fahrlässigkeit)',
    ],
    legalConsequence: 'Schadensersatz (Staatshaftung über Art. 34 GG).',
    relatedNorms: ['gg-34'],
    limitationPeriodYears: 3,
    burdenOfProof: 'claimant',
    keywords: ['amtshaftung', 'amtspflichtverletzung', 'beamter', 'staatshaftung', 'behörde'],
  },
  {
    id: 'gg-34',
    law: 'GG',
    paragraph: 'Art. 34',
    title: 'Haftungsüberleitung auf den Staat',
    shortDescription: 'Verletzung der Amtspflicht gegenüber Dritten: Haftung trifft den Staat.',
    domain: 'administrative',
    type: 'anspruchsgrundlage',
    prerequisites: ['Amtspflichtverletzung i.S.d. § 839 BGB'],
    legalConsequence: 'Staat haftet anstelle des Beamten.',
    relatedNorms: ['bgb-839'],
    burdenOfProof: 'claimant',
    keywords: ['staatshaftung', 'haftungsüberleitung', 'amtshaftung'],
  },
  // ═══ ZPO - Verfahrensrecht ═══
  {
    id: 'zpo-253',
    law: 'ZPO',
    paragraph: '§ 253',
    title: 'Klageschrift',
    shortDescription: 'Anforderungen an Form und Inhalt der Klageschrift.',
    domain: 'civil',
    type: 'verfahrensvorschrift',
    prerequisites: ['Bezeichnung der Parteien', 'Bestimmter Antrag', 'Klagegrund'],
    legalConsequence: 'Zulässige Klageerhebung.',
    relatedNorms: ['zpo-256', 'zpo-261'],
    keywords: ['klage', 'klageschrift', 'antrag', 'gericht', 'zustellung'],
  },
  {
    id: 'zpo-256',
    law: 'ZPO',
    paragraph: '§ 256',
    title: 'Feststellungsklage',
    shortDescription: 'Klage auf Feststellung des Bestehens oder Nichtbestehens eines Rechtsverhältnisses.',
    domain: 'civil',
    type: 'verfahrensvorschrift',
    prerequisites: ['Feststellungsinteresse', 'Rechtsverhältnis'],
    legalConsequence: 'Feststellungsurteil.',
    relatedNorms: ['zpo-253'],
    keywords: ['feststellungsklage', 'feststellungsinteresse', 'rechtsverhältnis'],
  },
  {
    id: 'zpo-286',
    law: 'ZPO',
    paragraph: '§ 286',
    title: 'Freie Beweiswürdigung',
    shortDescription: 'Gericht entscheidet nach freier Überzeugung über das Ergebnis der Beweisaufnahme.',
    domain: 'civil',
    type: 'beweislast',
    prerequisites: ['Beweisaufnahme durchgeführt'],
    legalConsequence: 'Richterliche Überzeugungsbildung.',
    relatedNorms: ['zpo-355'],
    keywords: ['beweiswürdigung', 'überzeugung', 'beweis', 'beweisaufnahme'],
  },
  // ═══ VwGO ═══
  {
    id: 'vwgo-42',
    law: 'VwGO',
    paragraph: '§ 42',
    title: 'Anfechtungs- und Verpflichtungsklage',
    shortDescription: 'Klage auf Aufhebung eines VA oder Verpflichtung zum Erlass eines VA.',
    domain: 'administrative',
    type: 'verfahrensvorschrift',
    prerequisites: ['Verwaltungsakt', 'Klagebefugnis (mögliche Rechtsverletzung)', 'Vorverfahren (Widerspruch)'],
    legalConsequence: 'Aufhebung des VA oder Verpflichtung.',
    relatedNorms: ['vwgo-68', 'vwgo-113'],
    keywords: ['anfechtungsklage', 'verpflichtungsklage', 'verwaltungsakt', 'widerspruch'],
  },
  {
    id: 'vwgo-80',
    law: 'VwGO',
    paragraph: '§ 80',
    title: 'Aufschiebende Wirkung',
    shortDescription: 'Widerspruch und Anfechtungsklage haben grundsätzlich aufschiebende Wirkung.',
    domain: 'administrative',
    type: 'verfahrensvorschrift',
    prerequisites: ['Anfechtungsklage oder Widerspruch'],
    legalConsequence: 'Suspensiveffekt; Ausnahmen in Abs. 2.',
    relatedNorms: ['vwgo-42', 'vwgo-80a'],
    keywords: ['aufschiebende wirkung', 'eilantrag', 'suspensiveffekt', 'vorläufiger rechtsschutz'],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // DE StGB — BETRUG-KETTE (§§ 263–263a) mit Qualifikationen
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-263',
    law: 'StGB',
    paragraph: '§ 263',
    title: 'Betrug',
    shortDescription: 'Betrug durch Täuschung über Tatsachen mit Vermögensschaden.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Täuschung über Tatsachen', 'Irrtum', 'Vermögensverfügung', 'Vermögensschaden', 'Vorsatz + Bereicherungsabsicht'],
    legalConsequence: 'Freiheitsstrafe bis 5 Jahre oder Geldstrafe.',
    relatedNorms: ['stgb-263a', 'stgb-263-3', 'stgb-263-5'],
    keywords: ['betrug', 'täuschung', 'vermögensschaden', 'straftat', 'irrtum', 'bereicherungsabsicht'],
    qualificationLevel: 0,
    qualifiedBy: ['stgb-263-3', 'stgb-263-5'],
    strafrahmen: { max: '5 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-263-1', label: 'Täuschung über Tatsachen', description: 'Aktives Vorspiegeln/Entstellen/Unterdrücken von Tatsachen', indicators: ['täuschung', 'getäuscht', 'vorgetäuscht', 'falsche angaben', 'unwahre behauptung', 'vorspiegeln', 'vorgespiegelt', 'falsche tatsachen'], weight: 1.0, required: true },
      { id: 'tb-263-2', label: 'Irrtum', description: 'Irrtumserregung beim Opfer', indicators: ['irrtum', 'geirrt', 'geglaubt', 'angenommen', 'vertraute darauf', 'gutgläubig'], weight: 0.9, required: true },
      { id: 'tb-263-3', label: 'Vermögensverfügung', description: 'Irrtumsbedingte Vermögensverfügung', indicators: ['gezahlt', 'überwiesen', 'übertragen', 'hingegeben', 'geleistet', 'ausgezahlt', 'bezahlt'], weight: 0.8, required: true },
      { id: 'tb-263-4', label: 'Vermögensschaden', description: 'Vermögensschaden beim Opfer', indicators: ['schaden', 'verlust', 'nachteil', 'vermögensnachteil', 'vermögensschaden', 'geschädigt'], weight: 1.0, required: true },
      { id: 'tb-263-5', label: 'Bereicherungsabsicht', description: 'Absicht rechtswidriger Bereicherung', indicators: ['bereichert', 'bereicherung', 'eigennutz', 'sich bereichern', 'profit', 'gewinnabsicht'], weight: 0.7, required: true },
    ],
    exclusionIndicators: ['fahrlässig', 'versehentlich', 'irrtum des täters'],
  },
  {
    id: 'stgb-263-3',
    law: 'StGB',
    paragraph: '§ 263 Abs. 3',
    title: 'Besonders schwerer Fall des Betrugs',
    shortDescription: 'Besonders schwerer Fall: gewerbsmäßig, als Mitglied einer Bande, großer Vermögensverlust, Ausnutzung einer Amtsstellung.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 263 StGB', 'Regelbeispiel Abs. 3: gewerbsmäßig ODER Bande ODER großer Verlust ODER Amtsstellung'],
    legalConsequence: 'Freiheitsstrafe von 6 Monaten bis 10 Jahre.',
    relatedNorms: ['stgb-263', 'stgb-263-5'],
    keywords: ['schwerer betrug', 'gewerbsmäßig', 'gewerbsmäßiger betrug', 'großer vermögensverlust', 'amtsstellung', 'amtsmissbrauch betrug'],
    qualificationOf: 'stgb-263',
    qualificationLevel: 2,
    strafrahmen: { min: '6 Monate', max: '10 Jahre', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-263-3-1', label: 'Gewerbsmäßigkeit', description: 'Wiederholungsabsicht zur Einnahmeerzielung', indicators: ['gewerbsmäßig', 'wiederholt', 'regelmäßig', 'geschäftsmäßig', 'fortgesetzt', 'serientäter', 'mehrfach betrogen', 'systematisch'], weight: 0.9, required: false },
      { id: 'tb-263-3-2', label: 'Bandenmäßig', description: 'Zusammenwirken von mindestens 3 Personen', indicators: ['bande', 'bandenmäßig', 'gruppe', 'mittäter', 'gemeinsam', 'zusammen begangen', 'organisiert', 'team', 'komplizen', 'mehrere täter', 'zusammenarbeit'], weight: 0.9, required: false },
      { id: 'tb-263-3-3', label: 'Großer Vermögensverlust', description: 'Vermögensverlust großen Ausmaßes (ab ca. 50.000 EUR)', indicators: ['großer schaden', 'erheblicher schaden', 'millionen', 'hunderttausend', 'großes ausmaß', 'enormer schaden'], weight: 0.8, required: false },
      { id: 'tb-263-3-4', label: 'Amtsstellung ausgenutzt', description: 'Täter missbraucht Amtsstellung', indicators: ['amtsstellung', 'beamter', 'amtsmissbrauch', 'dienstliche stellung', 'behörde'], weight: 0.7, required: false },
    ],
  },
  {
    id: 'stgb-263-5',
    law: 'StGB',
    paragraph: '§ 263 Abs. 5',
    title: 'Bandenbetrug (gewerbs- und bandenmäßig)',
    shortDescription: 'Gewerbsmäßiger Bandenbetrug: Täter handelt als Mitglied einer Bande, die sich zur fortgesetzten Begehung von Betrug verbunden hat.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 263 StGB', 'Gewerbsmäßigkeit', 'Bandenmitgliedschaft (mind. 3 Personen)', 'Verbindung zur fortgesetzten Begehung'],
    legalConsequence: 'Freiheitsstrafe von 1 Jahr bis 10 Jahre.',
    relatedNorms: ['stgb-263', 'stgb-263-3', 'stgb-129'],
    keywords: ['bandenbetrug', 'gewerbsmäßig bandenmäßig betrug', 'organisierter betrug', 'betrugsring'],
    qualificationOf: 'stgb-263',
    qualificationLevel: 2,
    strafrahmen: { min: '1 Jahr', max: '10 Jahre', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-263-5-1', label: 'Gewerbsmäßigkeit', description: 'Wiederholte Tatbegehung als Einnahmequelle', indicators: ['gewerbsmäßig', 'wiederholt', 'fortgesetzt', 'einnahmequelle', 'systematisch'], weight: 1.0, required: true },
      { id: 'tb-263-5-2', label: 'Bandenmitgliedschaft', description: 'Mind. 3 Personen zur fortgesetzten Begehung verbunden', indicators: ['bande', 'bandenmäßig', 'organisiert', 'ring', 'gruppe', 'netzwerk', 'zusammenschluss', 'verbunden'], weight: 1.0, required: true },
    ],
  },
  {
    id: 'stgb-263a',
    law: 'StGB',
    paragraph: '§ 263a',
    title: 'Computerbetrug',
    shortDescription: 'Beeinflussung des Ergebnisses eines Datenverarbeitungsvorgangs durch unrichtige Programmgestaltung, Verwendung unrichtiger Daten etc.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Beeinflussung eines Datenverarbeitungsvorgangs', 'Unrichtige Gestaltung/Verwendung/unbefugte Einwirkung', 'Vermögensschaden'],
    legalConsequence: 'Freiheitsstrafe bis 5 Jahre oder Geldstrafe.',
    relatedNorms: ['stgb-263', 'stgb-202a'],
    keywords: ['computerbetrug', 'datenverarbeitung', 'software manipulation', 'online betrug', 'phishing', 'skimming', 'hacking betrug'],
    qualificationLevel: 0,
    strafrahmen: { max: '5 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-263a-1', label: 'Datenverarbeitungsvorgang', description: 'Eingriff in automatisierte Datenverarbeitung', indicators: ['computer', 'software', 'programm', 'datenverarbeitung', 'automat', 'online', 'internet', 'system'], weight: 1.0, required: true },
      { id: 'tb-263a-2', label: 'Unrichtige Beeinflussung', description: 'Unrichtige Gestaltung/Datenverwendung/unbefugte Einwirkung', indicators: ['manipuliert', 'gefälscht', 'unbefugt', 'gehackt', 'eingeschleust', 'verändert'], weight: 0.9, required: true },
      { id: 'tb-263a-3', label: 'Vermögensschaden', description: 'Vermögensschaden als Ergebnis', indicators: ['schaden', 'vermögensschaden', 'verlust', 'abgebucht', 'entwendet'], weight: 0.8, required: true },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // DE StGB — KÖRPERVERLETZUNG-KETTE (§§ 223–227)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-223',
    law: 'StGB',
    paragraph: '§ 223',
    title: 'Körperverletzung',
    shortDescription: 'Wer eine andere Person körperlich misshandelt oder an der Gesundheit schädigt.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Körperliche Misshandlung oder Gesundheitsschädigung', 'Vorsatz'],
    legalConsequence: 'Freiheitsstrafe bis 5 Jahre oder Geldstrafe.',
    relatedNorms: ['stgb-224', 'stgb-226', 'stgb-227', 'stgb-229'],
    keywords: ['körperverletzung', 'misshandlung', 'gesundheitsschädigung', 'schläge', 'verletzung'],
    qualificationLevel: 0,
    qualifiedBy: ['stgb-224', 'stgb-226', 'stgb-226a', 'stgb-227'],
    strafrahmen: { max: '5 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-223-1', label: 'Körperliche Misshandlung', description: 'Üble, unangemessene Behandlung, die körperliches Wohlbefinden beeinträchtigt', indicators: ['geschlagen', 'getreten', 'gestoßen', 'gewürgt', 'misshandelt', 'geprügelt', 'ohrfeige', 'faustschlag', 'tritt'], weight: 1.0, required: false },
      { id: 'tb-223-2', label: 'Gesundheitsschädigung', description: 'Hervorrufen oder Steigern eines pathologischen Zustands', indicators: ['verletzt', 'verletzung', 'wunde', 'bruch', 'fraktur', 'prellungen', 'hämatome', 'blutung', 'gehirnerschütterung', 'trauma'], weight: 1.0, required: false },
      { id: 'tb-223-3', label: 'Vorsatz', description: 'Vorsätzliches Handeln', indicators: ['absichtlich', 'vorsätzlich', 'bewusst', 'willentlich', 'gezielt'], weight: 0.6, required: true },
    ],
    exclusionIndicators: ['fahrlässig', 'unbeabsichtigt', 'unfall', 'versehen'],
  },
  {
    id: 'stgb-224',
    law: 'StGB',
    paragraph: '§ 224',
    title: 'Gefährliche Körperverletzung',
    shortDescription: 'KV mittels Waffe/gefährlichem Werkzeug, hinterlistig, mit einem anderen Beteiligten gemeinschaftlich, mittels lebensgefährdender Behandlung.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 223', 'Qualifizierendes Mittel: Waffe/Gift/gemeinschaftlich/hinterlistig/lebensgefährdend'],
    legalConsequence: 'Freiheitsstrafe von 6 Monaten bis 10 Jahre.',
    relatedNorms: ['stgb-223', 'stgb-226'],
    keywords: ['gefährliche körperverletzung', 'waffe', 'messer', 'gift', 'gemeinschaftlich', 'hinterlistig', 'lebensgefährdend'],
    qualificationOf: 'stgb-223',
    qualificationLevel: 1,
    strafrahmen: { min: '6 Monate', max: '10 Jahre', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-224-1', label: 'Waffe/gefährliches Werkzeug', description: 'Verwendung einer Waffe oder eines gefährlichen Werkzeugs', indicators: ['messer', 'waffe', 'pistole', 'schlagstock', 'baseballschläger', 'flasche', 'werkzeug', 'gegenstand', 'bewaffnet'], weight: 0.9, required: false },
      { id: 'tb-224-2', label: 'Gift/gesundheitsschädlicher Stoff', description: 'Beibringung von Gift oder ähnlichem', indicators: ['gift', 'vergiftet', 'substanz', 'chemikalie', 'droge verabreicht'], weight: 0.8, required: false },
      { id: 'tb-224-3', label: 'Hinterlistiger Überfall', description: 'Hinterlistiger Überfall', indicators: ['hinterlistig', 'überfall', 'hinterhalt', 'überraschend angegriffen', 'von hinten'], weight: 0.7, required: false },
      { id: 'tb-224-4', label: 'Gemeinschaftlich', description: 'Mit einem anderen Beteiligten gemeinschaftlich', indicators: ['gemeinschaftlich', 'zusammen', 'zu zweit', 'zu dritt', 'mehrere angreifer', 'mittäter', 'gemeinsam geschlagen'], weight: 0.8, required: false },
      { id: 'tb-224-5', label: 'Lebensgefährdende Behandlung', description: 'Mittels einer das Leben gefährdenden Behandlung', indicators: ['lebensgefährdend', 'lebensgefahr', 'tritte gegen kopf', 'gewürgt bis bewusstlos', 'todesangst'], weight: 0.9, required: false },
    ],
  },
  {
    id: 'stgb-226',
    law: 'StGB',
    paragraph: '§ 226',
    title: 'Schwere Körperverletzung',
    shortDescription: 'Verlust des Sehvermögens, Gehörs, Sprechvermögens, eines wichtigen Gliedes; dauernde Entstellung, Siechtum, Lähmung.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 223/224', 'Schwere Folge: Verlust Sinnesorgan/Glied, Entstellung, Siechtum, Lähmung, geistige Krankheit'],
    legalConsequence: 'Freiheitsstrafe von 1 Jahr bis 10 Jahre.',
    relatedNorms: ['stgb-223', 'stgb-224', 'stgb-227'],
    keywords: ['schwere körperverletzung', 'verlust sehvermögen', 'gehör', 'verstümmelung', 'siechtum', 'lähmung', 'dauernde entstellung'],
    qualificationOf: 'stgb-223',
    qualificationLevel: 1,
    strafrahmen: { min: '1 Jahr', max: '10 Jahre', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-226-1', label: 'Schwere Folge', description: 'Verlust wichtiges Glied/Sinnesorgan oder dauernde Entstellung/Siechtum/Lähmung', indicators: ['blind', 'taub', 'gelähmt', 'amputiert', 'verstümmelt', 'entstellt', 'siechtum', 'dauerhaft geschädigt', 'querschnitt', 'hirnschaden'], weight: 1.0, required: true },
    ],
  },
  {
    id: 'stgb-227',
    law: 'StGB',
    paragraph: '§ 227',
    title: 'Körperverletzung mit Todesfolge',
    shortDescription: 'Verursacht der Täter durch die Körperverletzung den Tod, so ist die Strafe Freiheitsstrafe nicht unter drei Jahren.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 223/224/226', 'Tod des Opfers als Folge', 'Fahrlässigkeit bzgl. Todesfolge'],
    legalConsequence: 'Freiheitsstrafe nicht unter 3 Jahren.',
    relatedNorms: ['stgb-223', 'stgb-224', 'stgb-226'],
    keywords: ['körperverletzung todesfolge', 'tod durch verletzung', 'prügelei tod', 'schläge tod'],
    qualificationOf: 'stgb-223',
    qualificationLevel: 2,
    strafrahmen: { min: '3 Jahre', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-227-1', label: 'Tod des Opfers', description: 'Tod als Folge der Körperverletzung', indicators: ['tod', 'gestorben', 'verstorben', 'tödlich', 'todesfolge', 'ums leben gekommen', 'tot'], weight: 1.0, required: true },
      { id: 'tb-227-2', label: 'Kausalzusammenhang', description: 'Tod kausal durch die KV verursacht', indicators: ['infolge', 'aufgrund', 'durch die verletzung', 'an den folgen'], weight: 0.8, required: true },
    ],
  },
  {
    id: 'stgb-229',
    law: 'StGB',
    paragraph: '§ 229',
    title: 'Fahrlässige Körperverletzung',
    shortDescription: 'Wer durch Fahrlässigkeit die Körperverletzung einer anderen Person verursacht.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Körperverletzung', 'Fahrlässigkeit'],
    legalConsequence: 'Freiheitsstrafe bis 3 Jahre oder Geldstrafe.',
    relatedNorms: ['stgb-223'],
    keywords: ['fahrlässige körperverletzung', 'fahrlässig verletzt', 'unachtsamkeit verletzung'],
    qualificationLevel: 3,
    strafrahmen: { max: '3 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
  },
  // ═══════════════════════════════════════════════════════════════════════
  // DE StGB — DIEBSTAHL-KETTE (§§ 242–244a)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-242',
    law: 'StGB',
    paragraph: '§ 242',
    title: 'Diebstahl',
    shortDescription: 'Wegnahme einer fremden beweglichen Sache mit Zueignungsabsicht.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Fremde bewegliche Sache', 'Wegnahme (Bruch fremden Gewahrsams)', 'Zueignungsabsicht'],
    legalConsequence: 'Freiheitsstrafe bis 5 Jahre oder Geldstrafe.',
    relatedNorms: ['stgb-243', 'stgb-244', 'stgb-244a'],
    keywords: ['diebstahl', 'gestohlen', 'entwendet', 'weggenommen', 'zueignung'],
    qualificationLevel: 0,
    qualifiedBy: ['stgb-243', 'stgb-244', 'stgb-244a'],
    strafrahmen: { max: '5 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-242-1', label: 'Fremde bewegliche Sache', description: 'Sache steht im Eigentum eines anderen', indicators: ['sache', 'gegenstand', 'eigentum', 'ware', 'geld', 'schmuck', 'handy', 'laptop', 'fahrzeug'], weight: 0.7, required: true },
      { id: 'tb-242-2', label: 'Wegnahme', description: 'Bruch fremden und Begründung neuen Gewahrsams', indicators: ['weggenommen', 'gestohlen', 'entwendet', 'mitgenommen', 'eingesteckt', 'an sich genommen'], weight: 1.0, required: true },
      { id: 'tb-242-3', label: 'Zueignungsabsicht', description: 'Absicht sich die Sache zuzueignen', indicators: ['zueignung', 'behalten', 'für sich', 'angeeignet', 'nicht zurückgegeben'], weight: 0.8, required: true },
    ],
    exclusionIndicators: ['geliehen', 'zurückgegeben', 'versehentlich mitgenommen'],
  },
  {
    id: 'stgb-243',
    law: 'StGB',
    paragraph: '§ 243',
    title: 'Besonders schwerer Fall des Diebstahls',
    shortDescription: 'Einbrechen, Einsteigen, falscher Schlüssel, gewerbsmäßig, Schutzvorrichtung überwinden.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 242', 'Regelbeispiel: Einbrechen, Einsteigen, falscher Schlüssel, gewerbsmäßig'],
    legalConsequence: 'Freiheitsstrafe von 3 Monaten bis 10 Jahre.',
    relatedNorms: ['stgb-242', 'stgb-244'],
    keywords: ['schwerer diebstahl', 'einbruch', 'einsteigen', 'aufbrechen', 'falscher schlüssel', 'gewerbsmäßig'],
    qualificationOf: 'stgb-242',
    qualificationLevel: 2,
    strafrahmen: { min: '3 Monate', max: '10 Jahre', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-243-1', label: 'Einbrechen/Einsteigen', description: 'Eindringen in Gebäude/Raum durch Einbruch', indicators: ['eingebrochen', 'einbruch', 'fenster aufgehebelt', 'tür aufgebrochen', 'eingestiegen'], weight: 0.9, required: false },
      { id: 'tb-243-2', label: 'Gewerbsmäßigkeit', description: 'Gewerbsmäßige Begehung', indicators: ['gewerbsmäßig', 'wiederholt gestohlen', 'seriendiebstahl', 'regelmäßig'], weight: 0.8, required: false },
      { id: 'tb-243-3', label: 'Schutzvorrichtung überwunden', description: 'Überwinden einer Schutzvorrichtung', indicators: ['schloss geknackt', 'alarm deaktiviert', 'tresor aufgebrochen', 'sicherung überwunden'], weight: 0.7, required: false },
    ],
  },
  {
    id: 'stgb-244',
    law: 'StGB',
    paragraph: '§ 244',
    title: 'Diebstahl mit Waffen; Bandendiebstahl; Wohnungseinbruchdiebstahl',
    shortDescription: 'Diebstahl unter Führung einer Waffe, als Bandenmitglied, oder durch Einbruch in Wohnung.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 242', 'Waffe/Bande/Wohnungseinbruch'],
    legalConsequence: 'Freiheitsstrafe von 6 Monaten bis 10 Jahre.',
    relatedNorms: ['stgb-242', 'stgb-243', 'stgb-244a'],
    keywords: ['diebstahl waffe', 'bandendiebstahl', 'wohnungseinbruch', 'wohnungseinbruchdiebstahl', 'bewaffneter diebstahl'],
    qualificationOf: 'stgb-242',
    qualificationLevel: 1,
    strafrahmen: { min: '6 Monate', max: '10 Jahre', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-244-1', label: 'Waffe mitgeführt', description: 'Täter führt eine Waffe oder gefährliches Werkzeug bei sich', indicators: ['waffe', 'messer', 'pistole', 'bewaffnet', 'schusswaffe'], weight: 0.9, required: false },
      { id: 'tb-244-2', label: 'Bandenmitglied', description: 'Mitglied einer Bande (mind. 3 Personen)', indicators: ['bande', 'bandenmäßig', 'organisierte gruppe', 'diebesbande'], weight: 0.9, required: false },
      { id: 'tb-244-3', label: 'Wohnungseinbruch', description: 'Einbruch in dauerhaft genutzte Privatwohnung', indicators: ['wohnungseinbruch', 'privatwohnung', 'wohnung eingebrochen', 'haus eingebrochen'], weight: 0.9, required: false },
    ],
  },
  {
    id: 'stgb-244a',
    law: 'StGB',
    paragraph: '§ 244a',
    title: 'Schwerer Bandendiebstahl',
    shortDescription: 'Bandendiebstahl unter Verwirklichung eines Regelbeispiels des § 243 Abs. 1 S. 2.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Bandenmitgliedschaft', 'Verwirklichung eines § 243-Regelbeispiels'],
    legalConsequence: 'Freiheitsstrafe von 1 Jahr bis 10 Jahre.',
    relatedNorms: ['stgb-242', 'stgb-243', 'stgb-244'],
    keywords: ['schwerer bandendiebstahl', 'organisierter diebstahl', 'einbruchsserie bande'],
    qualificationOf: 'stgb-242',
    qualificationLevel: 2,
    strafrahmen: { min: '1 Jahr', max: '10 Jahre', unit: 'freiheitsstrafe' },
  },
  // ═══════════════════════════════════════════════════════════════════════
  // DE StGB — RAUB-KETTE (§§ 249–252)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-249',
    law: 'StGB',
    paragraph: '§ 249',
    title: 'Raub',
    shortDescription: 'Wegnahme unter Anwendung von Gewalt gegen eine Person oder unter Drohung mit gegenwärtiger Gefahr für Leib oder Leben.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Wegnahme fremder Sache', 'Gewalt oder Drohung', 'Zueignungsabsicht'],
    legalConsequence: 'Freiheitsstrafe nicht unter 1 Jahr.',
    relatedNorms: ['stgb-250', 'stgb-251', 'stgb-252', 'stgb-255'],
    keywords: ['raub', 'überfall', 'gewalt wegnahme', 'beraubt', 'raubüberfall'],
    qualificationLevel: 0,
    qualifiedBy: ['stgb-250', 'stgb-251'],
    strafrahmen: { min: '1 Jahr', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-249-1', label: 'Gewalt/Drohung', description: 'Gewalt gegen Person oder Drohung mit Gefahr für Leib/Leben', indicators: ['gewalt', 'gedroht', 'geschlagen', 'bedroht', 'genötigt', 'festgehalten', 'überfallen', 'niedergeschlagen'], weight: 1.0, required: true },
      { id: 'tb-249-2', label: 'Wegnahme', description: 'Wegnahme einer fremden Sache', indicators: ['weggenommen', 'entrissen', 'geraubt', 'abgenommen'], weight: 1.0, required: true },
    ],
  },
  {
    id: 'stgb-250',
    law: 'StGB',
    paragraph: '§ 250',
    title: 'Schwerer Raub',
    shortDescription: 'Raub mit Waffe, Bande, schwere Gesundheitsschädigung, Lebensgefahr.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 249', 'Qualifikation: Waffe, Bande, schwere Gesundheitsschädigung'],
    legalConsequence: 'Freiheitsstrafe nicht unter 3 Jahre (Abs. 1) / 5 Jahre (Abs. 2).',
    relatedNorms: ['stgb-249', 'stgb-251'],
    keywords: ['schwerer raub', 'bewaffneter raub', 'bandenraub', 'raub waffe'],
    qualificationOf: 'stgb-249',
    qualificationLevel: 1,
    strafrahmen: { min: '3 Jahre', unit: 'freiheitsstrafe' },
  },
  {
    id: 'stgb-251',
    law: 'StGB',
    paragraph: '§ 251',
    title: 'Raub mit Todesfolge',
    shortDescription: 'Verursacht der Täter durch den Raub wenigstens leichtfertig den Tod eines anderen.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand §§ 249/250', 'Tod des Opfers', 'Leichtfertigkeit bzgl. Todesfolge'],
    legalConsequence: 'Lebenslange Freiheitsstrafe oder Freiheitsstrafe nicht unter 10 Jahre.',
    relatedNorms: ['stgb-249', 'stgb-250'],
    keywords: ['raub todesfolge', 'raubmord', 'tödlicher überfall'],
    qualificationOf: 'stgb-249',
    qualificationLevel: 2,
    strafrahmen: { min: '10 Jahre', unit: 'freiheitsstrafe' },
  },
  {
    id: 'stgb-252',
    law: 'StGB',
    paragraph: '§ 252',
    title: 'Räuberischer Diebstahl',
    shortDescription: 'Wer, bei einem Diebstahl auf frischer Tat betroffen, gegen eine Person Gewalt verübt oder Drohungen einsetzt.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Diebstahl begangen', 'Auf frischer Tat betroffen', 'Gewalt/Drohung zur Beutesicherung'],
    legalConsequence: 'Wie Raub (§ 249).',
    relatedNorms: ['stgb-242', 'stgb-249'],
    keywords: ['räuberischer diebstahl', 'auf frischer tat', 'flucht gewalt', 'beutesicherung'],
    qualificationLevel: 0,
    strafrahmen: { min: '1 Jahr', unit: 'freiheitsstrafe' },
  },
  // ═══════════════════════════════════════════════════════════════════════
  // DE StGB — ERPRESSUNG (§§ 253–255)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-253',
    law: 'StGB',
    paragraph: '§ 253',
    title: 'Erpressung',
    shortDescription: 'Nötigung zu einer Handlung/Duldung/Unterlassung mit Bereicherungsabsicht und Vermögensschaden.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Gewalt oder Drohung mit empfindlichem Übel', 'Nötigung zu Handlung/Duldung/Unterlassung', 'Vermögensnachteil', 'Bereicherungsabsicht'],
    legalConsequence: 'Freiheitsstrafe bis 5 Jahre oder Geldstrafe.',
    relatedNorms: ['stgb-255'],
    keywords: ['erpressung', 'drohung', 'nötigung', 'schutzgeld', 'lösegeld'],
    qualificationLevel: 0,
    qualifiedBy: ['stgb-255'],
    strafrahmen: { max: '5 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-253-1', label: 'Drohung/Gewalt', description: 'Gewalt oder Drohung mit empfindlichem Übel', indicators: ['gedroht', 'erpresst', 'drohung', 'eingeschüchtert', 'unter druck gesetzt', 'genötigt'], weight: 1.0, required: true },
      { id: 'tb-253-2', label: 'Vermögensnachteil', description: 'Vermögensnachteil des Genötigten', indicators: ['gezahlt', 'überwiesen', 'schaden', 'verlust', 'geld gefordert'], weight: 0.9, required: true },
    ],
  },
  {
    id: 'stgb-255',
    law: 'StGB',
    paragraph: '§ 255',
    title: 'Räuberische Erpressung',
    shortDescription: 'Erpressung mit Gewalt gegen Person oder Drohung mit gegenwärtiger Gefahr für Leib/Leben.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 253', 'Qualifizierte Nötigungsmittel wie bei Raub'],
    legalConsequence: 'Wie Raub (§§ 249–251).',
    relatedNorms: ['stgb-253', 'stgb-249'],
    keywords: ['räuberische erpressung', 'gewalterpressung', 'überfall erpressung'],
    qualificationOf: 'stgb-253',
    qualificationLevel: 1,
    strafrahmen: { min: '1 Jahr', unit: 'freiheitsstrafe' },
  },
  // ═══════════════════════════════════════════════════════════════════════
  // DE StGB — MORD/TOTSCHLAG (§§ 211–213)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-211',
    law: 'StGB',
    paragraph: '§ 211',
    title: 'Mord',
    shortDescription: 'Tötung eines Menschen aus Mordlust, Habgier, Heimtücke, Grausamkeit, oder zur Ermöglichung/Verdeckung einer Straftat.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Tötung eines Menschen', 'Mordmerkmal: Mordlust, Habgier, Heimtücke, Grausamkeit, gemeingefährliches Mittel, Verdeckung/Ermöglichung'],
    legalConsequence: 'Lebenslange Freiheitsstrafe.',
    relatedNorms: ['stgb-212', 'stgb-213'],
    keywords: ['mord', 'tötung', 'heimtücke', 'habgier', 'grausamkeit', 'mordlust', 'verdeckungsmord'],
    qualificationLevel: 1,
    qualificationOf: 'stgb-212',
    strafrahmen: { min: 'lebenslang', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-211-1', label: 'Tötung', description: 'Tötung eines anderen Menschen', indicators: ['getötet', 'ermordet', 'umgebracht', 'erstochen', 'erschossen', 'erschlagen', 'ums leben gebracht'], weight: 1.0, required: true },
      { id: 'tb-211-2', label: 'Mordmerkmal', description: 'Vorliegen eines Mordmerkmals', indicators: ['heimtückisch', 'hinterrücks', 'aus habgier', 'aus mordlust', 'grausam', 'gemeingefährlich', 'zur verdeckung', 'um zu verdecken', 'kaltblütig', 'skrupellos'], weight: 1.0, required: true },
    ],
  },
  {
    id: 'stgb-212',
    law: 'StGB',
    paragraph: '§ 212',
    title: 'Totschlag',
    shortDescription: 'Wer einen Menschen tötet, ohne Mörder zu sein.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Tötung eines Menschen', 'Vorsatz', 'Kein Mordmerkmal'],
    legalConsequence: 'Freiheitsstrafe nicht unter 5 Jahre.',
    relatedNorms: ['stgb-211', 'stgb-213'],
    keywords: ['totschlag', 'tötung', 'getötet', 'erstochen', 'erschlagen'],
    qualificationLevel: 0,
    qualifiedBy: ['stgb-211'],
    strafrahmen: { min: '5 Jahre', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-212-1', label: 'Tötung', description: 'Vorsätzliche Tötung eines Menschen', indicators: ['getötet', 'umgebracht', 'erstochen', 'erschossen', 'erschlagen', 'tödlich verletzt'], weight: 1.0, required: true },
    ],
    exclusionIndicators: ['fahrlässig', 'unfall', 'notwehr', 'nothilfe'],
  },
  {
    id: 'stgb-213',
    law: 'StGB',
    paragraph: '§ 213',
    title: 'Minder schwerer Fall des Totschlags',
    shortDescription: 'Vom Getöteten durch Misshandlung oder schwere Beleidigung zum Zorn gereizt und dadurch hingerissen.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Totschlag § 212', 'Provokation durch das Opfer'],
    legalConsequence: 'Freiheitsstrafe von 1 Jahr bis 10 Jahre.',
    relatedNorms: ['stgb-212'],
    keywords: ['minder schwerer totschlag', 'provokation', 'affekt', 'affekttat'],
    qualificationOf: 'stgb-212',
    qualificationLevel: 3,
    strafrahmen: { min: '1 Jahr', max: '10 Jahre', unit: 'freiheitsstrafe' },
  },
  // ═══════════════════════════════════════════════════════════════════════
  // DE StGB — KRIMINELLE VEREINIGUNG (§§ 129–129b)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-129',
    law: 'StGB',
    paragraph: '§ 129',
    title: 'Bildung krimineller Vereinigungen',
    shortDescription: 'Gründung, Mitgliedschaft, Unterstützung oder Werbung für eine kriminelle Vereinigung.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Vereinigung mit mind. 3 Personen', 'Zweck: Begehung von Straftaten', 'Gründung/Mitgliedschaft/Unterstützung/Werbung'],
    legalConsequence: 'Freiheitsstrafe bis 5 Jahre (Gründung/Mitgliedschaft) oder bis 3 Jahre (Unterstützung/Werbung).',
    relatedNorms: ['stgb-129a', 'stgb-129b'],
    keywords: ['kriminelle vereinigung', 'organisierte kriminalität', 'bande', 'organisation', 'mafia', 'clan', 'ring', 'netzwerk', 'zusammenschluss straftaten'],
    qualificationLevel: 0,
    qualifiedBy: ['stgb-129a'],
    strafrahmen: { max: '5 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-129-1', label: 'Vereinigung', description: 'Organisierter Zusammenschluss von mind. 3 Personen', indicators: ['vereinigung', 'organisation', 'bande', 'gruppe', 'ring', 'netzwerk', 'zusammenschluss', 'clan', 'kartell'], weight: 1.0, required: true },
      { id: 'tb-129-2', label: 'Krimineller Zweck', description: 'Zweck: Begehung von Straftaten', indicators: ['straftaten begehen', 'kriminell', 'strafbar', 'systematisch verübt', 'fortgesetzt', 'gewerbsmäßig', 'organisiert kriminalität'], weight: 1.0, required: true },
      { id: 'tb-129-3', label: 'Beteiligung', description: 'Gründung, Mitgliedschaft, Unterstützung', indicators: ['gegründet', 'mitglied', 'unterstützt', 'angeworben', 'rekrutiert', 'beteiligt', 'zugehörig'], weight: 0.8, required: true },
    ],
  },
  {
    id: 'stgb-129a',
    law: 'StGB',
    paragraph: '§ 129a',
    title: 'Bildung terroristischer Vereinigungen',
    shortDescription: 'Gründung/Mitgliedschaft in einer Vereinigung zur Begehung von Mord, Totschlag, Völkermord oder vergleichbaren Taten.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Vereinigung', 'Terroristischer Zweck: Mord, Totschlag, schwere Straftaten gegen die Person'],
    legalConsequence: 'Freiheitsstrafe von 1 bis 10 Jahre (Gründung/Rädelsführer: bis 15 Jahre).',
    relatedNorms: ['stgb-129', 'stgb-129b'],
    keywords: ['terroristische vereinigung', 'terrorismus', 'terrorist', 'anschlag', 'terror'],
    qualificationOf: 'stgb-129',
    qualificationLevel: 1,
    strafrahmen: { min: '1 Jahr', max: '10 Jahre', unit: 'freiheitsstrafe' },
  },
  // ═══════════════════════════════════════════════════════════════════════
  // DE StGB — UNTREUE/UNTERSCHLAGUNG (§§ 246, 266)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-246',
    law: 'StGB',
    paragraph: '§ 246',
    title: 'Unterschlagung',
    shortDescription: 'Rechtswidrige Zueignung einer fremden beweglichen Sache.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Fremde bewegliche Sache', 'Zueignung', 'Rechtswidrigkeit'],
    legalConsequence: 'Freiheitsstrafe bis 3 Jahre oder Geldstrafe (anvertraut: bis 5 Jahre).',
    relatedNorms: ['stgb-242', 'stgb-266'],
    keywords: ['unterschlagung', 'angeeignet', 'veruntreut', 'einbehalten', 'nicht herausgegeben'],
    qualificationLevel: 0,
    strafrahmen: { max: '3 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-246-1', label: 'Fremde Sache', description: 'Sache steht im Eigentum eines anderen', indicators: ['fremd', 'nicht sein eigentum', 'anvertraut', 'geliehen', 'überlassen'], weight: 0.8, required: true },
      { id: 'tb-246-2', label: 'Zueignung', description: 'Sich oder Drittem zueignen', indicators: ['angeeignet', 'behalten', 'einbehalten', 'nicht zurückgegeben', 'verweigert herausgabe'], weight: 1.0, required: true },
    ],
  },
  {
    id: 'stgb-266',
    law: 'StGB',
    paragraph: '§ 266',
    title: 'Untreue',
    shortDescription: 'Missbrauch einer Befugnis über fremdes Vermögen zu verfügen oder Verletzung einer Vermögensbetreuungspflicht.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Verfügungsbefugnis/Vermögensbetreuungspflicht', 'Missbrauch oder Pflichtverletzung', 'Vermögensnachteil'],
    legalConsequence: 'Freiheitsstrafe bis 5 Jahre oder Geldstrafe.',
    relatedNorms: ['stgb-263', 'stgb-246'],
    keywords: ['untreue', 'vermögensbetreuungspflicht', 'pflichtwidrig', 'missbrauch befugnis', 'treupflichtverletzung'],
    qualificationLevel: 0,
    strafrahmen: { max: '5 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-266-1', label: 'Vermögensbetreuungspflicht', description: 'Pflicht fremdes Vermögen zu betreuen', indicators: ['treuhänder', 'geschäftsführer', 'vorstand', 'verwalter', 'prokurist', 'bevollmächtigt', 'vermögenssorge'], weight: 1.0, required: true },
      { id: 'tb-266-2', label: 'Pflichtwidriges Handeln', description: 'Missbrauch der Befugnis oder Pflichtverletzung', indicators: ['pflichtwidrig', 'missbraucht', 'zweckwidrig', 'eigenmächtig', 'ohne genehmigung', 'veruntreut'], weight: 1.0, required: true },
      { id: 'tb-266-3', label: 'Vermögensnachteil', description: 'Nachteil am betreuten Vermögen', indicators: ['nachteil', 'schaden', 'verlust', 'vermindert', 'verringert'], weight: 0.9, required: true },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // DE StGB — URKUNDENFÄLSCHUNG (§§ 267–271)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-267',
    law: 'StGB',
    paragraph: '§ 267',
    title: 'Urkundenfälschung',
    shortDescription: 'Herstellung einer unechten Urkunde, Verfälschung einer echten Urkunde, Gebrauch einer ge-/verfälschten Urkunde.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Herstellung/Verfälschung/Gebrauch einer Urkunde', 'Zur Täuschung im Rechtsverkehr'],
    legalConsequence: 'Freiheitsstrafe bis 5 Jahre oder Geldstrafe.',
    relatedNorms: ['stgb-268', 'stgb-269', 'stgb-271'],
    keywords: ['urkundenfälschung', 'gefälscht', 'fälschung', 'unechte urkunde', 'falsches dokument'],
    qualificationLevel: 0,
    strafrahmen: { max: '5 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-267-1', label: 'Urkunde', description: 'Herstellung/Verfälschung/Gebrauch einer Urkunde', indicators: ['urkunde', 'dokument', 'vertrag gefälscht', 'unterschrift gefälscht', 'ausweis gefälscht', 'zeugnis gefälscht', 'bescheinigung'], weight: 1.0, required: true },
      { id: 'tb-267-2', label: 'Täuschungsabsicht', description: 'Zur Täuschung im Rechtsverkehr', indicators: ['gefälscht', 'gefälschte', 'fälschung', 'unecht', 'manipuliert', 'verfälscht', 'nachgemacht'], weight: 1.0, required: true },
    ],
  },
  {
    id: 'stgb-269',
    law: 'StGB',
    paragraph: '§ 269',
    title: 'Fälschung beweiserheblicher Daten',
    shortDescription: 'Speichern/Verändern beweiserheblicher Daten, die bei Wahrnehmung einer unechten Urkunde gleichstehen.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Beweiserhebliche Daten', 'Speicherung/Veränderung', 'Täuschungsabsicht'],
    legalConsequence: 'Wie § 267 StGB.',
    relatedNorms: ['stgb-267', 'stgb-263a'],
    keywords: ['datenfälschung', 'datenmanipulation', 'beweiserhebliche daten', 'elektronische fälschung'],
    qualificationLevel: 0,
    strafrahmen: { max: '5 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
  },
  // ═══════════════════════════════════════════════════════════════════════
  // DE StGB — NÖTIGUNG / FREIHEITSBERAUBUNG / SACHBESCHÄDIGUNG
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-240',
    law: 'StGB',
    paragraph: '§ 240',
    title: 'Nötigung',
    shortDescription: 'Wer einen Menschen mit Gewalt oder durch Drohung mit empfindlichem Übel zu einer Handlung nötigt.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Gewalt oder Drohung', 'Nötigung zu Handlung/Duldung/Unterlassung', 'Rechtswidrigkeit'],
    legalConsequence: 'Freiheitsstrafe bis 3 Jahre oder Geldstrafe.',
    relatedNorms: ['stgb-253', 'stgb-239'],
    keywords: ['nötigung', 'genötigt', 'gezwungen', 'drohung', 'einschüchterung'],
    qualificationLevel: 0,
    strafrahmen: { max: '3 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
  },
  {
    id: 'stgb-239',
    law: 'StGB',
    paragraph: '§ 239',
    title: 'Freiheitsberaubung',
    shortDescription: 'Wer einen Menschen einsperrt oder auf andere Weise der Freiheit beraubt.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Einsperren oder Freiheitsberaubung', 'Vorsatz'],
    legalConsequence: 'Freiheitsstrafe bis 5 Jahre oder Geldstrafe.',
    relatedNorms: ['stgb-239a', 'stgb-240'],
    keywords: ['freiheitsberaubung', 'eingesperrt', 'festgehalten', 'gefangen', 'entführt'],
    qualificationLevel: 0,
    strafrahmen: { max: '5 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
  },
  {
    id: 'stgb-239a',
    law: 'StGB',
    paragraph: '§ 239a',
    title: 'Erpresserischer Menschenraub',
    shortDescription: 'Entführung/Bemächtigung eines Menschen, um die Sorge des Opfers/Dritten zu einer Erpressung auszunutzen.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Entführung/Bemächtigung', 'Erpressungsabsicht', 'Ausnutzung der Sorge'],
    legalConsequence: 'Freiheitsstrafe nicht unter 5 Jahre.',
    relatedNorms: ['stgb-239', 'stgb-253'],
    keywords: ['menschenraub', 'entführung', 'geiselnahme', 'kidnapping', 'lösegeld'],
    qualificationLevel: 1,
    strafrahmen: { min: '5 Jahre', unit: 'freiheitsstrafe' },
  },
  {
    id: 'stgb-303',
    law: 'StGB',
    paragraph: '§ 303',
    title: 'Sachbeschädigung',
    shortDescription: 'Wer rechtswidrig eine fremde Sache beschädigt oder zerstört.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Fremde Sache', 'Beschädigung oder Zerstörung', 'Vorsatz'],
    legalConsequence: 'Freiheitsstrafe bis 2 Jahre oder Geldstrafe.',
    relatedNorms: [],
    keywords: ['sachbeschädigung', 'beschädigt', 'zerstört', 'vandalismus', 'demoliert'],
    qualificationLevel: 0,
    strafrahmen: { max: '2 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
  },
  // ═══════════════════════════════════════════════════════════════════════
  // DE StGB — GELDWÄSCHE / HEHLEREI / BEGÜNSTIGUNG
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-259',
    law: 'StGB',
    paragraph: '§ 259',
    title: 'Hehlerei',
    shortDescription: 'Ankauf, sich verschaffen, Absatz oder Absatzhilfe bei einer Sache, die ein anderer gestohlen hat.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Sache aus Straftat erlangt', 'Ankauf/Verschaffen/Absatz/Absatzhilfe'],
    legalConsequence: 'Freiheitsstrafe bis 5 Jahre oder Geldstrafe.',
    relatedNorms: ['stgb-242', 'stgb-261'],
    keywords: ['hehlerei', 'hehlerware', 'gestohlen gekauft', 'diebesgut', 'absatz gestohlener ware'],
    qualificationLevel: 0,
    strafrahmen: { max: '5 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
  },
  {
    id: 'stgb-261',
    law: 'StGB',
    paragraph: '§ 261',
    title: 'Geldwäsche',
    shortDescription: 'Verbergen, Verschleiern oder Unterstützung beim Transfer von Vermögensgegenständen, die aus Straftaten stammen.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Vermögensgegenstand aus Straftat', 'Verbergen/Verschleiern/Transferunterstützung'],
    legalConsequence: 'Freiheitsstrafe bis 5 Jahre oder Geldstrafe (gewerbs-/bandenmäßig: bis 10 Jahre).',
    relatedNorms: ['stgb-259', 'stgb-129'],
    keywords: ['geldwäsche', 'geld waschen', 'schwarzgeld', 'verschleierung', 'tarnung vermögen', 'money laundering'],
    qualificationLevel: 0,
    strafrahmen: { max: '5 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-261-1', label: 'Inkriminierte Vermögenswerte', description: 'Vermögen stammt aus Straftat', indicators: ['straftat', 'illegal', 'schwarzgeld', 'drogengelder', 'kriminell erworben', 'illegale herkunft'], weight: 1.0, required: true },
      { id: 'tb-261-2', label: 'Verschleierung', description: 'Verbergen/Verschleiern der Herkunft', indicators: ['verschleiert', 'verborgen', 'getarnt', 'gewaschen', 'transferiert', 'umgeschichtet', 'strohmann', 'briefkastenfirma'], weight: 1.0, required: true },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // DE StGB — BANKROTT (§§ 283–283d)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-283',
    law: 'StGB',
    paragraph: '§ 283',
    title: 'Bankrott',
    shortDescription: 'Beiseiteschaffen/Verheimlichen von Vermögenswerten, Vernichten von Handelsbüchern etc. bei Überschuldung/Zahlungsunfähigkeit.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Überschuldung/Zahlungsunfähigkeit', 'Vermögensverschlechterung/Buchführungspflicht-Verletzung'],
    legalConsequence: 'Freiheitsstrafe bis 5 Jahre oder Geldstrafe.',
    relatedNorms: ['inso-17', 'stgb-266'],
    keywords: ['bankrott', 'insolvenzverschleppung', 'vermögen beiseite geschafft', 'handelsbücher vernichtet', 'bilanzfälschung'],
    qualificationLevel: 0,
    strafrahmen: { max: '5 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
  },
  // ═══════════════════════════════════════════════════════════════════════
  // DE StPO — Wichtige Verfahrensvorschriften
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stpo-112',
    jurisdiction: 'DE',
    law: 'StPO',
    paragraph: '§ 112',
    title: 'Voraussetzungen der Untersuchungshaft',
    shortDescription: 'U-Haft bei dringendem Tatverdacht und Haftgrund (Flucht, Fluchtgefahr, Verdunkelungsgefahr).',
    domain: 'criminal',
    type: 'verfahrensvorschrift',
    prerequisites: ['Dringender Tatverdacht', 'Haftgrund: Flucht/Fluchtgefahr/Verdunkelungsgefahr'],
    legalConsequence: 'Anordnung der Untersuchungshaft.',
    relatedNorms: ['stpo-113', 'stpo-116'],
    keywords: ['untersuchungshaft', 'u-haft', 'haftbefehl', 'fluchtgefahr', 'verdunkelungsgefahr', 'tatverdacht'],
  },
  {
    id: 'stpo-153',
    jurisdiction: 'DE',
    law: 'StPO',
    paragraph: '§ 153',
    title: 'Einstellung bei Geringfügigkeit',
    shortDescription: 'Einstellung des Verfahrens bei geringer Schuld und fehlendem öffentlichen Interesse.',
    domain: 'criminal',
    type: 'verfahrensvorschrift',
    prerequisites: ['Vergehen (kein Verbrechen)', 'Geringe Schuld', 'Kein öffentliches Interesse'],
    legalConsequence: 'Einstellung des Verfahrens.',
    relatedNorms: ['stpo-153a'],
    keywords: ['einstellung', 'geringfügigkeit', 'geringe schuld', 'bagatelle', 'verfahrenseinstellung'],
  },
  {
    id: 'stpo-153a',
    jurisdiction: 'DE',
    law: 'StPO',
    paragraph: '§ 153a',
    title: 'Einstellung unter Auflagen',
    shortDescription: 'Einstellung gegen Zahlung einer Geldauflage oder Erbringung gemeinnütziger Leistungen.',
    domain: 'criminal',
    type: 'verfahrensvorschrift',
    prerequisites: ['Vergehen', 'Zustimmung Beschuldigter und Gericht', 'Auflage geeignet'],
    legalConsequence: 'Einstellung gegen Auflage, kein Eintrag ins Führungszeugnis.',
    relatedNorms: ['stpo-153'],
    keywords: ['einstellung auflagen', 'geldauflage', 'diversion', 'gemeinnützige arbeit'],
  },
  {
    id: 'stpo-170',
    jurisdiction: 'DE',
    law: 'StPO',
    paragraph: '§ 170',
    title: 'Entscheidung über Anklage oder Einstellung',
    shortDescription: 'Anklageerhebung bei genügendem Anlass, sonst Einstellung.',
    domain: 'criminal',
    type: 'verfahrensvorschrift',
    prerequisites: ['Ermittlungsverfahren abgeschlossen'],
    legalConsequence: 'Anklage oder Einstellung.',
    relatedNorms: ['stpo-153', 'stpo-153a'],
    keywords: ['anklagerhebung', 'einstellung', 'hinreichender tatverdacht', 'stpo 170'],
  },
  // ═══ Österreich - ABGB / MRG / ZPO ═══
  {
    id: 'abgb-1295',
    jurisdiction: 'AT',
    law: 'ABGB',
    paragraph: '§ 1295',
    title: 'Allgemeine Schadenersatzpflicht',
    shortDescription:
      'Wer einem anderen widerrechtlich und schuldhaft einen Schaden zufügt, ist zum Ersatz verpflichtet.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: [
      'Schaden',
      'Rechtswidrigkeit',
      'Verschulden',
      'Kausalität',
    ],
    legalConsequence: 'Anspruch auf Schadenersatz.',
    relatedNorms: ['abgb-1293', 'abgb-1298'],
    burdenOfProof: 'claimant',
    limitationPeriodYears: 3,
    limitationStart: 'Kenntnis von Schaden und Schädiger (§ 1489 ABGB)',
    keywords: [
      'schadenersatz',
      'abgb 1295',
      'verschulden',
      'rechtswidrigkeit',
      'haftung',
      'österreich',
    ],
  },
  {
    id: 'abgb-1298',
    jurisdiction: 'AT',
    law: 'ABGB',
    paragraph: '§ 1298',
    title: 'Beweislast beim Verschulden',
    shortDescription:
      'Wer behauptet, an der Erfüllung ohne sein Verschulden gehindert gewesen zu sein, hat dies zu beweisen.',
    domain: 'civil',
    type: 'beweislast',
    prerequisites: ['Vertragliche oder gesetzliche Pflichtverletzung'],
    legalConsequence: 'Beweislastumkehr beim Verschulden im Vertragsbereich.',
    relatedNorms: ['abgb-1295'],
    burdenOfProof: 'defendant',
    keywords: [
      'beweislast',
      'verschulden',
      'abgb 1298',
      'beweislastumkehr',
      'österreich',
    ],
  },
  {
    id: 'abgb-1489',
    jurisdiction: 'AT',
    law: 'ABGB',
    paragraph: '§ 1489',
    title: 'Verjährung von Schadenersatzansprüchen',
    shortDescription:
      'Schadenersatzansprüche verjähren grundsätzlich in drei Jahren ab Kenntnis, spätestens in dreißig Jahren.',
    domain: 'civil',
    type: 'frist',
    prerequisites: ['Schadenersatzanspruch entstanden'],
    legalConsequence: 'Verjährungseintritt nach Fristablauf.',
    relatedNorms: ['abgb-1295'],
    limitationPeriodYears: 3,
    limitationStart: 'Kenntnis von Schaden und Schädiger',
    keywords: [
      'verjährung',
      'abgb 1489',
      'schadenersatz',
      'kenntnis',
      'frist',
      'österreich',
    ],
  },
  {
    id: 'abgb-1096',
    jurisdiction: 'AT',
    law: 'ABGB',
    paragraph: '§ 1096',
    title: 'Mietzinsminderung bei Mängeln',
    shortDescription:
      'Bei Unbrauchbarkeit oder erheblicher Beeinträchtigung des Gebrauchs ist der Mietzins entsprechend gemindert.',
    domain: 'civil',
    type: 'einrede',
    prerequisites: [
      'Mietvertrag',
      'Mangel der Bestandsache',
      'Gebrauchsbeeinträchtigung',
    ],
    legalConsequence: 'Mietzinsminderung ex lege.',
    relatedNorms: ['mrg-3', 'mrg-8'],
    keywords: [
      'mietzinsminderung',
      'abgb 1096',
      'mangel',
      'mietrecht',
      'österreich',
    ],
  },
  {
    id: 'mrg-3',
    jurisdiction: 'AT',
    law: 'MRG',
    paragraph: '§ 3',
    title: 'Erhaltungspflicht des Vermieters',
    shortDescription:
      'Der Vermieter hat die allgemeinen Teile des Hauses und bestimmte Mietgegenstände in brauchbarem Zustand zu erhalten.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Anwendungsbereich MRG', 'Erhaltungsmangel'],
    legalConsequence: 'Anspruch auf Erhaltung/Herstellung brauchbaren Zustands.',
    relatedNorms: ['abgb-1096', 'mrg-8'],
    keywords: [
      'mrg 3',
      'erhaltungspflicht',
      'vermieter',
      'mietrecht',
      'österreich',
    ],
  },
  {
    id: 'mrg-8',
    jurisdiction: 'AT',
    law: 'MRG',
    paragraph: '§ 8',
    title: 'Duldungspflichten und Zutritt',
    shortDescription:
      'Regelt Duldung notwendiger Arbeiten und Zutrittsrechte im Mietverhältnis.',
    domain: 'civil',
    type: 'verfahrensvorschrift',
    prerequisites: ['Notwendige Erhaltungs- oder Verbesserungsarbeiten'],
    legalConsequence: 'Mieter muss gesetzlich bestimmte Maßnahmen dulden.',
    relatedNorms: ['mrg-3', 'abgb-1096'],
    keywords: ['mrg 8', 'duldung', 'zutritt', 'mietrecht', 'österreich'],
  },
  // ═══════════════════════════════════════════════════════════════════════
  // AT StGB — BETRUG-KETTE (§§ 146–148a)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-at-146',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 146',
    title: 'Betrug',
    shortDescription:
      'Wer mit Bereicherungsvorsatz durch Täuschung über Tatsachen einen Irrtum hervorruft und zu einer Vermögensverfügung verleitet.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Täuschung über Tatsachen', 'Irrtum', 'Vermögensverfügung', 'Schaden', 'Bereicherungsvorsatz'],
    legalConsequence: 'Freiheitsstrafe bis 6 Monate oder Geldstrafe bis 360 Tagessätze.',
    relatedNorms: ['stgb-at-147', 'stgb-at-148', 'stgb-at-148a'],
    keywords: ['betrug', 'stgb 146', 'täuschung', 'vermögensschaden', 'österreich'],
    qualificationLevel: 0,
    qualifiedBy: ['stgb-at-147', 'stgb-at-148', 'stgb-at-148a'],
    strafrahmen: { max: '6 Monate', unit: 'freiheitsstrafe_oder_geldstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-at-146-1', label: 'Täuschung über Tatsachen', description: 'Vorspiegeln/Entstellen/Unterdrücken von Tatsachen', indicators: ['täuschung', 'getäuscht', 'vorgetäuscht', 'falsche angaben', 'vorspiegeln'], weight: 1.0, required: true },
      { id: 'tb-at-146-2', label: 'Irrtum', description: 'Irrtumserregung', indicators: ['irrtum', 'geirrt', 'geglaubt', 'gutgläubig'], weight: 0.9, required: true },
      { id: 'tb-at-146-3', label: 'Vermögensverfügung', description: 'Irrtumsbedingte Vermögensverfügung', indicators: ['gezahlt', 'überwiesen', 'übertragen', 'geleistet'], weight: 0.8, required: true },
      { id: 'tb-at-146-4', label: 'Vermögensschaden', description: 'Schaden am Vermögen', indicators: ['schaden', 'verlust', 'nachteil', 'geschädigt'], weight: 1.0, required: true },
    ],
    exclusionIndicators: ['fahrlässig', 'versehentlich'],
  },
  {
    id: 'stgb-at-147',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 147',
    title: 'Schwerer Betrug',
    shortDescription: 'Betrug mit Schaden über 5.000 EUR oder unter Verwendung falscher/verfälschter Urkunden.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 146', 'Schaden > 5.000 EUR oder falsche Urkunde'],
    legalConsequence: 'Freiheitsstrafe bis 3 Jahre.',
    relatedNorms: ['stgb-at-146', 'stgb-at-148'],
    keywords: ['schwerer betrug', 'stgb 147', 'urkunde', 'großer schaden', 'österreich'],
    qualificationOf: 'stgb-at-146',
    qualificationLevel: 1,
    strafrahmen: { max: '3 Jahre', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-at-147-1', label: 'Schaden > 5.000 EUR', description: 'Vermögensschaden über 5.000 EUR', indicators: ['5.000', '5000', 'tausend', 'erheblicher schaden', 'hoher schaden'], weight: 0.9, required: false },
      { id: 'tb-at-147-2', label: 'Falsche Urkunde', description: 'Verwendung falscher/verfälschter Urkunde', indicators: ['falsche urkunde', 'gefälschte urkunde', 'verfälscht', 'falsches dokument'], weight: 0.8, required: false },
    ],
  },
  {
    id: 'stgb-at-148',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 148',
    title: 'Gewerbsmäßiger Betrug',
    shortDescription: 'Gewerbsmäßige Begehung des Betrugs — wiederkehrende Tatbegehung als Einnahmequelle.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 146/147', 'Gewerbsmäßigkeit'],
    legalConsequence: 'Freiheitsstrafe von 6 Monaten bis 5 Jahre.',
    relatedNorms: ['stgb-at-146', 'stgb-at-147'],
    keywords: ['gewerbsmäßiger betrug', 'stgb 148', 'gewerbsmäßig', 'serienbetrug', 'österreich'],
    qualificationOf: 'stgb-at-146',
    qualificationLevel: 2,
    strafrahmen: { min: '6 Monate', max: '5 Jahre', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-at-148-1', label: 'Gewerbsmäßigkeit', description: 'Wiederholte Begehung als Einnahmequelle', indicators: ['gewerbsmäßig', 'wiederholt', 'regelmäßig', 'fortgesetzt', 'systematisch', 'einnahmequelle'], weight: 1.0, required: true },
    ],
  },
  {
    id: 'stgb-at-148a',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 148a',
    title: 'Betrügerischer Datenverarbeitungsmissbrauch',
    shortDescription: 'Vermögensschädigung durch Manipulation von Datenverarbeitungsvorgängen.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Manipulation Datenverarbeitung', 'Vermögensschaden'],
    legalConsequence: 'Wie § 146–148 StGB.',
    relatedNorms: ['stgb-at-146'],
    keywords: ['computerbetrug', 'datenverarbeitung', 'stgb 148a', 'online betrug', 'österreich'],
    qualificationLevel: 0,
    strafrahmen: { max: '6 Monate', unit: 'freiheitsstrafe_oder_geldstrafe' },
  },
  // ═══════════════════════════════════════════════════════════════════════
  // AT StGB — KÖRPERVERLETZUNG-KETTE (§§ 83–87)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-at-83',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 83',
    title: 'Körperverletzung',
    shortDescription:
      'Wer einen anderen am Körper verletzt oder an der Gesundheit schädigt, ist zu bestrafen.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Körperverletzung oder Gesundheitsschädigung', 'Vorsatz'],
    legalConsequence: 'Freiheitsstrafe bis 1 Jahr oder Geldstrafe bis 720 Tagessätze.',
    relatedNorms: ['stgb-at-84', 'stgb-at-85', 'stgb-at-86', 'stgb-at-87'],
    keywords: ['körperverletzung', 'stgb 83', 'gesundheitsschädigung', 'österreich'],
    qualificationLevel: 0,
    qualifiedBy: ['stgb-at-84', 'stgb-at-85', 'stgb-at-86', 'stgb-at-87'],
    strafrahmen: { max: '1 Jahr', unit: 'freiheitsstrafe_oder_geldstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-at-83-1', label: 'Körperverletzung', description: 'Körperliche Verletzung oder Gesundheitsschädigung', indicators: ['geschlagen', 'getreten', 'verletzt', 'verletzung', 'misshandelt'], weight: 1.0, required: true },
      { id: 'tb-at-83-2', label: 'Vorsatz', description: 'Vorsätzliches Handeln', indicators: ['absichtlich', 'vorsätzlich', 'bewusst', 'willentlich'], weight: 0.6, required: true },
    ],
    exclusionIndicators: ['fahrlässig', 'unbeabsichtigt', 'unfall'],
  },
  {
    id: 'stgb-at-84',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 84',
    title: 'Schwere Körperverletzung',
    shortDescription: 'KV mit einer an sich schweren Verletzung oder Gesundheitsschädigung, oder einer länger als 24 Tage dauernden Gesundheitsschädigung.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 83', 'Schwere Verletzung oder Dauer > 24 Tage'],
    legalConsequence: 'Freiheitsstrafe bis 3 Jahre.',
    relatedNorms: ['stgb-at-83', 'stgb-at-85'],
    keywords: ['schwere körperverletzung', 'stgb 84', '24 tage', 'schwere verletzung', 'österreich'],
    qualificationOf: 'stgb-at-83',
    qualificationLevel: 1,
    strafrahmen: { max: '3 Jahre', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-at-84-1', label: 'Schwere Verletzung', description: 'An sich schwere Verletzung oder > 24 Tage Gesundheitsschädigung', indicators: ['schwere verletzung', 'bruch', 'fraktur', 'krankenhausaufenthalt', '24 tage', 'wochen', 'monatelang', 'dauerhafte'], weight: 1.0, required: true },
    ],
  },
  {
    id: 'stgb-at-85',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 85',
    title: 'Körperverletzung mit schweren Dauerfolgen',
    shortDescription: 'KV mit Verlust/erheblicher Beeinträchtigung eines Sinnesorgans/Gliedes, dauerhafte Entstellung.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 83/84', 'Schwere Dauerfolge'],
    legalConsequence: 'Freiheitsstrafe von 1 bis 10 Jahre.',
    relatedNorms: ['stgb-at-83', 'stgb-at-84'],
    keywords: ['dauerfolgen', 'stgb 85', 'sinnesorgan verlust', 'verstümmelung', 'österreich'],
    qualificationOf: 'stgb-at-83',
    qualificationLevel: 2,
    strafrahmen: { min: '1 Jahr', max: '10 Jahre', unit: 'freiheitsstrafe' },
  },
  {
    id: 'stgb-at-86',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 86',
    title: 'Körperverletzung mit tödlichem Ausgang',
    shortDescription: 'KV die den Tod des Verletzten zur Folge hat.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 83/84/85', 'Tod als Folge', 'Fahrlässigkeit bzgl. Todesfolge'],
    legalConsequence: 'Freiheitsstrafe von 1 bis 10 Jahre.',
    relatedNorms: ['stgb-at-83', 'stgb-at-84', 'stgb-at-85'],
    keywords: ['körperverletzung todesfolge', 'stgb 86', 'tod', 'tödliche verletzung', 'österreich'],
    qualificationOf: 'stgb-at-83',
    qualificationLevel: 2,
    strafrahmen: { min: '1 Jahr', max: '10 Jahre', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-at-86-1', label: 'Tod des Opfers', description: 'Tod als Folge der KV', indicators: ['tod', 'gestorben', 'verstorben', 'tödlich', 'todesfolge'], weight: 1.0, required: true },
    ],
  },
  {
    id: 'stgb-at-87',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 87',
    title: 'Absichtliche schwere Körperverletzung',
    shortDescription: 'Wer absichtlich eine schwere Körperverletzung zufügt.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Schwere KV', 'Absicht (dolus directus 1. Grades)'],
    legalConsequence: 'Freiheitsstrafe von 1 bis 5 Jahre (Abs. 1), 5 bis 10 Jahre (Abs. 2 bei Dauerfolgen).',
    relatedNorms: ['stgb-at-83', 'stgb-at-84', 'stgb-at-85'],
    keywords: ['absichtliche schwere kv', 'stgb 87', 'absichtlich verletzt', 'österreich'],
    qualificationOf: 'stgb-at-83',
    qualificationLevel: 2,
    strafrahmen: { min: '1 Jahr', max: '5 Jahre', unit: 'freiheitsstrafe' },
  },
  // ═══════════════════════════════════════════════════════════════════════
  // AT StGB — DIEBSTAHL-KETTE (§§ 127–131)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-at-127',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 127',
    title: 'Diebstahl',
    shortDescription: 'Wer eine fremde bewegliche Sache einem anderen mit dem Vorsatz wegnimmt, sich oder einen Dritten unrechtmäßig zu bereichern.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Fremde bewegliche Sache', 'Wegnahme', 'Bereicherungsvorsatz'],
    legalConsequence: 'Freiheitsstrafe bis 6 Monate oder Geldstrafe bis 360 Tagessätze.',
    relatedNorms: ['stgb-at-128', 'stgb-at-129', 'stgb-at-130', 'stgb-at-131'],
    keywords: ['diebstahl', 'stgb 127', 'gestohlen', 'weggenommen', 'österreich'],
    qualificationLevel: 0,
    qualifiedBy: ['stgb-at-128', 'stgb-at-129', 'stgb-at-130', 'stgb-at-131'],
    strafrahmen: { max: '6 Monate', unit: 'freiheitsstrafe_oder_geldstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-at-127-1', label: 'Wegnahme', description: 'Wegnahme einer fremden Sache', indicators: ['weggenommen', 'gestohlen', 'entwendet', 'mitgenommen'], weight: 1.0, required: true },
      { id: 'tb-at-127-2', label: 'Bereicherungsvorsatz', description: 'Vorsatz der unrechtmäßigen Bereicherung', indicators: ['bereichern', 'behalten', 'für sich', 'angeeignet'], weight: 0.8, required: true },
    ],
  },
  {
    id: 'stgb-at-128',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 128',
    title: 'Schwerer Diebstahl',
    shortDescription: 'Diebstahl mit Wert > 5.000 EUR, religiöse Gegenstände, Waffen, aus Not des Bestohlenen.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 127', 'Wert > 5.000 EUR oder qualifizierender Umstand'],
    legalConsequence: 'Freiheitsstrafe bis 3 Jahre.',
    relatedNorms: ['stgb-at-127', 'stgb-at-129'],
    keywords: ['schwerer diebstahl', 'stgb 128', 'wert über 5000', 'österreich'],
    qualificationOf: 'stgb-at-127',
    qualificationLevel: 1,
    strafrahmen: { max: '3 Jahre', unit: 'freiheitsstrafe' },
  },
  {
    id: 'stgb-at-129',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 129',
    title: 'Diebstahl durch Einbruch oder mit Waffen',
    shortDescription: 'Diebstahl durch Einbruch in Gebäude/Transportmittel, Öffnen mit Nachschlüssel, Überwinden von Sperren.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 127', 'Einbruch/Waffe/Nachschlüssel'],
    legalConsequence: 'Freiheitsstrafe von 6 Monaten bis 5 Jahre.',
    relatedNorms: ['stgb-at-127', 'stgb-at-128', 'stgb-at-130'],
    keywords: ['einbruchsdiebstahl', 'stgb 129', 'einbruch', 'nachschlüssel', 'aufbrechen', 'österreich'],
    qualificationOf: 'stgb-at-127',
    qualificationLevel: 1,
    strafrahmen: { min: '6 Monate', max: '5 Jahre', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-at-129-1', label: 'Einbruch', description: 'Eindringen durch Einbruch', indicators: ['eingebrochen', 'einbruch', 'aufgebrochen', 'fenster', 'tür aufgehebelt'], weight: 0.9, required: false },
      { id: 'tb-at-129-2', label: 'Nachschlüssel', description: 'Öffnen mit widerrechtlich erlangtem Schlüssel', indicators: ['nachschlüssel', 'schlüssel', 'kopiert', 'widerrechtlich geöffnet'], weight: 0.7, required: false },
    ],
  },
  {
    id: 'stgb-at-130',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 130',
    title: 'Gewerbsmäßiger Diebstahl / Bandendiebstahl',
    shortDescription: 'Gewerbsmäßige Begehung des Diebstahls oder als Mitglied einer Bande.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 127', 'Gewerbsmäßigkeit oder Bandenmitgliedschaft'],
    legalConsequence: 'Freiheitsstrafe von 6 Monaten bis 5 Jahre (Abs. 1) / 1 bis 10 Jahre (Abs. 2).',
    relatedNorms: ['stgb-at-127', 'stgb-at-129'],
    keywords: ['gewerbsmäßiger diebstahl', 'bandendiebstahl', 'stgb 130', 'gewerbsmäßig', 'bande', 'österreich'],
    qualificationOf: 'stgb-at-127',
    qualificationLevel: 2,
    strafrahmen: { min: '6 Monate', max: '5 Jahre', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-at-130-1', label: 'Gewerbsmäßigkeit', description: 'Wiederkehrende Begehung als Einnahmequelle', indicators: ['gewerbsmäßig', 'wiederholt', 'fortgesetzt', 'systematisch', 'seriendiebstahl'], weight: 1.0, required: false },
      { id: 'tb-at-130-2', label: 'Bandenmitgliedschaft', description: 'Als Mitglied einer Bande (mind. 3 Personen)', indicators: ['bande', 'bandenmäßig', 'organisiert', 'gruppe', 'diebesbande'], weight: 1.0, required: false },
    ],
  },
  {
    id: 'stgb-at-131',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 131',
    title: 'Räuberischer Diebstahl',
    shortDescription: 'Wer bei einem Diebstahl auf frischer Tat betreten, Gewalt oder Drohung zur Beutesicherung anwendet.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Diebstahl auf frischer Tat', 'Gewalt/Drohung zur Beutesicherung'],
    legalConsequence: 'Freiheitsstrafe von 6 Monaten bis 5 Jahre.',
    relatedNorms: ['stgb-at-127', 'stgb-at-142'],
    keywords: ['räuberischer diebstahl', 'stgb 131', 'frische tat', 'beutesicherung', 'österreich'],
    qualificationLevel: 0,
    strafrahmen: { min: '6 Monate', max: '5 Jahre', unit: 'freiheitsstrafe' },
  },
  // ═══════════════════════════════════════════════════════════════════════
  // AT StGB — RAUB-KETTE (§§ 142–145)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-at-142',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 142',
    title: 'Raub',
    shortDescription: 'Wer mit Gewalt gegen eine Person oder durch Drohung mit gegenwärtiger Gefahr eine fremde Sache wegnimmt.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Gewalt/Drohung', 'Wegnahme fremder Sache', 'Bereicherungsvorsatz'],
    legalConsequence: 'Freiheitsstrafe von 1 bis 10 Jahre.',
    relatedNorms: ['stgb-at-143', 'stgb-at-131'],
    keywords: ['raub', 'stgb 142', 'überfall', 'gewalt wegnahme', 'österreich'],
    qualificationLevel: 0,
    qualifiedBy: ['stgb-at-143'],
    strafrahmen: { min: '1 Jahr', max: '10 Jahre', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-at-142-1', label: 'Gewalt/Drohung', description: 'Gewalt gegen Person oder Drohung mit Gefahr', indicators: ['gewalt', 'gedroht', 'geschlagen', 'bedroht', 'überfallen'], weight: 1.0, required: true },
      { id: 'tb-at-142-2', label: 'Wegnahme', description: 'Wegnahme einer fremden Sache', indicators: ['weggenommen', 'entrissen', 'geraubt', 'abgenommen'], weight: 1.0, required: true },
    ],
  },
  {
    id: 'stgb-at-143',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 143',
    title: 'Schwerer Raub',
    shortDescription: 'Raub unter Verwendung einer Waffe, als Mitglied einer Bande, oder mit schwerer KV/Tod.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Grundtatbestand § 142', 'Waffe/Bande/schwere Folge'],
    legalConsequence: 'Freiheitsstrafe von 5 bis 15 Jahre (Abs. 1), 10 bis 20 Jahre/lebenslang (Abs. 2 bei Todesfolge).',
    relatedNorms: ['stgb-at-142'],
    keywords: ['schwerer raub', 'stgb 143', 'bewaffneter raub', 'raub todesfolge', 'österreich'],
    qualificationOf: 'stgb-at-142',
    qualificationLevel: 1,
    strafrahmen: { min: '5 Jahre', max: '15 Jahre', unit: 'freiheitsstrafe' },
  },
  // ═══════════════════════════════════════════════════════════════════════
  // AT StGB — MORD/TOTSCHLAG (§§ 75–80)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-at-75',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 75',
    title: 'Mord',
    shortDescription: 'Wer einen anderen tötet, ist mit Freiheitsstrafe von zehn bis zwanzig Jahren oder mit lebenslanger Freiheitsstrafe zu bestrafen.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Tötung eines Menschen', 'Vorsatz'],
    legalConsequence: 'Freiheitsstrafe von 10 bis 20 Jahre oder lebenslang.',
    relatedNorms: ['stgb-at-76', 'stgb-at-77', 'stgb-at-80'],
    keywords: ['mord', 'stgb 75', 'tötung', 'getötet', 'ermordet', 'österreich'],
    qualificationLevel: 0,
    strafrahmen: { min: '10 Jahre', max: '20 Jahre / lebenslang', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-at-75-1', label: 'Tötung', description: 'Vorsätzliche Tötung eines Menschen', indicators: ['getötet', 'ermordet', 'umgebracht', 'erstochen', 'erschossen'], weight: 1.0, required: true },
    ],
    exclusionIndicators: ['fahrlässig', 'unfall', 'notwehr'],
  },
  {
    id: 'stgb-at-76',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 76',
    title: 'Totschlag',
    shortDescription: 'Tötung in einer allgemein begreiflichen heftigen Gemütsbewegung.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Tötung', 'Heftige Gemütsbewegung', 'Allgemein begreiflich'],
    legalConsequence: 'Freiheitsstrafe von 5 bis 10 Jahre.',
    relatedNorms: ['stgb-at-75'],
    keywords: ['totschlag', 'stgb 76', 'affekt', 'gemütsbewegung', 'provokation', 'österreich'],
    qualificationLevel: 3,
    strafrahmen: { min: '5 Jahre', max: '10 Jahre', unit: 'freiheitsstrafe' },
  },
  {
    id: 'stgb-at-80',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 80',
    title: 'Fahrlässige Tötung',
    shortDescription: 'Wer fahrlässig den Tod eines anderen herbeiführt.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Tod eines Menschen', 'Fahrlässigkeit'],
    legalConsequence: 'Freiheitsstrafe bis 1 Jahr.',
    relatedNorms: ['stgb-at-75'],
    keywords: ['fahrlässige tötung', 'stgb 80', 'fahrlässig tod', 'österreich'],
    qualificationLevel: 3,
    strafrahmen: { max: '1 Jahr', unit: 'freiheitsstrafe' },
  },
  // ═══════════════════════════════════════════════════════════════════════
  // AT StGB — KRIMINELLE ORGANISATION (§§ 278–278d)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-at-278',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 278',
    title: 'Kriminelle Vereinigung',
    shortDescription: 'Gründung/Beteiligung an einer auf längere Zeit angelegten Verbindung von mehr als 2 Personen zur Begehung von Straftaten.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Verbindung > 2 Personen', 'Auf Dauer angelegt', 'Zweck: Straftaten-Begehung'],
    legalConsequence: 'Freiheitsstrafe bis 3 Jahre.',
    relatedNorms: ['stgb-at-278a', 'stgb-at-278b'],
    keywords: ['kriminelle vereinigung', 'stgb 278', 'organisierte kriminalität', 'bande', 'österreich'],
    qualificationLevel: 0,
    qualifiedBy: ['stgb-at-278a'],
    strafrahmen: { max: '3 Jahre', unit: 'freiheitsstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-at-278-1', label: 'Verbindung', description: 'Zusammenschluss von mehr als 2 Personen', indicators: ['vereinigung', 'organisation', 'bande', 'gruppe', 'ring', 'netzwerk', 'zusammenschluss'], weight: 1.0, required: true },
      { id: 'tb-at-278-2', label: 'Krimineller Zweck', description: 'Zweck: Begehung von Straftaten', indicators: ['straftaten', 'kriminell', 'systematisch', 'fortgesetzt', 'organisiert'], weight: 1.0, required: true },
    ],
  },
  {
    id: 'stgb-at-278a',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 278a',
    title: 'Kriminelle Organisation',
    shortDescription: 'Besonders strukturierte kriminelle Vereinigung mit erheblichem Einfluss.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Kriminelle Vereinigung § 278', 'Unternehmensähnliche Struktur', 'Gewinnstreben/politischer Einfluss'],
    legalConsequence: 'Freiheitsstrafe von 6 Monaten bis 5 Jahre.',
    relatedNorms: ['stgb-at-278'],
    keywords: ['kriminelle organisation', 'stgb 278a', 'mafia', 'organisierte kriminalität', 'österreich'],
    qualificationOf: 'stgb-at-278',
    qualificationLevel: 1,
    strafrahmen: { min: '6 Monate', max: '5 Jahre', unit: 'freiheitsstrafe' },
  },
  {
    id: 'stgb-at-278b',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 278b',
    title: 'Terroristische Vereinigung',
    shortDescription: 'Gründung/Beteiligung an einer terroristischen Vereinigung.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Vereinigung', 'Terroristischer Zweck'],
    legalConsequence: 'Freiheitsstrafe von 1 bis 10 Jahre.',
    relatedNorms: ['stgb-at-278', 'stgb-at-278a'],
    keywords: ['terroristische vereinigung', 'stgb 278b', 'terrorismus', 'österreich'],
    qualificationOf: 'stgb-at-278',
    qualificationLevel: 2,
    strafrahmen: { min: '1 Jahr', max: '10 Jahre', unit: 'freiheitsstrafe' },
  },
  // ═══════════════════════════════════════════════════════════════════════
  // AT StGB — UNTREUE / VERUNTREUUNG (§§ 153–156)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'stgb-at-153',
    jurisdiction: 'AT',
    law: 'StGB-AT',
    paragraph: '§ 153',
    title: 'Untreue',
    shortDescription: 'Wer seine Befugnis, über fremdes Vermögen zu verfügen, wissentlich missbraucht und dadurch Schaden zufügt.',
    domain: 'criminal',
    type: 'strafnorm',
    prerequisites: ['Verfügungsbefugnis über fremdes Vermögen', 'Wissentlicher Missbrauch', 'Vermögensschaden'],
    legalConsequence: 'Freiheitsstrafe bis 6 Monate oder Geldstrafe (bis 5.000 EUR); bis 3 Jahre (über 5.000 EUR); 1-10 Jahre (über 300.000 EUR).',
    relatedNorms: ['stgb-at-153a'],
    keywords: ['untreue', 'stgb 153', 'missbrauch befugnis', 'treupflichtverletzung', 'österreich'],
    qualificationLevel: 0,
    strafrahmen: { max: '6 Monate', unit: 'freiheitsstrafe_oder_geldstrafe' },
    tatbestandsMerkmale: [
      { id: 'tb-at-153-1', label: 'Verfügungsbefugnis', description: 'Befugnis über fremdes Vermögen', indicators: ['treuhänder', 'geschäftsführer', 'vorstand', 'verwalter', 'bevollmächtigt'], weight: 1.0, required: true },
      { id: 'tb-at-153-2', label: 'Wissentlicher Missbrauch', description: 'Wissentlicher Missbrauch der Befugnis', indicators: ['missbraucht', 'pflichtwidrig', 'zweckwidrig', 'eigenmächtig', 'veruntreut'], weight: 1.0, required: true },
      { id: 'tb-at-153-3', label: 'Vermögensschaden', description: 'Schaden am betreuten Vermögen', indicators: ['schaden', 'nachteil', 'verlust', 'vermindert'], weight: 0.9, required: true },
    ],
  },
  {
    id: 'zpo-at-226',
    jurisdiction: 'AT',
    law: 'ZPO-AT',
    paragraph: '§ 226',
    title: 'Inhalt der Klage',
    shortDescription:
      'Die Klage muss Parteien, Begehren und die Tatsachen, auf welche sich der Anspruch stützt, enthalten.',
    domain: 'civil',
    type: 'verfahrensvorschrift',
    prerequisites: ['Klageeinbringung'],
    legalConsequence: 'Formell ordnungsgemäße Klage.',
    relatedNorms: ['zpo-at-228'],
    keywords: ['klage', 'zpo 226', 'begehren', 'prozessrecht', 'österreich'],
  },
  {
    id: 'zpo-at-266',
    jurisdiction: 'AT',
    law: 'ZPO-AT',
    paragraph: '§ 266',
    title: 'Freie Beweiswürdigung',
    shortDescription:
      'Das Gericht hat unter sorgfältiger Berücksichtigung der Ergebnisse des Verfahrens nach freier Überzeugung zu entscheiden.',
    domain: 'civil',
    type: 'beweislast',
    prerequisites: ['Durchgeführte Beweisaufnahme'],
    legalConsequence: 'Richterliche Überzeugungsbildung nach freier Beweiswürdigung.',
    relatedNorms: ['zpo-at-272'],
    keywords: [
      'beweiswürdigung',
      'zpo 266',
      'beweis',
      'zivilprozess',
      'österreich',
    ],
  },
  // ═══ EMRK ═══
  {
    id: 'emrk-6',
    jurisdiction: 'ECHR',
    law: 'EMRK',
    paragraph: 'Art. 6',
    title: 'Recht auf ein faires Verfahren',
    shortDescription:
      'Jedermann hat Anspruch auf ein faires und öffentliches Verfahren innerhalb angemessener Frist vor einem unabhängigen Gericht.',
    domain: 'constitutional',
    type: 'verfahrensvorschrift',
    prerequisites: ['Zivilrechtliche Ansprüche oder strafrechtliche Anklage'],
    legalConsequence: 'Verfahrensgarantien (fair trial).',
    relatedNorms: ['emrk-13'],
    keywords: ['art 6 emrk', 'fair trial', 'faires verfahren', 'angemessene frist'],
  },
  {
    id: 'emrk-8',
    jurisdiction: 'ECHR',
    law: 'EMRK',
    paragraph: 'Art. 8',
    title: 'Recht auf Achtung des Privat- und Familienlebens',
    shortDescription:
      'Schützt Privatleben, Familienleben, Wohnung und Korrespondenz; Eingriffe nur unter strengen Voraussetzungen.',
    domain: 'constitutional',
    type: 'anspruchsgrundlage',
    prerequisites: ['Eingriff in Privat-/Familienleben/Wohnung/Korrespondenz'],
    legalConsequence: 'Abwehranspruch gegen unverhältnismäßige Eingriffe.',
    relatedNorms: ['emrk-13', 'emrk-14'],
    keywords: ['art 8 emrk', 'privatleben', 'familienleben', 'wohnung', 'eingriff'],
  },
  {
    id: 'emrk-10',
    jurisdiction: 'ECHR',
    law: 'EMRK',
    paragraph: 'Art. 10',
    title: 'Freiheit der Meinungsäußerung',
    shortDescription:
      'Gewährleistet Meinungsfreiheit einschließlich Freiheit zum Empfang und zur Mitteilung von Informationen.',
    domain: 'constitutional',
    type: 'anspruchsgrundlage',
    prerequisites: ['Eingriff in Meinungsäußerung/Informationsfreiheit'],
    legalConsequence: 'Abwehranspruch gegen unverhältnismäßige Eingriffe.',
    relatedNorms: ['emrk-14'],
    keywords: ['art 10 emrk', 'meinungsfreiheit', 'pressefreiheit', 'äußerung'],
  },
  {
    id: 'emrk-13',
    jurisdiction: 'ECHR',
    law: 'EMRK',
    paragraph: 'Art. 13',
    title: 'Recht auf wirksame Beschwerde',
    shortDescription:
      'Bei behaupteten Konventionsverletzungen muss ein wirksamer innerstaatlicher Rechtsbehelf bestehen.',
    domain: 'constitutional',
    type: 'verfahrensvorschrift',
    prerequisites: ['Behauptete Verletzung eines Konventionsrechts'],
    legalConsequence: 'Anspruch auf effektiven Rechtsbehelf.',
    relatedNorms: ['emrk-6'],
    keywords: ['art 13 emrk', 'wirksame beschwerde', 'rechtsbehelf'],
  },
  {
    id: 'emrk-14',
    jurisdiction: 'ECHR',
    law: 'EMRK',
    paragraph: 'Art. 14',
    title: 'Diskriminierungsverbot',
    shortDescription:
      'Verbot der Diskriminierung bei der Gewährung der in der Konvention anerkannten Rechte.',
    domain: 'constitutional',
    type: 'einwendung',
    prerequisites: ['Ungleichbehandlung im Schutzbereich eines Konventionsrechts'],
    legalConsequence: 'Konventionswidrigkeit bei ungerechtfertigter Ungleichbehandlung.',
    relatedNorms: ['emrk-6', 'emrk-8', 'emrk-10'],
    keywords: ['art 14 emrk', 'diskriminierung', 'gleichbehandlung'],
  },
  {
    id: 'emrk-zp1-art1',
    jurisdiction: 'ECHR',
    law: 'EMRK-ZP1',
    paragraph: 'Art. 1',
    title: 'Schutz des Eigentums',
    shortDescription:
      'Jede natürliche oder juristische Person hat Anspruch auf Achtung ihres Eigentums.',
    domain: 'constitutional',
    type: 'anspruchsgrundlage',
    prerequisites: ['Eingriff in bestehende Vermögensposition'],
    legalConsequence: 'Schutz vor unverhältnismäßigen Eigentumseingriffen.',
    relatedNorms: ['emrk-13', 'emrk-14'],
    keywords: ['eigentumsschutz', 'zp1 art 1', 'emrk', 'vermögensposition'],
  },
  // ═══ InsO ═══
  {
    id: 'inso-17',
    jurisdiction: 'DE',
    law: 'InsO',
    paragraph: '§ 17',
    title: 'Zahlungsunfähigkeit',
    shortDescription: 'Allgemeiner Eröffnungsgrund: Schuldner ist zahlungsunfähig, wenn er nicht in der Lage ist, fällige Zahlungspflichten zu erfüllen.',
    domain: 'commercial',
    type: 'anspruchsgrundlage',
    prerequisites: ['Fällige Zahlungspflichten', 'Unfähigkeit zur Erfüllung'],
    legalConsequence: 'Eröffnung des Insolvenzverfahrens.',
    relatedNorms: ['inso-19', 'inso-129'],
    keywords: ['zahlungsunfähigkeit', 'insolvenz', 'insolvent', 'zahlungseinstellung', 'liquidität'],
  },
  {
    id: 'inso-129',
    jurisdiction: 'DE',
    law: 'InsO',
    paragraph: '§ 129',
    title: 'Grundsatz der Insolvenzanfechtung',
    shortDescription: 'Rechtshandlungen, die vor Eröffnung des Insolvenzverfahrens vorgenommen wurden und die Insolvenzgläubiger benachteiligen, können angefochten werden.',
    domain: 'commercial',
    type: 'anspruchsgrundlage',
    prerequisites: ['Rechtshandlung vor Verfahrenseröffnung', 'Gläubigerbenachteiligung'],
    legalConsequence: 'Rückgewähr des Erlangten zur Insolvenzmasse.',
    relatedNorms: ['inso-133', 'inso-134'],
    keywords: ['insolvenzanfechtung', 'anfechtung insolvenz', 'gläubigerbenachteiligung', 'insolvenzmasse'],
  },
  {
    id: 'inso-133',
    jurisdiction: 'DE',
    law: 'InsO',
    paragraph: '§ 133',
    title: 'Vorsatzanfechtung',
    shortDescription: 'Anfechtbar sind Rechtshandlungen, die der Schuldner in den letzten 10 Jahren vor Antragstellung mit dem Vorsatz vorgenommen hat, seine Gläubiger zu benachteiligen.',
    domain: 'commercial',
    type: 'anspruchsgrundlage',
    prerequisites: ['Benachteiligungsvorsatz des Schuldners', 'Kenntnis des Anfechtungsgegners', 'Innerhalb 10 Jahre vor Antrag'],
    legalConsequence: 'Rückgewähr zur Insolvenzmasse.',
    relatedNorms: ['inso-129', 'inso-134'],
    keywords: ['vorsatzanfechtung', 'benachteiligungsvorsatz', 'insolvenzanfechtung', 'kenntnis gläubigerbenachteiligung'],
  },
  // ═══ HGB ═══
  {
    id: 'hgb-346',
    jurisdiction: 'DE',
    law: 'HGB',
    paragraph: '§ 346',
    title: 'Handelsgebräuche',
    shortDescription: 'Unter Kaufleuten sind die Handelsgebräuche zu berücksichtigen.',
    domain: 'commercial',
    type: 'verfahrensvorschrift',
    prerequisites: ['Kaufmannseigenschaft beider Parteien'],
    legalConsequence: 'Handelsgebräuche gelten als vereinbart.',
    relatedNorms: ['hgb-377'],
    keywords: ['handelsgebräuche', 'kaufmann', 'handelsrecht', 'hgb'],
  },
  {
    id: 'hgb-377',
    jurisdiction: 'DE',
    law: 'HGB',
    paragraph: '§ 377',
    title: 'Untersuchungs- und Rügepflicht',
    shortDescription: 'Beim Handelskauf hat der Käufer die Ware unverzüglich zu untersuchen und Mängel anzuzeigen.',
    domain: 'commercial',
    type: 'einwendung',
    prerequisites: ['Handelskauf', 'Mangelhafte Ware', 'Unverzügliche Rüge'],
    legalConsequence: 'Bei unterlassener Rüge gilt Ware als genehmigt.',
    relatedNorms: ['hgb-346'],
    keywords: ['rügepflicht', 'handelskauf', 'mängelrüge', 'unverzüglich', 'hgb 377', 'kaufmännische rüge'],
  },
  {
    id: 'hgb-89b',
    jurisdiction: 'DE',
    law: 'HGB',
    paragraph: '§ 89b',
    title: 'Ausgleichsanspruch des Handelsvertreters',
    shortDescription: 'Der Handelsvertreter kann bei Vertragsbeendigung einen angemessenen Ausgleich verlangen.',
    domain: 'commercial',
    type: 'anspruchsgrundlage',
    prerequisites: ['Handelsvertretervertrag', 'Vertragsbeendigung', 'Neue Kunden oder erhebliche Umsatzsteigerung'],
    legalConsequence: 'Ausgleichsanspruch bis zu einer Jahresprovision.',
    relatedNorms: ['hgb-346'],
    keywords: ['handelsvertreter', 'ausgleichsanspruch', 'hgb 89b', 'provision', 'vertragsbeendigung handelsvertreter'],
  },
  // ═══ AGG ═══
  {
    id: 'agg-1',
    jurisdiction: 'DE',
    law: 'AGG',
    paragraph: '§ 1',
    title: 'Ziel des Gesetzes (AGG)',
    shortDescription: 'Ziel ist die Verhinderung und Beseitigung von Benachteiligungen aus Gründen der Rasse, ethnischen Herkunft, Geschlecht, Religion, Weltanschauung, Behinderung, Alter oder sexuellen Identität.',
    domain: 'labor',
    type: 'schutzgesetz',
    prerequisites: ['Benachteiligung wegen geschütztem Merkmal'],
    legalConsequence: 'Schutz vor Diskriminierung im Arbeits- und Zivilrecht.',
    relatedNorms: ['agg-7', 'agg-15'],
    keywords: ['diskriminierung', 'agg', 'gleichbehandlung', 'benachteiligung', 'geschlecht', 'religion', 'behinderung', 'alter'],
  },
  {
    id: 'agg-7',
    jurisdiction: 'DE',
    law: 'AGG',
    paragraph: '§ 7',
    title: 'Benachteiligungsverbot',
    shortDescription: 'Beschäftigte dürfen nicht wegen eines in § 1 genannten Grundes benachteiligt werden.',
    domain: 'labor',
    type: 'einwendung',
    prerequisites: ['Beschäftigungsverhältnis', 'Benachteiligung wegen AGG-Merkmal'],
    legalConsequence: 'Unwirksamkeit der benachteiligenden Maßnahme.',
    relatedNorms: ['agg-1', 'agg-15'],
    keywords: ['benachteiligungsverbot', 'agg 7', 'diskriminierungsverbot', 'beschäftigte'],
  },
  {
    id: 'agg-15',
    jurisdiction: 'DE',
    law: 'AGG',
    paragraph: '§ 15',
    title: 'Entschädigungsanspruch (AGG)',
    shortDescription: 'Bei Verstoß gegen das Benachteiligungsverbot kann Schadensersatz und Entschädigung verlangt werden.',
    domain: 'labor',
    type: 'anspruchsgrundlage',
    prerequisites: ['Verstoß gegen § 7 AGG', 'Schaden oder immaterielle Beeinträchtigung'],
    legalConsequence: 'Schadensersatz + Entschädigung bis zu 3 Monatsgehälter.',
    relatedNorms: ['agg-7', 'agg-1'],
    keywords: ['entschädigung agg', 'schadensersatz diskriminierung', 'agg 15', 'diskriminierungsschaden'],
  },
  // ═══ WEG ═══
  {
    id: 'weg-10',
    jurisdiction: 'DE',
    law: 'WEG',
    paragraph: '§ 10',
    title: 'Allgemeine Grundsätze (WEG)',
    shortDescription: 'Das Verhältnis der Wohnungseigentümer untereinander und zur Gemeinschaft bestimmt sich nach dem WEG und der Gemeinschaftsordnung.',
    domain: 'civil',
    type: 'verfahrensvorschrift',
    prerequisites: ['Wohnungseigentümergemeinschaft'],
    legalConsequence: 'Bindung an Gemeinschaftsordnung und WEG.',
    relatedNorms: ['weg-21'],
    keywords: ['wohnungseigentum', 'weg', 'eigentümergemeinschaft', 'gemeinschaftsordnung', 'wohnungseigentumsgesetz'],
  },
  {
    id: 'weg-21',
    jurisdiction: 'DE',
    law: 'WEG',
    paragraph: '§ 21',
    title: 'Verwaltung durch die Gemeinschaft',
    shortDescription: 'Die Wohnungseigentümer verwalten das gemeinschaftliche Eigentum selbst oder durch einen Verwalter.',
    domain: 'civil',
    type: 'verfahrensvorschrift',
    prerequisites: ['Gemeinschaftliches Eigentum', 'Beschlussfassung'],
    legalConsequence: 'Ordnungsgemäße Verwaltung des Gemeinschaftseigentums.',
    relatedNorms: ['weg-10'],
    keywords: ['wohnungseigentum verwaltung', 'weg 21', 'verwalter', 'eigentümerversammlung', 'beschluss weg'],
  },
  // ═══ BDSG ═══
  {
    id: 'bdsg-26',
    jurisdiction: 'DE',
    law: 'BDSG',
    paragraph: '§ 26',
    title: 'Datenverarbeitung für Zwecke des Beschäftigungsverhältnisses',
    shortDescription: 'Personenbezogene Daten von Beschäftigten dürfen nur verarbeitet werden, wenn dies für das Beschäftigungsverhältnis erforderlich ist.',
    domain: 'labor',
    type: 'schutzgesetz',
    prerequisites: ['Beschäftigungsverhältnis', 'Datenverarbeitung'],
    legalConsequence: 'Unzulässige Datenverarbeitung ist rechtswidrig; Unterlassung und Schadensersatz.',
    relatedNorms: [],
    keywords: ['datenschutz arbeitnehmer', 'bdsg 26', 'beschäftigtendatenschutz', 'personenbezogene daten arbeit', 'dsgvo arbeit'],
  },
  // ═══ UrhG ═══
  {
    id: 'urhg-97',
    jurisdiction: 'DE',
    law: 'UrhG',
    paragraph: '§ 97',
    title: 'Anspruch auf Unterlassung und Schadensersatz (UrhG)',
    shortDescription: 'Wer das Urheberrecht widerrechtlich verletzt, kann auf Unterlassung und Schadensersatz in Anspruch genommen werden.',
    domain: 'commercial',
    type: 'anspruchsgrundlage',
    prerequisites: ['Urheberrechtsverletzung', 'Widerrechtlichkeit', 'Verschulden (für Schadensersatz)'],
    legalConsequence: 'Unterlassung, Schadensersatz (auch Lizenzanalogie), Auskunft.',
    relatedNorms: ['urhg-106'],
    keywords: ['urheberrecht', 'urhg 97', 'urheberrechtsverletzung', 'schadensersatz urheberrecht', 'unterlassung urheberrecht', 'lizenzanalogie'],
  },
  {
    id: 'urhg-106',
    jurisdiction: 'DE',
    law: 'UrhG',
    paragraph: '§ 106',
    title: 'Unerlaubte Verwertung urheberrechtlich geschützter Werke',
    shortDescription: 'Strafbar macht sich, wer ein Werk ohne Einwilligung des Berechtigten vervielfältigt, verbreitet oder öffentlich wiedergibt.',
    domain: 'criminal',
    type: 'straftatbestand',
    prerequisites: ['Urheberrechtlich geschütztes Werk', 'Verwertung ohne Einwilligung', 'Vorsatz'],
    legalConsequence: 'Freiheitsstrafe bis zu 3 Jahre oder Geldstrafe.',
    relatedNorms: ['urhg-97'],
    keywords: ['urheberrechtsverletzung strafrecht', 'urhg 106', 'unerlaubte verwertung', 'plagiat strafbar'],
  },
  // ═══ MarkenG ═══
  {
    id: 'markeng-14',
    jurisdiction: 'DE',
    law: 'MarkenG',
    paragraph: '§ 14',
    title: 'Ausschließliches Recht des Markeninhabers',
    shortDescription: 'Der Markeninhaber kann Dritten verbieten, ohne seine Zustimmung im geschäftlichen Verkehr ein identisches oder ähnliches Zeichen zu benutzen.',
    domain: 'commercial',
    type: 'anspruchsgrundlage',
    prerequisites: ['Eingetragene Marke', 'Benutzung im geschäftlichen Verkehr', 'Verwechslungsgefahr'],
    legalConsequence: 'Unterlassung, Schadensersatz, Auskunft, Vernichtung.',
    relatedNorms: ['urhg-97'],
    keywords: ['markenrecht', 'markenverletzung', 'markeng 14', 'verwechslungsgefahr', 'markeninhaber', 'unterlassung marke'],
  },
  // ═══ PatG ═══
  {
    id: 'patg-139',
    jurisdiction: 'DE',
    law: 'PatG',
    paragraph: '§ 139',
    title: 'Unterlassung und Schadensersatz bei Patentverletzung',
    shortDescription: 'Wer ein Patent benutzt, ohne dazu berechtigt zu sein, kann auf Unterlassung und Schadensersatz in Anspruch genommen werden.',
    domain: 'commercial',
    type: 'anspruchsgrundlage',
    prerequisites: ['Eingetragenes Patent', 'Benutzung ohne Berechtigung', 'Verschulden'],
    legalConsequence: 'Unterlassung, Schadensersatz, Auskunft.',
    relatedNorms: ['markeng-14', 'urhg-97'],
    keywords: ['patent', 'patentverletzung', 'patg 139', 'schutzrecht', 'unterlassung patent'],
  },

  // ═══ SWITZERLAND (CH) — ZGB / OR / SchKG ═══
  {
    id: 'ch-or-41',
    jurisdiction: 'CH',
    law: 'OR',
    paragraph: 'Art. 41',
    title: 'Haftung aus unerlaubter Handlung',
    shortDescription: 'Wer einem andern widerrechtlich Schaden zufügt, sei es mit Absicht, sei es aus Fahrlässigkeit, wird ihm zum Ersatze verpflichtet.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Widerrechtlichkeit', 'Schaden', 'Kausalzusammenhang', 'Verschulden'],
    legalConsequence: 'Schadenersatz.',
    relatedNorms: ['ch-or-97'],
    keywords: ['haftung', 'schadenersatz', 'unerlaubte handlung', 'or 41', 'deliktsrecht schweiz'],
    burdenOfProof: 'claimant',
  },
  {
    id: 'ch-or-97',
    jurisdiction: 'CH',
    law: 'OR',
    paragraph: 'Art. 97',
    title: 'Haftung bei Vertragsverletzung',
    shortDescription: 'Kann die Erfüllung der Verbindlichkeit überhaupt nicht oder nicht gehörig bewirkt werden, so hat der Schuldner für den daraus entstehenden Schaden Ersatz zu leisten.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Vertrag', 'Vertragsverletzung', 'Schaden', 'Kausalzusammenhang'],
    legalConsequence: 'Schadenersatz wegen Vertragsverletzung.',
    relatedNorms: ['ch-or-41'],
    keywords: ['vertragsverletzung', 'schadenersatz', 'or 97', 'nichterfuellung', 'schlechterfuellung'],
    burdenOfProof: 'claimant',
  },
  {
    id: 'ch-zgb-641',
    jurisdiction: 'CH',
    law: 'ZGB',
    paragraph: 'Art. 641',
    title: 'Eigentumsfreiheitsklage',
    shortDescription: 'Wer Eigentümer einer Sache ist, kann in den Schranken der Rechtsordnung über sie nach seinem Belieben verfügen.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Eigentum', 'Beeinträchtigung'],
    legalConsequence: 'Herausgabe, Unterlassung, Beseitigung.',
    relatedNorms: [],
    keywords: ['eigentum', 'herausgabe', 'eigentumsfreiheitsklage', 'zgb 641'],
    burdenOfProof: 'claimant',
  },
  {
    id: 'ch-schkg-67',
    jurisdiction: 'CH',
    law: 'SchKG',
    paragraph: 'Art. 67',
    title: 'Betreibungsbegehren',
    shortDescription: 'Das Betreibungsbegehren kann schriftlich oder mündlich beim Betreibungsamt eingereicht werden.',
    domain: 'civil',
    type: 'verfahrensvorschrift',
    prerequisites: ['Fällige Forderung', 'Gläubigerstellung'],
    legalConsequence: 'Einleitung der Betreibung.',
    relatedNorms: [],
    keywords: ['betreibung', 'schkg', 'zwangsvollstreckung', 'betreibungsbegehren'],
  },

  // ═══ FRANCE (FR) — Code civil / Code pénal ═══
  {
    id: 'fr-cc-1240',
    jurisdiction: 'FR',
    law: 'Code civil',
    paragraph: 'Art. 1240',
    title: 'Responsabilité pour faute',
    shortDescription: 'Tout fait quelconque de l\u2019homme, qui cause à autrui un dommage, oblige celui par la faute duquel il est arrivé à le réparer.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Faute (Verschulden)', 'Dommage (Schaden)', 'Lien de causalité (Kausalität)'],
    legalConsequence: 'Dommages-intérêts (Schadenersatz).',
    relatedNorms: ['fr-cc-1103'],
    keywords: ['responsabilité', 'faute', 'dommage', '1240', 'tort', 'deliktshaftung'],
    burdenOfProof: 'claimant',
  },
  {
    id: 'fr-cc-1103',
    jurisdiction: 'FR',
    law: 'Code civil',
    paragraph: 'Art. 1103',
    title: 'Force obligatoire du contrat',
    shortDescription: 'Les contrats légalement formés tiennent lieu de loi à ceux qui les ont faits.',
    domain: 'civil',
    type: 'definition',
    prerequisites: ['Contrat valable'],
    legalConsequence: 'Le contrat a force obligatoire entre les parties.',
    relatedNorms: ['fr-cc-1240'],
    keywords: ['contrat', 'force obligatoire', '1103', 'pacta sunt servanda', 'vertragsbindung'],
  },
  {
    id: 'fr-cp-311-1',
    jurisdiction: 'FR',
    law: 'Code pénal',
    paragraph: 'Art. 311-1',
    title: 'Vol',
    shortDescription: 'Le vol est la soustraction frauduleuse de la chose d\u2019autrui.',
    domain: 'criminal',
    type: 'straftatbestand',
    prerequisites: ['Chose d\u2019autrui', 'Soustraction', 'Intention frauduleuse'],
    legalConsequence: 'Trois ans d\u2019emprisonnement et 45 000 euros d\u2019amende.',
    relatedNorms: [],
    keywords: ['vol', 'diebstahl', '311-1', 'code penal', 'soustraction'],
    strafrahmen: { max: '3 Jahre', unit: 'freiheitsstrafe' },
  },

  // ═══ ITALY (IT) — Codice civile / Codice penale ═══
  {
    id: 'it-cc-2043',
    jurisdiction: 'IT',
    law: 'Codice civile',
    paragraph: 'Art. 2043',
    title: 'Risarcimento per fatto illecito',
    shortDescription: 'Qualunque fatto doloso o colposo, che cagiona ad altri un danno ingiusto, obbliga colui che ha commesso il fatto a risarcire il danno.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Fatto doloso o colposo', 'Danno ingiusto', 'Nesso di causalità'],
    legalConsequence: 'Risarcimento del danno (Schadenersatz).',
    relatedNorms: ['it-cc-1218'],
    keywords: ['risarcimento', 'fatto illecito', '2043', 'danno', 'codice civile', 'deliktshaftung'],
    burdenOfProof: 'claimant',
  },
  {
    id: 'it-cc-1218',
    jurisdiction: 'IT',
    law: 'Codice civile',
    paragraph: 'Art. 1218',
    title: 'Responsabilità del debitore',
    shortDescription: 'Il debitore che non esegue esattamente la prestazione dovuta è tenuto al risarcimento del danno.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Obbligazione', 'Inadempimento', 'Danno'],
    legalConsequence: 'Risarcimento del danno per inadempimento.',
    relatedNorms: ['it-cc-2043'],
    keywords: ['inadempimento', 'responsabilita', '1218', 'debitore', 'vertragsverletzung'],
    burdenOfProof: 'claimant',
  },
  {
    id: 'it-cp-624',
    jurisdiction: 'IT',
    law: 'Codice penale',
    paragraph: 'Art. 624',
    title: 'Furto',
    shortDescription: 'Chiunque s\u2019impossessa della cosa mobile altrui, sottraendola a chi la detiene, al fine di trarne profitto per sé o per altri.',
    domain: 'criminal',
    type: 'straftatbestand',
    prerequisites: ['Cosa mobile altrui', 'Sottrazione', 'Fine di profitto'],
    legalConsequence: 'Reclusione da sei mesi a tre anni e multa da euro 154 a euro 516.',
    relatedNorms: [],
    keywords: ['furto', 'diebstahl', '624', 'codice penale', 'sottrazione'],
    strafrahmen: { min: '6 Monate', max: '3 Jahre', unit: 'freiheitsstrafe' },
  },

  // ═══ PORTUGAL (PT) — Código Civil / Código Penal ═══
  {
    id: 'pt-cc-483',
    jurisdiction: 'PT',
    law: 'Código Civil',
    paragraph: 'Art. 483',
    title: 'Responsabilidade civil extracontratual',
    shortDescription: 'Aquele que, com dolo ou mera culpa, violar ilicitamente o direito de outrem fica obrigado a indemnizar.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Ilicitude', 'Culpa', 'Dano', 'Nexo de causalidade'],
    legalConsequence: 'Obrigação de indemnizar.',
    relatedNorms: ['pt-cc-798'],
    keywords: ['responsabilidade', 'extracontratual', '483', 'codigo civil', 'indemnizacao'],
    burdenOfProof: 'claimant',
  },
  {
    id: 'pt-cc-798',
    jurisdiction: 'PT',
    law: 'Código Civil',
    paragraph: 'Art. 798',
    title: 'Responsabilidade contratual',
    shortDescription: 'O devedor que falta culposamente ao cumprimento da obrigação torna-se responsável pelo prejuízo que causa ao credor.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Obrigação', 'Incumprimento', 'Culpa', 'Prejuízo'],
    legalConsequence: 'Indemnização por incumprimento contratual.',
    relatedNorms: ['pt-cc-483'],
    keywords: ['responsabilidade', 'contratual', '798', 'incumprimento', 'vertragsverletzung'],
    burdenOfProof: 'claimant',
  },
  {
    id: 'pt-cp-203',
    jurisdiction: 'PT',
    law: 'Código Penal',
    paragraph: 'Art. 203',
    title: 'Furto',
    shortDescription: 'Quem, com ilegítima intenção de apropriação para si ou para outra pessoa, subtrair coisa móvel alheia.',
    domain: 'criminal',
    type: 'straftatbestand',
    prerequisites: ['Coisa móvel alheia', 'Subtração', 'Intenção de apropriação'],
    legalConsequence: 'Pena de prisão até 3 anos ou pena de multa.',
    relatedNorms: [],
    keywords: ['furto', 'diebstahl', '203', 'codigo penal', 'subtracao'],
    strafrahmen: { max: '3 Jahre', unit: 'freiheitsstrafe_oder_geldstrafe' },
  },

  // ═══ POLAND (PL) — KC / KK / KPC ═══
  {
    id: 'pl-kc-415',
    jurisdiction: 'PL',
    law: 'KC',
    paragraph: 'Art. 415',
    title: 'Odpowiedzialność deliktowa',
    shortDescription: 'Kto z winy swej wyrządził drugiemu szkodę, obowiązany jest do jej naprawienia.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Wina (Verschulden)', 'Szkoda (Schaden)', 'Związek przyczynowy (Kausalität)'],
    legalConsequence: 'Obowiązek naprawienia szkody (Schadenersatz).',
    relatedNorms: ['pl-kc-471'],
    keywords: ['odpowiedzialnosc', 'deliktowa', '415', 'kodeks cywilny', 'szkoda', 'odszkodowanie'],
    burdenOfProof: 'claimant',
  },
  {
    id: 'pl-kc-471',
    jurisdiction: 'PL',
    law: 'KC',
    paragraph: 'Art. 471',
    title: 'Odpowiedzialność kontraktowa',
    shortDescription: 'Dłużnik obowiązany jest do naprawienia szkody wynikłej z niewykonania lub nienależytego wykonania zobowiązania.',
    domain: 'civil',
    type: 'anspruchsgrundlage',
    prerequisites: ['Zobowiązanie', 'Niewykonanie lub nienależyte wykonanie', 'Szkoda'],
    legalConsequence: 'Odszkodowanie za niewykonanie zobowiązania.',
    relatedNorms: ['pl-kc-415'],
    keywords: ['odpowiedzialnosc', 'kontraktowa', '471', 'niewykonanie', 'vertragsverletzung'],
    burdenOfProof: 'claimant',
  },
  {
    id: 'pl-kk-278',
    jurisdiction: 'PL',
    law: 'KK',
    paragraph: 'Art. 278',
    title: 'Kradzież',
    shortDescription: 'Kto zabiera w celu przywłaszczenia cudzą rzecz ruchomą, podlega karze pozbawienia wolności od 3 miesięcy do lat 5.',
    domain: 'criminal',
    type: 'straftatbestand',
    prerequisites: ['Cudza rzecz ruchoma', 'Zabranie', 'Cel przywłaszczenia'],
    legalConsequence: 'Kara pozbawienia wolności od 3 miesięcy do lat 5.',
    relatedNorms: [],
    keywords: ['kradziez', 'diebstahl', '278', 'kodeks karny', 'zabor'],
    strafrahmen: { min: '3 Monate', max: '5 Jahre', unit: 'freiheitsstrafe' },
  },
  {
    id: 'pl-kpc-187',
    jurisdiction: 'PL',
    law: 'KPC',
    paragraph: 'Art. 187',
    title: 'Wymogi formalne pozwu',
    shortDescription: 'Pozew powinien zawierać dokładnie określone żądanie, przytoczenie okoliczności faktycznych i wskazanie dowodów.',
    domain: 'civil',
    type: 'verfahrensvorschrift',
    prerequisites: ['Legitymacja procesowa', 'Jurysdykcja', 'Właściwość sądu'],
    legalConsequence: 'Wszczęcie postępowania cywilnego.',
    relatedNorms: [],
    keywords: ['pozew', 'kpc', 'postepowanie cywilne', '187', 'wymogi formalne'],
  },
];

const LAW_JURISDICTION_FALLBACK: Record<string, Jurisdiction> = {
  // Germany
  BGB: 'DE',
  GG: 'DE',
  ZPO: 'DE',
  VwGO: 'DE',
  StGB: 'DE',
  StPO: 'DE',
  InsO: 'DE',
  HGB: 'DE',
  AGG: 'DE',
  WEG: 'DE',
  BDSG: 'DE',
  UrhG: 'DE',
  MarkenG: 'DE',
  PatG: 'DE',
  // Austria
  ABGB: 'AT',
  MRG: 'AT',
  'StGB-AT': 'AT',
  'ZPO-AT': 'AT',
  'StPO-AT': 'AT',
  AVG: 'AT',
  KSchG: 'AT',
  UGB: 'AT',
  // Switzerland
  ZGB: 'CH',
  OR: 'CH',
  SchKG: 'CH',
  'StGB-CH': 'CH',
  'ZPO-CH': 'CH',
  'StPO-CH': 'CH',
  BGG: 'CH',
  IPRG: 'CH',
  // France
  'Code civil': 'FR',
  'Code p\u00e9nal': 'FR',
  'CPC-FR': 'FR',
  'Code de commerce': 'FR',
  // Italy
  'Codice civile': 'IT',
  'Codice penale': 'IT',
  'CPC-IT': 'IT',
  'CPP-IT': 'IT',
  // Portugal
  'C\u00f3digo Civil': 'PT',
  'C\u00f3digo Penal': 'PT',
  'CPC-PT': 'PT',
  'CPP-PT': 'PT',
  // Poland
  KC: 'PL',
  KK: 'PL',
  KPC: 'PL',
  KPK: 'PL',
  KSH: 'PL',
  KPA: 'PL',
  PPSA: 'PL',
  // ECHR
  EMRK: 'ECHR',
  'EMRK-ZP1': 'ECHR',
  'EMRK-ZP4': 'ECHR',
  'EMRK-ZP6': 'ECHR',
  'EMRK-ZP7': 'ECHR',
};

function normJurisdiction(norm: LegalNorm): Jurisdiction {
  if (norm.jurisdiction) {
    return norm.jurisdiction;
  }
  return LAW_JURISDICTION_FALLBACK[norm.law] ?? 'DE';
}

function normMatchesJurisdictions(
  norm: LegalNorm,
  jurisdictions?: Jurisdiction[]
) {
  if (!jurisdictions || jurisdictions.length === 0) {
    return true;
  }
  const current = normJurisdiction(norm);
  return jurisdictions.includes(current);
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[§().,;:!?'"«»\-–—/\\[\]{}]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 3)
  );
}

function computeScore(textTokens: Set<string>, keywords: string[]): { score: number; matched: string[] } {
  const matched: string[] = [];
  let score = 0;
  for (const kw of keywords) {
    const kwTokens = kw.toLowerCase().split(/\s+/);
    let kwMatch = 0;
    for (const t of kwTokens) {
      if (textTokens.has(t) || [...textTokens].some(tt => tt.includes(t) || t.includes(tt))) {
        kwMatch++;
      }
    }
    if (kwMatch > 0) {
      const kwScore = kwMatch / kwTokens.length;
      score += kwScore;
      matched.push(kw);
    }
  }
  return { score, matched };
}

export class LegalNormsService extends Service {
  readonly norms: ReadonlyArray<LegalNorm> = NORM_DATABASE;

  getAllNorms(options: NormSearchOptions = {}): LegalNorm[] {
    return this.norms.filter(n => normMatchesJurisdictions(n, options.jurisdictions));
  }

  getNormById(id: string): LegalNorm | null {
    return this.norms.find(n => n.id === id) ?? null;
  }

  getNormsByLaw(law: string, jurisdictions?: Jurisdiction[]): LegalNorm[] {
    return this.norms.filter(
      n =>
        n.law.toLowerCase() === law.toLowerCase() &&
        normMatchesJurisdictions(n, jurisdictions)
    );
  }

  getNormsByDomain(
    domain: LegalDomain,
    jurisdictions?: Jurisdiction[]
  ): LegalNorm[] {
    return this.norms.filter(
      n => n.domain === domain && normMatchesJurisdictions(n, jurisdictions)
    );
  }

  getNormsByType(type: NormType, jurisdictions?: Jurisdiction[]): LegalNorm[] {
    return this.norms.filter(
      n => n.type === type && normMatchesJurisdictions(n, jurisdictions)
    );
  }

  getNormsByJurisdiction(jurisdiction: Jurisdiction): LegalNorm[] {
    return this.norms.filter(n => normJurisdiction(n) === jurisdiction);
  }

  buildNormContextBlock(
    normIds: string[],
    options: NormSearchOptions = {}
  ): string {
    const norms = normIds
      .map(id => this.getNormById(id))
      .filter(Boolean)
      .filter(n => normMatchesJurisdictions(n as LegalNorm, options.jurisdictions)) as LegalNorm[];

    if (norms.length === 0) {
      return '';
    }

    return [
      '## Einschlaegige Rechtsnormen',
      ...norms.map(n => {
        const jurisdiction = normJurisdiction(n);
        return `- **${n.law} ${n.paragraph}** [${jurisdiction}] (${n.title}): ${n.shortDescription}`;
      }),
    ].join('\n');
  }

  searchNorms(
    query: string,
    limit = 10,
    options: NormSearchOptions = {}
  ): NormMatchResult[] {
    const tokens = tokenize(query);
    if (tokens.size === 0) return [];

    const results: NormMatchResult[] = [];
    for (const norm of this.norms) {
      if (!normMatchesJurisdictions(norm, options.jurisdictions)) {
        continue;
      }
      const { score: kwScore, matched: kwMatched } = computeScore(tokens, norm.keywords);
      const { score: descScore } = computeScore(tokens, [norm.shortDescription, norm.title]);
      const totalScore = kwScore * 2 + descScore;

      if (totalScore > 0.3) {
        results.push({
          norm,
          matchScore: Math.min(1, totalScore / 3),
          matchedKeywords: kwMatched,
          matchContext: `${norm.law} ${norm.paragraph}: ${norm.title}`,
        });
      }
    }

    return results
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }

  findAnspruchsgrundlagen(
    factText: string,
    options: NormSearchOptions = {}
  ): AnspruchsgrundlageChain[] {
    const tokens = tokenize(factText);
    const anspruchsNormen = this.norms.filter(
      n =>
        n.type === 'anspruchsgrundlage' &&
        normMatchesJurisdictions(n, options.jurisdictions)
    );
    const chains: AnspruchsgrundlageChain[] = [];

    for (const norm of anspruchsNormen) {
      const { score, matched } = computeScore(tokens, norm.keywords);
      if (score < 0.3) continue;

      const einwendungen = this.norms.filter(
        n =>
          n.type === 'einwendung' &&
          normMatchesJurisdictions(n, options.jurisdictions) &&
          norm.relatedNorms.includes(n.id)
      );
      const einreden = this.norms.filter(
        n =>
          n.type === 'einrede' &&
          normMatchesJurisdictions(n, options.jurisdictions) &&
          norm.relatedNorms.includes(n.id)
      );

      let hint: 'high' | 'medium' | 'low' | 'uncertain' = 'uncertain';
      if (score > 1.5 && matched.length >= 3) hint = 'high';
      else if (score > 0.8) hint = 'medium';
      else if (score > 0.3) hint = 'low';

      chains.push({
        id: `chain:${norm.id}:${Date.now()}`,
        title: `${norm.law} ${norm.paragraph} — ${norm.title}`,
        anspruchsgrundlage: norm,
        einwendungen,
        einreden,
        beweislast: norm.burdenOfProof === 'claimant'
          ? 'Kläger trägt Beweislast'
          : norm.burdenOfProof === 'defendant'
            ? 'Beklagter trägt Beweislast (Exkulpation)'
            : 'Geteilte Beweislast',
        successProbabilityHint: hint,
      });
    }

    return chains.sort((a, b) => {
      const rank = { high: 4, medium: 3, low: 2, uncertain: 1 };
      return rank[b.successProbabilityHint] - rank[a.successProbabilityHint];
    });
  }

  calculateVerjährung(input: {
    normId?: string;
    knowledgeDate?: string;
    eventDate?: string;
  }): VerjährungsResult | null {
    const norm = input.normId
      ? this.getNormById(input.normId)
      : this.norms.find(n => n.id === 'bgb-195');

    if (!norm || !norm.limitationPeriodYears) return null;

    const years = norm.limitationPeriodYears;
    const now = new Date();

    let expiryDate: Date | null = null;
    let isExpired = false;
    let daysRemaining: number | null = null;

    if (input.knowledgeDate) {
      const knowledge = new Date(input.knowledgeDate);
      if (!isNaN(knowledge.getTime())) {
        const yearEnd = new Date(knowledge.getFullYear(), 11, 31);
        expiryDate = new Date(yearEnd);
        expiryDate.setFullYear(expiryDate.getFullYear() + years);

        isExpired = now > expiryDate;
        daysRemaining = isExpired
          ? 0
          : Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }
    } else if (input.eventDate) {
      const event = new Date(input.eventDate);
      if (!isNaN(event.getTime())) {
        expiryDate = new Date(event);
        expiryDate.setFullYear(expiryDate.getFullYear() + years);

        isExpired = now > expiryDate;
        daysRemaining = isExpired
          ? 0
          : Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    return {
      normId: norm.id,
      paragraph: `${norm.law} ${norm.paragraph}`,
      periodYears: years,
      startEvent: norm.limitationStart ?? 'Entstehung des Anspruchs',
      calculatedExpiry: expiryDate?.toISOString(),
      isExpired,
      daysRemaining,
      hemmungHints: [
        '§ 204 BGB: Klageerhebung hemmt Verjährung',
        '§ 203 BGB: Verhandlungen hemmen Verjährung',
        '§ 208 BGB: Höchstfrist 10 Jahre ab Entstehung (30 Jahre bei Leben/Körper/Freiheit)',
      ],
      neubeginnHints: [
        '§ 212 BGB: Anerkenntnis (Abschlagszahlung, Zinszahlung, Sicherheitsleistung)',
        '§ 212 BGB: Vollstreckungshandlung',
      ],
    };
  }

  getRelevantNormsForCase(caseText: string): {
    anspruchsgrundlagen: NormMatchResult[];
    verfahrensNormen: NormMatchResult[];
    fristenNormen: NormMatchResult[];
    strafrechtNormen: NormMatchResult[];
  } {
    const tokens = tokenize(caseText);

    const score = (norm: LegalNorm) => {
      const { score: s, matched } = computeScore(tokens, norm.keywords);
      const { score: ds } = computeScore(tokens, [norm.shortDescription, norm.title]);
      return { score: s * 2 + ds, matched };
    };

    const buildResults = (norms: LegalNorm[]): NormMatchResult[] => {
      return norms
        .map(norm => {
          const { score: s, matched } = score(norm);
          return {
            norm,
            matchScore: Math.min(1, s / 3),
            matchedKeywords: matched,
            matchContext: `${norm.law} ${norm.paragraph}: ${norm.title}`,
          };
        })
        .filter(r => r.matchScore > 0.15)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 5);
    };

    return {
      anspruchsgrundlagen: buildResults(this.getNormsByType('anspruchsgrundlage')),
      verfahrensNormen: buildResults(this.getNormsByType('verfahrensvorschrift')),
      fristenNormen: buildResults(this.getNormsByType('frist')),
      strafrechtNormen: buildResults(this.getNormsByType('strafnorm')),
    };
  }
}
