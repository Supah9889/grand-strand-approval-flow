import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Loader2, PenLine, CheckCircle2, Inbox, AlertTriangle, Copy,
  Upload, Archive, Activity, FileText, Clock, ChevronRight, ExternalLink
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { StatCard, SectionHeader } from '../components/dashboard/DashSection';
import { getInternalRole } from '@/lib/adminAuth';
import { format, parseISO } from 'date-fns';

export default function AdminOverview() {
  const navigate = useNavigate();
  const role = getInternalRole();
  const isAdmin = role === 'admin';
  const [activeSection, setActiveSection] = useState(null);

  // Redirect non-admins
  if (!isAdmin) {
    return (
      <AppLayout title="Admin Overview">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Admin access required.</p>
        </div>
      </AppLayout>
    );
  }

  return <AdminOverviewContent navigate={navigate} />;
}

function AdminOverviewContent({ navigate }) {
  const [activeSection, setActiveSection] = useState(null);

  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['ao-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 500),
  });

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['ao-expenses'],
    queryFn: () => base44.entities.Expense.list('-created_date', 500),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['ao-invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 300),
  });

  const { data: bills = [] } = useQuery({
    queryKey: ['ao-bills'],
    queryFn: () => base44.entities.Bill.list('-created_date', 300),
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['ao-time'],
    queryFn: () => base44.entities.TimeEntry.list('-clock_in', 300),
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['ao-audit'],
    queryFn: () => base44.entities.AuditLog.list('-timestamp', 30),
  });

  const isLoading = loadingJobs || loadingExpenses;

  // --- Derived ---
  const pendingJobs   = useMemo(() => jobs.filter(j => j.status === 'pending'), [jobs]);
  const signedJobs    = useMemo(() => jobs.filter(j => j.status === 'approved'), [jobs]);
  const archivedJobs  = useMemo(() => jobs.filter(j => j.lifecycle_status === 'archived'), [jobs]);

  const newInboxItems    = useMemo(() => expenses.filter(e => e.inbox_status === 'new'), [expenses]);
  const needsReviewExp   = useMemo(() => expenses.filter(e => ['needs_review','in_review'].includes(e.inbox_status)), [expenses]);
  const duplicateWarnings = useMemo(() => expenses.filter(e => ['possible_duplicate','needs_review'].includes(e.duplicate_status)), [expenses]);
  const archivedExpenses  = useMemo(() => expenses.filter(e => e.inbox_status === 'archived'), [expenses]);

  const exportReadyInvoices = useMemo(() => invoices.filter(i => i.qb_sync_status === 'not_synced' && ['sent','paid','partial'].includes(i.status)), [invoices]);
  const exportReadyBills    = useMemo(() => bills.filter(b => b.qb_sync_status === 'not_synced' && b.status !== 'draft'), [bills]);
  const exportReadyTime     = useMemo(() => timeEntries.filter(t => t.qb_sync_status === 'not_synced' && t.status !== 'clocked_in'), [timeEntries]);
  const exportReadyCount    = exportReadyInvoices.length + exportReadyBills.length + exportReadyTime.length;

  const recentActivity = useMemo(() => auditLogs.slice(0, 10), [auditLogs]);

  const SECTIONS = {
    pending_sigs:   { label: 'Pending Signatures', data: pendingJobs },
    signed_jobs:    { label: 'Signed Jobs', data: signedJobs },
    new_inbox:      { label: 'New Cost Inbox Items', data: newInboxItems },
    needs_review:   { label: 'Expenses Needing Review', data: needsReviewExp },
    duplicates:     { label: 'Duplicate Warnings', data: duplicateWarnings },
    export_ready:   { label: 'Export-Ready Records', data: [...exportReadyInvoices, ...exportReadyBills, ...exportReadyTime] },
    archived_jobs:  { label: 'Archived Jobs', data: archivedJobs },
    archived_exp:   { label: 'Archived Expenses', data: archivedExpenses },
    activity:       { label: 'Recent Activity', data: recentActivity },
  };

  const toggle = (key) => setActiveSection(s => s === key ? null : key);

  return (
    <AppLayout title="Admin Overview">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-7">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Admin Overview</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(), 'EEE, MMM d, yyyy')}</p>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 h-8 px-3 bg-primary text-primary-foreground text-xs font-medium rounded-xl hover:bg-primary/90 transition-colors"
          >
            Admin Mode <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Signatures */}
            <div className="space-y-3">
              <SectionHeader title="Signatures & Approvals" onViewAll={() => navigate('/search')} viewAllLabel="Open Signing Flow" />
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={PenLine} label="Pending Signatures" value={pendingJobs.length}
                  color="text-amber-600" bg="bg-amber-50" urgent={pendingJobs.length > 0}
                  onClick={() => toggle('pending_sigs')} />
                <StatCard icon={CheckCircle2} label="Signed Jobs" value={signedJobs.length}
                  color="text-blue-600" bg="bg-blue-50"
                  onClick={() => toggle('signed_jobs')} />
              </div>
            </div>

            {/* Cost Inbox */}
            <div className="space-y-3">
              <SectionHeader title="Cost Inbox" onViewAll={() => navigate('/expenses')} />
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Inbox} label="New Inbox Items" value={newInboxItems.length}
                  color="text-primary" bg="bg-secondary" urgent={newInboxItems.length > 0}
                  onClick={() => toggle('new_inbox')} />
                <StatCard icon={AlertTriangle} label="Needs Review" value={needsReviewExp.length}
                  color="text-amber-600" bg="bg-amber-50" urgent={needsReviewExp.length > 0}
                  onClick={() => toggle('needs_review')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Copy} label="Duplicate Warnings" value={duplicateWarnings.length}
                  color="text-orange-600" bg="bg-orange-50" urgent={duplicateWarnings.length > 0}
                  onClick={() => toggle('duplicates')} />
                <StatCard icon={Archive} label="Archived Expenses" value={archivedExpenses.length}
                  color="text-slate-500" bg="bg-slate-100"
                  onClick={() => toggle('archived_exp')} />
              </div>
            </div>

            {/* Export Readiness */}
            <div className="space-y-3">
              <SectionHeader title="QB Export Readiness" onViewAll={() => navigate('/admin')} viewAllLabel="Go to Export" />
              <div className="grid grid-cols-3 gap-2">
                <StatCard icon={FileText} label="Invoices Ready" value={exportReadyInvoices.length}
                  color="text-emerald-600" bg="bg-emerald-50"
                  onClick={() => navigate('/invoices')} />
                <StatCard icon={FileText} label="Bills Ready" value={exportReadyBills.length}
                  color="text-indigo-600" bg="bg-indigo-50"
                  onClick={() => navigate('/bills')} />
                <StatCard icon={Clock} label="Time Entries" value={exportReadyTime.length}
                  color="text-violet-600" bg="bg-violet-50"
                  onClick={() => navigate('/time-entries')} />
              </div>
              <div
                className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center justify-between cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => toggle('export_ready')}
              >
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Total export-ready records</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-primary">{exportReadyCount}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Archived Jobs */}
            <div className="space-y-3">
              <SectionHeader title="Archived" />
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Archive} label="Archived Jobs" value={archivedJobs.length}
                  color="text-slate-500" bg="bg-slate-100"
                  onClick={() => toggle('archived_jobs')} />
              </div>
            </div>

            {/* Recent Activity */}
            <div className="space-y-3">
              <SectionHeader title="Recent Activity" onViewAll={() => navigate('/audit-log')} />
              <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
                {recentActivity.length === 0 && (
                  <p className="text-xs text-muted-foreground">No recent activity.</p>
                )}
                {recentActivity.map((log, i) => (
                  <div key={log.id || i} className="flex items-start gap-2 text-xs">
                    <Activity className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground leading-snug line-clamp-1">{log.detail || log.action}</p>
                      <p className="text-muted-foreground/60">
                        {log.actor ? `${log.actor} · ` : ''}{log.timestamp ? format(parseISO(log.timestamp), 'MMM d, h:mm a') : ''}
                      </p>
                    </div>
                  </div>
                ))}
                {recentActivity.length > 0 && (
                  <button onClick={() => navigate('/audit-log')} className="text-xs text-primary hover:underline pt-1">View full audit log →</button>
                )}
              </div>
            </div>

            {/* Drill-down panel */}
            {activeSection && SECTIONS[activeSection] && (
              <DrillPanel
                label={SECTIONS[activeSection].label}
                data={SECTIONS[activeSection].data}
                onClear={() => setActiveSection(null)}
              />
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

function DrillPanel({ label, data, onClear }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{label}</p>
        <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground">✕ Close</button>
      </div>
      <div className="divide-y divide-border max-h-80 overflow-y-auto">
        {data.length === 0 && (
          <p className="px-4 py-4 text-xs text-muted-foreground">No records.</p>
        )}
        {data.map((item, i) => (
          <div key={item.id || i} className="px-4 py-2.5">
            <DrillRow item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DrillRow({ item }) {
  // Detect record type by available fields and render appropriate summary
  if (item.action) {
    // AuditLog
    return (
      <div className="text-xs">
        <p className="text-foreground line-clamp-1">{item.detail || item.action}</p>
        <p className="text-muted-foreground/70">{item.actor} · {item.timestamp ? format(parseISO(item.timestamp), 'MMM d, h:mm a') : ''}</p>
      </div>
    );
  }
  if (item.vendor_name && item.inbox_status !== undefined) {
    // Expense
    return (
      <div className="text-xs">
        <p className="text-foreground font-medium">{item.vendor_name} — ${Number(item.total_amount || 0).toFixed(2)}</p>
        <p className="text-muted-foreground/70">{item.expense_date || ''} · {item.inbox_status}</p>
      </div>
    );
  }
  if (item.invoice_number) {
    // Invoice
    return (
      <div className="text-xs">
        <p className="text-foreground font-medium">{item.invoice_number} · {item.customer_name}</p>
        <p className="text-muted-foreground/70">${Number(item.amount || 0).toFixed(2)} · {item.status}</p>
      </div>
    );
  }
  if (item.bill_number) {
    // Bill
    return (
      <div className="text-xs">
        <p className="text-foreground font-medium">{item.bill_number} · {item.vendor_name}</p>
        <p className="text-muted-foreground/70">${Number(item.amount || 0).toFixed(2)} · {item.status}</p>
      </div>
    );
  }
  if (item.employee_name) {
    // TimeEntry
    return (
      <div className="text-xs">
        <p className="text-foreground font-medium">{item.employee_name} · {item.cost_code}</p>
        <p className="text-muted-foreground/70">{item.entry_date || ''} · {item.status}</p>
      </div>
    );
  }
  // Job fallback
  return (
    <div className="text-xs">
      <p className="text-foreground font-medium">{item.address || item.title || item.id}</p>
      <p className="text-muted-foreground/70">{item.customer_name} · {item.lifecycle_status || item.status}</p>
    </div>
  );
}