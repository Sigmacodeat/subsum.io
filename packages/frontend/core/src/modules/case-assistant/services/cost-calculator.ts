import { Service } from '@toeverything/infra';

/**
 * Kostenrisiko-Kalkulator für deutsche Gerichtsverfahren
 *
 * Berechnet:
 * - Gerichtskosten nach GKG (Gerichtskostengesetz)
 * - Anwaltsgebühren nach RVG (Rechtsanwaltsvergütungsgesetz)
 * - Prozesskostenrisiko bei Obsiegen/Unterliegen
 * - PKH-Prüfung (Prozesskostenhilfe)
 * - Vergleichswert-Berechnung
 * - Kostenverteilung bei Teilobsiegen
 */

export type Gerichtsinstanz =
  | 'amtsgericht'
  | 'landgericht'
  | 'oberlandesgericht'
  | 'bundesgerichtshof'
  | 'arbeitsgericht'
  | 'verwaltungsgericht'
  | 'sozialgericht'
  | 'finanzgericht';

export type Verfahrensart =
  | 'klageverfahren'
  | 'mahnverfahren'
  | 'eilverfahren'
  | 'berufung'
  | 'revision'
  | 'beschwerde';

export interface KostenInput {
  streitwert: number;
  instanz: Gerichtsinstanz;
  verfahrensart: Verfahrensart;
  anzahlTermine?: number;
  beweisaufnahme?: boolean;
  sachverstaendiger?: boolean;
  parteienAnzahl?: number;
  obsiegensquoteInProzent?: number;
}

export interface GebuehrenTabelle {
  bisStreitwert: number;
  einfacheGebuehr: number;
}

export interface AnwaltsgebuerenResult {
  verfahrensgebuehr: number;
  termingebuehr: number;
  einigungsgebuehr: number;
  auslagenpauschale: number;
  umsatzsteuer: number;
  gesamt: number;
  gebuehrenDetails: string[];
}

export interface GerichtskostenResult {
  einfacheGebuehr: number;
  gebuehrensatz: number;
  gerichtskosten: number;
  details: string[];
}

export interface KostenrisikoResult {
  streitwert: number;
  instanz: string;
  verfahrensart: string;

  eigeneAnwaltskosten: AnwaltsgebuerenResult;
  gegnerAnwaltskosten: AnwaltsgebuerenResult;
  gerichtskosten: GerichtskostenResult;

  gesamtkostenBeiVerlust: number;
  gesamtkostenBeiObsiegen: number;
  gesamtkostenBeiTeilobsiegen: number;
  obsiegensquote: number;

  sachverstaendigerKosten: number;
  reisekostenSchaetzung: number;

  gesamtrisiko: number;
  risikoklasse: 'niedrig' | 'mittel' | 'hoch' | 'sehr_hoch';

  pkhHinweis: string;
  empfehlung: string;
  warnungen: string[];

  berechnetAm: string;
}

export interface VergleichswertResult {
  streitwert: number;
  vergleichswert: number;
  eigeneKostenBeiVergleich: number;
  eigeneKostenBeiProzess: number;
  ersparnisDurchVergleich: number;
  empfehlung: string;
}

