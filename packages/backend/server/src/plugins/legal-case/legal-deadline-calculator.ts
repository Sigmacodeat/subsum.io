import { Injectable } from '@nestjs/common';

interface DeadlineRule {
  label: string;
  daysFromTrigger: number;
  legalBasis: string;
  excludeWeekends: boolean;
  excludeHolidays: boolean;
}

const GERMAN_HOLIDAYS_2025_2027: Record<string, string[]> = {
  DE: [
    '2025-01-01',
    '2025-04-18',
    '2025-04-21',
    '2025-05-01',
    '2025-05-29',
    '2025-06-09',
    '2025-10-03',
    '2025-12-25',
    '2025-12-26',
    '2026-01-01',
    '2026-04-03',
    '2026-04-06',
    '2026-05-01',
    '2026-05-14',
    '2026-05-25',
    '2026-10-03',
    '2026-12-25',
    '2026-12-26',
    '2027-01-01',
    '2027-03-26',
    '2027-03-29',
    '2027-05-01',
    '2027-05-06',
    '2027-05-17',
    '2027-10-03',
    '2027-12-25',
    '2027-12-26',
  ],
  AT: [
    '2025-01-01',
    '2025-01-06',
    '2025-04-21',
    '2025-05-01',
    '2025-05-29',
    '2025-06-09',
    '2025-06-19',
    '2025-08-15',
    '2025-10-26',
    '2025-11-01',
    '2025-12-08',
    '2025-12-25',
    '2025-12-26',
    '2026-01-01',
    '2026-01-06',
    '2026-04-06',
    '2026-05-01',
    '2026-05-14',
    '2026-05-25',
    '2026-06-04',
    '2026-08-15',
    '2026-10-26',
    '2026-11-01',
    '2026-12-08',
    '2026-12-25',
    '2026-12-26',
    '2027-01-01',
    '2027-01-06',
    '2027-03-29',
    '2027-05-01',
    '2027-05-06',
    '2027-05-17',
    '2027-05-27',
    '2027-08-15',
    '2027-10-26',
    '2027-11-01',
    '2027-12-08',
    '2027-12-25',
    '2027-12-26',
  ],
};

const DEADLINE_RULES: Record<string, DeadlineRule[]> = {
  berufung_zpo: [
    {
      label: 'Berufungsfrist',
      daysFromTrigger: 30,
      legalBasis: '§ 517 ZPO (1 Monat)',
      excludeWeekends: false,
      excludeHolidays: false,
    },
    {
      label: 'Berufungsbegründungsfrist',
      daysFromTrigger: 60,
      legalBasis: '§ 520 Abs. 2 ZPO (2 Monate)',
      excludeWeekends: false,
      excludeHolidays: false,
    },
  ],
  revision_zpo: [
    {
      label: 'Revisionsfrist',
      daysFromTrigger: 30,
      legalBasis: '§ 548 ZPO (1 Monat)',
      excludeWeekends: false,
      excludeHolidays: false,
    },
    {
      label: 'Revisionsbegründungsfrist',
      daysFromTrigger: 60,
      legalBasis: '§ 551 Abs. 2 ZPO (2 Monate)',
      excludeWeekends: false,
      excludeHolidays: false,
    },
  ],
  widerspruch_mahnbescheid: [
    {
      label: 'Widerspruchsfrist Mahnbescheid',
      daysFromTrigger: 14,
      legalBasis: '§ 694 ZPO (2 Wochen)',
      excludeWeekends: false,
      excludeHolidays: false,
    },
  ],
  einspruch_versaeumnisurteil: [
    {
      label: 'Einspruchsfrist Versäumnisurteil',
      daysFromTrigger: 14,
      legalBasis: '§ 339 Abs. 1 ZPO (2 Wochen)',
      excludeWeekends: false,
      excludeHolidays: false,
    },
  ],
  klageerwiderung: [
    {
      label: 'Klageerwiderungsfrist (Standard)',
      daysFromTrigger: 14,
      legalBasis: '§ 276 Abs. 1 ZPO (2 Wochen Notfrist)',
      excludeWeekends: false,
      excludeHolidays: false,
    },
  ],
  beschwerde_stpo: [
    {
      label: 'Beschwerdefrist',
      daysFromTrigger: 7,
      legalBasis: '§ 311 Abs. 2 StPO (1 Woche)',
      excludeWeekends: false,
      excludeHolidays: false,
    },
  ],
  berufung_stpo: [
    {
      label: 'Berufungsfrist Strafrecht',
      daysFromTrigger: 7,
      legalBasis: '§ 314 StPO (1 Woche)',
      excludeWeekends: false,
      excludeHolidays: false,
    },
  ],
  widerspruch_verwaltungsakt: [
    {
      label: 'Widerspruchsfrist Verwaltungsakt',
      daysFromTrigger: 30,
      legalBasis: '§ 70 VwGO (1 Monat)',
      excludeWeekends: false,
      excludeHolidays: false,
    },
  ],
  klage_vwgo: [
    {
      label: 'Klagefrist VwGO',
      daysFromTrigger: 30,
      legalBasis: '§ 74 VwGO (1 Monat)',
      excludeWeekends: false,
      excludeHolidays: false,
    },
  ],
  kuendigungsschutzklage: [
    {
      label: 'Kündigungsschutzklage',
      daysFromTrigger: 21,
      legalBasis: '§ 4 KSchG (3 Wochen)',
      excludeWeekends: false,
      excludeHolidays: false,
    },
  ],
  berufung_ogh_at: [
    {
      label: 'Berufungsfrist Österreich',
      daysFromTrigger: 28,
      legalBasis: '§ 464 Abs. 1 öZPO (4 Wochen)',
      excludeWeekends: false,
      excludeHolidays: false,
    },
  ],
  revision_ogh_at: [
    {
      label: 'Revisionsfrist Österreich',
      daysFromTrigger: 28,
      legalBasis: '§ 505 Abs. 2 öZPO (4 Wochen)',
      excludeWeekends: false,
      excludeHolidays: false,
    },
  ],
};

