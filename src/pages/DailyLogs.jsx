import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Search, Loader2, BookOpen, AlertCircle, Camera, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, parseISO, startOfWeek, isAfter } from 'date-fns';
import AppLayout from '../components/AppLayout';
import LogForm from '../components/dailylogs/LogForm';
import LogCard from '../components/dailylogs/LogCard';
import { getInternalRole } from '@/lib/adminAuth';
import { audit } from '@/lib/audit';
import { toast } from 'sonner';

const STAT_GROUPS = [
  { key: 'today',       label: 'Today',           color: 'text-primary',    bg: 'bg-secondary',  border: 'border-primary/20' },
  { key: 'week',        label: 'This Week',        color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  { key: 'total',       label: 'Total Logs',       color: 'text-slate-700',  bg: 'bg-slate-50',   border: 'border-slate-200' },
  { key: 'follow_up',   label: 'Follow-Up Needed', color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
];

export default function DailyLogs() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterJob, setFilterJob] = useState('all');
  const [filterWeather, setFilterWeather] = useState('all');
  const [filterFollowUp, setFilterFollowUp] = useState('all');
  const [sort, setSort] = useState('newest');
  const [activeStat, setActiveStat] = useState(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['daily-logs'],
    queryFn: () => base44.entities.DailyLog.list('-log_date'),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DailyLog.create(data),
    onSuccess: (log) => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      setShowForm(false);
      const logDate = log.log_date || format(new Date(), 'yyyy-MM-dd');
      audit.dailyLog.created(log.id, role || 'Admin', log.job_address || log.job_title || log.job_id || 'Unknown Job', logDate, { job_id: log.job_id, job_address: log.job_address });
      toast.success('Daily log saved');
      navigate(`/daily-logs/${log.id}`);
    },
  });

  const stats = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    return {
      today: logs.filter(l => l.log_date === format(new Date(), 'yyyy-MM-dd')).length,
      week: logs.filter(l => l.log_date && isAfter(parseISO(l.log_date), weekStart)).length,
      total: logs.length,
      follow_up: logs.filter(l => l.follow_up_needed && l.follow_up_status !== 'resolved').length,
    };
  }, [logs]);

  const filtered = useMemo(() => {
    let list = logs;
    if (activeStat === 'today') list = list.filter(l => l.log_date === format(new Date(), 'yyyy-MM-dd'));
    if (activeStat === 'week') { const ws = startOfWeek(new Date()); list = list.filter(l => l.log_date && isAfter(parseISO(l.log_date), ws)); }
    if (activeStat === 'follow_up') list = list.filter(l => l.follow_up_needed && l.follow_up_status !== 'resolved');

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.job_address?.toLowerCase().includes(q) ||
        l.job_title?.toLowerCase().includes(q) ||
        l.crew_present?.toLowerCase().includes(q) ||
        l.work_completed?.toLowerCase().includes(q) ||
        l.general_notes?.toLowerCase().includes(q) ||
        l.created_by?.toLowerCase().includes(q)
      );
    }
    if (filterJob !== 'all') list = list.filter(l => l.job_id === filterJob);
    if (filterWeather !== 'all') list = list.filter(l => l.weather === filterWeather);
    if (filterFollowUp === 'yes') list = list.filter(l => l.follow_up_needed);
    if (filterFollowUp === 'no') list = list.filter(l => !l.follow_up_needed);

    if (sort === 'newest') list = [...list].sort((a, b) => (b.log_date || '').localeCompare(a.log_date || ''));
    if (sort === 'oldest') list = [...list].sort((a, b) => (a.log_date || '').localeCompare(b.log_date || ''));
    if (sort === 'updated') list = [...list].sort((a, b) => (b.updated_date || '').localeCompare(a.updated_date || ''));
    if (sort === 'alpha') list = [...list].sort((a, b) => (a.job_address || '').localeCompare(b.job_address || ''));
    return list;
  }, [logs, search, filterJob, filterWeather, filterFollowUp, sort, activeStat]);

  const activeJobs = jobs.filter(j => j.status !== 'archived');

  return (
    <AppLayout title="Daily Logs">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Daily Logs</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Field activity, jobsite photos & progress records</p>
          </div>
          <Button className="h-9 rounded-xl text-sm gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" /> New Log
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {STAT_GROUPS.map(g => (
            <button key={g.key}
              onClick={() => setActiveStat(activeStat === g.key ? null : g.key)}
              className={`text-left p-3 rounded-xl border-2 transition-all ${activeStat === g.key ? `${g.bg} ${g.border}` : 'bg-card border-border hover:border-primary/20'}`}>
              <p className={`text-lg font-bold leading-none ${g.color}`}>{stats[g.key] || 0}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">{g.label}</p>
            </button>
          ))}
        </div>

        {/* New Log Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-foreground">New Daily Log</p>
                  <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <LogForm jobs={activeJobs} onSave={data => createMutation.mutate(data)} onCancel={() => setShowForm(false)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by address, crew, notes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl text-sm" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterJob} onValueChange={setFilterJob}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                {activeJobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address || j.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterWeather} onValueChange={setFilterWeather}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Weather</SelectItem>
                {['sunny','cloudy','rain','storm','windy','cold','hot','humid','other'].map(w => <SelectItem key={w} value={w}>{w.charAt(0).toUpperCase()+w.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterFollowUp} onValueChange={setFilterFollowUp}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Logs</SelectItem>
                <SelectItem value="yes">Follow-Up Needed</SelectItem>
                <SelectItem value="no">No Follow-Up</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="updated">Recently Updated</SelectItem>
                <SelectItem value="alpha">A–Z by Address</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {activeStat && (
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Showing: {STAT_GROUPS.find(g => g.key === activeStat)?.label}</p>
            <button onClick={() => setActiveStat(null)} className="text-xs text-muted-foreground underline underline-offset-2">Clear</button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <BookOpen className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No daily logs found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(log => (
              <LogCard key={log.id} log={log} onClick={() => navigate(`/daily-logs/${log.id}`)} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}