// RVG Gebührentabelle (vereinfacht, gültig ab 2021 mit Anpassungen)
const GEBUEHRENTABELLE: GebuehrenTabelle[] = [
  { bisStreitwert: 500, einfacheGebuehr: 49 },
  { bisStreitwert: 1000, einfacheGebuehr: 88 },
  { bisStreitwert: 1500, einfacheGebuehr: 127 },
  { bisStreitwert: 2000, einfacheGebuehr: 166 },
  { bisStreitwert: 3000, einfacheGebuehr: 222 },
  { bisStreitwert: 4000, einfacheGebuehr: 278 },
  { bisStreitwert: 5000, einfacheGebuehr: 334 },
  { bisStreitwert: 6000, einfacheGebuehr: 390 },
  { bisStreitwert: 7000, einfacheGebuehr: 446 },
  { bisStreitwert: 8000, einfacheGebuehr: 502 },
  { bisStreitwert: 9000, einfacheGebuehr: 558 },
  { bisStreitwert: 10000, einfacheGebuehr: 614 },
  { bisStreitwert: 13000, einfacheGebuehr: 666 },
  { bisStreitwert: 16000, einfacheGebuehr: 718 },
  { bisStreitwert: 19000, einfacheGebuehr: 770 },
  { bisStreitwert: 22000, einfacheGebuehr: 822 },
  { bisStreitwert: 25000, einfacheGebuehr: 874 },
  { bisStreitwert: 30000, einfacheGebuehr: 955 },
  { bisStreitwert: 35000, einfacheGebuehr: 1036 },
  { bisStreitwert: 40000, einfacheGebuehr: 1117 },
  { bisStreitwert: 45000, einfacheGebuehr: 1198 },
  { bisStreitwert: 50000, einfacheGebuehr: 1279 },
  { bisStreitwert: 65000, einfacheGebuehr: 1373 },
  { bisStreitwert: 80000, einfacheGebuehr: 1467 },
  { bisStreitwert: 95000, einfacheGebuehr: 1561 },
  { bisStreitwert: 110000, einfacheGebuehr: 1655 },
  { bisStreitwert: 125000, einfacheGebuehr: 1749 },
  { bisStreitwert: 140000, einfacheGebuehr: 1843 },
  { bisStreitwert: 155000, einfacheGebuehr: 1937 },
  { bisStreitwert: 170000, einfacheGebuehr: 2031 },
  { bisStreitwert: 185000, einfacheGebuehr: 2125 },
  { bisStreitwert: 200000, einfacheGebuehr: 2219 },
  { bisStreitwert: 230000, einfacheGebuehr: 2351 },
  { bisStreitwert: 260000, einfacheGebuehr: 2483 },
  { bisStreitwert: 290000, einfacheGebuehr: 2615 },
  { bisStreitwert: 320000, einfacheGebuehr: 2747 },
  { bisStreitwert: 350000, einfacheGebuehr: 2879 },
  { bisStreitwert: 380000, einfacheGebuehr: 3011 },
  { bisStreitwert: 410000, einfacheGebuehr: 3143 },
  { bisStreitwert: 440000, einfacheGebuehr: 3275 },
  { bisStreitwert: 470000, einfacheGebuehr: 3407 },
  { bisStreitwert: 500000, einfacheGebuehr: 3539 },
];

function getEinfacheGebuehr(streitwert: number): number {
  for (const entry of GEBUEHRENTABELLE) {
    if (streitwert <= entry.bisStreitwert) {
      return entry.einfacheGebuehr;
    }
  }
  // Über 500.000: letzte Stufe + 175 je angefangene 50.000
  const last = GEBUEHRENTABELLE[GEBUEHRENTABELLE.length - 1];
  const excess = streitwert - last.bisStreitwert;
  const additionalSteps = Math.ceil(excess / 50000);
  return last.einfacheGebuehr + additionalSteps * 175;
}

const MWST_SATZ = 0.19;
const AUSLAGENPAUSCHALE_MAX = 20;

