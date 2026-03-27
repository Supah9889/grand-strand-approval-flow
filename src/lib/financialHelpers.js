export const INVOICE_STATUS_CONFIG = {
  draft:   { label: 'Draft',    color: 'bg-slate-100 text-slate-600' },
  sent:    { label: 'Sent',     color: 'bg-blue-100 text-blue-700' },
  viewed:  { label: 'Viewed',   color: 'bg-violet-100 text-violet-700' },
  paid:    { label: 'Paid',     color: 'bg-green-100 text-green-700' },
  partial: { label: 'Partial',  color: 'bg-amber-100 text-amber-700' },
  overdue: { label: 'Overdue',  color: 'bg-red-100 text-red-700' },
  closed:  { label: 'Closed',   color: 'bg-gray-100 text-gray-500' },
};

export const BILL_STATUS_CONFIG = {
  draft:   { label: 'Draft',    color: 'bg-slate-100 text-slate-600' },
  open:    { label: 'Open',     color: 'bg-amber-100 text-amber-700' },
  paid:    { label: 'Paid',     color: 'bg-green-100 text-green-700' },
  overdue: { label: 'Overdue',  color: 'bg-red-100 text-red-700' },
  closed:  { label: 'Closed',   color: 'bg-gray-100 text-gray-500' },
};

export const PO_STATUS_CONFIG = {
  draft:    { label: 'Draft',    color: 'bg-slate-100 text-slate-600' },
  sent:     { label: 'Sent',     color: 'bg-blue-100 text-blue-700' },
  ordered:  { label: 'Ordered',  color: 'bg-violet-100 text-violet-700' },
  received: { label: 'Received', color: 'bg-green-100 text-green-700' },
  closed:   { label: 'Closed',   color: 'bg-gray-100 text-gray-500' },
  canceled: { label: 'Canceled', color: 'bg-gray-100 text-gray-400' },
};

export function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function generateNumber(prefix, existing = []) {
  const year = new Date().getFullYear();
  const p = `${prefix}-${year}-`;
  const used = existing.filter(n => n?.startsWith(p)).map(n => parseInt(n.replace(p, ''), 10)).filter(n => !isNaN(n));
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `${p}${String(next).padStart(3, '0')}`;
}

// ─── Cost bucket mapping ────────────────────────────────────────────────────
// Maps expense categories and cost codes to standardized cost buckets.
// Buckets: labor | materials | subcontractor | fees | equipment | other

const EXPENSE_CATEGORY_BUCKET = {
  materials:        'materials',
  tools_equipment:  'equipment',
  fuel_travel:      'other',
  subcontractor:    'subcontractor',
  permit_fees:      'fees',
  disposal:         'fees',
  meals:            'other',
  office_supplies:  'other',
  other:            'other',
};

const COST_CODE_BUCKET = {
  'Paint Expenses':       'materials',
  'Carpentry Labor/Sub':  'subcontractor',
  'Drywall Labor/Sub':    'subcontractor',
  'Other Labor/Sub':      'subcontractor',
  'Painting Labor/Sub':   'subcontractor',
};

/**
 * Map a single expense record to its cost bucket.
 * Priority: cost_code match → category match → 'other'
 */
export function getExpenseBucket(expense) {
  if (expense.cost_code && COST_CODE_BUCKET[expense.cost_code]) {
    return COST_CODE_BUCKET[expense.cost_code];
  }
  return EXPENSE_CATEGORY_BUCKET[expense.category] || 'other';
}

/**
 * Compute total labor hours from time entries.
 * Uses total_hours if present, otherwise derives from duration_minutes.
 */
function totalLaborHours(timeEntries) {
  return (timeEntries || []).reduce((s, t) => {
    const hrs = Number(t.total_hours || 0) || (Number(t.duration_minutes || 0) / 60);
    return s + hrs;
  }, 0);
}

/**
 * Compute labor cost from time entries.
 * Uses labor_cost if already calculated on the record, otherwise hourly_rate * hours.
 * If no rate data is available, tracks hours only (cost remains 0).
 */
function totalLaborCost(timeEntries) {
  return (timeEntries || []).reduce((s, t) => {
    if (Number(t.labor_cost || 0) > 0) return s + Number(t.labor_cost);
    const hrs = Number(t.total_hours || 0) || (Number(t.duration_minutes || 0) / 60);
    const rate = Number(t.hourly_rate || 0);
    return s + (rate > 0 ? hrs * rate : 0);
  }, 0);
}

