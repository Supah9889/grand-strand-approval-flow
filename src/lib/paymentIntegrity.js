/**
 * paymentIntegrity.js — Phase 1 centralized payment / invoice integrity logic.
 *
 * Provides:
 *   recalculateInvoiceFromPayments(invoice, payments) → { amount_paid, balance_due, status }
 *   syncInvoiceAfterPaymentChange({ invoiceId, invoices, payments }) → persists corrected totals
 *
 * Rules:
 *   - amount_paid = sum of all payments linked to this invoice
 *   - balance_due = invoice.amount - amount_paid  (never negative)
 *   - status derived: paid → balance_due === 0 AND amount_paid > 0
 *                     partial → 0 < amount_paid < invoice.amount
 *                     unpaid/sent/viewed/draft → untouched if no payments
 *   Only status transitions TO paid/partial/unpaid are managed here;
 *   other status values (overdue, closed, etc.) are never overwritten by this utility.
 */

import { base44 } from '@/api/base44Client';
import { logAudit } from '@/lib/audit';

// Statuses that indicate an invoice has no payments yet (we don't downgrade these to 'unpaid')
const PAYABLE_STATUSES = new Set(['sent', 'viewed', 'draft', 'partial', 'paid', 'overdue']);

/**
 * Pure function — computes corrected invoice financial fields from all linked payments.
 * Does NOT call the API.
 *
 * @param {object} invoice — the invoice record
 * @param {object[]} allPayments — ALL payments in system (will filter by invoice_id)
 * @returns {{ amount_paid: number, balance_due: number, status: string, changed: boolean }}
 */
export function recalculateInvoiceFromPayments(invoice, allPayments) {
  const linked = (allPayments || []).filter(p => p.invoice_id === invoice.id);
  const amount_paid = linked.reduce((s, p) => s + Number(p.amount || 0), 0);
  const invoiceTotal = Number(invoice.amount || 0);
  const balance_due = Math.max(0, invoiceTotal - amount_paid);

  let status = invoice.status;
  // Only touch status if the invoice is in a "payable" state
  if (PAYABLE_STATUSES.has(status)) {
    if (balance_due === 0 && amount_paid > 0) {
      status = 'paid';
    } else if (amount_paid > 0 && balance_due > 0) {
      status = 'partial';
    } else if (amount_paid === 0 && invoice.status === 'paid') {
      // Payment was deleted — revert to sent/viewed if it was paid
      status = 'sent';
    }
    // If amount_paid === 0 and status is draft/sent/viewed/overdue — leave it alone
  }

  const changed =
    Math.abs(Number(invoice.amount_paid || 0) - amount_paid) > 0.001 ||
    Math.abs(Number(invoice.balance_due ?? invoiceTotal) - balance_due) > 0.001 ||
    status !== invoice.status;

  return { amount_paid, balance_due, status, changed };
}

/**
 * Async — fetches all payments for this invoice, recomputes, and persists to the Invoice entity.
 * Safe to call after any payment create/edit/delete.
 *
 * @param {object} opts
 * @param {string}   opts.invoiceId   — invoice to sync
 * @param {object}   opts.invoice     — invoice object (optional; fetched if not provided)
 * @param {object[]} opts.payments    — all payments array (optional; fetched if not provided)
 * @param {string}   opts.actor       — email/name of who triggered this
 * @param {string}   opts.triggerAction — label for audit (e.g. 'payment_recorded')
 * @param {object}   opts.paymentMeta  — { id, amount, payment_date } of the triggering payment
 * @returns {Promise<{ amount_paid, balance_due, status }>}
 */
export async function syncInvoiceAfterPaymentChange({
  invoiceId,
  invoice: invoiceProp,
  payments: paymentsProp,
  actor = 'system',
  triggerAction = 'payment_recorded',
  paymentMeta = {},
}) {
  if (!invoiceId) return null;

  // Fetch invoice if not provided
  const invoice = invoiceProp || await (async () => {
    const results = await base44.entities.Invoice.filter({ id: invoiceId });
    return results[0];
  })();

  if (!invoice) return null;

  // Fetch all payments linked to this invoice if not provided
  const allLinkedPayments = paymentsProp
    ? paymentsProp.filter(p => p.invoice_id === invoiceId)
    : await base44.entities.Payment.filter({ invoice_id: invoiceId });

  const { amount_paid, balance_due, status, changed } = recalculateInvoiceFromPayments(
    invoice,
    allLinkedPayments.map(p => ({ ...p, invoice_id: invoiceId })) // ensure filter works on pure result
  );

  if (changed) {
    const oldAmountPaid = Number(invoice.amount_paid || 0);
    const oldBalanceDue = Number(invoice.balance_due ?? invoice.amount ?? 0);
    const oldStatus = invoice.status;

    await base44.entities.Invoice.update(invoiceId, {
      amount_paid,
      balance_due,
      status,
      ...(status === 'paid' && oldStatus !== 'paid' ? { paid_date: new Date().toISOString() } : {}),
    });

    // Audit the recalculation
    logAudit(
      invoiceId,
      'payment_applied',
      actor,
      `Invoice recalculated after ${triggerAction}. ` +
        `Paid: $${amount_paid.toFixed(2)}, Balance: $${balance_due.toFixed(2)}, Status: ${status}` +
        (paymentMeta.amount ? ` (payment $${Number(paymentMeta.amount).toFixed(2)} on ${paymentMeta.payment_date || 'unknown date'})` : ''),
      {
        module: 'payment',
        record_id: invoiceId,
        job_id: invoice.job_id,
        job_address: invoice.job_address,
        is_sensitive: true,
        old_value: JSON.stringify({ amount_paid: oldAmountPaid, balance_due: oldBalanceDue, status: oldStatus }),
        new_value: JSON.stringify({ amount_paid, balance_due, status }),
      }
    );
  }

  return { amount_paid, balance_due, status };
}