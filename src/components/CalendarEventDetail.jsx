import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { X, MapPin, CalendarDays, Clock, User, Loader2, StickyNote, Pencil, Trash2, AlertTriangle, Check, Clock3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { getInternalRole } from '@/lib/adminAuth';
import { EVENT_TYPE_CONFIG, EVENT_STATUS_CONFIG, BLOCK_PRESETS, getEventColor, formatEventTime } from '@/lib/calendarHelpers';
import { logAudit } from '@/lib/audit';

const VISIBILITY_OPTIONS = [
  { value: 'internal', label: 'Internal Only' },
  { value: 'client',   label: 'Client Visible' },
  { value: 'vendor',   label: 'Vendor Visible' },
  { value: 'both',     label: 'Both' },
];

function extractDate(isoString) {
  if (!isoString) return '';
  return isoString.split('T')[0];
}
function extractTime(isoString) {
  if (!isoString || !isoString.includes('T')) return '';
  return isoString.split('T')[1]?.slice(0, 5) || '';
}

export default function CalendarEventDetail({ event, job, open, onClose }) {
  const [mode, setMode] = useState('view'); // 'view' | 'edit' | 'delete'
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [hourlyMode, setHourlyMode] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const isAdmin = role === 'admin';

  // Sync form when event changes
  useEffect(() => {
    if (event) {
      setForm({
        title:          event.title || '',
        event_type:     event.event_type || 'job_visit',
        status:         event.status || 'scheduled',
        visibility:     event.visibility || 'internal',
        start_date:     extractDate(event.start_date),
        start_time:     extractTime(event.start_date),
        end_time:       extractTime(event.end_date),
        assigned_to:    event.assigned_to || '',
        notes:          event.notes || '',
        internal_notes: event.internal_notes || '',
      });
      setHourlyMode(!!(event.start_date && event.start_date.includes('T')));
      setSelectedPreset(null);
    }
    setMode('view');
    setNote('');
  }, [event]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      let startDate = data.start_date;
      if (data.start_time) startDate = `${data.start_date}T${data.start_time}`;
      let endDate = data.start_date;
      if (data.end_time) endDate = `${data.start_date}T${data.end_time}`;

      const payload = {
        title:          data.title,
        event_type:     data.event_type,
        status:         data.status,
        visibility:     data.visibility,
        start_date:     startDate,
        end_date:       endDate || startDate,
        assigned_to:    data.assigned_to,
        notes:          data.notes,
        internal_notes: data.internal_notes,
        all_day:        !data.start_time,
      };

      await base44.entities.CalendarEvent.update(event.id, payload);

      // Audit log
      const changes = [];
      if (data.title !== event.title) changes.push(`title: "${event.title}" → "${data.title}"`);
      if (data.status !== event.status) changes.push(`status: ${event.status} → ${data.status}`);
      if (data.assigned_to !== (event.assigned_to || '')) changes.push(`assigned: "${event.assigned_to}" → "${data.assigned_to}"`);
      if (startDate !== event.start_date) changes.push(`date changed`);
      if (data.visibility !== event.visibility) changes.push(`visibility: ${event.visibility} → ${data.visibility}`);

      await logAudit({
        module: 'job',
        record_id: event.id,
        job_id: event.job_id,
        job_address: event.job_address,
        action: 'record_edited',
        actor: role || 'admin',
        actor_role: role || 'admin',
        detail: `Calendar event edited: "${data.title}"${changes.length ? ` — ${changes.join(', ')}` : ''}`,
        old_value: JSON.stringify({ title: event.title, status: event.status, start_date: event.start_date }),
        new_value: JSON.stringify({ title: data.title, status: data.status, start_date: startDate }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Event updated');
      setMode('view');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.CalendarEvent.delete(event.id);
      await logAudit({
        module: 'job',
        record_id: event.id,
        job_id: event.job_id,
        job_address: event.job_address,
        action: 'record_deleted',
        actor: role || 'admin',
        actor_role: role || 'admin',
        detail: `Calendar event deleted: "${event.title}" (${event.start_date ? extractDate(event.start_date) : 'no date'})`,
        old_value: JSON.stringify({ title: event.title, start_date: event.start_date, job_address: event.job_address }),
        is_sensitive: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Event removed from calendar');
      onClose();
    },
  });

  const saveNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    await base44.entities.JobNote.create({
      job_id: event.job_id || '',
      job_address: event.job_address || '',
      job_title: job?.title || job?.address || '',
      event_id: event.id,
      event_title: event.title,
      content: note.trim(),
      author_role: role || 'staff',
      read: false,
    });
    queryClient.invalidateQueries({ queryKey: ['job-notes'] });
    toast.success('Note saved');
    setNote('');
    setSaving(false);
  };

  if (!event) return null;

  const color = getEventColor(event);
  const startTime = formatEventTime(event.start_date);
  const endTime = formatEventTime(event.end_date);
  const typeCfg = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.other;
  const stCfg = EVENT_STATUS_CONFIG[event.status] || EVENT_STATUS_CONFIG.scheduled;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="ced-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={mode === 'view' ? onClose : undefined} />
          <motion.div key="ced-panel" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto overflow-y-auto max-h-[92vh]">

              {/* Color bar */}
              <div className="h-1.5 rounded-t-2xl" style={{ backgroundColor: color }} />

              {/* Header */}
              <div className="flex items-start justify-between px-5 pt-4 pb-3">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm">{typeCfg.icon}</span>
                    <span className="text-xs text-muted-foreground">{typeCfg.label}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${stCfg.color}`}>{stCfg.label}</span>
                    {event.visibility && event.visibility !== 'internal' && (
                      <span className="text-xs text-muted-foreground">{VISIBILITY_OPTIONS.find(v => v.value === event.visibility)?.label}</span>
                    )}
                  </div>
                  <p className="text-base font-semibold text-foreground leading-snug">{event.title}</p>
                  {(job?.title || job?.address) && <p className="text-xs font-medium mt-0.5" style={{ color }}>{job?.title || job?.address}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isAdmin && mode === 'view' && (
                    <>
                      <button onClick={() => setMode('edit')} title="Edit event"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setMode('delete')} title="Delete event"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  {mode !== 'view' && (
                    <button onClick={() => setMode('view')} title="Cancel"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors text-xs font-medium">
                      ✕
                    </button>
                  )}
                  <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted shrink-0 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ── VIEW MODE ── */}
              {mode === 'view' && (
                <div className="px-5 pb-5 space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5">
                      <CalendarDays className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground">{event.start_date ? format(parseISO(event.start_date.split('T')[0]), 'EEEE, MMMM d, yyyy') : '—'}</p>
                    </div>
                    {(startTime || endTime) && (
                      <div className="flex items-start gap-2.5">
                        <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-sm text-foreground">{startTime}{endTime ? ` – ${endTime}` : ''}</p>
                      </div>
                    )}
                    {event.job_address && (
                      <div className="flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-sm text-foreground">{event.job_address}</p>
                      </div>
                    )}
                    {event.assigned_to && (
                      <div className="flex items-start gap-2.5">
                        <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-sm text-foreground">{event.assigned_to}</p>
                      </div>
                    )}
                  </div>

                  {event.notes && (
                    <div className="bg-muted/50 rounded-xl px-3 py-2.5">
                      <p className="text-xs text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm text-foreground">{event.notes}</p>
                    </div>
                  )}
                  {isAdmin && event.internal_notes && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      <p className="text-xs text-amber-700 font-medium mb-1">Internal Notes</p>
                      <p className="text-sm text-amber-800">{event.internal_notes}</p>
                    </div>
                  )}

                  {/* Quick status update (admin) */}
                  {isAdmin && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Quick Status Update</p>
                      <Select value={event.status} onValueChange={v => {
                        base44.entities.CalendarEvent.update(event.id, { status: v })
                          .then(() => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }));
                      }}>
                        <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(EVENT_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Add note */}
                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5 text-muted-foreground" /><p className="text-xs font-medium text-muted-foreground">Add a Note</p></div>
                    <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Type a note..." rows={2}
                      className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                    <button onClick={saveNote} disabled={!note.trim() || saving}
                      className="w-full h-9 bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Note'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── EDIT MODE ── */}
              {mode === 'edit' && (
                <div className="px-5 pb-5 space-y-3">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">Edit Event</p>

                  {/* Linked job display (read-only) */}
                  {event.job_address && (
                    <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <p className="text-xs text-muted-foreground truncate">{event.job_address}</p>
                    </div>
                  )}

                  <Input placeholder="Event Title *" value={form.title} onChange={e => set('title', e.target.value)} className="h-10 rounded-xl text-sm" autoFocus />

                  <Select value={form.event_type} onValueChange={v => set('event_type', v)}>
                    <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(EVENT_TYPE_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.icon} {c.label}</SelectItem>)}</SelectContent>
                  </Select>

                  <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="h-10 rounded-xl text-sm" />

                  {/* Time toggle */}
                  <div className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-2"><Clock3 className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">Exact times</span></div>
                    <button type="button" onClick={() => { setHourlyMode(v => !v); setSelectedPreset(null); }}
                      className={`w-9 h-5 rounded-full transition-colors relative ${hourlyMode ? 'bg-primary' : 'bg-muted'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hourlyMode ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                  </div>

                  {!hourlyMode && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {BLOCK_PRESETS.map((preset, idx) => (
                        <button key={idx} type="button" onClick={() => { setSelectedPreset(idx); set('start_time', preset.start); set('end_time', preset.end); }}
                          className={`text-xs px-2 py-2 rounded-lg border transition-colors text-center ${selectedPreset === idx ? 'border-primary bg-secondary text-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {hourlyMode && (
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-xs text-muted-foreground mb-1">Start</p><Input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className="h-10 rounded-xl text-sm" /></div>
                      <div><p className="text-xs text-muted-foreground mb-1">End</p><Input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} className="h-10 rounded-xl text-sm" /></div>
                    </div>
                  )}

                  <Input placeholder="Assigned Staff" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} className="h-10 rounded-xl text-sm" />

                  <div className="grid grid-cols-2 gap-2">
                    <Select value={form.status} onValueChange={v => set('status', v)}>
                      <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(EVENT_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={form.visibility} onValueChange={v => set('visibility', v)}>
                      <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{VISIBILITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  <Textarea placeholder="Notes (visible if shared)" value={form.notes} onChange={e => set('notes', e.target.value)} className="rounded-xl text-sm min-h-10" />
                  <Textarea placeholder="Internal notes (never shared)" value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)} className="rounded-xl text-sm min-h-10" />

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setMode('view')} className="flex-1 h-10 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
                    <button
                      disabled={!form.title || !form.start_date || updateMutation.isPending}
                      onClick={() => updateMutation.mutate(form)}
                      className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                    >
                      {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" />Save Changes</>}
                    </button>
                  </div>
                </div>
              )}

              {/* ── DELETE CONFIRMATION ── */}
              {mode === 'delete' && (
                <div className="px-5 pb-5 space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 text-center space-y-2">
                    <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
                    <p className="text-sm font-semibold text-red-700">Remove this event?</p>
                    <p className="text-xs text-red-600 leading-relaxed">
                      <strong>"{event.title}"</strong> will be permanently removed from the calendar.
                      {event.start_date && ` Scheduled for ${format(parseISO(event.start_date.split('T')[0]), 'MMMM d, yyyy')}.`}
                      {' '}This action cannot be undone.
                    </p>
                    {event.job_address && (
                      <p className="text-xs text-muted-foreground">Linked to: {event.job_address}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setMode('view')} className="flex-1 h-10 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                      Keep Event
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                      className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5" />Delete Event</>}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}