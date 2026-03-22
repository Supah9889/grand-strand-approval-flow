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

export function calcJobFinancials({ budget, expenses, timeEntries, changeOrders, invoices, payments }) {
  const approvedCORevenue = (changeOrders || [])
    .filter(co => co.status === 'approved')
    .reduce((s, co) => s + Number(co.total_financial_impact || 0), 0);

  const estimatedRevenue = Number(budget?.estimated_revenue || 0);
  const totalExpectedRevenue = estimatedRevenue + approvedCORevenue;

  const laborCost = (timeEntries || []).reduce((s, t) => {
    const hrs = Number(t.duration_minutes || 0) / 60;
    const rate = Number(t.hourly_rate || 0);
    return s + (rate > 0 ? hrs * rate : 0);
  }, 0);
  const laborHours = (timeEntries || []).reduce((s, t) => s + Number(t.duration_minutes || 0) / 60, 0);

  const materialCost = (expenses || []).filter(e =>
    ['Paint Expenses','Other'].includes(e.cost_code) || !e.cost_code
  ).reduce((s, e) => s + Number(e.total_amount || 0), 0);

  const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.total_amount || 0), 0);
  const otherCost = totalExpenses - materialCost;

  const totalJobCost = laborCost + totalExpenses;

  const invoicesSent = (invoices || []).filter(i => !['draft','closed'].includes(i.status))
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const paymentsReceived = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const remainingBalance = invoicesSent - paymentsReceived;

  const grossProfit = totalExpectedRevenue - totalJobCost;
  const grossMarginPct = totalExpectedRevenue > 0 ? (grossProfit / totalExpectedRevenue) * 100 : 0;

  return {
    estimatedRevenue, approvedCORevenue, totalExpectedRevenue,
    laborCost, laborHours, materialCost, otherCost, totalJobCost,
    invoicesSent, paymentsReceived, remainingBalance,
    grossProfit, grossMarginPct,
  };
}