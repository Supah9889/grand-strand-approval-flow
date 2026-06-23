/**
 * usePermissions — React hook providing permission context
 *
 * Usage:
 *   const { company, canManageJobs, canViewRecord, ... } = usePermissions();
 *
 * Loads CompanyMembership for the current employee once per session and
 * provides pre-bound permission check functions.
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
    staleTime: 5 * 60 * 1000, // 5 min cache
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

    // Feature checks (pre-bound to loaded memberships)
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

    // Record-level checks (pass record)
    canViewRecord: (record) => canViewRecord(record, company, myMemberships),
    canEditRecord: (record) => canEditRecord(record, company, myMemberships),

    // Filter builders
    companyFilter: () => companyFilter(company),
    timeEntryFilter: () => timeEntryFilter(company, myMemberships),
  };
}

export default usePermissions;