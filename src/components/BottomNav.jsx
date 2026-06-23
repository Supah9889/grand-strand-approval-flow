import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNavigation } from '@/lib/NavigationContext';
import { getInternalRole, isUnlocked } from '@/lib/adminAuth';
import { Home, Search, Clock, DollarSign, Settings, Briefcase, CalendarDays, FolderOpen, MoreHorizontal, HardHat, ClipboardCheck } from 'lucide-react';

const ADMIN_NAV_ITEMS = [
  { label: 'Dashboard', tabName: 'dashboard', primaryPath: '/dashboard', icon: Home },
  { label: 'Search', tabName: 'search', primaryPath: '/global-search', icon: Search },
  { label: 'Time', tabName: 'time', primaryPath: '/time-clock', icon: Clock },
  { label: 'Financials', tabName: 'finance', primaryPath: '/financials', icon: DollarSign },
  { label: 'Admin', tabName: 'admin', primaryPath: '/admin', icon: Settings },
];

const STAFF_NAV_ITEMS = [
  { label: 'Field', tabName: 'field', primaryPath: '/field', icon: HardHat },
  { label: 'Work Orders', tabName: 'workorders', primaryPath: '/work-orders', icon: ClipboardCheck },
  { label: 'Time', tabName: 'time', primaryPath: '/time-clock', icon: Clock },
  { label: 'Schedule', tabName: 'schedule', primaryPath: '/field-schedule', icon: CalendarDays },
  { label: 'More', tabName: 'more', primaryPath: '/dashboard', icon: MoreHorizontal },
];

function getActiveTab(pathname, isAdminOrOwner) {
  if (isAdminOrOwner) {
    if (/^\/(dashboard|job-hub|admin-overview)/.test(pathname)) return 'dashboard';
    if (/^\/(search|global-search)/.test(pathname)) return 'search';
    if (/^\/(time-entries|time-clock)/.test(pathname)) return 'time';
    if (/^\/(financials|invoices|expenses|payments)/.test(pathname)) return 'finance';
    if (/^\/admin/.test(pathname)) return 'admin';
    return 'dashboard';
  }

  if (/^\/field/.test(pathname)) return 'field';
  if (/^\/work-orders/.test(pathname)) return 'workorders';
  if (/^\/(time-entries|time-clock)/.test(pathname)) return 'time';
  if (/^\/field-schedule/.test(pathname)) return 'schedule';
  return 'more';
}

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getTabStack } = useNavigation();
  const role = getInternalRole();
  const isAdminOrOwner = role === 'admin' || role === 'owner';

  const NAV_ITEMS = isAdminOrOwner ? ADMIN_NAV_ITEMS : STAFF_NAV_ITEMS;
  const activeTab = getActiveTab(location.pathname, isAdminOrOwner);

  const handleTabClick = (tabName, primaryPath) => {
    // Block navigation entirely if the app session is not unlocked
    if (!isUnlocked()) {
      navigate('/gate', { replace: true });
      return;
    }

    const stack = getTabStack(tabName);
    const lastRoute = stack.length > 0 ? stack[stack.length - 1] : primaryPath;

    if (lastRoute !== location.pathname) {
      navigate(lastRoute || primaryPath);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around items-center h-16 safe-area-bottom lg:hidden">
      {NAV_ITEMS.map(({ label, tabName, primaryPath, icon: Icon }) => (
        <button
          key={tabName}
          onClick={() => handleTabClick(tabName, primaryPath)}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            activeTab === tabName
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label={label}
        >
          <Icon className="w-5 h-5" />
          <span className="text-[10px] mt-1">{label}</span>
        </button>
      ))}
    </nav>
  );
}