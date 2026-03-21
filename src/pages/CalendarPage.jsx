import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, ChevronLeft, ChevronRight, Calendar, List, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks,
  isToday, isSameMonth, parseISO,
} from 'date-fns';
import AppLayout from '../components/AppLayout';
import { toast } from 'sonner';

const VIEWS = ['month', 'week', 'agenda'];
const STATUS_COLORS = {
  scheduled: 'bg-primary/80',
  in_progress: 'bg-amber-500',
  completed: 'bg-green-500',
  cancelled: 'bg-muted-foreground/40',
};

const emptyEvent = { title: '', job_id: '', job_address: '', assigned_to: '', start_date: '', end_date: '', notes: '', status: 'scheduled' };

export default function CalendarPage() {
  const [view, setView] = useState('month');
  const [current, setCurrent] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyEvent);
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => base44.entities.CalendarEvent.list('start_date'),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['cal-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CalendarEvent.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setForm(emptyEvent);
      setShowForm(false);
      toast.success('Event added');
    },
  });

  const handleJobSelect = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    setForm(prev => ({ ...prev, job_id: jobId, job_address: job?.address || '' }));
  };

  const getEventsForDay = (day) =>
    events.filter(e => e.start_date && isSameDay(parseISO(e.start_date.split('T')[0]), day));

  // ── MONTH VIEW ──
  const renderMonth = () => {
    const days = eachDayOfInterval({
      start: startOfWeek(startOfMonth(current)),
      end: endOfWeek(endOfMonth(current)),
    });
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 text-center">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <div key={d} className="text-xs text-muted-foreground font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
          {days.map(day => {
            const dayEvents = getEventsForDay(day);
            const inMonth = isSameMonth(day, current);
            return (
              <div key={day.toISOString()} className={`bg-card min-h-[56px] p-1 ${!inMonth ? 'opacity-40' : ''}`}>
                <p className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5 ${
                  isToday(day) ? 'bg-primary text-primary-foreground' : 'text-foreground'
                }`}>{format(day, 'd')}</p>
                {dayEvents.slice(0, 2).map(e => (
                  <div key={e.id} className={`text-xs px-1 py-0.5 rounded mb-0.5 text-white truncate ${STATUS_COLORS[e.status] || 'bg-primary/80'}`}>
                    {e.title}
                  </div>
                ))}
                {dayEvents.length > 2 && <p className="text-xs text-muted-foreground">+{dayEvents.length - 2}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── WEEK VIEW ──
  const renderWeek = () => {
    const days = eachDayOfInterval({ start: startOfWeek(current), end: endOfWeek(current) });
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const dayEvents = getEventsForDay(day);
            return (
              <div key={day.toISOString()} className={`border border-border rounded-xl p-2 min-h-[100px] ${isToday(day) ? 'border-primary' : ''}`}>
                <p className={`text-xs font-medium mb-1.5 ${isToday(day) ? 'text-primary' : 'text-muted-foreground'}`}>
                  {format(day, 'EEE d')}
                </p>
                {dayEvents.map(e => (
                  <div key={e.id} className={`text-xs px-1.5 py-1 rounded mb-1 text-white leading-tight ${STATUS_COLORS[e.status] || 'bg-primary/80'}`}>
                    {e.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── AGENDA VIEW ──
  const renderAgenda = () => {
    const upcoming = events
      .filter(e => e.start_date)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    if (upcoming.length === 0) return <p className="text-sm text-muted-foreground text-center py-12">No events scheduled.</p>;
    return (
      <div className="space-y-2">
        {upcoming.map(e => (
          <div key={e.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
            <div className={`w-1 self-stretch rounded-full ${STATUS_COLORS[e.status] || 'bg-primary'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{e.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {e.start_date ? format(parseISO(e.start_date.split('T')[0]), 'EEEE, MMM d, yyyy') : ''}
              </p>
              {e.job_address && <p className="text-xs text-muted-foreground">{e.job_address}</p>}
              {e.assigned_to && <p className="text-xs text-muted-foreground">Assigned: {e.assigned_to}</p>}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full text-white shrink-0 ${STATUS_COLORS[e.status] || 'bg-primary/80'}`}>
              {e.status}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const nav = view === 'month'
    ? { prev: () => setCurrent(subMonths(current, 1)), next: () => setCurrent(addMonths(current, 1)) }
    : { prev: () => setCurrent(subWeeks(current, 1)), next: () => setCurrent(addWeeks(current, 1)) };

  const title = view === 'month' ? format(current, 'MMMM yyyy')
    : view === 'week' ? `${format(startOfWeek(current), 'MMM d')} – ${format(endOfWeek(current), 'MMM d, yyyy')}`
    : 'Agenda';

  return (
    <AppLayout title="Calendar">
      <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {view !== 'agenda' && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={nav.prev}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <p className="text-sm font-semibold text-foreground min-w-[140px] text-center">{title}</p>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={nav.next}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            )}
            {view === 'agenda' && <p className="text-sm font-semibold text-foreground">All Events</p>}
          </div>
          <div className="flex items-center gap-1">
            {VIEWS.map(v => (
              <Button key={v} variant={view === v ? 'default' : 'ghost'} size="sm"
                className="h-8 rounded-lg text-xs capitalize px-3" onClick={() => setView(v)}>
                {v === 'month' ? <Calendar className="w-3.5 h-3.5 mr-1" /> : <List className="w-3.5 h-3.5 mr-1" />}
                {v}
              </Button>
            ))}
            <Button size="sm" className="h-8 rounded-lg text-xs" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-3.5 h-3.5 mr-1" />Add
            </Button>
          </div>
        </div>

        {/* Add Event Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-card border border-border rounded-2xl p-5 space-y-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">New Event</p>
                <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <Input placeholder="Event Title *" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="h-10 rounded-xl text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" placeholder="Start Date *" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className="h-10 rounded-xl text-sm" />
                <Input type="date" placeholder="End Date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} className="h-10 rounded-xl text-sm" />
              </div>
              <Select value={form.job_id} onValueChange={handleJobSelect}>
                <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue placeholder="Link to job (optional)" /></SelectTrigger>
                <SelectContent>{jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address}</SelectItem>)}</SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Assigned To" value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})} className="h-10 rounded-xl text-sm" />
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="rounded-xl text-sm min-h-14" />
              <Button className="w-full h-10 rounded-xl" disabled={!form.title || !form.start_date || createMutation.isPending} onClick={() => createMutation.mutate(form)}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Event'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Calendar Views */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          view === 'month' ? renderMonth() :
          view === 'week' ? renderWeek() :
          renderAgenda()
        )}
      </div>
    </AppLayout>
  );
}