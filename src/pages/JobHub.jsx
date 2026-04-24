import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Loader2, Activity, Calendar, DollarSign, FolderOpen, Clock,
  ShieldCheck, Info, Users, User, CheckSquare, BookOpen, StickyNote, FileDiff
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import PullToRefresh from '@/components/PullToRefresh';
import { isAdmin as getIsAdmin } from '@/lib/adminAuth';

// New focused sub-components
import JobHubHeader from '../components/jobhub/JobHubHeader';
import JobSummaryPanel from '../components/jobhub/JobSummaryPanel';
import JobContactsPanel from '../components/jobhub/JobContactsPanel';
import JobScheduleTab from '../components/jobhub/JobScheduleTab';
import JobTimelineTab from '../components/jobhub/JobTimelineTab';
import JobFinancialsTab from '../components/jobhub/JobFinancialsTab';
import JobFilesTab from '../components/jobhub/JobFilesTab';
import JobTimeTab from '../components/jobhub/JobTimeTab';
import JobSignatureTab from '../components/jobhub/JobSignatureTab';
import JobAddNoteSheet from '../components/jobhub/JobAddNoteSheet';

// Existing reusable sub-components still used
import JobDetailsExpandedTab from '../components/jobs/JobDetailsExpandedTab';
import JobInternalUsersTab from '../components/jobs/JobInternalUsersTab';
import ClientPortalManager from '../components/portal/ClientPortalManager';

// Tab definitions — ordered for operational flow
const TABS = [
  { key: 'timeline',  label: 'Timeline',  icon: Activity,    adminOnly: false },
  { key: 'schedule',  label: 'Schedule',  icon: Calendar,    adminOnly: false },
  { key: 'details',   label: 'Details',   icon: Info,        adminOnly: false },
  { key: 'financials',label: 'Financials',icon: DollarSign,  adminOnly: true  },
  { key: 'files',     label: 'Files',     icon: FolderOpen,  adminOnly: false },
  { key: 'time',      label: 'Time',      icon: Clock,       adminOnly: true  },
  { key: 'team',      label: 'Team',      icon: Users,       adminOnly: true  },
  { key: 'clients',   label: 'Clients',   icon: User,        adminOnly: true  },
  { key: 'tasks',     label: 'Tasks',     icon: CheckSquare, adminOnly: false },
  { key: 'logs',      label: 'Daily Logs',icon: BookOpen,    adminOnly: false },
  { key: 'signature', label: 'Signature', icon: ShieldCheck, adminOnly: false },
  { key: 'notes',     label: 'Notes',     icon: StickyNote,  adminOnly: false },
  { key: 'cos',       label: 'Change Orders', icon: FileDiff, adminOnly: true },
];

function SimpleList({ items, emptyMsg, renderItem }) {
  if (!items.length) return <p className="text-sm text-muted-foreground text-center py-10">{emptyMsg}</p>;
  return <div className="space-y-2">{items.map(renderItem)}</div>;
}

