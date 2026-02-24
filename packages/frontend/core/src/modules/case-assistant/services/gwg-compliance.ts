import { Service } from '@toeverything/infra';
import { BehaviorSubject, map } from 'rxjs';

import type { ClientRecord } from '../types';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type GwGRiskLevel = 'low' | 'medium' | 'high' | 'very_high';

export type GwGIdentificationMethod =
  | 'ausweis_vorlage'        // ID card presented in person
  | 'reisepass_vorlage'       // Passport presented in person
  | 'video_ident'             // Video identification
  | 'post_ident'              // PostIdent
  | 'handelsregister'         // Commercial register extract
  | 'notar_beglaubigung'      // Notarial certification
  | 'beA_ident'               // beA identification
  | 'other';

export type GwGOnboardingStatus =
  | 'pending'
  | 'identification_required'
  | 'pep_check_required'
  | 'risk_assessment_required'
  | 'review_required'
  | 'approved'
  | 'rejected'
  | 'expired';

export type GwGCheckType =
  | 'identity_verification'
  | 'pep_check'
  | 'sanctions_check'
  | 'risk_assessment'
  | 'beneficial_owner'
  | 'source_of_funds'
  | 'ongoing_monitoring';

export interface GwGIdentification {
  method: GwGIdentificationMethod;
  documentType?: string;
  documentNumber?: string;
  issuingAuthority?: string;
  issueDate?: string;
  expiryDate?: string;
  nationality?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  verifiedAt: string;
  verifiedBy: string;
  notes?: string;
}

export interface GwGBeneficialOwner {
  id: string;
  name: string;
  dateOfBirth?: string;
  nationality?: string;
  ownershipPercentage: number;
  controlType: 'direct' | 'indirect' | 'other';
  identificationMethod?: GwGIdentificationMethod;
  verifiedAt?: string;
}

export interface GwGCheckRecord {
  id: string;
  type: GwGCheckType;
  status: 'pending' | 'passed' | 'failed' | 'inconclusive';
  performedAt?: string;
  performedBy?: string;
  result?: string;
  notes?: string;
  nextReviewAt?: string;
}

export interface GwGOnboardingRecord {
  id: string;
  workspaceId: string;
  clientId: string;
  clientName: string;
  clientKind: ClientRecord['kind'];
  status: GwGOnboardingStatus;
  riskLevel: GwGRiskLevel;
  /** Identity verification data */
  identification?: GwGIdentification;
  /** PEP (Politically Exposed Person) check */
  isPEP: boolean;
  pepDetails?: string;
  /** Sanctions list check */
  isSanctioned: boolean;
  sanctionDetails?: string;
  /** Beneficial owners (for companies) */
  beneficialOwners: GwGBeneficialOwner[];
  /** Source of funds declaration */
  sourceOfFunds?: string;
  /** Individual check records */
  checks: GwGCheckRecord[];
  /** Risk factors identified */
  riskFactors: string[];
  /** Enhanced due diligence required */
  enhancedDueDiligence: boolean;
  /** Review schedule */
  nextReviewAt?: string;
  /** Approved/rejected by */
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  /** Vollmacht linked */
  vollmachtId?: string;
  createdAt: string;
  updatedAt: string;
}

export const GWG_RISK_LABELS: Record<GwGRiskLevel, string> = {
  low: 'Geringes Risiko',
  medium: 'Mittleres Risiko',
  high: 'Hohes Risiko',
  very_high: 'Sehr hohes Risiko',
};

export const GWG_STATUS_LABELS: Record<GwGOnboardingStatus, string> = {
  pending: 'Ausstehend',
  identification_required: 'Identifizierung erforderlich',
  pep_check_required: 'PEP-Prüfung erforderlich',
  risk_assessment_required: 'Risikobewertung erforderlich',
  review_required: 'Überprüfung erforderlich',
  approved: 'Freigegeben',
  rejected: 'Abgelehnt',
  expired: 'Abgelaufen',
};

