/**
 * Record Linking Utilities
 * Manages relationship integrity and related-item visibility across modules.
 * Jobs act as master records; linked records properly reference their parent jobs.
 */

import { base44 } from '@/api/base44Client';

/**
 * Fetch all related records for a job in parallel.
 * Returns organized related items: invoices, expenses, time entries, estimates, etc.
 */
export async function fetchJobRelatedRecords(jobId) {
  if (!jobId) return null;

  try {
    const [
      invoices,
      expenses,
      timeEntries,
      estimates,
      assignments,
      portalUsers,
      changeOrders,
      tasks,
      dailyLogs,
      files,
    ] = await Promise.all([
      base44.entities.Invoice.filter({ job_id: jobId }).catch(() => []),
      base44.entities.Expense.filter({ job_id: jobId }).catch(() => []),
      base44.entities.TimeEntry.filter({ job_id: jobId }).catch(() => []),
      base44.entities.Estimate.filter({ linked_job_id: jobId }).catch(() => []),
      base44.entities.JobAssignment.filter({ job_id: jobId }).catch(() => []),
      base44.entities.PortalUser.filter({ job_id: jobId }).catch(() => []),
      base44.entities.ChangeOrder?.filter?.({ job_id: jobId }).catch(() => []) || [],
      base44.entities.Task?.filter?.({ job_id: jobId }).catch(() => []) || [],
      base44.entities.DailyLog?.filter?.({ job_id: jobId }).catch(() => []) || [],
      base44.entities.JobFile?.filter?.({ job_id: jobId }).catch(() => []) || [],
    ]);

    return {
      invoices: invoices || [],
      expenses: expenses || [],
      timeEntries: timeEntries || [],
      estimates: estimates || [],
      assignments: assignments || [],
      portalUsers: portalUsers || [],
      changeOrders: changeOrders || [],
      tasks: tasks || [],
      dailyLogs: dailyLogs || [],
      files: files || [],
    };
  } catch (err) {
    console.error('Error fetching job related records:', err);
    return null;
  }
}

/**
 * Calculate job rollup summaries from related records.
 * Excludes archived/deleted items from active counts/totals.
 */
export function calculateJobRollups(related) {
  if (!related) return null;

  const invoices = related.invoices || [];
  const expenses = related.expenses || [];
  const timeEntries = related.timeEntries || [];

  // Active invoices (not archived/closed)
  const activeInvoices = invoices.filter(i => i.status !== 'closed');
  const archivedInvoices = invoices.filter(i => i.status === 'closed');

  // Active expenses
  const activeExpenses = expenses.filter(e => e.approval_status !== 'archived');
  const archivedExpenses = expenses.filter(e => e.approval_status === 'archived');

  // Time entry rollups
  const totalHours = (timeEntries || []).reduce((sum, t) => sum + (t.total_hours || 0), 0);
  const approvedHours = (timeEntries || [])
    .filter(t => t.approval_status === 'approved')
    .reduce((sum, t) => sum + (t.total_hours || 0), 0);
  const pendingHours = (timeEntries || [])
    .filter(t => t.approval_status === 'pending')
    .reduce((sum, t) => sum + (t.total_hours || 0), 0);

  // Financial rollups
  const invoiceTotal = activeInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const expenseTotal = activeExpenses.reduce((sum, e) => sum + Number(e.total_amount || 0), 0);
  const invoiceBalance = activeInvoices.reduce((sum, i) => sum + Number(i.balance_due || 0), 0);

  return {
    // Invoice summary
    invoiceCount: activeInvoices.length,
    invoiceArchivedCount: archivedInvoices.length,
    invoiceTotal,
    invoiceBalance,
    invoiceStatuses: activeInvoices.reduce((acc, i) => {
      acc[i.status] = (acc[i.status] || 0) + 1;
      return acc;
    }, {}),

    // Expense summary
    expenseCount: activeExpenses.length,
    expenseArchivedCount: archivedExpenses.length,
    expenseTotal,

    // Time entry summary
    timeEntryCount: (timeEntries || []).length,
    totalHours: Math.round(totalHours * 100) / 100,
    approvedHours: Math.round(approvedHours * 100) / 100,
    pendingHours: Math.round(pendingHours * 100) / 100,

    // Related counts
    estimateCount: (related.estimates || []).length,
    assignmentCount: (related.assignments || []).length,
    portalUserCount: (related.portalUsers || []).length,
    changeOrderCount: (related.changeOrders || []).length,
    taskCount: (related.tasks || []).length,
    dailyLogCount: (related.dailyLogs || []).length,
    fileCount: (related.files || []).length,
  };
}

/**
 * Ensure a record has proper job relationship fields.
 * Returns a normalized object with job_id and job_address.
 */
export function normalizeJobLink(record, jobData) {
  if (!record) return record;

  const normalized = { ...record };
  if (jobData) {
    if (!normalized.job_id && jobData.id) normalized.job_id = jobData.id;
    if (!normalized.job_address && jobData.address) normalized.job_address = jobData.address;
  }
  return normalized;
}

/**
 * Get the human-readable label for a related record type.
 */
export function getRelatedRecordLabel(type, record) {
  const labels = {
    invoice: () => `Invoice ${record?.invoice_number || record?.id}`,
    expense: () => `Expense ${record?.expense_number || record?.id}`,
    timeEntry: () => `Time Entry - ${record?.employee_name} (${record?.total_hours || 0}h)`,
    estimate: () => `Estimate ${record?.estimate_number || record?.id}`,
    assignment: () => `Assignment - ${record?.employee_name} (${record?.role_on_job})`,
    portalUser: () => `Portal User - ${record?.name}`,
    changeOrder: () => `Change Order ${record?.co_number || record?.id}`,
    task: () => `Task - ${record?.title}`,
    dailyLog: () => `Daily Log - ${record?.log_date}`,
    file: () => `File - ${record?.file_name}`,
  };

  return labels[type] ? labels[type]() : `${type} ${record?.id}`;
}

/**
 * Validate that a record's job link is current and consistent.
 * Useful for audit/integrity checks.
 */
export async function validateJobLink(record, expectedJobId) {
  if (!record || !expectedJobId) return false;
  return record.job_id === expectedJobId || record.linked_job_id === expectedJobId;
}

/**
 * Apply a consistent color/badge scheme to related record types.
 */
export const RELATED_RECORD_COLORS = {
  invoice: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  expense: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  timeEntry: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  estimate: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  assignment: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' },
  portalUser: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  changeOrder: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  task: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700' },
  dailyLog: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  file: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
};

/**
 * Group related records by type for display.
 */
export function groupRelatedRecords(related) {
  if (!related) return {};

  return {
    financial: {
      invoices: related.invoices,
      expenses: related.expenses,
      changeOrders: related.changeOrders,
      estimates: related.estimates,
    },
    operational: {
      timeEntries: related.timeEntries,
      tasks: related.tasks,
      dailyLogs: related.dailyLogs,
      assignments: related.assignments,
    },
    portal: {
      portalUsers: related.portalUsers,
    },
    documents: {
      files: related.files,
    },
  };
}