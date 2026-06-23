import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Loader2, ChevronRight, AlertTriangle, CheckSquare } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import WorkOrderModal from '@/components/workorders/WorkOrderModal';
import usePermissions from '@/hooks/usePermissions';
import { filterAssignedRecords, AssignedOnlyBanner } from '@/lib/financialGuards.jsx';

function getActiveCompany() {
  try { return JSON.parse(sessionStorage.getItem('active_company')); } catch { return null; }
}

const STATUS_STYLES = {
  draft: 'bg-muted text-muted-foreground',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  waiting: 'bg-yellow-100 text-yellow-700',
  complete: 'bg-emerald-100 text-emerald-700',
  approved: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const PRIORITY_ICON = { urgent: '🔴', high: '🟠', normal: '', low: '⚪' };

const TABS = ['all', 'draft', 'assigned', 'in_progress', 'waiting', 'complete'];

export default function WorkOrders() {
  const navigate = useNavigate();
  const company = getActiveCompany();
  const { canViewAssignedOnly, canManageWorkOrders } = usePermissions();
  const [tab, setTab] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editWO, setEditWO] = useState(null);

  const { data: workOrders = [], isLoading, refetch } = useQuery({
    queryKey: ['work-orders', company?.id],
    queryFn: () => company
      ? base44.entities.WorkOrder.filter({ company_id: company.id }, '-created_date', 200)
      : base44.entities.WorkOrder.list('-created_date', 200),
  });

  const filtered = useMemo(() => {
    const byTab = tab === 'all' ? workOrders : workOrders.filter(w => w.status === tab);
    return filterAssignedRecords(byTab, canViewAssignedOnly);
  }, [workOrders, tab, canViewAssignedOnly]);

  return (
    <AppLayout title="Work Orders">
      <div className="max-w-2xl mx-auto px-4 py-4 pb-24 space-y-4">

        {canViewAssignedOnly && <AssignedOnlyBanner />}

        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-foreground">Work Orders</h1>
          {canManageWorkOrders && (
            <button
              onClick={() => { setEditWO(null); setShowModal(true); }}
              className="flex items-center gap-1.5 h-9 px-3 bg-primary text-primary-foreground text-sm font-semibold rounded-xl"
            >
              <Plus className="w-4 h-4" /> New
            </button>
          )}
        </div>

        {/* Status tabs */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`shrink-0 h-7 px-3 rounded-full text-xs font-medium transition-colors
                ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {t === 'all' ? 'All' : t.replace('_', ' ')}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No work orders</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(wo => (
              <div
                key={wo.id}
                className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => navigate(`/work-orders/${wo.id}`)}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {wo.priority === 'urgent' && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    <p className="text-sm font-medium truncate">{wo.title}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[wo.status] || 'bg-muted text-muted-foreground'}`}>
                    {wo.status?.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{wo.job_address}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {wo.due_date && <span>Due {wo.due_date}</span>}
                  {wo.cost_code && <span>{wo.cost_code}</span>}
                  {wo.required_photos && <span className="flex items-center gap-0.5"><CheckSquare className="w-3 h-3" />Photos req.</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && canManageWorkOrders && (
        <WorkOrderModal
          workOrder={editWO}
          company={company}
          onClose={() => { setShowModal(false); setEditWO(null); }}
          onSaved={() => { setShowModal(false); setEditWO(null); refetch(); }}
        />
      )}
    </AppLayout>
  );
}