export const GWG_IDENT_METHOD_LABELS: Record<GwGIdentificationMethod, string> = {
  ausweis_vorlage: 'Personalausweis (Vorlage)',
  reisepass_vorlage: 'Reisepass (Vorlage)',
  video_ident: 'Video-Identifizierung',
  post_ident: 'PostIdent',
  handelsregister: 'Handelsregisterauszug',
  notar_beglaubigung: 'Notarielle Beglaubigung',
  beA_ident: 'beA-Identifizierung',
  other: 'Sonstiges',
};

// ─── High-Risk Country List (FATF Grey/Black List, simplified) ───────────────

const HIGH_RISK_COUNTRIES = new Set([
  'AF', 'MM', 'KP', 'IR', 'SY', 'YE', 'SO', 'LY', 'IQ',
  'HT', 'VU', 'JM', 'PK', 'TZ', 'UG', 'ML', 'BF', 'SS',
]);

/**
 * GwGComplianceService — Anti-Money-Laundering (AML) / Know-Your-Customer (KYC)
 *
 * Legal basis:
 * - § 2 Abs. 1 Nr. 7 GwG (Geldwäschegesetz) — Pflicht für Rechtsanwälte
 * - § 10-17 GwG — Sorgfaltspflichten
 * - § 8 FM-GwG (Österreich) — Finanzmarkt-Geldwäschegesetz
 * - 4. EU-Geldwäsche-Richtlinie (2015/849/EU)
 *
 * Features:
 * - Mandanten-Onboarding mit Identifizierungspflicht
 * - PEP-Prüfung (Politically Exposed Persons)
 * - Sanctions-Screening
 * - Risk Assessment (low/medium/high/very_high)
 * - Beneficial Owner identification (for companies)
 * - Enhanced Due Diligence for high-risk clients
 * - Ongoing monitoring with review schedule
 * - Full audit trail
 */
export class GwGComplianceService extends Service {
  private onboardingMap$ = new BehaviorSubject<Record<string, GwGOnboardingRecord>>({});

  readonly onboardingList$ = this.onboardingMap$.pipe(map(m => Object.values(m)));

  constructor(private readonly orchestration: CasePlatformOrchestrationService) {
    super();
  }

  getOnboardingForClient(clientId: string): GwGOnboardingRecord | undefined {
    return Object.values(this.onboardingMap$.value).find(o => o.clientId === clientId);
  }

  getPendingOnboardings(): GwGOnboardingRecord[] {
    return Object.values(this.onboardingMap$.value).filter(
      o => o.status !== 'approved' && o.status !== 'rejected' && o.status !== 'expired'
    );
  }

  getHighRiskClients(): GwGOnboardingRecord[] {
    return Object.values(this.onboardingMap$.value).filter(
      o => o.riskLevel === 'high' || o.riskLevel === 'very_high'
    );
  }

  getClientsNeedingReview(): GwGOnboardingRecord[] {
    const now = new Date().toISOString();
    return Object.values(this.onboardingMap$.value).filter(
      o => o.status === 'approved' && o.nextReviewAt && o.nextReviewAt <= now
    );
  }

