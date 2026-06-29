import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Plus, ClipboardList, Edit2, Loader2, CheckSquare } from 'lucide-react';
import { getCurrentCompany } from '@/lib/permissions';
import { getSession, isAdmin } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { toast } from 'sonner';
import WorkOrderTemplateModal from '@/components/templates/WorkOrderTemplateModal';

const SERVICE_LINE_LABELS = {
  water_mitigation: 'Water Mitigation', mold_mitigation: 'Mold Mitigation',
  interior_painting: 'Interior Painting', exterior_painting: 'Exterior Painting',
  drywall: 'Drywall', other: 'Other',
};

export default function WorkOrderTemplatesPage() {
  const qc = useQueryClient();
  const company = getCurrentCompany();
  const admin = isAdmin();
  const session = getSession();
  const [editTarget, setEditTarget] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['wo-templates', company?.id],
    queryFn: () => company
      ? base44.entities.WorkOrderTemplate.filter({ company_id: company.id }, 'name')
      : Promise.resolve([]),
    enabled: !!company?.id,
  });

  const handleSaved = async (tpl, isEdit) => {
    const actor = session?.employee?.name || 'Admin';
    logAudit(tpl.id, isEdit ? 'template_updated' : 'template_created', actor,
      `${actor} ${isEdit ? 'updated' : 'created'} work order template: ${tpl.name}`, { module: 'system' });
    qc.invalidateQueries({ queryKey: ['wo-templates'] });
    setShowModal(false);
    setEditTarget(null);
    toast.success(isEdit ? 'Template updated' : 'Template created');
  };

  return (
    <AppLayout title="Work Order Templates">
      <div className="app-page max-w-2xl space-y-4">
        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Work Order Templates</h1>
            <p className="app-page-subtitle">Reusable work order blueprints with scopes, checklists, and required docs.</p>
          </div>
          {admin && (
            <Button size="sm" onClick={() => { setEditTarget(null); setShowModal(true); }}>
              <Plus className="w-4 h-4" /> New Template
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No work order templates yet.</div>
        ) : (
          <div className="space-y-2">
            {templates.map(tpl => {
              const checklist = (() => { try { return JSON.parse(tpl.completion_checklist || '[]'); } catch { return []; } })();
              return (
                <div key={tpl.id} className="app-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <ClipboardList className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{tpl.name}</p>
                        {!tpl.active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>}
                        {tpl.service_line && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                            {SERVICE_LINE_LABELS[tpl.service_line] || tpl.service_line}
                          </span>
                        )}
                      </div>
                      {tpl.title && <p className="text-xs text-muted-foreground mt-0.5">Default title: {tpl.title}</p>}
                      {tpl.default_cost_code && <p className="text-xs text-muted-foreground">Cost code: {tpl.default_cost_code}</p>}
                      {checklist.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <CheckSquare className="w-3 h-3" /> {checklist.length} checklist items
                        </p>
                      )}
                      {tpl.required_photos && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 mr-1">Photos required</span>}
                      {tpl.required_notes && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Notes required</span>}
                    </div>
                    {admin && (
                      <button onClick={() => { setEditTarget(tpl); setShowModal(true); }} className="p-2 rounded-lg hover:bg-muted shrink-0">
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <WorkOrderTemplateModal
          initial={editTarget}
          company={company}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSaved={handleSaved}
        />
      )}
    </AppLayout>
  );
}
