import React from 'react';
import { Menu, ChevronLeft, Plus, Search, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNavigation } from '@/lib/NavigationContext';
import { getInternalRole, getSessionEmployee } from '@/lib/adminAuth';
import CompanyLogo from './CompanyLogo';

export default function AppTopBar({ onMenuOpen, title }) {
  const navigate = useNavigate();
  const { getTabStack, popRoute } = useNavigation();
  const role = getInternalRole();
  const sessionEmployee = getSessionEmployee();
  const canCreateJob = role === 'admin' || role === 'owner';
  const profileLabel = sessionEmployee?.name || (role ? `${role[0].toUpperCase()}${role.slice(1)} Session` : 'User');

  const handleBack = () => {
    const tabName = getTabFromPath(window.location.pathname);
    const didPop = popRoute(tabName);
    if (!didPop) {
      navigate('/');
    }
  };

  // Show back button if current stack depth > 1 (not at primary tab route)
  const tabName = getTabFromPath(window.location.pathname);
  const stack = getTabStack(tabName);
  const showBackButton = stack.length > 1;

  return (
    <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 shadow-sm backdrop-blur">
      {showBackButton ? (
        <button
          onClick={handleBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      ) : (
        <button
          onClick={onMenuOpen}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <CompanyLogo className="h-7 w-auto shrink-0" />
        {title && (
          <>
            <span className="h-5 w-px bg-border" />
            <span className="truncate text-sm font-semibold text-foreground">{title}</span>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate('/global-search')}
        className="hidden h-9 min-h-0 w-full max-w-xs items-center gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground md:flex"
        aria-label="Open global search"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search jobs, files, and records</span>
      </button>

      <button
        type="button"
        onClick={() => navigate('/global-search')}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground md:hidden"
        aria-label="Open global search"
      >
        <Search className="h-4 w-4" />
      </button>

      {canCreateJob && (
        <button
          type="button"
          onClick={() => navigate('/new-job')}
          className="hidden h-9 min-h-0 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:flex"
        >
          <Plus className="h-4 w-4" />
          <span>New Job</span>
        </button>
      )}

      <div className="hidden min-h-0 items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-medium text-muted-foreground sm:flex">
        <UserCircle className="h-4 w-4" />
        <span className="max-w-32 truncate">{profileLabel}</span>
      </div>
    </div>
  );
}

function getTabFromPath(pathname) {
  if (/^\/(dashboard|job-hub|admin-overview)/.test(pathname)) return 'dashboard';
  if (/^\/(time-clock|time-entries)/.test(pathname)) return 'time';
  if (/^\/(invoices|expenses|payments|bills|purchase-orders)/.test(pathname)) return 'finance';
  if (/^\/(tasks|daily-logs|warranty)/.test(pathname)) return 'operations';
  if (/^\/(mobile-settings|profile)/.test(pathname)) return 'settings';
  return 'dashboard';
}
