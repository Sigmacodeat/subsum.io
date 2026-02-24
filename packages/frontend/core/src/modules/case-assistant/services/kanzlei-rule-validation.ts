import { Service } from '@toeverything/infra';

import type { KanzleiProfile } from '../types';

export type KanzleiRuleViolation = {
  field: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
};

export type KanzleiValidationResult = {
  valid: boolean;
  violations: KanzleiRuleViolation[];
};

export type IntakeValidationInput = {
  title: string;
  kind: string;
  folderPath: string;
  internalFileNumber: string;
  paragraphReferences: string;
  tags: string;
  content: string;
};

const AKTENZEICHEN_SCHEMA_TO_REGEX: Record<string, RegExp> = {
  '{year}/{seq}': /^\d{4}\/\d{1,6}$/,
  '{client}/{seq}/{year}': /^[A-Za-zÄÖÜäöüß0-9_-]+\/\d{1,6}\/\d{4}$/,
  '{client}/{year}-{seq}': /^[A-Za-zÄÖÜäöüß0-9_-]+\/\d{4}-\d{1,6}$/,
  '{year}-{seq}': /^\d{4}-\d{1,6}$/,
  '{seq}/{year}': /^\d{1,6}\/\d{4}$/,
};

const DEFAULT_INTERNAL_FILE_NUMBER_REGEX = /^[A-Za-zÄÖÜäöüß0-9/_.\-\s]+$/;

const MANDATORY_FIELDS_BY_DOC_KIND: Record<string, Array<{ field: keyof IntakeValidationInput; label: string }>> = {
  'pdf': [
    { field: 'title', label: 'Titel' },
    { field: 'internalFileNumber', label: 'Internes Aktenzeichen' },
  ],
  'scan-pdf': [
    { field: 'title', label: 'Titel' },
    { field: 'internalFileNumber', label: 'Internes Aktenzeichen' },
    { field: 'folderPath', label: 'Ablageordner' },
  ],
  'docx': [
    { field: 'title', label: 'Titel' },
    { field: 'internalFileNumber', label: 'Internes Aktenzeichen' },
  ],
  'email': [
    { field: 'title', label: 'Titel / Betreff' },
  ],
  'note': [
    { field: 'title', label: 'Titel' },
    { field: 'content', label: 'Inhalt' },
  ],
  'other': [
    { field: 'title', label: 'Titel' },
  ],
};

export class KanzleiRuleValidationService extends Service {

  validateIntake(
    input: IntakeValidationInput,
    kanzleiProfile: KanzleiProfile | null
  ): KanzleiValidationResult {
    const violations: KanzleiRuleViolation[] = [];

    // ═══ 1. Pflichtfelder je Dokumenttyp ═══
    const mandatoryFields = MANDATORY_FIELDS_BY_DOC_KIND[input.kind] ?? MANDATORY_FIELDS_BY_DOC_KIND['other'];
    for (const { field, label } of mandatoryFields) {
      const value = input[field];
      if (!value || !value.trim()) {
        violations.push({
          field,
          rule: 'mandatory',
          message: `${label} ist ein Pflichtfeld für Dokumenttyp "${input.kind}".`,
          severity: 'error',
        });
      }
    }

    // ═══ 2. Aktenzeichen-Schema-Validierung ═══
    if (input.internalFileNumber.trim() && kanzleiProfile?.aktenzeichenSchema) {
      const schema = kanzleiProfile.aktenzeichenSchema.trim();
      const regex = AKTENZEICHEN_SCHEMA_TO_REGEX[schema];
      const fileNumber = input.internalFileNumber.trim();

      if (regex) {
        if (!regex.test(fileNumber)) {
          violations.push({
            field: 'internalFileNumber',
            rule: 'aktenzeichenSchema',
            message: `Internes Aktenzeichen "${fileNumber}" entspricht nicht dem Kanzlei-Schema "${schema}".`,
            severity: 'error',
          });
        }
      } else {
        // Custom schema: treat as partial regex hint
        if (!DEFAULT_INTERNAL_FILE_NUMBER_REGEX.test(fileNumber)) {
          violations.push({
            field: 'internalFileNumber',
            rule: 'aktenzeichenFormat',
            message: `Internes Aktenzeichen "${fileNumber}" enthält ungültige Zeichen.`,
            severity: 'error',
          });
        }
      }
    } else if (input.internalFileNumber.trim()) {
      // No schema configured, but still validate basic format
      if (!DEFAULT_INTERNAL_FILE_NUMBER_REGEX.test(input.internalFileNumber.trim())) {
        violations.push({
          field: 'internalFileNumber',
          rule: 'aktenzeichenFormat',
          message: `Internes Aktenzeichen enthält ungültige Zeichen.`,
          severity: 'error',
        });
      }
    }

    // ═══ 3. Paragraph-Referenzen Format ═══
    if (input.paragraphReferences.trim()) {
      const refs = input.paragraphReferences
        .split(',')
        .map(r => r.trim())
        .filter(Boolean);
      const legalRefPattern = /^§{1,2}\s*\d+/;
      const invalidRefs = refs.filter(r => !legalRefPattern.test(r));
      if (invalidRefs.length > 0) {
        violations.push({
          field: 'paragraphReferences',
          rule: 'paragraphFormat',
          message: `Ungültige Paragraphen-Referenzen: ${invalidRefs.slice(0, 3).join(', ')}. Erwartetes Format: "§ 123 BGB".`,
          severity: 'warning',
        });
      }
    }

    // ═══ 4. Titel-Mindestlänge ═══
    if (input.title.trim() && input.title.trim().length < 3) {
      violations.push({
        field: 'title',
        rule: 'titleMinLength',
        message: 'Titel muss mindestens 3 Zeichen lang sein.',
        severity: 'error',
      });
    }

    // ═══ 5. Kanzleiprofil-Vollständigkeit (Warnung) ═══
    if (kanzleiProfile && !kanzleiProfile.address) {
      violations.push({
        field: '_kanzleiProfile',
        rule: 'kanzleiAddress',
        message: 'Kanzleiprofil: Adresse fehlt — für Briefkopf auf generierten Dokumenten empfohlen.',
        severity: 'warning',
      });
    }

    return {
      valid: violations.filter(v => v.severity === 'error').length === 0,
      violations,
    };
  }

  getFieldError(
    violations: KanzleiRuleViolation[],
    field: string
  ): string | null {
    const fieldViolation = violations.find(
      v => v.field === field && v.severity === 'error'
    );
    return fieldViolation?.message ?? null;
  }

  getFieldWarning(
    violations: KanzleiRuleViolation[],
    field: string
  ): string | null {
    const fieldViolation = violations.find(
      v => v.field === field && v.severity === 'warning'
    );
    return fieldViolation?.message ?? null;
  }

  formatBlockingMessage(violations: KanzleiRuleViolation[]): string {
    const errors = violations.filter(v => v.severity === 'error');
    if (errors.length === 0) {
      return '';
    }
    const lines = errors.map(e => `• ${e.message}`);
    return `Intake blockiert – ${errors.length} Regelverstöß${errors.length > 1 ? 'e' : ''}:\n${lines.join('\n')}`;
  }
}
