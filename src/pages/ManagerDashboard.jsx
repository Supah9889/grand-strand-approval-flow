import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Briefcase, Clock, Brain, ChevronRight, Loader2, Users, Shield
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { format } from 'date-fns';
import { isAdmin } from '@/lib/adminAuth';
import { getCurrentCompany } from '@/lib/permissions';

const todayISO = new Date().toISOString().split('T')[0];

function getActiveCompany() {
  return getCurrentCompany();
}

const OP_STATUS_LABELS = {
  new: 'New', needs_review: 'Needs Review', needs_scheduling: 'Needs Scheduling',
  scheduled: 'Scheduled', in_progress: 'In Progress', on_hold: 'On Hold',
  waiting_homeowner: 'Waiting HO', waiting_builder: 'Waiting Builder',
  waiting_vendor: 'Waiting Vendor', waiting_materials: 'Waiting Materials',
  complete: 'Complete', invoiced: 'Invoiced', paid: 'Paid', closed: 'Closed',
};

function MetricCard({ label, value, icon: Icon, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 text-left hover:bg-muted/30 transition-colors"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </button>
  );
}

function SectionHeader({ title, count, onViewAll }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {count > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{count}</span>
        )}
      </div>
      {onViewAll && (
        <button onClick={onViewAll} className="text-xs text-primary hover:underline">View all</button>
      )}
    </div>
  );
}

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const company = getActiveCompany();

  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['mgr-jobs', company?.id],
    queryFn: () => company
      ? base44.entities.Job.filter({ company_id: company.id }, '-created_date', 200)
      : Promise.resolve([]),
    enabled: !!company?.id,
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ['mgr-work-orders', company?.id],
    queryFn: () => company
      ? base44.entities.WorkOrder.filter({ company_id: company.id }, '-created_date', 100)
      : Promise.resolve([]),
    enabled: !!company?.id,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['mgr-time-entries', company?.id],
    queryFn: () => company
      ? base44.entities.TimeEntry.filter({ company_id: company.id, status: 'clocked_in' })
      : Promise.resolve([]),
    enabled: !!company?.id,
  });

  const { data: pendingEntries = [] } = useQuery({
    queryKey: ['mgr-pending-time', company?.id],
    queryFn: () => company
      ? base44.entities.TimeEntry.filter({ company_id: company.id, approval_status: 'pending', status: 'clocked_out' }, '-entry_date', 100)
      : Promise.resolve([]),
    enabled: !!company?.id,
  });

  const { data: nexusItems = [] } = useQuery({
    queryKey: ['mgr-nexus', company?.id],
    queryFn: () => company
      ? base44.entities.NexusItem.filter({ company_id: company.id, status: 'pending_review' })
      : Promise.resolve([]),
    enabled: !!company?.id,
  });

  const { data: scheduleEvents = [] } = useQuery({
    queryKey: ['mgr-schedule', company?.id, todayISO],
    queryFn: async () => {
      const all = company
        ? await base44.entities.ScheduleEvent.filter({ company_id: company.id }, 'start_datetime', 50)
        : [];
      return all.filter(e => {
        const d = e.start_datetime?.split('T')[0];
        return d >= todayISO && e.status !== 'cancelled';
      });
    },
    enabled: !!company?.id,
  });

  const activeJobs = useMemo(() => jobs.filter(j => ['in_progress', 'scheduled', 'needs_scheduling', 'new'].includes(j.op_status)), [jobs]);
  const unassignedWOs = useMemo(() => workOrders.filter(w => w.status === 'draft' || !w.assigned_employee_ids || w.assigned_employee_ids === '[]'), [workOrders]);

  if (!isAdmin()) {
    return (
      <AppLayout title="Manager Dashboard">
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="text-center">
            <Shield className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-semibold">Operations access required</p>
            <p className="text-xs text-muted-foreground mt-1">Contact an admin to request access.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loadingJobs) return (
    <AppLayout title="Manager Dashboard">
      <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
    </AppLayout>
  );

  return (
    <AppLayout title="Manager Dashboard">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-5 pb-24">

        {/* Company + date header */}
        <div>
          <h1 className="text-base font-semibold">{format(new Date(), 'EEEE, MMMM d')}</h1>
          {company && <p className="text-xs text-muted-foreground">{company.name}</p>}
        </div>

        {/* Metric grid */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Active Jobs" value={activeJobs.length} icon={Briefcase} color="bg-blue-100 text-blue-600" onClick={() => navigate('/search')} />
          <MetricCard label="Clocked In Now" value={timeEntries.length} icon={Users} color="bg-emerald-100 text-emerald-600" onClick={() => navigate('/time-entries')} />
          <MetricCard label="Pending Approvals" value={pendingEntries.length} icon={Clock} color="bg-amber-100 text-amber-600" onClick={() => navigate('/time-entries')} />
          <MetricCard label="Nexus Pending" value={nexusItems.length} icon={Brain} color="bg-purple-100 text-purple-600" onClick={() => navigate('/nexus')} />
        </div>

        {/* Clocked-In Employees */}
        <section>
          <SectionHeader title="Clocked In Now" count={timeEntries.length} onViewAll={() => navigate('/time-entries')} />
          {timeEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">No employees clocked in</p>
          ) : (
            <div className="space-y-2">
              {timeEntries.slice(0, 6).map(e => (
                <div key={e.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{e.employee_name}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{e.job_address}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{e.clock_in ? format(new Date(e.clock_in), 'h:mm a') : ''}</p>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">Live</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Unassigned Work Orders */}
        <section>
          <SectionHeader title="Unassigned Work Orders" count={unassignedWOs.length} onViewAll={() => navigate('/work-orders')} />
          {unassignedWOs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">All work orders are assigned</p>
          ) : (
            <div className="space-y-2">
              {unassignedWOs.slice(0, 5).map(wo => (
                <div key={wo.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{wo.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{wo.job_address}</p>
                  </div>
                  <button onClick={() => navigate(`/work-orders/${wo.id}`)} className="text-primary">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pending Time Entry Approvals */}
        <section>
          <SectionHeader title="Pending Time Approvals" count={pendingEntries.length} onViewAll={() => navigate('/time-entries')} />
          {pendingEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">No pending approvals</p>
          ) : (
            <div className="space-y-2">
              {pendingEntries.slice(0, 5).map(e => (
                <div key={e.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{e.employee_name}</p>
                    <p className="text-xs text-muted-foreground">{e.entry_date} · {e.total_hours?.toFixed(1) || '?'}h</p>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Pending</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Nexus Pending */}
        <section>
          <SectionHeader title="Nexus Inbox — Pending Review" count={nexusItems.length} onViewAll={() => navigate('/nexus')} />
          {nexusItems.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">No pending Nexus items</p>
          ) : (
            <div className="space-y-2">
              {nexusItems.slice(0, 5).map(n => (
                <div key={n.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.summary}</p>
                  </div>
                  <button onClick={() => navigate('/nexus')} className="text-primary shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming Schedule Events */}
        <section>
          <SectionHeader title="Upcoming Events" count={scheduleEvents.length} onViewAll={() => navigate('/calendar')} />
          {scheduleEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">No upcoming events</p>
          ) : (
            <div className="space-y-2">
              {scheduleEvents.slice(0, 5).map(ev => (
                <div key={ev.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">{ev.event_type?.replace('_', ' ')}</p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {ev.start_datetime ? format(new Date(ev.start_datetime), 'MMM d, h:mm a') : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </AppLayout>
  );
}
