import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PullToRefresh from '@/components/PullToRefresh';
import { base44 } from '@/api/base44Client';
import { Loader2, ArrowLeft, MapPin, User, DollarSign, Calendar, CheckSquare, FileDiff, FileText, Clock, BookOpen, ShieldCheck, FolderOpen, StickyNote, Lock, Receipt, Users, Info } from 'lucide-react';
import FileGrid from '../components/jobcomms/FileGrid';
import { format, parseISO } from 'date-fns';
import AppLayout from '../components/AppLayout';
import JobLifecycleBadge from '../components/jobs/JobLifecycleBadge';
import JobGroupBadge from '../components/jobs/JobGroupBadge';
import { getInternalRole, isAdmin as getIsAdmin } from '@/lib/adminAuth';
import JobRelatedRecords from '../components/jobs/JobRelatedRecords';
import { fetchJobRelatedRecords, calculateJobRollups } from '@/lib/recordLinking';
import JobInternalUsersTab from '../components/jobs/JobInternalUsersTab';
import JobDetailsExpandedTab from '../components/jobs/JobDetailsExpandedTab';
import ClientPortalManager from '../components/portal/ClientPortalManager';

const TABS = [
  { key: 'details',       label: 'Details',       icon: Info,         adminOnly: false },
  { key: 'team',          label: 'Team',          icon: Users,        adminOnly: true  },
  { key: 'clients',       label: 'Clients',       icon: User,         adminOnly: true  },
  { key: 'tasks',         label: 'Tasks',         icon: CheckSquare,  adminOnly: false },
  { key: 'logs',          label: 'Daily Logs',    icon: BookOpen,     adminOnly: false },
  { key: 'files',         label: 'Files',         icon: FolderOpen,   adminOnly: false },
  { key: 'change_orders', label: 'Change Orders', icon: FileDiff,     adminOnly: true  },
  { key: 'estimates',     label: 'Estimates',     icon: FileText,     adminOnly: true  },
  { key: 'invoices',      label: 'Invoices',      icon: FileText,     adminOnly: true  },
  { key: 'expenses',      label: 'Expenses',      icon: Receipt,      adminOnly: true  },
  { key: 'time',          label: 'Time',          icon: Clock,        adminOnly: true  },
  { key: 'warranty',      label: 'Warranty',      icon: ShieldCheck,  adminOnly: false },
  { key: 'notes',         label: 'Notes',         icon: StickyNote,   adminOnly: false },
];

