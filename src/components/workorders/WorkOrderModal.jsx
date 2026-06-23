import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Plus, Trash2, Loader2, Building2 } from 'lucide-react';

const STATUSES = ['draft', 'assigned', 'in_progress', 'waiting', 'complete', 'approved', 'cancelled'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const SUBCONTRACT_STATUSES = ['draft','sent','accepted','in_progress','needs_review','complete','approved','rejected'];
const COST_CODES = ['Painting Labor/Sub', 'Drywall Labor/Sub', 'Carpentry Labor/Sub', 'Other Labor/Sub', 'Paint Expenses'];

export default function WorkOrderModal({ workOrder, company, onClose, onSaved }) {
  const qc = useQueryClient();
  const isEdit = !!workOrder?.id;

  const [form, setForm] = useState({
    title: '', description: '', scope: '', status: 'draft', priority: 'normal',
    cost_code: '', start_date: '', due_date: '', required_photos: false,
    required_notes: false, checklist: '[]',
    job_id: '', job_address: '',
    is_subcontract: false,
    performing_company_id: '', performing_company_name: '', performing_company_slug: '',
    assigned_reviewer_name: '', subcontract_status: 'draft',
    ...workOrder,
  });
  const [checklistItems, setChecklistItems] = useState(() => {
    try { return JSON.parse(workOrder?.checklist || '[]'); } catch { return []; }
  });
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: jobs = [] } = useQuery({
    queryKey: ['modal-jobs', company?.id],
    queryFn: () => company
      ? base44.entities.Job.filter({ company_id: company.id }, '-created_date', 100)
      : base44.entities.Job.list('-created_date', 100),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['all-companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addChecklistItem = () => {
    if (!newItem.trim()) return;
    setChecklistItems(prev => [...prev, { item: newItem.trim(), completed: false }]);
    setNewItem('');
  };

  const removeChecklistItem = (idx) => setChecklistItems(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      ...form,
      company_id: company?.id || form.company_id,
      company_slug: company?.slug || form.company_slug,
      checklist: JSON.stringify(checklistItems),
    };
    // Link job address
    if (form.job_id) {
      const job = jobs.find(j => j.id === form.job_id);
      if (job) { payload.job_address = job.address; payload.job_title = job.title || job.address; }
    }
    // Set origin company fields when subcontract
    if (form.is_subcontract) {
      payload.origin_company_id = company?.id || form.company_id;
      payload.origin_company_name = company?.name || form.company_name;
      payload.origin_company_slug = company?.slug || form.company_slug;
      if (!payload.subcontract_status) payload.subcontract_status = 'draft';
    }
    if (isEdit) {
      await base44.entities.WorkOrder.update(workOrder.id, payload);
    } else {
      await base44.entities.WorkOrder.create(payload);
    }
    qc.invalidateQueries({ queryKey: ['work-orders'] });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{isEdit ? 'Edit Work Order' : 'New Work Order'}</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Title *</label>
            <input className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Job</label>
            <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
              value={form.job_id} onChange={e => set('job_id', e.target.value)}>
              <option value="">Select job...</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.address}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
                value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Priority</label>
              <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
                value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Cost Code</label>
            <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
              value={form.cost_code} onChange={e => set('cost_code', e.target.value)}>
              <option value="">Select...</option>
              {COST_CODES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Start Date</label>
              <input type="date" className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Due Date</label>
              <input type="date" className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <textarea className="w-full border border-input rounded-xl px-3 py-2 text-sm mt-1 resize-none h-20" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Scope of Work</label>
            <textarea className="w-full border border-input rounded-xl px-3 py-2 text-sm mt-1 resize-none h-24" value={form.scope} onChange={e => set('scope', e.target.value)} />
          </div>

          {/* Subcontract toggle */}
          <div className="border border-border rounded-xl p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.is_subcontract} onChange={e => set('is_subcontract', e.target.checked)} />
              <Building2 className="w-4 h-4 text-blue-600" />
              This is a subcontract work order
            </label>
            {form.is_subcontract && (
              <div className="space-y-2 pt-1">
                <div>
                  <label className="text-xs text-muted-foreground">Performing Company</label>
                  <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
                    value={form.performing_company_id}
                    onChange={e => {
                      const c = companies.find(c => c.id === e.target.value);
                      set('performing_company_id', e.target.value);
                      set('performing_company_name', c?.name || '');
                      set('performing_company_slug', c?.slug || '');
                    }}>
                    <option value="">Select company...</option>
                    {companies.filter(c => c.id !== company?.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Assigned Reviewer Name</label>
                  <input className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1"
                    placeholder="e.g. Jesus" value={form.assigned_reviewer_name} onChange={e => set('assigned_reviewer_name', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Subcontract Status</label>
                  <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
                    value={form.subcontract_status} onChange={e => set('subcontract_status', e.target.value)}>
                    {SUBCONTRACT_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Requirements */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.required_photos} onChange={e => set('required_photos', e.target.checked)} />
              Require Photos
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.required_notes} onChange={e => set('required_notes', e.target.checked)} />
              Require Notes
            </label>
          </div>

          {/* Checklist builder */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Completion Checklist</label>
            <div className="space-y-1.5 mb-2">
              {checklistItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm">
                  <span className="flex-1">{item.item}</span>
                  <button onClick={() => removeChecklistItem(idx)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-input rounded-xl px-3 h-9 text-sm"
                placeholder="Add checklist item..."
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addChecklistItem()}
              />
              <button onClick={addChecklistItem} className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-input text-sm font-medium text-muted-foreground">Cancel</button>
          <button onClick={handleSave} disabled={!form.title || saving} className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : isEdit ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}