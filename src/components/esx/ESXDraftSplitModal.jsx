import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { audit } from '@/lib/audit';
import { X, Loader2, Split } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ESXDraftSplitModal({ draft, onClose, user, company }) {
  const qc = useQueryClient();
  const sourceItems = (() => {
    try { return JSON.parse(draft.source_esx_line_items || '[]'); } catch { return []; }
  })();

  const [draftA, setDraftA] = useState({
    title: `${draft.title} - Part A`,
    description: draft.description,
    service_line: draft.service_line || 'other',
    suggested_company_name: draft.suggested_company_name || '',
    items: sourceItems.slice(0, Math.ceil(sourceItems.length / 2)),
  });

  const [draftB, setDraftB] = useState({
    title: `${draft.title} - Part B`,
    description: draft.description,
    service_line: draft.service_line || 'other',
    suggested_company_name: draft.suggested_company_name || '',
    items: sourceItems.slice(Math.ceil(sourceItems.length / 2)),
  });

  const splitMutation = useMutation({
    mutationFn: async () => {
      const idA = await base44.entities.ESXDraftWorkOrder.create({
        company_id: company.id,
        company_slug: company.slug,
        title: draftA.title,
        description: draftA.description,
        service_line: draftA.service_line,
        suggested_company_name: draftA.suggested_company_name,
        source_esx_line_items: JSON.stringify(draftA.items),
        source_import_id: draft.source_import_id,
        confidence_score: draft.confidence_score,
        review_status: 'draft',
      });

      const idB = await base44.entities.ESXDraftWorkOrder.create({
        company_id: company.id,
        company_slug: company.slug,
        title: draftB.title,
        description: draftB.description,
        service_line: draftB.service_line,
        suggested_company_name: draftB.suggested_company_name,
        source_esx_line_items: JSON.stringify(draftB.items),
        source_import_id: draft.source_import_id,
        confidence_score: draft.confidence_score,
        review_status: 'draft',
      });

      // Archive original
      await base44.entities.ESXDraftWorkOrder.update(draft.id, { review_status: 'rejected' });

      audit.esxDraft.split(draft.id, user?.full_name, [idA.id, idB.id], {
        company: company.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(['esx-drafts', company?.id]);
      onClose();
    },
  });

  const handleItemToggle = (index, target) => {
    const item = sourceItems[index];
    if (target === 'a') {
      if (draftA.items.includes(item)) {
        setDraftA(p => ({ ...p, items: p.items.filter(i => i !== item) }));
        setDraftB(p => ({ ...p, items: [...p.items, item] }));
      } else {
        setDraftA(p => ({ ...p, items: [...p.items, item] }));
        setDraftB(p => ({ ...p, items: p.items.filter(i => i !== item) }));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Split Draft Work Order</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Draft A */}
          <div className="border border-border rounded-xl p-4 space-y-3 bg-blue-50">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Draft A Title</label>
              <input
                type="text"
                value={draftA.title}
                onChange={e => setDraftA(p => ({ ...p, title: e.target.value }))}
                className="w-full h-9 px-2 rounded-lg border border-input bg-card text-sm mt-1"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Items ({draftA.items.length})</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {sourceItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleItemToggle(i, 'a')}
                    className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                      draftA.items.includes(item)
                        ? 'bg-blue-200 text-blue-900 border border-blue-300'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    {typeof item === 'string' ? item : item.description || JSON.stringify(item).slice(0, 50)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Draft B */}
          <div className="border border-border rounded-xl p-4 space-y-3 bg-green-50">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Draft B Title</label>
              <input
                type="text"
                value={draftB.title}
                onChange={e => setDraftB(p => ({ ...p, title: e.target.value }))}
                className="w-full h-9 px-2 rounded-lg border border-input bg-card text-sm mt-1"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Items ({draftB.items.length})</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {sourceItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleItemToggle(i, 'b')}
                    className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                      draftB.items.includes(item)
                        ? 'bg-green-200 text-green-900 border border-green-300'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    {typeof item === 'string' ? item : item.description || JSON.stringify(item).slice(0, 50)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => splitMutation.mutate()}
            disabled={splitMutation.isPending || draftA.items.length === 0 || draftB.items.length === 0}
          >
            {splitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Split className="w-4 h-4" />}
            Create Split Drafts
          </Button>
        </div>
      </div>
    </div>
  );
}