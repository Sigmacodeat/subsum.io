import { expect, test } from 'vitest';

import {
  detectProcedureType,
  extractActorProfiles,
  extractActorNames,
  extractDeadlineDates,
  toIsoDate,
} from '../services/ingestion-utils';

test('toIsoDate parses dd.mm.yyyy', () => {
  expect(toIsoDate('19.02.2026')).toBe('2026-02-19T09:00:00.000Z');
});

test('extractDeadlineDates finds legal deadline formats', () => {
  const content =
    'Die Frist am 19.02.2026 ist einzuhalten. 20.02.2026 ist Frist für Stellungnahme.';

  const deadlines = extractDeadlineDates(content);

  expect(deadlines).toContain('2026-02-19T09:00:00.000Z');
  expect(deadlines).toContain('2026-02-20T09:00:00.000Z');
});

test('extractActorNames finds named participants', () => {
  const content =
    'Herr Max Mustermann sprach mit Frau Anna Beispiel. RA Peter Kläger wurde benannt.';

  const actors = extractActorNames(content);

  expect(actors).toContain('Herr Max Mustermann');
  expect(actors).toContain('Frau Anna Beispiel');
  expect(actors).toContain('RA Peter Kläger');
});

test('extractActorProfiles extracts roles, contacts, representation and demands', () => {
  const content = `
    Richterin Dr. Petra Sommer verhandelte am Landesgericht Wien.
    Staatsanwalt Markus Klein stellte Antrag.
    Opfer Maria Beispiel, vertreten durch RA Max Verteidiger, fordert Schadensersatz EUR 12.500.
    Privatbeteiligte Anna Nebenklägerin, Kanzlei Muster & Partner GmbH, Tel: +43 664 1234567, E-Mail: anna@example.com
    Anschrift: Hauptstraße 10, 1010 Wien
  `;

  const profiles = extractActorProfiles(content);

  const judge = profiles.find(p => p.name.includes('Dr. Petra Sommer'));
  const prosecutor = profiles.find(p => p.name.includes('Markus Klein'));
  const victim = profiles.find(p => p.name.includes('Maria Beispiel'));
  const privatePlaintiff = profiles.find(p => p.name.includes('Anna Nebenklägerin'));
  const lawFirm = profiles.find(p => p.name.includes('Kanzlei Muster & Partner GmbH'));

  expect(judge?.role).toBe('judge');
  expect(prosecutor?.role).toBe('prosecutor');
  expect(victim?.role).toBe('victim');
  expect(privatePlaintiff?.role).toBe('private_plaintiff');
  expect(lawFirm?.role).toBe('organization');

  expect(victim?.representedBy).toContain('RA Max Verteidiger');
  expect(victim?.demands?.join(' ')).toContain('Schadensersatz');
  expect(victim?.claimAmounts).toContain('EUR 12.500');

  expect(privatePlaintiff?.phones).toContain('+436641234567');
  expect(privatePlaintiff?.emails).toContain('anna@example.com');
  expect(privatePlaintiff?.addresses?.some(a => a.includes('Hauptstraße 10'))).toBe(true);
});

test('detectProcedureType classifies criminal context', () => {
  const content =
    'Anklageschrift nach StPO. Staatsanwältin beantragt. Opfer ist als Privatbeteiligte angeschlossen.';
  expect(detectProcedureType(content)).toBe('criminal');
});

test('extractActorProfiles resolves Kläger as private_plaintiff in criminal context', () => {
  const content = 'Der Kläger Hans Beispiel tritt als Nebenkläger auf. Strafverfahren nach StGB.';
  const profiles = extractActorProfiles(content, { procedureType: 'criminal' });
  const actor = profiles.find(p => p.name.includes('Hans Beispiel'));
  expect(actor?.role).toBe('private_plaintiff');
});

test('extractActorProfiles applies source weight to confidence', () => {
  const content = 'Richterin Dr. Petra Sommer entschied im Verfahren.';

  const low = extractActorProfiles(content, { sourceWeight: 0.6 }).find(p => p.name.includes('Petra Sommer'));
  const high = extractActorProfiles(content, { sourceWeight: 1.25 }).find(p => p.name.includes('Petra Sommer'));

  expect(low).toBeTruthy();
  expect(high).toBeTruthy();
  expect((high?.confidence ?? 0) > (low?.confidence ?? 0)).toBe(true);
});
