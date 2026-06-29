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
  /^\/accept-invite/,
];

export default function AppLayout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const showJobWorkspace = !NO_JOB_WORKSPACE_PATHS.some(pattern => pattern.test(location.pathname));

  return (
    <div className="app-shell flex h-full min-h-0 flex-col overflow-hidden">
      <AppTopBar onMenuOpen={() => setSidebarOpen(true)} title={title} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {showJobWorkspace ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <JobContextSidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <MobileJobContextBar />
            <main className="app-main min-h-0 min-w-0 overflow-y-auto overscroll-contain">
              {children}
            </main>
          </div>
        </div>
      ) : (
        <main className="app-main min-h-0 overflow-y-auto overscroll-contain">
          {children}
        </main>
      )}
      <HelpAssistant />
    </div>
  );
}
