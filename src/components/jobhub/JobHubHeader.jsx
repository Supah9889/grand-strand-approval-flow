import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, MapPin, Lock, Pencil, StickyNote, Calendar,
  FileUp, FileText, DollarSign, ShieldCheck, ChevronDown, ChevronUp, Save, X, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import JobLifecycleBadge from '../jobs/JobLifecycleBadge';
import JobGroupBadge from '../jobs/JobGroupBadge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { audit } from '@/lib/audit';
import { getInternalRole } from '@/lib/adminAuth';

const LIFECYCLE_OPTIONS = [
  { value: 'presale', label: 'Presale' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'completed', label: 'Completed' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'on_hold', label: 'On Hold' },
];

export default function JobHubHeader({ job, isAdmin, onAddNote, onAddSchedule, onUploadFile }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const actorName = getInternalRole();
  const [showActions, setShowActions] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  const statusMut = useMutation({
    mutationFn: (newStatus) => base44.entities.Job.update(job.id, { lifecycle_status: newStatus }),
    onSuccess: async (_, newStatus) => {
      await audit.job.statusChanged(job.id, actorName || 'admin', job.address, job.lifecycle_status, newStatus, { job_address: job.address });
      queryClient.invalidateQueries({ queryKey: ['job-hub', job.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      setChangingStatus(false);
      toast.success('Status updated');
    },
  });

  const quickActions = [
    { icon: StickyNote, label: 'Add Note', color: 'text-amber-600', action: onAddNote },
    { icon: Calendar, label: 'Add Schedule', color: 'text-blue-600', action: onAddSchedule },
    { icon: FileUp, label: 'Upload File', color: 'text-violet-600', action: onUploadFile },
    { icon: FileText, label: 'View / Sign', color: 'text-primary', action: () => navigate(`/approve?jobId=${job.id}`) },
    ...(isAdmin ? [
      { icon: DollarSign, label: 'Invoices', color: 'text-green-600', action: () => navigate('/invoices') },
      { icon: ShieldCheck, label: 'Warranty', color: 'text-indigo-600', action: () => navigate(`/warranty`) },
    ] : []),
  ];

  return (
    <div className="space-y-2">
      {/* Back nav */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      {/* Main header card */}
      <div
        className="bg-card border border-border rounded-2xl overflow-hidden"
        style={job.color ? { borderLeftColor: job.color, borderLeftWidth: 4 } : {}}
      >
        {/* Top row: address + price */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-base font-bold text-foreground leading-snug">{job.address}</p>
                  {job.title && job.title !== job.address && (
                    <p className="text-xs text-muted-foreground mt-0.5">{job.title}</p>
                  )}
                </div>
              </div>
              {/* Badges row */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap pl-6">
                {job.lifecycle_status && <JobLifecycleBadge status={job.lifecycle_status} />}
                {job.job_group && <JobGroupBadge group={job.job_group} />}
                {job.locked && (
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                )}
                {job.job_number && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    #{job.job_number}
                  </span>
                )}
              </div>
            </div>
            {/* Price + last updated */}
            <div className="text-right shrink-0">
              <p className="text-xl font-black text-primary">${Number(job.price || 0).toLocaleString()}</p>
              {job.updated_date && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Updated {format(new Date(job.updated_date), 'MMM d')}
                </p>
              )}
            </div>
          </div>

          {/* Customer */}
          {job.customer_name && (
            <p className="text-xs text-muted-foreground mt-2 pl-6">{job.customer_name}
              {(job.customer_phone || job.phone) && (
                <span className="ml-2 text-primary">· {job.customer_phone || job.phone}</span>
              )}
            </p>
          )}
        </div>

        {/* Quick action strip */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {quickActions.map(({ icon: Icon, label, color, action }) => (
            <button
              key={label}
              onClick={action}
              className="flex items-center gap-1 shrink-0 text-[11px] font-medium bg-muted hover:bg-accent rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-foreground/80">{label}</span>
            </button>
          ))}

          {/* Status change (admin only) */}
          {isAdmin && (
            <div className="ml-auto shrink-0">
              {changingStatus ? (
                <div className="flex items-center gap-1">
                  <Select
                    value={job.lifecycle_status}
                    onValueChange={(v) => statusMut.mutate(v)}
                  >
                    <SelectTrigger className="h-7 text-xs rounded-lg w-36 border-primary/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIFECYCLE_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button onClick={() => setChangingStatus(false)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setChangingStatus(true)}
                  className="flex items-center gap-1 text-[11px] font-medium bg-primary/10 text-primary rounded-lg px-2.5 py-1.5 hover:bg-primary/20 transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Status
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}