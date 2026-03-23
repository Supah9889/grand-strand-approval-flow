/**
 * Export helpers — validation, mapping, CSV/XLSX generation
 * Produces clean, consistently-named columns for each record type.
 */

// ── Shared formatters ────────────────────────────────────────────────────────

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

// ── Export Status constants ──────────────────────────────────────────────────
export const EXPORT_STATUS = {
  NOT_EXPORTED: 'not_exported',
  READY: 'ready',
  EXPORTED: 'exported',
  NEEDS_REVIEW: 'needs_review',
};

export const EXPORT_STATUS_CONFIG = {
  not_exported: { label: 'Not Exported', color: 'bg-slate-100 text-slate-600' },
  ready:        { label: 'Ready',        color: 'bg-blue-100 text-blue-700' },
  exported:     { label: 'Exported',     color: 'bg-green-100 text-green-700' },
  needs_review: { label: 'Needs Review', color: 'bg-orange-100 text-orange-700' },
};

// ── CSV builder ──────────────────────────────────────────────────────────────

export function buildCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[,"\n\r]/.test(s) ? `"${s}"` : s;
  };
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ];
  return lines.join('\n');
}

export function downloadCSV(csv, filename) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── XLSX builder (pure JS, no library needed) ────────────────────────────────
// Generates a minimal .xlsx file using a simple XML-based approach

export function downloadXLSX(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);

  // Simple XML escape
  const xe = (v) => String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Build rows XML
  let rowsXml = '';

  // Header row
  rowsXml += '<Row ss:StyleID="header">';
  headers.forEach(h => {
    rowsXml += `<Cell><Data ss:Type="String">${xe(h)}</Data></Cell>`;
  });
  rowsXml += '</Row>';

  // Data rows
  rows.forEach(r => {
    rowsXml += '<Row>';
    headers.forEach(h => {
      const v = r[h] ?? '';
      const isNum = v !== '' && !isNaN(Number(v)) && typeof v !== 'boolean';
      rowsXml += isNum
        ? `<Cell><Data ss:Type="Number">${xe(v)}</Data></Cell>`
        : `<Cell><Data ss:Type="String">${xe(v)}</Data></Cell>`;
    });
    rowsXml += '</Row>';
  });

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#E8F5E9" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Export">
    <Table>
      ${rowsXml}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Validation engine ────────────────────────────────────────────────────────

export function validateRecord(record, type) {
  const issues = [];

  switch (type) {
    case 'customers':
      if (!record.contact_name && !record.company_name) issues.push('Missing name');
      if (!record.email && !record.phone) issues.push('Missing contact info');
      if (!record.property_address) issues.push('Missing address');
      break;

    case 'jobs':
      if (!record.address) issues.push('Missing address');
      if (!record.customer_name) issues.push('Missing customer name');
      if (!record.price && record.price !== 0) issues.push('Missing price');
      if (record.price < 0) issues.push('Invalid price');
      break;

    case 'estimates':
      if (!record.client_name) issues.push('Missing client name');
      if (!record.date_created) issues.push('Missing date');
      if (!record.total && record.total !== 0) issues.push('Missing total');
      if (record.total < 0) issues.push('Invalid total');
      break;

    case 'invoices':
      if (!record.customer_name) issues.push('Missing customer name');
      if (!record.invoice_date) issues.push('Missing invoice date');
      if (!record.amount && record.amount !== 0) issues.push('Missing amount');
      if (record.amount < 0) issues.push('Invalid amount');
      if (!record.job_id) issues.push('Not linked to a job');
      break;

    case 'expenses':
      if (!record.vendor_name) issues.push('Missing vendor');
      if (!record.expense_date && !record.receipt_date) issues.push('Missing date');
      if (!record.total_amount && record.total_amount !== 0) issues.push('Missing amount');
      if (!record.cost_code) issues.push('Missing cost code');
      if (!record.job_id) issues.push('Not linked to a job');
      break;

    case 'bills':
      if (!record.vendor_name) issues.push('Missing vendor');
      if (!record.bill_date) issues.push('Missing bill date');
      if (!record.amount && record.amount !== 0) issues.push('Missing amount');
      if (!record.cost_code) issues.push('Missing cost code');
      break;

    case 'vendors':
      if (!record.company_name) issues.push('Missing company name');
      if (!record.email && !record.phone) issues.push('Missing contact info');
      break;

    case 'time_entries':
      if (!record.employee_name) issues.push('Missing employee name');
      if (!record.clock_in) issues.push('Missing clock-in time');
      if (!record.job_id) issues.push('Not linked to a job');
      if (!record.cost_code) issues.push('Missing cost code');
      if (record.status === 'clocked_in' && !record.clock_out) issues.push('Still clocked in');
      break;

    case 'cost_codes':
      if (!record.name) issues.push('Missing name');
      break;

    default:
      break;
  }

  return issues;
}

