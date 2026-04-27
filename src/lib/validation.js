/**
 * Centralized validation framework.
 * Each validator returns an array of { field, message, level } objects.
 * level: 'error' (blocks save/status change) | 'warning' (shows but allows save)
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────
const err  = (field, message) => ({ field, message, level: 'error' });
const warn = (field, message) => ({ field, message, level: 'warning' });

function hasValue(v) {
  return v !== null && v !== undefined && String(v).trim() !== '' && v !== 0 && v !== '0';
}
function isPositive(v) {
  return parseFloat(v) > 0;
}
function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));
}
function isPhone(v) {
  return /[\d\-\+\(\)\s]{7,}/.test(String(v || ''));
}

// ─── Job / Project ────────────────────────────────────────────────────────────
export function validateJob(job) {
  const issues = [];
  // Only the assembled address string is required — city/state/zip are optional components
  if (!hasValue(job.address))        issues.push(err('address', 'Street address is required'));
  if (!hasValue(job.customer_name))  issues.push(err('customer_name', 'Customer name is required'));
  if (!hasValue(job.description))    issues.push(err('description', 'Job description is required'));
  if (!isPositive(job.price))        issues.push(warn('price', 'Job price is $0 — confirm this is intentional'));
  if (!hasValue(job.job_group))      issues.push(warn('job_group', 'Job group is not set'));
  if (!hasValue(job.lifecycle_status)) issues.push(warn('lifecycle_status', 'Lifecycle status is not set'));
  return issues;
}

// ─── Customer (Lead) ──────────────────────────────────────────────────────────
export function validateCustomer(lead) {
  const issues = [];
  if (!hasValue(lead.name))          issues.push(err('name', 'Customer name is required'));
  if (!hasValue(lead.phone) && !hasValue(lead.email))
    issues.push(warn('contact', 'At least one contact method (phone or email) is recommended'));
  if (lead.email && !isEmail(lead.email))
    issues.push(warn('email', 'Email address format appears invalid'));
  if (lead.phone && !isPhone(lead.phone))
    issues.push(warn('phone', 'Phone number format appears invalid'));
  return issues;
}

// ─── Vendor / Subcontractor ───────────────────────────────────────────────────
export function validateVendor(vendor) {
  const issues = [];
  if (!hasValue(vendor.company_name)) issues.push(err('company_name', 'Company name is required'));
  if (!hasValue(vendor.type))         issues.push(warn('type', 'Vendor type is not set'));
  if (!hasValue(vendor.phone) && !hasValue(vendor.email))
    issues.push(warn('contact', 'No contact info — add a phone number or email'));
  if (vendor.email && !isEmail(vendor.email))
    issues.push(warn('email', 'Email address format appears invalid'));
  if (vendor.is_1099 && !hasValue(vendor.tax_id))
    issues.push(warn('tax_id', '1099 vendor is missing a Tax ID / EIN'));
  return issues;
}

// ─── Estimate ─────────────────────────────────────────────────────────────────
export function validateEstimate(estimate, lineItems = []) {
  const issues = [];
  if (!hasValue(estimate.client_name))  issues.push(err('client_name', 'Client name is required'));
  if (!hasValue(estimate.property_address)) issues.push(warn('property_address', 'Property address is missing'));
  if (!hasValue(estimate.estimate_type)) issues.push(warn('estimate_type', 'Estimate type is not set'));
  if (lineItems.length === 0)           issues.push(warn('line_items', 'No line items — add at least one before sending'));
  const total = parseFloat(estimate.total) || 0;
  if (total <= 0)                       issues.push(warn('total', 'Estimate total is $0 — confirm this is correct'));
  if (estimate.status === 'sent' && !hasValue(estimate.client_email))
    issues.push(warn('client_email', 'No client email — cannot confirm delivery'));
  if (estimate.status === 'sent' && !hasValue(estimate.sent_date))
    issues.push(warn('sent_date', 'Sent date is missing'));
  return issues;
}

// ─── Invoice ──────────────────────────────────────────────────────────────────
export function validateInvoice(invoice) {
  const issues = [];
  if (!hasValue(invoice.customer_name)) issues.push(err('customer_name', 'Customer name is required'));
  if (!hasValue(invoice.job_id))        issues.push(warn('job_id', 'Invoice is not linked to a job'));
  if (!isPositive(invoice.amount))      issues.push(err('amount', 'Invoice amount must be greater than $0'));
  if (!hasValue(invoice.invoice_date))  issues.push(warn('invoice_date', 'Invoice date is missing'));
  if (!hasValue(invoice.due_date))      issues.push(warn('due_date', 'Due date is missing'));
  if (invoice.status === 'sent' && !hasValue(invoice.customer_email))
    issues.push(warn('customer_email', 'No customer email on file for this invoice'));

  // Paid status checks
  if (invoice.status === 'paid') {
    if (!isPositive(invoice.amount_paid))
      issues.push(err('amount_paid', 'Invoice is marked Paid but no payment amount is recorded'));
  }

  // Overdue check
  if (invoice.due_date && invoice.status !== 'paid' && invoice.status !== 'closed') {
    const due = new Date(invoice.due_date);
    if (due < new Date()) {
      issues.push(warn('due_date', `Invoice was due on ${invoice.due_date} and is not yet paid`));
    }
  }
  return issues;
}

// ─── Expense ──────────────────────────────────────────────────────────────────
export function validateExpense(expense) {
  const issues = [];
  if (!hasValue(expense.vendor_name))   issues.push(err('vendor_name', 'Vendor name is required'));
  if (!isPositive(expense.total_amount)) issues.push(err('total_amount', 'Expense total must be greater than $0'));
  if (!hasValue(expense.expense_date) && !hasValue(expense.receipt_date))
    issues.push(warn('expense_date', 'Expense date is missing'));
  if (!hasValue(expense.category))      issues.push(warn('category', 'Category is not set'));
  if (!hasValue(expense.job_id))        issues.push(warn('job_id', 'Expense is not linked to a job'));

  // Filing checks
  if (expense.inbox_status === 'filed' || expense.approval_status === 'approved') {
    if (!hasValue(expense.job_id))
      issues.push(err('job_id', 'A job must be linked before this expense can be filed'));
    if (!hasValue(expense.payment_method))
      issues.push(warn('payment_method', 'Payment method is missing for a filed expense'));
  }
  return issues;
}

// ─── Bill ─────────────────────────────────────────────────────────────────────
export function validateBill(bill) {
  const issues = [];
  if (!hasValue(bill.vendor_name))    issues.push(err('vendor_name', 'Vendor name is required'));
  if (!isPositive(bill.amount))       issues.push(err('amount', 'Bill amount must be greater than $0'));
  if (!hasValue(bill.bill_date))      issues.push(warn('bill_date', 'Bill date is missing'));
  if (!hasValue(bill.due_date))       issues.push(warn('due_date', 'Due date is missing'));
  if (!hasValue(bill.category))       issues.push(warn('category', 'Category is not set'));
  if (!hasValue(bill.job_id))         issues.push(warn('job_id', 'Bill is not linked to a job'));

  if (bill.status === 'paid') {
    if (!hasValue(bill.due_date))
      issues.push(warn('due_date', 'Marking as paid — due date is missing'));
  }

  // Overdue check
  if (bill.due_date && bill.status === 'open') {
    if (new Date(bill.due_date) < new Date()) {
      issues.push(warn('due_date', `Bill was due on ${bill.due_date} and is still open`));
    }
  }
  return issues;
}

// ─── Time Entry ───────────────────────────────────────────────────────────────
export function validateTimeEntry(entry) {
  const issues = [];
  if (!hasValue(entry.employee_name)) issues.push(err('employee_name', 'Employee name is required'));
  if (!hasValue(entry.job_id))        issues.push(err('job_id', 'A job must be linked to this time entry'));
  if (!hasValue(entry.cost_code))     issues.push(err('cost_code', 'Cost code is required'));
  if (!hasValue(entry.clock_in))      issues.push(err('clock_in', 'Clock-in time is required'));
  if (!hasValue(entry.entry_date))    issues.push(warn('entry_date', 'Entry date is missing'));

  if (entry.clock_in && entry.clock_out) {
    const mins = (new Date(entry.clock_out) - new Date(entry.clock_in)) / 60000;
    if (mins < 0)   issues.push(err('clock_out', 'Clock-out is before clock-in'));
    if (mins > 720) issues.push(warn('duration', `Duration is ${(mins/60).toFixed(1)} hours — confirm this is correct`));
    if (mins < 1)   issues.push(warn('duration', 'Duration is less than 1 minute'));
  }
  return issues;
}

// ─── Cost Code ────────────────────────────────────────────────────────────────
export function validateCostCode(code) {
  const issues = [];
  if (!hasValue(code.name))         issues.push(err('name', 'Cost code name is required'));
  if (!hasValue(code.code_number))  issues.push(err('code_number', 'Code number is required'));
  if (!hasValue(code.category))     issues.push(warn('category', 'Category is not set'));
  if (!hasValue(code.code_type))    issues.push(warn('code_type', 'Code type is not set'));
  return issues;
}

// ─── Export readiness (QB export) ────────────────────────────────────────────
export function validateForExport(record, type) {
  switch (type) {
    case 'invoice':  return validateInvoice(record).filter(i => i.level === 'error');
    case 'expense':  return validateExpense(record).filter(i => i.level === 'error');
    case 'bill':     return validateBill(record).filter(i => i.level === 'error');
    case 'time_entry': return validateTimeEntry(record).filter(i => i.level === 'error');
    default: return [];
  }
}

// ─── Status change guards ─────────────────────────────────────────────────────
/**
 * Returns blocking errors for a given status transition.
 * Returns [] if the transition is allowed.
 */
