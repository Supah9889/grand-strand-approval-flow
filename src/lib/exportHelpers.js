/**
 * Export helpers — QB-ready CSV generation
 * Produces clean, consistently-named columns for each record type.
 */

// ── Shared formatters ───────────────────────────────────────────────────────

export function fmtDate(v) {
  if (!v) return '';
  return (v.split('T')[0]) || '';
}

export function fmtMoney(v) {
  if (v === null || v === undefined || v === '') return '';
  return Number(v).toFixed(2);
}

export function fmtHours(mins) {
  if (!mins && mins !== 0) return '';
  return (mins / 60).toFixed(2);
}

// ── CSV builder ──────────────────────────────────────────────────────────────

export function buildCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[,"\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ];
  return lines.join('\n');
}

export function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Record mappers ───────────────────────────────────────────────────────────

export function mapInvoices(invoices) {
  return invoices.map(r => ({
    record_type:            'Invoice',
    internal_id:            r.id,
    invoice_number:         r.invoice_number || '',
    invoice_date:           fmtDate(r.invoice_date),
    due_date:               fmtDate(r.due_date),
    sent_date:              fmtDate(r.sent_date),
    paid_date:              fmtDate(r.paid_date),
    customer_name:          r.customer_name || '',
    customer_id:            r.customer_id || '',
    customer_email:         r.customer_email || '',
    billing_address:        r.billing_address || '',
    job_id:                 r.job_id || '',
    job_address:            r.job_address || '',
    job_title:              r.job_title || '',
    status:                 r.status || '',
    subtotal:               fmtMoney(r.subtotal || r.amount),
    tax_amount:             fmtMoney(r.tax_amount),
    discount_amount:        fmtMoney(r.discount_amount),
    total_amount:           fmtMoney(r.amount),
    amount_paid:            fmtMoney(r.amount_paid),
    balance_due:            fmtMoney(r.balance_due),
    is_taxable:             r.is_taxable ? 'Yes' : 'No',
    cost_code:              r.cost_code || '',
    memo:                   r.memo || r.notes || '',
    source_type:            r.source_type || '',
    source_system:          r.source_system || '',
    created_by:             r.created_by_name || '',
    last_modified_by:       r.last_modified_by || '',
    created_date:           fmtDate(r.created_date),
    last_modified_date:     fmtDate(r.updated_date),
    qb_invoice_id:          r.qb_invoice_id || '',
    qb_customer_id:         r.qb_customer_id || '',
    qb_sync_status:         r.qb_sync_status || '',
    qb_export_batch_id:     r.qb_export_batch_id || '',
    qb_export_date:         fmtDate(r.qb_export_date),
  }));
}

export function mapBills(bills) {
  return bills.map(r => ({
    record_type:            'Bill',
    internal_id:            r.id,
    bill_number:            r.bill_number || '',
    bill_date:              fmtDate(r.bill_date),
    due_date:               fmtDate(r.due_date),
    vendor_name:            r.vendor_name || '',
    vendor_id:              r.vendor_id || '',
    job_id:                 r.job_id || '',
    job_address:            r.job_address || '',
    job_title:              r.job_title || '',
    customer_name:          r.customer_name || '',
    status:                 r.status || '',
    category:               r.category || '',
    cost_code:              r.cost_code || '',
    qb_account_name:        r.qb_account_name || '',
    subtotal:               fmtMoney(r.subtotal || r.amount),
    tax_amount:             fmtMoney(r.tax_amount),
    total_amount:           fmtMoney(r.amount),
    is_taxable:             r.is_taxable ? 'Yes' : 'No',
    memo:                   r.memo || r.notes || '',
    source_system:          r.source_system || '',
    created_by:             r.created_by_name || '',
    last_modified_by:       r.last_modified_by || '',
    created_date:           fmtDate(r.created_date),
    last_modified_date:     fmtDate(r.updated_date),
    qb_bill_id:             r.qb_bill_id || '',
    qb_vendor_id:           r.qb_vendor_id || '',
    qb_sync_status:         r.qb_sync_status || '',
    qb_export_batch_id:     r.qb_export_batch_id || '',
    qb_export_date:         fmtDate(r.qb_export_date),
  }));
}

