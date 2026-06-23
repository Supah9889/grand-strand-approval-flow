import React from 'react';
import { Button } from '@/components/ui/button';
import { X, CheckCircle2, XCircle, Brain } from 'lucide-react';

const CATEGORY_LABELS = {
  customer_insight: 'Customer Insight',
  job_procedure: 'Job Procedure',
  cost_data: 'Cost Data',
  vendor_performance: 'Vendor Performance',
  safety: 'Safety',
  compliance: 'Compliance',
  process_improvement: 'Process Improvement',
  other: 'Other',
};

export default function NexusItemModal({ item, onClose, onApprove, onReject }) {
  const isPending = item.status === 'pending_review';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-xl flex flex-col max-h-[92dvh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">Nexus Item</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{CATEGORY_LABELS[item.category] || 'Other'} · {item.priority} priority</p>
            <h3 className="font-semibold text-foreground mt-1 text-base">{item.title}</h3>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Summary</p>
            <p className="text-sm text-foreground leading-relaxed">{item.summary}</p>
          </div>

          {item.raw_content && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Raw Content</p>
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                {item.raw_content}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Submitted by</p>
              <p className="font-medium text-foreground mt-0.5">{item.submitted_by_name || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Source</p>
              <p className="font-medium text-foreground mt-0.5">{item.source_type?.replace('_', ' ') || '—'}</p>
            </div>
            {item.status !== 'pending_review' && (
              <>
                <div>
                  <p className="text-muted-foreground">Reviewed by</p>
                  <p className="font-medium text-foreground mt-0.5">{item.reviewer_name || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium text-foreground mt-0.5 capitalize">{item.status?.replace('_', ' ')}</p>
                </div>
              </>
            )}
          </div>

          {item.review_notes && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Review Notes</p>
              <p className="text-sm text-foreground">{item.review_notes}</p>
            </div>
          )}
        </div>

        {isPending && (
          <div className="px-5 py-4 border-t border-border flex gap-2">
            <Button
              className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              onClick={onApprove}
            >
              <CheckCircle2 className="w-4 h-4" /> Approve
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-1.5 text-destructive border-destructive/40"
              onClick={() => onReject('Rejected by reviewer')}
            >
              <XCircle className="w-4 h-4" /> Reject
            </Button>
          </div>
        )}
        {!isPending && (
          <div className="px-5 py-4 border-t border-border">
            <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
          </div>
        )}
      </div>
    </div>
  );
}