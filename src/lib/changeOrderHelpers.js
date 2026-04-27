export const CO_STATUS_CONFIG = {
  draft:      { label: 'Draft',       color: 'bg-slate-100 text-slate-600' },
  in_review:  { label: 'In Review',   color: 'bg-violet-100 text-violet-700' },
  sent:       { label: 'Sent',        color: 'bg-blue-100 text-blue-700' },
  approved:   { label: 'Approved',    color: 'bg-green-100 text-green-700' },
  rejected:   { label: 'Rejected',    color: 'bg-red-100 text-red-700' },
  closed:     { label: 'Closed',      color: 'bg-gray-100 text-gray-500' },
  canceled:   { label: 'Canceled',    color: 'bg-gray-100 text-gray-400' },
  superseded: { label: 'Superseded',  color: 'bg-amber-100 text-amber-700' },
};

export const CO_CATEGORY_LABELS = {
  additional_work:     'Additional Work',
  scope_reduction:     'Scope Reduction',
  material_change:     'Material Change',
  schedule_change:     'Schedule Change',
  unforeseen_condition:'Unforeseen Condition',
  customer_request:    'Customer Request',
  vendor_request:      'Vendor/Sub Request',
  internal_adjustment: 'Internal Adjustment',
  warranty_exclusion:  'Warranty Exclusion',
  other:               'Other',
};

export function generateCONumber(existingNums = []) {
  const year = new Date().getFullYear();
  const prefix = `CO-${year}-`;
  const used = existingNums
    .filter(n => n?.startsWith(prefix))
    .map(n => parseInt(n.replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

export function calcCOTotal(cost_impact = 0, tax_impact = 0) {
  return Number(cost_impact) + Number(tax_impact);
}