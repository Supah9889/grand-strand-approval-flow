/**
 * Central permission system.
 *
 * Role-level defaults are stored in RolePermission entity (one record per role).
 * Employee-level overrides are stored on Employee.allowed_cost_codes style JSON
 * in a new field: employee.permission_overrides = JSON { key: true|false }
 *
 * Usage:
 *   import { PERMISSIONS, PERMISSION_CATEGORIES, getRoleDefaults } from '@/lib/permissions';
 *   // At runtime, use the usePermissions() hook or hasPermission() from the hook
 */

export const PERMISSIONS = {
  // Dashboard / Reports
  view_dashboard:          { label: 'View Dashboard',           category: 'Dashboard / Reports', adminDefault: true,  staffDefault: true  },
  view_reports:            { label: 'View Reports',             category: 'Dashboard / Reports', adminDefault: true,  staffDefault: false },
  run_exports:             { label: 'Run Exports',              category: 'Dashboard / Reports', adminDefault: true,  staffDefault: false },
  view_exports:            { label: 'View Exports',             category: 'Dashboard / Reports', adminDefault: true,  staffDefault: false },
  view_audit_log:          { label: 'View Audit Log',           category: 'Dashboard / Reports', adminDefault: true,  staffDefault: false },

  // Employee Management
  view_employees:          { label: 'View Employees',           category: 'Employee Management', adminDefault: true,  staffDefault: false },
  edit_employees:          { label: 'Edit Employees',           category: 'Employee Management', adminDefault: true,  staffDefault: false },
  delete_employees:        { label: 'Delete Employees',         category: 'Employee Management', adminDefault: false, staffDefault: false },
  view_employee_perms:     { label: 'View Employee Permissions',category: 'Employee Management', adminDefault: true,  staffDefault: false },
  edit_employee_perms:     { label: 'Edit Employee Permissions',category: 'Employee Management', adminDefault: false, staffDefault: false },
  view_sensitive_emp_data: { label: 'View Sensitive Employee Data', category: 'Employee Management', adminDefault: true, staffDefault: false },

  // Admin Controls
  access_admin_controls:   { label: 'Access Admin Controls',   category: 'Admin Controls',      adminDefault: true,  staffDefault: false },
  manage_cost_codes:       { label: 'Manage Cost Codes',        category: 'Admin Controls',      adminDefault: true,  staffDefault: false },
  manage_templates:        { label: 'Manage Agreement Templates', category: 'Admin Controls',    adminDefault: true,  staffDefault: false },
  manage_custom_fields:    { label: 'Manage Custom Fields',     category: 'Admin Controls',      adminDefault: true,  staffDefault: false },
  manage_portal_access:    { label: 'Manage Portal Access',     category: 'Admin Controls',      adminDefault: true,  staffDefault: false },
  manage_approved_emails:  { label: 'Manage Approved Emails',   category: 'Admin Controls',      adminDefault: true,  staffDefault: false },

  // Time / Payroll
  view_time_entries:       { label: 'View Time Entries',        category: 'Time / Payroll',      adminDefault: true,  staffDefault: true  },
  manage_time_entries:     { label: 'Manage Time Entries',      category: 'Time / Payroll',      adminDefault: true,  staffDefault: false },
  use_time_clock:          { label: 'Use Time Clock',           category: 'Time / Payroll',      adminDefault: true,  staffDefault: true  },

  // Accounting / Costs
  view_financials:         { label: 'View Financials',          category: 'Accounting / Costs',  adminDefault: true,  staffDefault: false },
  manage_invoices:         { label: 'Manage Invoices',          category: 'Accounting / Costs',  adminDefault: true,  staffDefault: false },
  manage_bills:            { label: 'Manage Bills',             category: 'Accounting / Costs',  adminDefault: true,  staffDefault: false },
  manage_payments:         { label: 'Manage Payments',          category: 'Accounting / Costs',  adminDefault: true,  staffDefault: false },
  view_cost_inbox:         { label: 'View Cost Inbox',          category: 'Accounting / Costs',  adminDefault: true,  staffDefault: false },
  manage_cost_inbox:       { label: 'Manage Cost Inbox',        category: 'Accounting / Costs',  adminDefault: true,  staffDefault: false },
  manage_expenses:         { label: 'Manage Expenses',          category: 'Accounting / Costs',  adminDefault: true,  staffDefault: false },
  manage_vendors:          { label: 'Manage Vendors',           category: 'Accounting / Costs',  adminDefault: true,  staffDefault: false },
  manage_purchase_orders:  { label: 'Manage Purchase Orders',   category: 'Accounting / Costs',  adminDefault: true,  staffDefault: false },
  view_job_budgets:        { label: 'View Job Budgets',         category: 'Accounting / Costs',  adminDefault: true,  staffDefault: false },

  // Documents
  manage_estimates:        { label: 'Manage Estimates',         category: 'Documents',           adminDefault: true,  staffDefault: false },
  manage_change_orders:    { label: 'Manage Change Orders',     category: 'Documents',           adminDefault: true,  staffDefault: false },
  view_documents:          { label: 'View Documents',           category: 'Documents',           adminDefault: true,  staffDefault: true  },

  // File Sharing
  share_files_externally:  { label: 'Share Files with Clients/Vendors', category: 'File Sharing', adminDefault: true,  staffDefault: false },

  // Tasks / Coordination
  view_tasks:              { label: 'View Tasks',               category: 'Tasks / Coordination', adminDefault: true, staffDefault: true  },
  manage_tasks:            { label: 'Manage Tasks',             category: 'Tasks / Coordination', adminDefault: true, staffDefault: true  },
  view_calendar:           { label: 'View Calendar',            category: 'Tasks / Coordination', adminDefault: true, staffDefault: true  },
  view_daily_logs:         { label: 'View Daily Logs',          category: 'Tasks / Coordination', adminDefault: true, staffDefault: true  },
  manage_daily_logs:       { label: 'Manage Daily Logs',        category: 'Tasks / Coordination', adminDefault: true, staffDefault: true  },
  manage_warranty:         { label: 'Manage Warranty',          category: 'Tasks / Coordination', adminDefault: true, staffDefault: true  },
  view_job_files:          { label: 'View Job Files',           category: 'Tasks / Coordination', adminDefault: true, staffDefault: true  },
};