/**
 * Core job financial rollup. Single calculation path used by all financial views.
 *
 * @param {object} opts
 * @param {object}   opts.budget         — JobBudget record (optional)
 * @param {object}   opts.job            — Job record (optional, for contract price fallback)
 * @param {object[]} opts.expenses       — Expense records linked to this job
 * @param {object[]} opts.bills          — Bill records linked to this job (optional)
 * @param {object[]} opts.timeEntries    — TimeEntry records linked to this job
 * @param {object[]} opts.changeOrders   — ChangeOrder records linked to this job
 * @param {object[]} opts.invoices       — Invoice records linked to this job
 * @param {object[]} opts.payments       — Payment records linked to this job
 */
export function calcJobFinancials({
  budget,
  job,
  expenses = [],
  bills = [],
  timeEntries = [],
  changeOrders = [],
  invoices = [],
  payments = [],
}) {
  // ── Revenue ──────────────────────────────────────────────────────────────
  const approvedCORevenue = (changeOrders || [])
    .filter(co => co.status === 'approved')
    .reduce((s, co) => s + Number(co.total_financial_impact || 0), 0);

  // Use budget estimated_revenue → job.price as fallback
  const estimatedRevenue = Number(budget?.estimated_revenue || 0) || Number(job?.price || 0);
  const totalExpectedRevenue = estimatedRevenue + approvedCORevenue;

  // ── Labor ─────────────────────────────────────────────────────────────────
  const laborHours = totalLaborHours(timeEntries);
  const laborCost  = totalLaborCost(timeEntries);

  // ── Expense cost buckets ──────────────────────────────────────────────────
  const activeExpenses = (expenses || []).filter(e => e.inbox_status !== 'archived');

  let materialsCost    = 0;
  let subcontractorCost = 0;
  let feesCost         = 0;
  let equipmentCost    = 0;
  let otherExpenseCost = 0;

  for (const e of activeExpenses) {
    const amt = Number(e.total_amount || 0);
    const bucket = getExpenseBucket(e);
    if (bucket === 'materials')     materialsCost     += amt;
    else if (bucket === 'subcontractor') subcontractorCost += amt;
    else if (bucket === 'fees')     feesCost          += amt;
    else if (bucket === 'equipment') equipmentCost    += amt;
    else                            otherExpenseCost  += amt;
  }

  // ── Bills (paid subcontractor/vendor costs) ───────────────────────────────
  const activeBills = (bills || []).filter(b => !['closed'].includes(b.status));
  const billTotal = activeBills.reduce((s, b) => s + Number(b.amount || 0), 0);
  // Bills fold into subcontractor bucket by default (most bills are sub/vendor payments)
  subcontractorCost += billTotal;

  const totalExpenses  = materialsCost + subcontractorCost + feesCost + equipmentCost + otherExpenseCost;
  const totalJobCost   = laborCost + totalExpenses;

  // ── Billing & payments ────────────────────────────────────────────────────
  const invoicesSent = (invoices || [])
    .filter(i => !['draft', 'closed'].includes(i.status))
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const paymentsReceived = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const remainingBalance = Math.max(0, invoicesSent - paymentsReceived);

  // ── Profit ────────────────────────────────────────────────────────────────
  const grossProfit    = totalExpectedRevenue - totalJobCost;
  const grossMarginPct = totalExpectedRevenue > 0 ? (grossProfit / totalExpectedRevenue) * 100 : 0;

  return {
    // Revenue
    estimatedRevenue,
    approvedCORevenue,
    totalExpectedRevenue,
    // Labor
    laborCost,
    laborHours,
    // Cost buckets
    materialsCost,
    subcontractorCost,
    feesCost,
    equipmentCost,
    otherExpenseCost,
    billTotal,
    // Totals
    totalExpenses,
    totalJobCost,
    // Billing
    invoicesSent,
    paymentsReceived,
    remainingBalance,
    // Profit
    grossProfit,
    grossMarginPct,
    // Legacy aliases (keep existing callers working)
    materialCost: materialsCost,
    otherCost: otherExpenseCost,
  };
}