import { Service } from '@toeverything/infra';

import type { CasePriority, LegalDocumentRecord } from '../types';

/**
 * Beweismittel-Register & Beweis-Würdigung Service
 *
 * Verwaltet alle Beweismittel einer Akte:
 * - Urkunden (§§ 415-444 ZPO)
 * - Zeugen (§§ 373-401 ZPO)
 * - Sachverständige (§§ 402-414 ZPO)
 * - Augenschein (§§ 371-372a ZPO)
 * - Parteivernehmung (§§ 445-455 ZPO)
 *
 * Ermöglicht:
 * - Beweiswürdigung mit Stärke-Einschätzung
 * - Beweislast-Zuordnung
 * - Beweisangebot-Generierung für Schriftsätze
 * - Lückenanalyse (fehlende Beweise)
 */

export type BeweismittelArt =
  | 'urkunde'
  | 'zeuge'
  | 'sachverstaendiger'
  | 'augenschein'
  | 'parteivernehmung'
  | 'elektronisch'
  | 'privaturkunde'
  | 'oeffentliche_urkunde';

export type BeweisThema =
  | 'haftung'
  | 'kausalitaet'
  | 'schaden'
  | 'verschulden'
  | 'vertrag'
  | 'mangel'
  | 'frist'
  | 'zugang'
  | 'eigentum'
  | 'besitz'
  | 'sonstig';

export type Beweisstaerke = 'stark' | 'mittel' | 'schwach' | 'unklar';

export type BeweislastTraeger = 'klaeger' | 'beklagter' | 'geteilt';

export interface Beweismittel {
  id: string;
  caseId: string;
  workspaceId: string;
  art: BeweismittelArt;
  bezeichnung: string;
  beschreibung: string;
  themen: BeweisThema[];
  staerke: Beweisstaerke;
  beweislast: BeweislastTraeger;
  quelleDocumentId?: string;
  quelleDocumentTitle?: string;
  anlagenNummer?: string;
  zeugeName?: string;
  zeugeAdresse?: string;
  zeugeBeweisthema?: string;
  sachverstaendigerFachgebiet?: string;
  notizen?: string;
  status: 'identifiziert' | 'gesichert' | 'vorgelegt' | 'bestritten' | 'verworfen';
  createdAt: string;
  updatedAt: string;
}

export interface BeweisLuecke {
  id: string;
  caseId: string;
  thema: BeweisThema;
  beschreibung: string;
  beweislast: BeweislastTraeger;
  empfohleneBeweismittelArt: BeweismittelArt[];
  prioritaet: CasePriority;
  handlungsempfehlung: string;
}

export interface BeweisRegisterSummary {
  caseId: string;
  workspaceId: string;
  totalBeweismittel: number;
  nachArt: Record<BeweismittelArt, number>;
  nachStaerke: Record<Beweisstaerke, number>;
  nachThema: Record<BeweisThema, number>;
  luecken: BeweisLuecke[];
  beweisangebotMarkdown: string;
  generatedAt: string;
}

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

const THEMA_KEYWORDS: Record<BeweisThema, string[]> = {
  haftung: ['haftung', 'haftet', 'verantwortlich', 'verschulden', 'pflichtverletzung', 'amtshaftung'],
  kausalitaet: ['kausalität', 'ursächlich', 'verursacht', 'folge', 'dadurch', 'infolge'],
  schaden: ['schaden', 'schadenersatz', 'kosten', 'verlust', 'aufwand', 'entgangener gewinn'],
  verschulden: ['vorsatz', 'fahrlässigkeit', 'verschulden', 'hätte erkennen', 'sorgfaltspflicht'],
  vertrag: ['vertrag', 'vereinbarung', 'klausel', 'angebot', 'annahme', 'vertragsschluss'],
  mangel: ['mangel', 'defekt', 'fehlerhaft', 'beschädigt', 'funktionsuntüchtig', 'mietminderung'],
  frist: ['frist', 'verjährung', 'termin', 'zustellung', 'eingang', 'ablauf'],
  zugang: ['zugang', 'zugestellt', 'erhalten', 'zugegangen', 'eingang', 'zustellungsnachweis'],
  eigentum: ['eigentum', 'eigentümer', 'erwerb', 'übereignung', 'grundbuch'],
  besitz: ['besitz', 'besitzer', 'herausgabe', 'räumung', 'übergabe'],
  sonstig: [],
};

