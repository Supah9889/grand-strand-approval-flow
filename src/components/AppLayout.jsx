import React, { useState } from 'react';
import AppTopBar from './AppTopBar';
import Sidebar from './Sidebar';
import HelpAssistant from './help/HelpAssistant';

export default function AppLayout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell flex flex-col">
      <AppTopBar onMenuOpen={() => setSidebarOpen(true)} title={title} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="app-main">
        {children}
      </main>
      <HelpAssistant />
    </div>
  );
}
