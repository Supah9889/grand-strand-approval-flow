import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2 } from 'lucide-react';

const SAMPLE_TYPES = ['indoor_air','outdoor_control','surface_sample','clearance_test'];
const RESULT_STATUSES = ['pending','passed','failed','needs_review'];
const todayISO = new Date().toISOString().split('T')[0];

export default function AirSampleForm({ job, company, employee, rooms, selectedRoom, onClose, onSaved }) {
  const [form, setForm] = useState({
    room_id: selectedRoom?.id || '',
    sample_type: 'indoor_air',
    lab: '',
    sample_date: todayISO,
    result_status: 'pending',
    result_summary: '',
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
    };
    const test = await base44.entities.AirSampleTest.create(payload);

    if (form.nexus_submitted || form.result_status === 'failed') {
      const nexus = await base44.entities.NexusItem.create({
        company_id: company?.id || job?.company_id,
        company_slug: company?.slug || job?.company_slug,
        source_type: 'job_note',
        source_id: test.id,
        title: `Air Sample: ${form.sample_type?.replace(/_/g, ' ')} — ${job?.address}`,
        summary: form.result_status === 'failed'
          ? `Failed air sample (${form.sample_type?.replace(/_/g, ' ')}). ${form.result_summary || ''}`.trim()
          : form.result_summary?.slice(0, 200) || 'Air sample submitted for review',
        raw_content: JSON.stringify(payload),
        category: form.result_status === 'failed' ? 'compliance' : 'job_procedure',
        priority: form.result_status === 'failed' ? 'high' : 'normal',
        status: 'pending_review',
        submitted_by_name: employee?.name || 'Technician',
        linked_job_id: job?.id,
      });
      await base44.entities.AirSampleTest.update(test.id, { nexus_submitted: true, nexus_item_id: nexus.id });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-card rounded-t-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Add Air Sample Test</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Sample Type</label>
            <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
              value={form.sample_type} onChange={e => set('sample_type', e.target.value)}>
              {SAMPLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Room</label>
            <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
              value={form.room_id} onChange={e => set('room_id', e.target.value)}>
              <option value="">General</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Sample Date</label>
            <input type="date" className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1"
              value={form.sample_date} onChange={e => set('sample_date', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Result Status</label>
            <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
              value={form.result_status} onChange={e => set('result_status', e.target.value)}>
              {RESULT_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Lab Name</label>
          <input className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1"
            value={form.lab} onChange={e => set('lab', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Result Summary</label>
          <textarea className="w-full border border-input rounded-xl px-3 py-2 text-sm mt-1 resize-none h-20"
            value={form.result_summary} onChange={e => set('result_summary', e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.nexus_submitted} onChange={e => set('nexus_submitted', e.target.checked)} />
          <span className="text-purple-700 font-medium">Submit to Nexus for review</span>
        </label>
        {form.result_status === 'failed' && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
            Failed samples are automatically submitted to Nexus as <strong>pending_review</strong>.
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-input text-sm text-muted-foreground">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Test'}
          </button>
        </div>
      </div>
    </div>
  );
}