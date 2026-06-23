import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getCurrentCompany } from '@/lib/permissions';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { audit } from '@/lib/audit';
import usePermissions from '@/hooks/usePermissions';
import {
  CheckCircle2, AlertTriangle, Trash2, Edit2, Download, Loader2,
  ChevronDown, ChevronRight, MoreVertical, Check, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const AUTHORIZED_REVIEWERS = ['Nick', 'Doina', 'Brian', 'Jake', 'Nathan', 'Jesus', 'Sean'];

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: AlertTriangle },
  needs_review: { label: 'Needs Review', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: X },
};

export default function ESXDraftWorkOrderQueue() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const company = getCurrentCompany();
  const [selected, setSelected] = useState(new Set());
  const [filter, setFilter] = useState('all'); // all, draft, needs_review, approved, rejected
  const [editTarget, setEditTarget] = useState(null);

  // Permission check
  const isAuthorizedReviewer = AUTHORIZED_REVIEWERS.includes(user?.full_name);

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ['esx-drafts', company?.id],
    queryFn: () => base44.entities.ESXDraftWorkOrder.filter(
      { company_id: company?.id },
      '-created_date',
      500
    ),
    enabled: !!company?.id,
  });

  const filtered = useMemo(() => {
    if (filter === 'all') return drafts;
    return drafts.filter(d => d.review_status === filter);
  }, [drafts, filter]);

  const approveMutation = useMutation({
    mutationFn: async (id) => {
      const draft = drafts.find(d => d.id === id);
      if (!draft) throw new Error('Draft not found');

      // Create operational WorkOrder
      const workOrder = await base44.entities.WorkOrder.create({
        company_id: draft.suggested_company_id || company.id,
        company_slug: company.slug,
        job_id: draft.job_id || 'esx_import',
        title: draft.title,
        description: draft.description,
        scope: draft.description,
        status: 'draft',
        source_esx_import_id: draft.source_import_id,
      });

      // Update draft
      await base44.entities.ESXDraftWorkOrder.update(id, {
        review_status: 'approved',
        approved_by: user?.full_name,
        approved_at: new Date().toISOString(),
        linked_work_order_id: workOrder.id,
      });

      // Audit
      audit.system.settingsChanged(user?.full_name, `ESX draft work order approved: ${draft.title}`, {
        module: 'esx',
        action: 'esx_draft_work_order_approved',
        record_id: id,
      });

      return workOrder;
    },
    onSuccess: () => {
      qc.invalidateQueries(['esx-drafts', company?.id]);
      setSelected(new Set());
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.ESXDraftWorkOrder.update(id, {
        review_status: 'rejected',
      });
      audit.system.settingsChanged(user?.full_name, `ESX draft work order rejected`, {
        module: 'esx',
        action: 'esx_draft_work_order_rejected',
        record_id: id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(['esx-drafts', company?.id]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.ESXDraftWorkOrder.delete(id);
      audit.system.settingsChanged(user?.full_name, `ESX draft work order deleted`, {
        module: 'esx',
        action: 'esx_draft_work_order_deleted',
        record_id: id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(['esx-drafts', company?.id]);
      setSelected(s => {
        s.delete(editTarget?.id);
        return new Set(s);
      });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async () => {
      const toApprove = Array.from(selected);
      for (const id of toApprove) {
        const draft = drafts.find(d => d.id === id);
        if (!draft) continue;
        const wo = await base44.entities.WorkOrder.create({
          company_id: draft.suggested_company_id || company.id,
          company_slug: company.slug,
          job_id: 'esx_import',
          title: draft.title,
          description: draft.description,
          status: 'draft',
          source_esx_import_id: draft.source_import_id,
        });
        await base44.entities.ESXDraftWorkOrder.update(id, {
          review_status: 'approved',
          approved_by: user?.full_name,
          approved_at: new Date().toISOString(),
          linked_work_order_id: wo.id,
        });
      }
      audit.system.settingsChanged(user?.full_name, `ESX bulk approve: ${toApprove.length} drafts`, {
        module: 'esx',
        action: 'esx_bulk_action',
        bulk_action: 'approve',
        count: toApprove.length,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(['esx-drafts', company?.id]);
      setSelected(new Set());
    },
  });

  const toggleSelect = (id) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelected(newSet);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(d => d.id)));
  };

  return (
    <AppLayout title="ESX Draft Work Orders">
      <div className="app-page max-w-6xl space-y-4">

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">ESX Draft Work Order Review Queue</h1>
            <p className="app-page-subtitle">{filtered.length} draft work orders · {isAuthorizedReviewer ? 'Reviewer' : 'View only'}</p>
          </div>
          {!isAuthorizedReviewer && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium">
              Not an authorized reviewer
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'draft', 'needs_review', 'approved', 'rejected'].map(st => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                filter === st
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {st === 'all' ? 'All' : STATUS_CONFIG[st]?.label || st}
            </button>
          ))}
        </div>

        {/* Bulk Actions */}
        {selected.size > 0 && isAuthorizedReviewer && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
            <span className="text-xs font-medium text-blue-700">{selected.size} selected</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkApproveMutation.mutate()}
              disabled={bulkApproveMutation.isPending}
              className="text-green-700 border-green-200 hover:bg-green-50"
            >
              {bulkApproveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Approve Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No draft work orders {filter !== 'all' ? `with status "${filter}"` : ''}.
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header row */}
            {isAuthorizedReviewer && (
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div className="col-span-1 flex items-center">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="w-4 h-4"
                  />
                </div>
                <div className="col-span-4">Title</div>
                <div className="col-span-2">Company</div>
                <div className="col-span-1">Confidence</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Actions</div>
              </div>
            )}

            {filtered.map(draft => {
              const cfg = STATUS_CONFIG[draft.review_status];
              const Icon = cfg.icon;
              return (
                <div
                  key={draft.id}
                  className="bg-card border border-border rounded-xl p-4 space-y-2"
                >
                  <div className="grid grid-cols-12 gap-3 items-start">
                    {isAuthorizedReviewer && (
                      <div className="col-span-1 flex items-center pt-1">
                        <input
                          type="checkbox"
                          checked={selected.has(draft.id)}
                          onChange={() => toggleSelect(draft.id)}
                          className="w-4 h-4"
                        />
                      </div>
                    )}
                    <div className={isAuthorizedReviewer ? 'col-span-4' : 'col-span-5'}>
                      <p className="text-sm font-semibold text-foreground">{draft.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{draft.description}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs font-medium text-foreground">{draft.suggested_company_name || 'Unassigned'}</p>
                      {draft.suggested_subcontractor_name && (
                        <p className="text-[11px] text-muted-foreground">{draft.suggested_subcontractor_name}</p>
                      )}
                    </div>
                    <div className="col-span-1">
                      <div className="flex items-center gap-1">
                        <span className={`text-xs font-bold ${
                          draft.confidence_score >= 70 ? 'text-green-600'
                          : draft.confidence_score >= 40 ? 'text-orange-600'
                          : 'text-red-600'
                        }`}>
                          {draft.confidence_score}%
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    {isAuthorizedReviewer && (
                      <div className="col-span-2 flex items-center gap-1">
                        {draft.review_status === 'draft' || draft.review_status === 'needs_review' ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => approveMutation.mutate(draft.id)}
                              disabled={approveMutation.isPending}
                              className="h-7 px-2 text-green-700"
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => rejectMutation.mutate(draft.id)}
                              disabled={rejectMutation.isPending}
                              className="h-7 px-2 text-red-700"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(draft.id)}
                          disabled={deleteMutation.isPending}
                          className="h-7 px-2 text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {draft.reviewer_notes && (
                    <div className="px-4 py-2 bg-muted/40 rounded-lg border border-border text-xs text-muted-foreground">
                      {draft.reviewer_notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </AppLayout>
  );
}