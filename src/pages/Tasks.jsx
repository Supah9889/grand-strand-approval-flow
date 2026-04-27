import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import PullToRefresh from '@/components/PullToRefresh';
import { Plus, Search, Loader2, CheckSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { isPast, isToday, parseISO } from 'date-fns';
import AppLayout from '../components/AppLayout';
import TaskForm from '../components/tasks/TaskForm';
import TaskCard from '../components/tasks/TaskCard';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../components/tasks/TaskStatusBadge';
import { getInternalRole } from '@/lib/adminAuth';
import { audit } from '@/lib/audit';
import { toast } from 'sonner';

const STAT_GROUPS = [
  { key: 'open',       label: 'Open',          color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  { key: 'overdue',    label: 'Overdue',        color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200' },
  { key: 'today',      label: 'Due Today',      color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200' },
  { key: 'punch_list', label: 'Punch List Open',color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200' },
  { key: 'in_progress',label: 'In Progress',    color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
  { key: 'completed',  label: 'Completed',      color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200' },
  { key: 'total',      label: 'Total',          color: 'text-slate-700',  bg: 'bg-slate-50',   border: 'border-slate-200' },
  { key: 'blocked',    label: 'Blocked',        color: 'text-red-600',    bg: 'bg-red-50',     border: 'border-red-200' },
];

function isDueOverdue(t) {
  return t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)) &&
    !['completed','closed','canceled'].includes(t.status);
}
function isDueToday(t) {
  return t.due_date && isToday(parseISO(t.due_date)) && !['completed','closed','canceled'].includes(t.status);
}

export default function Tasks() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterJob, setFilterJob] = useState('all');
  const [sort, setSort] = useState('due_asc');
  const [activeStat, setActiveStat] = useState(null);
  const [ariaLiveMessage, setAriaLiveMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.refetchQueries({ queryKey: ['tasks'] });
    await queryClient.refetchQueries({ queryKey: ['jobs'] });
    setIsRefreshing(false);
  };

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-created_date'),
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 200),
  });

  const createMutation = useOptimisticMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    queryKey: ['tasks'],
    optimisticUpdate: (prev, taskData) => [
      { ...taskData, id: `temp-${Date.now()}`, created_date: new Date().toISOString(), updated_date: new Date().toISOString() },
      ...prev,
    ],
    rollback: (prev) => prev,
    onSuccess: (t) => {
      setShowForm(false);
      audit.task.created(t.id, role || 'Admin', t.title, t.job_address || t.job_title, { job_id: t.job_id, job_address: t.job_address });
      toast.success('Task created');
      setAriaLiveMessage(`New task "${t.title}" created`);
      navigate(`/tasks/${t.id}`);
    },
    onError: () => toast.error('Failed to create task'),
  });

  const stats = useMemo(() => {
    const m = { open: 0, overdue: 0, today: 0, punch_list: 0, in_progress: 0, completed: 0, total: tasks.length, blocked: 0 };
    tasks.forEach(t => {
      if (t.status === 'open') m.open++;
      if (t.status === 'in_progress') m.in_progress++;
      if (t.status === 'completed') m.completed++;
      if (t.status === 'blocked') m.blocked++;
      if (isDueOverdue(t)) m.overdue++;
      if (isDueToday(t)) m.today++;
      if (t.task_type === 'punch_list' && !['completed','closed','canceled'].includes(t.status)) m.punch_list++;
    });
    return m;
  }, [tasks]);

  const filtered = useMemo(() => {
    let list = tasks;
    if (activeStat === 'overdue') list = list.filter(isDueOverdue);
    else if (activeStat === 'today') list = list.filter(isDueToday);
    else if (activeStat === 'punch_list') list = list.filter(t => t.task_type === 'punch_list' && !['completed','closed','canceled'].includes(t.status));
    else if (activeStat && activeStat !== 'total') list = list.filter(t => t.status === activeStat);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.job_address?.toLowerCase().includes(q) ||
        t.assigned_to?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') list = list.filter(t => t.status === filterStatus);
    if (filterType !== 'all') list = list.filter(t => t.task_type === filterType);
    if (filterPriority !== 'all') list = list.filter(t => t.priority === filterPriority);
    if (filterJob !== 'all') list = list.filter(t => t.job_id === filterJob);

    const PRIO = { urgent: 0, high: 1, normal: 2, low: 3 };
    if (sort === 'newest') list = [...list].sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
    if (sort === 'oldest') list = [...list].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
    if (sort === 'due_asc') list = [...list].sort((a, b) => (a.due_date || 'z').localeCompare(b.due_date || 'z'));
    if (sort === 'priority') list = [...list].sort((a, b) => (PRIO[a.priority] ?? 2) - (PRIO[b.priority] ?? 2));
    if (sort === 'alpha') list = [...list].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    if (sort === 'updated') list = [...list].sort((a, b) => (b.updated_date || '').localeCompare(a.updated_date || ''));
    return list;
  }, [tasks, search, filterStatus, filterType, filterPriority, filterJob, sort, activeStat]);

  const activeJobs = jobs.filter(j => j.status !== 'archived');

  return (
    <AppLayout title="Tasks">
      {/* Aria live region for status announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {ariaLiveMessage}
      </div>
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Tasks / To-Dos / Punch List</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Action items, assignments & job closeout</p>
          </div>
          <Button 
            className="h-9 rounded-xl text-sm gap-1.5" 
            onClick={() => setShowForm(true)}
            aria-label="Create new task"
          >
            <Plus className="w-3.5 h-3.5" /> New Task
          </Button>
        </div>

        {/* Stats */}
         <div className="grid grid-cols-4 gap-2">
           {STAT_GROUPS.map(g => (
             <button key={g.key}
               onClick={() => setActiveStat(activeStat === g.key ? null : g.key)}
               aria-label={`Filter by ${g.label}, ${stats[g.key] || 0} items`}
               aria-pressed={activeStat === g.key}
               className={`text-left p-3 rounded-xl border-2 transition-all ${activeStat === g.key ? `${g.bg} ${g.border}` : 'bg-card border-border hover:border-primary/20'}`}>
              <p className={`text-lg font-bold leading-none ${g.color}`}>{stats[g.key] || 0}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">{g.label}</p>
            </button>
          ))}
        </div>

        {/* New Task Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-foreground">New Task</p>
                  <button onClick={() => setShowForm(false)} aria-label="Close new task form" className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>
                <TaskForm jobs={activeJobs} onSave={createMutation.mutate} onCancel={() => setShowForm(false)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by title, address, assignee..." value={search} onChange={e => setSearch(e.target.value)} aria-label="Search tasks by title, address, or assignee" className="pl-9 h-9 rounded-xl text-sm" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="todo">To-Do</SelectItem>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="punch_list">Punch List</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {Object.entries(PRIORITY_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="due_asc">Due Soonest</SelectItem>
                <SelectItem value="priority">Highest Priority</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="alpha">A–Z by Title</SelectItem>
                <SelectItem value="updated">Recently Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {activeStat && (
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Showing: {STAT_GROUPS.find(g => g.key === activeStat)?.label}</p>
            <button 
              onClick={() => setActiveStat(null)} 
              aria-label="Clear task filter"
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              Clear
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <CheckSquare className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No tasks found.</p>
          </div>
        ) : (
          <div className="space-y-2">
             {filtered.map(task => (
               <TaskCard 
                 key={task.id} 
                 task={task} 
                 onClick={() => navigate(`/tasks/${task.id}`)} 
                 aria-label={`Task: ${task.title}${task.assigned_to ? ` assigned to ${task.assigned_to}` : ''}, Status: ${task.status}`}
               />
             ))}
           </div>
        )}
      </div>
      </PullToRefresh>
    </AppLayout>
  );
}