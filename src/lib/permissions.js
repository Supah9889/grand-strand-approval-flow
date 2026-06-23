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
 * Jesus reviewer is modeled as operations_admin on the GSCP company with
 *   subcontract_reviewer=true on the Employee record, OR simply as
 *   the designated assigned_reviewer_name on the WorkOrder.
 */

import { getSession, getInternalRole, getSessionEmployee } from '@/lib/adminAuth';

// ─────────────────────────────────────────────────────────────────────────────
// Company helpers
// ─────────────────────────────────────────────────────────────────────────────

const COMPANY_KEY = 'active_company';

export function getCurrentCompany() {
  try {
    const raw = sessionStorage.getItem(COMPANY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function requireCompany() {
  return getCurrentCompany();
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
 * Get the current employee's role within a company.
 * Falls back to reading from the employee object stored in the session.
 * memberships param is optional — pass if you've already loaded them.
 */
export function getEmployeeRole(memberships = []) {
  const employee = getSessionEmployee();
  if (!employee) return null;
  const company = getCurrentCompany();
  if (!company) return null;
  const membership = memberships.find(
    m => m.employee_id === employee.id && m.company_id === company.id && m.is_active !== false
  );
  // Fall back to the role stored on the employee entity itself
  return membership?.role || employee.role || null;
}

/**
 * Convenience: check if the current employee has one of the given roles
 * in the current company. Owner/admin sessions bypass role checks.
 */
export function hasRole(roles, memberships = []) {
  if (isAdminSession()) return true; // owner/admin bypass
  const empRole = getEmployeeRole(memberships);
  if (!empRole) return false;
  return roles.includes(empRole);
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature-level permission checks
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

/** Can submit/review Nexus items */
export function canApproveNexus(memberships = []) {
  if (isAdminSession()) return true;
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

/** Can review subcontract notes (Jesus role) */
export function canReviewSubcontractNote(memberships = []) {
  if (isAdminSession()) return true;
  const employee = getSessionEmployee();
  if (!employee) return false;
  // Anyone flagged as subcontract_reviewer, or operations_admin
  if (employee.subcontract_reviewer === true) return true;
  return hasRole(['owner','operations_admin'], memberships);
}

/** Can see DH-side subcontract visibility page */
export function canViewSubcontractOrigin(memberships = []) {
  if (isAdminSession()) return true;
  return hasRole(['owner','operations_admin','office_support'], memberships);
}

// ─────────────────────────────────────────────────────────────────────────────
// Record-level visibility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Can the current user view a given record?
 * record must have company_id.
 * Pass the active company object.
 */
export function canViewRecord(record, company, memberships = []) {
  if (!record) return false;
  if (isOwnerSession()) return true; // owner sees all
  if (!company) return false;
  // Same company
  if (record.company_id === company.id) return true;
  // Subcontract: performing company can see the WO
  if (record.performing_company_id === company.id) return true;
  // Subcontract: origin company can see approved notes
  if (record.origin_company_id === company.id && record.visible_to_origin === true) return true;
  return false;
}

/**
 * Can the current user edit a given record?
 */
export function canEditRecord(record, company, memberships = []) {
  if (!canViewRecord(record, company, memberships)) return false;
  if (isAdminSession()) return true;
  // Field techs can edit their own time entries + work documentation
  const employee = getSessionEmployee();
  if (!employee) return false;
  if (record.employee_id === employee.id) return true;
  if (record.created_by_id === employee.id) return true;
  return hasRole(['owner','operations_admin'], memberships);
}

// ─────────────────────────────────────────────────────────────────────────────
// Query filter helpers — use these to build entity filter objects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the base filter for company-scoped queries.
 * If no company is selected, returns null (caller should block the query).
 */
export function companyFilter(company) {
  if (!company?.id) return null;
  return { company_id: company.id };
}

/**
 * Build a time-entry filter respecting role:
 * - admin/owner/operations_admin: all entries for company
 * - field_technician: own entries only
 */
export function timeEntryFilter(company, memberships = []) {
  const base = companyFilter(company);
  if (!base) return null;
  if (canViewAllTimeEntries(memberships)) return base;
  const employee = getSessionEmployee();
  if (!employee) return null;
  return { ...base, employee_id: employee.id };
}

/**
 * Build a work-order filter for field technicians (assigned only).
 */
export function workOrderFilter(company, memberships = []) {
  const base = companyFilter(company);
  if (!base) return null;
  if (canManageWorkOrders(memberships)) return base;
  // Field tech / vendor: only assigned
  const employee = getSessionEmployee();
  if (!employee) return base; // no filtering without employee
  return base; // Further filtering done in UI by checking assigned_employee_ids
}

// ─────────────────────────────────────────────────────────────────────────────
// getUserCompanyMemberships — for use in hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Utility to fetch memberships for current employee from a pre-loaded list.
 * Since memberships are loaded once in the hook, this is synchronous.
 */
export function getUserCompanyMemberships(allMemberships = []) {
  const employee = getSessionEmployee();
  if (!employee) return [];
  return allMemberships.filter(m => m.employee_id === employee.id);
}