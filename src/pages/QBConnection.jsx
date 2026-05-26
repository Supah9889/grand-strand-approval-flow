import React from 'react';
import AppLayout from '@/components/AppLayout';
import QBExportPanel from '@/components/admin/QBExportPanel';

export default function QBConnection() {
  return (
    <AppLayout title="QuickBooks Connection">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <QBExportPanel />
        </div>
      </div>
    </AppLayout>
  );
}