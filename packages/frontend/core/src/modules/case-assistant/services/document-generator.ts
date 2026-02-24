import { Service } from '@toeverything/infra';

import type {
  CaseBlueprint,
  CaseFile,
  CitationChain,
  CourtDecision,
  JudikaturSuggestion,
  LegalDocumentRecord,
  LegalFinding,
} from '../types';
import type { AnspruchsgrundlageChain, LegalNorm } from './legal-norms';

/**
 * Legal Document Generator Service
 *
 * Generates structured legal documents:
 * - Klageschrift (ZPO-konform)
 * - Klageerwiderung
 * - Widerspruch gegen Verwaltungsakt
 * - Berufungsschrift
 * - Mandantenanschreiben (verständliche Sprache)
 * - Sachverhaltsdarstellung
 * - Gutachten-Stil Analyse
 * - Fristenübersicht
 */

export type DocumentTemplate =
  | 'klageschrift'
  | 'klageerwiderung'
  | 'widerspruch'
  | 'berufungsschrift'
  | 'mandantenbrief'
  | 'sachverhaltsdarstellung'
  | 'gutachten'
  | 'fristenuebersicht'
  | 'vergleichsvorschlag'
  | 'mahnung'
  | 'abmahnung'
  | 'kuendigung'
  | 'mietminderungsanzeige'
  | 'rechtsschutzanfrage_schriftsatz'
  | 'deckungszusage_erinnerung_schriftsatz';

export interface DocumentGeneratorInput {
  template: DocumentTemplate;
  caseFile?: CaseFile;
  documents?: LegalDocumentRecord[];
  findings?: LegalFinding[];
  judikaturSuggestions?: JudikaturSuggestion[];
  citationChains?: CitationChain[];
  courtDecisions?: CourtDecision[];
  blueprint?: CaseBlueprint;
  anspruchsgrundlagen?: AnspruchsgrundlageChain[];
  parties?: {
    klaeger?: string;
    beklagter?: string;
    /** Multi-party: list of all plaintiffs (Streitgenossenschaft § 59ff ZPO) */
    klaegerList?: string[];
    /** Multi-party: list of all defendants */
    beklagterList?: string[];
    /** Multi-party: list of Nebenintervenienten */
    nebenintervenienten?: string[];
    gericht?: string;
    aktenzeichen?: string;
    anwalt?: string;
    kanzlei?: string;
    mandant?: string;
    /** Multi-mandant: list of all mandants for bulk Mandantenbriefe */
    mandantList?: string[];
    logoDataUrl?: string;
  };
  sachverhalt?: string;
  antraege?: string[];
  streitwert?: number;
  customFields?: Record<string, string>;
}

export interface GeneratedDocument {
  id: string;
  template: DocumentTemplate;
  title: string;
  markdown: string;
  sections: GeneratedSection[];
  citations: GeneratedCitation[];
  warnings: string[];
  generatedAt: string;
}

export interface GeneratedSection {
  id: string;
  heading: string;
  content: string;
  citationIds: string[];
}

export interface GeneratedCitation {
  id: string;
  documentId?: string;
  documentTitle?: string;
  normReference?: string;
  quote: string;
  relevance: number;
}

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function today(): string {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(new Date());
}

function buildCitationsFromFindings(findings: LegalFinding[]): GeneratedCitation[] {
  const citations: GeneratedCitation[] = [];
  for (const finding of findings) {
    for (const cite of finding.citations) {
      citations.push({
        id: createId('cite'),
        documentId: cite.documentId,
        documentTitle: finding.title,
        quote: cite.quote,
        relevance: finding.confidence,
      });
    }
  }
  return citations;
}

function buildNormCitations(norms: LegalNorm[]): GeneratedCitation[] {
  return norms.map(norm => ({
    id: createId('cite-norm'),
    normReference: `${norm.law} ${norm.paragraph}`,
    quote: norm.shortDescription,
    relevance: 0.95,
  }));
}

function buildLetterhead(parties: DocumentGeneratorInput['parties']): string {
  const p = parties ?? {};
  const lines: string[] = [];
  if (p.logoDataUrl) {
    lines.push(`![Kanzlei-Logo](${p.logoDataUrl})\n`);
  }
  if (p.kanzlei) {
    lines.push(`**${p.kanzlei}**`);
  }
  if (p.anwalt) {
    lines.push(p.anwalt);
  }
  return lines.length > 0 ? lines.join('  \n') + '\n\n---\n\n' : '';
}

/**
 * Resolve multi-party: uses klaegerList[] if available, falls back to singular klaeger
 */
function resolveKlaeger(parties: DocumentGeneratorInput['parties']): string[] {
  const p = parties ?? {};
  if (p.klaegerList && p.klaegerList.length > 0) return p.klaegerList;
  return p.klaeger ? [p.klaeger] : ['[Kläger/in]'];
}

function resolveBeklagter(parties: DocumentGeneratorInput['parties']): string[] {
  const p = parties ?? {};
  if (p.beklagterList && p.beklagterList.length > 0) return p.beklagterList;
  return p.beklagter ? [p.beklagter] : ['[Beklagte/r]'];
}

function formatPartyList(names: string[], role: 'Kläger' | 'Beklagte' | 'Nebenintervenient'): string {
  if (names.length === 1) {
    return `**${names[0]}** — ${role}/in —`;
  }
  return names.map((name, i) => `**${i + 1}. ${name}** — ${role}/in zu ${i + 1} —`).join('\n\n');
}

function formatStreitgenossenschaftNote(klaegerCount: number, beklagterCount: number): string {
  const notes: string[] = [];
  if (klaegerCount > 1) {
    notes.push(`Aktive Streitgenossenschaft auf Klägerseite (${klaegerCount} Kläger, §§ 59ff ZPO)`);
  }
  if (beklagterCount > 1) {
    notes.push(`Passive Streitgenossenschaft auf Beklagtenseite (${beklagterCount} Beklagte, §§ 59ff ZPO)`);
  }
  return notes.length > 0 ? `\n\n> **Hinweis:** ${notes.join('; ')}` : '';
}

