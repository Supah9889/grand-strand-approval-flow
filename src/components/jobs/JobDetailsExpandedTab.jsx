import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Pencil, Save, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';
import { getInternalRole } from '@/lib/adminAuth';

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground flex-1">{value}</span>
    </div>
  );
}

export default function JobDetailsExpandedTab({ job, isAdmin }) {
  const queryClient = useQueryClient();
  const actorName = getInternalRole();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...job });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveMut = useMutation({
    mutationFn: data => base44.entities.Job.update(job.id, data),
    onSuccess: async () => {
      await logAudit(job.id, 'job_edited', actorName, 'Job details updated from Job Hub');
      queryClient.invalidateQueries({ queryKey: ['job-hub', job.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      setEditing(false);
      toast.success('Job updated');
    },
  });

  if (!editing) {
    return (
      <div className="space-y-3">
        {isAdmin && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg gap-1" onClick={() => { setForm({ ...job }); setEditing(true); }}>
              <Pencil className="w-3.5 h-3.5" /> Edit Details
            </Button>
          </div>
        )}
        <div className="bg-card border border-border rounded-xl px-4 py-2">
          <Field label="Job Title" value={job.title} />
          <Field label="Job Number" value={job.job_number} />
          <Field label="Job Type" value={job.job_type} />
          <Field label="Job Group" value={job.job_group} />
          <Field label="Lifecycle Status" value={job.lifecycle_status} />
          <Field label="Contract Price" value={job.price ? `$${Number(job.price).toLocaleString()}` : null} />
          <Field label="Street Address" value={job.address?.split(',')[0]?.trim() || job.address} />
          <Field label="City" value={job.city} />
          <Field label="State" value={job.state} />
          <Field label="ZIP" value={job.zip} />
          <Field label="Permit Number" value={job.permit_number} />
          <Field label="Lot Info" value={job.lot_info} />
          <Field label="Square Footage" value={job.square_footage ? `${job.square_footage} sq ft` : null} />
          <Field label="Work Days" value={job.work_days} />
          <Field label="Projected Start" value={job.start_date} />
          <Field label="Actual Start" value={job.actual_start_date} />
          <Field label="Projected Completion" value={job.end_date} />
          <Field label="Actual Completion" value={job.actual_end_date} />
          <Field label="Assigned To" value={job.assigned_to} />
          <Field label="Buildertrend ID" value={job.buildertrend_id} />
        </div>

        {isAdmin && job.internal_notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">Internal Notes</p>
            <p className="text-sm text-amber-800">{job.internal_notes}</p>
          </div>
        )}

        {job.description && (
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Description</p>
            <p className="text-sm text-foreground">{job.description}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Edit Job Details</p>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Job Title</Label>
          <Input value={form.title || ''} onChange={e => set('title', e.target.value)} className="h-9 rounded-xl text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Job Type</Label>
          <Input value={form.job_type || ''} onChange={e => set('job_type', e.target.value)} className="h-9 rounded-xl text-sm" placeholder="e.g. Exterior Painting" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Contract Price</Label>
          <Input type="number" value={form.price || ''} onChange={e => set('price', e.target.value)} className="h-9 rounded-xl text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Permit Number</Label>
          <Input value={form.permit_number || ''} onChange={e => set('permit_number', e.target.value)} className="h-9 rounded-xl text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Lot Info</Label>
          <Input value={form.lot_info || ''} onChange={e => set('lot_info', e.target.value)} className="h-9 rounded-xl text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Square Footage</Label>
          <Input type="number" value={form.square_footage || ''} onChange={e => set('square_footage', e.target.value)} className="h-9 rounded-xl text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Work Days</Label>
          <Input value={form.work_days || ''} onChange={e => set('work_days', e.target.value)} className="h-9 rounded-xl text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Projected Start</Label>
          <Input type="date" value={form.start_date || ''} onChange={e => set('start_date', e.target.value)} className="h-9 rounded-xl text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Actual Start</Label>
          <Input type="date" value={form.actual_start_date || ''} onChange={e => set('actual_start_date', e.target.value)} className="h-9 rounded-xl text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Projected Completion</Label>
          <Input type="date" value={form.end_date || ''} onChange={e => set('end_date', e.target.value)} className="h-9 rounded-xl text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Actual Completion</Label>
          <Input type="date" value={form.actual_end_date || ''} onChange={e => set('actual_end_date', e.target.value)} className="h-9 rounded-xl text-sm" />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Internal Notes (admin only)</Label>
        <Textarea value={form.internal_notes || ''} onChange={e => set('internal_notes', e.target.value)} className="rounded-xl text-sm min-h-16" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} className="rounded-xl text-sm min-h-16" />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 h-9 rounded-xl text-sm" onClick={() => setEditing(false)}>Cancel</Button>
        <Button className="flex-1 h-9 rounded-xl text-sm gap-1.5" onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}>
          {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
        </Button>
      </div>
    </div>
  );
}