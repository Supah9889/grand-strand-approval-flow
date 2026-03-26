import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import PullToRefresh from '@/components/PullToRefresh';
import { Loader2, Clock, Search, User, MapPin, Plus, X, AlertTriangle } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval, isToday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { getInternalRole, isAdmin as getIsAdmin } from '@/lib/adminAuth';
import AdminManualEntryForm from '../components/timeclock/AdminManualEntryForm';
import { toast } from 'sonner';

const COST_CODES = ['Carpentry Labor/Sub','Drywall Labor/Sub','Other Labor/Sub','Paint Expenses','Painting Labor/Sub'];

export function formatDuration(mins) {
  if (!mins && mins !== 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TimeEntries() {
  const navigate = useNavigate();
  const role = getInternalRole();
  const isAdmin = getIsAdmin(); // true for admin + owner

  const [search, setSearch] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterCode, setFilterCode] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterApproval, setFilterApproval] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [sort, setSort] = useState('newest');
  const [showManual, setShowManual] = useState(false);
  const [empCodeFilter, setEmpCodeFilter] = useState('');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['time-entries'],
    queryFn: () => base44.entities.TimeEntry.list('-clock_in', 500),
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 200),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('name'),
    enabled: isAdmin, // now correctly includes owner
  });

  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.refetchQueries({ queryKey: ['time-entries'] });
    setIsRefreshing(false);
  };

  const approveMutation = useOptimisticMutation({
    mutationFn: (id) => base44.entities.TimeEntry.update(id, { approval_status: 'approved', approved_by: role }),
    queryKey: ['time-entries'],
    optimisticUpdate: (prev, id) =>
      prev.map(e => e.id === id ? { ...e, approval_status: 'approved', approved_by: role } : e),
    onSuccess: () => toast.success('Entry approved'),
    onError: () => toast.error('Failed to approve entry'),
  });

  const createEntry = useOptimisticMutation({
    mutationFn: d => base44.entities.TimeEntry.create(d),
    queryKey: ['time-entries'],
    optimisticUpdate: (prev, d) => [
      { ...d, id: `temp-${Date.now()}`, created_date: new Date().toISOString() },
      ...prev,
    ],
    onSuccess: () => { setShowManual(false); toast.success('Entry created'); },
    onError: () => toast.error('Failed to create entry'),
  });

  // Employee self-service: prompt for code
  const [selfCode, setSelfCode] = useState('');
  const [selfEmployee, setSelfEmployee] = useState(null);
  const [codeError, setCodeError] = useState('');

  const lookupSelf = async () => {
    if (!selfCode) return;
    setCodeError('');
    const res = await base44.entities.Employee.filter({ employee_code: selfCode.toUpperCase() });
    if (!res.length) { setCodeError('Employee code not found.'); return; }
    setSelfEmployee(res[0]);
  };

  const todayStr = new Date().toDateString();
  const todayEntries = entries.filter(e => e.clock_in && new Date(e.clock_in).toDateString() === todayStr);
  const clockedInNow = todayEntries.filter(e => e.status === 'clocked_in').length;
  const todayMinutes = todayEntries.filter(e => e.status === 'clocked_out').reduce((s, e) => s + (e.duration_minutes || 0), 0);

  // Employee self-view
  const selfEntries = useMemo(() => {
    if (!selfEmployee) return [];
    return entries
      .filter(e => e.employee_code === selfEmployee.employee_code || e.employee_id === selfEmployee.id)
      .sort((a, b) => (b.clock_in || '').localeCompare(a.clock_in || ''));
  }, [entries, selfEmployee]);

  const selfTodayMins = selfEntries.filter(e => e.clock_in && new Date(e.clock_in).toDateString() === todayStr && e.status !== 'clocked_in').reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const selfWeekMins = selfEntries.filter(e => {
    if (!e.clock_in || e.status === 'clocked_in') return false;
    const d = parseISO(e.clock_in);
    return isWithinInterval(d, { start: weekStart, end: weekEnd });
  }).reduce((s, e) => s + (e.duration_minutes || 0), 0);

  // Admin filtered list
  const uniqueEmployees = [...new Set(entries.map(e => e.employee_name).filter(Boolean))].sort();

  const filtered = useMemo(() => {
    let l = entries;
    if (!isAdmin) {
      if (!selfEmployee) return [];
      l = selfEntries;
    }
    if (isAdmin) {
      if (filterEmployee !== 'all') l = l.filter(e => e.employee_name === filterEmployee);
      if (filterCode !== 'all') l = l.filter(e => e.cost_code === filterCode);
      if (filterStatus !== 'all') l = l.filter(e => e.status === filterStatus);
      if (filterApproval !== 'all') l = l.filter(e => (e.approval_status || 'pending') === filterApproval);
      if (filterDate) l = l.filter(e => e.clock_in?.startsWith(filterDate));
      if (search) {
        const q = search.toLowerCase();
        l = l.filter(e =>
          e.employee_name?.toLowerCase().includes(q) ||
          e.employee_code?.toLowerCase().includes(q) ||
          e.job_address?.toLowerCase().includes(q) ||
          e.cost_code?.toLowerCase().includes(q)
        );
      }
    }
    const sortFns = {
      newest: (a, b) => (b.clock_in || '').localeCompare(a.clock_in || ''),
      oldest: (a, b) => (a.clock_in || '').localeCompare(b.clock_in || ''),
      employee: (a, b) => (a.employee_name || '').localeCompare(b.employee_name || ''),
      hours_high: (a, b) => (b.duration_minutes || 0) - (a.duration_minutes || 0),
      updated: (a, b) => (b.updated_date || '').localeCompare(a.updated_date || ''),
    };
    return [...l].sort(sortFns[sort] || sortFns.newest);
  }, [entries, selfEntries, isAdmin, selfEmployee, filterEmployee, filterCode, filterStatus, filterDate, search, sort]);

  // Non-admin: show self-service view
  if (!isAdmin) {
    return (
      <AppLayout title="My Hours">
        <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-5">
          <div>
            <h1 className="text-base font-semibold text-foreground">My Time History</h1>
            <p className="text-xs text-muted-foreground mt-0.5">View your own hours and entries</p>
          </div>

          {!selfEmployee ? (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <p className="text-sm font-medium text-foreground">Enter your employee code</p>
              <Input
                value={selfCode}
                onChange={e => setSelfCode(e.target.value)}
                placeholder="Employee code"
                className="h-10 rounded-xl text-center tracking-widest uppercase text-sm"
                onKeyDown={e => e.key === 'Enter' && lookupSelf()}
              />
              {codeError && <p className="text-xs text-destructive">{codeError}</p>}
              <Button className="w-full h-10 rounded-xl" onClick={lookupSelf} disabled={!selfCode}>View My Hours</Button>
            </div>
          ) : (
            <>
              <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{selfEmployee.name}</p>
                  <button onClick={() => setSelfEmployee(null)} className="text-xs text-muted-foreground underline">Switch</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-secondary/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-primary">{formatDuration(selfTodayMins)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Today</p>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{formatDuration(selfWeekMins)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">This Week</p>
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : selfEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No time entries found.</p>
              ) : (
                <div className="space-y-2">
                  {selfEntries.map(e => (
                    <div key={e.id} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-muted-foreground">{e.clock_in ? format(parseISO(e.clock_in), 'EEE, MMM d, yyyy') : '—'}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.status === 'clocked_in' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {e.status === 'clocked_in' ? 'Active' : formatDuration(e.duration_minutes)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground truncate">{e.job_address || '—'}</p>
                      <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                        <span>{e.cost_code}</span>
                        <span>
                          {e.clock_in ? format(parseISO(e.clock_in), 'h:mm a') : '—'}
                          {e.clock_out ? ` → ${format(parseISO(e.clock_out), 'h:mm a')}` : ' → now'}
                        </span>
                      </div>
                      {(e.employee_note || e.note) && <p className="text-xs text-muted-foreground italic mt-1.5 border-t border-border pt-1.5">{e.employee_note || e.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </AppLayout>
    );
  }

  // Admin view
  return (
    <AppLayout title="Time Entries">
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Time Entries</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {clockedInNow} clocked in · {formatDuration(todayMinutes)} logged today
            </p>
          </div>
          <Button className="h-9 rounded-xl text-sm gap-1.5" onClick={() => setShowManual(true)}>
            <Plus className="w-3.5 h-3.5" /> Manual Entry
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-primary">{clockedInNow}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Clocked In</p>
          </div>
          <div className="bg-secondary border border-border rounded-xl p-3 text-center">
            <p className="text-xl font-black text-foreground">{formatDuration(todayMinutes)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Today's Hours</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-amber-700">{entries.filter(e => e.status === 'needs_review' || e.manual_adjustment).length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Flagged</p>
          </div>
        </div>

        {/* Manual entry form */}
        <AnimatePresence>
          {showManual && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-foreground">Manual Time Entry</p>
                  <button onClick={() => setShowManual(false)} aria-label="Close manual entry form" className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>
                <AdminManualEntryForm
                  jobs={jobs}
                  employees={employees}
                  onSave={createEntry.mutate}
                  onCancel={() => setShowManual(false)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search employee, job, code..." value={search} onChange={e => setSearch(e.target.value)} aria-label="Search time entries by employee, job, or cost code" className="pl-9 h-9 rounded-xl text-sm" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {uniqueEmployees.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCode} onValueChange={setFilterCode}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cost Codes</SelectItem>
                {COST_CODES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="clocked_in">Active</SelectItem>
                <SelectItem value="clocked_out">Completed</SelectItem>
                <SelectItem value="needs_review">Needs Review</SelectItem>
                <SelectItem value="edited">Edited</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterApproval} onValueChange={setFilterApproval}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Approvals</SelectItem>
                <SelectItem value="pending">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="h-8 text-xs rounded-lg w-auto" />
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="employee">Employee A–Z</SelectItem>
                <SelectItem value="hours_high">Hours ↓</SelectItem>
                <SelectItem value="updated">Recently Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Entry list */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No time entries found.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(entry => (
              <div
                key={entry.id}
                className="bg-card border border-border rounded-xl p-4 space-y-2 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-3.5 h-3.5 text-primary shrink-0" />
                    <p className="text-sm font-medium text-foreground truncate">{entry.employee_name}</p>
                    <span className="text-xs text-muted-foreground shrink-0">#{entry.employee_code}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {entry.geo_flagged && <MapPin className="w-3.5 h-3.5 text-red-500" title="Out-of-range punch" />}
                    {entry.manual_adjustment && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" title="Manually edited" />}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      entry.status === 'clocked_in' ? 'bg-primary/10 text-primary' :
                      entry.status === 'needs_review' ? 'bg-amber-100 text-amber-700' :
                      entry.status === 'edited' ? 'bg-blue-100 text-blue-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {entry.status === 'clocked_in' ? 'Active' : entry.status === 'needs_review' ? 'Review' : entry.status === 'edited' ? 'Edited' : formatDuration(entry.duration_minutes)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground truncate">{entry.job_address || '—'}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">{entry.cost_code}</span>
                  <span className="flex items-center gap-1 shrink-0 ml-2">
                    <Clock className="w-3 h-3" />
                    {entry.clock_in ? format(parseISO(entry.clock_in), 'MMM d · h:mm a') : '—'}
                    {entry.clock_out ? ` → ${format(parseISO(entry.clock_out), 'h:mm a')}` : ' → now'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/60">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    (entry.approval_status || 'pending') === 'approved' ? 'bg-green-100 text-green-700' :
                    (entry.approval_status || 'pending') === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    {(entry.approval_status || 'pending') === 'approved' ? '✓ Approved' : (entry.approval_status || 'pending') === 'rejected' ? 'Rejected' : 'Pending Approval'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {(entry.approval_status || 'pending') !== 'approved' && entry.status === 'clocked_out' && (
                      <button
                        onClick={() => approveMutation.mutate(entry.id)}
                        aria-label={`Approve time entry for ${entry.employee_name}`}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    <button onClick={() => navigate(`/time-entries/${entry.id}`)} className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded-lg hover:bg-muted">
                      View →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </PullToRefresh>
    </AppLayout>
  );
}