export default function JobHub() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = getIsAdmin();
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('jobId');

  const [activeTab, setActiveTab] = useState('timeline');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [scheduleDefaultAdd, setScheduleDefaultAdd] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.refetchQueries({ queryKey: ['job-hub', jobId] });
    await queryClient.refetchQueries({ queryKey: ['hub-tl-notes', jobId] });
    await queryClient.refetchQueries({ queryKey: ['hub-schedule', jobId] });
    await queryClient.refetchQueries({ queryKey: ['hub-contacts', jobId] });
    await queryClient.refetchQueries({ queryKey: ['hub-sig-records', jobId] });
    setIsRefreshing(false);
  };

  const { data: job, isLoading } = useQuery({
    queryKey: ['job-hub', jobId],
    queryFn: async () => { const r = await base44.entities.Job.filter({ id: jobId }); return r[0]; },
    enabled: !!jobId,
  });

  // Assignments — needed for contacts panel (loaded upfront, small payload)
  const { data: assignments = [] } = useQuery({
    queryKey: ['hub-assignments', jobId],
    queryFn: () => base44.entities.JobAssignment.filter({ job_id: jobId }),
    enabled: !!jobId,
  });

  // Per-tab lazy queries
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
  const { data: notes = [] } = useQuery({
    queryKey: ['hub-notes', jobId],
    queryFn: () => base44.entities.JobNote.filter({ job_id: jobId }, '-created_date'),
    enabled: !!jobId && activeTab === 'notes',
  });
  const { data: changeOrders = [] } = useQuery({
    queryKey: ['hub-cos', jobId],
    queryFn: () => base44.entities.ChangeOrder.filter({ job_id: jobId }, '-created_date'),
    enabled: !!jobId && activeTab === 'cos' && isAdmin,
  });

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  // ── Guard states ─────────────────────────────────────────────────────────
  if (!jobId) return (
    <AppLayout title="Job">
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-3">No job selected.</p>
          <button onClick={() => navigate('/search')} className="text-xs text-primary underline">Search for a job</button>
        </div>
      </div>
    </AppLayout>
  );

  if (isLoading) return (
    <AppLayout title="Job">
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    </AppLayout>
  );

  if (!job) return (
    <AppLayout title="Job">
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Job not found.</p>
      </div>
    </AppLayout>
  );

  // ── Handlers for quick actions in header ─────────────────────────────────
  const handleAddNote = () => setShowAddNote(true);
  const handleAddSchedule = () => {
    setActiveTab('schedule');
    setScheduleDefaultAdd(true);
    setTimeout(() => setScheduleDefaultAdd(false), 500);
  };
  const handleUploadFile = () => setActiveTab('files');

  return (
    <AppLayout title={job.address?.split(',')[0] || 'Job'}>
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        <div className="max-w-2xl mx-auto w-full px-4 py-4 space-y-3">

          {/* ── Header: address, status, quick actions ───────────────── */}
          <JobHubHeader
            job={job}
            isAdmin={isAdmin}
            onAddNote={handleAddNote}
            onAddSchedule={handleAddSchedule}
            onUploadFile={handleUploadFile}
          />

          {/* ── Summary: editable plain-language field ───────────────── */}
          <JobSummaryPanel job={job} isAdmin={isAdmin} />

          {/* ── Contacts: customer + team members ────────────────────── */}
          <JobContactsPanel job={job} assignments={assignments} isAdmin={isAdmin} />

          {/* ── Tab bar ──────────────────────────────────────────────── */}
          <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
            {visibleTabs.map(t => {
              const Icon = t.icon;
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium shrink-0 transition-all
                    ${isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* ── Tab content ──────────────────────────────────────────── */}
          <div className="pb-6">

            {activeTab === 'timeline' && (
              <JobTimelineTab job={job} isAdmin={isAdmin} />
            )}

            {activeTab === 'schedule' && (
              <JobScheduleTab
                job={job}
                isAdmin={isAdmin}
                defaultShowAdd={scheduleDefaultAdd}
              />
            )}

            {activeTab === 'details' && (
              <JobDetailsExpandedTab job={job} isAdmin={isAdmin} />
            )}

            {activeTab === 'financials' && isAdmin && (
              <JobFinancialsTab job={job} isAdmin={isAdmin} />
            )}

            {activeTab === 'files' && (
              <JobFilesTab job={job} isAdmin={isAdmin} />
            )}

            {activeTab === 'time' && isAdmin && (
              <JobTimeTab job={job} />
            )}

            {activeTab === 'team' && isAdmin && (
              <JobInternalUsersTab jobId={job.id} jobAddress={job.address} isAdmin={isAdmin} />
            )}

            {activeTab === 'clients' && isAdmin && (
              <ClientPortalManager job={job} />
            )}

            {activeTab === 'tasks' && (
              <SimpleList items={tasks} emptyMsg="No tasks linked to this job." renderItem={t => (
                <div key={t.id} onClick={() => navigate(`/tasks/${t.id}`)}
                  className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{t.title}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${t.status === 'completed' ? 'bg-green-100 text-green-700' : t.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}>
                      {t.status}
                    </span>
                  </div>
                  {t.due_date && <p className="text-xs text-muted-foreground mt-0.5">Due: {t.due_date}</p>}
                  {t.assigned_to && <p className="text-xs text-muted-foreground mt-0.5">{t.assigned_to}</p>}
                </div>
              )} />
            )}

            {activeTab === 'logs' && (
              <SimpleList items={logs} emptyMsg="No daily logs for this job." renderItem={l => (
                <div key={l.id} onClick={() => navigate(`/daily-logs/${l.id}`)}
                  className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{l.log_date}</p>
                    {l.follow_up_needed && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Follow-up</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{l.work_completed}</p>
                  {l.created_by_name && <p className="text-xs text-muted-foreground/60 mt-0.5">{l.created_by_name}</p>}
                </div>
              )} />
            )}

            {activeTab === 'notes' && (
              <div className="space-y-2">
                {isAdmin && (
                  <button
                    onClick={handleAddNote}
                    className="w-full flex items-center justify-center gap-1.5 h-10 border border-dashed border-primary/30 text-primary text-sm rounded-xl hover:border-primary/60 hover:bg-primary/5 transition-colors"
                  >
                    <StickyNote className="w-4 h-4" /> Add Note
                  </button>
                )}
                <SimpleList items={notes} emptyMsg="No notes for this job." renderItem={n => (
                  <div key={n.id} className="bg-card border border-border rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                      <p className="text-xs text-muted-foreground">{n.author_role} · {n.created_date ? new Date(n.created_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</p>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{n.content}</p>
                  </div>
                )} />
              </div>
            )}

            {activeTab === 'signature' && (
              <JobSignatureTab job={job} isAdmin={isAdmin} />
            )}

            {activeTab === 'cos' && isAdmin && (
              <SimpleList items={changeOrders} emptyMsg="No change orders for this job." renderItem={co => (
                <div key={co.id} onClick={() => navigate(`/change-orders/${co.id}`)}
                  className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{co.title}</p>
                    <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{co.status}</span>
                  </div>
                  {co.total_financial_impact !== 0 && (
                    <p className={`text-xs font-semibold mt-0.5 ${co.total_financial_impact > 0 ? 'text-primary' : 'text-red-600'}`}>
                      {co.total_financial_impact > 0 ? '+' : ''}${Number(co.total_financial_impact || 0).toLocaleString()}
                    </p>
                  )}
                </div>
              )} />
            )}
          </div>
        </div>
      </PullToRefresh>

      {/* Add Note sheet overlay */}
      {showAddNote && (
        <JobAddNoteSheet
          job={job}
          onClose={() => setShowAddNote(false)}
          onSuccess={() => {
            if (activeTab !== 'notes' && activeTab !== 'timeline') {
              setActiveTab('timeline');
            }
          }}
        />
      )}
    </AppLayout>
  );
}