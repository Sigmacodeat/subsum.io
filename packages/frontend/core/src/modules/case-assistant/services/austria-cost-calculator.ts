import { Service } from '@toeverything/infra';

import type {
  ATAnwaltsgebuerenResult,
  ATGerichtskostenResult,
  ATGerichtsinstanz,
  ATKostenInput,
  ATKostenrisikoResult,
  ATVerfahrensart,
} from '../types';

const MWST_SATZ = 0.2;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertValidStreitwert(streitwert: number): void {
  if (!Number.isFinite(streitwert) || streitwert <= 0) {
    throw new Error('Ungültiger Streitwert. Erwartet wird ein positiver Zahlenwert.');
  }
}

function normalizeTermine(anzahlTermine?: number): number {
  if (anzahlTermine === undefined) return 0;
  if (!Number.isFinite(anzahlTermine) || anzahlTermine < 0) {
    throw new Error('Ungültige Terminanzahl. Erwartet wird 0 oder eine positive Zahl.');
  }
  return Math.floor(anzahlTermine);
}

const AT_GEBUEHRENTABELLE = [
  { bisStreitwert: 150, gebuehr: 43.85 },
  { bisStreitwert: 300, gebuehr: 65.77 },
  { bisStreitwert: 500, gebuehr: 98.66 },
  { bisStreitwert: 750, gebuehr: 131.54 },
  { bisStreitwert: 1000, gebuehr: 164.43 },
  { bisStreitwert: 1500, gebuehr: 230.20 },
  { bisStreitwert: 2000, gebuehr: 295.98 },
  { bisStreitwert: 2500, gebuehr: 361.75 },
  { bisStreitwert: 3000, gebuehr: 427.53 },
  { bisStreitwert: 4000, gebuehr: 527.08 },
  { bisStreitwert: 5000, gebuehr: 626.63 },
  { bisStreitwert: 6000, gebuehr: 726.18 },
  { bisStreitwert: 7000, gebuehr: 825.73 },
  { bisStreitwert: 8000, gebuehr: 925.28 },
  { bisStreitwert: 9000, gebuehr: 1024.83 },
  { bisStreitwert: 10000, gebuehr: 1124.38 },
  { bisStreitwert: 13000, gebuehr: 1298.06 },
  { bisStreitwert: 16000, gebuehr: 1471.74 },
  { bisStreitwert: 19000, gebuehr: 1645.42 },
  { bisStreitwert: 22000, gebuehr: 1819.10 },
  { bisStreitwert: 25000, gebuehr: 1992.78 },
  { bisStreitwert: 30000, gebuehr: 2240.59 },
  { bisStreitwert: 35000, gebuehr: 2488.40 },
  { bisStreitwert: 40000, gebuehr: 2736.21 },
  { bisStreitwert: 45000, gebuehr: 2984.02 },
  { bisStreitwert: 50000, gebuehr: 3231.83 },
  { bisStreitwert: 65000, gebuehr: 3588.53 },
  { bisStreitwert: 80000, gebuehr: 3945.23 },
  { bisStreitwert: 95000, gebuehr: 4301.93 },
  { bisStreitwert: 110000, gebuehr: 4658.63 },
  { bisStreitwert: 125000, gebuehr: 5015.33 },
  { bisStreitwert: 140000, gebuehr: 5372.03 },
  { bisStreitwert: 155000, gebuehr: 5728.73 },
  { bisStreitwert: 170000, gebuehr: 6085.43 },
  { bisStreitwert: 185000, gebuehr: 6442.13 },
  { bisStreitwert: 200000, gebuehr: 6798.83 },
  { bisStreitwert: 230000, gebuehr: 7239.66 },
  { bisStreitwert: 260000, gebuehr: 7680.49 },
  { bisStreitwert: 290000, gebuehr: 8121.32 },
  { bisStreitwert: 320000, gebuehr: 8562.15 },
  { bisStreitwert: 350000, gebuehr: 9002.98 },
  { bisStreitwert: 380000, gebuehr: 9443.81 },
  { bisStreitwert: 410000, gebuehr: 9884.64 },
  { bisStreitwert: 440000, gebuehr: 10325.47 },
  { bisStreitwert: 470000, gebuehr: 10766.30 },
  { bisStreitwert: 500000, gebuehr: 11207.13 },
];

