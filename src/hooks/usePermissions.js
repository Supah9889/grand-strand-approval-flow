/**
 * usePermissions — React hook providing permission context
 *
 * Usage:
 *   const { company, canManageJobs, canViewFinancials, ... } = usePermissions();
 */

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getSessionEmployee, getInternalRole } from '@/lib/adminAuth';
import {
  getCurrentCompany,
  canManageJobs, canViewJobs, canManageCRM, canManageSchedule,
  canManageWorkOrders, canViewWorkOrders, canManageTimeEntries, canViewAllTimeEntries,
  canManageRestoration, canApproveNexus, canSubmitNexus, canManageXactimate,
  canReviewSubcontractNote, canViewSubcontractOrigin, canViewRecord, canEditRecord,
  canViewFinancials, canEditFinancials,
  canManageAccess, canManageCompanyMemberships, canAssignReviewer,
  canDeactivateUser, canViewAssignedOnly, canViewCrossCompanySubcontract,
  getUserCompanyMemberships, hasRole, isAdminSession, isOwnerSession,
  timeEntryFilter, companyFilter, getActiveCompanyId, hasCompanyAccess,
  canAccessJob, canReadEntity, canWriteEntity, requireCompanyScope,
  safeCompanyFilter, resolvePermissions,
} from '@/lib/permissions';

export function usePermissions() {
  const company = getCurrentCompany();
  const employee = getSessionEmployee();
  const sessionRole = getInternalRole();

  const { data: memberships = [], isLoading: loadingMemberships } = useQuery({
    queryKey: ['company-memberships', employee?.id],
    queryFn: () => employee
      ? base44.entities.CompanyMembership.filter({ employee_id: employee.id, is_active: true })
      : Promise.resolve([]),
    enabled: !!employee,
    staleTime: 5 * 60 * 1000,
  });

  const myMemberships = getUserCompanyMemberships(memberships);
  const canViewFinancialRecords = canViewFinancials(myMemberships);
  const canEditFinancialRecords = canEditFinancials(myMemberships);
  const permissions = {
    ...resolvePermissions({ role: sessionRole || 'staff' }),
    view_financials: canViewFinancialRecords,
    edit_financials: canEditFinancialRecords,
    manage_invoices: canEditFinancialRecords,
    manage_expenses: canEditFinancialRecords,
    manage_payments: canEditFinancialRecords,
    delete_payments: canEditFinancialRecords,
  };

  return {
    // Context
    company,
    employee,
    sessionRole,
    memberships: myMemberships,
    permissions,
    loading: loadingMemberships,

    // Flags
    isOwner: isOwnerSession(),
    isAdmin: isAdminSession(),
    hasCompany: !!company,
    activeCompanyId: getActiveCompanyId({ activeCompany: company }),

    // Operational permissions
    canManageJobs: canManageJobs(myMemberships),
    canViewJobs: canViewJobs(myMemberships),
    canManageCRM: canManageCRM(myMemberships),
    canManageSchedule: canManageSchedule(myMemberships),
    canManageWorkOrders: canManageWorkOrders(myMemberships),
    canViewWorkOrders: canViewWorkOrders(myMemberships),
    canManageTimeEntries: canManageTimeEntries(myMemberships),
    canViewAllTimeEntries: canViewAllTimeEntries(myMemberships),
    canManageRestoration: canManageRestoration(myMemberships),
    canApproveNexus: canApproveNexus(myMemberships),
    canSubmitNexus: canSubmitNexus(myMemberships),
    canManageXactimate: canManageXactimate(myMemberships),
    canReviewSubcontractNote: canReviewSubcontractNote(myMemberships),
    canViewSubcontractOrigin: canViewSubcontractOrigin(myMemberships),

    // Financial permissions
    canViewFinancials: canViewFinancialRecords,
    canEditFinancials: canEditFinancialRecords,

    // Access management permissions
    canManageAccess: canManageAccess(myMemberships),
    canManageCompanyMemberships: canManageCompanyMemberships(myMemberships),
    canAssignReviewer: canAssignReviewer(myMemberships),
    canDeactivateUser: canDeactivateUser(myMemberships),
    canViewAssignedOnly: canViewAssignedOnly(myMemberships),
    canViewCrossCompanySubcontract: canViewCrossCompanySubcontract(myMemberships),

    // Record-level checks (pass record)
    canViewRecord: (record) => canViewRecord(record, company, myMemberships),
    canEditRecord: (record) => canEditRecord(record, company, myMemberships),
    hasCompanyAccess: (companyId) => hasCompanyAccess({ activeCompany: company, employee, memberships: myMemberships, sessionRole }, companyId),
    canAccessJob: (job) => canAccessJob({ activeCompany: company, employee, memberships: myMemberships, sessionRole }, job),
    canReadEntity: (entityName, record, context = {}) => canReadEntity({ activeCompany: company, employee, memberships: myMemberships, sessionRole, ...context }, entityName, record),
    canWriteEntity: (entityName, record, context = {}) => canWriteEntity({ activeCompany: company, employee, memberships: myMemberships, sessionRole, ...context }, entityName, record),

    // Filter builders
    companyFilter: () => companyFilter(company),
    timeEntryFilter: () => timeEntryFilter(company, myMemberships),
    safeCompanyFilter: (extra) => safeCompanyFilter(company?.id, extra),
    requireCompanyScope: (queryParams = {}) => requireCompanyScope(queryParams, company?.id),
  };
}

export default usePermissions;
