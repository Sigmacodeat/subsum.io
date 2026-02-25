// 🇪🇺 EU RECHTSFORMATE - LÄNDERSPEZIFISCHE KONFIGURATION

export interface EULegalFormat {
  countryCode: string;
  language: string;
  dateFormat: string;
  timeFormat: string;
  currency: string;
  numberFormat: {
    decimal: string;
    thousands: string;
  };
  weekStart: number; // 0 = Sunday, 1 = Monday
  workingDays: number[];
  holidays: string[];
  legalTerms: {
    deadline: string;
    appointment: string;
    case: string;
    client: string;
    evidence: string;
    court: string;
    judge: string;
    lawyer: string;
    contract: string;
    hearing: string;
  };
  urgencyLevels: {
    overdue: string;
    critical: string;
    today: string;
    soon: string;
    upcoming: string;
    future: string;
  };
}

export const EULegalFormats: Record<string, EULegalFormat> = {
  // 🇩🇪 DEUTSCHLAND
  de: {
    countryCode: 'DE',
    language: 'de',
    dateFormat: 'DD.MM.YYYY',
    timeFormat: '24h',
    currency: 'EUR',
    numberFormat: {
      decimal: ',',
      thousands: '.',
    },
    weekStart: 1,
    workingDays: [1, 2, 3, 4, 5],
    holidays: ['01-01', '04-18', '05-01', '10-03', '12-25', '12-26'],
    legalTerms: {
      deadline: 'Frist',
      appointment: 'Termin',
      case: 'Aktenzeichen',
      client: 'Mandant',
      evidence: 'Beweismittel',
      court: 'Gericht',
      judge: 'Richter',
      lawyer: 'Rechtsanwalt',
      contract: 'Vertrag',
      hearing: 'Verhandlung',
    },
    urgencyLevels: {
      overdue: 'Überfällig',
      critical: 'Kritisch (<48h)',
      today: 'Heute',
      soon: 'Bald (<7d)',
      upcoming: 'Anstehend (<30d)',
      future: 'Zukünftig',
    },
  },

  // 🇫🇷 FRANKREICH
  fr: {
    countryCode: 'FR',
    language: 'fr',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    currency: 'EUR',
    numberFormat: {
      decimal: ',',
      thousands: ' ',
    },
    weekStart: 1,
    workingDays: [1, 2, 3, 4, 5],
    holidays: [
      '01-01',
      '04-18',
      '05-01',
      '05-08',
      '07-14',
      '08-15',
      '11-01',
      '11-11',
      '12-25',
    ],
    legalTerms: {
      deadline: 'Échéance',
      appointment: 'Rendez-vous',
      case: 'Numéro de dossier',
      client: 'Client',
      evidence: 'Preuve',
      court: 'Tribunal',
      judge: 'Juge',
      lawyer: 'Avocat',
      contract: 'Contrat',
      hearing: 'Audience',
    },
    urgencyLevels: {
      overdue: 'En retard',
      critical: 'Critique (<48h)',
      today: "Aujourd'hui",
      soon: 'Bientôt (<7j)',
      upcoming: 'À venir (<30j)',
      future: 'Futur',
    },
  },

  // 🇪🇸 SPANIEN
  es: {
    countryCode: 'ES',
    language: 'es',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    currency: 'EUR',
    numberFormat: {
      decimal: ',',
      thousands: '.',
    },
    weekStart: 1,
    workingDays: [1, 2, 3, 4, 5],
    holidays: [
      '01-01',
      '04-18',
      '05-01',
      '08-15',
      '10-12',
      '11-01',
      '12-06',
      '12-25',
    ],
    legalTerms: {
      deadline: 'Plazo',
      appointment: 'Cita',
      case: 'Número de expediente',
      client: 'Cliente',
      evidence: 'Evidencia',
      court: 'Juzgado',
      judge: 'Juez',
      lawyer: 'Abogado',
      contract: 'Contrato',
      hearing: 'Audiencia',
    },
    urgencyLevels: {
      overdue: 'Vencido',
      critical: 'Crítico (<48h)',
      today: 'Hoy',
      soon: 'Pronto (<7d)',
      upcoming: 'Próximo (<30d)',
      future: 'Futuro',
    },
  },

  // 🇮🇹 ITALIEN
  it: {
    countryCode: 'IT',
    language: 'it',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    currency: 'EUR',
    numberFormat: {
      decimal: ',',
      thousands: '.',
    },
    weekStart: 1,
    workingDays: [1, 2, 3, 4, 5],
    holidays: [
      '01-01',
      '04-18',
      '04-25',
      '05-01',
      '06-02',
      '08-15',
      '11-01',
      '12-08',
      '12-25',
      '12-26',
    ],
    legalTerms: {
      deadline: 'Scadenza',
      appointment: 'Appuntamento',
      case: 'Numero di fascicolo',
      client: 'Cliente',
      evidence: 'Prova',
      court: 'Tribunale',
      judge: 'Giudice',
      lawyer: 'Avvocato',
      contract: 'Contratto',
      hearing: 'Udienza',
    },
    urgencyLevels: {
      overdue: 'Scaduto',
      critical: 'Critico (<48h)',
      today: 'Oggi',
      soon: 'Presto (<7g)',
      upcoming: 'Imminente (<30g)',
      future: 'Futuro',
    },
  },

  // 🇵🇱 POLEN
  pl: {
    countryCode: 'PL',
    language: 'pl',
    dateFormat: 'DD.MM.YYYY',
    timeFormat: '24h',
    currency: 'PLN',
    numberFormat: {
      decimal: ',',
      thousands: ' ',
    },
    weekStart: 1,
    workingDays: [1, 2, 3, 4, 5],
    holidays: [
      '01-01',
      '04-18',
      '05-01',
      '05-03',
      '08-15',
      '11-01',
      '11-11',
      '12-25',
      '12-26',
    ],
    legalTerms: {
      deadline: 'Termin',
      appointment: 'Spotkanie',
      case: 'Numer sprawy',
      client: 'Klient',
      evidence: 'Dowód',
      court: 'Sąd',
      judge: 'Sędzia',
      lawyer: 'Prawnik',
      contract: 'Umowa',
      hearing: 'Rozprawa',
    },
    urgencyLevels: {
      overdue: 'Po terminie',
      critical: 'Krytyczny (<48h)',
      today: 'Dziś',
      soon: 'Wkrótce (<7d)',
      upcoming: 'Nadchodzący (<30d)',
      future: 'Przyszły',
    },
  },

  // 🇳🇱 NIEDERLANDE
  nl: {
    countryCode: 'NL',
    language: 'nl',
    dateFormat: 'DD-MM-YYYY',
    timeFormat: '24h',
    currency: 'EUR',
    numberFormat: {
      decimal: ',',
      thousands: '.',
    },
    weekStart: 1,
    workingDays: [1, 2, 3, 4, 5],
    holidays: ['01-01', '04-18', '04-27', '05-01', '12-25', '12-26'],
    legalTerms: {
      deadline: 'Termijn',
      appointment: 'Afspraak',
      case: 'Zaaknummer',
      client: 'Cliënt',
      evidence: 'Bewijs',
      court: 'Rechtbank',
      judge: 'Rechter',
      lawyer: 'Advocaat',
      contract: 'Contract',
      hearing: 'Zitting',
    },
    urgencyLevels: {
      overdue: 'Verlopen',
      critical: 'Kritiek (<48u)',
      today: 'Vandaag',
      soon: 'Binnenkort (<7d)',
      upcoming: 'Aankomend (<30d)',
      future: 'Toekomstig',
    },
  },

  // 🇸🇪 SCHWEDEN
  'sv-SE': {
    countryCode: 'SE',
    language: 'sv',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h',
    currency: 'SEK',
    numberFormat: {
      decimal: ',',
      thousands: ' ',
    },
    weekStart: 1,
    workingDays: [1, 2, 3, 4, 5],
    holidays: ['01-01', '04-18', '05-01', '06-06', '12-25', '12-26'],
    legalTerms: {
      deadline: 'Tidsfrist',
      appointment: 'Möte',
      case: 'Ärendenummer',
      client: 'Klient',
      evidence: 'Bevis',
      court: 'Domstol',
      judge: 'Domare',
      lawyer: 'Advokat',
      contract: 'Avtal',
      hearing: 'Förhandling',
    },
    urgencyLevels: {
      overdue: 'Försenad',
      critical: 'Kritisk (<48t)',
      today: 'Idag',
      soon: 'Snart (<7d)',
      upcoming: 'Kommande (<30d)',
      future: 'Framtida',
    },
  },

  // 🇩🇰 DÄNEMARK
  da: {
    countryCode: 'DK',
    language: 'da',
    dateFormat: 'DD-MM-YYYY',
    timeFormat: '24h',
    currency: 'DKK',
    numberFormat: {
      decimal: ',',
      thousands: '.',
    },
    weekStart: 1,
    workingDays: [1, 2, 3, 4, 5],
    holidays: ['01-01', '04-18', '05-01', '06-05', '12-25', '12-26'],
    legalTerms: {
      deadline: 'Frist',
      appointment: 'Møde',
      case: 'Sagsnummer',
      client: 'Klient',
      evidence: 'Bevis',
      court: 'Retten',
      judge: 'Dommer',
      lawyer: 'Advokat',
      contract: 'Kontrakt',
      hearing: 'Retsmøde',
    },
    urgencyLevels: {
      overdue: 'Forfalden',
      critical: 'Kritisk (<48t)',
      today: 'I dag',
      soon: 'Snart (<7d)',
      upcoming: 'Kommende (<30d)',
      future: 'Fremtidig',
    },
  },
};

