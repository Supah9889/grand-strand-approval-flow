import React from 'react';
import { Menu, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNavigation } from '@/lib/NavigationContext';
import CompanyLogo from './CompanyLogo';

export default function AppTopBar({ onMenuOpen, title }) {
  const navigate = useNavigate();
  const { getTabStack, popRoute } = useNavigation();

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

      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <CompanyLogo className="h-7 w-auto shrink-0" />
        {title && (
          <>
            <span className="h-5 w-px bg-border" />
            <span className="truncate text-sm font-semibold text-foreground">{title}</span>
          </>
        )}
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
