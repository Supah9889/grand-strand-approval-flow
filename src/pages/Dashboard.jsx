import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Loader2, Calendar, AlertCircle, Activity, DollarSign,
  ArrowRight, Building2, ChevronDown, ChevronUp
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { isAdmin as getIsAdmin } from '@/lib/adminAuth';
import DashQuickSearch from '../components/dashboard/DashQuickSearch';
import DashTodaySchedule from '../components/dashboard/DashTodaySchedule';
import DashRecentActivity from '../components/dashboard/DashRecentActivity';
import DashNeedsAttention from '../components/dashboard/DashNeedsAttention';
import DashFinancialFollowUp from '../components/dashboard/DashFinancialFollowUp';

// Company/context filter options mapped to job_group values
const COMPANY_FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'painting', label: 'Grand Strand' },
  { key: 'carpentry', label: 'Dest. Home' },
  { key: 'internal', label: 'Internal' },
];

function matchesCompany(item, filter) {
  if (filter === 'all') return true;
  if (filter === 'painting')  return ['painting','residential','commercial','insurance','estimate_only'].includes(item.job_group);
  if (filter === 'carpentry') return ['carpentry','drywall','water_mitigation','builder_vendor','warranty'].includes(item.job_group);
  if (filter === 'internal')  return item.job_group === 'internal';
  return true;
}

const todayISO = new Date().toISOString().split('T')[0];
const todayStart = startOfDay(new Date());
const todayEnd   = endOfDay(new Date());