// FORMATIERUNGS-FUNKTIONEN
export function formatDateForEU(date: Date, lang: string): string {
  const format = EULegalFormats[lang];
  if (!format) return date.toISOString();

  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();

  return format.dateFormat
    .replace('DD', d)
    .replace('MM', m)
    .replace('YYYY', y.toString());
}

export function formatCurrencyForEU(amount: number, lang: string): string {
  const format = EULegalFormats[lang];
  if (!format) return amount.toString();

  const formatted = amount
    .toFixed(2)
    .replace('.', format.numberFormat.decimal)
    .replace(/\B(?=(\d{3})+(?!\d))/g, format.numberFormat.thousands);

  return `${formatted} ${format.currency}`;
}

export function formatNumberForEU(number: number, lang: string): string {
  const format = EULegalFormats[lang];
  if (!format) return number.toString();

  return number
    .toString()
    .replace('.', format.numberFormat.decimal)
    .replace(/\B(?=(\d{3})+(?!\d))/g, format.numberFormat.thousands);
}

export function isWorkingDayForEU(date: Date, lang: string): boolean {
  const format = EULegalFormats[lang];
  if (!format) return true;

  const dayOfWeek = date.getDay();
  const dayOfMonth =
    (date.getMonth() + 1).toString().padStart(2, '0') +
    '-' +
    date.getDate().toString().padStart(2, '0');

  return (
    format.workingDays.includes(dayOfWeek) &&
    !format.holidays.includes(dayOfMonth)
  );
}

export function getLegalTermForEU(
  term: keyof EULegalFormat['legalTerms'],
  lang: string
): string {
  const format = EULegalFormats[lang];
  if (!format) return term;

  return format.legalTerms[term] || term;
}

export function getUrgencyLabelForEU(
  urgency: keyof EULegalFormat['urgencyLevels'],
  lang: string
): string {
  const format = EULegalFormats[lang];
  if (!format) return urgency;

  return format.urgencyLevels[urgency] || urgency;
}

export default {
  EULegalFormats,
  formatDateForEU,
  formatCurrencyForEU,
  formatNumberForEU,
  isWorkingDayForEU,
  getLegalTermForEU,
  getUrgencyLabelForEU,
};
