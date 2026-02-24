import { Service } from '@toeverything/infra';
import { BehaviorSubject, map } from 'rxjs';

import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function assertNonEmpty(value: string, field: string) {
  if (!value || !value.trim()) {
    throw new Error(`${field} darf nicht leer sein.`);
  }
}

function assertPositiveNumber(value: number, field: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} muss eine positive Zahl sein.`);
  }
}

function assertNonNegativeNumber(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} darf nicht negativ sein.`);
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type TreuhandTransactionType =
  | 'eingang'            // Incoming payment from client/third party
  | 'ausgang'            // Outgoing payment (to court, expert, etc.)
  | 'honorarEntnahme'    // Fee withdrawal to firm account
  | 'rueckzahlung'       // Refund to client
  | 'umbuchung'          // Transfer between matters
  | 'zinsen'             // Interest earned
  | 'korrektur';         // Correction entry

export type TreuhandTransactionStatus =
  | 'pending'
  | 'approved'
  | 'executed'
  | 'rejected'
  | 'reversed';

export interface TreuhandKonto {
  id: string;
  workspaceId: string;
  /** IBAN of the trust account */
  iban: string;
  /** BIC/SWIFT */
  bic?: string;
  /** Bank name */
  bankName: string;
  /** Account holder (usually: Kanzlei Anderkonto) */
  kontoinhaber: string;
  /** Currency */
  waehrung: string;
  /** Current total balance across all matters */
  gesamtSaldo: number;
  /** Whether this account is active */
  active: boolean;
  /** Last reconciliation date */
  lastReconciliationAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TreuhandMatterBalance {
  id: string;
  workspaceId: string;
  kontoId: string;
  matterId: string;
  clientId: string;
  /** Current balance for this matter */
  saldo: number;
  /** Total incoming */
  totalEingaenge: number;
  /** Total outgoing */
  totalAusgaenge: number;
  /** Reserved amount (pending transactions) */
  reserviert: number;
  /** Available for withdrawal */
  verfuegbar: number;
  createdAt: string;
  updatedAt: string;
}

export interface TreuhandTransaction {
  id: string;
  workspaceId: string;
  kontoId: string;
  matterId: string;
  clientId: string;
  type: TreuhandTransactionType;
  status: TreuhandTransactionStatus;
  /** Amount (always positive — direction determined by type) */
  betrag: number;
  waehrung: string;
  /** Description / purpose */
  verwendungszweck: string;
  /** Counterparty name */
  gegenpartei?: string;
  /** External reference (bank transfer ID, etc.) */
  externeReferenz?: string;
  /** If this is a fee withdrawal, link to invoice */
  rechnungId?: string;
  /** Four-eyes principle: who requested */
  angelegtVon: string;
  angelegtVonName: string;
  /** Four-eyes principle: who approved */
  genehmigVon?: string;
  genehmigVonName?: string;
  genehmigAm?: string;
  /** If rejected, reason */
  ablehnungsgrund?: string;
  /** If reversed, the reversal transaction ID */
  storniertDurch?: string;
  /** Execution date */
  ausfuehrungsDatum?: string;
  /** Wertstellung (value date) */
  wertstellungsDatum?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TreuhandReconciliation {
  id: string;
  workspaceId: string;
  kontoId: string;
  /** Bank statement balance */
  bankSaldo: number;
  /** System calculated balance */
  systemSaldo: number;
  /** Difference */
  differenz: number;
  /** Whether reconciled successfully */
  abgestimmt: boolean;
  /** Notes on unreconciled items */
  anmerkungen?: string;
  durchgefuehrtVon: string;
  durchgefuehrtAm: string;
}

export const TREUHAND_TRANSACTION_TYPE_LABELS: Record<TreuhandTransactionType, string> = {
  eingang: 'Eingang (Fremdgeld)',
  ausgang: 'Ausgang (Zahlung)',
  honorarEntnahme: 'Honorarentnahme',
  rueckzahlung: 'Rückzahlung an Mandant',
  umbuchung: 'Umbuchung',
  zinsen: 'Zinsen',
  korrektur: 'Korrektur',
};

export const TREUHAND_STATUS_LABELS: Record<TreuhandTransactionStatus, string> = {
  pending: 'Ausstehend',
  approved: 'Genehmigt',
  executed: 'Ausgeführt',
  rejected: 'Abgelehnt',
  reversed: 'Storniert',
};

const CREDIT_TYPES: Set<TreuhandTransactionType> = new Set(['eingang', 'zinsen']);
const DEBIT_TYPES: Set<TreuhandTransactionType> = new Set(['ausgang', 'honorarEntnahme', 'rueckzahlung']);

/**
 * TreuhandkontoService — Fremdgeld / Trust Account Management
 *
 * Legal basis:
 * - § 43a Abs. 5 BRAO — Pflicht zur Fremdgeldverwaltung (DE)
 * - § 19 RL-BA — Pflicht zur Trennung (AT)
 * - BORA § 4 — Verbot der Vermischung von Fremdgeld und Eigenkapital
 *
 * Features:
 * - Anderkonto-Verwaltung (IBAN, Bank, Saldo)
 * - Mandantenbezogene Salden (pro Akte)
 * - Vier-Augen-Prinzip für alle Transaktionen
 * - Honorar-Entnahme mit Rechnungs-Verknüpfung
 * - Rückzahlung an Mandanten
 * - Kontoabstimmung (Reconciliation)
 * - Storno-Funktion mit Gegenbuchung
 * - Vollständiger Audit-Trail (berufsrechtlich vorgeschrieben)
 */
export class TreuhandkontoService extends Service {
  private kontenMap$ = new BehaviorSubject<Record<string, TreuhandKonto>>({});
  private balancesMap$ = new BehaviorSubject<Record<string, TreuhandMatterBalance>>({});
  private transactionsMap$ = new BehaviorSubject<Record<string, TreuhandTransaction>>({});
  private reconciliationsMap$ = new BehaviorSubject<Record<string, TreuhandReconciliation>>({});