function buildSachverhaltFromDocs(documents: LegalDocumentRecord[], maxLen = 3000): string {
  if (documents.length === 0) return 'Der Sachverhalt ergibt sich aus den beigefügten Unterlagen.';

  const parts = documents
    .filter(d => (d.normalizedText ?? d.rawText).trim().length > 20)
    .slice(0, 5)
    .map((d, i) => {
      const text = (d.normalizedText ?? d.rawText).trim().slice(0, 500);
      return `**Dokument ${i + 1}: ${d.title}**\n${text}`;
    });

  return parts.join('\n\n').slice(0, maxLen);
}

function buildFindingsSummary(findings: LegalFinding[]): string {
  if (findings.length === 0) return '';

  const lines = findings.slice(0, 8).map(f => {
    const badge = f.severity === 'critical' ? '🔴' : f.severity === 'high' ? '🟠' : '🟡';
    return `- ${badge} **${f.title}** (Konfidenz: ${(f.confidence * 100).toFixed(0)}%):\n  ${f.description}`;
  });

  return lines.join('\n');
}

function buildDecisionLookup(decisions: CourtDecision[]) {
  return new Map(decisions.map(item => [item.id, item]));
}

function formatJudikaturSection(input: {
  suggestions: JudikaturSuggestion[];
  decisionById: Map<string, CourtDecision>;
  comparativeChain?: CitationChain;
}) {
  const suggestionLines = input.suggestions.slice(0, 6).map((suggestion, index) => {
    const decision = input.decisionById.get(suggestion.decisionId);
    const decisionLabel = decision
      ? `${decision.court} ${decision.fileNumber} (${new Date(decision.decisionDate).toLocaleDateString('de-DE')})`
      : suggestion.citationMarkdown;
    const authority = suggestion.authorityLevel ?? 'reference';
    const authorityLabel =
      authority === 'binding' ? 'bindend' : authority === 'persuasive' ? 'überzeugend' : 'referenziell';
    const crossTag = suggestion.isCrossBorder ? ' · cross-jurisdiction' : '';
    return `${index + 1}. **${decisionLabel}** — ${authorityLabel}${crossTag}\n   ${suggestion.matchReason}`;
  });

  const comparativeNormLines =
    input.comparativeChain?.entries
      .filter(entry => entry.type === 'norm' && entry.normReference)
      .slice(0, 6)
      .map(entry => `- ${entry.citationFormatted} — ${entry.annotation ?? 'Vergleichsnorm'}`) ?? [];

  const comparativeDecisionLines =
    input.comparativeChain?.entries
      .filter(entry => entry.type === 'decision')
      .slice(0, 6)
      .map(entry => `- ${entry.citationFormatted} — ${entry.annotation ?? 'Vergleichsentscheidung'}`) ?? [];

  const blocks: string[] = [
    'Die folgende Rechtsprechung wurde datenbankgestützt und jurisdiktionssensitiv priorisiert:',
    '',
    ...suggestionLines,
  ];

  if (comparativeNormLines.length > 0) {
    blocks.push('', '### Cross-Jurisdiction Norm-Brücken', ...comparativeNormLines);
  }

  if (comparativeDecisionLines.length > 0) {
    blocks.push('', '### Vergleichsentscheidungen', ...comparativeDecisionLines);
  }

  return blocks.join('\n');
}

export class DocumentGeneratorService extends Service {
  generate(input: DocumentGeneratorInput): GeneratedDocument {
    const now = new Date().toISOString();

    const base = (() => {
      switch (input.template) {
      case 'klageschrift':
        return this.generateKlageschrift(input, now);
      case 'klageerwiderung':
        return this.generateKlageerwiderung(input, now);
      case 'widerspruch':
        return this.generateWiderspruch(input, now);
      case 'berufungsschrift':
        return this.generateBerufungsschrift(input, now);
      case 'mandantenbrief':
        return this.generateMandantenbrief(input, now);
      case 'sachverhaltsdarstellung':
        return this.generateSachverhaltsdarstellung(input, now);
      case 'gutachten':
        return this.generateGutachten(input, now);
      case 'fristenuebersicht':
        return this.generateFristenuebersicht(input, now);
      case 'vergleichsvorschlag':
        return this.generateVergleichsvorschlag(input, now);
      case 'mahnung':
        return this.generateMahnung(input, now);
      case 'abmahnung':
        return this.generateAbmahnung(input, now);
      case 'kuendigung':
        return this.generateKuendigung(input, now);
      case 'mietminderungsanzeige':
        return this.generateMietminderungsanzeige(input, now);
      case 'rechtsschutzanfrage_schriftsatz':
        return this.generateRechtsschutzanfrageSchriftsatz(input, now);
      case 'deckungszusage_erinnerung_schriftsatz':
        return this.generateDeckungszusageErinnerungSchriftsatz(input, now);
      default:
        return this.generateGeneric(input, now);
      }
    })();

    return this.enrichWithCrossJurisdictionKnowledge(base, input);
  }

  private enrichWithCrossJurisdictionKnowledge(
    document: GeneratedDocument,
    input: DocumentGeneratorInput
  ): GeneratedDocument {
    const legalTemplates = new Set<DocumentTemplate>([
      'klageschrift',
      'klageerwiderung',
      'widerspruch',
      'berufungsschrift',
      'gutachten',
      'vergleichsvorschlag',
      'rechtsschutzanfrage_schriftsatz',
      'deckungszusage_erinnerung_schriftsatz',
    ]);
    if (!legalTemplates.has(document.template)) {
      return document;
    }

    const suggestions = [...(input.judikaturSuggestions ?? [])]
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 8);
    if (suggestions.length === 0) {
      return document;
    }