export class CostCalculatorService extends Service {
  berechneAnwaltsgebuehren(input: {
    streitwert: number;
    verfahrensart: Verfahrensart;
    mitEinigung?: boolean;
    anzahlTermine?: number;
  }): AnwaltsgebuerenResult {
    const einfach = getEinfacheGebuehr(input.streitwert);
    const details: string[] = [];

    // Verfahrensgebühr (1,3-fach im Klageverfahren, 0,65-fach im Mahnverfahren)
    let vgFaktor = 1.3;
    if (input.verfahrensart === 'mahnverfahren') vgFaktor = 0.65;
    if (input.verfahrensart === 'eilverfahren') vgFaktor = 1.3;
    if (input.verfahrensart === 'berufung') vgFaktor = 1.6;
    if (input.verfahrensart === 'revision') vgFaktor = 1.6;

    const verfahrensgebuehr = Math.round(einfach * vgFaktor * 100) / 100;
    details.push(`Verfahrensgebühr: ${vgFaktor}×${einfach} = ${verfahrensgebuehr} €`);

    // Terminsgebühr (1,2-fach)
    let tgFaktor = 1.2;
    if (input.verfahrensart === 'mahnverfahren') tgFaktor = 0;
    if (input.verfahrensart === 'berufung') tgFaktor = 1.2;
    if (input.verfahrensart === 'revision') tgFaktor = 1.2;

    const termingebuehr = Math.round(einfach * tgFaktor * 100) / 100;
    if (tgFaktor > 0) {
      details.push(`Terminsgebühr: ${tgFaktor}×${einfach} = ${termingebuehr} €`);
    }

    // Einigungsgebühr (1,0-fach bei Vergleich, 1,5-fach bei außergerichtl. Einigung)
    let einigungsgebuehr = 0;
    if (input.mitEinigung) {
      const egFaktor = 1.0;
      einigungsgebuehr = Math.round(einfach * egFaktor * 100) / 100;
      details.push(`Einigungsgebühr: ${egFaktor}×${einfach} = ${einigungsgebuehr} €`);
    }

    // Auslagenpauschale
    const netto = verfahrensgebuehr + termingebuehr + einigungsgebuehr;
    const auslagenpauschale = Math.min(AUSLAGENPAUSCHALE_MAX, Math.round(netto * 0.2 * 100) / 100);
    details.push(`Auslagenpauschale: ${auslagenpauschale} €`);

    const zwischensumme = netto + auslagenpauschale;
    const umsatzsteuer = Math.round(zwischensumme * MWST_SATZ * 100) / 100;
    details.push(`USt. ${MWST_SATZ * 100}%: ${umsatzsteuer} €`);

    const gesamt = Math.round((zwischensumme + umsatzsteuer) * 100) / 100;
    details.push(`Gesamt (brutto): ${gesamt} €`);

    return {
      verfahrensgebuehr,
      termingebuehr,
      einigungsgebuehr,
      auslagenpauschale,
      umsatzsteuer,
      gesamt,
      gebuehrenDetails: details,
    };
  }

  berechneGerichtskosten(input: {
    streitwert: number;
    verfahrensart: Verfahrensart;
    instanz: Gerichtsinstanz;
  }): GerichtskostenResult {
    const einfach = getEinfacheGebuehr(input.streitwert);
    const details: string[] = [];

    // GKG Gebührensätze
    let satz = 3.0; // Standard Klageverfahren 1. Instanz
    if (input.verfahrensart === 'mahnverfahren') satz = 0.5;
    if (input.verfahrensart === 'eilverfahren') satz = 1.5;
    if (input.verfahrensart === 'berufung') satz = 4.0;
    if (input.verfahrensart === 'revision') satz = 5.0;

    if (input.instanz === 'arbeitsgericht' && input.verfahrensart === 'klageverfahren') {
      satz = 2.0; // Arbeitsgericht 1. Instanz nur 2-fach
    }
    if (input.instanz === 'verwaltungsgericht') {
      satz = 3.0;
    }

    const kosten = Math.round(einfach * satz * 100) / 100;
    details.push(`Einfache Gebühr: ${einfach} €`);
    details.push(`Gebührensatz: ${satz}-fach`);
    details.push(`Gerichtskosten: ${satz}×${einfach} = ${kosten} €`);

    return {
      einfacheGebuehr: einfach,
      gebuehrensatz: satz,
      gerichtskosten: kosten,
      details,
    };
  }

