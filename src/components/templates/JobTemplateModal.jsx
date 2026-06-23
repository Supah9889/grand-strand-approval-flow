import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';

const SERVICE_LINES = [
  'water_mitigation','mold_mitigation','air_sample_testing','reconstruction',
  'interior_painting','exterior_painting','drywall','insulation','other',
];

const REQ_TYPES = ['photo','note','moisture_reading','drying_log','air_sample','equipment_assignment','customer_signature','manager_review'];

export default function JobTemplateModal({ initial, company, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    name: initial?.name || '',
    service_line: initial?.service_line || '',
    description: initial?.description || '',
    default_priority: initial?.default_priority || 'normal',
    active: initial?.active !== false,
  });
  const [docs, setDocs] = useState(() => {
    try { return JSON.parse(initial?.required_documentation || '[]'); } catch { return []; }
  });
  const [newDoc, setNewDoc] = useState({ label: '', requirement_type: 'photo', description: '' });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addDoc = () => {
    if (!newDoc.label.trim()) return;
    setDocs(d => [...d, { ...newDoc }]);
    setNewDoc({ label: '', requirement_type: 'photo', description: '' });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      company_id: company?.id || '',
      company_slug: company?.slug || '',
      required_documentation: JSON.stringify(docs),
    };
    let result;
    if (isEdit) {
      result = await base44.entities.JobTemplate.update(initial.id, payload);
    } else {
      result = await base44.entities.JobTemplate.create(payload);
    }
    setSaving(false);
    onSaved(result || { ...payload, id: initial?.id || 'new' }, isEdit);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:px-4">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-base">{isEdit ? 'Edit Job Template' : 'New Job Template'}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Template Name *</label>
            <input className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Water Mitigation Standard" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Service Line</label>
              <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={form.service_line} onChange={e => set('service_line', e.target.value)}>
                <option value="">— Select —</option>
                {SERVICE_LINES.map(sl => <option key={sl} value={sl}>{sl.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Default Priority</label>
              <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={form.default_priority} onChange={e => set('default_priority', e.target.value)}>
                {['low','normal','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
            <textarea className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none h-16"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          {/* Required Documentation */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Required Documentation</label>
            {docs.map((d, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-xs">
                <span className="flex-1 font-medium">{d.label}</span>
                <span className="text-muted-foreground">{d.requirement_type?.replace('_',' ')}</span>
                <button onClick={() => setDocs(docs.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></button>
              </div>
            ))}
            <div className="border border-border rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input className="col-span-2 h-9 rounded-lg border border-input bg-background px-3 text-sm"
                  placeholder="Label (e.g. Initial Photos)"
                  value={newDoc.label} onChange={e => setNewDoc(d => ({ ...d, label: e.target.value }))} />
                <select className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                  value={newDoc.requirement_type} onChange={e => setNewDoc(d => ({ ...d, requirement_type: e.target.value }))}>
                  {REQ_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                </select>
                <button onClick={addDoc} disabled={!newDoc.label.trim()}
                  className="h-9 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} className="w-4 h-4" />
            Active
          </label>
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border px-5 py-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      </div>
    </div>
  );
}