function getATGrundgebuehr(streitwert: number): number {
  assertValidStreitwert(streitwert);
  for (const entry of AT_GEBUEHRENTABELLE) {
    if (streitwert <= entry.bisStreitwert) {
      return entry.gebuehr;
    }
  }
  const last = AT_GEBUEHRENTABELLE[AT_GEBUEHRENTABELLE.length - 1];
  const excess = streitwert - last.bisStreitwert;
  const additionalSteps = Math.ceil(excess / 50000);
  return last.gebuehr + additionalSteps * 350;
}

export class AustriaCostCalculatorService extends Service {
  berechneAnwaltsgebuehren(input: {
    streitwert: number;
    verfahrensart: ATVerfahrensart;
    anzahlTermine?: number;
    mitEinigung?: boolean;
  }): ATAnwaltsgebuerenResult {
    assertValidStreitwert(input.streitwert);
    const anzahlTermine = normalizeTermine(input.anzahlTermine);
    const grundgebuehr = getATGrundgebuehr(input.streitwert);
    const details: string[] = [];

    let verfahrensFaktor = 1.0;
    if (input.verfahrensart === 'mahnverfahren') verfahrensFaktor = 0.5;
    if (input.verfahrensart === 'eilverfahren') verfahrensFaktor = 1.0;
    if (input.verfahrensart === 'beschwerde') verfahrensFaktor = 1.2;
    if (input.verfahrensart === 'rekurs') verfahrensFaktor = 1.3;
    if (input.verfahrensart === 'revision') verfahrensFaktor = 1.5;

    const berechneteGrundgebuehr = round2(grundgebuehr * verfahrensFaktor);
    details.push(`Grundgebühr: ${verfahrensFaktor}×${grundgebuehr.toFixed(2)} = ${berechneteGrundgebuehr.toFixed(2)} €`);

    const schreibgebuehr = round2(berechneteGrundgebuehr * 0.1);
    details.push(`Schreibgebühr (10%): ${schreibgebuehr.toFixed(2)} €`);

    const postengebuehr = round2(berechneteGrundgebuehr * 0.15);
    details.push(`Postengebühr (15%): ${postengebuehr.toFixed(2)} €`);

    let einigungsgebihr = 0;
    if (input.mitEinigung) {
      einigungsgebihr = round2(berechneteGrundgebuehr * 0.5);
      details.push(`Einigungsgebühr (50%): ${einigungsgebihr.toFixed(2)} €`);
    }

    let reisegebuehr = 0;
    if (anzahlTermine > 0) {
      reisegebuehr = round2(anzahlTermine * 50);
      details.push(`Reisegebühr: ${reisegebuehr.toFixed(2)} €`);
    }

    const netto = berechneteGrundgebuehr + schreibgebuehr + postengebuehr + einigungsgebihr + reisegebuehr;
    const auslagen = round2(netto * 0.1);
    details.push(`Auslagen (10%): ${auslagen.toFixed(2)} €`);

    const zwischensumme = netto + auslagen;
    const ust = round2(zwischensumme * MWST_SATZ);
    details.push(`USt. ${MWST_SATZ * 100}%: ${ust.toFixed(2)} €`);

    const gesamt = round2(zwischensumme + ust);
    details.push(`Gesamt (brutto): ${gesamt.toFixed(2)} €`);

    return {
      grundgebuehr: berechneteGrundgebuehr,
      schreibgebuehr,
      postengebuehr,
      einigungsgebihr,
      reisegebuehr,
      auslagen,
      ust,
      gesamt,
      details,
    };
  }

  berechneGerichtskosten(input: {
    streitwert: number;
    verfahrensart: ATVerfahrensart;
    instanz: ATGerichtsinstanz;
  }): ATGerichtskostenResult {
    assertValidStreitwert(input.streitwert);
    const grundgebuehr = getATGrundgebuehr(input.streitwert);
    const details: string[] = [];

    let satz = 1.0;
    if (input.verfahrensart === 'mahnverfahren') satz = 0.5;
    if (input.verfahrensart === 'eilverfahren') satz = 0.75;
    if (input.verfahrensart === 'beschwerde') satz = 1.0;
    if (input.verfahrensart === 'rekurs') satz = 1.5;
    if (input.verfahrensart === 'revision') satz = 2.0;

    if (input.instanz === 'oberster_gerichtshof' || input.instanz === 'verfassungsgerichtshof') {
      satz = Math.max(satz, 2.0);
    }

    const gerichtsgebihr = round2(grundgebuehr * satz);
    details.push(`Grundgebühr: ${grundgebuehr.toFixed(2)} €`);
    details.push(`Gebührensatz: ${satz}-fach`);
    details.push(`Gerichtsgebühr: ${satz}×${grundgebuehr.toFixed(2)} = ${gerichtsgebihr.toFixed(2)} €`);

    const manipulationsgebuehr = round2(gerichtsgebihr * 0.02);
    details.push(`Manipulationsgebühr (2%): ${manipulationsgebuehr.toFixed(2)} €`);

    const gesamt = round2(gerichtsgebihr + manipulationsgebuehr);
    details.push(`Gesamt: ${gesamt.toFixed(2)} €`);

    return {
      streitwert: input.streitwert,
      gebuehrensatz: satz,
      gerichtsgebihr,
      manipulationsgebuehr,
      gesamt,
      details,
    };
  }