  berechneKostenrisiko(input: KostenInput): KostenrisikoResult {
    const now = new Date().toISOString();
    const obsiegensquote = input.obsiegensquoteInProzent ?? 50;

    const eigeneAnwaltskosten = this.berechneAnwaltsgebuehren({
      streitwert: input.streitwert,
      verfahrensart: input.verfahrensart,
    });

    const gegnerAnwaltskosten = this.berechneAnwaltsgebuehren({
      streitwert: input.streitwert,
      verfahrensart: input.verfahrensart,
    });

    const gerichtskosten = this.berechneGerichtskosten({
      streitwert: input.streitwert,
      verfahrensart: input.verfahrensart,
      instanz: input.instanz,
    });

    // Sachverständigenkosten (Schätzung)
    let sachverstaendigerKosten = 0;
    if (input.sachverstaendiger) {
      sachverstaendigerKosten = Math.max(1500, input.streitwert * 0.03);
      sachverstaendigerKosten = Math.min(sachverstaendigerKosten, 15000);
      sachverstaendigerKosten = Math.round(sachverstaendigerKosten * 100) / 100;
    }

    const reisekostenSchaetzung = (input.anzahlTermine ?? 1) * 120;

    // Bei vollem Verlust: eigene + gegner + Gericht + SV
    const gesamtkostenBeiVerlust = Math.round(
      (eigeneAnwaltskosten.gesamt +
        gegnerAnwaltskosten.gesamt +
        gerichtskosten.gerichtskosten +
        sachverstaendigerKosten +
        reisekostenSchaetzung) * 100
    ) / 100;

    // Bei vollem Obsiegen: nur eigene Anwaltskosten (Erstattung der erstattungsfähigen Kosten)
    const gesamtkostenBeiObsiegen = Math.round(eigeneAnwaltskosten.gesamt * 0.1 * 100) / 100;

    // Bei Teilobsiegen
    const anteilVerlust = (100 - obsiegensquote) / 100;
    const anteilObsiegen = obsiegensquote / 100;
    const gesamtkostenBeiTeilobsiegen = Math.round(
      (eigeneAnwaltskosten.gesamt +
        gegnerAnwaltskosten.gesamt * anteilVerlust +
        gerichtskosten.gerichtskosten * anteilVerlust +
        sachverstaendigerKosten * anteilVerlust +
        reisekostenSchaetzung) * 100
    ) / 100;

    // Gewichtetes Gesamtrisiko
    const gesamtrisiko = Math.round(
      (gesamtkostenBeiVerlust * (1 - anteilObsiegen) +
        gesamtkostenBeiObsiegen * anteilObsiegen) * 100
    ) / 100;

    // Risikoklasse
    let risikoklasse: 'niedrig' | 'mittel' | 'hoch' | 'sehr_hoch' = 'niedrig';
    if (gesamtrisiko > 50000) risikoklasse = 'sehr_hoch';
    else if (gesamtrisiko > 15000) risikoklasse = 'hoch';
    else if (gesamtrisiko > 5000) risikoklasse = 'mittel';

    // PKH-Hinweis
    let pkhHinweis =
      'Prozesskostenhilfe (PKH) nach §§ 114 ff. ZPO kann beantragt werden, wenn die Partei die Kosten nicht aufbringen kann und die Rechtsverfolgung hinreichende Aussicht auf Erfolg hat.';
    if (obsiegensquote < 30) {
      pkhHinweis +=
        ' Warnung: Bei geringer Erfolgsaussicht (<30%) wird PKH typischerweise abgelehnt.';
    }

    // Empfehlung
    let empfehlung = '';
    if (risikoklasse === 'sehr_hoch') {
      empfehlung =
        'Sehr hohes Kostenrisiko. Außergerichtliche Einigung oder Vergleich dringend empfohlen. Rechtsschutzversicherung prüfen.';
    } else if (risikoklasse === 'hoch') {
      empfehlung =
        'Hohes Kostenrisiko. Vergleichsverhandlungen sollten ernsthaft erwogen werden. Kostendeckung klären.';
    } else if (risikoklasse === 'mittel') {
      empfehlung =
        'Moderates Kostenrisiko. Prozessführung vertretbar bei guter Erfolgsaussicht. Vergleich als Option offenhalten.';
    } else {
      empfehlung =
        'Geringes Kostenrisiko. Prozessführung wirtschaftlich vertretbar.';
    }

    const warnungen: string[] = [];
    if (input.streitwert > 5000 && input.instanz === 'amtsgericht') {
      warnungen.push('Streitwert über 5.000 €: Sachliche Zuständigkeit des Landgerichts prüfen (§ 23 Nr. 1 GVG).');
    }
    if (input.verfahrensart === 'berufung' && obsiegensquote < 40) {
      warnungen.push('Berufung bei geringer Erfolgsaussicht birgt erhöhtes Kostenrisiko.');
    }
    if (sachverstaendigerKosten > 0) {
      warnungen.push(`Sachverständigenkosten geschätzt: ${sachverstaendigerKosten.toFixed(2)} € (kann stark variieren).`);
    }
    if (input.instanz === 'arbeitsgericht' && input.verfahrensart === 'klageverfahren') {
      warnungen.push('Arbeitsgerichtsverfahren 1. Instanz: Jede Partei trägt ihre eigenen Anwaltskosten (§ 12a ArbGG).');
    }

    const instanzLabel: Record<Gerichtsinstanz, string> = {
      amtsgericht: 'Amtsgericht',
      landgericht: 'Landgericht',
      oberlandesgericht: 'Oberlandesgericht',
      bundesgerichtshof: 'Bundesgerichtshof',
      arbeitsgericht: 'Arbeitsgericht',
      verwaltungsgericht: 'Verwaltungsgericht',
      sozialgericht: 'Sozialgericht',
      finanzgericht: 'Finanzgericht',
    };

    const verfahrensartLabel: Record<Verfahrensart, string> = {
      klageverfahren: 'Klageverfahren',
      mahnverfahren: 'Mahnverfahren',
      eilverfahren: 'Eilverfahren',
      berufung: 'Berufung',
      revision: 'Revision',
      beschwerde: 'Beschwerde',
    };

    return {
      streitwert: input.streitwert,
      instanz: instanzLabel[input.instanz],
      verfahrensart: verfahrensartLabel[input.verfahrensart],
      eigeneAnwaltskosten,
      gegnerAnwaltskosten,
      gerichtskosten,
      gesamtkostenBeiVerlust,
      gesamtkostenBeiObsiegen,
      gesamtkostenBeiTeilobsiegen,
      obsiegensquote,
      sachverstaendigerKosten,
      reisekostenSchaetzung,
      gesamtrisiko,
      risikoklasse,
      pkhHinweis,
      empfehlung,
      warnungen,
      berechnetAm: now,
    };
  }

