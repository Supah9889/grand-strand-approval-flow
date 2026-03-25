import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isCordovaAvailable, logNavigation } from './webviewBridge';

const NavigationContext = createContext();

/**
 * NavigationProvider manages isolated navigation stacks per bottom tab
 * Each tab maintains its own history, enabling smooth tab switching without losing navigation state
 */
export function NavigationProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const tabStacksRef = useRef({});
  const [, forceUpdate] = useState({});

  // Initialize tab-specific navigation stacks
  const initializeTabStack = (tabName, initialRoute) => {
    if (!tabStacksRef.current[tabName]) {
      tabStacksRef.current[tabName] = [initialRoute];
    }
  };

  // Push to the current tab's stack
  const pushRoute = (tabName, route) => {
    initializeTabStack(tabName, '/');
    const stack = tabStacksRef.current[tabName];
    if (stack[stack.length - 1] !== route) {
      stack.push(route);
      logNavigation('push', { tabName, route, stackLength: stack.length });
      navigate(route);
    }
  };

  // Pop from the current tab's stack
  const popRoute = (tabName) => {
    const stack = tabStacksRef.current[tabName];
    if (stack && stack.length > 1) {
      stack.pop();
      const previousRoute = stack[stack.length - 1];
      logNavigation('pop', { tabName, previousRoute, stackLength: stack.length });
      navigate(previousRoute, { replace: true });
      return true;
    }
    return false;
  };

  // Replace current route in the tab's stack
  const replaceRoute = (tabName, route) => {
    initializeTabStack(tabName, '/');
    const stack = tabStacksRef.current[tabName];
    if (stack.length > 0) {
      stack[stack.length - 1] = route;
      logNavigation('replace', { tabName, route });
      navigate(route, { replace: true });
    }
  };

  // Get the current stack for a tab
  const getTabStack = (tabName) => {
    return tabStacksRef.current[tabName] || [];
  };

  // Clear a tab's stack (e.g., on logout)
  const clearTabStack = (tabName) => {
    tabStacksRef.current[tabName] = ['/'];
    logNavigation('clear', { tabName });
  };

  // Handle hardware back button via Cordova
  useEffect(() => {
    if (!isCordovaAvailable()) {
      return;
    }

    const handleBackButton = () => {
      // Try to pop from the current tab stack
      const tabName = getCurrentTabName(location.pathname);
      const didPop = popRoute(tabName);

      if (!didPop) {
        // If we can't pop further, exit the app or navigate to home
        if (location.pathname !== '/') {
          navigate('/');
        } else {
          // Last route in stack - could minimize app or trigger native close
          if (navigator.app) {
            navigator.app.exitApp();
          }
        }
      }
    };

    document.addEventListener('backbutton', handleBackButton);
    return () => document.removeEventListener('backbutton', handleBackButton);
  }, [location, navigate]);

  // Sync tab stack on location change
  useEffect(() => {
    const tabName = getCurrentTabName(location.pathname);
    initializeTabStack(tabName, location.pathname);
    forceUpdate({});
  }, [location.pathname]);

  return (
    <NavigationContext.Provider
      value={{
        pushRoute,
        popRoute,
        replaceRoute,
        getTabStack,
        clearTabStack,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

/**
 * Get the current tab name from the pathname
 */
function getCurrentTabName(pathname) {
  const tabRouteMap = {
    'dashboard': /^\/(dashboard|job-hub|admin-overview)/,
    'time': /^\/(time-clock|time-entries)/,
    'finance': /^\/(invoices|expenses|payments|bills|purchase-orders)/,
    'operations': /^\/(tasks|daily-logs|warranty)/,
    'settings': /^\/(mobile-settings|profile|verification)/,
  };

  for (const [tab, pattern] of Object.entries(tabRouteMap)) {
    if (pattern.test(pathname)) return tab;
  }

  return 'dashboard';
}

/**
 * Hook to use navigation within components
 */
export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}