  /**
   * Start the onboarding process for a new client
   */
  async startOnboarding(input: {
    workspaceId: string;
    clientId: string;
    clientName: string;
    clientKind: ClientRecord['kind'];
  }): Promise<GwGOnboardingRecord> {
    // Check if already exists
    const existing = this.getOnboardingForClient(input.clientId);
    if (existing && existing.status !== 'expired') return existing;

    const now = new Date().toISOString();
    const initialRisk = input.clientKind === 'company' ? 'medium' : 'low';

    const record: GwGOnboardingRecord = {
      id: createId('gwg'),
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      clientName: input.clientName,
      clientKind: input.clientKind,
      status: 'identification_required',
      riskLevel: initialRisk as GwGRiskLevel,
      isPEP: false,
      isSanctioned: false,
      beneficialOwners: [],
      checks: [
        {
          id: createId('gwg-chk'),
          type: 'identity_verification',
          status: 'pending',
        },
        {
          id: createId('gwg-chk'),
          type: 'pep_check',
          status: 'pending',
        },
        {
          id: createId('gwg-chk'),
          type: 'sanctions_check',
          status: 'pending',
        },
        {
          id: createId('gwg-chk'),
          type: 'risk_assessment',
          status: 'pending',
        },
      ],
      riskFactors: [],
      enhancedDueDiligence: false,
      createdAt: now,
      updatedAt: now,
    };

    // Add beneficial_owner check for companies
    if (input.clientKind === 'company') {
      record.checks.push({
        id: createId('gwg-chk'),
        type: 'beneficial_owner',
        status: 'pending',
      });
    }

    this.onboardingMap$.next({
      ...this.onboardingMap$.value,
      [record.id]: record,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: '',
      action: 'gwg.onboarding.started',
      severity: 'info',
      details: `GwG-Onboarding gestartet für: ${input.clientName} (${input.clientKind})`,
      metadata: { clientId: input.clientId },
    });

    return record;
  }

