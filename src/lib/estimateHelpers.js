/** Generate a unique estimate number like EST-2026-042 */
export function generateEstimateNumber(existingNumbers = []) {
  const year = new Date().getFullYear();
  const prefix = `EST-${year}-`;
  const existing = existingNumbers
    .filter(n => n && n.startsWith(prefix))
    .map(n => parseInt(n.replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

/** Recalculate totals from line items array */
export function calcTotals(lineItems, taxRate = 0, discountAmount = 0) {
  const subtotal = lineItems.reduce((sum, li) => sum + (Number(li.qty) * Number(li.unit_price) || 0), 0);
  const tax_amount = subtotal * (Number(taxRate) / 100);
  const total = subtotal + tax_amount - Number(discountAmount);
  return { subtotal, tax_amount, total };
}

export const ESTIMATE_STATUS_CONFIG = {
  draft:          { label: 'Draft',              color: 'bg-slate-100 text-slate-600' },
  ready_to_send:  { label: 'Ready to Send',      color: 'bg-blue-100 text-blue-700' },
  sent:           { label: 'Sent',               color: 'bg-sky-100 text-sky-700' },
  viewed:         { label: 'Viewed',             color: 'bg-violet-100 text-violet-700' },
  approved:       { label: 'Approved',           color: 'bg-green-100 text-green-700' },
  rejected:       { label: 'Rejected',           color: 'bg-red-100 text-red-700' },
  expired:        { label: 'Expired',            color: 'bg-orange-100 text-orange-700' },
  in_revision:    { label: 'In Revision',        color: 'bg-amber-100 text-amber-700' },
  superseded:     { label: 'Superseded',         color: 'bg-gray-100 text-gray-500' },
  on_hold:        { label: 'On Hold',            color: 'bg-slate-100 text-slate-500' },
  canceled:       { label: 'Canceled',           color: 'bg-gray-100 text-gray-500' },
  converted:      { label: 'Converted',          color: 'bg-primary/10 text-primary' },
};