    const decisionById = buildDecisionLookup(input.courtDecisions ?? []);
    const comparativeChain = (input.citationChains ?? []).find(chain =>
      chain.title.toLowerCase().includes('vergleichsrechtsprechung')
    );

    const judikaturCitations = suggestions.map((suggestion): GeneratedCitation => {
      const decision = decisionById.get(suggestion.decisionId);
      return {
        id: createId('cite-judikatur'),
        documentTitle: decision
          ? `${decision.court} ${decision.fileNumber}`
          : suggestion.citationMarkdown,
        quote: suggestion.matchReason,
        relevance: suggestion.relevanceScore,
      };
    });

    const section: GeneratedSection = {
      id: createId('sec'),
      heading: 'Judikatur & Cross-Jurisdiction Bewertung',
      content: formatJudikaturSection({
        suggestions,
        decisionById,
        comparativeChain,
      }),
      citationIds: judikaturCitations.map(item => item.id),
    };

    const warnings = [...document.warnings];
    const hasBinding = suggestions.some(item => item.authorityLevel === 'binding');
    if (!hasBinding) {
      warnings.push('Keine bindende Leitentscheidung erkannt – Argumentation mit Primärquellen absichern.');
    }

    const sections = [...document.sections, section];
    const markdown = buildLetterhead(input.parties) + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n---\n\n');