@Injectable()
export class LegalDeadlineCalculator {
  calculate(params: {
    jurisdiction: string;
    triggerDate: string;
    deadlineType: string;
  }) {
    const rules = DEADLINE_RULES[params.deadlineType];
    if (!rules) {
      return {
        ok: false,
        error: `Unbekannter Fristtyp: ${params.deadlineType}`,
        availableTypes: Object.keys(DEADLINE_RULES),
      };
    }

    const jurisdiction = params.jurisdiction?.toUpperCase() || 'DE';
    const holidays = new Set(
      GERMAN_HOLIDAYS_2025_2027[jurisdiction] ?? GERMAN_HOLIDAYS_2025_2027['DE']
    );
    const triggerDate = new Date(params.triggerDate);

    if (isNaN(triggerDate.getTime())) {
      return { ok: false, error: 'Ungültiges Auslösedatum.' };
    }

    const results = rules.map(rule => {
      let targetDate = new Date(triggerDate);
      targetDate.setDate(targetDate.getDate() + rule.daysFromTrigger);

      // If deadline falls on weekend or holiday, push to next business day (§ 222 ZPO)
      targetDate = this.adjustForNonBusinessDay(targetDate, holidays);

      return {
        label: rule.label,
        legalBasis: rule.legalBasis,
        triggerDate: params.triggerDate,
        daysFromTrigger: rule.daysFromTrigger,
        calculatedDate: targetDate.toISOString().slice(0, 10),
        calculatedDateIso: targetDate.toISOString(),
        adjustedForWeekendOrHoliday:
          targetDate.getTime() !==
          new Date(
            new Date(triggerDate).setDate(
              triggerDate.getDate() + rule.daysFromTrigger
            )
          ).getTime(),
      };
    });

    return {
      ok: true,
      jurisdiction,
      deadlineType: params.deadlineType,
      triggerDate: params.triggerDate,
      deadlines: results,
    };
  }

  getAvailableTypes() {
    return Object.entries(DEADLINE_RULES).map(([key, rules]) => ({
      type: key,
      label: rules[0]?.label ?? key,
      deadlineCount: rules.length,
    }));
  }

  private adjustForNonBusinessDay(date: Date, holidays: Set<string>): Date {
    const result = new Date(date);
    let maxIterations = 10;
    while (maxIterations-- > 0) {
      const dayOfWeek = result.getDay();
      const dateStr = result.toISOString().slice(0, 10);
      if (dayOfWeek === 0 || dayOfWeek === 6 || holidays.has(dateStr)) {
        result.setDate(result.getDate() + 1);
      } else {
        break;
      }
    }
    return result;
  }
}
