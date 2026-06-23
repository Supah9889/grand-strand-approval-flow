import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Plus, Briefcase, Edit2, Loader2, ChevronRight, CheckCircle2 } from 'lucide-react';
import { getCurrentCompany } from '@/lib/permissions';
import { getSession, isAdmin } from '@/lib/adminAuth';
import { audit } from '@/lib/audit';
import { toast } from 'sonner';
import JobTemplateModal from '@/components/templates/JobTemplateModal';

const SERVICE_LINE_LABELS = {
  water_mitigation: 'Water Mitigation', mold_mitigation: 'Mold Mitigation',
  air_sample_testing: 'Air Sample Testing', reconstruction: 'Reconstruction',
  interior_painting: 'Interior Painting', exterior_painting: 'Exterior Painting',
  drywall: 'Drywall', other: 'Other',
};

export default function JobTemplatesPage() {
  const qc = useQueryClient();
  const company = getCurrentCompany();
  const admin = isAdmin();
  const session = getSession();
  const [editTarget, setEditTarget] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['job-templates', company?.id],
    queryFn: () => company
      ? base44.entities.JobTemplate.filter({ company_id: company.id }, 'name')
      : base44.entities.JobTemplate.list('name'),
  });

  const handleSaved = async (tpl, isEdit) => {
    const actor = session?.employee?.name || 'Admin';
    if (isEdit) {
      audit.logAudit?.(tpl.id, 'template_updated', actor, `${actor} updated job template: ${tpl.name}`, { module: 'system' });
    } else {
      audit.logAudit?.(tpl.id, 'template_created', actor, `${actor} created job template: ${tpl.name}`, { module: 'system' });
    }
    qc.invalidateQueries({ queryKey: ['job-templates'] });
    setShowModal(false);
    setEditTarget(null);
    toast.success(isEdit ? 'Template updated' : 'Template created');
  };

  return (
    <AppLayout title="Job Templates">
      <div className="app-page max-w-2xl space-y-4">
        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Job Templates</h1>
            <p className="app-page-subtitle">Pre-configured documentation requirements per service line.</p>
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
          <div className="text-center py-16 text-muted-foreground text-sm">No job templates yet.</div>
        ) : (
          <div className="space-y-2">
            {templates.map(tpl => {
              const docs = (() => { try { return JSON.parse(tpl.required_documentation || '[]'); } catch { return []; } })();
              return (
                <div key={tpl.id} className="app-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <Briefcase className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{tpl.name}</p>
                        {!tpl.active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>}
                        {tpl.service_line && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {SERVICE_LINE_LABELS[tpl.service_line] || tpl.service_line}
                          </span>
                        )}
                      </div>
                      {tpl.description && <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>}
                      {docs.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {docs.slice(0, 4).map((d, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> {d.label}
                            </span>
                          ))}
                          {docs.length > 4 && <span className="text-[10px] text-muted-foreground">+{docs.length - 4} more</span>}
                        </div>
                      )}
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
        <JobTemplateModal
          initial={editTarget}
          company={company}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSaved={handleSaved}
        />
      )}
    </AppLayout>
  );
}