function detectThemen(text: string): BeweisThema[] {
  const lower = text.toLowerCase();
  const detected: BeweisThema[] = [];

  for (const [thema, keywords] of Object.entries(THEMA_KEYWORDS)) {
    if (thema === 'sonstig') continue;
    if (keywords.some(kw => lower.includes(kw))) {
      detected.push(thema as BeweisThema);
    }
  }

  return detected.length > 0 ? detected : ['sonstig'];
}

function detectBeweismittelArt(text: string): BeweismittelArt {
  const lower = text.toLowerCase();
  if (/\b(zeug(?:e|in)|aussage|vernommen)\b/.test(lower)) return 'zeuge';
  if (/\b(sachverständig|gutachten)\b/.test(lower)) return 'sachverstaendiger';
  if (/\b(augenschein|besichtigung|ortsbegehung)\b/.test(lower)) return 'augenschein';
  if (/\b(parteivernehmung|parteianhörung)\b/.test(lower)) return 'parteivernehmung';
  if (/\b(e-mail|screenshot|digital|elektronisch)\b/.test(lower)) return 'elektronisch';
  if (/\b(notariell|amtlich|öffentlich.*urkunde|grundbuch)\b/.test(lower)) return 'oeffentliche_urkunde';
  if (/\b(schreiben|brief|vertrag|rechnung|quittung|urkunde|anlage)\b/.test(lower)) return 'urkunde';
  return 'privaturkunde';
}

function assessStaerke(art: BeweismittelArt, text: string): Beweisstaerke {
  if (art === 'oeffentliche_urkunde') return 'stark';
  if (art === 'sachverstaendiger') return 'stark';

  const lower = text.toLowerCase();
  if (/\b(beweis|nachweislich|urkundlich|notariell|amtlich)\b/.test(lower)) return 'stark';
  if (/\b(glaubhaft|plausibel|überzeugend|dokumentiert)\b/.test(lower)) return 'mittel';
  if (/\b(bestritten|unklar|zweifelhaft|unsicher|widersprüchlich)\b/.test(lower)) return 'schwach';

  if (art === 'zeuge') return 'mittel';
  if (art === 'elektronisch') return 'mittel';
  if (art === 'parteivernehmung') return 'schwach';

  return 'unklar';
}

function detectBeweislast(text: string): BeweislastTraeger {
  const lower = text.toLowerCase();
  if (/\b(kläger.*beweis|darlegungslast.*kläger|anspruchsteller)\b/.test(lower)) return 'klaeger';
  if (/\b(beklagter.*beweis|darlegungslast.*beklagter|exkulpation|entlastung)\b/.test(lower)) return 'beklagter';
  return 'geteilt';
}

const ART_LABELS: Record<BeweismittelArt, string> = {
  urkunde: 'Urkunde',
  zeuge: 'Zeugenbeweis',
  sachverstaendiger: 'Sachverständigenbeweis',
  augenschein: 'Augenschein',
  parteivernehmung: 'Parteivernehmung',
  elektronisch: 'Elektronischer Beweis',
  privaturkunde: 'Privaturkunde',
  oeffentliche_urkunde: 'Öffentliche Urkunde',
};

const THEMA_LABELS: Record<BeweisThema, string> = {
  haftung: 'Haftung',
  kausalitaet: 'Kausalität',
  schaden: 'Schaden/Schadenshöhe',
  verschulden: 'Verschulden',
  vertrag: 'Vertragsbeziehung',
  mangel: 'Mangel',
  frist: 'Frist/Zustellung',
  zugang: 'Zugang',
  eigentum: 'Eigentum',
  besitz: 'Besitz',
  sonstig: 'Sonstiges',
};

export class EvidenceRegisterService extends Service {
  private beweismittel: Beweismittel[] = [];

  getAll(caseId: string): Beweismittel[] {
    return this.beweismittel.filter(b => b.caseId === caseId);
  }

  getById(id: string): Beweismittel | null {
    return this.beweismittel.find(b => b.id === id) ?? null;
  }