  berechneKostenrisiko(input: ATKostenInput): ATKostenrisikoResult {
    assertValidStreitwert(input.streitwert);
    const now = new Date().toISOString();

    const eigeneAnwaltskosten = this.berechneAnwaltsgebuehren({
      streitwert: input.streitwert,
      verfahrensart: input.verfahrensart,
      anzahlTermine: input.anzahlTermine,
    });

    const gerichtskosten = this.berechneGerichtskosten({
      streitwert: input.streitwert,
      verfahrensart: input.verfahrensart,
      instanz: input.instanz,
    });

    const gesamtkostenBeiVerlust = round2(eigeneAnwaltskosten.gesamt + gerichtskosten.gesamt);

    const gesamtkostenBeiObsiegen = round2(eigeneAnwaltskosten.gesamt * 0.1);

    const gesamtrisiko = round2(gesamtkostenBeiVerlust * 0.5 + gesamtkostenBeiObsiegen * 0.5);

    let risikoklasse: 'niedrig' | 'mittel' | 'hoch' | 'sehr_hoch' = 'niedrig';
    if (gesamtrisiko > 50000) risikoklasse = 'sehr_hoch';
    else if (gesamtrisiko > 15000) risikoklasse = 'hoch';
    else if (gesamtrisiko > 5000) risikoklasse = 'mittel';

    let empfehlung = '';
    if (risikoklasse === 'sehr_hoch') {
      empfehlung = 'Sehr hohes Kostenrisiko. Außergerichtliche Einigung oder Vergleich dringend empfohlen.';
    } else if (risikoklasse === 'hoch') {
      empfehlung = 'Hohes Kostenrisiko. Vergleichsverhandlungen sollten ernsthaft erwogen werden.';
    } else if (risikoklasse === 'mittel') {
      empfehlung = 'Moderates Kostenrisiko. Prozessführung vertretbar bei guter Erfolgsaussicht.';
    } else {
      empfehlung = 'Geringes Kostenrisiko. Prozessführung wirtschaftlich vertretbar.';
    }

    const warnungen: string[] = [];
    if (input.streitwert > 5000 && input.instanz === 'bezirksgericht') {
      warnungen.push('Streitwert über 5.000 €: Sachliche Zuständigkeit des Landesgerichts prüfen.');
    }
    if (input.verfahrensart === 'rekurs' || input.verfahrensart === 'revision') {
      warnungen.push('Rekurs/Revision erfordert Zulassung. Prozesskostenrisiko erhöht.');
    }

    const instanzLabel: Record<ATGerichtsinstanz, string> = {
      bezirksgericht: 'Bezirksgericht',
      landesgericht: 'Landesgericht',
      oberlandesgericht: 'Oberlandesgericht',
      oberster_gerichtshof: 'Oberster Gerichtshof',
      verwaltungsgericht: 'Verwaltungsgericht',
      verfassungsgerichtshof: 'Verfassungsgerichtshof',
    };

    const verfahrensartLabel: Record<ATVerfahrensart, string> = {
      streitiges_verfahren: 'Streitiges Verfahren',
      mahnverfahren: 'Mahnverfahren',
      eilverfahren: 'Eilverfahren',
      beschwerde: 'Beschwerde',
      rekurs: 'Rekurs',
      revision: 'Revision',
    };

    return {
      streitwert: input.streitwert,
      instanz: instanzLabel[input.instanz],
      verfahrensart: verfahrensartLabel[input.verfahrensart],
      eigeneAnwaltskosten,
      gerichtskosten,
      gesamtkostenBeiVerlust,
      gesamtkostenBeiObsiegen,
      gesamtrisiko,
      risikoklasse,
      empfehlung,
      warnungen,
      berechnetAm: now,
    };
  }
}