export function mapExpenses(expenses) {
  return expenses.map(r => ({
    record_type:            'Expense',
    internal_id:            r.id,
    expense_number:         r.expense_number || '',
    expense_date:           fmtDate(r.expense_date || r.receipt_date),
    vendor_name:            r.vendor_name || '',
    vendor_id:              r.vendor_id || '',
    job_id:                 r.job_id || '',
    job_address:            r.job_address || '',
    job_title:              r.job_title || '',
    customer_name:          r.customer_name || '',
    category:               r.category || '',
    cost_code:              r.cost_code || '',
    qb_account_name:        r.qb_account_name || '',
    receipt_number:         r.receipt_number || '',
    store_location:         r.store_location || '',
    subtotal:               fmtMoney(r.subtotal),
    tax_amount:             fmtMoney(r.tax_amount),
    total_amount:           fmtMoney(r.total_amount),
    is_taxable:             r.is_taxable ? 'Yes' : 'No',
    description:            r.description || '',
    memo:                   r.memo || r.notes || '',
    approval_status:        r.approval_status || '',
    approved_by:            r.approved_by || '',
    submitted_by:           r.submitted_by || '',
    source_system:          r.source_system || '',
    created_by:             r.created_by_name || '',
    last_modified_by:       r.last_modified_by || '',
    created_date:           fmtDate(r.created_date),
    last_modified_date:     fmtDate(r.updated_date),
    qb_expense_id:          r.qb_expense_id || '',
    qb_vendor_id:           r.qb_vendor_id || '',
    qb_sync_status:         r.qb_sync_status || '',
    qb_export_batch_id:     r.qb_export_batch_id || '',
    qb_export_date:         fmtDate(r.qb_export_date),
  }));
}

export function mapTimeEntries(entries) {
  return entries.map(r => ({
    record_type:            'TimeEntry',
    internal_id:            r.id,
    entry_date:             fmtDate(r.entry_date),
    clock_in:               r.clock_in ? r.clock_in.replace('T', ' ').slice(0, 16) : '',
    clock_out:              r.clock_out ? r.clock_out.replace('T', ' ').slice(0, 16) : '',
    total_hours:            r.total_hours ? Number(r.total_hours).toFixed(2) : fmtHours(r.duration_minutes),
    employee_name:          r.employee_name || '',
    employee_id:            r.employee_id || '',
    employee_code:          r.employee_code || '',
    job_id:                 r.job_id || '',
    job_address:            r.job_address || '',
    job_title:              r.job_title || '',
    customer_name:          r.customer_name || '',
    cost_code:              r.cost_code || '',
    labor_category:         r.labor_category || '',
    status:                 r.status || '',
    approval_status:        r.approval_status || '',
    approved_by:            r.approved_by || '',
    memo:                   r.memo || r.employee_note || r.note || '',
    entry_source:           r.entry_source || '',
    manual_adjustment:      r.manual_adjustment ? 'Yes' : 'No',
    created_by:             r.created_by_name || '',
    last_modified_by:       r.last_updated_by || '',
    created_date:           fmtDate(r.created_date),
    last_modified_date:     fmtDate(r.updated_date),
    qb_time_activity_id:    r.qb_time_activity_id || '',
    qb_employee_id:         r.qb_employee_id || '',
    qb_sync_status:         r.qb_sync_status || '',
    qb_export_batch_id:     r.qb_export_batch_id || '',
    qb_export_date:         fmtDate(r.qb_export_date),
  }));
}

