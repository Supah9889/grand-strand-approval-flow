import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Edit2, Loader2 } from 'lucide-react';
import { getCurrentCompany } from '@/lib/permissions';
import { getSession, isAdmin } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { toast } from 'sonner';
import DocRequirementModal from '@/components/templates/DocRequirementModal';

const REQ_TYPE_COLORS = {
  photo: 'bg-blue-100 text-blue-700',
  note: 'bg-gray-100 text-gray-700',
  moisture_reading: 'bg-cyan-100 text-cyan-700',
  drying_log: 'bg-teal-100 text-teal-700',
  air_sample: 'bg-purple-100 text-purple-700',
  equipment_assignment: 'bg-orange-100 text-orange-700',
  customer_signature: 'bg-green-100 text-green-700',
  manager_review: 'bg-red-100 text-red-700',
};

const SERVICE_LINE_LABELS = {
  water_mitigation: 'Water Mitigation', mold_mitigation: 'Mold Mitigation',
  air_sample_testing: 'Air Samples', reconstruction: 'Reconstruction',
  interior_painting: 'Int. Painting', exterior_painting: 'Ext. Painting',
  drywall: 'Drywall', other: 'Other',
};

export default function DocumentationRequirementsPage() {
  const qc = useQueryClient();
  const company = getCurrentCompany();
  const admin = isAdmin();
  const session = getSession();
  const [editTarget, setEditTarget] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filterLine, setFilterLine] = useState('all');

  const { data: reqs = [], isLoading } = useQuery({
    queryKey: ['doc-requirements', company?.id],
    queryFn: () => company
      ? base44.entities.DocumentationRequirement.filter({ company_id: company.id }, 'service_line')
      : Promise.resolve([]),
    enabled: !!company?.id,
  });

  const filtered = filterLine === 'all' ? reqs : reqs.filter(r => r.service_line === filterLine);
  const serviceLines = [...new Set(reqs.map(r => r.service_line).filter(Boolean))];

  const handleSaved = (req, isEdit) => {
    const actor = session?.employee?.name || 'Admin';
    logAudit(req.id, isEdit ? 'template_updated' : 'template_created', actor,
      `${actor} ${isEdit ? 'updated' : 'created'} documentation requirement: ${req.title}`, { module: 'system' });
    qc.invalidateQueries({ queryKey: ['doc-requirements'] });
    setShowModal(false);
    setEditTarget(null);
    toast.success(isEdit ? 'Requirement updated' : 'Requirement created');
  };

  return (
    <AppLayout title="Documentation Requirements">
      <div className="app-page max-w-2xl space-y-4">
        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Documentation Requirements</h1>
            <p className="app-page-subtitle">Rules for what must be documented per service line before a job or WO can close.</p>
          </div>
          {admin && (
            <Button size="sm" onClick={() => { setEditTarget(null); setShowModal(true); }}>
              <Plus className="w-4 h-4" /> New Requirement
            </Button>
          )}
        </div>

        {/* Service line filter */}
        {serviceLines.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {['all', ...serviceLines].map(sl => (
              <button key={sl} onClick={() => setFilterLine(sl)}
                className={`shrink-0 h-7 px-3 rounded-full text-xs font-medium transition-colors
                  ${filterLine === sl ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                {sl === 'all' ? 'All' : (SERVICE_LINE_LABELS[sl] || sl)}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No requirements yet.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(req => (
              <div key={req.id} className="app-card p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{req.title}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${REQ_TYPE_COLORS[req.requirement_type] || 'bg-muted text-muted-foreground'}`}>
                      {req.requirement_type?.replace('_', ' ')}
                    </span>
                    {req.service_line && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        {SERVICE_LINE_LABELS[req.service_line] || req.service_line}
                      </span>
                    )}
                    {!req.active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>}
                  </div>
                  {req.description && <p className="text-xs text-muted-foreground mt-0.5">{req.description}</p>}
                  {req.required_for_status && (
                    <p className="text-xs text-amber-600 mt-0.5 font-medium">Required before: {req.required_for_status}</p>
                  )}
                </div>
                {admin && (
                  <button onClick={() => { setEditTarget(req); setShowModal(true); }} className="p-2 rounded-lg hover:bg-muted shrink-0">
                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <DocRequirementModal
          initial={editTarget}
          company={company}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSaved={handleSaved}
        />
      )}
    </AppLayout>
  );
}
