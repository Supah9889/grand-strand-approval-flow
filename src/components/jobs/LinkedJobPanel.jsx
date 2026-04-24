/**
 * LinkedJobPanel — compact job context card shown inside expense/invoice/estimate/time entry views.
 * Pass job_id and optionally a pre-loaded job object.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MapPin, User, DollarSign, ExternalLink, Loader2 } from 'lucide-react';
import JobLifecycleBadge from './JobLifecycleBadge';

export default function LinkedJobPanel({ jobId, job: jobProp }) {
  const navigate = useNavigate();

  const { data: fetchedJob, isLoading } = useQuery({
    queryKey: ['linked-job', jobId],
    queryFn: async () => { const r = await base44.entities.Job.filter({ id: jobId }); return r[0]; },
    enabled: !!jobId && !jobProp,
  });

  const job = jobProp || fetchedJob;

  if (!jobId) return null;
  if (isLoading) return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-2">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Loading job…</span>
    </div>
  );
  if (!job) return null;

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/40 transition-colors"
      onClick={() => navigate(`/job-hub?jobId=${job.id}`)}
      style={job.color ? { borderLeftColor: job.color, borderLeftWidth: 3 } : {}}
    >
      <div className="px-4 py-2 bg-muted/20 border-b border-border flex items-center justify-between">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Linked Job</p>
        <ExternalLink className="w-3 h-3 text-muted-foreground" />
      </div>
      <div className="px-4 py-3 space-y-1.5">
        <div className="flex items-start gap-2">
          <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-sm font-semibold text-foreground leading-snug">{job.address}</p>
        </div>
        {job.customer_name && (
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">{job.customer_name}</p>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          {job.lifecycle_status && <JobLifecycleBadge status={job.lifecycle_status} />}
          {job.price != null && (
            <span className="flex items-center gap-1 text-xs font-semibold text-primary">
              <DollarSign className="w-3 h-3" />{Number(job.price).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}