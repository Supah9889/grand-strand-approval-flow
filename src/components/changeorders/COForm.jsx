import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { CO_CATEGORY_LABELS, generateCONumber, calcCOTotal } from '@/lib/changeOrderHelpers';
import { getInternalRole } from '@/lib/adminAuth';

const EMPTY = (jobId, jobAddress, jobTitle, customerName, existingNums) => ({
  co_number: generateCONumber(existingNums),
  job_id: jobId || '',
  job_address: jobAddress || '',
  job_title: jobTitle || '',
  customer_name: customerName || '',
  title: '',
  description: '',
  reason: '',
  category: 'additional_work',
  scope_summary: '',
  internal_notes: '',
  client_facing_notes: '',
  status: 'draft',
  cost_impact: 0,
  tax_impact: 0,
  total_financial_impact: 0,
  time_impact_value: 0,
  time_impact_unit: 'days',
  schedule_notes: '',
  signature_required: false,
  assigned_to: '',
  files: '[]',
});

export default function COForm({ jobId, jobAddress, jobTitle, customerName, existingNums = [], jobs = [], onSave, onCancel }) {
  const role = getInternalRole();
  const [form, setForm] = useState(EMPTY(jobId, jobAddress, jobTitle, customerName, existingNums));
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    if (k === 'cost_impact' || k === 'tax_impact') {
      next.total_financial_impact = calcCOTotal(k === 'cost_impact' ? v : next.cost_impact, k === 'tax_impact' ? v : next.tax_impact);
    }
    return next;
  });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingFiles(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push({ url: file_url, name: file.name });
    }
    setAttachedFiles(p => [...p, ...urls]);
    setUploadingFiles(false);
  };

  const handleSave = async () => {
    if (!form.title) { toast.error('Title is required'); return; }
    if (!form.job_id) { toast.error('Job is required'); return; }
    setSaving(true);
    const selectedJob = !jobId ? jobs.find(j => j.id === form.job_id) : null;
    await onSave({
      ...form,
      job_address: selectedJob?.address || form.job_address,
      job_title: selectedJob?.title || form.job_title,
      customer_name: selectedJob?.customer_name || form.customer_name,
      created_by_name: role || 'Admin',
      files: JSON.stringify(attachedFiles.map(f => f.url)),
    });
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Identity */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">CO Number</label>
          <Input value={form.co_number} onChange={e => set('co_number', e.target.value)} className="h-9 rounded-lg text-sm font-mono" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
          <Select value={form.category} onValueChange={v => set('category', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(CO_CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {!jobId && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Linked Job *</label>
          <Select value={form.job_id} onValueChange={v => set('job_id', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select job" /></SelectTrigger>
            <SelectContent>{jobs.filter(j => j.status !== 'archived').map(j => <SelectItem key={j.id} value={j.id}>{j.address || j.title}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
        <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Brief title of this change" className="h-9 rounded-lg text-sm" />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Description of Change</label>
        <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="What is changing and why..." className="rounded-lg text-sm min-h-20" />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Reason for Change</label>
        <Input value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="Root cause or requestor" className="h-9 rounded-lg text-sm" />
      </div>

      {/* Financial Impact */}
      <div className="border border-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financial Impact</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Cost Impact ($)</label>
            <Input type="number" step="0.01" value={form.cost_impact} onChange={e => set('cost_impact', parseFloat(e.target.value) || 0)} className="h-9 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tax ($)</label>
            <Input type="number" step="0.01" value={form.tax_impact} onChange={e => set('tax_impact', parseFloat(e.target.value) || 0)} className="h-9 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Total Impact</label>
            <div className="h-9 flex items-center px-3 bg-muted/60 rounded-lg text-sm font-bold text-primary">
              ${Number(form.total_financial_impact).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Time Impact */}
      <div className="border border-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Schedule / Time Impact</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Time Impact</label>
            <Input type="number" step="0.5" value={form.time_impact_value} onChange={e => set('time_impact_value', parseFloat(e.target.value) || 0)} className="h-9 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Unit</label>
            <Select value={form.time_impact_unit} onValueChange={v => set('time_impact_unit', v)}>
              <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
                <SelectItem value="weeks">Weeks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Schedule Notes</label>
          <Input value={form.schedule_notes} onChange={e => set('schedule_notes', e.target.value)} placeholder="Explain schedule adjustment..." className="h-9 rounded-lg text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Assigned To</label>
          <Input value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['draft','in_review','sent','approved','rejected'].map(s => (
                <SelectItem key={s} value={s}>{s.replace('_',' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Internal Notes</label>
        <Textarea value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)} className="rounded-lg text-sm min-h-14" />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Client-Facing Notes</label>
        <Textarea value={form.client_facing_notes} onChange={e => set('client_facing_notes', e.target.value)} placeholder="What can the client see?" className="rounded-lg text-sm min-h-14" />
      </div>

      {/* File attachments */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">Attachments / Photos</label>
        {attachedFiles.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {attachedFiles.map(f => (
              <div key={f.url} className="flex items-center gap-2 text-xs bg-muted/60 rounded-lg px-3 py-1.5">
                <span className="flex-1 truncate">{f.name}</span>
                <button onClick={() => setAttachedFiles(p => p.filter(x => x.url !== f.url))}><X className="w-3 h-3 text-muted-foreground" /></button>
              </div>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-border rounded-xl px-4 py-2.5 hover:border-primary/40 transition-colors">
          {uploadingFiles ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm text-muted-foreground">{uploadingFiles ? 'Uploading...' : 'Attach files or photos'}</span>
          <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={uploadingFiles} />
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1 h-10 rounded-xl" onClick={handleSave} disabled={saving || uploadingFiles}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Change Order'}
        </Button>
      </div>
    </div>
  );
}