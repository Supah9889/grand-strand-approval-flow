/**
 * permissions.js — Centralized permission and company-scope helpers
 *
 * Architecture:
 *  - Session role (owner/admin/staff) is the primary gate — set by adminAuth.js
 *  - Employee role (from CompanyMembership) drives fine-grained feature access
 *  - Active company (from sessionStorage 'active_company') scopes all queries
 *
 * Role hierarchy (internal session roles):
 *   owner  > admin > staff
 *
 * Employee roles (CompanyMembership.role):
 *   owner | operations_admin | estimator | field_technician |
 *   office_support | vendor | nexus_reviewer
 *
 * Permission groups (CompanyMembership.permission_group):
 *   full_admin | owner | operations_admin | estimator | field_technician |
 *   office_support | vendor | nexus_reviewer | jesus_reviewer |
 *   financial_viewer | financial_manager
 *
 * Jesus reviewer: operations_admin on GSCP with can_review_subcontract_notes=true
 *   OR assigned as assigned_reviewer_name on a WorkOrder.
 */

import { getSession, getInternalRole, getSessionEmployee } from '@/lib/adminAuth';

// ─────────────────────────────────────────────────────────────────────────────
// Company helpers
// ─────────────────────────────────────────────────────────────────────────────

const COMPANY_KEY = 'active_company';

const COMPANY_SCOPE_FIELDS = [
  'company_id',
  'origin_company_id',
  'assigned_company_id',
  'performing_company_id',
];

const JOB_REFERENCE_FIELDS = ['job_id', 'linked_job_id', 'current_job_id'];
const RELATED_OWNER_FIELDS = ['customer_id', 'vendor_id', 'subcontractor_id'];

const GLOBAL_CONFIG_ENTITIES = new Set([
  'AccessConfig',
  'ApprovedEmail',
  'Company',
  'CostCode',
  'GeoSettings',
  'JobType',
  'RolePermission',
  'User',
]);

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function normalizeId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.id || value.company_id || null;
  return String(value);
}