  readonly kontenList$ = this.kontenMap$.pipe(map(m => Object.values(m)));
  readonly balancesList$ = this.balancesMap$.pipe(map(m => Object.values(m)));
  readonly transactionsList$ = this.transactionsMap$.pipe(map(m => Object.values(m)));

  constructor(private readonly orchestration: CasePlatformOrchestrationService) {
    super();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KONTO MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async createKonto(input: {
    workspaceId: string;
    iban: string;
    bic?: string;
    bankName: string;
    kontoinhaber: string;
    waehrung?: string;
  }): Promise<TreuhandKonto> {
    assertNonEmpty(input.workspaceId, 'Workspace-ID');
    assertNonEmpty(input.iban, 'IBAN');
    assertNonEmpty(input.bankName, 'Bankname');
    assertNonEmpty(input.kontoinhaber, 'Kontoinhaber');

    const normalizedIban = input.iban.replace(/\s/g, '').toUpperCase();

    // Check for duplicate IBAN
    const existing = Object.values(this.kontenMap$.value).find(
      k => k.iban === normalizedIban && k.workspaceId === input.workspaceId
    );
    if (existing) {
      throw new Error(`Anderkonto mit IBAN ${normalizedIban} existiert bereits.`);
    }

    const now = new Date().toISOString();
    const konto: TreuhandKonto = {
      id: createId('treuhand'),
      workspaceId: input.workspaceId,
      iban: normalizedIban,
      bic: input.bic?.trim(),
      bankName: input.bankName.trim(),
      kontoinhaber: input.kontoinhaber.trim(),
      waehrung: input.waehrung ?? 'EUR',
      gesamtSaldo: 0,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    this.kontenMap$.next({ ...this.kontenMap$.value, [konto.id]: konto });

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: '',
      action: 'treuhandkonto.created',
      severity: 'info',
      details: `Anderkonto erstellt: ${konto.bankName} (${konto.iban})`,
      metadata: { kontoId: konto.id, iban: normalizedIban },
    });

    return konto;
  }

  getKontoById(kontoId: string): TreuhandKonto | undefined {
    return this.kontenMap$.value[kontoId];
  }

