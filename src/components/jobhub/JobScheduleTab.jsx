import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, Plus, Loader2, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { getInternalRole } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';

const STATUS_STYLES = {
  scheduled:   'bg-blue-50 text-blue-700 border-blue-200',
  confirmed:   'bg-primary/10 text-primary border-primary/20',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  completed:   'bg-green-50 text-green-700 border-green-200',
  canceled:    'bg-muted text-muted-foreground border-border',
  rescheduled: 'bg-orange-50 text-orange-700 border-orange-200',
  waiting:     'bg-yellow-50 text-yellow-700 border-yellow-200',
};

const EVENT_TYPE_OPTIONS = [
  { value: 'job_visit', label: 'Job Visit' },
  { value: 'work_block', label: 'Work Block' },
  { value: 'estimate_appointment', label: 'Estimate Appt' },
  { value: 'warranty_appointment', label: 'Warranty Appt' },
  { value: 'follow_up', label: 'Follow-Up' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'other', label: 'Other' },
];

function EventCard({ event, onClick }) {
  const statusStyle = STATUS_STYLES[event.status] || 'bg-muted text-muted-foreground border-border';
  const dateStr = event.start_date ? (() => {
    try { return format(parseISO(event.start_date.length > 10 ? event.start_date : event.start_date + 'T00:00:00'), event.all_day ? 'EEE, MMM d' : 'EEE, MMM d · h:mm a'); }
    catch { return event.start_date; }
  })() : 'No date';
  const endStr = !event.all_day && event.end_date ? (() => {
    try { return format(parseISO(event.end_date), '– h:mm a'); } catch { return ''; }
  })() : '';

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-xl p-3 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">{event.title}</p>
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3 shrink-0" />
            <span>{dateStr} {endStr}</span>
          </div>
          {event.assigned_to && (
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <User className="w-3 h-3 shrink-0" />
              <span>{event.assigned_to}</span>
            </div>
          )}
          {event.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">{event.notes}</p>}
          {event.created_by_name && (
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">Added by {event.created_by_name}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${statusStyle}`}>
            {event.status?.replace(/_/g, ' ') || 'scheduled'}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
        </div>
      </div>
    </button>
  );
}

export default function JobScheduleTab({ job, isAdmin, defaultShowAdd = false }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const actorName = getInternalRole();
  const [showAdd, setShowAdd] = useState(defaultShowAdd);
  const [form, setForm] = useState({
    title: '',
    event_type: 'job_visit',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    assigned_to: '',
    notes: '',
    all_day: true,
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['hub-schedule', job.id],
    queryFn: () => base44.entities.CalendarEvent.filter({ job_id: job.id }, '-start_date'),
    enabled: !!job.id,
  });

  const createMut = useMutation({
    mutationFn: async (data) => {
      const rec = await base44.entities.CalendarEvent.create({
        ...data,
        job_id: job.id,
        job_address: job.address,
        job_title: job.title || job.address,
        created_by_name: actorName || 'admin',
        status: 'scheduled',
      });
      // Light audit trail — fire-and-forget
      logAudit(rec.id, 'record_created', actorName || 'admin',
        `${actorName || 'Admin'} added schedule item: "${data.title}" on ${job.address}.`,
        { module: 'system', record_id: rec.id, job_id: job.id, job_address: job.address });
      return rec;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hub-schedule', job.id] });
      queryClient.invalidateQueries({ queryKey: ['hub-tl-schedule', job.id] });
      setShowAdd(false);
      setForm({ title: '', event_type: 'job_visit', start_date: '', start_time: '', end_date: '', end_time: '', assigned_to: '', notes: '', all_day: true });
      toast.success('Schedule item added');
    },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.title || !form.start_date) { toast.error('Title and start date are required'); return; }
    const startISO = form.all_day ? form.start_date : `${form.start_date}T${form.start_time || '08:00'}`;
    const endISO = form.end_date
      ? (form.all_day ? form.end_date : `${form.end_date}T${form.end_time || '17:00'}`)
      : startISO;
    createMut.mutate({ title: form.title, event_type: form.event_type, start_date: startISO, end_date: endISO, all_day: form.all_day, assigned_to: form.assigned_to, notes: form.notes });
  };

  if (isLoading) return (
    <div className="flex justify-center py-10"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
  );

  return (
    <div className="space-y-3">
      {/* Add button */}
      {isAdmin && !showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-1.5 h-10 border border-dashed border-primary/30 text-primary text-sm rounded-xl hover:border-primary/60 hover:bg-primary/5 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Schedule Item
        </button>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-secondary/30 border border-border rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">New Schedule Item</p>
          <div className="space-y-1">
            <Label className="text-xs">Title *</Label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} className="h-9 rounded-xl text-sm" placeholder="e.g. Job visit, estimate appt..." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={form.event_type} onValueChange={v => set('event_type', v)}>
                <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{EVENT_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Assigned To</Label>
              <Input value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} className="h-9 rounded-xl text-xs" placeholder="Name or team..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Start Date *</Label>
              <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="h-9 rounded-xl text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="h-9 rounded-xl text-sm" />
            </div>
          </div>
          {/* All-day toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => set('all_day', !form.all_day)}
              className={`w-8 h-4 rounded-full transition-colors relative ${form.all_day ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${form.all_day ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
            <span className="text-xs text-muted-foreground">All day</span>
          </div>
          {!form.all_day && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Start Time</Label>
                <Input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className="h-9 rounded-xl text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End Time</Label>
                <Input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} className="h-9 rounded-xl text-sm" />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="rounded-xl text-sm min-h-14 resize-none" placeholder="Optional notes..." />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={createMut.isPending}
              className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60">
              {createMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />} Save
            </button>
            <button onClick={() => setShowAdd(false)} className="text-xs text-muted-foreground px-4 py-2 rounded-xl hover:bg-muted transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Events list */}
      {events.length === 0 && !showAdd ? (
        <div className="text-center py-10">
          <Calendar className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No schedule items yet</p>
          {isAdmin && <p className="text-xs text-muted-foreground mt-1">Add one above or from the Calendar page</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(ev => (
            <EventCard key={ev.id} event={ev} onClick={() => navigate('/calendar')} />
          ))}
        </div>
      )}
    </div>
  );
}