import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Building2, CheckCircle2, Clock, Eye, Send, Loader2,
  ChevronRight, AlertTriangle
} from 'lucide-react';
import { useCompanyGuard, NoAccessState } from '@/components/CompanyGuard';
import usePermissions from '@/hooks/usePermissions';
import AppLayout from '@/components/AppLayout';
import { format } from 'date-fns';

function getActiveCompany() {
  try { return JSON.parse(sessionStorage.getItem('active_company')); } catch { return null; }
}

const SUBCONTRACT_STATUS_STYLES = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-cyan-100 text-cyan-700',
  needs_review: 'bg-amber-100 text-amber-700',
  complete: 'bg-emerald-100 text-emerald-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

function WOCard({ wo, notes, onOpen }) {
  const woNotes = notes.filter(n => n.work_order_id === wo.id && n.visible_to_origin);
  return (
    <div className={`bg-card border rounded-xl p-3 space-y-2 ${wo.subcontract_status === 'needs_review' ? 'border-amber-200' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{wo.title}</p>
          <p className="text-xs text-muted-foreground truncate">{wo.job_address}</p>
        </div>
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${SUBCONTRACT_STATUS_STYLES[wo.subcontract_status || wo.status]}`}>
          {(wo.subcontract_status || wo.status)?.replace('_', ' ')}
        </span>
      </div>
      {wo.performing_company_name && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Building2 className="w-3 h-3" /> {wo.performing_company_name}
          {wo.assigned_reviewer_name && ` · Reviewed by ${wo.assigned_reviewer_name}`}
        </p>
      )}
      {wo.due_date && <p className="text-xs text-muted-foreground">Due: {wo.due_date}</p>}
      {woNotes.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-2">
          <p className="text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <Eye className="w-3 h-3" /> {woNotes.length} Approved Update{woNotes.length > 1 ? 's'  : ''}
          </p>
          {woNotes.slice(0, 2).map(n => (
            <p key={n.id} className="text-xs text-foreground line-clamp-2 mb-0.5">• {n.content}</p>
          ))}
          {woNotes.length > 2 && <p className="text-xs text-muted-foreground">+{woNotes.length - 2} more</p>}
        </div>
      )}
      <button onClick={() => onOpen(wo)}
        className="w-full h-8 rounded-lg bg-muted text-xs font-medium text-muted-foreground flex items-center justify-center gap-1 hover:text-foreground">
        View Full Detail <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function WODetailSheet({ wo, notes, timeEntries, onClose }) {
  const woNotes = notes.filter(n => n.work_order_id === wo.id && n.visible_to_origin);
  const woTime = timeEntries.filter(t => t.work_order_id === wo.id);
  const totalHours = woTime.reduce((sum, t) => sum + (t.total_hours || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-card rounded-t-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{wo.title}</p>
            <p className="text-xs text-muted-foreground">{wo.job_address}</p>
          </div>
          <button onClick={onClose}><ChevronRight className="w-4 h-4 text-muted-foreground rotate-90" /></button>
        </div>

        {/* Time Summary */}
        <div className="bg-muted/30 rounded-xl p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Time Logged</p>
          <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
          <p className="text-xs text-muted-foreground">{woTime.length} punch{woTime.length !== 1 ? 'es' : ''} recorded</p>
          {woTime.slice(0, 5).map(t => (
            <div key={t.id} className="flex items-center justify-between text-xs mt-1.5 text-muted-foreground">
              <span>{t.employee_name}</span>
              <span>{t.total_hours?.toFixed(1)}h — {t.entry_date}</span>
            </div>
          ))}
        </div>

        {/* Approved Notes */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> Approved Updates ({woNotes.length})
          </p>
          {woNotes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No approved updates yet</p>
          ) : woNotes.map(n => (
            <div key={n.id} className="border border-border rounded-xl p-3 mb-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-muted-foreground capitalize">{n.note_type?.replace('_', ' ')}</p>
                <p className="text-[11px] text-muted-foreground">{n.author_name}</p>
              </div>
              <p className="text-sm text-foreground">{n.content}</p>
              {n.reviewed_at && <p className="text-[11px] text-muted-foreground mt-1">Reviewed {format(new Date(n.reviewed_at), 'MMM d, h:mm a')} by {n.reviewed_by}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SubcontractVisibility() {
  const navigate = useNavigate();
  const company = getActiveCompany();
  const { canViewSubcontractOrigin } = usePermissions();
  const companyGuard = useCompanyGuard('Select a company to view subcontracts.');
  const [selectedWo, setSelectedWo] = useState(null);
  const [filter, setFilter] = useState('all');

  // Load subcontract WOs where THIS company is the origin (e.g. Destination Home)
  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['origin-subcontracts', company?.id],
    queryFn: () => company
      ? base44.entities.WorkOrder.filter({ origin_company_id: company.id, is_subcontract: true }, '-created_date', 200)
      : base44.entities.WorkOrder.filter({ is_subcontract: true }, '-created_date', 200),
  });

  // Load notes that are visible to origin company
  const { data: notes = [] } = useQuery({
    queryKey: ['subcontract-notes-visible', company?.id],
    queryFn: () => company
      ? base44.entities.SubcontractNote.filter({ origin_company_id: company.id, visible_to_origin: true }, '-created_date', 500)
      : base44.entities.SubcontractNote.filter({ visible_to_origin: true }, '-created_date', 500),
  });

  // Load time entries for these work orders
  const { data: timeEntries = [] } = useQuery({
    queryKey: ['subcontract-time', company?.id],
    queryFn: async () => {
      const woIds = workOrders.map(wo => wo.id);
      if (!woIds.length) return [];
      // Fetch time entries for each WO — batched
      const results = await Promise.all(woIds.slice(0, 20).map(id =>
        base44.entities.TimeEntry.filter({ work_order_id: id })
      ));
      return results.flat();
    },
    enabled: workOrders.length > 0,
  });

  const filtered = filter === 'all' ? workOrders
    : filter === 'active' ? workOrders.filter(wo => ['in_progress','needs_review','accepted','sent'].includes(wo.subcontract_status))
    : workOrders.filter(wo => ['complete','approved'].includes(wo.subcontract_status));

  const activeCount = workOrders.filter(wo => ['in_progress','needs_review','accepted'].includes(wo.subcontract_status)).length;
  const needsReviewCount = workOrders.filter(wo => wo.subcontract_status === 'needs_review').length;

  if (companyGuard) return <AppLayout title="Subcontracts">{companyGuard}</AppLayout>;
  if (!canViewSubcontractOrigin) return (
    <AppLayout title="Subcontracts">
      <NoAccessState message="You do not have permission to view subcontract records for this company." />
    </AppLayout>
  );

  return (
    <AppLayout title="Subcontracts">
      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-4">
        <div>
          <h1 className="text-base font-semibold">Subcontract Work</h1>
          <p className="text-xs text-muted-foreground">GSCP work orders originated from {company?.name}</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className={`border rounded-xl p-3 text-center ${needsReviewCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card border-border'}`}>
            <p className={`text-2xl font-bold ${needsReviewCount > 0 ? 'text-amber-700' : ''}`}>{needsReviewCount}</p>
            <p className="text-xs text-muted-foreground">Needs Review</p>
          </div>
        </div>

        <div className="flex gap-1.5">
          {['all','active','complete'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`h-7 px-3 rounded-full text-xs font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            <Building2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            <p>No subcontract work orders yet</p>
            <p className="text-xs mt-1">Create a work order and mark it as a subcontract to get started</p>
          </div>
        ) : filtered.map(wo => (
          <WOCard key={wo.id} wo={wo} notes={notes} onOpen={setSelectedWo} />
        ))}
      </div>

      {selectedWo && (
        <WODetailSheet
          wo={selectedWo}
          notes={notes}
          timeEntries={timeEntries}
          onClose={() => setSelectedWo(null)}
        />
      )}
    </AppLayout>
  );
}