  getActiveKonten(workspaceId: string): TreuhandKonto[] {
    return Object.values(this.kontenMap$.value).filter(
      k => k.workspaceId === workspaceId && k.active
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MATTER BALANCES
  // ═══════════════════════════════════════════════════════════════════════════

  getOrCreateMatterBalance(
    workspaceId: string,
    kontoId: string,
    matterId: string,
    clientId: string
  ): TreuhandMatterBalance {
    const existing = Object.values(this.balancesMap$.value).find(
      b => b.kontoId === kontoId && b.matterId === matterId
    );
    if (existing) return existing;

    const now = new Date().toISOString();
    const balance: TreuhandMatterBalance = {
      id: createId('treuhand-bal'),
      workspaceId,
      kontoId,
      matterId,
      clientId,
      saldo: 0,
      totalEingaenge: 0,
      totalAusgaenge: 0,
      reserviert: 0,
      verfuegbar: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.balancesMap$.next({ ...this.balancesMap$.value, [balance.id]: balance });
    return balance;
  }

  getBalanceForMatter(kontoId: string, matterId: string): TreuhandMatterBalance | undefined {
    return Object.values(this.balancesMap$.value).find(
      b => b.kontoId === kontoId && b.matterId === matterId
    );
  }

  getAllBalancesForKonto(kontoId: string): TreuhandMatterBalance[] {
    return Object.values(this.balancesMap$.value).filter(b => b.kontoId === kontoId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTIONS (with 4-Augen-Prinzip)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a transaction (initially 'pending', needs approval for 4-Augen)
   */
  async createTransaction(input: {
    workspaceId: string;
    kontoId: string;
    matterId: string;
    clientId: string;
    type: TreuhandTransactionType;
    betrag: number;
    verwendungszweck: string;
    gegenpartei?: string;
    externeReferenz?: string;
    rechnungId?: string;
    angelegtVon: string;
    angelegtVonName: string;
    wertstellungsDatum?: string;
  }): Promise<TreuhandTransaction> {
    assertNonEmpty(input.workspaceId, 'Workspace-ID');
    assertNonEmpty(input.kontoId, 'Konto-ID');
    assertNonEmpty(input.matterId, 'Matter-ID');
    assertNonEmpty(input.verwendungszweck, 'Verwendungszweck');
    assertNonEmpty(input.angelegtVon, 'Angelegt-von ID');
    assertPositiveNumber(input.betrag, 'Betrag');

    const konto = this.kontenMap$.value[input.kontoId];
    if (!konto) throw new Error('Anderkonto nicht gefunden.');
    if (!konto.active) throw new Error('Anderkonto ist deaktiviert.');

    // For debit transactions, check sufficient balance
    if (DEBIT_TYPES.has(input.type)) {
      const balance = this.getBalanceForMatter(input.kontoId, input.matterId);
      const available = (balance?.saldo ?? 0) - (balance?.reserviert ?? 0);
      if (input.betrag > available) {
        throw new Error(
          `Unzureichendes Guthaben: Verfügbar ${available.toFixed(2)} ${konto.waehrung}, ` +
          `angefordert ${input.betrag.toFixed(2)} ${konto.waehrung}.`
        );
      }
    }

    const now = new Date().toISOString();

    const transaction: TreuhandTransaction = {
      id: createId('treuhand-tx'),
      workspaceId: input.workspaceId,
      kontoId: input.kontoId,
      matterId: input.matterId,
      clientId: input.clientId,
      type: input.type,
      status: 'pending',
      betrag: Math.round(input.betrag * 100) / 100,
      waehrung: konto.waehrung,
      verwendungszweck: input.verwendungszweck.trim(),
      gegenpartei: input.gegenpartei?.trim(),
      externeReferenz: input.externeReferenz?.trim(),
      rechnungId: input.rechnungId,
      angelegtVon: input.angelegtVon,
      angelegtVonName: input.angelegtVonName.trim(),
      wertstellungsDatum: input.wertstellungsDatum,
      createdAt: now,
      updatedAt: now,
    };

    this.transactionsMap$.next({
      ...this.transactionsMap$.value,
      [transaction.id]: transaction,
    });

    // Reserve amount for debit transactions
    if (DEBIT_TYPES.has(input.type)) {
      await this.updateReservedAmount(input.kontoId, input.matterId, input.clientId);
    }

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: '',
      action: `treuhand.transaction.${input.type}.created`,
      severity: 'info',
      details: `Treuhand-Buchung erstellt: ${TREUHAND_TRANSACTION_TYPE_LABELS[input.type]} — ${input.betrag.toFixed(2)} ${konto.waehrung} (${input.verwendungszweck})`,
      metadata: {
        transactionId: transaction.id,
        type: input.type,
        betrag: String(input.betrag),
        matterId: input.matterId,
      },
    });

    return transaction;
  }

  /**
   * Approve a transaction (4-Augen-Prinzip — different person than creator)
   */
  async approveTransaction(
    transactionId: string,
    genehmigVon: string,
    genehmigVonName: string
  ): Promise<TreuhandTransaction | null> {
    assertNonEmpty(transactionId, 'Transaktions-ID');
    assertNonEmpty(genehmigVon, 'Genehmiger-ID');

    const tx = this.transactionsMap$.value[transactionId];
    if (!tx) return null;
    if (tx.status !== 'pending') {
      throw new Error(`Nur ausstehende Transaktionen können genehmigt werden. Aktuell: ${tx.status}`);
    }

    // 4-Augen: different person must approve
    if (tx.angelegtVon === genehmigVon) {
      throw new Error('Vier-Augen-Prinzip: Die genehmigende Person muss eine andere sein als die anlegende.');
    }

    const now = new Date().toISOString();

    const updated: TreuhandTransaction = {
      ...tx,
      status: 'approved',
      genehmigVon,
      genehmigVonName: genehmigVonName.trim(),
      genehmigAm: now,
      updatedAt: now,
    };

    this.transactionsMap$.next({
      ...this.transactionsMap$.value,
      [transactionId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: tx.workspaceId,
      caseId: '',
      action: 'treuhand.transaction.approved',
      severity: 'info',
      details: `Treuhand-Buchung genehmigt von ${genehmigVonName}: ${tx.betrag.toFixed(2)} ${tx.waehrung} (${TREUHAND_TRANSACTION_TYPE_LABELS[tx.type]})`,
      metadata: {
        transactionId,
        genehmigVon,
        type: tx.type,
      },
    });

    return updated;
  }

  /**
   * Execute an approved transaction — updates balances
   */
  async executeTransaction(transactionId: string): Promise<TreuhandTransaction | null> {
    const tx = this.transactionsMap$.value[transactionId];
    if (!tx) return null;
    if (tx.status !== 'approved') {
      throw new Error(`Nur genehmigte Transaktionen können ausgeführt werden. Aktuell: ${tx.status}`);
    }

    const now = new Date().toISOString();
    const isCredit = CREDIT_TYPES.has(tx.type);
    const isDebit = DEBIT_TYPES.has(tx.type);

    // Update matter balance
    const balance = this.getOrCreateMatterBalance(
      tx.workspaceId, tx.kontoId, tx.matterId, tx.clientId
    );

    const updatedBalance: TreuhandMatterBalance = {
      ...balance,
      saldo: isCredit
        ? balance.saldo + tx.betrag
        : isDebit
          ? balance.saldo - tx.betrag
          : balance.saldo,
      totalEingaenge: isCredit ? balance.totalEingaenge + tx.betrag : balance.totalEingaenge,
      totalAusgaenge: isDebit ? balance.totalAusgaenge + tx.betrag : balance.totalAusgaenge,
      updatedAt: now,
    };
    updatedBalance.verfuegbar = updatedBalance.saldo - updatedBalance.reserviert;

    this.balancesMap$.next({
      ...this.balancesMap$.value,
      [balance.id]: updatedBalance,
    });

    // Update konto total
    const konto = this.kontenMap$.value[tx.kontoId];
    if (konto) {
      const allBalances = Object.values({
        ...this.balancesMap$.value,
        [balance.id]: updatedBalance,
      }).filter(b => b.kontoId === tx.kontoId);

      const gesamtSaldo = allBalances.reduce((sum, b) => sum + b.saldo, 0);

      this.kontenMap$.next({
        ...this.kontenMap$.value,
        [tx.kontoId]: {
          ...konto,
          gesamtSaldo: Math.round(gesamtSaldo * 100) / 100,
          updatedAt: now,
        },
      });
    }

    // Mark transaction as executed
    const updated: TreuhandTransaction = {
      ...tx,
      status: 'executed',
      ausfuehrungsDatum: now,
      wertstellungsDatum: tx.wertstellungsDatum ?? now.split('T')[0],
      updatedAt: now,
    };

    this.transactionsMap$.next({
      ...this.transactionsMap$.value,
      [transactionId]: updated,
    });

    // Update reserved amount
    await this.updateReservedAmount(tx.kontoId, tx.matterId, tx.clientId);

    await this.orchestration.appendAuditEntry({
      workspaceId: tx.workspaceId,
      caseId: '',
      action: 'treuhand.transaction.executed',
      severity: 'info',
      details: `Treuhand-Buchung ausgeführt: ${tx.betrag.toFixed(2)} ${tx.waehrung} (${TREUHAND_TRANSACTION_TYPE_LABELS[tx.type]}) — Neuer Saldo: ${updatedBalance.saldo.toFixed(2)} ${tx.waehrung}`,
      metadata: {
        transactionId,
        type: tx.type,
        betrag: String(tx.betrag),
        neuerSaldo: String(updatedBalance.saldo),
      },
    });

    return updated;
  }

  /**
   * Reject a pending transaction
   */
  async rejectTransaction(
    transactionId: string,
    ablehnungsgrund: string,
    abgelehntVon: string
  ): Promise<TreuhandTransaction | null> {
    assertNonEmpty(ablehnungsgrund, 'Ablehnungsgrund');

    const tx = this.transactionsMap$.value[transactionId];
    if (!tx) return null;
    if (tx.status !== 'pending') {
      throw new Error('Nur ausstehende Transaktionen können abgelehnt werden.');
    }

    const updated: TreuhandTransaction = {
      ...tx,
      status: 'rejected',
      ablehnungsgrund: ablehnungsgrund.trim(),
      genehmigVon: abgelehntVon,
      updatedAt: new Date().toISOString(),
    };

    this.transactionsMap$.next({
      ...this.transactionsMap$.value,
      [transactionId]: updated,
    });

    // Release reserved amount
    await this.updateReservedAmount(tx.kontoId, tx.matterId, tx.clientId);

    await this.orchestration.appendAuditEntry({
      workspaceId: tx.workspaceId,
      caseId: '',
      action: 'treuhand.transaction.rejected',
      severity: 'warning',
      details: `Treuhand-Buchung abgelehnt: ${ablehnungsgrund}`,
      metadata: { transactionId, grund: ablehnungsgrund },
    });

    return updated;
  }

  /**
   * Reverse an executed transaction (creates a counter-booking)
   */
  async reverseTransaction(
    transactionId: string,
    angelegtVon: string,
    angelegtVonName: string,
    grund: string
  ): Promise<TreuhandTransaction | null> {
    assertNonEmpty(grund, 'Stornogrund');

    const tx = this.transactionsMap$.value[transactionId];
    if (!tx) return null;
    if (tx.status !== 'executed') {
      throw new Error('Nur ausgeführte Transaktionen können storniert werden.');
    }

    // Create counter-booking
    const counterType: TreuhandTransactionType = 'korrektur';
    const counter = await this.createTransaction({
      workspaceId: tx.workspaceId,
      kontoId: tx.kontoId,
      matterId: tx.matterId,
      clientId: tx.clientId,
      type: counterType,
      betrag: tx.betrag,
      verwendungszweck: `STORNO: ${tx.verwendungszweck} — ${grund}`,
      angelegtVon,
      angelegtVonName,
    });

    // Mark original as reversed
    const updated: TreuhandTransaction = {
      ...tx,
      status: 'reversed',
      storniertDurch: counter.id,
      updatedAt: new Date().toISOString(),
    };

    this.transactionsMap$.next({
      ...this.transactionsMap$.value,
      [transactionId]: updated,
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECONCILIATION
  // ═══════════════════════════════════════════════════════════════════════════

  async reconcile(input: {
    workspaceId: string;
    kontoId: string;
    bankSaldo: number;
    durchgefuehrtVon: string;
    anmerkungen?: string;
  }): Promise<TreuhandReconciliation> {
    assertNonEmpty(input.kontoId, 'Konto-ID');
    assertNonNegativeNumber(input.bankSaldo, 'Bank-Saldo');

    const konto = this.kontenMap$.value[input.kontoId];
    if (!konto) throw new Error('Anderkonto nicht gefunden.');

    const systemSaldo = konto.gesamtSaldo;
    const differenz = Math.round((input.bankSaldo - systemSaldo) * 100) / 100;

    const now = new Date().toISOString();

    const reconciliation: TreuhandReconciliation = {
      id: createId('treuhand-recon'),
      workspaceId: input.workspaceId,
      kontoId: input.kontoId,
      bankSaldo: input.bankSaldo,
      systemSaldo,
      differenz,
      abgestimmt: Math.abs(differenz) < 0.01,
      anmerkungen: input.anmerkungen?.trim(),
      durchgefuehrtVon: input.durchgefuehrtVon,
      durchgefuehrtAm: now,
    };

    this.reconciliationsMap$.next({
      ...this.reconciliationsMap$.value,
      [reconciliation.id]: reconciliation,
    });

    // Update konto last reconciliation
    this.kontenMap$.next({
      ...this.kontenMap$.value,
      [input.kontoId]: { ...konto, lastReconciliationAt: now, updatedAt: now },
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: '',
      action: reconciliation.abgestimmt ? 'treuhand.reconciliation.ok' : 'treuhand.reconciliation.differenz',
      severity: reconciliation.abgestimmt ? 'info' : 'warning',
      details: reconciliation.abgestimmt
        ? `Kontoabstimmung erfolgreich: ${systemSaldo.toFixed(2)} ${konto.waehrung}`
        : `Kontoabstimmung Differenz: Bank ${input.bankSaldo.toFixed(2)} vs. System ${systemSaldo.toFixed(2)} (Differenz: ${differenz.toFixed(2)} ${konto.waehrung})`,
      metadata: {
        kontoId: input.kontoId,
        bankSaldo: String(input.bankSaldo),
        systemSaldo: String(systemSaldo),
        differenz: String(differenz),
      },
    });

    return reconciliation;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  getTransactionsForMatter(matterId: string): TreuhandTransaction[] {
    return Object.values(this.transactionsMap$.value)
      .filter(t => t.matterId === matterId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getTransactionsForKonto(kontoId: string): TreuhandTransaction[] {
    return Object.values(this.transactionsMap$.value)
      .filter(t => t.kontoId === kontoId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getPendingTransactions(): TreuhandTransaction[] {
    return Object.values(this.transactionsMap$.value).filter(t => t.status === 'pending');
  }

  getReconciliationHistory(kontoId: string): TreuhandReconciliation[] {
    return Object.values(this.reconciliationsMap$.value)
      .filter(r => r.kontoId === kontoId)
      .sort((a, b) => new Date(b.durchgefuehrtAm).getTime() - new Date(a.durchgefuehrtAm).getTime());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async updateReservedAmount(kontoId: string, matterId: string, clientId: string) {
    const pendingDebits = Object.values(this.transactionsMap$.value).filter(
      t => t.kontoId === kontoId &&
           t.matterId === matterId &&
           t.status === 'pending' &&
           DEBIT_TYPES.has(t.type)
    );

    const reserved = pendingDebits.reduce((sum, t) => sum + t.betrag, 0);

    const balance = this.getOrCreateMatterBalance(
      this.kontenMap$.value[kontoId]?.workspaceId ?? '',
      kontoId, matterId, clientId
    );

    this.balancesMap$.next({
      ...this.balancesMap$.value,
      [balance.id]: {
        ...balance,
        reserviert: Math.round(reserved * 100) / 100,
        verfuegbar: Math.round((balance.saldo - reserved) * 100) / 100,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  getDashboardStats(): {
    totalKonten: number;
    gesamtFremdgeld: number;
    pendingTransactions: number;
    offeneAbstimmungen: number;
    matterMitGuthaben: number;
    lastReconciliation: string | null;
  } {
    const konten = Object.values(this.kontenMap$.value).filter(k => k.active);
    const balances = Object.values(this.balancesMap$.value);
    const pending = this.getPendingTransactions();

    const lastRecon = Object.values(this.reconciliationsMap$.value)
      .sort((a, b) => b.durchgefuehrtAm.localeCompare(a.durchgefuehrtAm))[0];

    return {
      totalKonten: konten.length,
      gesamtFremdgeld: konten.reduce((sum, k) => sum + k.gesamtSaldo, 0),
      pendingTransactions: pending.length,
      offeneAbstimmungen: konten.filter(k => {
        const recons = this.getReconciliationHistory(k.id);
        return recons.length === 0 || !recons[0].abgestimmt;
      }).length,
      matterMitGuthaben: balances.filter(b => b.saldo > 0).length,
      lastReconciliation: lastRecon?.durchgefuehrtAm ?? null,
    };
  }
}
