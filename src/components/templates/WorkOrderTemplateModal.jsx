import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';

const SERVICE_LINES = [
  'water_mitigation','mold_mitigation','air_sample_testing','reconstruction',
  'interior_painting','exterior_painting','drywall','insulation','other',
];
const COST_CODES = ['Painting Labor/Sub','Drywall Labor/Sub','Carpentry Labor/Sub','Other Labor/Sub','Paint Expenses'];

export default function WorkOrderTemplateModal({ initial, company, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    name: initial?.name || '',
    title: initial?.title || '',
    service_line: initial?.service_line || '',
    description: initial?.description || '',
    default_scope: initial?.default_scope || '',
    default_cost_code: initial?.default_cost_code || '',
    required_photos: initial?.required_photos || false,
    required_notes: initial?.required_notes || false,
    active: initial?.active !== false,
  });
  const [checklist, setChecklist] = useState(() => {
    try { return JSON.parse(initial?.completion_checklist || '[]'); } catch { return []; }
  });
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.title.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      company_id: company?.id || '',
      company_slug: company?.slug || '',
      completion_checklist: JSON.stringify(checklist),
    };
    let result;
    if (isEdit) {
      result = await base44.entities.WorkOrderTemplate.update(initial.id, payload);
    } else {
      result = await base44.entities.WorkOrderTemplate.create(payload);
    }
    setSaving(false);
    onSaved(result || { ...payload, id: initial?.id || 'new' }, isEdit);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:px-4">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-base">{isEdit ? 'Edit WO Template' : 'New WO Template'}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Template Name *</label>
            <input className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. GSCP Painting WO" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Default WO Title *</label>
            <input className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Interior Painting — Main Floor" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Service Line</label>
              <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={form.service_line} onChange={e => set('service_line', e.target.value)}>
                <option value="">— Select —</option>
                {SERVICE_LINES.map(sl => <option key={sl} value={sl}>{sl.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Default Cost Code</label>
              <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={form.default_cost_code} onChange={e => set('default_cost_code', e.target.value)}>
                <option value="">— Select —</option>
                {COST_CODES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Default Scope of Work</label>
            <textarea className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none h-20"
              value={form.default_scope} onChange={e => set('default_scope', e.target.value)} />
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.required_photos} onChange={e => set('required_photos', e.target.checked)} className="w-4 h-4" />
              Photos required
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.required_notes} onChange={e => set('required_notes', e.target.checked)} className="w-4 h-4" />
              Notes required
            </label>
          </div>

          {/* Completion Checklist */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Completion Checklist</label>
            {checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm">
                <span className="flex-1">{item.item}</span>
                <button onClick={() => setChecklist(checklist.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></button>
              </div>
            ))}
            <div className="flex gap-2">
              <input className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm"
                placeholder="Add checklist item..."
                value={newItem} onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newItem.trim()) { setChecklist(c => [...c, { item: newItem.trim(), completed: false }]); setNewItem(''); } }} />
              <button onClick={() => { if (newItem.trim()) { setChecklist(c => [...c, { item: newItem.trim(), completed: false }]); setNewItem(''); } }}
                className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} className="w-4 h-4" />
            Active
          </label>
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border px-5 py-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving || !form.name.trim() || !form.title.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      </div>
    </div>
  );
}