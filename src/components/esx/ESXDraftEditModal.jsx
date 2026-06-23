import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { audit } from '@/lib/audit';
import { X, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SERVICE_LINES = [
  'water_mitigation', 'mold_mitigation', 'air_sample_testing', 'reconstruction',
  'emergency_response', 'interior_painting', 'exterior_painting', 'drywall',
  'insulation', 'cabinet_painting', 'epoxy_garage_floor', 'other'
];

export default function ESXDraftEditModal({ draft, companies, onClose, user }) {
  const qc = useQueryClient();
  const [data, setData] = useState({
    title: draft.title || '',
    description: draft.description || '',
    service_line: draft.service_line || 'other',
    suggested_company_id: draft.suggested_company_id || '',
    suggested_company_name: draft.suggested_company_name || '',
    suggested_subcontractor_name: draft.suggested_subcontractor_name || '',
    estimated_labor_category: draft.estimated_labor_category || '',
    confidence_score: draft.confidence_score || 50,
    review_status: draft.review_status || 'draft',
    reviewer_notes: draft.reviewer_notes || '',
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.ESXDraftWorkOrder.update(draft.id, data);
      audit.esxDraft.edited(draft.id, user?.full_name, data.title, { company: draft.company_id });
    },
    onSuccess: () => {
      qc.invalidateQueries(['esx-drafts']);
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit Draft Work Order</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Title *</label>
            <input
              type="text"
              value={data.title}
              onChange={e => setData(p => ({ ...p, title: e.target.value }))}
              className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Description</label>
            <textarea
              value={data.description}
              onChange={e => setData(p => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-input bg-card text-sm resize-none h-24 mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Service Line</label>
              <select
                value={data.service_line}
                onChange={e => setData(p => ({ ...p, service_line: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm mt-1"
              >
                {SERVICE_LINES.map(sl => (
                  <option key={sl} value={sl}>{sl.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Confidence %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={data.confidence_score}
                onChange={e => setData(p => ({ ...p, confidence_score: parseInt(e.target.value) || 0 }))}
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Company</label>
              <input
                type="text"
                value={data.suggested_company_name}
                onChange={e => setData(p => ({ ...p, suggested_company_name: e.target.value }))}
                placeholder="e.g. Destination Home"
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Subcontractor</label>
              <input
                type="text"
                value={data.suggested_subcontractor_name}
                onChange={e => setData(p => ({ ...p, suggested_subcontractor_name: e.target.value }))}
                placeholder="e.g. GSCP"
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Labor Category</label>
              <input
                type="text"
                value={data.estimated_labor_category}
                onChange={e => setData(p => ({ ...p, estimated_labor_category: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Status</label>
              <select
                value={data.review_status}
                onChange={e => setData(p => ({ ...p, review_status: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm mt-1"
              >
                <option value="draft">Draft</option>
                <option value="needs_review">Needs Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Reviewer Notes</label>
            <textarea
              value={data.reviewer_notes}
              onChange={e => setData(p => ({ ...p, reviewer_notes: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-input bg-card text-sm resize-none h-20 mt-1"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !data.title}
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}