export function getExportStatus(record, type) {
  const issues = validateRecord(record, type);
  if (issues.length > 0) return EXPORT_STATUS.NEEDS_REVIEW;
  const qbStatus = record.qb_sync_status || record.qb_export_date;
  if (record.qb_export_batch_id || record.qb_export_date) return EXPORT_STATUS.EXPORTED;
  return EXPORT_STATUS.READY;
}

// ── Record mappers ───────────────────────────────────────────────────────────

export function mapCustomers(leads) {
  return leads.map(r => ({
    record_type:            'Customer',
    internal_id:            r.id,
    contact_name:           r.contact_name || '',
    company_name:           r.company_name || '',
    contact_type:           r.contact_type || '',
    email:                  r.email || '',
    phone:                  r.phone || '',
    phone_secondary:        r.phone_secondary || '',
    property_address:       r.property_address || '',
    city:                   r.city || '',
    state:                  r.state || '',
    zip:                    r.zip || '',
    mailing_address:        r.mailing_address || '',
    lead_source:            r.lead_source || '',
    status:                 r.status || '',
    assigned_to:            r.assigned_to || '',
    approximate_value:      fmtMoney(r.approximate_value),
    billing_type:           r.billing_type || '',
    converted_to_job:       r.converted_to_job ? 'Yes' : 'No',
    linked_job_id:          r.linked_job_id || '',
    linked_job_address:     r.linked_job_address || '',
    created_date:           fmtDate(r.created_date),
    last_modified_date:     fmtDate(r.updated_date),
    export_status:          getExportStatus(r, 'customers'),
    qb_export_batch_id:     r.qb_export_batch_id || '',
    qb_export_date:         fmtDate(r.qb_export_date),
  }));
}

export function mapEstimates(estimates) {
  return estimates.map(r => ({
    record_type:            'Estimate',
    internal_id:            r.id,
    estimate_number:        r.estimate_number || '',
    estimate_type:          r.estimate_type || '',
    status:                 r.status || '',
    version:                r.version || 1,
    title:                  r.title || '',
    client_name:            r.client_name || '',
    company_name:           r.company_name || '',
    client_email:           r.client_email || '',
    client_phone:           r.client_phone || '',
    property_address:       r.property_address || '',
    mailing_address:        r.mailing_address || '',
    linked_job_id:          r.linked_job_id || '',
    linked_job_address:     r.linked_job_address || '',
    service_type:           r.service_type || '',
    billing_type:           r.billing_type || '',
    scope_summary:          r.scope_summary || '',
    subtotal:               fmtMoney(r.subtotal),
    tax_amount:             fmtMoney(r.tax_amount),
    discount_amount:        fmtMoney(r.discount_amount),
    total:                  fmtMoney(r.total),
    deposit_amount:         fmtMoney(r.deposit_amount),
    date_created:           fmtDate(r.date_created),
    sent_date:              fmtDate(r.sent_date),
    expiration_date:        fmtDate(r.expiration_date),
    approval_date:          fmtDate(r.approval_date),
    assigned_to:            r.assigned_to || '',
    created_date:           fmtDate(r.created_date),
    last_modified_date:     fmtDate(r.updated_date),
    export_status:          getExportStatus(r, 'estimates'),
    qb_export_batch_id:     r.qb_export_batch_id || '',
  }));
}

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
    export_status:          getExportStatus(r, 'invoices'),
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
    export_status:          getExportStatus(r, 'bills'),
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
    export_status:          getExportStatus(r, 'expenses'),
    qb_expense_id:          r.qb_expense_id || '',
    qb_vendor_id:           r.qb_vendor_id || '',
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
    export_status:          getExportStatus(r, 'vendors'),
    qb_vendor_id:           r.qb_vendor_id || '',
    qb_sync_status:         r.qb_sync_status || '',
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
    export_status:          getExportStatus(r, 'time_entries'),
    qb_time_activity_id:    r.qb_time_activity_id || '',
    qb_employee_id:         r.qb_employee_id || '',
    qb_sync_status:         r.qb_sync_status || '',
    qb_export_batch_id:     r.qb_export_batch_id || '',
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
    export_status:           getExportStatus(r, 'jobs'),
    qb_customer_id:          r.qb_customer_id || '',
    qb_project_id:           r.qb_project_id || '',
    qb_sync_status:          r.qb_sync_status || '',
    qb_export_date:          fmtDate(r.qb_export_date),
  }));
}

