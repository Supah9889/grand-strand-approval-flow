import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';

const SERVICE_LINES = [
  'water_mitigation','mold_mitigation','air_sample_testing','reconstruction',
  'interior_painting','exterior_painting','drywall','insulation','other',
];
const REQ_TYPES = ['photo','note','moisture_reading','drying_log','air_sample','equipment_assignment','customer_signature','manager_review'];
const STATUSES = ['complete','closed','invoiced','in_progress'];

export default function DocRequirementModal({ initial, company, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    title: initial?.title || '',
    requirement_type: initial?.requirement_type || 'photo',
    service_line: initial?.service_line || '',
    job_type: initial?.job_type || '',
    description: initial?.description || '',
    required_for_status: initial?.required_for_status || '',
    applies_to_room: initial?.applies_to_room || false,
    applies_to_work_order: initial?.applies_to_work_order || false,
    active: initial?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = { ...form, company_id: company?.id || '', company_slug: company?.slug || '' };
    let result;
    if (isEdit) {
      result = await base44.entities.DocumentationRequirement.update(initial.id, payload);
    } else {
      result = await base44.entities.DocumentationRequirement.create(payload);
    }
    setSaving(false);
    onSaved(result || { ...payload, id: initial?.id || 'new' }, isEdit);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:px-4">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-base">{isEdit ? 'Edit Requirement' : 'New Requirement'}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title *</label>
            <input className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Initial Condition Photos" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Requirement Type</label>
              <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={form.requirement_type} onChange={e => set('requirement_type', e.target.value)}>
                {REQ_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Service Line</label>
              <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={form.service_line} onChange={e => set('service_line', e.target.value)}>
                <option value="">— All —</option>
                {SERVICE_LINES.map(sl => <option key={sl} value={sl}>{sl.replace(/_/g,' ')}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Required Before Status</label>
              <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={form.required_for_status} onChange={e => set('required_for_status', e.target.value)}>
                <option value="">— Not enforced —</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job Type (optional)</label>
              <input className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={form.job_type} onChange={e => set('job_type', e.target.value)} placeholder="e.g. insurance" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
            <textarea className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none h-16"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.applies_to_room} onChange={e => set('applies_to_room', e.target.checked)} className="w-4 h-4" />
              Applies per room
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.applies_to_work_order} onChange={e => set('applies_to_work_order', e.target.checked)} className="w-4 h-4" />
              Applies to work orders
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} className="w-4 h-4" />
            Active
          </label>
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border px-5 py-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving || !form.title.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save Changes' : 'Create Requirement'}
          </Button>
        </div>
      </div>
    </div>
  );
}