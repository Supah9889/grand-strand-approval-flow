import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2 } from 'lucide-react';

const ROOM_TYPES = ['kitchen','bathroom','bedroom','living_room','hallway','garage','crawlspace','attic','utility_room','other'];
const STATUSES = ['active','drying','clear','complete'];

export default function RoomForm({ job, company, employee, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', room_type: 'other', floor_area: '', status: 'active', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await base44.entities.Room.create({
      ...form,
      company_id: company?.id || job?.company_id,
      company_slug: company?.slug || job?.company_slug,
      job_id: job?.id,
      job_address: job?.address,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-card rounded-t-2xl p-5 space-y-3 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Add Room</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Room Name *</label>
          <input className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1"
            placeholder="e.g. Master Bathroom" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Room Type</label>
            <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
              value={form.room_type} onChange={e => set('room_type', e.target.value)}>
              {ROOM_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
              value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Floor / Area</label>
          <input className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1"
            placeholder="e.g. Main Floor, Basement" value={form.floor_area} onChange={e => set('floor_area', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Notes</label>
          <textarea className="w-full border border-input rounded-xl px-3 py-2 text-sm mt-1 resize-none h-20"
            value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-input text-sm text-muted-foreground">Cancel</button>
          <button onClick={save} disabled={!form.name.trim() || saving}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Room'}
          </button>
        </div>
      </div>
    </div>
  );
}