    return {
      ...document,
      sections,
      citations: [...document.citations, ...judikaturCitations],
      warnings,
      markdown,
    };
  }

  private generateKlageschrift(input: DocumentGeneratorInput, now: string): GeneratedDocument {
    const p = input.parties ?? {};
    const gericht = p.gericht ?? '[Gericht einfügen]';
    const klaegerNames = resolveKlaeger(input.parties);
    const beklagterNames = resolveBeklagter(input.parties);
    const klaegerDisplay = klaegerNames.join(', ');
    const beklagterDisplay = beklagterNames.join(', ');
    const az = p.aktenzeichen ?? '[Aktenzeichen]';
    const anwalt = p.anwalt ?? '[Rechtsanwalt/Rechtsanwältin]';
    const kanzlei = p.kanzlei ?? '[Kanzlei]';
    const streitwert = input.streitwert ?? 0;

    const sachverhalt = input.sachverhalt ??
      buildSachverhaltFromDocs(input.documents ?? []);

    const antraege = input.antraege?.length
      ? input.antraege.map((a, i) => `${i + 1}. ${a}`).join('\n')
      : '1. [Klageantrag einfügen]\n2. Der Beklagten die Kosten des Rechtsstreits aufzuerlegen.\n3. Das Urteil vorläufig vollstreckbar zu erklären.';

    const anspruchsSection = input.anspruchsgrundlagen?.length
      ? input.anspruchsgrundlagen.map(chain =>
          `**${chain.title}**\n\nVoraussetzungen:\n${chain.anspruchsgrundlage.prerequisites.map(pr => `- ${pr}`).join('\n')}\n\n${chain.beweislast}\n\nErfolgsaussicht: ${chain.successProbabilityHint}`
        ).join('\n\n---\n\n')
      : 'Die Anspruchsgrundlagen sind im Einzelnen darzulegen.';

    const findingsSummary = buildFindingsSummary(input.findings ?? []);
    const citations = [
      ...buildCitationsFromFindings(input.findings ?? []),
      ...buildNormCitations(input.anspruchsgrundlagen?.map(c => c.anspruchsgrundlage) ?? []),
    ];

    const warnings: string[] = [];
    if (!p.gericht) warnings.push('Gericht nicht angegeben – bitte ergänzen.');
    if (klaegerNames.length === 1 && klaegerNames[0] === '[Kläger/in]') {
      warnings.push('Kläger nicht angegeben – bitte ergänzen.');
    }
    if (streitwert === 0) warnings.push('Streitwert nicht angegeben – Zuständigkeit prüfen.');
    if (!input.sachverhalt && (!input.documents || input.documents.length === 0)) {
      warnings.push('Kein Sachverhalt und keine Dokumente vorhanden – bitte ergänzen.');
    }

    const klaegerRubrum = formatPartyList(klaegerNames, 'Kläger');
    const beklagterRubrum = formatPartyList(beklagterNames, 'Beklagte');
    const streitgenossenschaftHinweis = formatStreitgenossenschaftNote(klaegerNames.length, beklagterNames.length);

    const nebenintervenientenSection = p.nebenintervenienten?.length
      ? `\n\n**Nebenintervenienten (§ 66 ZPO):**\n${p.nebenintervenienten.map((n, i) => `${i + 1}. ${n}`).join('\n')}`
      : '';

    const sections: GeneratedSection[] = [
      {
        id: createId('sec'),
        heading: 'Rubrum',
        content: `An das\n${gericht}\n\nIn der Sache\n\n${klaegerRubrum}\n\ngegen\n\n${beklagterRubrum}${nebenintervenientenSection}\n\nAz.: ${az}\n\nwegen: [Streitgegenstand]\n\nStreitwert: ${streitwert > 0 ? `${streitwert.toLocaleString('de-DE')} €` : '[Streitwert einfügen]'}${streitgenossenschaftHinweis}`,
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Klageanträge',
        content: `Namens und in Vollmacht ${klaegerNames.length > 1 ? 'der Kläger' : 'des Klägers/der Klägerin'} wird beantragt:\n\n${antraege}`,
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Sachverhalt',
        content: sachverhalt,
        citationIds: citations.filter(c => c.documentId).map(c => c.id),
      },
      {
        id: createId('sec'),
        heading: 'Rechtliche Würdigung',
        content: anspruchsSection,
        citationIds: citations.filter(c => c.normReference).map(c => c.id),
      },
    ];

    if (findingsSummary) {
      sections.push({
        id: createId('sec'),
        heading: 'Erkannte Rechtliche Punkte (AI-gestützt)',
        content: findingsSummary + '\n\n> ⚠️ AI-generierte Analyse – juristische Prüfung erforderlich.',
        citationIds: [],
      });
    }

    sections.push({
      id: createId('sec'),
      heading: 'Beweisangebote',
      content: 'Beweis wird angetreten durch:\n\n1. Die beigefügten Unterlagen (Anlagen K1 ff.)\n2. [Zeugenvernehmung / Sachverständigengutachten einfügen]',
      citationIds: [],
    });

    sections.push({
      id: createId('sec'),
      heading: 'Unterschrift',
      content: `${kanzlei}\n${anwalt}\n\n${today()}`,
      citationIds: [],
    });

    const letterhead = buildLetterhead(input.parties);
    const markdown = letterhead + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n---\n\n');

    return {
      id: createId('gen-doc'),
      template: 'klageschrift',
      title: `Klageschrift — ${klaegerDisplay} ./. ${beklagterDisplay}`,
      markdown,
      sections,
      citations,
      warnings,
      generatedAt: now,
    };
  }

  private generateKlageerwiderung(input: DocumentGeneratorInput, now: string): GeneratedDocument {
    const p = input.parties ?? {};
    const sections: GeneratedSection[] = [
      {
        id: createId('sec'),
        heading: 'Rubrum',
        content: `In der Sache\n\n**${p.klaeger ?? '[Kläger/in]'}** ./. **${p.beklagter ?? '[Beklagte/r]'}**\n\nAz.: ${p.aktenzeichen ?? '[Az.]'}`,
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Anträge',
        content: 'Namens und in Vollmacht des Beklagten/der Beklagten wird beantragt:\n\n1. Die Klage abzuweisen.\n2. Dem Kläger/der Klägerin die Kosten des Rechtsstreits aufzuerlegen.',
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Sachverhalt',
        content: input.sachverhalt ?? buildSachverhaltFromDocs(input.documents ?? []),
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Rechtliche Stellungnahme',
        content: 'Die Klage ist unbegründet.\n\n[Rechtliche Argumente einfügen]',
        citationIds: [],
      },
    ];

    const letterhead = buildLetterhead(input.parties);
    const markdown = letterhead + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n---\n\n');
    return {
      id: createId('gen-doc'),
      template: 'klageerwiderung',
      title: `Klageerwiderung — ${p.beklagter ?? 'Beklagter'}`,
      markdown,
      sections,
      citations: buildCitationsFromFindings(input.findings ?? []),
      warnings: [],
      generatedAt: now,
    };
  }

  private generateWiderspruch(input: DocumentGeneratorInput, now: string): GeneratedDocument {
    const p = input.parties ?? {};
    const sections: GeneratedSection[] = [
      {
        id: createId('sec'),
        heading: 'Adressat',
        content: `An\n${p.gericht ?? '[Behörde/Widerspruchsbehörde]'}\n\n**Widerspruch**\n\ngegen den Bescheid vom [Datum], Az.: ${p.aktenzeichen ?? '[Az.]'}`,
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Begründung',
        content: `Der o.g. Bescheid ist rechtswidrig und verletzt den Widerspruchsführer/die Widerspruchsführerin in seinen/ihren Rechten.\n\n${input.sachverhalt ?? buildSachverhaltFromDocs(input.documents ?? [])}\n\n### Rechtliche Bewertung\n\nDer Verwaltungsakt ist aus folgenden Gründen aufzuheben:\n\n1. [Formelle Fehler]\n2. [Materielle Rechtswidrigkeit]\n3. [Ermessensfehler]`,
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Antrag',
        content: 'Es wird beantragt, den Bescheid vom [Datum] aufzuheben und die Angelegenheit im Sinne des Widerspruchsführers/der Widerspruchsführerin zu bescheiden.',
        citationIds: [],
      },
    ];

    const markdown = buildLetterhead(input.parties) + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n---\n\n');
    return {
      id: createId('gen-doc'),
      template: 'widerspruch',
      title: `Widerspruch gegen Bescheid vom [Datum]`,
      markdown,
      sections,
      citations: buildCitationsFromFindings(input.findings ?? []),
      warnings: ['Widerspruchsfrist beachten (i.d.R. 1 Monat ab Zustellung, § 70 VwGO).'],
      generatedAt: now,
    };
  }

  private generateBerufungsschrift(input: DocumentGeneratorInput, now: string): GeneratedDocument {
    const p = input.parties ?? {};
    const sections: GeneratedSection[] = [
      {
        id: createId('sec'),
        heading: 'Berufungseinlegung',
        content: `An das\n${p.gericht ?? '[Berufungsgericht]'}\n\nIn der Sache\n**${p.klaeger ?? '[Kläger/in]'}** ./. **${p.beklagter ?? '[Beklagte/r]'}**\n\nAz. 1. Instanz: ${p.aktenzeichen ?? '[Az.]'}\n\nwird hiermit\n\n**BERUFUNG**\n\ngegen das Urteil des [Gericht 1. Instanz] vom [Datum] eingelegt.`,
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Berufungsanträge',
        content: 'Es wird beantragt:\n\n1. Das Urteil des [Gericht] vom [Datum], Az.: [Az.], aufzuheben.\n2. [Sachantrag]\n3. Der Berufungsbeklagten die Kosten des Rechtsstreits beider Instanzen aufzuerlegen.',
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Berufungsbegründung',
        content: 'Das erstinstanzliche Urteil beruht auf einer Rechtsverletzung (§ 513 Abs. 1 ZPO) und/oder die zugrunde gelegten Tatsachen rechtfertigen eine andere Entscheidung (§ 513 Abs. 1 Alt. 2 ZPO).\n\n[Begründung im Einzelnen]',
        citationIds: [],
      },
    ];

    const markdown = buildLetterhead(input.parties) + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n---\n\n');
    return {
      id: createId('gen-doc'),
      template: 'berufungsschrift',
      title: `Berufungsschrift`,
      markdown,
      sections,
      citations: [],
      warnings: [
        'Berufungsfrist: 1 Monat ab Zustellung des Urteils (§ 517 ZPO).',
        'Berufungsbegründungsfrist: 2 Monate ab Zustellung (§ 520 Abs. 2 ZPO).',
        'Berufungssumme beachten: über 600 € (§ 511 Abs. 2 Nr. 1 ZPO).',
      ],
      generatedAt: now,
    };
  }

  private generateMandantenbrief(input: DocumentGeneratorInput, now: string): GeneratedDocument {
    const p = input.parties ?? {};
    const mandant = p.mandant ?? p.klaeger ?? '[Mandant/in]';
    const anwalt = p.anwalt ?? '[Rechtsanwalt/Rechtsanwältin]';
    const kanzlei = p.kanzlei ?? '[Kanzlei]';

    const findingsSummary = (input.findings ?? []).slice(0, 5).map(f => {
      const severityText = f.severity === 'critical' ? 'sehr wichtig'
        : f.severity === 'high' ? 'wichtig'
        : f.severity === 'medium' ? 'beachtenswert'
        : 'zur Kenntnis';
      return `- **${f.title}** (${severityText}): ${f.description}`;
    }).join('\n');

    const sections: GeneratedSection[] = [
      {
        id: createId('sec'),
        heading: 'Anschreiben',
        content: `${kanzlei}\n${anwalt}\n\n${today()}\n\nSehr geehrte/r ${mandant},\n\nnachfolgend informiere ich Sie über den aktuellen Stand Ihrer Angelegenheit.`,
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Sachstand',
        content: input.sachverhalt ?? 'Der aktuelle Sachstand stellt sich wie folgt dar:\n\n[Sachstand in verständlicher Sprache einfügen]',
        citationIds: [],
      },
    ];

    if (findingsSummary) {
      sections.push({
        id: createId('sec'),
        heading: 'Wichtige Erkenntnisse',
        content: `Bei der Prüfung Ihrer Unterlagen haben sich folgende Punkte ergeben:\n\n${findingsSummary}`,
        citationIds: [],
      });
    }

    sections.push(
      {
        id: createId('sec'),
        heading: 'Empfehlung',
        content: 'Nach meiner Einschätzung empfehle ich folgendes Vorgehen:\n\n1. [Empfehlung 1]\n2. [Empfehlung 2]\n\nBitte teilen Sie mir mit, ob Sie mit dem vorgeschlagenen Vorgehen einverstanden sind.',
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Nächste Schritte & Fristen',
        content: '**Wichtige Fristen:**\n\n- [Frist 1: Datum + Handlung]\n- [Frist 2: Datum + Handlung]\n\nBitte melden Sie sich bis zum [Datum] bei mir.',
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Abschluss',
        content: `Mit freundlichen Grüßen\n\n${anwalt}\n${kanzlei}`,
        citationIds: [],
      }
    );

    const markdown = buildLetterhead(input.parties) + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n---\n\n');
    return {
      id: createId('gen-doc'),
      template: 'mandantenbrief',
      title: `Mandantenanschreiben — ${mandant}`,
      markdown,
      sections,
      citations: [],
      warnings: ['Mandantenbrief in verständlicher Sprache verfassen – Fachbegriffe erklären.'],
      generatedAt: now,
    };
  }

  private generateSachverhaltsdarstellung(input: DocumentGeneratorInput, now: string): GeneratedDocument {
    const sachverhalt = input.sachverhalt ?? buildSachverhaltFromDocs(input.documents ?? []);
    const findings = buildFindingsSummary(input.findings ?? []);

    const sections: GeneratedSection[] = [
      {
        id: createId('sec'),
        heading: 'Sachverhaltsdarstellung',
        content: sachverhalt,
        citationIds: [],
      },
    ];

    if (findings) {
      sections.push({
        id: createId('sec'),
        heading: 'Erkannte Rechtliche Punkte',
        content: findings,
        citationIds: [],
      });
    }

    const markdown = buildLetterhead(input.parties) + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n---\n\n');
    return {
      id: createId('gen-doc'),
      template: 'sachverhaltsdarstellung',
      title: 'Sachverhaltsdarstellung',
      markdown,
      sections,
      citations: buildCitationsFromFindings(input.findings ?? []),
      warnings: [],
      generatedAt: now,
    };
  }

  private generateGutachten(input: DocumentGeneratorInput, now: string): GeneratedDocument {
    const sachverhalt = input.sachverhalt ?? buildSachverhaltFromDocs(input.documents ?? []);

    const anspruchsText = input.anspruchsgrundlagen?.length
      ? input.anspruchsgrundlagen.map(chain => {
          const voraussetzungen = chain.anspruchsgrundlage.prerequisites
            .map((p, i) => `  ${i + 1}. ${p}: [Subsumtion]`)
            .join('\n');
          return `### ${chain.title}\n\n**Obersatz:** ${chain.anspruchsgrundlage.shortDescription}\n\n**Voraussetzungen:**\n${voraussetzungen}\n\n**Rechtsfolge:** ${chain.anspruchsgrundlage.legalConsequence}\n\n**Ergebnis:** [Subsumtionsergebnis]`;
        }).join('\n\n---\n\n')
      : '### [Anspruchsgrundlage einfügen]\n\n**Obersatz:** [Obersatz]\n\n**Voraussetzungen:**\n1. [Voraussetzung]: [Subsumtion]\n\n**Ergebnis:** [Ergebnis]';

    const sections: GeneratedSection[] = [
      { id: createId('sec'), heading: 'Sachverhalt', content: sachverhalt, citationIds: [] },
      { id: createId('sec'), heading: 'Rechtliche Prüfung', content: anspruchsText, citationIds: [] },
      { id: createId('sec'), heading: 'Gesamtergebnis', content: '[Gesamtergebnis der Prüfung]', citationIds: [] },
    ];

    const markdown = buildLetterhead(input.parties) + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n---\n\n');
    return {
      id: createId('gen-doc'),
      template: 'gutachten',
      title: 'Rechtsgutachten',
      markdown,
      sections,
      citations: buildNormCitations(input.anspruchsgrundlagen?.map(c => c.anspruchsgrundlage) ?? []),
      warnings: ['Gutachten-Stil: Obersatz → Definition → Subsumtion → Ergebnis beachten.'],
      generatedAt: now,
    };
  }

  private generateFristenuebersicht(input: DocumentGeneratorInput, now: string): GeneratedDocument {
    const caseFile = input.caseFile;
    const sections: GeneratedSection[] = [
      {
        id: createId('sec'),
        heading: 'Fristenübersicht',
        content: `**Akte:** ${caseFile?.title ?? '[Aktenbezeichnung]'}\n**Stand:** ${today()}\n\n| # | Frist | Datum | Status | Quelle |\n|---|-------|-------|--------|--------|\n| 1 | [Frist] | [Datum] | [offen/erledigt] | [Dokument] |\n| 2 | [Frist] | [Datum] | [offen/erledigt] | [Dokument] |\n\n> Fristen regelmäßig prüfen und im Fristenkalender eintragen.`,
        citationIds: [],
      },
    ];

    const markdown = buildLetterhead(input.parties) + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n');
    return {
      id: createId('gen-doc'),
      template: 'fristenuebersicht',
      title: 'Fristenübersicht',
      markdown,
      sections,
      citations: [],
      warnings: ['Fristen immer gegen Originaldokumente gegenprüfen.'],
      generatedAt: now,
    };
  }

  private generateVergleichsvorschlag(input: DocumentGeneratorInput, now: string): GeneratedDocument {
    const p = input.parties ?? {};
    const sections: GeneratedSection[] = [
      {
        id: createId('sec'),
        heading: 'Vergleichsvorschlag',
        content: `In der Sache **${p.klaeger ?? '[Kläger/in]'}** ./. **${p.beklagter ?? '[Beklagte/r]'}**\n\nAz.: ${p.aktenzeichen ?? '[Az.]'}\n\nwird folgender Vergleich vorgeschlagen:`,
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Vergleichsinhalt',
        content: '1. [Leistung Partei A]\n2. [Leistung Partei B]\n3. Die Kosten des Rechtsstreits und des Vergleichs werden gegeneinander aufgehoben.\n4. Damit ist der Rechtsstreit erledigt.',
        citationIds: [],
      },
    ];

    const markdown = buildLetterhead(input.parties) + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n---\n\n');
    return {
      id: createId('gen-doc'),
      template: 'vergleichsvorschlag',
      title: 'Vergleichsvorschlag',
      markdown,
      sections,
      citations: [],
      warnings: [],
      generatedAt: now,
    };
  }

  private generateMahnung(input: DocumentGeneratorInput, now: string): GeneratedDocument {
    const p = input.parties ?? {};
    const sections: GeneratedSection[] = [
      {
        id: createId('sec'),
        heading: 'Mahnung',
        content: `An: ${p.beklagter ?? '[Schuldner/in]'}\n\n${today()}\n\n**Mahnung**\n\nSehr geehrte Damen und Herren,\n\ntrotz Fälligkeit ist die Zahlung in Höhe von ${input.streitwert ? `${input.streitwert.toLocaleString('de-DE')} €` : '[Betrag]'} bisher nicht eingegangen.\n\nWir fordern Sie auf, den ausstehenden Betrag bis zum [Datum] auf das Konto [Kontodaten] zu überweisen.\n\nNach fruchtlosem Ablauf der Frist werden wir ohne weitere Ankündigung gerichtliche Schritte einleiten.\n\nMit freundlichen Grüßen\n${p.anwalt ?? '[Absender]'}`,
        citationIds: [],
      },
    ];

    const markdown = buildLetterhead(input.parties) + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n');
    return {
      id: createId('gen-doc'),
      template: 'mahnung',
      title: 'Mahnung',
      markdown,
      sections,
      citations: [],
      warnings: ['Verzugszinsen prüfen (§ 288 BGB): 5% über Basiszinssatz / 9% bei Handelssachen.'],
      generatedAt: now,
    };
  }

  private generateAbmahnung(input: DocumentGeneratorInput, now: string): GeneratedDocument {
    const p = input.parties ?? {};
    const sections: GeneratedSection[] = [
      {
        id: createId('sec'),
        heading: 'Abmahnung',
        content: `An: ${p.beklagter ?? '[Adressat]'}\n\n${today()}\n\n**Abmahnung**\n\nSehr geehrte/r [Name],\n\nhiermit mahnen wir im Namen unseres Mandanten/unserer Mandantin folgendes Verhalten ab:\n\n[Pflichtverletzung beschreiben]\n\nWir fordern Sie auf, die beschriebene Pflichtverletzung unverzüglich zu unterlassen und innerhalb von [Frist] die beigefügte Unterlassungserklärung abzugeben.\n\nSollte die Frist fruchtlos verstreichen, behalten wir uns die Einleitung gerichtlicher Schritte vor.`,
        citationIds: [],
      },
    ];

    const markdown = buildLetterhead(input.parties) + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n');
    return {
      id: createId('gen-doc'),
      template: 'abmahnung',
      title: 'Abmahnung',
      markdown,
      sections,
      citations: [],
      warnings: [],
      generatedAt: now,
    };
  }

  private generateKuendigung(input: DocumentGeneratorInput, now: string): GeneratedDocument {
    const p = input.parties ?? {};
    const sections: GeneratedSection[] = [
      {
        id: createId('sec'),
        heading: 'Kündigung',
        content: `An: ${p.beklagter ?? '[Adressat]'}\n\n${today()}\n\n**Kündigung**\n\nSehr geehrte Damen und Herren,\n\nhiermit kündigen wir das zwischen uns bestehende [Vertragsverhältnis] vom [Datum]\n\n☐ ordentlich zum nächstmöglichen Termin\n☐ außerordentlich fristlos aus wichtigem Grund\n\n**Begründung (bei fristloser Kündigung):**\n[Kündigungsgrund nach § 626 BGB / § 543 BGB]\n\nBitte bestätigen Sie den Erhalt dieses Schreibens und den Beendigungszeitpunkt.\n\nMit freundlichen Grüßen\n${p.anwalt ?? '[Absender]'}`,
        citationIds: [],
      },
    ];

    const markdown = buildLetterhead(input.parties) + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n');
    return {
      id: createId('gen-doc'),
      template: 'kuendigung',
      title: 'Kündigung',
      markdown,
      sections,
      citations: [],
      warnings: [
        'Schriftformerfordernis beachten (§ 623 BGB bei Arbeitsverhältnissen, § 568 BGB bei Mietverhältnissen).',
        'Kündigungsfristen prüfen (§ 622 BGB, § 573c BGB).',
        'Zugang der Kündigung sicherstellen (Zustellungsnachweis).',
      ],
      generatedAt: now,
    };
  }

  private generateMietminderungsanzeige(input: DocumentGeneratorInput, now: string): GeneratedDocument {
    const p = input.parties ?? {};
    const sections: GeneratedSection[] = [
      {
        id: createId('sec'),
        heading: 'Mängelanzeige und Mietminderung',
        content: `An: ${p.beklagter ?? '[Vermieter/in]'}\n\n${today()}\n\nBetrifft: Mietobjekt [Adresse], Mietvertrag vom [Datum]\n\n**Mängelanzeige gemäß § 536c BGB**\n\nSehr geehrte/r [Name],\n\nhiermit zeige ich Ihnen folgenden Mangel der Mietsache an:\n\n**Mangelbeschreibung:**\n[Mangel detailliert beschreiben]\n\n**Seit wann besteht der Mangel:**\n[Datum]\n\n**Mietminderung gemäß § 536 BGB:**\nAufgrund des erheblichen Mangels mindere ich die Miete ab [Datum] um [X]%. Dies entspricht einem Betrag von [Betrag] €.\n\nIch fordere Sie auf, den Mangel bis zum [Frist] zu beseitigen.\n\nMit freundlichen Grüßen\n${p.mandant ?? p.klaeger ?? '[Mieter/in]'}`,
        citationIds: [],
      },
    ];

    const markdown = buildLetterhead(input.parties) + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n');
    return {
      id: createId('gen-doc'),
      template: 'mietminderungsanzeige',
      title: 'Mängelanzeige & Mietminderung',
      markdown,
      sections,
      citations: [],
      warnings: [
        'Mängelanzeige ist Obliegenheit (§ 536c BGB) – ohne Anzeige ggf. Verlust des Minderungsrechts.',
        'Minderungsquote anhand gängiger Tabellen (z.B. Hamburger Tabelle) prüfen.',
        'Mangel dokumentieren (Fotos, Zeugen).',
      ],
      generatedAt: now,
    };
  }

  private generateRechtsschutzanfrageSchriftsatz(input: DocumentGeneratorInput, now: string): GeneratedDocument {
    const p = input.parties ?? {};
    const versicherer = p.beklagter ?? '[Rechtsschutzversicherung]';
    const versicherungsnehmer = p.klaeger ?? p.mandant ?? '[Versicherungsnehmer/in]';
    const az = p.aktenzeichen ?? '[Kanzlei-Aktenzeichen]';
    const schadenNr = input.customFields?.schadenNummer ?? '[Schadennummer]';
    const versNr = input.customFields?.versicherungsnummer ?? '[Versicherungsschein-Nr.]';
    const schadensdatum = input.customFields?.schadensdatum ?? '[Schadensdatum]';

    const sections: GeneratedSection[] = [
      {
        id: createId('sec'),
        heading: 'Deckungsanfrage',
        content: `An\n${versicherer}\n\nBetreff: Deckungsanfrage Rechtsschutz — Az. ${az}\n\nVersicherungsnehmer/in: ${versicherungsnehmer}\nVersicherungsschein-Nr.: ${versNr}\nSchadennummer: ${schadenNr}\nSchadensdatum: ${schadensdatum}`,
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Sachverhalt',
        content: input.sachverhalt ?? buildSachverhaltFromDocs(input.documents ?? []),
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Rechtliche Einordnung',
        content: 'Die Angelegenheit fällt nach vorläufiger Prüfung in den versicherten Lebensbereich. Wir bitten um Bestätigung des Versicherungsschutzes und Kostenübernahme gemäß den vereinbarten ARB.',
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Antrag',
        content: 'Wir beantragen die Erteilung der Deckungszusage für die außergerichtliche und erforderlichenfalls gerichtliche Wahrnehmung der rechtlichen Interessen unseres Mandanten/unserer Mandantin.',
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Anlagen',
        content: '- Vollmacht\n- relevante Unterlagen / Korrespondenz\n- ggf. Anspruchsbegründung',
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Schlussformel',
        content: `Wir bitten um kurzfristige schriftliche Rückmeldung.\n\nMit freundlichen Grüßen\n${p.anwalt ?? '[Rechtsanwalt/Rechtsanwältin]'}\n${p.kanzlei ?? '[Kanzlei]'}`,
        citationIds: [],
      },
    ];

    const warnings: string[] = [];
    if (!p.beklagter) warnings.push('Rechtsschutzversicherung nicht gesetzt – Adressat ergänzen.');
    if (!input.customFields?.versicherungsnummer) warnings.push('Versicherungsschein-Nr. fehlt – vor Versand ergänzen.');

    return {
      id: createId('gen-doc'),
      template: 'rechtsschutzanfrage_schriftsatz',
      title: `Deckungsanfrage — ${versicherungsnehmer}`,
      markdown: buildLetterhead(input.parties) + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n---\n\n'),
      sections,
      citations: [],
      warnings,
      generatedAt: now,
    };
  }

  private generateDeckungszusageErinnerungSchriftsatz(input: DocumentGeneratorInput, now: string): GeneratedDocument {
    const p = input.parties ?? {};
    const versicherer = p.beklagter ?? '[Rechtsschutzversicherung]';
    const versicherungsnehmer = p.klaeger ?? p.mandant ?? '[Versicherungsnehmer/in]';
    const az = p.aktenzeichen ?? '[Kanzlei-Aktenzeichen]';
    const schadenNr = input.customFields?.schadenNummer ?? '[Schadennummer]';
    const versNr = input.customFields?.versicherungsnummer ?? '[Versicherungsschein-Nr.]';

    const sections: GeneratedSection[] = [
      {
        id: createId('sec'),
        heading: 'Erinnerung zur Deckungszusage',
        content: `An\n${versicherer}\n\nBetreff: Erinnerung Deckungszusage — Az. ${az}\n\nVersicherungsnehmer/in: ${versicherungsnehmer}\nVersicherungsschein-Nr.: ${versNr}\nSchadennummer: ${schadenNr}`,
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Bezugnahme',
        content: 'Wir nehmen Bezug auf unsere Deckungsanfrage und bitten um zeitnahe Entscheidung. Bisher liegt uns keine finale Deckungszusage vor.',
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Dringlichkeit',
        content: 'Die Angelegenheit ist fristgebunden. Zur Wahrung der Rechte unseres Mandanten/unserer Mandantin ist eine kurzfristige Rückmeldung erforderlich.',
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Fristsetzung',
        content: `Wir bitten um schriftliche Deckungsentscheidung bis spätestens ${input.customFields?.antwortfrist ?? '[Datum]'}.\n\nHilfsweise bitten wir um Mitteilung, welche weiteren Unterlagen Sie zur Entscheidung benötigen.`,
        citationIds: [],
      },
      {
        id: createId('sec'),
        heading: 'Schlussformel',
        content: `Mit freundlichen Grüßen\n${p.anwalt ?? '[Rechtsanwalt/Rechtsanwältin]'}\n${p.kanzlei ?? '[Kanzlei]'}`,
        citationIds: [],
      },
    ];

    const warnings: string[] = [];
    if (!p.beklagter) warnings.push('Rechtsschutzversicherung nicht gesetzt – Adressat ergänzen.');
    if (!input.customFields?.antwortfrist) warnings.push('Antwortfrist fehlt – verbindliches Datum setzen.');

    return {
      id: createId('gen-doc'),
      template: 'deckungszusage_erinnerung_schriftsatz',
      title: `Erinnerung Deckungszusage — ${versicherungsnehmer}`,
      markdown: buildLetterhead(input.parties) + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n---\n\n'),
      sections,
      citations: [],
      warnings,
      generatedAt: now,
    };
  }

  private generateGeneric(input: DocumentGeneratorInput, now: string): GeneratedDocument {
    const sections: GeneratedSection[] = [
      {
        id: createId('sec'),
        heading: 'Dokument',
        content: input.sachverhalt ?? buildSachverhaltFromDocs(input.documents ?? []),
        citationIds: [],
      },
    ];

    const markdown = buildLetterhead(input.parties) + sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n');
    return {
      id: createId('gen-doc'),
      template: input.template,
      title: `Generiertes Dokument (${input.template})`,
      markdown,
      sections,
      citations: [],
      warnings: [],
      generatedAt: now,
    };
  }

  listTemplates(): Array<{ id: DocumentTemplate; label: string; description: string }> {
    return [
      { id: 'klageschrift', label: 'Klageschrift', description: 'ZPO-konforme Klageschrift mit Rubrum, Anträgen, Sachverhalt und rechtlicher Würdigung.' },
      { id: 'klageerwiderung', label: 'Klageerwiderung', description: 'Erwiderung auf eine Klageschrift mit Klageabweisungsantrag.' },
      { id: 'widerspruch', label: 'Widerspruch', description: 'Widerspruch gegen einen Verwaltungsakt (VwGO).' },
      { id: 'berufungsschrift', label: 'Berufungsschrift', description: 'Berufung gegen erstinstanzliches Urteil (§§ 511 ff. ZPO).' },
      { id: 'mandantenbrief', label: 'Mandantenbrief', description: 'Anschreiben an Mandanten in verständlicher Sprache.' },
      { id: 'sachverhaltsdarstellung', label: 'Sachverhaltsdarstellung', description: 'Strukturierte Sachverhaltsdarstellung aus Dokumenten.' },
      { id: 'gutachten', label: 'Gutachten', description: 'Gutachten-Stil Analyse (Obersatz → Definition → Subsumtion → Ergebnis).' },
      { id: 'fristenuebersicht', label: 'Fristenübersicht', description: 'Zusammenstellung aller relevanten Fristen.' },
      { id: 'vergleichsvorschlag', label: 'Vergleichsvorschlag', description: 'Vorschlag zur gütlichen Einigung.' },
      { id: 'mahnung', label: 'Mahnung', description: 'Zahlungsmahnung mit Fristsetzung.' },
      { id: 'abmahnung', label: 'Abmahnung', description: 'Abmahnung bei Pflichtverletzung mit Unterlassungsaufforderung.' },
      { id: 'kuendigung', label: 'Kündigung', description: 'Ordentliche oder außerordentliche Kündigung.' },
      { id: 'mietminderungsanzeige', label: 'Mietminderungsanzeige', description: 'Mängelanzeige und Mietminderung nach § 536 BGB.' },
      { id: 'rechtsschutzanfrage_schriftsatz', label: 'Rechtsschutzanfrage', description: 'Formalisierte Deckungsanfrage an die Rechtsschutzversicherung.' },
      { id: 'deckungszusage_erinnerung_schriftsatz', label: 'Erinnerung Deckungszusage', description: 'Nachfassschreiben bei ausstehender Deckungsentscheidung.' },
    ];
  }
}
