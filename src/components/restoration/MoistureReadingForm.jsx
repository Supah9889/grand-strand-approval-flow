import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2 } from 'lucide-react';

const MATERIALS = ['drywall','stud','subfloor','flooring','trim','cabinet','ceiling','concrete','other'];
const READING_TYPES = ['pin','pinless','relative','thermal'];

export default function MoistureReadingForm({ job, company, employee, rooms, selectedRoom, onClose, onSaved }) {
  const [form, setForm] = useState({
    room_id: selectedRoom?.id || '',
    room_name: selectedRoom?.name || '',
    material: 'drywall',
    reading_value: '',
    reading_type: 'pin',
    equipment_used: '',
    notes: '',
    is_dry: false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.reading_value) return;
    setSaving(true);
    const room = rooms.find(r => r.id === form.room_id);
    await base44.entities.MoistureReading.create({
      ...form,
      reading_value: parseFloat(form.reading_value),
      room_name: room?.name || form.room_name,
      company_id: company?.id || job?.company_id,
      company_slug: company?.slug || job?.company_slug,
      job_id: job?.id,
      job_address: job?.address,
      taken_by: employee?.name || 'Technician',
      taken_at: new Date().toISOString(),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-card rounded-t-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Add Moisture Reading</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Room</label>
          <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
            value={form.room_id} onChange={e => set('room_id', e.target.value)}>
            <option value="">None / General</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Material</label>
            <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
              value={form.material} onChange={e => set('material', e.target.value)}>
              {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Reading Type</label>
            <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
              value={form.reading_type} onChange={e => set('reading_type', e.target.value)}>
              {READING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Reading Value (%) *</label>
          <input type="number" step="0.1" className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1"
            placeholder="e.g. 18.5" value={form.reading_value} onChange={e => set('reading_value', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Equipment Used</label>
          <input className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1"
            placeholder="e.g. Delmhorst BD-2100" value={form.equipment_used} onChange={e => set('equipment_used', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Notes</label>
          <textarea className="w-full border border-input rounded-xl px-3 py-2 text-sm mt-1 resize-none h-16"
            value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_dry} onChange={e => set('is_dry', e.target.checked)} />
          Mark as dry / within normal range
        </label>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-input text-sm text-muted-foreground">Cancel</button>
          <button onClick={save} disabled={!form.reading_value || saving}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Reading'}
          </button>
        </div>
      </div>
    </div>
  );
}