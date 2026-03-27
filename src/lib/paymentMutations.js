/**
 * paymentMutations.js — Phase 1B shared payment mutation logic.
 *
 * Single execution path for all payment create/delete operations across
 * PaymentsPage, Financials, and any future entry points.
 *
 * Each function:
 *  - resolves the actor from the current session
 *  - persists the entity change
 *  - fires audit logging
 *  - triggers invoice recalculation via syncInvoiceAfterPaymentChange
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
 * @param {object} payment — the full Payment record to delete
 * @returns {Promise<void>}
 */
export async function executePaymentDelete(payment) {
  const actor = await resolveActor();
  const invoiceId = payment.invoice_id;

  await base44.entities.Payment.delete(payment.id);

  // Audit: logged payment deleted
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

  // Sync linked invoice
  if (invoiceId) {
    await syncInvoiceAfterPaymentChange({
      invoiceId,
      actor,
      triggerAction: 'logged_payment_deleted',
      paymentMeta: { id: payment.id, amount: payment.amount, payment_date: payment.payment_date },
    });
  }
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