/**
 * paymentMutations.js — Phase 1B/1C shared payment mutation logic.
 *
 * Single execution path for all payment create/delete operations across
 * PaymentsPage, Financials, and any future entry points.
 *
 * Each function:
 *  - resolves the actor from the current session
 *  - persists the entity change
 *  - fires audit logging (fire-and-forget — never blocks the primary operation)
 *  - triggers invoice recalculation via syncInvoiceAfterPaymentChange
 *
 * Phase 1C hardening:
 *  - executePaymentDelete uses a two-phase error model:
 *    Phase A (entity delete) — hard failure: throws, caller sees error, no state changed.
 *    Phase B (invoice sync)  — best-effort: always attempted after a successful delete,
 *      logs a warning audit if it fails, and re-throws so the caller can re-fetch and
 *      show an appropriate message.
 *  - Audit is written after entity delete succeeds (fire-and-forget, never blocks).
 *
 * Returns the created/deleted record so callers can react (e.g. show toast).
 */

import { base44 } from '@/api/base44Client';
import { audit } from '@/lib/audit';
import { fmt } from '@/lib/financialHelpers';
import { syncInvoiceAfterPaymentChange } from '@/lib/paymentIntegrity';

/** Resolve the current actor string (email preferred, falls back to role). */
async function resolveActor() {
  const user = await base44.auth.me().catch(() => null);
  return user?.email || user?.full_name || 'system';
}

/**
 * Create a payment, emit audit, and sync the linked invoice.
 *
 * @param {object} data — payment fields (amount, invoice_id, job_id, payment_date, …)
 * @returns {Promise<object>} the created Payment record
 */
export async function executePaymentCreate(data) {
  const actor = await resolveActor();

  const payment = await base44.entities.Payment.create(data);

  // Audit: payment recorded
  audit.payment.recorded(
    payment.id,
    actor,
    payment.customer_name || payment.job_address || 'unknown',
    fmt(payment.amount),
    {
      job_id: payment.job_id,
      job_address: payment.job_address,
      record_id: payment.id,
      is_sensitive: true,
      new_value: JSON.stringify({
        amount: payment.amount,
        payment_date: payment.payment_date,
        invoice_id: payment.invoice_id,
      }),
    }
  );

  // Sync linked invoice
  if (data.invoice_id) {
    await syncInvoiceAfterPaymentChange({
      invoiceId: data.invoice_id,
      actor,
      triggerAction: 'payment_recorded',
      paymentMeta: { id: payment.id, amount: data.amount, payment_date: data.payment_date },
    });
  }

  return payment;
}

/**
 * Delete a logged payment, emit audit, and sync the linked invoice.
 *
 * Phase 1C two-phase error model:
 *  - Phase A: entity delete — any failure here throws immediately; nothing has changed.
 *  - Phase B: invoice sync — attempted after successful delete. If it fails, a warning
 *    audit is written and the error is re-thrown so the caller can re-fetch true state.
 *    The payment IS deleted at this point; the caller should still invalidate caches.
 *
 * @param {object} payment — the full Payment record to delete
 * @returns {Promise<{ invoiceSynced: boolean }>}
 *   invoiceSynced = false signals a partial success (payment deleted, sync failed).
 */
export async function executePaymentDelete(payment) {
  const actor = await resolveActor();
  const invoiceId = payment.invoice_id;

  // ── Phase A: delete the entity. Hard failure — throws if it fails. ──────────
  await base44.entities.Payment.delete(payment.id);

  // ── Audit: fire-and-forget after successful delete ───────────────────────────
  // Never await — audit failure must never block the caller or hide the delete result.
  audit.payment.deleted(
    payment.id,
    actor,
    `$${fmt(payment.amount)} from ${payment.customer_name || payment.job_address || 'unknown'} on ${payment.payment_date || 'unknown date'}`,
    {
      job_id: payment.job_id,
      job_address: payment.job_address,
      record_id: payment.id,
      is_sensitive: true,
      old_value: JSON.stringify({
        amount: payment.amount,
        payment_date: payment.payment_date,
        invoice_id: invoiceId,
      }),
    }
  );

  // ── Phase B: invoice sync — best-effort, but surface failures ───────────────
  if (invoiceId) {
    try {
      await syncInvoiceAfterPaymentChange({
        invoiceId,
        actor,
        triggerAction: 'logged_payment_deleted',
        paymentMeta: { id: payment.id, amount: payment.amount, payment_date: payment.payment_date },
      });
    } catch (syncErr) {
      // Payment is already deleted. Log the sync failure and signal the caller
      // so it can re-fetch and show a warning (invoice totals may be stale).
      audit.payment.edited(
        invoiceId,
        actor,
        `Invoice sync failed after payment deletion (payment ${payment.id}): ${syncErr?.message || 'unknown error'}`,
        {
          job_id: payment.job_id,
          job_address: payment.job_address,
          is_sensitive: true,
          new_value: 'sync_failed',
        }
      );
      // Re-throw a descriptive error so the caller can handle the partial-success state.
      const err = new Error(
        `Payment deleted but invoice totals could not be recalculated. Please refresh to see the current balance.`
      );
      err.partialSuccess = true; // flag: payment IS gone, only sync failed
      err.invoiceId = invoiceId;
      throw err;
    }
  }

  return { invoiceSynced: !!invoiceId };
}

/** The canonical set of query keys to invalidate after any payment mutation. */
export const PAYMENT_QUERY_KEYS = [
  ['payments'],
  ['invoices'],
  ['jobs'],
];

/**
 * Convenience: invalidate all payment-related caches via a React Query client.
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 */
export function invalidatePaymentQueries(queryClient) {
  PAYMENT_QUERY_KEYS.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
}