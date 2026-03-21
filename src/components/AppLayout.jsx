import React, { useState } from 'react';
import AppTopBar from './AppTopBar';
import Sidebar from './Sidebar';

export default function AppLayout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background font-inter flex flex-col">
      <AppTopBar onMenuOpen={() => setSidebarOpen(true)} title={title} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}