/** All unique category names in display order */
export const PERMISSION_CATEGORIES = [
  'Dashboard / Reports',
  'Employee Management',
  'Admin Controls',
  'Time / Payroll',
  'Accounting / Costs',
  'Documents',
  'File Sharing',
  'Tasks / Coordination',
];

/** Build the default permission map for a given role */
export function getRoleDefaults(role) {
  if (role === 'owner') {
    // Owner gets everything
    return Object.fromEntries(Object.keys(PERMISSIONS).map(k => [k, true]));
  }
  if (role === 'admin') {
    return Object.fromEntries(Object.entries(PERMISSIONS).map(([k, v]) => [k, v.adminDefault]));
  }
  // staff / field
  return Object.fromEntries(Object.entries(PERMISSIONS).map(([k, v]) => [k, v.staffDefault]));
}

/**
 * Merge role defaults with stored role permissions (from DB) and optional employee overrides.
 * Returns a flat { key: boolean } map.
 */
export function resolvePermissions({ role, storedRolePerms, employeeOverrides }) {
  if (role === 'owner') {
    return Object.fromEntries(Object.keys(PERMISSIONS).map(k => [k, true]));
  }
  const defaults = getRoleDefaults(role);
  const merged = { ...defaults };

  // Apply stored role-level customizations from DB
  if (storedRolePerms) {
    Object.entries(storedRolePerms).forEach(([k, v]) => {
      if (k in PERMISSIONS) merged[k] = !!v;
    });
  }

  // Apply employee-specific overrides (can add OR remove permissions)
  if (employeeOverrides) {
    Object.entries(employeeOverrides).forEach(([k, v]) => {
      if (k in PERMISSIONS) merged[k] = !!v;
    });
  }

  return merged;
}