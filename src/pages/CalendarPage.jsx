import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2, Plus, ChevronLeft, ChevronRight, Calendar, List, AlignLeft, BarChart2, Search } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks,
  isToday, isSameMonth, parseISO,
} from 'date-fns';
import AppLayout from '../components/AppLayout';
import CalendarEventModal from '../components/CalendarEventModal';
import CalendarEventDetail from '../components/CalendarEventDetail';
import { EVENT_TYPE_CONFIG, EVENT_STATUS_CONFIG, getEventColor, formatEventTime } from '@/lib/calendarHelpers';

const VIEWS = [
  { key: 'month',    label: 'Month',    icon: Calendar },
  { key: 'week',     label: 'Week',     icon: AlignLeft },
  { key: 'agenda',   label: 'Agenda',   icon: List },
  { key: 'timeline', label: 'Timeline', icon: BarChart2 },
];

export default function CalendarPage() {
  const [view, setView] = useState('month');
  const [current, setCurrent] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterStaff, setFilterStaff] = useState('all');
  const [search, setSearch] = useState('');

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => base44.entities.CalendarEvent.list('start_date'),
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ['cal-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 200),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ active: true }),
    staleTime: 60000,
  });

  const updateEvent = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CalendarEvent.update(id, data),
    onSuccess: () => useQueryClient().invalidateQueries({ queryKey: ['calendar-events'] }),
  });

  // Curated staff options from the employee directory rather than raw event strings.
  const assignees = useMemo(() => employees.map(e => e.name).filter(Boolean).sort(), [employees]);

  const filteredEvents = useMemo(() => {
    let l = events;
    if (filterType !== 'all') l = l.filter(e => e.event_type === filterType);
    if (filterStatus !== 'all') l = l.filter(e => e.status === filterStatus);
    if (filterStaff !== 'all') l = l.filter(e => e.assigned_to === filterStaff);
    if (search) {
      const q = search.toLowerCase();
      l = l.filter(e =>
        e.title?.toLowerCase().includes(q) ||
        e.job_address?.toLowerCase().includes(q) ||
        e.assigned_to?.toLowerCase().includes(q) ||
        e.notes?.toLowerCase().includes(q)
      );
    }
    return l;
  }, [events, filterType, filterStatus, filterStaff, search]);

  const getEventsForDay = (day) =>
    filteredEvents.filter(e => e.start_date && isSameDay(parseISO(e.start_date.split('T')[0]), day));

  const handleDayClick = (day) => {
    setPrefilledDate(format(day, 'yyyy-MM-dd'));
    setShowModal(true);
  };

  const handleEventClick = (e, evt) => {
    e.stopPropagation();
    setSelectedEvent(evt);
  };

  const selectedJob = selectedEvent ? jobs.find(j => j.id === selectedEvent.job_id) : null;

  // Filters bar
  const FiltersBar = () => (
    <div className="flex gap-2 flex-wrap items-center">
      <div className="relative flex-1 min-w-[160px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs rounded-lg" />
      </div>
      <Select value={filterType} onValueChange={setFilterType}>
        <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {Object.entries(EVENT_TYPE_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterStatus} onValueChange={setFilterStatus}>
        <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {Object.entries(EVENT_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {assignees.length > 0 && (
        <Select value={filterStaff} onValueChange={setFilterStaff}>
          <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Staff</SelectItem>
            {assignees.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );

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
              <div
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                className={`bg-card min-h-[60px] p-1 cursor-pointer hover:bg-secondary/30 transition-colors ${!inMonth ? 'opacity-40' : ''}`}
              >
                <p className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5 ${
                  isToday(day) ? 'bg-primary text-primary-foreground' : 'text-foreground'
                }`}>{format(day, 'd')}</p>
                {dayEvents.slice(0, 2).map(e => {
                  const color = getEventColor(e);
                  return (
                    <div
                      key={e.id}
                      onClick={(ev) => handleEventClick(ev, e)}
                      className="text-xs px-1 py-0.5 rounded mb-0.5 text-white truncate cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-0.5"
                      style={{ backgroundColor: color }}
                    >
                      <span className="text-[10px] shrink-0">{EVENT_TYPE_CONFIG[e.event_type]?.icon || ''}</span>
                      <span className="truncate">{e.title}</span>
                    </div>
                  );
                })}
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
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const dayEvents = getEventsForDay(day);
          return (
            <div
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              className={`border border-border rounded-xl p-1.5 min-h-[110px] cursor-pointer hover:bg-secondary/20 transition-colors ${isToday(day) ? 'border-primary/60' : ''}`}
            >
              <p className={`text-xs font-medium mb-1.5 text-center ${isToday(day) ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                {format(day, 'EEE')}<br />{format(day, 'd')}
              </p>
              <div className="space-y-0.5">
                {dayEvents.map(e => {
                  const color = getEventColor(e);
                  const timeStr = e.start_date?.includes('T') ? formatEventTime(e.start_date) : null;
                  return (
                    <div
                      key={e.id}
                      onClick={(ev) => handleEventClick(ev, e)}
                      className="text-[10px] px-1 py-0.5 rounded text-white leading-tight cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: color }}
                    >
                      {timeStr && <span className="opacity-80">{timeStr}<br /></span>}
                      <span className="truncate block">{e.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── AGENDA VIEW ──
  const renderAgenda = () => {
    const upcoming = [...filteredEvents]
      .filter(e => e.start_date)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    if (upcoming.length === 0) return <p className="text-sm text-muted-foreground text-center py-12">No events found.</p>;
    return (
      <div className="space-y-2">
        {upcoming.map(e => {
          const color = getEventColor(e);
          const startTime = formatEventTime(e.start_date);
          const endTime = formatEventTime(e.end_date);
          const stCfg = EVENT_STATUS_CONFIG[e.status] || EVENT_STATUS_CONFIG.scheduled;
          return (
            <div
              key={e.id}
              onClick={() => setSelectedEvent(e)}
              className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 cursor-pointer hover:border-primary/30 transition-colors"
            >
              <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">{EVENT_TYPE_CONFIG[e.event_type]?.icon} {EVENT_TYPE_CONFIG[e.event_type]?.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${stCfg.color}`}>{stCfg.label}</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{e.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {e.start_date ? format(parseISO(e.start_date.split('T')[0]), 'EEE, MMM d, yyyy') : ''}
                  {startTime && ` · ${startTime}${endTime ? ` – ${endTime}` : ''}`}
                </p>
                {e.job_address && <p className="text-xs text-muted-foreground">{e.job_address}</p>}
                {e.assigned_to && <p className="text-xs text-muted-foreground">👤 {e.assigned_to}</p>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── TIMELINE VIEW ──
  const renderTimeline = () => {
    // Group events by job, sorted by start_date
    const byJob = {};
    filteredEvents.filter(e => e.start_date).forEach(e => {
      const key = e.job_id || '__none__';
      if (!byJob[key]) byJob[key] = { job: jobs.find(j => j.id === e.job_id), events: [] };
      byJob[key].events.push(e);
    });

    if (Object.keys(byJob).length === 0) return <p className="text-sm text-muted-foreground text-center py-12">No events to display.</p>;

    return (
      <div className="space-y-3">
        {Object.values(byJob).map(({ job, events: evts }, i) => {
          const sorted = [...evts].sort((a, b) => a.start_date.localeCompare(b.start_date));
          const color = getEventColor(sorted[0]);
          return (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Job header */}
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <p className="text-sm font-semibold text-foreground">{job?.address || job?.title || 'No Job'}</p>
                {job?.customer_name && <p className="text-xs text-muted-foreground">· {job.customer_name}</p>}
              </div>
              {/* Events timeline */}
              <div className="divide-y divide-border/60">
                {sorted.map(e => {
                  const startTime = formatEventTime(e.start_date);
                  const endTime = formatEventTime(e.end_date);
                  const stCfg = EVENT_STATUS_CONFIG[e.status] || EVENT_STATUS_CONFIG.scheduled;
                  return (
                    <div
                      key={e.id}
                      onClick={() => setSelectedEvent(e)}
                      className="px-4 py-2.5 flex items-start gap-3 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <div className="min-w-[70px] text-right shrink-0">
                        <p className="text-xs font-medium text-foreground">{e.start_date ? format(parseISO(e.start_date.split('T')[0]), 'MMM d') : '—'}</p>
                        {startTime && <p className="text-xs text-muted-foreground">{startTime}</p>}
                      </div>
                      <div className="w-px self-stretch bg-border shrink-0 mx-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">{EVENT_TYPE_CONFIG[e.event_type]?.icon}</span>
                          <p className="text-sm font-medium text-foreground">{e.title}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${stCfg.color}`}>{stCfg.label}</span>
                        </div>
                        {e.assigned_to && <p className="text-xs text-muted-foreground mt-0.5">👤 {e.assigned_to}</p>}
                        {endTime && startTime && <p className="text-xs text-muted-foreground">{startTime} – {endTime}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const nav = view === 'month'
    ? { prev: () => setCurrent(subMonths(current, 1)), next: () => setCurrent(addMonths(current, 1)) }
    : { prev: () => setCurrent(subWeeks(current, 1)), next: () => setCurrent(addWeeks(current, 1)) };

  const navTitle = view === 'month' ? format(current, 'MMMM yyyy')
    : view === 'week' ? `${format(startOfWeek(current), 'MMM d')} – ${format(endOfWeek(current), 'MMM d, yyyy')}`
    : null;

  const todayCount = filteredEvents.filter(e => e.start_date && isToday(parseISO(e.start_date.split('T')[0]))).length;

  return (
    <AppLayout title="Calendar">
      <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {navTitle && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={nav.prev}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <p className="text-sm font-semibold text-foreground min-w-[150px] text-center">{navTitle}</p>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={nav.next}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            )}
            {!navTitle && <p className="text-sm font-semibold text-foreground">{view === 'agenda' ? 'All Events' : 'Timeline'}</p>}
            {todayCount > 0 && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium ml-1">{todayCount} today</span>}
          </div>
          <div className="flex items-center gap-1">
            {VIEWS.map(v => {
              const Icon = v.icon;
              return (
                <Button key={v.key} variant={view === v.key ? 'default' : 'ghost'} size="sm"
                  className="h-8 rounded-lg text-xs px-2.5 gap-1" onClick={() => setView(v.key)}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{v.label}</span>
                </Button>
              );
            })}
            <Button size="sm" className="h-8 rounded-lg text-xs ml-1" onClick={() => { setPrefilledDate(''); setShowModal(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1" />Add
            </Button>
          </div>
        </div>

        {/* Filters */}
        <FiltersBar />

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          view === 'month' ? renderMonth() :
          view === 'week' ? renderWeek() :
          view === 'agenda' ? renderAgenda() :
          renderTimeline()
        )}
      </div>

      <CalendarEventModal
        open={showModal}
        onClose={() => { setShowModal(false); setPrefilledDate(''); }}
        jobs={jobs}
        prefilledDate={prefilledDate}
      />

      <CalendarEventDetail
        open={!!selectedEvent}
        event={selectedEvent}
        job={selectedJob}
        onClose={() => setSelectedEvent(null)}
      />
    </AppLayout>
  );
}