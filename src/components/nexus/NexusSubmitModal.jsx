import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Loader2, Brain } from 'lucide-react';

const CATEGORIES = [
  { value: 'customer_insight', label: 'Customer Insight' },
  { value: 'job_procedure', label: 'Job Procedure' },
  { value: 'cost_data', label: 'Cost Data' },
  { value: 'vendor_performance', label: 'Vendor Performance' },
  { value: 'safety', label: 'Safety' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'process_improvement', label: 'Process Improvement' },
  { value: 'other', label: 'Other' },
];

export default function NexusSubmitModal({ company, session, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: '',
    summary: '',
    raw_content: '',
    category: 'other',
    priority: 'normal',
    source_type: 'manual',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.summary.trim()) {
      setError('Title and summary are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await base44.entities.NexusItem.create({
        ...form,
        company_id: company?.id || '',
        company_slug: company?.slug || '',
        submitted_by_id: session?.employee?.id || '',
        submitted_by_name: session?.employee?.name || session?.name || 'Unknown',
        status: 'pending_review',
      });
      onSaved();
    } catch (e) {
      setError(e.message || 'Submit failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-xl flex flex-col max-h-[92dvh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">Submit to Nexus</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            Items submitted here go to the Nexus Verification Inbox. They become company knowledge only after human approval.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Title *</label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Short descriptive title" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={form.category}
                onChange={e => set('category', e.target.value)}
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <select
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={form.priority}
                onChange={e => set('priority', e.target.value)}
              >
                {['low','normal','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Summary *</label>
            <textarea
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
              value={form.summary}
              onChange={e => set('summary', e.target.value)}
              placeholder="Concise summary of what was observed or learned"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Full Details (optional)</label>
            <textarea
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
              value={form.raw_content}
              onChange={e => set('raw_content', e.target.value)}
              placeholder="Any additional context, observations, or raw notes"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit to Nexus'}
          </Button>
        </div>
      </div>
    </div>
  );
}