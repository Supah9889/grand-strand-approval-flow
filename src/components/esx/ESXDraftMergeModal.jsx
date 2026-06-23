import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { audit } from '@/lib/audit';
import { X, Loader2, Combine } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ESXDraftMergeModal({ selected, drafts, onClose, user, company }) {
  const qc = useQueryClient();
  const selectedDrafts = drafts.filter(d => selected.has(d.id));
  const [merged, setMerged] = useState({
    title: `Merged: ${selectedDrafts.map(d => d.title).join(' + ')}`,
    description: selectedDrafts.map(d => d.description).join('\n---\n'),
    service_line: selectedDrafts[0]?.service_line || 'other',
    suggested_company_name: selectedDrafts[0]?.suggested_company_name || '',
    source_esx_line_items: JSON.stringify(
      selectedDrafts.flatMap(d => {
        try { return JSON.parse(d.source_esx_line_items || '[]'); } catch { return []; }
      })
    ),
    confidence_score: Math.round(
      selectedDrafts.reduce((sum, d) => sum + (d.confidence_score || 0), 0) / selectedDrafts.length
    ),
  });

  const mergeMutation = useMutation({
    mutationFn: async () => {
      // Create merged draft
      const newDraft = await base44.entities.ESXDraftWorkOrder.create({
        company_id: company.id,
        company_slug: company.slug,
        ...merged,
        source_import_id: selectedDrafts[0].source_import_id,
        review_status: 'draft',
      });

      // Archive originals (keep them for traceability)
      for (const draft of selectedDrafts) {
        await base44.entities.ESXDraftWorkOrder.update(draft.id, {
          review_status: 'rejected', // Mark as archived/superseded
        });
      }

      // Audit
      audit.esxDraft.merged(newDraft.id, user?.full_name, selectedDrafts.map(d => d.id), {
        company: company.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(['esx-drafts', company?.id]);
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Merge {selectedDrafts.length} Drafts</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 max-h-40 overflow-y-auto">
          {selectedDrafts.map(d => (
            <div key={d.id} className="bg-muted/40 rounded-lg p-3 border border-border text-xs">
              <p className="font-semibold text-foreground truncate">{d.title}</p>
              <p className="text-muted-foreground line-clamp-2 mt-1">{d.description}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-sm font-semibold">Merged Result</p>
          <textarea
            value={merged.title}
            onChange={e => setMerged(p => ({ ...p, title: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-input bg-card text-sm h-12"
          />
          <textarea
            value={merged.description}
            onChange={e => setMerged(p => ({ ...p, description: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-input bg-card text-sm h-20 resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Service Line</label>
              <select
                value={merged.service_line}
                onChange={e => setMerged(p => ({ ...p, service_line: e.target.value }))}
                className="w-full h-9 px-2 rounded-lg border border-input bg-card text-sm mt-1"
              >
                {['water_mitigation', 'mold_mitigation', 'air_sample_testing', 'reconstruction',
                  'emergency_response', 'interior_painting', 'exterior_painting', 'drywall',
                  'insulation', 'cabinet_painting', 'epoxy_garage_floor', 'other'].map(sl => (
                  <option key={sl} value={sl}>{sl.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Confidence</label>
              <div className="text-sm font-bold text-primary mt-2">{merged.confidence_score}%</div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mergeMutation.mutate()}
            disabled={mergeMutation.isPending}
          >
            {mergeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Combine className="w-4 h-4" />}
            Create Merged Draft
          </Button>
        </div>
      </div>
    </div>
  );
}