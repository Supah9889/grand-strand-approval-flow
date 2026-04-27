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
    <div className="sticky top-0 z-30 bg-white border-b border-border flex items-center h-14 px-4 gap-3 shadow-sm">
      {showBackButton ? (
        <button
          onClick={handleBack}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      ) : (
        <button
          onClick={onMenuOpen}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <CompanyLogo className="h-7 w-auto shrink-0" />
        {title && (
          <>
            <span className="text-border">|</span>
            <span className="text-sm font-medium text-foreground truncate">{title}</span>
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