function isToday(dateStr) {
  if (!dateStr) return false;
  try {
    const dayStr = dateStr.length > 10 ? dateStr.split('T')[0] : dateStr;
    const d = parseISO(dayStr);
    return d >= todayStart && d <= todayEnd;
  } catch {
    return dateStr.startsWith(todayISO);
  }
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// Collapsible section card used for each dashboard section
function SectionCard({ title, icon: Icon, count, urgent, children, defaultOpen = true, onViewAll, viewAllLabel }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-2xl overflow-hidden border ${urgent ? 'border-red-200' : 'border-border'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/30
          ${urgent ? 'bg-red-50/50' : 'bg-card'}`}
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${urgent ? 'text-red-500' : 'text-muted-foreground'}`} />
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {count != null && count > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center
              ${urgent ? 'bg-red-500 text-white' : 'bg-primary/10 text-primary'}`}>
              {count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onViewAll && open && (
            <button
              onClick={e => { e.stopPropagation(); onViewAll(); }}
              className="text-[10px] text-primary hover:underline"
            >
              {viewAllLabel || 'View all'}
            </button>
          )}
          {open
            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          }
        </div>
      </button>
      {open && (
        <div className="bg-card px-4 py-3 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const isAdmin = getIsAdmin();
  const [companyFilter, setCompanyFilter] = useState('all');

  // ── Data loading ──────────────────────────────────────────────────────────
  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['dashboard-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 300),
  });
  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['dashboard-calendar'],
    queryFn: () => base44.entities.CalendarEvent.list('-start_date', 200),
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
  const { data: invoices = [] } = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 200),
    enabled: isAdmin,
  });
  const { data: bills = [] } = useQuery({
    queryKey: ['dashboard-bills'],
    queryFn: () => base44.entities.Bill.list('-created_date', 100),
    enabled: isAdmin,
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ['dashboard-expenses'],
    queryFn: () => base44.entities.Expense.list('-created_date', 100),
    enabled: isAdmin,
  });
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['dashboard-audit'],
    queryFn: () => base44.entities.AuditLog.list('-timestamp', 30),
    enabled: isAdmin,
  });
  const { data: notes = [] } = useQuery({
    queryKey: ['dashboard-notes'],
    queryFn: () => base44.entities.JobNote.list('-created_date', 50),
  });
  const { data: dailyLogs = [] } = useQuery({
    queryKey: ['dashboard-logs'],
    queryFn: () => base44.entities.DailyLog.list('-log_date', 50),
    enabled: isAdmin,
  });
  const { data: changeOrders = [] } = useQuery({
    queryKey: ['dashboard-cos'],
    queryFn: () => base44.entities.ChangeOrder.list('-created_date', 100),
    enabled: isAdmin,
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ['dashboard-vendors'],
    queryFn: () => base44.entities.Vendor.list('company_name', 100),
    enabled: isAdmin,
  });

  // ── Company-filtered job subset ───────────────────────────────────────────
  const filteredJobs = useMemo(
    () => jobs.filter(j => matchesCompany(j, companyFilter)),
    [jobs, companyFilter]
  );

  // ── Today's schedule ──────────────────────────────────────────────────────
  const todayEvents = useMemo(() => {
    return calendarEvents
      .filter(ev => ev.start_date && isToday(ev.start_date) && ev.status !== 'canceled')
      .filter(ev => {
        if (companyFilter === 'all') return true;
        const job = jobs.find(j => j.id === ev.job_id);
        return !job || matchesCompany(job, companyFilter);
      })
      .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
  }, [calendarEvents, jobs, companyFilter]);

  // ── Attention / urgency counts ────────────────────────────────────────────
  const pendingSigs  = useMemo(() => filteredJobs.filter(j => j.status === 'pending'), [filteredJobs]);
  const overdueInvs  = useMemo(() => invoices.filter(i => i.status === 'overdue'), [invoices]);
  const waitingJobs  = useMemo(() => filteredJobs.filter(j => j.lifecycle_status === 'waiting'), [filteredJobs]);
  const attentionCount = pendingSigs.length + overdueInvs.length + waitingJobs.length;

  // ── Financial count badge ─────────────────────────────────────────────────
  const finCount = useMemo(() => {
    const od = invoices.filter(i => i.status === 'overdue').length;
    const ub = bills.filter(b => ['open','draft'].includes(b.status)).length;
    const ne = expenses.filter(e => e.inbox_status === 'new').length;
    return od + ub + ne;
  }, [invoices, bills, expenses]);

  return (
    <AppLayout title="Dashboard">
      <div className="max-w-2xl mx-auto w-full px-4 py-5 space-y-4">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-foreground">Good {timeOfDay()}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(), 'EEEE, MMMM d')}</p>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="flex items-center gap-1.5 h-8 px-3 bg-primary text-primary-foreground text-xs font-medium rounded-xl hover:bg-primary/90 transition-colors shrink-0"
          >
            <ArrowRight className="w-3.5 h-3.5" /> Sign Job
          </button>
        </div>

        {/* ── Quick Search ────────────────────────────────────────────── */}
        <DashQuickSearch
          jobs={jobs}
          invoices={invoices}
          expenses={expenses}
          notes={notes}
          vendors={vendors}
        />

        {/* ── Company / Context Filter ────────────────────────────────── */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {COMPANY_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setCompanyFilter(f.key)}
              className={`shrink-0 flex items-center gap-1 h-7 px-3 rounded-full text-xs font-medium transition-colors
                ${companyFilter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              <Building2 className="w-3 h-3" />
              {f.label}
            </button>
          ))}
        </div>

        {loadingJobs ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ── 1. Today's Schedule ─────────────────────────────────── */}
            <SectionCard
              title="Today's Schedule"
              icon={Calendar}
              count={todayEvents.length}
              defaultOpen={true}
              onViewAll={() => navigate('/calendar')}
              viewAllLabel="Calendar"
            >
              <DashTodaySchedule events={todayEvents} jobs={jobs} />
            </SectionCard>

            {/* ── 2. Needs Attention ──────────────────────────────────── */}
            <SectionCard
              title="Needs Attention"
              icon={AlertCircle}
              count={attentionCount}
              urgent={attentionCount > 0}
              defaultOpen={true}
              onViewAll={() => navigate('/search')}
              viewAllLabel="All jobs"
            >
              <DashNeedsAttention
                jobs={filteredJobs}
                invoices={invoices}
                tasks={tasks}
                leads={leads}
                bills={bills}
              />
            </SectionCard>

            {/* ── 3. Financial Follow-Up (admin only) ─────────────────── */}
            {isAdmin && (
              <SectionCard
                title="Financial Follow-Up"
                icon={DollarSign}
                count={finCount}
                urgent={overdueInvs.length > 0}
                defaultOpen={finCount > 0}
                onViewAll={() => navigate('/financials')}
                viewAllLabel="Financials"
              >
                <DashFinancialFollowUp
                  invoices={invoices}
                  bills={bills}
                  expenses={expenses}
                />
              </SectionCard>
            )}

            {/* ── 4. Recent Activity (admin only) ─────────────────────── */}
            {isAdmin && (
              <SectionCard
                title="Recent Activity"
                icon={Activity}
                defaultOpen={false}
                onViewAll={() => navigate('/audit-log')}
                viewAllLabel="Full log"
              >
                <DashRecentActivity
                  auditLogs={auditLogs}
                  notes={notes}
                  dailyLogs={dailyLogs}
                  changeOrders={changeOrders}
                />
              </SectionCard>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}