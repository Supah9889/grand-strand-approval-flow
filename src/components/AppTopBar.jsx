import React from 'react';
import { Menu } from 'lucide-react';
import CompanyLogo from './CompanyLogo';

export default function AppTopBar({ onMenuOpen, title }) {
  return (
    <div className="sticky top-0 z-30 bg-white border-b border-border flex items-center h-14 px-4 gap-3 shadow-sm">
      <button
        onClick={onMenuOpen}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

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