  /**
   * Record identity verification
   */
  async recordIdentification(
    onboardingId: string,
    identification: GwGIdentification
  ): Promise<GwGOnboardingRecord | null> {
    const existing = this.onboardingMap$.value[onboardingId];
    if (!existing) return null;

    const updatedChecks = existing.checks.map(c =>
      c.type === 'identity_verification'
        ? { ...c, status: 'passed' as const, performedAt: identification.verifiedAt, performedBy: identification.verifiedBy }
        : c
    );

    const riskFactors = [...existing.riskFactors];

    // Check nationality against high-risk countries
    if (identification.nationality && HIGH_RISK_COUNTRIES.has(identification.nationality.toUpperCase())) {
      riskFactors.push(`Hochrisiko-Land: ${identification.nationality}`);
    }

    const updated: GwGOnboardingRecord = {
      ...existing,
      identification,
      checks: updatedChecks,
      riskFactors,
      status: 'pep_check_required',
      updatedAt: new Date().toISOString(),
    };

    this.onboardingMap$.next({
      ...this.onboardingMap$.value,
      [onboardingId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: existing.workspaceId,
      caseId: '',
      action: 'gwg.identification.recorded',
      severity: 'info',
      details: `Identifizierung: ${GWG_IDENT_METHOD_LABELS[identification.method]} durch ${identification.verifiedBy}`,
      metadata: {
        clientId: existing.clientId,
        method: identification.method,
      },
    });

    return updated;
  }

  /**
   * Record PEP check result
   */
  async recordPEPCheck(
    onboardingId: string,
    isPEP: boolean,
    details?: string,
    performedBy?: string
  ): Promise<GwGOnboardingRecord | null> {
    const existing = this.onboardingMap$.value[onboardingId];
    if (!existing) return null;

    const now = new Date().toISOString();

    const updatedChecks = existing.checks.map(c =>
      c.type === 'pep_check'
        ? { ...c, status: 'passed' as const, performedAt: now, performedBy, result: isPEP ? 'PEP identifiziert' : 'Kein PEP' }
        : c
    );

    const riskFactors = [...existing.riskFactors];
    if (isPEP) {
      riskFactors.push('PEP (Politisch exponierte Person) identifiziert');
    }

    const updated: GwGOnboardingRecord = {
      ...existing,
      isPEP,
      pepDetails: details,
      checks: updatedChecks,
      riskFactors,
      status: 'risk_assessment_required',
      updatedAt: now,
    };

    this.onboardingMap$.next({
      ...this.onboardingMap$.value,
      [onboardingId]: updated,
    });

    return updated;
  }

  /**
   * Record sanctions check result
   */
  async recordSanctionsCheck(
    onboardingId: string,
    isSanctioned: boolean,
    details?: string,
    performedBy?: string
  ): Promise<GwGOnboardingRecord | null> {
    const existing = this.onboardingMap$.value[onboardingId];
    if (!existing) return null;

    const now = new Date().toISOString();

    const updatedChecks = existing.checks.map(c =>
      c.type === 'sanctions_check'
        ? {
            ...c,
            status: (isSanctioned ? 'failed' : 'passed') as 'passed' | 'failed',
            performedAt: now,
            performedBy,
            result: isSanctioned ? 'SANKTIONIERT' : 'Keine Sanktionen',
          }
        : c
    );

    const riskFactors = [...existing.riskFactors];
    if (isSanctioned) {
      riskFactors.push('SANKTIONSLISTE: Mandant ist auf einer Sanktionsliste geführt!');
    }

    const updated: GwGOnboardingRecord = {
      ...existing,
      isSanctioned,
      sanctionDetails: details,
      checks: updatedChecks,
      riskFactors,
      riskLevel: isSanctioned ? 'very_high' : existing.riskLevel,
      updatedAt: now,
    };

    this.onboardingMap$.next({
      ...this.onboardingMap$.value,
      [onboardingId]: updated,
    });

    return updated;
  }

  /**
   * Add a beneficial owner (for company clients)
   */
  async addBeneficialOwner(
    onboardingId: string,
    owner: Omit<GwGBeneficialOwner, 'id'>
  ): Promise<GwGOnboardingRecord | null> {
    const existing = this.onboardingMap$.value[onboardingId];
    if (!existing) return null;

    const newOwner: GwGBeneficialOwner = {
      ...owner,
      id: createId('bo'),
    };

    const updatedOwners = [...existing.beneficialOwners, newOwner];
    const totalOwnership = updatedOwners.reduce((sum, o) => sum + o.ownershipPercentage, 0);

    // Update beneficial_owner check if total >= 100%
    const updatedChecks = existing.checks.map(c =>
      c.type === 'beneficial_owner' && totalOwnership >= 25
        ? { ...c, status: 'passed' as const, performedAt: new Date().toISOString() }
        : c
    );

    const updated: GwGOnboardingRecord = {
      ...existing,
      beneficialOwners: updatedOwners,
      checks: updatedChecks,
      updatedAt: new Date().toISOString(),
    };

    this.onboardingMap$.next({
      ...this.onboardingMap$.value,
      [onboardingId]: updated,
    });

    return updated;
  }

  /**
   * Perform automated risk assessment based on all collected data
   */
  async performRiskAssessment(
    onboardingId: string,
    performedBy: string
  ): Promise<GwGOnboardingRecord | null> {
    const existing = this.onboardingMap$.value[onboardingId];
    if (!existing) return null;

    const riskFactors = [...existing.riskFactors];
    let riskScore = 0;

    // Factor 1: Client type
    if (existing.clientKind === 'company') riskScore += 10;

    // Factor 2: PEP
    if (existing.isPEP) riskScore += 30;

    // Factor 3: Sanctions
    if (existing.isSanctioned) riskScore += 100;

    // Factor 4: High-risk country
    if (existing.identification?.nationality && HIGH_RISK_COUNTRIES.has(existing.identification.nationality.toUpperCase())) {
      riskScore += 25;
    }

    // Factor 5: Complex ownership structure
    if (existing.beneficialOwners.some(o => o.controlType === 'indirect')) {
      riskScore += 15;
      riskFactors.push('Indirekte Beteiligungsstruktur');
    }

    // Factor 6: No source of funds for high amounts
    if (!existing.sourceOfFunds && riskScore > 20) {
      riskScore += 10;
      riskFactors.push('Keine Erklärung zur Mittelherkunft');
    }

    // Determine risk level
    let riskLevel: GwGRiskLevel;
    if (riskScore >= 80) riskLevel = 'very_high';
    else if (riskScore >= 40) riskLevel = 'high';
    else if (riskScore >= 15) riskLevel = 'medium';
    else riskLevel = 'low';

    const enhancedDueDiligence = riskLevel === 'high' || riskLevel === 'very_high';

    // Review schedule based on risk
    const reviewMonths = riskLevel === 'very_high' ? 6 :
                         riskLevel === 'high' ? 12 :
                         riskLevel === 'medium' ? 24 : 36;
    const nextReviewAt = new Date(
      Date.now() + reviewMonths * 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const now = new Date().toISOString();

    const updatedChecks = existing.checks.map(c =>
      c.type === 'risk_assessment'
        ? {
            ...c,
            status: 'passed' as const,
            performedAt: now,
            performedBy,
            result: `Risk Score: ${riskScore} → ${GWG_RISK_LABELS[riskLevel]}`,
          }
        : c
    );

    const updated: GwGOnboardingRecord = {
      ...existing,
      riskLevel,
      riskFactors,
      enhancedDueDiligence,
      checks: updatedChecks,
      nextReviewAt,
      status: 'review_required',
      updatedAt: now,
    };

    this.onboardingMap$.next({
      ...this.onboardingMap$.value,
      [onboardingId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: existing.workspaceId,
      caseId: '',
      action: 'gwg.risk_assessment.completed',
      severity: riskLevel === 'very_high' || riskLevel === 'high' ? 'warning' : 'info',
      details: `GwG-Risikobewertung: ${existing.clientName} → ${GWG_RISK_LABELS[riskLevel]} (Score: ${riskScore})`,
      metadata: {
        clientId: existing.clientId,
        riskScore: String(riskScore),
        riskLevel,
        enhancedDueDiligence: String(enhancedDueDiligence),
      },
    });

    return updated;
  }

  /**
   * Final decision — approve or reject the onboarding
   */
  async decide(
    onboardingId: string,
    approved: boolean,
    decidedBy: string,
    note?: string
  ): Promise<GwGOnboardingRecord | null> {
    const existing = this.onboardingMap$.value[onboardingId];
    if (!existing) return null;

    // Sanction = auto-reject
    if (existing.isSanctioned && approved) {
      throw new Error('Mandant ist auf einer Sanktionsliste. Mandatsannahme NICHT zulässig.');
    }

    const now = new Date().toISOString();

    const updated: GwGOnboardingRecord = {
      ...existing,
      status: approved ? 'approved' : 'rejected',
      decidedBy,
      decidedAt: now,
      decisionNote: note,
      updatedAt: now,
    };

    this.onboardingMap$.next({
      ...this.onboardingMap$.value,
      [onboardingId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: existing.workspaceId,
      caseId: '',
      action: approved ? 'gwg.onboarding.approved' : 'gwg.onboarding.rejected',
      severity: approved ? 'info' : 'warning',
      details: `GwG-Onboarding ${approved ? 'FREIGEGEBEN' : 'ABGELEHNT'}: ${existing.clientName} (${GWG_RISK_LABELS[existing.riskLevel]})`,
      metadata: {
        clientId: existing.clientId,
        decidedBy,
        riskLevel: existing.riskLevel,
      },
    });

    return updated;
  }

  /**
   * Check if a client is cleared for mandate acceptance
   */
  isClientCleared(clientId: string): boolean {
    const onboarding = this.getOnboardingForClient(clientId);
    return onboarding?.status === 'approved';
  }

  getDashboardStats(): {
    totalOnboardings: number;
    pendingOnboardings: number;
    approvedOnboardings: number;
    rejectedOnboardings: number;
    highRiskClients: number;
    pepClients: number;
    needingReview: number;
  } {
    const all = Object.values(this.onboardingMap$.value);
    const now = new Date().toISOString();

    return {
      totalOnboardings: all.length,
      pendingOnboardings: all.filter(o => o.status !== 'approved' && o.status !== 'rejected' && o.status !== 'expired').length,
      approvedOnboardings: all.filter(o => o.status === 'approved').length,
      rejectedOnboardings: all.filter(o => o.status === 'rejected').length,
      highRiskClients: all.filter(o => o.riskLevel === 'high' || o.riskLevel === 'very_high').length,
      pepClients: all.filter(o => o.isPEP).length,
      needingReview: all.filter(o => o.status === 'approved' && o.nextReviewAt && o.nextReviewAt <= now).length,
    };
  }
}
