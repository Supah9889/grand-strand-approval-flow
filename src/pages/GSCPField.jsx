import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Clock, Play, Square, FileText, CheckSquare, Camera,
  Loader2, ChevronRight, AlertTriangle, Building2, Send, X
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { format } from 'date-fns';
import usePermissions from '@/hooks/usePermissions';
import { filterAssignedRecords, AssignedOnlyBanner, SubcontractPendingNotice } from '@/lib/financialGuards.jsx';

const todayISO = new Date().toISOString().split('T')[0];

function getActiveCompany() {
  try { return JSON.parse(sessionStorage.getItem('active_company')); } catch { return null; }
}
function getSessionEmployee() {
  try { return JSON.parse(sessionStorage.getItem('session_employee')); } catch { return null; }
}

// Bottom sheet for adding a note or photo to a subcontract work order
function SubcontractNoteSheet({ wo, employee, onClose, onSaved }) {
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState('field_update');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await base44.entities.SubcontractNote.create({
      work_order_id: wo.id,
      work_order_title: wo.title,
      job_id: wo.job_id,
      job_address: wo.job_address,
      performing_company_id: wo.performing_company_id || wo.company_id,
      performing_company_name: wo.performing_company_name || wo.company_slug,
      origin_company_id: wo.origin_company_id,
      author_id: employee?.id || '',
      author_name: employee?.name || 'Field User',
      note_type: noteType,
      content,
      review_status: 'pending',
      visible_to_origin: false,
    });
    setSaving(false);
    onSaved();
  };

  const NOTE_TYPES = ['field_update','photo','completion','issue','question','general'];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-card rounded-t-2xl p-5 space-y-3 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Add Update — {wo.title}</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          This will go to <strong>{wo.assigned_reviewer_name || 'your reviewer'}</strong> for approval before being visible to {wo.origin_company_name || 'Destination Home'}.
        </p>
        <div>
          <label className="text-xs text-muted-foreground">Type</label>
          <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
            value={noteType} onChange={e => setNoteType(e.target.value)}>
            {NOTE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Note *</label>
          <textarea className="w-full border border-input rounded-xl px-3 py-2 text-sm mt-1 resize-none h-28"
            placeholder="Describe your work, observation, or issue..."
            value={content} onChange={e => setContent(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-input text-sm text-muted-foreground">Cancel</button>
          <button onClick={save} disabled={!content.trim() || saving}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClockModal({ workOrders, activeEntry, onClose, onClockIn, onClockOut }) {
  const [selectedWoId, setSelectedWoId] = useState(activeEntry?.work_order_id || '');
  const [costCode, setCostCode] = useState('Painting Labor/Sub');
  const [saving, setSaving] = useState(false);

  const handle = async () => {
    setSaving(true);
    if (activeEntry) await onClockOut(activeEntry);
    else await onClockIn({ woId: selectedWoId, costCode });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-card rounded-t-2xl p-5 space-y-4">
        <p className="text-sm font-semibold">{activeEntry ? 'Clock Out' : 'Clock In'}</p>
        {!activeEntry && (
          <>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Work Order</label>
              <select value={selectedWoId} onChange={e => setSelectedWoId(e.target.value)}
                className="w-full border border-input rounded-xl px-3 h-10 text-sm bg-card">
                <option value="">Select work order...</option>
                {workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.title} — {wo.job_address}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cost Code</label>
              <select value={costCode} onChange={e => setCostCode(e.target.value)}
                className="w-full border border-input rounded-xl px-3 h-10 text-sm bg-card">
                {['Painting Labor/Sub','Drywall Labor/Sub','Carpentry Labor/Sub','Other Labor/Sub','Paint Expenses'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </>
        )}
        {activeEntry && (
          <p className="text-sm text-muted-foreground">Clocked in to: <span className="font-medium text-foreground">{activeEntry.job_address}</span></p>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-input text-sm font-medium text-muted-foreground">Cancel</button>
          <button onClick={handle} disabled={(!activeEntry && !selectedWoId) || saving}
            className={`flex-1 h-10 rounded-xl text-sm font-semibold disabled:opacity-50 ${activeEntry ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground'}`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : activeEntry ? 'Clock Out' : 'Clock In'}
          </button>
        </div>
      </div>
    </div>
  );
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

export default function GSCPField() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const company = getActiveCompany();
  const employee = getSessionEmployee();
  const { canViewAssignedOnly } = usePermissions();

  const [showClock, setShowClock] = useState(false);
  const [noteWo, setNoteWo] = useState(null);

  // Load work orders assigned to this company (GSCP) — either by performing_company_id or company_id
  const { data: workOrders = [] } = useQuery({
    queryKey: ['gscp-work-orders', company?.id],
    queryFn: async () => {
      const [mine, subcontracts] = await Promise.all([
        company ? base44.entities.WorkOrder.filter({ company_id: company.id }, '-created_date', 100)
                : base44.entities.WorkOrder.list('-created_date', 100),
        company ? base44.entities.WorkOrder.filter({ performing_company_id: company.id }, '-created_date', 100)
                : Promise.resolve([]),
      ]);
      const merged = [...mine];
      subcontracts.forEach(s => { if (!merged.find(m => m.id === s.id)) merged.push(s); });
      return merged.filter(wo => !['approved','cancelled','rejected'].includes(wo.status));
    },
  });

  const { data: activeEntries = [] } = useQuery({
    queryKey: ['gscp-time', employee?.id],
    queryFn: () => employee
      ? base44.entities.TimeEntry.filter({ employee_id: employee.id, status: 'clocked_in' })
      : [],
    enabled: !!employee,
  });
  const activeEntry = activeEntries[0];

  const clockInMutation = useMutation({
    mutationFn: async ({ woId, costCode }) => {
      const wo = workOrders.find(w => w.id === woId);
      return base44.entities.TimeEntry.create({
        company_id: company?.id,
        company_slug: company?.slug,
        employee_id: employee?.id || 'unknown',
        employee_name: employee?.name || 'Field User',
        job_id: wo?.job_id || '',
        job_address: wo?.job_address || '',
        work_order_id: woId,
        work_order_title: wo?.title || '',
        cost_code: costCode,
        clock_in: new Date().toISOString(),
        entry_date: todayISO,
        status: 'clocked_in',
        approval_status: 'pending',
        entry_source: 'employee_clock',
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gscp-time'] }),
  });

  const clockOutMutation = useMutation({
    mutationFn: async (entry) => {
      const now = new Date();
      const mins = Math.round((now - new Date(entry.clock_in)) / 60000);
      return base44.entities.TimeEntry.update(entry.id, {
        clock_out: now.toISOString(),
        status: 'clocked_out',
        duration_minutes: mins,
        total_hours: parseFloat((mins / 60).toFixed(2)),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gscp-time'] }),
  });

  const markCompleteMutation = useMutation({
    mutationFn: (wo) => base44.entities.WorkOrder.update(wo.id, {
      status: 'complete',
      subcontract_status: 'needs_review',
      completed_date: todayISO,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gscp-work-orders'] }),
  });

  const visibleWorkOrders = useMemo(
    () => filterAssignedRecords(workOrders, canViewAssignedOnly),
    [workOrders, canViewAssignedOnly]
  );

  return (
    <AppLayout title="GSCP Field">
      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-4">

        {canViewAssignedOnly && <AssignedOnlyBanner />}

        {/* Company + reviewer context */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 rounded-full" />
          <span className="text-xs font-semibold text-muted-foreground">{company?.name || 'Grand Strand Custom Painting'}</span>
          <button onClick={() => navigate('/company-select')} className="ml-auto text-xs text-primary hover:underline">Switch</button>
        </div>

        {/* Clock card */}
        <div className={`rounded-2xl p-4 flex items-center justify-between shadow-sm border ${activeEntry ? 'bg-emerald-50 border-emerald-200' : 'bg-card border-border'}`}>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Time Clock</p>
            {activeEntry ? (
              <>
                <p className="text-sm font-semibold text-emerald-700">Clocked In</p>
                <p className="text-xs text-muted-foreground">{activeEntry.work_order_title || activeEntry.job_address}</p>
                <p className="text-xs text-muted-foreground">Since {format(new Date(activeEntry.clock_in), 'h:mm a')}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Not clocked in</p>
            )}
          </div>
          <button onClick={() => setShowClock(true)}
            className={`flex items-center gap-2 h-11 px-4 rounded-xl font-semibold text-sm ${activeEntry ? 'bg-red-500 text-white' : 'bg-primary text-primary-foreground'}`}>
            {activeEntry ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {activeEntry ? 'Out' : 'In'}
          </button>
        </div>

        {/* Today's Work Orders */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your Work Orders</h2>
            <button onClick={() => navigate('/work-orders')} className="text-xs text-primary hover:underline">All</button>
          </div>
          {visibleWorkOrders.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No active work orders</p>
          ) : visibleWorkOrders.map(wo => (
            <div key={wo.id} className="bg-card border border-border rounded-xl p-3 mb-2">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{wo.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{wo.job_address}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${SUBCONTRACT_STATUS_STYLES[wo.subcontract_status || wo.status] || 'bg-muted text-muted-foreground'}`}>
                  {(wo.subcontract_status || wo.status)?.replace('_', ' ')}
                </span>
              </div>

              {/* Origin company badge */}
              {wo.is_subcontract && wo.origin_company_name && (
                <p className="text-[11px] text-blue-600 flex items-center gap-1 mb-2">
                  <Building2 className="w-3 h-3" /> From {wo.origin_company_name}
                  {wo.assigned_reviewer_name && ` · Reviewer: ${wo.assigned_reviewer_name}`}
                </p>
              )}

              {wo.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{wo.description}</p>}
              {wo.due_date && <p className="text-xs text-muted-foreground mb-2">Due: {wo.due_date}</p>}
              {wo.subcontract_status === 'needs_review' && <SubcontractPendingNotice />}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setNoteWo(wo)}
                  className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-muted text-xs font-medium text-muted-foreground hover:text-foreground">
                  <FileText className="w-3.5 h-3.5" /> Note
                </button>
                {!['complete','approved','needs_review'].includes(wo.subcontract_status) && (
                  <button onClick={() => markCompleteMutation.mutate(wo)}
                    className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                    <CheckSquare className="w-3.5 h-3.5" /> Mark Complete
                  </button>
                )}
                <button onClick={() => navigate(`/work-orders/${wo.id}`)}
                  className="flex items-center gap-1 h-8 px-2 rounded-lg bg-muted text-xs font-medium text-muted-foreground ml-auto">
                  Details <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </section>

      </div>

      {showClock && (
        <ClockModal
          workOrders={workOrders}
          activeEntry={activeEntry}
          onClose={() => setShowClock(false)}
          onClockIn={({ woId, costCode }) => clockInMutation.mutateAsync({ woId, costCode })}
          onClockOut={(entry) => clockOutMutation.mutateAsync(entry)}
        />
      )}
      {noteWo && (
        <SubcontractNoteSheet
          wo={noteWo}
          employee={employee}
          onClose={() => setNoteWo(null)}
          onSaved={() => { setNoteWo(null); }}
        />
      )}
    </AppLayout>
  );
}