  add(input: Omit<Beweismittel, 'id' | 'createdAt' | 'updatedAt'>): Beweismittel {
    const now = new Date().toISOString();
    const record: Beweismittel = {
      ...input,
      id: createId('beweis'),
      createdAt: now,
      updatedAt: now,
    };
    this.beweismittel.push(record);
    return record;
  }

  update(id: string, patch: Partial<Beweismittel>): Beweismittel | null {
    const idx = this.beweismittel.findIndex(b => b.id === id);
    if (idx < 0) return null;

    const updated: Beweismittel = {
      ...this.beweismittel[idx],
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };
    this.beweismittel[idx] = updated;
    return updated;
  }

  remove(id: string): boolean {
    const len = this.beweismittel.length;
    this.beweismittel = this.beweismittel.filter(b => b.id !== id);
    return this.beweismittel.length < len;
  }

  autoDetectFromDocuments(input: {
    caseId: string;
    workspaceId: string;
    documents: LegalDocumentRecord[];
  }): Beweismittel[] {
    const detected: Beweismittel[] = [];
    let anlagenNr = 1;

    for (const doc of input.documents) {
      const text = doc.normalizedText ?? doc.rawText;
      if (text.trim().length < 30) continue;

      const art = detectBeweismittelArt(text);
      const themen = detectThemen(text);
      const staerke = assessStaerke(art, text);
      const beweislast = detectBeweislast(text);

      const record = this.add({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        art,
        bezeichnung: doc.title,
        beschreibung: text.slice(0, 300).trim(),
        themen,
        staerke,
        beweislast,
        quelleDocumentId: doc.id,
        quelleDocumentTitle: doc.title,
        anlagenNummer: `K${anlagenNr}`,
        status: 'identifiziert',
      });

      detected.push(record);
      anlagenNr++;
    }

    return detected;
  }

  analyzeLuecken(caseId: string): BeweisLuecke[] {
    const caseBeweise = this.getAll(caseId);
    const luecken: BeweisLuecke[] = [];

    const coveredThemen = new Set<BeweisThema>();
    for (const b of caseBeweise) {
      for (const t of b.themen) {
        coveredThemen.add(t);
      }
    }

    const criticalThemen: Array<{ thema: BeweisThema; desc: string; empfohlen: BeweismittelArt[] }> = [
      { thema: 'haftung', desc: 'Für die Haftungsbegründung fehlen Beweismittel.', empfohlen: ['urkunde', 'zeuge'] },
      { thema: 'kausalitaet', desc: 'Die Kausalität zwischen Handlung und Schaden ist nicht belegt.', empfohlen: ['sachverstaendiger', 'zeuge'] },
      { thema: 'schaden', desc: 'Schadenshöhe und -nachweis fehlen.', empfohlen: ['urkunde', 'sachverstaendiger'] },
      { thema: 'verschulden', desc: 'Verschulden/Fahrlässigkeit ist nicht nachgewiesen.', empfohlen: ['zeuge', 'urkunde'] },
      { thema: 'zugang', desc: 'Zugangsnachweis für wichtige Erklärungen fehlt.', empfohlen: ['urkunde', 'zeuge'] },
    ];

    for (const ct of criticalThemen) {
      if (!coveredThemen.has(ct.thema)) {
        luecken.push({
          id: createId('luecke'),
          caseId,
          thema: ct.thema,
          beschreibung: ct.desc,
          beweislast: 'klaeger',
          empfohleneBeweismittelArt: ct.empfohlen,
          prioritaet: 'high',
          handlungsempfehlung: `${ct.desc} Empfohlen: ${ct.empfohlen.map(a => ART_LABELS[a]).join(', ')}.`,
        });
      }
    }

    const weakBeweise = caseBeweise.filter(b => b.staerke === 'schwach' || b.staerke === 'unklar');
    for (const wb of weakBeweise) {
      luecken.push({
        id: createId('luecke'),
        caseId,
        thema: wb.themen[0] ?? 'sonstig',
        beschreibung: `Beweismittel "${wb.bezeichnung}" hat geringe Beweisstärke (${wb.staerke}).`,
        beweislast: wb.beweislast,
        empfohleneBeweismittelArt: ['urkunde', 'sachverstaendiger'],
        prioritaet: 'medium',
        handlungsempfehlung: `Zusätzliche Beweismittel für "${wb.bezeichnung}" beschaffen oder Beweis stärken.`,
      });
    }

    return luecken.sort((a, b) => {
      const rank: Record<CasePriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      return rank[b.prioritaet] - rank[a.prioritaet];
    });
  }

