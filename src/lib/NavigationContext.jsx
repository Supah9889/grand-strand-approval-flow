import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const NavigationContext = createContext();

export function NavigationProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const historyStackRef = useRef([]);

  // Initialize or update the history stack
  useEffect(() => {
    historyStackRef.current.push(location.pathname);
  }, [location.pathname]);

  // Handle Android hardware back button
  useEffect(() => {
    const handleBackButton = (event) => {
      const stack = historyStackRef.current;
      
      // Remove current route from stack
      if (stack.length > 1) {
        stack.pop(); // Remove current
        const previousRoute = stack[stack.length - 1];
        navigate(previousRoute, { replace: true });
      }
    };

    document.addEventListener('backbutton', handleBackButton);
    return () => {
      document.removeEventListener('backbutton', handleBackButton);
    };
  }, [navigate]);

  const push = (route) => {
    navigate(route);
  };

  const pop = () => {
    if (historyStackRef.current.length > 1) {
      historyStackRef.current.pop();
      const previousRoute = historyStackRef.current[historyStackRef.current.length - 1];
      navigate(previousRoute, { replace: true });
    }
  };

  const replace = (route) => {
    if (historyStackRef.current.length > 0) {
      historyStackRef.current[historyStackRef.current.length - 1] = route;
    }
    navigate(route, { replace: true });
  };

  return (
    <NavigationContext.Provider value={{ push, pop, replace }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}