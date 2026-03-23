import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ArrowLeft, Loader2, Save, Clock, User, MapPin, AlertTriangle, History } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { getInternalRole } from '@/lib/adminAuth';
import { formatDuration } from './TimeEntries';
import { toast } from 'sonner';
import LinkedJobPanel from '@/components/jobs/LinkedJobPanel';
import { validateTimeEntry } from '@/lib/validation';
import ValidationPanel from '@/components/shared/ValidationPanel';
import { validateTimeEntry } from '@/lib/validation';
import ValidationPanel from '@/components/shared/ValidationPanel';

const COST_CODES = ['Carpentry Labor/Sub','Drywall Labor/Sub','Other Labor/Sub','Paint Expenses','Painting Labor/Sub'];

function toLocalDatetimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TimeEntryDetail() {
  const entryId = window.location.pathname.split('/').pop();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const isAdmin = role === 'admin';

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [validationTouched, setValidationTouched] = useState(false);

  const { data: entry, isLoading } = useQuery({
    queryKey: ['time-entry', entryId],
    queryFn: async () => { const r = await base44.entities.TimeEntry.filter({ id: entryId }); return r[0]; },
    enabled: !!entryId,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 200),
    enabled: isAdmin,
  });

  useEffect(() => {
    if (entry && !form) setForm({ ...entry });
  }, [entry]);

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const history = (() => { try { return JSON.parse(entry.edit_history || '[]'); } catch { return []; } })();
      const newHistory = [...history, {
        timestamp: new Date().toISOString(),
        by: role || 'admin',
        reason: data.edit_reason || '',
        changes: `clock_in: ${entry.clock_in} → ${data.clock_in}, clock_out: ${entry.clock_out} → ${data.clock_out}, cost_code: ${entry.cost_code} → ${data.cost_code}`,
      }];
      // Recalculate duration
      let duration_minutes = data.duration_minutes;
      if (data.clock_in && data.clock_out) {
        duration_minutes = Math.round((new Date(data.clock_out) - new Date(data.clock_in)) / 60000);
      }
      return base44.entities.TimeEntry.update(entryId, {
        ...data,
        duration_minutes,
        manual_adjustment: true,
        status: 'edited',
        last_updated_by: role || 'admin',
        edit_history: JSON.stringify(newHistory),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entry', entryId] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      setEditing(false);
      toast.success('Entry updated');
    },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await updateMutation.mutateAsync(form);
    setSaving(false);
  };

  const editHistory = (() => { try { return JSON.parse(entry?.edit_history || '[]'); } catch { return []; } })();

  if (isLoading || !form) {
    return <AppLayout title="Time Entry"><div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div></AppLayout>;
  }

  if (!entry) {
    return (
      <AppLayout title="Time Entry">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-muted-foreground">Entry not found.</p>
          <Button variant="outline" onClick={() => navigate('/time-entries')} className="rounded-xl"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        </div>
      </AppLayout>
    );
  }

  const mins = entry.clock_in && entry.clock_out
    ? Math.round((new Date(entry.clock_out) - new Date(entry.clock_in)) / 60000)
    : entry.duration_minutes;

  return (
    <AppLayout title="Time Entry">
      <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-4">

        <button onClick={() => navigate('/time-entries')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Time Entries
        </button>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  entry.status === 'clocked_in' ? 'bg-primary/10 text-primary' :
                  entry.status === 'edited' ? 'bg-blue-100 text-blue-700' :
                  entry.status === 'needs_review' ? 'bg-amber-100 text-amber-700' :
                  'bg-muted text-muted-foreground'
                }`}>{entry.status}</span>
                {entry.manual_adjustment && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-medium">
                    <AlertTriangle className="w-3 h-3" /> Manually Edited
                  </span>
                )}
              </div>
              <p className="text-base font-bold text-foreground">{entry.employee_name}</p>
              <p className="text-xs text-muted-foreground">#{entry.employee_code}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-black text-primary">{formatDuration(mins)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{entry.clock_in ? format(parseISO(entry.clock_in), 'EEE, MMM d, yyyy') : '—'}</p>
            </div>
          </div>

          {!editing && (
            <div className="space-y-2 pt-1 border-t border-border">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-foreground">{entry.job_address || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-foreground">
                  {entry.clock_in ? format(parseISO(entry.clock_in), 'h:mm a') : '—'}
                  {entry.clock_out ? ` → ${format(parseISO(entry.clock_out), 'h:mm a')}` : ' → Active'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{entry.cost_code}</p>
              {(entry.employee_note || entry.note) && (
                <p className="text-xs text-muted-foreground italic border-t border-border pt-2">{entry.employee_note || entry.note}</p>
              )}
              {isAdmin && entry.admin_note && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-medium text-amber-800">Admin Note</p>
                  <p className="text-xs text-amber-700">{entry.admin_note}</p>
                </div>
              )}
            </div>
          )}

          {isAdmin && !editing && (
            <Button variant="outline" size="sm" className="w-full rounded-xl h-8 text-xs" onClick={() => setEditing(true)}>Edit Entry</Button>
          )}
        </motion.div>

        {/* Edit form (admin only) */}
        {isAdmin && editing && (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edit Entry</p>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Linked Job</label>
              <Select value={form.job_id} onValueChange={v => {
                const j = jobs.find(j => j.id === v);
                set('job_id', v);
                set('job_address', j?.address || '');
              }}>
                <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cost Code</label>
              <Select value={form.cost_code} onValueChange={v => set('cost_code', v)}>
                <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{COST_CODES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Clock In</label>
                <Input type="datetime-local" value={toLocalDatetimeInput(form.clock_in)} onChange={e => set('clock_in', new Date(e.target.value).toISOString())} className="h-9 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Clock Out</label>
                <Input type="datetime-local" value={toLocalDatetimeInput(form.clock_out)} onChange={e => set('clock_out', new Date(e.target.value).toISOString())} className="h-9 rounded-lg text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Reason for Edit *</label>
              <Input value={form.edit_reason || ''} onChange={e => set('edit_reason', e.target.value)} placeholder="Brief reason for this correction..." className="h-9 rounded-lg text-sm" />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Admin Note</label>
              <Textarea value={form.admin_note || ''} onChange={e => set('admin_note', e.target.value)} className="rounded-lg text-sm min-h-12" />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 rounded-xl" onClick={() => { setEditing(false); setForm({ ...entry }); }}>Cancel</Button>
              <Button className="flex-1 h-9 rounded-xl gap-2" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
              </Button>
            </div>
          </div>
        )}

        {/* Linked Job */}
        {isAdmin && entry.job_id && <LinkedJobPanel jobId={entry.job_id} />}

        {/* Edit history (admin only) */}
        {isAdmin && editHistory.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Edit History</p>
            <div className="space-y-3">
              {editHistory.map((h, i) => (
                <div key={i} className="text-xs border-l-2 border-primary/20 pl-3">
                  <p className="font-medium text-foreground">{h.by} · {h.timestamp ? format(parseISO(h.timestamp), 'MMM d, yyyy h:mm a') : '—'}</p>
                  {h.reason && <p className="text-muted-foreground italic">{h.reason}</p>}
                  {h.changes && <p className="text-muted-foreground mt-0.5">{h.changes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Created / updated metadata (admin) */}
        {isAdmin && (
          <div className="text-xs text-muted-foreground space-y-0.5 px-1">
            {entry.created_by_name && <p>Created by: {entry.created_by_name}</p>}
            {entry.last_updated_by && <p>Last updated by: {entry.last_updated_by}</p>}
            {entry.entry_source && <p>Source: {entry.entry_source}</p>}
          </div>
        )}
      </div>
    </AppLayout>
  );
}