  buildSummary(caseId: string, workspaceId: string): BeweisRegisterSummary {
    const caseBeweise = this.getAll(caseId);
    const luecken = this.analyzeLuecken(caseId);

    const nachArt: Record<BeweismittelArt, number> = {
      urkunde: 0, zeuge: 0, sachverstaendiger: 0, augenschein: 0,
      parteivernehmung: 0, elektronisch: 0, privaturkunde: 0, oeffentliche_urkunde: 0,
    };
    const nachStaerke: Record<Beweisstaerke, number> = { stark: 0, mittel: 0, schwach: 0, unklar: 0 };
    const nachThema: Record<BeweisThema, number> = {
      haftung: 0, kausalitaet: 0, schaden: 0, verschulden: 0, vertrag: 0,
      mangel: 0, frist: 0, zugang: 0, eigentum: 0, besitz: 0, sonstig: 0,
    };

    for (const b of caseBeweise) {
      nachArt[b.art]++;
      nachStaerke[b.staerke]++;
      for (const t of b.themen) {
        nachThema[t]++;
      }
    }

    // Generate Beweisangebot for Schriftsatz
    const urkundenBeweise = caseBeweise.filter(b =>
      b.art === 'urkunde' || b.art === 'privaturkunde' || b.art === 'oeffentliche_urkunde' || b.art === 'elektronisch'
    );
    const zeugenBeweise = caseBeweise.filter(b => b.art === 'zeuge');
    const svBeweise = caseBeweise.filter(b => b.art === 'sachverstaendiger');

    let beweisangebot = '### Beweisangebote\n\n';

    if (urkundenBeweise.length > 0) {
      beweisangebot += '**Urkundenbeweis:**\n\n';
      for (const b of urkundenBeweise) {
        beweisangebot += `- ${b.anlagenNummer ? `Anlage ${b.anlagenNummer}: ` : ''}${b.bezeichnung}`;
        if (b.themen.length > 0) {
          beweisangebot += ` (Beweis für: ${b.themen.map(t => THEMA_LABELS[t]).join(', ')})`;
        }
        beweisangebot += '\n';
      }
      beweisangebot += '\n';
    }

    if (zeugenBeweise.length > 0) {
      beweisangebot += '**Zeugenbeweis:**\n\n';
      for (const b of zeugenBeweise) {
        beweisangebot += `- Zeuge/Zeugin: ${b.zeugeName ?? b.bezeichnung}`;
        if (b.zeugeAdresse) beweisangebot += `, ${b.zeugeAdresse}`;
        if (b.zeugeBeweisthema) beweisangebot += `\n  Beweisthema: ${b.zeugeBeweisthema}`;
        beweisangebot += '\n';
      }
      beweisangebot += '\n';
    }

    if (svBeweise.length > 0) {
      beweisangebot += '**Sachverständigenbeweis:**\n\n';
      for (const b of svBeweise) {
        beweisangebot += `- Einholung eines Sachverständigengutachtens`;
        if (b.sachverstaendigerFachgebiet) beweisangebot += ` (Fachgebiet: ${b.sachverstaendigerFachgebiet})`;
        beweisangebot += `\n  Beweisthema: ${b.themen.map(t => THEMA_LABELS[t]).join(', ')}`;
        beweisangebot += '\n';
      }
      beweisangebot += '\n';
    }

    if (luecken.length > 0) {
      beweisangebot += '\n### Beweislücken (Handlungsbedarf)\n\n';
      for (const l of luecken.slice(0, 5)) {
        const badge = l.prioritaet === 'critical' ? '🔴' : l.prioritaet === 'high' ? '🟠' : '🟡';
        beweisangebot += `- ${badge} **${THEMA_LABELS[l.thema]}:** ${l.handlungsempfehlung}\n`;
      }
    }

    return {
      caseId,
      workspaceId,
      totalBeweismittel: caseBeweise.length,
      nachArt,
      nachStaerke,
      nachThema,
      luecken,
      beweisangebotMarkdown: beweisangebot,
      generatedAt: new Date().toISOString(),
    };
  }
}