  berechneVergleichswert(input: {
    streitwert: number;
    verfahrensart: Verfahrensart;
    instanz: Gerichtsinstanz;
    vergleichsquoteInProzent: number;
  }): VergleichswertResult {
    const vergleichswert = Math.round(
      input.streitwert * (input.vergleichsquoteInProzent / 100) * 100
    ) / 100;

    const kostenBeiVergleich = this.berechneAnwaltsgebuehren({
      streitwert: input.streitwert,
      verfahrensart: input.verfahrensart,
      mitEinigung: true,
    });

    const kostenBeiProzess = this.berechneKostenrisiko({
      streitwert: input.streitwert,
      instanz: input.instanz,
      verfahrensart: input.verfahrensart,
      obsiegensquoteInProzent: 50,
    });

    const eigeneKostenBeiVergleich = kostenBeiVergleich.gesamt;
    const eigeneKostenBeiProzess = kostenBeiProzess.gesamtrisiko;
    const ersparnis = Math.round((eigeneKostenBeiProzess - eigeneKostenBeiVergleich) * 100) / 100;

    let empfehlung = '';
    if (ersparnis > 2000) {
      empfehlung = `Vergleich spart voraussichtlich ${ersparnis.toFixed(2)} € gegenüber Prozessführung. Vergleich empfohlen.`;
    } else if (ersparnis > 0) {
      empfehlung = `Geringe Ersparnis durch Vergleich (${ersparnis.toFixed(2)} €). Abwägung zwischen wirtschaftlichem und inhaltlichem Interesse.`;
    } else {
      empfehlung = `Prozessführung ist kostenmäßig gleichwertig oder günstiger. Inhaltliches Interesse prüfen.`;
    }

    return {
      streitwert: input.streitwert,
      vergleichswert,
      eigeneKostenBeiVergleich,
      eigeneKostenBeiProzess,
      ersparnisDurchVergleich: ersparnis,
      empfehlung,
    };
  }
}
