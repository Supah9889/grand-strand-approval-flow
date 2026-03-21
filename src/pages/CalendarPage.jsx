import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, ChevronLeft, ChevronRight, Calendar, List } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks,
  isToday, isSameMonth, parseISO,
} from 'date-fns';
import AppLayout from '../components/AppLayout';
import CalendarEventModal from '../components/CalendarEventModal';

const VIEWS = ['month', 'week', 'agenda'];

const getEventColor = (e) => e.color || '#3d8b7a';

export default function CalendarPage() {
  const [view, setView] = useState('month');
  const [current, setCurrent] = useState(new Date());
  const [showModal, setShowModal] = useState(false);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => base44.entities.CalendarEvent.list('start_date'),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['cal-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 200),
  });

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
                  <div
                    key={e.id}
                    className="text-xs px-1 py-0.5 rounded mb-0.5 text-white truncate"
                    style={{ backgroundColor: getEventColor(e) }}
                  >
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
                {dayEvents.map(e => {
                  const timeStr = e.start_date?.includes('T')
                    ? format(parseISO(e.start_date), 'h:mm a')
                    : null;
                  return (
                    <div
                      key={e.id}
                      className="text-xs px-1.5 py-1 rounded mb-1 text-white leading-tight"
                      style={{ backgroundColor: getEventColor(e) }}
                    >
                      {timeStr && <span className="opacity-80">{timeStr} · </span>}
                      {e.title}
                    </div>
                  );
                })}
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
        {upcoming.map(e => {
          const color = getEventColor(e);
          const hasTime = e.start_date?.includes('T');
          return (
            <div key={e.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
              <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{e.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {e.start_date ? format(parseISO(e.start_date.split('T')[0]), 'EEEE, MMM d, yyyy') : ''}
                  {hasTime && (
                    <span> · {format(parseISO(e.start_date), 'h:mm a')}
                      {e.end_date?.includes('T') && ` – ${format(parseISO(e.end_date), 'h:mm a')}`}
                    </span>
                  )}
                </p>
                {e.job_address && <p className="text-xs text-muted-foreground">{e.job_address}</p>}
                {e.assigned_to && <p className="text-xs text-muted-foreground">Assigned: {e.assigned_to}</p>}
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded-full text-white shrink-0 font-medium"
                style={{ backgroundColor: color }}
              >
                {e.status}
              </span>
            </div>
          );
        })}
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
            <Button size="sm" className="h-8 rounded-lg text-xs" onClick={() => setShowModal(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />Add
            </Button>
          </div>
        </div>

        {/* Calendar Views */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          view === 'month' ? renderMonth() :
          view === 'week' ? renderWeek() :
          renderAgenda()
        )}
      </div>

      {/* Event creation modal */}
      <CalendarEventModal
        open={showModal}
        onClose={() => setShowModal(false)}
        jobs={jobs}
      />
    </AppLayout>
  );
}