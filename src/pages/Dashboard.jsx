import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, PenLine, CheckCircle2, TrendingUp, Clock, ClipboardList, FileDiff, FileText, ShieldCheck, BookOpen, StickyNote, Briefcase, Users, ArrowRight } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { StatCard, SectionHeader } from '../components/dashboard/DashSection';
import DrillDownList from '../components/dashboard/DrillDownList';
import { getInternalRole, isAdmin as getIsAdmin } from '@/lib/adminAuth';
import { format } from 'date-fns';

const todayStr = new Date().toDateString();
const todayISO = new Date().toISOString().split('T')[0];

export default function Dashboard() {
  const navigate = useNavigate();
  const role = getInternalRole();
  const isAdmin = getIsAdmin(); // true for admin + owner
  const [activeSection, setActiveSection] = useState(null);

  // All data loads
  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['dashboard-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date'),
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['dashboard-tasks'],
    queryFn: () => base44.entities.Task.list('-created_date', 200),
    enabled: isAdmin,
  });
  const { data: leads = [] } = useQuery({
    queryKey: ['dashboard-leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
    enabled: isAdmin,
  });
  const { data: changeOrders = [] } = useQuery({
    queryKey: ['dashboard-cos'],
    queryFn: () => base44.entities.ChangeOrder.list('-created_date', 100),
    enabled: isAdmin,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 200),
    enabled: isAdmin,
  });
  const { data: warrantyItems = [] } = useQuery({
    queryKey: ['dashboard-warranty'],
    queryFn: () => base44.entities.WarrantyItem.list('-created_date', 100),
    enabled: isAdmin,
  });
  const { data: timeEntries = [] } = useQuery({
    queryKey: ['dashboard-time'],
    queryFn: () => base44.entities.TimeEntry.list('-clock_in', 200),
  });
  const { data: dailyLogs = [] } = useQuery({
    queryKey: ['dashboard-logs'],
    queryFn: () => base44.entities.DailyLog.list('-log_date', 50),
    enabled: isAdmin,
  });
  const { data: notes = [] } = useQuery({
    queryKey: ['dashboard-notes'],
    queryFn: () => base44.entities.JobNote.list('-created_date', 50),
  });
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['dashboard-audit'],
    queryFn: () => base44.entities.AuditLog.list('-timestamp', 10),
    enabled: isAdmin,
  });

  // Derived counts
  const pending       = useMemo(() => jobs.filter(j => j.status === 'pending'), [jobs]);
  const approved      = useMemo(() => jobs.filter(j => j.status === 'approved'), [jobs]);
  const activeJobs    = useMemo(() => jobs.filter(j => ['open','in_progress','waiting'].includes(j.lifecycle_status)), [jobs]);
  const warrantyJobs  = useMemo(() => jobs.filter(j => j.lifecycle_status === 'warranty'), [jobs]);

  const openLeads     = useMemo(() => leads.filter(l => !['won','lost','converted_to_job','archived','duplicate'].includes(l.status)), [leads]);
  const openTodos     = useMemo(() => tasks.filter(t => ['open','in_progress','waiting'].includes(t.status)), [tasks]);
  const openCOs       = useMemo(() => changeOrders.filter(co => ['draft','sent','in_review'].includes(co.status)), [changeOrders]);
  const openInvoices  = useMemo(() => invoices.filter(i => ['draft','sent','partial','overdue'].includes(i.status)), [invoices]);
  const openWarranty  = useMemo(() => warrantyItems.filter(w => ['new','scheduled','in_progress'].includes(w.status)), [warrantyItems]);
  const todayTime     = useMemo(() => timeEntries.filter(e => e.clock_in && new Date(e.clock_in).toDateString() === todayStr), [timeEntries]);
  const clockedInNow  = useMemo(() => todayTime.filter(e => e.status === 'clocked_in').length, [todayTime]);
  const recentLogs    = useMemo(() => dailyLogs.slice(0, 20), [dailyLogs]);
  const unreadNotes   = useMemo(() => notes.filter(n => !n.read).length, [notes]);

  const DRILL_DATA = {
    pending, approved, active: activeJobs, warranty_jobs: warrantyJobs,
    leads: openLeads, todos: openTodos, change_orders: openCOs,
    invoices: openInvoices, warranty: openWarranty,
    time_today: todayTime, daily_logs: recentLogs, notes,
  };

  const DRILL_LABELS = {
    pending: 'Pending Signatures',
    approved: 'Signed Jobs',
    active: 'Active Jobs',
    warranty_jobs: 'Jobs in Warranty',
    leads: 'Open Leads / Presale',
    todos: 'Open To-Dos & Tasks',
    change_orders: 'Open Change Orders',
    invoices: 'Open Invoices',
    warranty: 'Open Warranty Requests',
    time_today: "Today's Time Entries",
    daily_logs: 'Recent Daily Logs',
    notes: 'Notes & Activity',
  };

  const toggle = (key) => setActiveSection(s => s === key ? null : key);

  return (
    <AppLayout title="Dashboard">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-7">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Operations Overview</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Grand Strand Custom Painting · {format(new Date(), 'EEE, MMM d')}</p>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="flex items-center gap-1.5 h-8 px-3 bg-primary text-primary-foreground text-xs font-medium rounded-xl hover:bg-primary/90 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" /> Sign Job
          </button>
        </div>

        {loadingJobs ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* ── SIGNATURES / APPROVALS ── */}
            <div className="space-y-3">
              <SectionHeader title="Signatures & Approvals" onViewAll={() => navigate('/search')} viewAllLabel="Open Signing Flow" />
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={PenLine} label="Pending Signatures" value={pending.length} color="text-amber-600" bg="bg-amber-50" urgent={pending.length > 0} onClick={() => toggle('pending')} />
                <StatCard icon={CheckCircle2} label="Signed Jobs" value={approved.length} color="text-blue-600" bg="bg-blue-50" onClick={() => toggle('approved')} />
              </div>
            </div>

            {/* ── JOBS / PROJECTS ── */}
            <div className="space-y-3">
              <SectionHeader title="Jobs & Projects" onViewAll={() => navigate('/search')} />
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Briefcase} label="Active Jobs" value={activeJobs.length} color="text-primary" bg="bg-secondary" onClick={() => toggle('active')} />
                <StatCard icon={ShieldCheck} label="Warranty Phase" value={warrantyJobs.length} color="text-violet-600" bg="bg-violet-50" onClick={() => toggle('warranty_jobs')} />
              </div>
            </div>

            {/* ── SALES / PRESALE (admin only) ── */}
            {isAdmin && (
              <div className="space-y-3">
                <SectionHeader title="Sales & Presale" onViewAll={() => navigate('/sales')} />
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon={TrendingUp} label="Open Leads" value={openLeads.length} color="text-emerald-600" bg="bg-emerald-50" onClick={() => toggle('leads')} />
                  <StatCard icon={FileDiff} label="Open Change Orders" value={openCOs.length} color="text-indigo-600" bg="bg-indigo-50" onClick={() => toggle('change_orders')} />
                </div>
              </div>
            )}

            {/* ── FIELD ACTIVITY (admin only) ── */}
            {isAdmin && (
              <div className="space-y-3">
                <SectionHeader title="Field Activity" onViewAll={() => navigate('/time-entries')} />
                <div className="grid grid-cols-3 gap-2">
                  <StatCard icon={Users} label="Clocked In" value={clockedInNow} color="text-violet-600" bg="bg-violet-50" onClick={() => toggle('time_today')} />
                  <StatCard icon={Clock} label="Entries Today" value={todayTime.length} color="text-slate-600" bg="bg-slate-100" onClick={() => toggle('time_today')} />
                  <StatCard icon={BookOpen} label="Recent Logs" value={recentLogs.length} color="text-orange-600" bg="bg-orange-50" onClick={() => toggle('daily_logs')} />
                </div>
              </div>
            )}

            {/* ── TASKS ── */}
            {isAdmin && (
              <div className="space-y-3">
                <SectionHeader title="Tasks & To-Dos" onViewAll={() => navigate('/tasks')} />
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon={ClipboardList} label="Open To-Dos" value={openTodos.length} color="text-sky-600" bg="bg-sky-50"
                    urgent={openTodos.some(t => t.due_date && new Date(t.due_date) < new Date())}
                    onClick={() => toggle('todos')} />
                  <StatCard icon={BookOpen} label="Daily Logs" value={recentLogs.length} color="text-orange-600" bg="bg-orange-50" sub="Recent" onClick={() => toggle('daily_logs')} />
                </div>
              </div>
            )}

            {/* ── FINANCIALS (admin only) ── */}
            {isAdmin && (
              <div className="space-y-3">
                <SectionHeader title="Financials" onViewAll={() => navigate('/financials')} />
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon={FileText} label="Open Invoices" value={openInvoices.length} color="text-emerald-600" bg="bg-emerald-50"
                    urgent={openInvoices.some(i => i.status === 'overdue')}
                    onClick={() => toggle('invoices')} />
                  <StatCard icon={ShieldCheck} label="Warranty Requests" value={openWarranty.length} color="text-rose-600" bg="bg-rose-50" onClick={() => toggle('warranty')} />
                </div>
              </div>
            )}

            {/* ── NOTES / ACTIVITY ── */}
            <div className="space-y-3">
              <SectionHeader title="Notes & Activity" onViewAll={() => navigate('/notes')} />
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={StickyNote} label="Notes" value={notes.length} sub={unreadNotes > 0 ? `${unreadNotes} unread` : undefined}
                  color="text-amber-600" bg="bg-amber-50" urgent={unreadNotes > 0} onClick={() => toggle('notes')} />
                {isAdmin && auditLogs.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Recent Activity</p>
                    <div className="space-y-1.5">
                      {auditLogs.slice(0, 3).map(log => (
                        <div key={log.id} className="flex items-start gap-1.5">
                          <Clock className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                          <p className="text-xs text-muted-foreground leading-snug line-clamp-1">{log.detail || log.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── DRILL-DOWN PANEL ── */}
            {activeSection && (
              <DrillDownList
                section={activeSection}
                data={DRILL_DATA[activeSection] || []}
                label={DRILL_LABELS[activeSection] || ''}
                onClear={() => setActiveSection(null)}
              />
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}