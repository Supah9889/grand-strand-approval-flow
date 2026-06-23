import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft, CheckSquare, Square, FileText, Send,
  Edit2, Loader2, AlertTriangle
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import WorkOrderModal from '@/components/workorders/WorkOrderModal';
import usePermissions from '@/hooks/usePermissions';
import { canViewWorkOrder, NoAccessRecord } from '@/lib/financialGuards.jsx';
import { getSessionEmployee, getSession } from '@/lib/adminAuth';
import { audit } from '@/lib/audit';
import { toast } from 'sonner';

function getActiveCompany() {
  try { return JSON.parse(sessionStorage.getItem('active_company')); } catch { return null; }
}

const STATUS_STYLES = {
  draft: 'bg-muted text-muted-foreground', assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700', waiting: 'bg-yellow-100 text-yellow-700',
  complete: 'bg-emerald-100 text-emerald-700', approved: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function WorkOrderDetail() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const company = getActiveCompany();
  const employee = getSessionEmployee();
  const { canViewAssignedOnly } = usePermissions();
  const { id } = useParams();

  const [showEdit, setShowEdit] = useState(false);
  const [nexusNote, setNexusNote] = useState('');
  const [showNexus, setShowNexus] = useState(false);

  const { data: wo, isLoading, refetch } = useQuery({
    queryKey: ['work-order', id],
    queryFn: () => base44.entities.WorkOrder.get(id),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.WorkOrder.update(id, data),
    onSuccess: () => refetch(),
  });

  const toggleChecklist = async (idx) => {
    const checklist = JSON.parse(wo.checklist || '[]');
    checklist[idx] = {
      ...checklist[idx],
      completed: !checklist[idx].completed,
      completed_by: employee?.name || 'Field User',
      completed_at: new Date().toISOString(),
    };
    await updateMutation.mutateAsync({ checklist: JSON.stringify(checklist) });
  };

  const actor = employee?.name || getSession()?.employee?.name || 'Field User';

  const submitNexus = async () => {
    if (!nexusNote.trim()) return;
    await base44.entities.NexusItem.create({
      company_id: company?.id || wo?.company_id,
      company_slug: company?.slug || wo?.company_slug,
      source_type: 'job_note',
      source_id: wo.id,
      title: `Work Order: ${wo.title}`,
      summary: nexusNote.slice(0, 200),
      raw_content: nexusNote,
      category: 'job_procedure',
      priority: 'normal',
      status: 'pending_review',
      submitted_by_name: actor,
      linked_job_id: wo.job_id,
    });
    await updateMutation.mutateAsync({ nexus_submitted: true });
    audit.workOrder.sentToNexus(wo.id, actor, wo.title).catch(() => toast.warning('Audit log failed'));
    setShowNexus(false);
    setNexusNote('');
  };

  const markComplete = async () => {
    await updateMutation.mutateAsync({
      status: 'complete',
      completed_date: new Date().toISOString().split('T')[0],
    });
    audit.workOrder.completed(wo.id, actor, wo.title).catch(() => toast.warning('Audit log failed'));
  };

  if (isLoading || !wo) return (
    <AppLayout title="Work Order">
      <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
    </AppLayout>
  );

  if (!canViewWorkOrder(wo, canViewAssignedOnly)) return (
    <AppLayout title="Work Order">
      <NoAccessRecord message="You do not have access to this work order." />
    </AppLayout>
  );

  const checklist = JSON.parse(wo.checklist || '[]');
  const completedCount = checklist.filter(i => i.completed).length;

  return (
    <AppLayout title={wo.title}>
      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-4">

        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">{wo.title}</h1>
            <p className="text-xs text-muted-foreground">{wo.job_address}</p>
          </div>
          <button onClick={() => setShowEdit(true)} className="p-2 rounded-xl hover:bg-muted">
            <Edit2 className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Status + Priority */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[wo.status] || 'bg-muted text-muted-foreground'}`}>
            {wo.status?.replace('_', ' ')}
          </span>
          {wo.priority === 'urgent' && (
            <span className="flex items-center gap-1 text-xs font-semibold bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
              <AlertTriangle className="w-3 h-3" /> Urgent
            </span>
          )}
          {wo.due_date && <span className="text-xs text-muted-foreground">Due {wo.due_date}</span>}
        </div>

        {/* Description */}
        {wo.description && (
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-foreground">{wo.description}</p>
          </div>
        )}

        {/* Scope */}
        {wo.scope && (
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Scope of Work</p>
            <p className="text-sm text-foreground whitespace-pre-line">{wo.scope}</p>
          </div>
        )}

        {/* Checklist */}
        {checklist.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Checklist</p>
              <span className="text-xs text-muted-foreground">{completedCount}/{checklist.length}</span>
            </div>
            <div className="space-y-2">
              {checklist.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleChecklist(idx)}
                  className="w-full flex items-center gap-2.5 text-left py-1"
                >
                  {item.completed
                    ? <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                    : <Square className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <span className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {item.item}
                  </span>
                </button>
              ))}
            </div>
            {completedCount === checklist.length && checklist.length > 0 && (
              <p className="text-xs text-emerald-600 font-medium mt-2 text-center">✓ All items complete</p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          {wo.status !== 'complete' && wo.status !== 'approved' && (
            <button
              onClick={markComplete}
              className="h-11 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2"
            >
              <CheckSquare className="w-4 h-4" /> Mark Complete
            </button>
          )}
          <button
            onClick={() => setShowNexus(true)}
            className="h-11 rounded-xl bg-purple-600 text-white text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Send to Nexus
          </button>
        </div>

        {/* Cost code + assigned */}
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          {wo.cost_code && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground text-xs">Cost Code</span>
              <span className="font-medium">{wo.cost_code}</span>
            </div>
          )}
          {wo.assigned_employee_names && (
            <div className="flex items-start justify-between text-sm">
              <span className="text-muted-foreground text-xs">Assigned To</span>
              <span className="font-medium text-right max-w-[60%]">
                {(() => { try { return JSON.parse(wo.assigned_employee_names).join(', '); } catch { return wo.assigned_employee_names; } })()}
              </span>
            </div>
          )}
        </div>

      </div>

      {/* Nexus modal */}
      {showNexus && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="w-full bg-card rounded-t-2xl p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <p className="text-sm font-semibold">Submit to Nexus</p>
            <p className="text-xs text-muted-foreground">This will create a pending Nexus item for human review. It will not be auto-approved.</p>
            <textarea
              className="w-full border border-input rounded-xl p-3 text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-ring/20"
              placeholder="Describe the observation, issue, or procedure..."
              value={nexusNote}
              onChange={e => setNexusNote(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => setShowNexus(false)} className="flex-1 h-10 rounded-xl border border-input text-sm font-medium text-muted-foreground">Cancel</button>
              <button onClick={submitNexus} disabled={!nexusNote.trim()} className="flex-1 h-10 rounded-xl bg-purple-600 text-white text-sm font-semibold disabled:opacity-50">
                Submit for Review
              </button>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <WorkOrderModal
          workOrder={wo}
          company={company}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); refetch(); }}
        />
      )}
    </AppLayout>
  );
}