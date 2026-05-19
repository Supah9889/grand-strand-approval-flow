import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2, Plus, ChevronLeft, ChevronRight, Calendar, List, AlignLeft,
  BarChart2, Search, Clock, BriefcaseBusiness, Building2, AlertTriangle,
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks,
  isToday, isSameMonth, parseISO,
} from 'date-fns';
import AppLayout from '../components/AppLayout';
import CalendarEventModal from '../components/CalendarEventModal';
import CalendarEventDetail from '../components/CalendarEventDetail';
import { EVENT_TYPE_CONFIG, EVENT_STATUS_CONFIG, getEventColor, formatEventTime } from '@/lib/calendarHelpers';
import { isAdmin as getIsAdmin } from '@/lib/adminAuth';

const VIEWS = [
  { key: 'month',    label: 'Month',    icon: Calendar },
  { key: 'week',     label: 'Week',     icon: AlignLeft },
  { key: 'agenda',   label: 'Agenda',   icon: List },
  { key: 'timeline', label: 'Timeline', icon: BarChart2 },
];

const MONTH_VISIBLE_LIMIT = 3;

const SCHEDULE_CATEGORY_STYLES = {
  production: { label: 'Production', color: '#2563eb', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  office: { label: 'Office/Admin', color: '#64748b', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
  estimate: { label: 'Estimate/Tour', color: '#0f766e', badge: 'bg-teal-100 text-teal-700 border-teal-200' },
  internal: { label: 'Internal', color: '#9333ea', badge: 'bg-purple-100 text-purple-700 border-purple-200' },
  other: { label: 'Other', color: '#d97706', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
};

function getEventDateKey(event) {
  return event.start_date ? event.start_date.split('T')[0] : '';
}

function getImportedTimeRange(event) {
  const notes = String(event.internal_notes || '');
  const match = notes.match(/Time:\s*([0-9]{1,2}:[0-9]{2}\s*[AP]M)(?:\s*[–-]\s*([0-9]{1,2}:[0-9]{2}\s*[AP]M))?/i);
  if (!match) return null;
  return {
    start: match[1].replace(/\s+/g, ' ').toUpperCase(),
    end: match[2]?.replace(/\s+/g, ' ').toUpperCase() || null,
  };
}

function getEventTimeRange(event) {
  const imported = getImportedTimeRange(event);
  if (imported) return imported;
  return {
    start: formatEventTime(event.start_date),
    end: formatEventTime(event.end_date),
  };
}

function timeToMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!match) return 24 * 60;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function sortEventsForDisplay(a, b) {
  const aDate = getEventDateKey(a);
  const bDate = getEventDateKey(b);
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  const aTime = getEventTimeRange(a).start;
  const bTime = getEventTimeRange(b).start;
  return timeToMinutes(aTime) - timeToMinutes(bTime) || String(a.title || '').localeCompare(String(b.title || ''));
}

function getScheduleCategory(event) {
  const title = String(event.title || '').toLowerCase();
  const address = String(event.job_address || '').toLowerCase();
  const type = event.event_type || 'other';
  if (/birthday|lease|holiday|reminder|internal/.test(title)) return 'internal';
  if (type === 'meeting' || /office|admin|grand stand office/.test(`${title} ${address}`)) return 'office';
  if (type === 'estimate_appointment' || /estimate|tour/.test(title)) return 'estimate';
  if (['job_visit', 'work_block', 'warranty_appointment'].includes(type)) return 'production';
  return 'other';
}

function getScheduleStyle(event) {
  const category = getScheduleCategory(event);
  const style = SCHEDULE_CATEGORY_STYLES[category] || SCHEDULE_CATEGORY_STYLES.other;
  return { ...style, category };
}

export default function CalendarPage() {
  const [view, setView] = useState('month');
  const [current, setCurrent] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterStaff, setFilterStaff] = useState('all');
  const [search, setSearch] = useState('');
  const canManageSchedule = getIsAdmin();

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

  const eventsByDate = useMemo(() => {
    const grouped = new Map();
    filteredEvents.forEach((event) => {
      const key = getEventDateKey(event);
      if (!key) return;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(event);
    });
    grouped.forEach((items, key) => grouped.set(key, [...items].sort(sortEventsForDisplay)));
    return grouped;
  }, [filteredEvents]);

  const getEventsForDay = (day) => eventsByDate.get(format(day, 'yyyy-MM-dd')) || [];

  const handleDayClick = (day) => {
    setSelectedDay(day);
  };

  const handleAddForDay = (day) => {
    setPrefilledDate(format(day, 'yyyy-MM-dd'));
    setShowModal(true);
  };

  const handleEventClick = (e, evt) => {
    e.stopPropagation();
    setSelectedEvent(evt);
  };

  const selectedJob = selectedEvent ? jobs.find(j => j.id === selectedEvent.job_id) : null;

  const getLinkedJobLabel = (event) => {
    const job = jobs.find(j => j.id === event.job_id);
    return job?.address || job?.title || event.job_address || 'No linked job';
  };

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
            const visibleEvents = dayEvents.slice(0, MONTH_VISIBLE_LIMIT);
            const overflowCount = Math.max(0, dayEvents.length - visibleEvents.length);
            return (
              <div
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                className={`bg-card min-h-[128px] p-2 transition-colors cursor-pointer hover:bg-secondary/30 ${!inMonth ? 'opacity-40' : ''}`}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday(day) ? 'bg-primary text-primary-foreground' : 'text-foreground'
                  }`}>{format(day, 'd')}</p>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] font-medium text-muted-foreground">{dayEvents.length}</span>
                  )}
                </div>
                <div className="space-y-1 overflow-hidden">
                  {visibleEvents.map(e => {
                    const style = getScheduleStyle(e);
                    const timeRange = getEventTimeRange(e);
                    const unmatched = e.source_system === 'buildertrend' && !e.job_id;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={(ev) => handleEventClick(ev, e)}
                        className="w-full rounded-md border border-white/20 px-1.5 py-1 text-left text-[11px] text-white shadow-sm transition-opacity hover:opacity-90"
                        style={{ backgroundColor: e.color || style.color }}
                      >
                        <span className="block truncate font-medium">{e.title}</span>
                        <span className="block truncate text-[10px] opacity-90">
                          {timeRange.start ? `${timeRange.start}${timeRange.end ? `-${timeRange.end}` : ''}` : style.label}
                          {unmatched ? ' · Unmatched' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {overflowCount > 0 && (
                  <button
                    type="button"
                    onClick={(ev) => { ev.stopPropagation(); setSelectedDay(day); }}
                    className="mt-1 w-full rounded-md border border-border bg-muted/40 px-1.5 py-1 text-left text-[11px] font-medium text-primary transition-colors hover:bg-muted"
                  >
                    +{overflowCount} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── WEEK VIEW ──
  const EventSummaryCard = ({ event, compact = false }) => {
    const style = getScheduleStyle(event);
    const timeRange = getEventTimeRange(event);
    const status = EVENT_STATUS_CONFIG[event.status] || EVENT_STATUS_CONFIG.scheduled;
    const unmatched = event.source_system === 'buildertrend' && !event.job_id;
    const jobLabel = getLinkedJobLabel(event);
    return (
      <button
        type="button"
        onClick={() => setSelectedEvent(event)}
        className={`w-full rounded-lg border border-border bg-card text-left transition-colors hover:border-primary/40 hover:bg-muted/30 ${compact ? 'p-2' : 'p-3'}`}
      >
        <div className="flex items-start gap-3">
          <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: event.color || style.color }} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className={`text-[10px] ${style.badge}`}>{style.label}</Badge>
              <Badge variant="outline" className={`text-[10px] ${status.color}`}>{status.label}</Badge>
              {unmatched && (
                <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                  <AlertTriangle className="mr-1 h-3 w-3" /> Unmatched
                </Badge>
              )}
            </div>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">{event.title}</p>
            <div className="mt-1 grid gap-1 text-xs text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {timeRange.start ? `${timeRange.start}${timeRange.end ? ` - ${timeRange.end}` : ''}` : 'No time set'}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1">
                {style.category === 'office' || style.category === 'internal'
                  ? <Building2 className="h-3.5 w-3.5 shrink-0" />
                  : <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{jobLabel}</span>
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  };

  const renderDayDrawer = () => {
    const dayEvents = selectedDay ? getEventsForDay(selectedDay) : [];
    return (
      <Sheet open={!!selectedDay} onOpenChange={(open) => { if (!open) setSelectedDay(null); }}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-xl">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-border px-5 py-4 pr-12">
              <SheetTitle>{selectedDay ? format(selectedDay, 'EEEE, MMMM d, yyyy') : 'Schedule'}</SheetTitle>
              <SheetDescription>
                {dayEvents.length} scheduled item{dayEvents.length !== 1 ? 's' : ''}.
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1">
              <div className="space-y-3 px-5 py-4">
                {dayEvents.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    No events scheduled for this day.
                  </p>
                ) : (
                  dayEvents.map(event => <EventSummaryCard key={event.id} event={event} />)
                )}
              </div>
            </ScrollArea>
            <div className="border-t border-border px-5 py-3">
              {canManageSchedule ? (
                <Button
                  className="w-full gap-2"
                  onClick={() => selectedDay && handleAddForDay(selectedDay)}
                >
                  <Plus className="h-4 w-4" /> Add event
                </Button>
              ) : (
                <p className="text-center text-xs text-muted-foreground">Please contact the office to update the schedule.</p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  };

  const renderWeek = () => {
    const days = eachDayOfInterval({ start: startOfWeek(current), end: endOfWeek(current) });
    return (
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const dayEvents = getEventsForDay(day);
          const visibleEvents = dayEvents.slice(0, 6);
          const overflowCount = Math.max(0, dayEvents.length - visibleEvents.length);
          return (
            <div
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              className={`border border-border rounded-xl p-2 min-h-[190px] transition-colors cursor-pointer hover:bg-secondary/20 ${isToday(day) ? 'border-primary/60 bg-secondary/30' : 'bg-card'}`}
            >
              <div className={`mb-2 text-center text-xs font-medium ${isToday(day) ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                <p>{format(day, 'EEE')}</p>
                <p>{format(day, 'd')}</p>
              </div>
              <div className="space-y-1">
                {visibleEvents.map(e => {
                  const style = getScheduleStyle(e);
                  const timeRange = getEventTimeRange(e);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={(ev) => handleEventClick(ev, e)}
                      className="w-full rounded-md px-1.5 py-1 text-left text-[10px] leading-tight text-white shadow-sm transition-opacity hover:opacity-90"
                      style={{ backgroundColor: e.color || style.color }}
                    >
                      {timeRange.start && <span className="block opacity-85">{timeRange.start}</span>}
                      <span className="block truncate">{e.title}</span>
                    </button>
                  );
                })}
                {overflowCount > 0 && (
                  <button
                    type="button"
                    onClick={(ev) => { ev.stopPropagation(); setSelectedDay(day); }}
                    className="w-full rounded-md border border-border bg-muted/40 px-1.5 py-1 text-left text-[10px] font-medium text-primary hover:bg-muted"
                  >
                    +{overflowCount} more
                  </button>
                )}
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
      .sort(sortEventsForDisplay);
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
  const scheduledCount = filteredEvents.filter(e => (e.status || 'scheduled') === 'scheduled').length;
  const jobCount = new Set(filteredEvents.filter(e => e.job_id).map(e => e.job_id)).size;

  return (
    <AppLayout title="Schedule">
      <div className="app-page space-y-4">

        {/* Header */}
        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Schedule</h1>
            <p className="app-page-subtitle">Schedule, job visits, crew assignments, and upcoming work.</p>
          </div>
          <div className="app-page-actions flex-wrap">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
              {navTitle && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={nav.prev}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <p className="min-w-[150px] text-center text-sm font-semibold text-foreground">{navTitle}</p>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={nav.next}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              )}
              {!navTitle && <p className="px-3 text-sm font-semibold text-foreground">{view === 'agenda' ? 'All Events' : 'Timeline'}</p>}
            </div>
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
            {canManageSchedule ? (
              <Button size="sm" className="h-8 rounded-lg text-xs ml-1" onClick={() => { setPrefilledDate(''); setShowModal(true); }}>
                <Plus className="w-3.5 h-3.5 mr-1" />Add
              </Button>
            ) : (
              <div className="max-w-[180px] text-right text-xs text-muted-foreground">
                Please contact the office to update the schedule.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="app-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
            <p className="mt-2 text-2xl font-bold text-primary">{todayCount}</p>
            <p className="text-xs text-muted-foreground">scheduled items</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scheduled</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{scheduledCount}</p>
            <p className="text-xs text-muted-foreground">visible events</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jobs</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{jobCount}</p>
            <p className="text-xs text-muted-foreground">with schedule activity</p>
          </div>
        </div>

        {/* Filters */}
        <div className="app-card p-3">
          <FiltersBar />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <div className="app-card p-4">
            {view === 'month' ? renderMonth() :
            view === 'week' ? renderWeek() :
            view === 'agenda' ? renderAgenda() :
            renderTimeline()}
          </div>
        )}
      </div>

      <CalendarEventModal
        open={showModal}
        onClose={() => { setShowModal(false); setPrefilledDate(''); }}
        jobs={jobs}
        prefilledDate={prefilledDate}
        canManageSchedule={canManageSchedule}
      />

      <CalendarEventDetail
        open={!!selectedEvent}
        event={selectedEvent}
        job={selectedJob}
        onClose={() => setSelectedEvent(null)}
        canManageSchedule={canManageSchedule}
      />

      {renderDayDrawer()}
    </AppLayout>
  );
}