export function mapCostCodes(codes) {
  return codes.map(r => ({
    record_type:      'CostCode',
    internal_id:      r.id,
    code_number:      r.code_number || '',
    name:             r.name || '',
    description:      r.description || '',
    category:         r.category || '',
    allowed_on:       r.allowed_on || '',
    qb_account_name:  r.qb_account_name || '',
    qb_account_id:    r.qb_account_id || '',
    qb_item_name:     r.qb_item_name || '',
    active:           r.active ? 'Active' : 'Inactive',
    created_by:       r.created_by_name || '',
    created_date:     fmtDate(r.created_date),
    export_status:    getExportStatus(r, 'cost_codes'),
  }));
}

// ── Export type registry ─────────────────────────────────────────────────────
export const EXPORT_TYPES = [
  {
    key: 'customers',    label: 'Customers',         icon: '👤',
    mapper: mapCustomers,   entity: 'Lead',        dateField: 'created_date',
    description: 'Leads & customer contacts',
  },
  {
    key: 'jobs',         label: 'Jobs / Projects',   icon: '🏗️',
    mapper: mapJobs,        entity: 'Job',         dateField: 'created_date',
    description: 'All project records',
  },
  {
    key: 'estimates',    label: 'Estimates',          icon: '📋',
    mapper: mapEstimates,   entity: 'Estimate',    dateField: 'date_created',
    description: 'Estimates, proposals & bids',
  },
  {
    key: 'invoices',     label: 'Invoices',           icon: '🧾',
    mapper: mapInvoices,    entity: 'Invoice',     dateField: 'invoice_date',
    description: 'Customer invoices & billing',
  },
  {
    key: 'expenses',     label: 'Expenses',           icon: '🧾',
    mapper: mapExpenses,    entity: 'Expense',     dateField: 'expense_date',
    description: 'Employee & job expenses',
  },
  {
    key: 'bills',        label: 'Bills',              icon: '📄',
    mapper: mapBills,       entity: 'Bill',        dateField: 'bill_date',
    description: 'Vendor bills & payables',
  },
  {
    key: 'vendors',      label: 'Vendors / Subs',     icon: '🏢',
    mapper: mapVendors,     entity: 'Vendor',      dateField: null,
    description: 'Vendors & subcontractors',
  },
  {
    key: 'time_entries', label: 'Time Entries',       icon: '⏱️',
    mapper: mapTimeEntries, entity: 'TimeEntry',   dateField: 'entry_date',
    description: 'Employee time & labor',
  },
  {
    key: 'cost_codes',   label: 'Cost Codes',         icon: '🏷️',
    mapper: mapCostCodes,   entity: 'CostCode',    dateField: null,
    description: 'Cost code reference list',
  },
];