export function validateStatusTransition(record, fromStatus, toStatus, type) {
  const BLOCKED_STATUSES = {
    invoice:  { paid: validateInvoice, sent: validateInvoice },
    bill:     { paid: validateBill },
    expense:  { filed: validateExpense },
    estimate: { sent: validateEstimate, approved: validateEstimate },
    job:      { completed: validateJob, closed: validateJob },
  };

  const rules = BLOCKED_STATUSES[type];
  if (!rules || !rules[toStatus]) return [];

  const allIssues = rules[toStatus](record);
  return allIssues.filter(i => i.level === 'error');
}

// ─── Needs Review flag ───────────────────────────────────────────────────────
/**
 * Returns true if a record should be flagged "Needs Review" based on error-level issues.
 */
export function needsReview(record, type) {
  switch (type) {
    case 'job':        return validateJob(record).some(i => i.level === 'error');
    case 'invoice':    return validateInvoice(record).some(i => i.level === 'error');
    case 'expense':    return validateExpense(record).some(i => i.level === 'error');
    case 'bill':       return validateBill(record).some(i => i.level === 'error');
    case 'time_entry': return validateTimeEntry(record).some(i => i.level === 'error');
    case 'estimate':   return validateEstimate(record).some(i => i.level === 'error');
    case 'vendor':     return validateVendor(record).some(i => i.level === 'error');
    case 'cost_code':  return validateCostCode(record).some(i => i.level === 'error');
    default: return false;
  }
}