export default function JobHub() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const isAdmin = getIsAdmin();
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('jobId');
  const [activeTab, setActiveTab] = useState('details');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.refetchQueries({ queryKey: ['job-hub', jobId] });
    await queryClient.refetchQueries({ queryKey: ['job-related-records', jobId] });
    setIsRefreshing(false);
  };

  const { data: job, isLoading } = useQuery({
    queryKey: ['job-hub', jobId],
    queryFn: async () => { const r = await base44.entities.Job.filter({ id: jobId }); return r[0]; },
    enabled: !!jobId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['hub-tasks', jobId],
    queryFn: () => base44.entities.Task.filter({ job_id: jobId }, '-created_date'),
    enabled: !!jobId && activeTab === 'tasks',
  });
  const { data: logs = [] } = useQuery({
    queryKey: ['hub-logs', jobId],
    queryFn: () => base44.entities.DailyLog.filter({ job_id: jobId }, '-log_date'),
    enabled: !!jobId && activeTab === 'logs',
  });
  const { data: files = [], isLoading: loadingFiles } = useQuery({
    queryKey: ['hub-files', jobId],
    queryFn: () => base44.entities.JobFile.filter({ job_id: jobId, archived: false }, '-created_date'),
    enabled: !!jobId && activeTab === 'files',
  });
  const { data: changeOrders = [] } = useQuery({
    queryKey: ['hub-cos', jobId],
    queryFn: () => base44.entities.ChangeOrder.filter({ job_id: jobId }, '-created_date'),
    enabled: !!jobId && activeTab === 'change_orders' && isAdmin,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['hub-invoices', jobId],
    queryFn: () => base44.entities.Invoice.filter({ job_id: jobId }, '-created_date'),
    enabled: !!jobId && activeTab === 'invoices' && isAdmin,
  });
  const { data: timeEntries = [] } = useQuery({
    queryKey: ['hub-time', jobId],
    queryFn: () => base44.entities.TimeEntry.filter({ job_id: jobId }, '-clock_in'),
    enabled: !!jobId && activeTab === 'time' && isAdmin,
  });
  const { data: estimates = [] } = useQuery({
    queryKey: ['hub-estimates', jobId],
    queryFn: () => base44.entities.Estimate.filter({ job_id: jobId }, '-created_date'),
    enabled: !!jobId && activeTab === 'estimates' && isAdmin,
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ['hub-expenses', jobId],
    queryFn: () => base44.entities.Expense.filter({ job_id: jobId }, '-created_date'),
    enabled: !!jobId && activeTab === 'expenses' && isAdmin,
  });
  const { data: warrantyItems = [] } = useQuery({
    queryKey: ['hub-warranty', jobId],
    queryFn: () => base44.entities.WarrantyItem.filter({ job_id: jobId }, '-created_date'),
    enabled: !!jobId && activeTab === 'warranty',
  });
  const { data: notes = [] } = useQuery({
    queryKey: ['hub-notes', jobId],
    queryFn: () => base44.entities.JobNote.filter({ job_id: jobId }, '-created_date'),
    enabled: !!jobId && activeTab === 'notes',
  });

  // Fetch all related records for the job
  const { data: relatedRecords, isLoading: isLoadingRelated } = useQuery({
    queryKey: ['job-related-records', jobId],
    queryFn: () => fetchJobRelatedRecords(jobId),
    enabled: !!jobId && activeTab === 'details' && isAdmin,
  });

  const jobRollups = relatedRecords ? calculateJobRollups(relatedRecords) : null;
  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  if (!jobId) return (
    <AppLayout title="Job Hub">
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No job selected. <button onClick={() => navigate('/search')} className="text-primary underline">Search for a job</button></p>
      </div>
    </AppLayout>
  );

  if (isLoading) return (
    <AppLayout title="Job Hub">
      <div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
    </AppLayout>
  );

  if (!job) return (
    <AppLayout title="Job Hub">
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Job not found.</p>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout title="Job Hub">
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        <div className="max-w-2xl mx-auto w-full px-4 py-4 space-y-4">

        {/* Back */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        {/* Job header */}
        <div className="bg-card border border-border rounded-2xl p-5" style={job.color ? { borderLeftColor: job.color, borderLeftWidth: 4 } : {}}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-foreground leading-snug">{job.address}</p>
              {job.title && <p className="text-xs text-muted-foreground">{job.title}</p>}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-xs text-muted-foreground">{job.customer_name}</p>
                {job.lifecycle_status && <JobLifecycleBadge status={job.lifecycle_status} />}
                {job.job_group && <JobGroupBadge group={job.job_group} />}
                {job.locked && <span className="flex items-center gap-0.5 text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full"><Lock className="w-3 h-3" />Locked</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-black text-primary">${Number(job.price || 0).toLocaleString()}</p>
              {job.start_date && <p className="text-xs text-muted-foreground mt-0.5">{job.start_date}</p>}
            </div>
          </div>
          {job.description && <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">{job.description}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={() => navigate(`/approve?jobId=${job.id}`)} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">View / Sign</button>
            {isAdmin && <button onClick={() => navigate(`/calendar`)} className="text-xs bg-muted text-foreground px-3 py-1.5 rounded-lg hover:bg-muted/80 transition-colors">Schedule</button>}
            {isAdmin && <button onClick={() => navigate(`/job-comms?jobId=${job.id}`)} className="text-xs bg-muted text-foreground px-3 py-1.5 rounded-lg hover:bg-muted/80 transition-colors">Files</button>}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
          {visibleTabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors ${activeTab === t.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="space-y-2">
          {activeTab === 'details' && (
            <div className="space-y-3">
              <JobDetailsExpandedTab job={job} isAdmin={isAdmin} />
              {isAdmin && jobRollups && (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Related Records Summary</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
                      <p className="text-blue-700 font-medium">{jobRollups.invoiceCount}</p>
                      <p className="text-muted-foreground">Active Invoices</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2 border border-amber-200">
                      <p className="text-amber-700 font-medium">${Number(jobRollups.invoiceTotal).toLocaleString()}</p>
                      <p className="text-muted-foreground">Invoice Total</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 border border-green-200">
                      <p className="text-green-700 font-medium">${Number(jobRollups.expenseTotal).toLocaleString()}</p>
                      <p className="text-muted-foreground">Total Expenses</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2 border border-purple-200">
                      <p className="text-purple-700 font-medium">{jobRollups.totalHours}h</p>
                      <p className="text-muted-foreground">Time Logged</p>
                    </div>
                  </div>
                </div>
              )}
              {isAdmin && <JobRelatedRecords related={relatedRecords} isLoading={isLoadingRelated} />}
            </div>
          )}
          {activeTab === 'team' && isAdmin && (
            <JobInternalUsersTab jobId={job.id} jobAddress={job.address} isAdmin={isAdmin} />
          )}
          {activeTab === 'clients' && isAdmin && (
            <ClientPortalManager job={job} />
          )}
          {activeTab === 'tasks' && <SimpleList items={tasks} emptyMsg="No tasks linked to this job." renderItem={t => (
            <div key={t.id} onClick={() => navigate(`/tasks/${t.id}`)} className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/30">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-foreground">{t.title}</p><span className={`text-xs px-1.5 py-0.5 rounded-full ${t.status==='completed'?'bg-green-100 text-green-700':'bg-muted text-muted-foreground'}`}>{t.status}</span></div>
              {t.due_date && <p className="text-xs text-muted-foreground mt-0.5">Due: {t.due_date}</p>}
            </div>
          )} />}
          {activeTab === 'logs' && <SimpleList items={logs} emptyMsg="No daily logs for this job." renderItem={l => (
            <div key={l.id} onClick={() => navigate(`/daily-logs/${l.id}`)} className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/30">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-foreground">{l.log_date}</p>{l.follow_up_needed && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Follow-up</span>}</div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{l.work_completed}</p>
            </div>
          )} />}
          {activeTab === 'files' && (
            loadingFiles
              ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              : <FileGrid files={files} jobAddress={job.address} />
          )}
          {activeTab === 'estimates' && isAdmin && <SimpleList items={estimates} emptyMsg="No estimates for this job." renderItem={est => (
            <div key={est.id} onClick={() => navigate(`/estimates/${est.id}`)} className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/30">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{est.estimate_number ? `#${est.estimate_number}` : 'Estimate'}</p>
                <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{est.status}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">${Number(est.total_amount || est.amount || 0).toLocaleString()} · {est.created_date ? format(new Date(est.created_date), 'MMM d, yyyy') : ''}</p>
            </div>
          )} />}
          {activeTab === 'expenses' && isAdmin && <SimpleList items={expenses} emptyMsg="No expenses linked to this job." renderItem={exp => (
            <div key={exp.id} onClick={() => navigate('/expenses')} className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/30">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{exp.vendor_name || 'Expense'}</p>
                <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{exp.inbox_status}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">${Number(exp.total_amount || 0).toFixed(2)} · {exp.expense_date || exp.receipt_date || ''} {exp.category ? `· ${exp.category}` : ''}</p>
            </div>
          )} />}
          {activeTab === 'change_orders' && isAdmin && <SimpleList items={changeOrders} emptyMsg="No change orders for this job." renderItem={co => (
            <div key={co.id} onClick={() => navigate(`/change-orders/${co.id}`)} className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/30">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-foreground">{co.title}</p><span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{co.status}</span></div>
              {co.total_financial_impact !== 0 && <p className={`text-xs font-semibold mt-0.5 ${co.total_financial_impact > 0 ? 'text-primary' : 'text-red-600'}`}>{co.total_financial_impact > 0 ? '+' : ''}${Number(co.total_financial_impact || 0).toLocaleString()}</p>}
            </div>
          )} />}
          {activeTab === 'invoices' && isAdmin && <SimpleList items={invoices} emptyMsg="No invoices for this job." renderItem={inv => (
            <div key={inv.id} onClick={() => navigate('/invoices')} className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/30">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-foreground">{inv.customer_name}</p><span className={`text-xs px-1.5 py-0.5 rounded-full ${inv.status==='overdue'?'bg-red-100 text-red-700':'bg-muted text-muted-foreground'}`}>{inv.status}</span></div>
              <p className="text-xs text-muted-foreground mt-0.5">${Number(inv.balance_due || inv.amount || 0).toLocaleString()} due</p>
            </div>
          )} />}
          {activeTab === 'time' && isAdmin && <SimpleList items={timeEntries} emptyMsg="No time entries for this job." renderItem={e => (
            <div key={e.id} onClick={() => navigate(`/time-entries/${e.id}`)} className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/30">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-foreground">{e.employee_name}</p><span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{e.duration_minutes ? `${Math.floor(e.duration_minutes/60)}h ${e.duration_minutes%60}m` : 'Active'}</span></div>
              <p className="text-xs text-muted-foreground">{e.cost_code} · {e.clock_in ? format(parseISO(e.clock_in), 'MMM d, h:mm a') : '—'}</p>
            </div>
          )} />}
          {activeTab === 'warranty' && <SimpleList items={warrantyItems} emptyMsg="No warranty items for this job." renderItem={w => (
            <div key={w.id} onClick={() => navigate(`/warranty/${w.id}`)} className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/30">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-foreground">{w.title}</p><span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">{w.status}</span></div>
              <p className="text-xs text-muted-foreground mt-0.5">{w.category}</p>
            </div>
          )} />}
          {activeTab === 'notes' && <SimpleList items={notes} emptyMsg="No notes for this job." renderItem={n => (
            <div key={n.id} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-2 mb-0.5">{!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}<p className="text-xs text-muted-foreground">{n.author_role} · {n.created_date ? format(new Date(n.created_date), 'MMM d, h:mm a') : ''}</p></div>
              <p className="text-sm text-foreground">{n.content}</p>
            </div>
          )} />}
        </div>
      </div>
    </PullToRefresh>
    </AppLayout>
  );
}

function OverviewTab({ job, isAdmin }) {
  const rows = [
    { icon: User, label: 'Customer', value: job.customer_name },
    { icon: MapPin, label: 'Address', value: job.address },
    { icon: DollarSign, label: 'Price', value: `$${Number(job.price || 0).toLocaleString()}`, adminOnly: true },
    { icon: Calendar, label: 'Start Date', value: job.start_date },
    { icon: Calendar, label: 'End Date', value: job.end_date },
    { icon: User, label: 'Assigned To', value: job.assigned_to },
  ].filter(r => !r.adminOnly || isAdmin).filter(r => r.value);

  return (
    <div className="space-y-2">
      <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3">
            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-sm font-medium text-foreground text-right">{value}</span>
            </div>
          </div>
        ))}
      </div>
      {isAdmin && job.internal_notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs font-medium text-amber-700 mb-1">Internal Notes</p>
          <p className="text-sm text-amber-800">{job.internal_notes}</p>
        </div>
      )}
      {job.email && <p className="text-xs text-muted-foreground px-1">✉ {job.email} {job.phone ? `· ${job.phone}` : ''}</p>}
    </div>
  );
}

function SimpleList({ items, emptyMsg, renderItem }) {
  if (!items.length) return <p className="text-sm text-muted-foreground text-center py-8">{emptyMsg}</p>;
  return <div className="space-y-2">{items.map(renderItem)}</div>;
}