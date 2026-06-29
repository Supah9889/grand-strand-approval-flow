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
import { Building2 } from 'lucide-react';
import { getCurrentCompany } from '@/lib/permissions';
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

export default function CompanyGuard({ children, message }) {
  const company = getCurrentCompany();
  if (!hasSelectedCompany(company)) return <NoCompanyState message={message} />;
  return children;
}

/**
 * Hook version — returns a JSX element to render if no company, or null if all good.
 * Useful in pages that already have their own layout wrapper.
 */
export function useCompanyGuard(message) {
  const company = getCurrentCompany();
  if (!hasSelectedCompany(company)) return <NoCompanyState message={message} />;
  return null;
}
