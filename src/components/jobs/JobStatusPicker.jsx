import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { OP_STATUS_GROUPS, getOpStatusConfig } from '@/lib/jobHelpers';
import { getInternalRole, isAdmin as checkAdmin } from '@/lib/adminAuth';
import { audit } from '@/lib/audit';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, X, ChevronDown } from 'lucide-react';
import JobStatusBadge from './JobStatusBadge';

/**
 * Inline status picker for the JobHub header.
 * Shows current status as a badge. On click, opens a compact grouped picker.
 * Optionally collects a short status note.
 */
export default function JobStatusPicker({ job, queryKey }) {
  const queryClient = useQueryClient();
  const actorName = getInternalRole();
  const isAdmin = checkAdmin();
  const [open, setOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [statusNote, setStatusNote] = useState('');

  const currentStatus = job.op_status || 'new';

  const saveMut = useMutation({
    mutationFn: async (newStatus) => {
      const now = new Date().toISOString();
      await base44.entities.Job.update(job.id, {
        op_status: newStatus,
        op_status_updated_at: now,
        op_status_updated_by: actorName || 'admin',
        op_status_note: statusNote.trim() || null,
      });
      // Log to timeline via JobNote for traceability
      const oldCfg = getOpStatusConfig(currentStatus);
      const newCfg = getOpStatusConfig(newStatus);
      const noteContent = statusNote.trim()
        ? `Status changed: ${oldCfg.label} → ${newCfg.label}\n${statusNote.trim()}`
        : `Status changed: ${oldCfg.label} → ${newCfg.label}`;
      await base44.entities.JobNote.create({
        job_id: job.id,
        job_address: job.address,
        job_title: job.title || job.address,
        content: noteContent,
        note_type: 'internal_update',
        author_role: isAdmin ? 'admin' : 'staff',
        author_name: actorName || null,
        read: false,
      });
      // Legacy audit log
      await audit.job.statusChanged(job.id, actorName || 'admin', job.address, currentStatus, newStatus, { job_address: job.address });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey || ['job-hub', job.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['hub-tl-notes', job.id] });
      setOpen(false);
      setPendingStatus(null);
      setStatusNote('');
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const handleSelect = (statusKey) => {
    if (statusKey === currentStatus) { setOpen(false); return; }
    setPendingStatus(statusKey);
  };

  const handleConfirm = () => {
    if (!pendingStatus) return;
    saveMut.mutate(pendingStatus);
  };

  if (!open) {
    return (
      <button
        onClick={() => isAdmin ? setOpen(true) : undefined}
        className={`flex items-center gap-1 transition-opacity ${isAdmin ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
        title={isAdmin ? 'Change status' : undefined}
      >
        <JobStatusBadge status={currentStatus} size="sm" />
        {isAdmin && <ChevronDown className="w-3 h-3 text-muted-foreground" />}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => { setOpen(false); setPendingStatus(null); setStatusNote(''); }} />
      <div className="relative z-10 w-full max-w-sm bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl p-4 space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Change Status</p>
            <p className="text-xs text-muted-foreground truncate">{job.address}</p>
          </div>
          <button onClick={() => { setOpen(false); setPendingStatus(null); setStatusNote(''); }}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Grouped status options */}
        {!pendingStatus ? (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {OP_STATUS_GROUPS.map(group => (
              <div key={group.key}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.statuses.map(s => {
                    const cfg = getOpStatusConfig(s);
                    const isCurrent = s === currentStatus;
                    return (
                      <button
                        key={s}
                        onClick={() => handleSelect(s)}
                        className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-xl transition-colors
                          ${isCurrent
                            ? `${cfg.color} ring-2 ring-offset-1 ring-current opacity-100`
                            : `${cfg.color} opacity-70 hover:opacity-100`}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                        {isCurrent && <span className="text-[9px] ml-0.5 opacity-60">current</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Confirm step with optional note
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
              <JobStatusBadge status={currentStatus} />
              <span className="text-xs text-muted-foreground">→</span>
              <JobStatusBadge status={pendingStatus} />
            </div>
            <Textarea
              value={statusNote}
              onChange={e => setStatusNote(e.target.value)}
              placeholder="Optional: add a short note about this status change..."
              className="rounded-xl text-sm min-h-14 resize-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={saveMut.isPending}
                className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saveMut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm
              </button>
              <button
                onClick={() => setPendingStatus(null)}
                className="text-sm text-muted-foreground px-4 py-2 rounded-xl hover:bg-muted transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}