export function mapVendors(vendors) {
  return vendors.map(r => ({
    record_type:            'Vendor',
    internal_id:            r.id,
    vendor_number:          r.vendor_number || '',
    company_name:           r.company_name || '',
    display_name:           r.display_name || r.company_name || '',
    contact_name:           r.contact_name || '',
    email:                  r.email || '',
    phone:                  r.phone || '',
    phone_secondary:        r.phone_secondary || '',
    address:                r.address || '',
    city:                   r.city || '',
    state:                  r.state || '',
    zip:                    r.zip || '',
    type:                   r.type || '',
    default_cost_code:      r.default_cost_code || '',
    default_qb_account:     r.default_qb_account || '',
    is_1099:                r.is_1099 ? 'Yes' : 'No',
    active:                 r.active ? 'Active' : 'Inactive',
    memo:                   r.memo || r.notes || '',
    source_system:          r.source_system || '',
    created_by:             r.created_by_name || '',
    created_date:           fmtDate(r.created_date),
    qb_vendor_id:           r.qb_vendor_id || '',
    qb_sync_status:         r.qb_sync_status || '',
    qb_export_date:         fmtDate(r.qb_export_date),
  }));
}

export function mapJobs(jobs) {
  return jobs.map(r => ({
    record_type:             'Job',
    internal_id:             r.id,
    job_number:              r.job_number || '',
    title:                   r.title || '',
    address:                 r.address || '',
    city:                    r.city || '',
    state:                   r.state || '',
    zip:                     r.zip || '',
    customer_name:           r.customer_name || '',
    customer_id:             r.customer_id || '',
    customer_email:          r.customer_email || r.email || '',
    customer_phone:          r.customer_phone || r.phone || '',
    billing_address:         r.billing_address || '',
    description:             r.description || '',
    price:                   fmtMoney(r.price),
    job_group:               r.job_group || '',
    lifecycle_status:        r.lifecycle_status || '',
    approval_status:         r.status || '',
    assigned_to:             r.assigned_to || '',
    linked_estimate_number:  r.linked_estimate_number || '',
    linked_invoice_number:   r.linked_invoice_number || '',
    start_date:              fmtDate(r.start_date),
    end_date:                fmtDate(r.end_date),
    approval_timestamp:      fmtDate(r.approval_timestamp),
    source_system:           r.source_system || '',
    created_date:            fmtDate(r.created_date),
    last_modified_date:      fmtDate(r.updated_date),
    qb_customer_id:          r.qb_customer_id || '',
    qb_project_id:           r.qb_project_id || '',
    qb_sync_status:          r.qb_sync_status || '',
    qb_export_date:          fmtDate(r.qb_export_date),
  }));
}

export function mapEmployees(employees) {
  return employees.map(r => ({
    record_type:         'Employee',
    internal_id:         r.id,
    employee_number:     r.employee_number || '',
    name:                r.name || '',
    employee_code:       r.employee_code || '',
    role:                r.role || '',
    email:               r.email || '',
    phone:               r.phone || '',
    default_cost_code:   r.default_cost_code || '',
    active:              r.active ? 'Active' : 'Inactive',
    source_system:       r.source_system || '',
    created_date:        fmtDate(r.created_date),
    qb_employee_id:      r.qb_employee_id || '',
    qb_sync_status:      r.qb_sync_status || '',
  }));
}

// ── Export type registry ─────────────────────────────────────────────────────
export const EXPORT_TYPES = [
  { key: 'invoices',     label: 'Invoices',      mapper: mapInvoices,    entity: 'Invoice',     dateField: 'invoice_date' },
  { key: 'bills',        label: 'Bills',          mapper: mapBills,       entity: 'Bill',        dateField: 'bill_date' },
  { key: 'expenses',     label: 'Expenses',       mapper: mapExpenses,    entity: 'Expense',     dateField: 'expense_date' },
  { key: 'time_entries', label: 'Time Entries',   mapper: mapTimeEntries, entity: 'TimeEntry',   dateField: 'entry_date' },
  { key: 'vendors',      label: 'Vendors',        mapper: mapVendors,     entity: 'Vendor',      dateField: null },
  { key: 'jobs',         label: 'Jobs/Projects',  mapper: mapJobs,        entity: 'Job',         dateField: 'start_date' },
  { key: 'employees',    label: 'Employees',      mapper: mapEmployees,   entity: 'Employee',    dateField: null },
];