function isUserLike(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getContextMemberships(userOrContext) {
  if (!isUserLike(userOrContext)) return [];
  return userOrContext.memberships
    || userOrContext.companyMemberships
    || userOrContext.company_memberships
    || [];
}

function getContextEmployee(userOrContext) {
  if (!isUserLike(userOrContext)) return getSessionEmployee();
  return userOrContext.employee || userOrContext.sessionEmployee || userOrContext;
}

function getContextRole(userOrContext) {
  if (!isUserLike(userOrContext)) return getInternalRole();
  return userOrContext.sessionRole
    || userOrContext.internalRole
    || userOrContext.role
    || userOrContext.app_role
    || userOrContext.employee?.role
    || null;
}

function getRecordCompanyIds(record) {
  if (!record) return [];
  return COMPANY_SCOPE_FIELDS
    .map(field => normalizeId(record[field]))
    .filter(Boolean);
}

function hasAnyCompanyField(record) {
  return getRecordCompanyIds(record).length > 0;
}

function getJobFromContext(userOrContext, jobId) {
  if (!isUserLike(userOrContext) || !jobId) return null;
  const byId = userOrContext.jobsById || userOrContext.jobMap || userOrContext.jobs_by_id;
  if (byId?.[jobId]) return byId[jobId];
  const jobs = userOrContext.jobs || [];
  return jobs.find(job => job?.id === jobId) || null;
}

function relatedCompanyIdFromContext(userOrContext, field, id) {
  if (!isUserLike(userOrContext) || !id) return null;
  const mapName = `${field.replace(/_id$/, '')}CompanyMap`;
  const snakeMapName = `${field.replace(/_id$/, '')}_company_map`;
  return userOrContext[mapName]?.[id] || userOrContext[snakeMapName]?.[id] || null;
}

export function getCurrentCompany() {
  try {
    const raw = sessionStorage.getItem(COMPANY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function requireCompany() {
  return getCurrentCompany();
}

export function getActiveCompanyId(userOrContext) {
  if (typeof userOrContext === 'string') return userOrContext || null;
  if (isUserLike(userOrContext)) {
    return normalizeId(
      userOrContext.activeCompanyId
      || userOrContext.active_company_id
      || userOrContext.companyId
      || userOrContext.company_id
      || userOrContext.activeCompany
      || userOrContext.company
    );
  }
  return normalizeId(getCurrentCompany());
}

export function safeCompanyFilter(activeCompanyId, extra = {}) {
  const companyId = getActiveCompanyId(activeCompanyId);
  if (!companyId) return null;
  return { ...extra, company_id: companyId };
}

export function requireCompanyScope(queryParams = {}, activeCompanyId) {
  const companyId = getActiveCompanyId(activeCompanyId);
  if (!companyId) {
    throw new Error('Company scope is required for this query.');
  }
  return { ...queryParams, company_id: companyId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Session role helpers (thin wrappers — source of truth is adminAuth)
// ─────────────────────────────────────────────────────────────────────────────

export function getSessionRole() {
  return getInternalRole(); // 'owner' | 'admin' | 'staff' | null
}

export function isOwnerSession() {
  return getInternalRole() === 'owner';
}

export function isAdminSession() {
  const r = getInternalRole();
  return r === 'admin' || r === 'owner';
}

// ─────────────────────────────────────────────────────────────────────────────
// Employee role helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the current employee's membership in the current company.
 */
export function getCurrentMembership(memberships = []) {
  const employee = getSessionEmployee();
  const company = getCurrentCompany();
  if (!employee || !company) return null;
  return memberships.find(
    m => m.employee_id === employee.id && m.company_id === company.id && m.is_active !== false
  ) || null;
}

/**
 * Get the current employee's role within a company.
 */
export function getEmployeeRole(memberships = []) {
  const employee = getSessionEmployee();
  if (!employee) return null;
  const company = getCurrentCompany();
  if (!company) return null;
  const membership = memberships.find(
    m => m.employee_id === employee.id && m.company_id === company.id && m.is_active !== false
  );
  return membership?.role || employee.role || null;
}

/**
 * Convenience: check if the current employee has one of the given roles
 * in the current company. Owner/admin sessions bypass role checks.
 */
export function hasRole(userOrRoles, roleOrRoles, memberships = []) {
  // Backward-compatible form: hasRole(['owner'], memberships)
  if (!isUserLike(userOrRoles) || Array.isArray(userOrRoles)) {
    const roles = toArray(userOrRoles);
    const legacyMemberships = Array.isArray(roleOrRoles) ? roleOrRoles : memberships;
    if (isAdminSession()) return true;
    const empRole = getEmployeeRole(legacyMemberships);
    if (!empRole) return false;
    return roles.includes(empRole);
  }

  const userOrContext = userOrRoles;
  const roles = toArray(roleOrRoles);
  if (!roles.length) return false;

  const roleValues = new Set([
    getContextRole(userOrContext),
    userOrContext.permission_group,
    userOrContext.permissionGroup,
    userOrContext.employee?.role,
  ].filter(Boolean));

  getUserCompanyMemberships(userOrContext).forEach(membership => {
    if (membership.role) roleValues.add(membership.role);
    if (membership.permission_group) roleValues.add(membership.permission_group);
  });

  return roles.some(role => roleValues.has(role));
}

/**
 * Check if the current membership has a given permission group.
 */
export function hasPermissionGroup(groups, memberships = []) {
  if (isAdminSession()) return true;
  const m = getCurrentMembership(memberships);
  if (!m?.permission_group) return false;
  return groups.includes(m.permission_group);
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature-level permission checks — operational
// ─────────────────────────────────────────────────────────────────────────────

/** Can create/edit/delete jobs */
export function canManageJobs(memberships = []) {
  if (isAdminSession()) return true;
  return hasRole(['owner','operations_admin'], memberships);
}

/** Can view jobs (field techs can see assigned ones — UI filters further) */
export function canViewJobs(memberships = []) {
  return isAdminSession() || hasRole(['owner','operations_admin','estimator','field_technician','office_support'], memberships);
}

/** Can manage CRM (customers, properties) */
export function canManageCRM(memberships = []) {
  if (isAdminSession()) return true;
  return hasRole(['owner','operations_admin','estimator','office_support'], memberships);
}

/** Can manage scheduling */
export function canManageSchedule(memberships = []) {
  if (isAdminSession()) return true;
  return hasRole(['owner','operations_admin','office_support'], memberships);
}

/** Can manage work orders */
export function canManageWorkOrders(memberships = []) {
  if (isAdminSession()) return true;
  return hasRole(['owner','operations_admin'], memberships);
}

/** Can view work orders (field techs/vendors see assigned ones) */
export function canViewWorkOrders(memberships = []) {
  return isAdminSession() || hasRole(['owner','operations_admin','field_technician','vendor','office_support'], memberships);
}

/** Can manage time entries */
export function canManageTimeEntries(memberships = []) {
  if (isAdminSession()) return true;
  return hasRole(['owner','operations_admin'], memberships);
}

/** Can view all time entries (own entries always visible) */
export function canViewAllTimeEntries(memberships = []) {
  if (isAdminSession()) return true;
  return hasRole(['owner','operations_admin','office_support'], memberships);
}

/** Can manage restoration documentation */
export function canManageRestoration(memberships = []) {
  if (isAdminSession()) return true;
  return hasRole(['owner','operations_admin','field_technician'], memberships);
}

/** Can approve Nexus items — also respects membership flag */
export function canApproveNexus(memberships = []) {
  if (isAdminSession()) return true;
  const m = getCurrentMembership(memberships);
  if (m?.can_approve_nexus === true) return true;
  return hasRole(['owner','operations_admin','nexus_reviewer'], memberships);
}

export function canSubmitNexus(memberships = []) {
  if (isAdminSession()) return true;
  return hasRole(['owner','operations_admin','field_technician','nexus_reviewer'], memberships);
}

/** Can manage Xactimate imports */
export function canManageXactimate(memberships = []) {
  if (isAdminSession()) return true;
  return hasRole(['owner','operations_admin','estimator'], memberships);
}

/** Can review subcontract notes — also respects membership flag */
export function canReviewSubcontractNote(memberships = []) {
  if (isAdminSession()) return true;
  const m = getCurrentMembership(memberships);
  if (m?.can_review_subcontract_notes === true) return true;
  const employee = getSessionEmployee();
  if (employee?.subcontract_reviewer === true) return true;
  return hasRole(['owner','operations_admin'], memberships);
}

/** Can see DH-side subcontract visibility page */
export function canViewSubcontractOrigin(memberships = []) {
  if (isAdminSession()) return true;
  return hasRole(['owner','operations_admin','office_support'], memberships);
}

// ─────────────────────────────────────────────────────────────────────────────
// Financial visibility permission checks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Can view financial data: invoice amounts, estimate totals, claim values,
 * customer balances, payment status, insurance settlement amounts.
 */
export function canViewFinancials(memberships = []) {
  if (isOwnerSession()) return true;
  if (isAdminSession()) return true;
  const m = getCurrentMembership(memberships);
  if (m?.can_view_financials === true) return true;
  if (m?.can_edit_financials === true) return true; // edit implies view
  return hasPermissionGroup(['full_admin','owner','financial_viewer','financial_manager'], memberships);
}

/**
 * Can edit financial records (create invoices, update estimates, process payments).
 */
export function canEditFinancials(memberships = []) {
  if (isOwnerSession()) return true;
  if (isAdminSession()) return true;
  const m = getCurrentMembership(memberships);
  if (m?.can_edit_financials === true) return true;
  return hasPermissionGroup(['full_admin','owner','financial_manager'], memberships);
}

// ─────────────────────────────────────────────────────────────────────────────
// Access management permission checks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Can manage company memberships (add/remove members, assign roles).
 * Owners and full admins always can; operations_admins only if their
 * membership explicitly grants it.
 */
export function canManageAccess(memberships = []) {
  if (isOwnerSession()) return true;
  if (isAdminSession()) return true; // admin session = owner or admin override code
  const m = getCurrentMembership(memberships);
  return m?.can_manage_users === true;
}

/** Alias — manage company memberships */
export function canManageCompanyMemberships(memberships = []) {
  return canManageAccess(memberships);
}

/**
 * Can assign reviewer roles to work orders or Nexus items.
 */
export function canAssignReviewer(memberships = []) {
  if (isAdminSession()) return true;
  return hasRole(['owner','operations_admin'], memberships);
}

/**
 * Can deactivate / remove a user from the company.
 */
export function canDeactivateUser(memberships = []) {
  return canManageAccess(memberships);
}

/**
 * Restricts user to viewing only records explicitly assigned to them.
 * True for vendors and members where can_view_assigned_only is set.
 */
export function canViewAssignedOnly(memberships = []) {
  if (isAdminSession()) return false; // admins are never restricted
  const m = getCurrentMembership(memberships);
  if (m?.can_view_assigned_only === true) return true;
  // Vendors and pure field_techs default to assigned-only
  const role = getEmployeeRole(memberships);
  return role === 'vendor';
}

/**
 * Can view cross-company subcontract records (origin or performing side).
 */
export function canViewCrossCompanySubcontract(memberships = []) {
  if (isAdminSession()) return true;
  const m = getCurrentMembership(memberships);
  if (m?.can_review_subcontract_notes === true) return true;
  return hasRole(['owner','operations_admin','office_support'], memberships);
}

// ─────────────────────────────────────────────────────────────────────────────
// Record-level visibility
// ─────────────────────────────────────────────────────────────────────────────

export function canViewRecord(record, company, memberships = []) {
  if (!record) return false;
  if (isOwnerSession()) return true;
  if (!company) return false;
  if (record.company_id === company.id) return true;
  if (record.performing_company_id === company.id) return true;
  if (record.origin_company_id === company.id && record.visible_to_origin === true) return true;
  return false;
}

export function canEditRecord(record, company, memberships = []) {
  if (!canViewRecord(record, company, memberships)) return false;
  if (isAdminSession()) return true;
  const employee = getSessionEmployee();
  if (!employee) return false;
  if (record.employee_id === employee.id) return true;
  if (record.created_by_id === employee.id) return true;
  return hasRole(['owner','operations_admin'], memberships);
}

export function hasCompanyAccess(userOrContext, companyId) {
  const targetCompanyId = normalizeId(companyId);
  if (!targetCompanyId) return false;

  const activeCompanyId = getActiveCompanyId(userOrContext);
  if (activeCompanyId && activeCompanyId === targetCompanyId) return true;

  return getUserCompanyMemberships(userOrContext).some(membership =>
    membership?.company_id === targetCompanyId && membership.is_active !== false
  );
}

export function canAccessJob(userOrContext, job) {
  if (!job) return false;
  const activeCompanyId = getActiveCompanyId(userOrContext);
  const jobCompanyIds = getRecordCompanyIds(job);

  if (activeCompanyId && jobCompanyIds.includes(activeCompanyId)) return true;
  if (jobCompanyIds.some(companyId => hasCompanyAccess(userOrContext, companyId))) return true;
  if (jobCompanyIds.length) return false;

  const employee = getContextEmployee(userOrContext);
  if (!employee?.id) return false;

  const assignedIds = parseJsonList(job.assigned_employee_ids);
  if (assignedIds.includes(employee.id)) return true;

  return job.employee_id === employee.id || job.created_by_id === employee.id;
}

function parseJsonList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function canReadEntity(userOrContext, entityName, record) {
  if (!record) return false;

  if (GLOBAL_CONFIG_ENTITIES.has(entityName)) {
    return isOwnerSession() || isAdminSession() || hasRole(userOrContext, ['owner', 'full_admin']);
  }

  if (entityName === 'Job') return canAccessJob(userOrContext, record);

  const activeCompanyId = getActiveCompanyId(userOrContext);
  const directCompanyIds = getRecordCompanyIds(record);
  if (activeCompanyId && directCompanyIds.includes(activeCompanyId)) return true;
  if (directCompanyIds.some(companyId => hasCompanyAccess(userOrContext, companyId))) return true;

  // Some child entities only carry job_id. They are safe to read only when the
  // caller supplies the parent job context through jobsById/jobMap/jobs.
  for (const field of JOB_REFERENCE_FIELDS) {
    const jobId = record[field];
    const job = getJobFromContext(userOrContext, jobId);
    if (job && canAccessJob(userOrContext, job)) return true;
  }

  // Customer/vendor/subcontractor ownership cannot be inferred without a
  // caller-provided map. This keeps the helper fail-closed by default.
  for (const field of RELATED_OWNER_FIELDS) {
    const relatedCompanyId = relatedCompanyIdFromContext(userOrContext, field, record[field]);
    if (relatedCompanyId && hasCompanyAccess(userOrContext, relatedCompanyId)) return true;
  }

  return false;
}

export function canWriteEntity(userOrContext, entityName, record = {}) {
  if (GLOBAL_CONFIG_ENTITIES.has(entityName)) {
    return isOwnerSession() || hasRole(userOrContext, ['owner', 'full_admin']);
  }

  const activeCompanyId = getActiveCompanyId(userOrContext);
  if (hasAnyCompanyField(record) && !canReadEntity(userOrContext, entityName, record)) return false;

  if (isAdminSession()) return true;

  const employee = getContextEmployee(userOrContext);
  if (employee?.id && (record.employee_id === employee.id || record.created_by_id === employee.id)) return true;

  return hasRole(userOrContext, ['owner', 'operations_admin', 'financial_manager']);
}

// ─────────────────────────────────────────────────────────────────────────────
// Query filter helpers
// ─────────────────────────────────────────────────────────────────────────────

export function companyFilter(company) {
  if (!company?.id) return null;
  return { company_id: company.id };
}

export function timeEntryFilter(company, memberships = []) {
  const base = companyFilter(company);
  if (!base) return null;
  if (canViewAllTimeEntries(memberships)) return base;
  const employee = getSessionEmployee();
  if (!employee) return null;
  return { ...base, employee_id: employee.id };
}

export function workOrderFilter(company, memberships = []) {
  const base = companyFilter(company);
  if (!base) return null;
  if (canManageWorkOrders(memberships)) return base;
  const employee = getSessionEmployee();
  if (!employee) return base;
  return base; // Further filtering done in UI by checking assigned_employee_ids
}

// ─────────────────────────────────────────────────────────────────────────────
// getUserCompanyMemberships — for use in hooks
// ─────────────────────────────────────────────────────────────────────────────

export function getUserCompanyMemberships(userOrMemberships = []) {
  if (Array.isArray(userOrMemberships)) {
    const employee = getSessionEmployee();
    if (!employee) return [];
    return userOrMemberships.filter(m => m.employee_id === employee.id);
  }

  const memberships = getContextMemberships(userOrMemberships);
  const employee = getContextEmployee(userOrMemberships);
  if (!employee?.id) return memberships.filter(m => m?.is_active !== false);
  return memberships.filter(m => m.employee_id === employee.id && m.is_active !== false);
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission group definitions (for UI display)
// ─────────────────────────────────────────────────────────────────────────────

export const PERMISSION_GROUPS = [
  {
    value: 'full_admin',
    label: 'Full Admin',
    description: 'Full access to all features including global access management',
    color: 'bg-slate-800 text-white',
    defaultFinancialView: true,
    defaultFinancialEdit: true,
    defaultManageUsers: true,
  },
  {
    value: 'owner',
    label: 'Owner',
    description: 'Company owner — full operational and financial access',
    color: 'bg-amber-100 text-amber-800',
    defaultFinancialView: true,
    defaultFinancialEdit: true,
    defaultManageUsers: true,
  },
  {
    value: 'operations_admin',
    label: 'Operations Admin',
    description: 'Manages jobs, work orders, scheduling, and operations',
    color: 'bg-primary/10 text-primary',
    defaultFinancialView: false,
    defaultFinancialEdit: false,
    defaultManageUsers: false,
  },
  {
    value: 'estimator',
    label: 'Estimator',
    description: 'Creates and manages estimates; may view financial summaries',
    color: 'bg-cyan-100 text-cyan-800',
    defaultFinancialView: true,
    defaultFinancialEdit: false,
    defaultManageUsers: false,
  },
  {
    value: 'field_technician',
    label: 'Field Technician',
    description: 'Field work only — can clock in/out and document restoration',
    color: 'bg-green-100 text-green-800',
    defaultFinancialView: false,
    defaultFinancialEdit: false,
    defaultManageUsers: false,
  },
  {
    value: 'office_support',
    label: 'Office Support',
    description: 'Administrative support — scheduling, CRM, communications',
    color: 'bg-purple-100 text-purple-800',
    defaultFinancialView: false,
    defaultFinancialEdit: false,
    defaultManageUsers: false,
  },
  {
    value: 'vendor',
    label: 'Vendor',
    description: 'External vendor — views only assigned work orders',
    color: 'bg-orange-100 text-orange-800',
    defaultFinancialView: false,
    defaultFinancialEdit: false,
    defaultManageUsers: false,
  },
  {
    value: 'nexus_reviewer',
    label: 'Nexus Reviewer',
    description: 'Reviews and approves Nexus intelligence items',
    color: 'bg-indigo-100 text-indigo-800',
    defaultFinancialView: false,
    defaultFinancialEdit: false,
    defaultManageUsers: false,
  },
  {
    value: 'jesus_reviewer',
    label: 'Jesus Reviewer',
    description: 'Reviews GSCP subcontract notes before DH visibility',
    color: 'bg-rose-100 text-rose-800',
    defaultFinancialView: false,
    defaultFinancialEdit: false,
    defaultManageUsers: false,
    defaultReviewSubcontract: true,
  },
  {
    value: 'financial_viewer',
    label: 'Financial Viewer',
    description: 'Can view financial data but cannot edit',
    color: 'bg-emerald-100 text-emerald-800',
    defaultFinancialView: true,
    defaultFinancialEdit: false,
    defaultManageUsers: false,
  },
  {
    value: 'financial_manager',
    label: 'Financial Manager',
    description: 'Full financial read and write access',
    color: 'bg-teal-100 text-teal-800',
    defaultFinancialView: true,
    defaultFinancialEdit: true,
    defaultManageUsers: false,
  },
];

/**
 * getRoleDefaults — returns default permission flags for a given employee role string.
 * Used by PermissionSwitchboard to compute effective permissions before overrides.
 */
export function getRoleDefaults(role) {
  const base = ROLE_PERMISSION_DEFAULTS[role] || ROLE_PERMISSION_DEFAULTS.staff;
  return { ...base };
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy EmployeePermissions page support
// ─────────────────────────────────────────────────────────────────────────────

export const PERMISSION_CATEGORIES = [
  'Jobs & Scheduling',
  'Financial',
  'Operations',
  'Admin',
];

export const PERMISSIONS = {
  view_jobs:            { label: 'View Jobs',            category: 'Jobs & Scheduling' },
  manage_jobs:          { label: 'Manage Jobs',          category: 'Jobs & Scheduling' },
  manage_schedule:      { label: 'Manage Schedule',      category: 'Jobs & Scheduling' },
  view_work_orders:     { label: 'View Work Orders',     category: 'Jobs & Scheduling' },
  manage_work_orders:   { label: 'Manage Work Orders',   category: 'Jobs & Scheduling' },
  view_financials:      { label: 'View Financials',      category: 'Financial' },
  edit_financials:      { label: 'Edit Financials',      category: 'Financial' },
  manage_invoices:      { label: 'Manage Invoices',      category: 'Financial' },
  manage_expenses:      { label: 'Manage Expenses',      category: 'Financial' },
  manage_payments:      { label: 'Manage Payments',      category: 'Financial' },
  delete_payments:      { label: 'Delete Payments',      category: 'Financial' },
  manage_time_entries:  { label: 'Manage Time Entries',  category: 'Operations' },
  view_all_time:        { label: 'View All Time Entries',category: 'Operations' },
  manage_crm:           { label: 'Manage CRM',           category: 'Operations' },
  manage_restoration:   { label: 'Manage Restoration',   category: 'Operations' },
  submit_nexus:         { label: 'Submit to Nexus',      category: 'Operations' },
  approve_nexus:        { label: 'Approve Nexus Items',  category: 'Admin' },
  manage_users:         { label: 'Manage Users',         category: 'Admin' },
  manage_access:        { label: 'Manage Access',        category: 'Admin' },
  review_subcontracts:  { label: 'Review Subcontracts',  category: 'Admin' },
};

const ROLE_PERMISSION_DEFAULTS = {
  owner: Object.fromEntries(Object.keys(PERMISSIONS).map(k => [k, true])),
  admin: {
    view_jobs: true, manage_jobs: true, manage_schedule: true,
    view_work_orders: true, manage_work_orders: true,
    view_financials: true, edit_financials: true, manage_invoices: true, manage_expenses: true,
    manage_payments: true, delete_payments: true,
    manage_time_entries: true, view_all_time: true, manage_crm: true,
    manage_restoration: true, submit_nexus: true,
    approve_nexus: false, manage_users: false, manage_access: false, review_subcontracts: false,
  },
  staff: {
    view_jobs: true, manage_jobs: false, manage_schedule: false,
    view_work_orders: true, manage_work_orders: false,
    view_financials: false, edit_financials: false, manage_invoices: false, manage_expenses: false,
    manage_payments: false, delete_payments: false,
    manage_time_entries: false, view_all_time: false, manage_crm: false,
    manage_restoration: true, submit_nexus: true,
    approve_nexus: false, manage_users: false, manage_access: false, review_subcontracts: false,
  },
};

export function resolvePermissions({ role, storedRolePerms, employeeOverrides }) {
  const defaults = ROLE_PERMISSION_DEFAULTS[role] || ROLE_PERMISSION_DEFAULTS.staff;
  const base = storedRolePerms ? { ...defaults, ...storedRolePerms } : defaults;
  if (!employeeOverrides) return base;
  return { ...base, ...employeeOverrides };
}

export const ROLE_TO_PERMISSION_GROUP = {
  owner: 'owner',
  operations_admin: 'operations_admin',
  estimator: 'estimator',
  field_technician: 'field_technician',
  office_support: 'office_support',
  vendor: 'vendor',
  nexus_reviewer: 'nexus_reviewer',
};
