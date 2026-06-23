import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2 } from 'lucide-react';

const todayISO = new Date().toISOString().split('T')[0];

export default function DryingLogForm({ job, company, employee, rooms, selectedRoom, onClose, onSaved }) {
  const [form, setForm] = useState({
    room_id: selectedRoom?.id || '',
    log_date: todayISO,
    temperature: '',
    relative_humidity: '',
    gpp: '',
    equipment_running: '',
    moisture_notes: '',
    nexus_submitted: false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const room = rooms.find(r => r.id === form.room_id);
    const payload = {
      ...form,
      room_name: room?.name || '',
      company_id: company?.id || job?.company_id,
      company_slug: company?.slug || job?.company_slug,
      job_id: job?.id,
      job_address: job?.address,
      technician: employee?.name || 'Technician',
      temperature: form.temperature ? parseFloat(form.temperature) : undefined,
      relative_humidity: form.relative_humidity ? parseFloat(form.relative_humidity) : undefined,
      gpp: form.gpp ? parseFloat(form.gpp) : undefined,
    };
    const log = await base44.entities.DryingLog.create(payload);

    if (form.nexus_submitted) {
      const nexus = await base44.entities.NexusItem.create({
        company_id: company?.id || job?.company_id,
        company_slug: company?.slug || job?.company_slug,
        source_type: 'job_note',
        source_id: log.id,
        title: `Drying Log Observation: ${job?.address} — ${form.log_date}`,
        summary: form.moisture_notes?.slice(0, 200) || 'Drying log observation flagged for review',
        raw_content: JSON.stringify(payload),
        category: 'job_procedure',
        priority: 'normal',
        status: 'pending_review',
        submitted_by_name: employee?.name || 'Technician',
        linked_job_id: job?.id,
      });
      await base44.entities.DryingLog.update(log.id, { nexus_item_id: nexus.id });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-card rounded-t-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Add Drying Log</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Date</label>
            <input type="date" className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1"
              value={form.log_date} onChange={e => set('log_date', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Room</label>
            <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
              value={form.room_id} onChange={e => set('room_id', e.target.value)}>
              <option value="">General / All</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Temp (°F)</label>
            <input type="number" className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1"
              value={form.temperature} onChange={e => set('temperature', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">RH (%)</label>
            <input type="number" className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1"
              value={form.relative_humidity} onChange={e => set('relative_humidity', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">GPP</label>
            <input type="number" className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1"
              value={form.gpp} onChange={e => set('gpp', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Equipment Running</label>
          <input className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1"
            placeholder="e.g. 2x Dri-Eaz LGR, 3x Air Movers" value={form.equipment_running} onChange={e => set('equipment_running', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Moisture Notes</label>
          <textarea className="w-full border border-input rounded-xl px-3 py-2 text-sm mt-1 resize-none h-20"
            placeholder="Observations, drying progress, concerns..." value={form.moisture_notes} onChange={e => set('moisture_notes', e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.nexus_submitted} onChange={e => set('nexus_submitted', e.target.checked)} />
          <span className="text-purple-700 font-medium">Submit observation to Nexus for review</span>
        </label>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-input text-sm text-muted-foreground">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Log'}
          </button>
        </div>
      </div>
    </div>
  );
}