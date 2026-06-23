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
  timeEntryFilter, companyFilter,
} from '@/lib/permissions';

export function usePermissions() {
  const company = getCurrentCompany();
  const employee = getSessionEmployee();
  const sessionRole = getInternalRole();

  const { data: memberships = [] } = useQuery({
    queryKey: ['company-memberships', employee?.id],
    queryFn: () => employee
      ? base44.entities.CompanyMembership.filter({ employee_id: employee.id, is_active: true })
      : Promise.resolve([]),
    enabled: !!employee,
    staleTime: 5 * 60 * 1000,
  });

  const myMemberships = getUserCompanyMemberships(memberships);

  return {
    // Context
    company,
    employee,
    sessionRole,
    memberships: myMemberships,

    // Flags
    isOwner: isOwnerSession(),
    isAdmin: isAdminSession(),
    hasCompany: !!company,

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
    canViewFinancials: canViewFinancials(myMemberships),
    canEditFinancials: canEditFinancials(myMemberships),

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

    // Filter builders
    companyFilter: () => companyFilter(company),
    timeEntryFilter: () => timeEntryFilter(company, myMemberships),
  };
}

export default usePermissions;