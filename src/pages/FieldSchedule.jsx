import React, { useState, useMemo } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { format, addDays, subDays } from 'date-fns';
import usePermissions from '@/hooks/usePermissions';
import { filterAssignedRecords, AssignedOnlyBanner } from '@/lib/financialGuards.jsx';

function getActiveCompany() {
  try { return JSON.parse(sessionStorage.getItem('active_company')); } catch { return null; }
}

const EVENT_TYPE_COLORS = {
  inspection: '#6366f1', emergency_call: '#ef4444', production_work: '#3b82f6',
  follow_up: '#f59e0b', estimate_appointment: '#10b981', vendor_appointment: '#8b5cf6',
  air_sample: '#06b6d4', final_walkthrough: '#22c55e',
};
const EVENT_TYPES = ['inspection','emergency_call','production_work','follow_up','estimate_appointment','vendor_appointment','air_sample','final_walkthrough'];
const STATUSES = ['scheduled','confirmed','in_progress','completed','cancelled','rescheduled'];

function EventCard({ event, onClick }) {
  const color = EVENT_TYPE_COLORS[event.event_type] || '#6b7280';
  return (
    <div onClick={() => onClick(event)} className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
      </div>
      <div className="pl-4 space-y-0.5">
        <p className="text-xs text-muted-foreground">{event.event_type?.replace(/_/g, ' ')}</p>
        {event.start_datetime && (
          <p className="text-xs text-muted-foreground">{format(new Date(event.start_datetime), 'h:mm a')}{event.end_datetime ? ` – ${format(new Date(event.end_datetime), 'h:mm a')}` : ''}</p>
        )}
        {event.location && <p className="text-xs text-muted-foreground truncate">{event.location}</p>}
      </div>
    </div>
  );
}

function EventModal({ event, company, jobs, onClose, onSaved }) {
  const isEdit = !!event?.id;
  const [form, setForm] = useState({
    title: '', event_type: 'production_work', start_datetime: '', end_datetime: '',
    location: '', notes: '', status: 'scheduled', job_id: '', all_day: false,
    ...event,
    start_datetime: event?.start_datetime || '',
    end_datetime: event?.end_datetime || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, company_id: company?.id, company_slug: company?.slug };
    if (form.job_id) {
      const job = jobs.find(j => j.id === form.job_id);
      if (job) { payload.job_address = job.address; payload.job_title = job.title || job.address; }
    }
    if (isEdit) { await base44.entities.ScheduleEvent.update(event.id, payload); }
    else { await base44.entities.ScheduleEvent.create(payload); }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{isEdit ? 'Edit Event' : 'New Event'}</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Title *</label>
          <input className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1" value={form.title} onChange={e => set('title', e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Event Type</label>
          <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card" value={form.event_type} onChange={e => set('event_type', e.target.value)}>
            {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Job (optional)</label>
          <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card" value={form.job_id} onChange={e => set('job_id', e.target.value)}>
            <option value="">None</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.address}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Start</label>
            <input type="datetime-local" className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1" value={form.start_datetime?.slice(0, 16)} onChange={e => set('start_datetime', e.target.value + ':00')} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">End</label>
            <input type="datetime-local" className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1" value={form.end_datetime?.slice(0, 16)} onChange={e => set('end_datetime', e.target.value + ':00')} />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Location</label>
          <input className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1" value={form.location} onChange={e => set('location', e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card" value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Notes</label>
          <textarea className="w-full border border-input rounded-xl px-3 py-2 text-sm mt-1 resize-none h-20" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-input text-sm font-medium text-muted-foreground">Cancel</button>
          <button onClick={handleSave} disabled={!form.title || saving} className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FieldSchedule() {
  const qc = useQueryClient();
  const company = getActiveCompany();
  const { canViewAssignedOnly } = usePermissions();
  const [viewDate, setViewDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const dateISO = format(viewDate, 'yyyy-MM-dd');

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ['schedule-events', company?.id, dateISO],
    queryFn: async () => {
      const all = company
        ? await base44.entities.ScheduleEvent.filter({ company_id: company.id }, 'start_datetime', 200)
        : [];
      return all.filter(e => e.start_datetime?.startsWith(dateISO));
    },
    enabled: !!company?.id,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['schedule-jobs', company?.id],
    queryFn: () => company
      ? base44.entities.Job.filter({ company_id: company.id }, '-created_date', 100)
      : Promise.resolve([]),
    enabled: !!company?.id,
  });

  const visibleEvents = useMemo(
    () => filterAssignedRecords(events, canViewAssignedOnly),
    [events, canViewAssignedOnly]
  );

  return (
    <AppLayout title="Schedule">
      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-4">

        {canViewAssignedOnly && <AssignedOnlyBanner />}

        {/* Date nav */}
        <div className="flex items-center justify-between">
          <button onClick={() => setViewDate(d => subDays(d, 1))} className="p-2 rounded-xl hover:bg-muted">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold">{format(viewDate, 'EEEE')}</p>
            <p className="text-xs text-muted-foreground">{format(viewDate, 'MMMM d, yyyy')}</p>
          </div>
          <button onClick={() => setViewDate(d => addDays(d, 1))} className="p-2 rounded-xl hover:bg-muted">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => setViewDate(new Date())} className="text-xs text-primary hover:underline">Today</button>
          <button
            onClick={() => { setEditEvent(null); setShowModal(true); }}
            className="flex items-center gap-1.5 h-8 px-3 bg-primary text-primary-foreground text-xs font-semibold rounded-xl"
          >
            <Plus className="w-3.5 h-3.5" /> Add Event
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : visibleEvents.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No events for this day</div>
        ) : (
          <div className="space-y-2">
            {visibleEvents
              .sort((a, b) => (a.start_datetime || '').localeCompare(b.start_datetime || ''))
              .map(ev => (
                <EventCard key={ev.id} event={ev} onClick={e => { setEditEvent(e); setShowModal(true); }} />
              ))}
          </div>
        )}

      </div>

      {showModal && (
        <EventModal
          event={editEvent}
          company={company}
          jobs={jobs}
          onClose={() => { setShowModal(false); setEditEvent(null); }}
          onSaved={() => { setShowModal(false); setEditEvent(null); refetch(); qc.invalidateQueries({ queryKey: ['schedule-events'] }); }}
        />
      )}
    </AppLayout>
  );
}
