import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Pencil, Save, X, Loader2, AlignLeft } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { audit } from '@/lib/audit';
import { getInternalRole } from '@/lib/adminAuth';

export default function JobSummaryPanel({ job, isAdmin }) {
  const queryClient = useQueryClient();
  const actorName = getInternalRole();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(job.description || '');

  const saveMut = useMutation({
    mutationFn: (desc) => base44.entities.Job.update(job.id, { description: desc }),
    onSuccess: async () => {
      await audit.job.edited(job.id, actorName || 'admin', 'Summary updated', { job_address: job.address });
      queryClient.invalidateQueries({ queryKey: ['job-hub', job.id] });
      setEditing(false);
      toast.success('Summary saved');
    },
  });

  // Derive a summary from available job data if description is empty
  const derivedSummary = (() => {
    const parts = [];
    if (job.job_type) parts.push(job.job_type);
    if (job.lifecycle_status && job.lifecycle_status !== 'open') parts.push(`Status: ${job.lifecycle_status.replace(/_/g, ' ')}`);
    if (job.start_date) parts.push(`Starts ${job.start_date}`);
    if (job.end_date) parts.push(`Due ${job.end_date}`);
    if (job.assigned_to) parts.push(`Assigned to ${job.assigned_to}`);
    return parts.join(' · ');
  })();

  const displayText = job.description || derivedSummary;

  return (
    <div className="bg-card border border-border rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <AlignLeft className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Summary</p>
        </div>
        {isAdmin && !editing && (
          <button
            onClick={() => { setValue(job.description || ''); setEditing(true); }}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2 mt-1">
          <Textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Describe the job scope, status, or next steps..."
            className="rounded-xl text-sm min-h-20 resize-none"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => saveMut.mutate(value)}
              disabled={saveMut.isPending}
              className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className={`text-sm leading-relaxed ${displayText ? 'text-foreground' : 'text-muted-foreground italic'}`}>
          {displayText || 'No summary yet. Tap edit to add one.'}
        </p>
      )}
    </div>
  );
}