/**
 * CompanyGuard — renders children only when an active company is selected.
 * Shows a friendly prompt with a link to CompanySelect otherwise.
 *
 * Usage:
 *   <CompanyGuard>
 *     <YourPage />
 *   </CompanyGuard>
 *
 * Or inline:
 *   const guard = useCompanyGuard();
 *   if (guard) return guard;
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getInternalRole, getSessionEmployee } from '@/lib/adminAuth';
import { canUseActiveCompanySelection, getCurrentCompany, isAdminFallbackRole } from '@/lib/permissions';
import { hasSelectedCompany } from '@/lib/routeSecurity';

export function NoCompanyState({ message }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
        <Building2 className="w-6 h-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">No company selected</p>
        <p className="text-xs text-muted-foreground mt-1">{message || 'Select a company before continuing.'}</p>
      </div>
      <button
        onClick={() => navigate('/company-select')}
        className="h-9 px-4 bg-primary text-primary-foreground text-sm font-semibold rounded-xl"
      >
        Select Company
      </button>
    </div>
  );
}

export function NoAccessState({ message }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
        <Building2 className="w-6 h-6 text-red-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Access restricted</p>
        <p className="text-xs text-muted-foreground mt-1">{message || 'You do not have access to this area.'}</p>
      </div>
      <button
        onClick={() => navigate('/dashboard')}
        className="h-9 px-4 bg-primary text-primary-foreground text-sm font-semibold rounded-xl"
      >
        Back to Dashboard
      </button>
    </div>
  );
}

export function PendingReviewState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
        <Building2 className="w-5 h-5 text-amber-500" />
      </div>
      <div>
        <p className="text-sm font-semibold text-amber-800">Awaiting Review</p>
        <p className="text-xs text-muted-foreground mt-1">{message || 'This item is awaiting review before it becomes visible.'}</p>
      </div>
    </div>
  );
}

function AdminFallbackBanner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-800">
      Company memberships have not been initialized. Admin fallback access is active.
    </div>
  );
}

export default function CompanyGuard({ children, message }) {
  const company = getCurrentCompany();
  const companyId = typeof company === 'string' ? company : company?.id;
  const employee = getSessionEmployee();
  const sessionRole = getInternalRole();
  const isAdminFallback = isAdminFallbackRole(sessionRole);
  const hasCompany = hasSelectedCompany(company);
  const needsMembershipCheck = hasCompany && !!employee?.id && !isAdminFallback;
  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ['company-guard-membership', employee?.id, companyId],
    queryFn: () => base44.entities.CompanyMembership.filter({
      employee_id: employee.id,
      company_id: companyId,
      is_active: true,
    }),
    enabled: needsMembershipCheck,
    staleTime: 30 * 1000,
    retry: false,
  });
  const { data: membershipProbe = [] } = useQuery({
    queryKey: ['company-membership-bootstrap-probe'],
    queryFn: () => base44.entities.CompanyMembership.list('created_date', 1).catch(() => []),
    enabled: hasCompany && isAdminFallback,
    staleTime: 30 * 1000,
    retry: false,
  });

  if (!hasCompany) return <NoCompanyState message={message} />;
  if (needsMembershipCheck && isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!canUseActiveCompanySelection({ sessionRole, employee, memberships }, company)) {
    return <NoAccessState message="You are not assigned to the selected company. Select an assigned company or contact an admin." />;
  }
  if (isAdminFallback && membershipProbe.length === 0) {
    return (
      <>
        <AdminFallbackBanner />
        {children}
      </>
    );
  }
  return children;
}

/**
 * Hook version — returns a JSX element to render if no company, or null if all good.
 * Useful in pages that already have their own layout wrapper.
 */
export function useCompanyGuard(message) {
  const company = getCurrentCompany();
  const companyId = typeof company === 'string' ? company : company?.id;
  const employee = getSessionEmployee();
  const sessionRole = getInternalRole();
  const isAdminFallback = isAdminFallbackRole(sessionRole);
  const hasCompany = hasSelectedCompany(company);
  const needsMembershipCheck = hasCompany && !!employee?.id && !isAdminFallback;
  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ['company-guard-membership', employee?.id, companyId],
    queryFn: () => base44.entities.CompanyMembership.filter({
      employee_id: employee.id,
      company_id: companyId,
      is_active: true,
    }),
    enabled: needsMembershipCheck,
    staleTime: 30 * 1000,
    retry: false,
  });

  if (!hasCompany) return <NoCompanyState message={message} />;
  if (needsMembershipCheck && isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!canUseActiveCompanySelection({ sessionRole, employee, memberships }, company)) {
    return <NoAccessState message="You are not assigned to the selected company. Select an assigned company or contact an admin." />;
  }
  return null;
}
