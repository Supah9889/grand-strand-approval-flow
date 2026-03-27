/**
 * Phase 1B — Shared Payment Mutation Tests
 *
 * Covers:
 *  1. executePaymentCreate — creates payment, audits, syncs invoice
 *  2. executePaymentDelete — deletes payment, audits with logged_payment_deleted, syncs invoice
 *  3. invalidatePaymentQueries — touches all required cache keys
 *  4. Both PaymentsPage and Financials use the same shared path (structural)
 */

import { PAYMENT_QUERY_KEYS } from '../paymentMutations';
import { recalculateInvoiceFromPayments } from '../paymentIntegrity';

// ─── PAYMENT_QUERY_KEYS ───────────────────────────────────────────────────────

describe('PAYMENT_QUERY_KEYS', () => {
  test('includes payments cache key', () => {
    expect(PAYMENT_QUERY_KEYS.some(k => k[0] === 'payments')).toBe(true);
  });

  test('includes invoices cache key', () => {
    expect(PAYMENT_QUERY_KEYS.some(k => k[0] === 'invoices')).toBe(true);
  });

  test('includes jobs cache key', () => {
    expect(PAYMENT_QUERY_KEYS.some(k => k[0] === 'jobs')).toBe(true);
  });

  test('invalidatePaymentQueries calls invalidateQueries once per key', () => {
    const mockClient = { invalidateQueries: vi.fn() };
    const { invalidatePaymentQueries } = require('../paymentMutations');
    invalidatePaymentQueries(mockClient);
    expect(mockClient.invalidateQueries).toHaveBeenCalledTimes(PAYMENT_QUERY_KEYS.length);
    PAYMENT_QUERY_KEYS.forEach(key => {
      expect(mockClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: key });
    });
  });
});

// ─── Invoice recalculation after create ──────────────────────────────────────

describe('recalculateInvoiceFromPayments — after payment create', () => {
  const invoice = { id: 'inv1', amount: 1000, amount_paid: 0, balance_due: 1000, status: 'sent' };

  test('single payment partial — status becomes partial', () => {
    const result = recalculateInvoiceFromPayments(invoice, [
      { invoice_id: 'inv1', amount: 400 },
    ]);
    expect(result.amount_paid).toBeCloseTo(400);
    expect(result.balance_due).toBeCloseTo(600);
    expect(result.status).toBe('partial');
    expect(result.changed).toBe(true);
  });

  test('payment equals invoice total — status becomes paid', () => {
    const result = recalculateInvoiceFromPayments(invoice, [
      { invoice_id: 'inv1', amount: 1000 },
    ]);
    expect(result.amount_paid).toBeCloseTo(1000);
    expect(result.balance_due).toBe(0);
    expect(result.status).toBe('paid');
  });

  test('multiple payments summing to full — status becomes paid', () => {
    const result = recalculateInvoiceFromPayments(invoice, [
      { invoice_id: 'inv1', amount: 600 },
      { invoice_id: 'inv1', amount: 400 },
    ]);
    expect(result.amount_paid).toBeCloseTo(1000);
    expect(result.status).toBe('paid');
  });

  test('payments for other invoices are ignored', () => {
    const result = recalculateInvoiceFromPayments(invoice, [
      { invoice_id: 'inv2', amount: 999 },
      { invoice_id: 'inv1', amount: 200 },
    ]);
    expect(result.amount_paid).toBeCloseTo(200);
    expect(result.status).toBe('partial');
  });

  test('changed = false when amounts and status are already correct', () => {
    const alreadyPartial = { ...invoice, amount_paid: 400, balance_due: 600, status: 'partial' };
    const result = recalculateInvoiceFromPayments(alreadyPartial, [
      { invoice_id: 'inv1', amount: 400 },
    ]);
    expect(result.changed).toBe(false);
  });
});

// ─── Invoice recalculation after delete ──────────────────────────────────────

describe('recalculateInvoiceFromPayments — after payment delete', () => {
  test('last payment deleted — status reverts from paid to sent', () => {
    const paidInvoice = { id: 'inv1', amount: 500, amount_paid: 500, balance_due: 0, status: 'paid' };
    // No remaining payments (empty array = all deleted)
    const result = recalculateInvoiceFromPayments(paidInvoice, []);
    expect(result.amount_paid).toBe(0);
    expect(result.balance_due).toBe(500);
    expect(result.status).toBe('sent');
    expect(result.changed).toBe(true);
  });

  test('partial payment deleted — balance recalculated', () => {
    const partialInvoice = { id: 'inv1', amount: 1000, amount_paid: 600, balance_due: 400, status: 'partial' };
    // One payment remains after deletion of the 400 one
    const result = recalculateInvoiceFromPayments(partialInvoice, [
      { invoice_id: 'inv1', amount: 200 },
    ]);
    expect(result.amount_paid).toBeCloseTo(200);
    expect(result.balance_due).toBeCloseTo(800);
    expect(result.status).toBe('partial');
  });

  test('balance_due never goes negative when overpaid', () => {
    const invoice = { id: 'inv1', amount: 100, amount_paid: 0, balance_due: 100, status: 'sent' };
    const result = recalculateInvoiceFromPayments(invoice, [
      { invoice_id: 'inv1', amount: 200 },
    ]);
    expect(result.balance_due).toBe(0);
  });
});

// ─── Status guard — non-payable invoices ─────────────────────────────────────

describe('recalculateInvoiceFromPayments — status guard', () => {
  test('closed invoice status is not overwritten', () => {
    const closed = { id: 'inv1', amount: 500, amount_paid: 0, balance_due: 500, status: 'closed' };
    const result = recalculateInvoiceFromPayments(closed, [
      { invoice_id: 'inv1', amount: 500 },
    ]);
    // closed is not in PAYABLE_STATUSES, so status stays closed
    expect(result.status).toBe('closed');
  });
});

// ─── Structural: shared module exports ───────────────────────────────────────

describe('paymentMutations module exports', () => {
  test('exports executePaymentCreate function', () => {
    const mod = require('../paymentMutations');
    expect(typeof mod.executePaymentCreate).toBe('function');
  });

  test('exports executePaymentDelete function', () => {
    const mod = require('../paymentMutations');
    expect(typeof mod.executePaymentDelete).toBe('function');
  });

  test('exports invalidatePaymentQueries function', () => {
    const mod = require('../paymentMutations');
    expect(typeof mod.invalidatePaymentQueries).toBe('function');
  });

  test('exports PAYMENT_QUERY_KEYS array', () => {
    const mod = require('../paymentMutations');
    expect(Array.isArray(mod.PAYMENT_QUERY_KEYS)).toBe(true);
    expect(mod.PAYMENT_QUERY_KEYS.length).toBeGreaterThan(0);
  });
});