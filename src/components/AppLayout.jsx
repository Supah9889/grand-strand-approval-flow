import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppTopBar from './AppTopBar';
import JobContextSidebar, { MobileJobContextBar } from './JobContextSidebar';
import Sidebar from './Sidebar';
import HelpAssistant from './help/HelpAssistant';

const NO_JOB_WORKSPACE_PATHS = [
  /^\/$/,
  /^\/gate$/,
  /^\/signature/,
  /^\/approval/,
  /^\/approve/,
  /^\/confirmation/,
  /^\/review/,
  /^\/portal\/client/,
  /^\/portal\/vendor/,
  /^\/verify-invite/,
];

export default function AppLayout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const showJobWorkspace = !NO_JOB_WORKSPACE_PATHS.some(pattern => pattern.test(location.pathname));

  return (
    <div className="app-shell flex flex-col">
      <AppTopBar onMenuOpen={() => setSidebarOpen(true)} title={title} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {showJobWorkspace ? (
        <div className="flex flex-1 min-h-0">
          <JobContextSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileJobContextBar />
            <main className="app-main min-w-0">
              {children}
            </main>
          </div>
        </div>
      ) : (
        <main className="app-main">
          {children}
        </main>
      )}
      <HelpAssistant />
    </div>
  );
}
