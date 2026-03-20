import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pencil, Trash2, Archive, CheckCircle2, Clock, ArchiveX,
  Search, Loader2, MapPin, User, Mail, Phone, Lock, History, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import JobEditModal from './JobEditModal';
import JobAuditLog from './JobAuditLog';
import { logAudit } from '@/lib/audit';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  icon: Clock,         class: 'bg-secondary text-secondary-foreground' },
  approved: { label: 'Approved', icon: CheckCircle2,  class: 'bg-primary/10 text-primary' },
  archived: { label: 'Archived', icon: ArchiveX,      class: 'bg-muted text-muted-foreground' },
};

export default function JobsTable({ jobs, isLoading }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingJob, setEditingJob] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['audit'] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Job.update(id, data),
    onSuccess: () => { invalidate(); toast.success('Job updated'); setEditingJob(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Job.delete(id),
    onSuccess: () => { invalidate(); toast.success('Job deleted'); },
  });

  const handleArchive = async (job) => {
    await base44.entities.Job.update(job.id, { status: 'archived' });
    await logAudit(job.id, 'record_archived', 'Admin', `Archived by admin`);
    invalidate();
    toast.success('Job archived');
  };

  const handleStatusChange = async (job, newStatus) => {
    await base44.entities.Job.update(job.id, { status: newStatus });
    await logAudit(job.id, 'status_changed', 'Admin', `Status changed to "${newStatus}"`);
    invalidate();
  };

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase();
    const matchSearch =
      j.address?.toLowerCase().includes(q) ||
      j.customer_name?.toLowerCase().includes(q) ||
      j.buildertrend_id?.toLowerCase().includes(q) ||
      j.email?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-32 rounded-xl text-sm shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-12">
          {search || statusFilter !== 'all' ? 'No jobs match your filters.' : 'No jobs yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map(job => {
            const sc = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
            const StatusIcon = sc.icon;
            const historyOpen = expandedHistory === job.id;

            return (
              <div key={job.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 space-y-2.5">
                  {/* Row 1: address + badges + actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <p className="font-medium text-sm text-foreground leading-snug truncate">{job.address}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {job.locked && (
                        <span title="Signed & Locked">
                          <Lock className="w-3.5 h-3.5 text-primary" />
                        </span>
                      )}
                      <Badge className={`text-xs ${sc.class} border-0`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {sc.label}
                      </Badge>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingJob(job)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {job.status !== 'archived' && (
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-amber-500"
                          onClick={() => handleArchive(job)}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(job.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Row 2: customer + price */}
                  <div className="flex items-center justify-between pl-6">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="w-3.5 h-3.5" />
                      {job.customer_name}
                    </div>
                    <span className="text-sm font-semibold text-primary">
                      ${Number(job.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Row 3: contact / BT */}
                  {(job.email || job.phone || job.buildertrend_id) && (
                    <div className="pl-6 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {job.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{job.email}</span>}
                      {job.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{job.phone}</span>}
                      {job.buildertrend_id && <span className="text-muted-foreground/70">BT# {job.buildertrend_id}</span>}
                    </div>
                  )}

                  {/* Status quick-change + History toggle */}
                  <div className="pl-6 flex items-center justify-between">
                    {job.status !== 'archived' ? (
                      <Select
                        value={job.status}
                        onValueChange={val => handleStatusChange(job, val)}
                      >
                        <SelectTrigger className="h-7 w-36 text-xs rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Set Pending</SelectItem>
                          <SelectItem value="approved">Set Approved</SelectItem>
                          <SelectItem value="archived">Archive</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : <div />}

                    <button
                      onClick={() => setExpandedHistory(historyOpen ? null : job.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                      History
                      {historyOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Audit timeline (collapsible) */}
                {historyOpen && (
                  <div className="border-t border-border bg-muted/30 px-4 py-4">
                    <JobAuditLog jobId={job.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingJob && (
        <JobEditModal
          job={editingJob}
          open={!!editingJob}
          onClose={() => setEditingJob(null)}
          saving={updateMutation.isPending}
          onSave={(data) => updateMutation.mutate({ id: editingJob.id, data })}
        />
      )}
    </div>
  );
}