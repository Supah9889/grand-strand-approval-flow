import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Clock, DollarSign, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: Home },
  { label: 'Search', path: '/search', icon: Search },
  { label: 'Time', path: '/time-entries', icon: Clock },
  { label: 'Financials', path: '/financials', icon: DollarSign },
  { label: 'Admin', path: '/admin', icon: Settings },
];

const TAB_HISTORY = {
  '/dashboard': ['/dashboard'],
  '/search': ['/search'],
  '/time-entries': ['/time-entries'],
  '/financials': ['/financials'],
  '/admin': ['/admin'],
};

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabHistories, setTabHistories] = useState(TAB_HISTORY);

  const getActiveTab = () => {
    const mainPaths = NAV_ITEMS.map(item => item.path);
    return mainPaths.find(path => location.pathname.startsWith(path)) || '/dashboard';
  };

  const handleNavClick = (path) => {
    const currentTab = getActiveTab();
    
    if (currentTab === path) {
      // Same tab: navigate to first route in history or reset
      navigate(path);
    } else {
      // Different tab: restore last route for this tab or go to its main path
      const lastRoute = tabHistories[path]?.[tabHistories[path].length - 1] || path;
      navigate(lastRoute);
      
      // Update tab histories
      setTabHistories(prev => ({
        ...prev,
        [path]: prev[path] || [path],
      }));
    }
  };

  // Track route changes for current tab
  useEffect(() => {
    const activeTab = getActiveTab();
    setTabHistories(prev => {
      const history = prev[activeTab] || [activeTab];
      if (!history.includes(location.pathname)) {
        return {
          ...prev,
          [activeTab]: [...history, location.pathname],
        };
      }
      return prev;
    });
  }, [location.pathname]);

  const activeTab = getActiveTab();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around items-center h-16 safe-area-bottom">
      {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
        <button
          key={path}
          onClick={() => handleNavClick(path)}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            activeTab === path
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