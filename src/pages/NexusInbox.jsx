import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CheckCircle2, XCircle, Clock, Brain, ChevronRight, Plus, AlertTriangle, Loader2 } from 'lucide-react';
import { getCurrentCompany as getActiveCompany } from '@/lib/permissions';
import { getSession } from '@/lib/adminAuth';
import { audit } from '@/lib/audit';
import { toast } from 'sonner';
import NexusItemModal from '@/components/nexus/NexusItemModal';
import NexusSubmitModal from '@/components/nexus/NexusSubmitModal';
import { useCompanyGuard, NoAccessState } from '@/components/CompanyGuard';
import usePermissions from '@/hooks/usePermissions';

const CATEGORY_COLORS = {
  customer_insight:    'bg-blue-100 text-blue-700',
  job_procedure:       'bg-green-100 text-green-700',
  cost_data:           'bg-amber-100 text-amber-700',
  vendor_performance:  'bg-purple-100 text-purple-700',
  safety:              'bg-red-100 text-red-700',
  compliance:          'bg-orange-100 text-orange-700',
  process_improvement: 'bg-cyan-100 text-cyan-700',
  other:               'bg-gray-100 text-gray-600',
};

const PRIORITY_DOT = {
  urgent: 'bg-red-500',
  high:   'bg-orange-400',
  normal: 'bg-blue-400',
  low:    'bg-gray-300',
};

export default function NexusInbox() {
  const qc = useQueryClient();
  const company = getActiveCompany();
  const session = getSession();
  const { canApproveNexus, canSubmitNexus } = usePermissions();
  const companyGuard = useCompanyGuard('Select a company to view the Nexus Inbox.');
  const [tab, setTab] = useState('pending');
  const [reviewTarget, setReviewTarget] = useState(null);
  const [showSubmit, setShowSubmit] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['nexus-items', company?.id],
    queryFn: () => company
      ? base44.entities.NexusItem.filter({ company_id: company.id }, '-created_date', 200)
      : Promise.resolve([]),
    enabled: !!company,
    refetchInterval: 30000,
  });

  const actor = session?.employee?.name || 'Admin';

  const approveMutation = useMutation({
    mutationFn: async ({ id, item }) => {
      await base44.entities.NexusItem.update(id, {
        status: 'approved',
        reviewer_name: actor,
        reviewed_at: new Date().toISOString(),
      });
      audit.nexus.approved(id, actor, item?.title || id).catch(() => toast.warning('Audit log failed'));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nexus-items', company?.id] }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason, item }) => {
      await base44.entities.NexusItem.update(id, {
        status: 'rejected',
        review_notes: reason,
        reviewer_name: actor,
        reviewed_at: new Date().toISOString(),
      });
      audit.nexus.rejected(id, actor, item?.title || id, reason).catch(() => toast.warning('Audit log failed'));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nexus-items', company?.id] }),
  });

  const pending = items.filter(i => i.status === 'pending_review');
  const approved = items.filter(i => i.status === 'approved');
  const rejected = items.filter(i => i.status === 'rejected');

  const tabItems = tab === 'pending' ? pending : tab === 'approved' ? approved : rejected;

  if (companyGuard) return <AppLayout title="Nexus Inbox">{companyGuard}</AppLayout>;
  if (!canSubmitNexus && !canApproveNexus) return (
    <AppLayout title="Nexus Inbox">
      <NoAccessState message="You do not have permission to access the Nexus Inbox." />
    </AppLayout>
  );

  return (
    <AppLayout title="Nexus Inbox">
      <div className="app-page space-y-4">
        <div className="app-page-header">
          <div>
            <h1 className="app-page-title flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" /> Nexus Verification Inbox
            </h1>
            <p className="app-page-subtitle">
              {company?.name} · Human approval required before information becomes company knowledge
            </p>
          </div>
          {canSubmitNexus && (
            <Button size="sm" onClick={() => setShowSubmit(true)}>
              <Plus className="w-4 h-4" /> Submit Item
            </Button>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pending', count: pending.length, color: 'text-amber-600 bg-amber-50', tab: 'pending' },
            { label: 'Approved', count: approved.length, color: 'text-green-600 bg-green-50', tab: 'approved' },
            { label: 'Rejected', count: rejected.length, color: 'text-red-600 bg-red-50', tab: 'rejected' },
          ].map(s => (
            <button
              key={s.tab}
              onClick={() => setTab(s.tab)}
              className={`rounded-2xl p-3 text-center border transition-all ${tab === s.tab ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border'} ${s.color}`}
            >
              <p className="text-xl font-bold">{s.count}</p>
              <p className="text-xs font-medium">{s.label}</p>
            </button>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="pending" className="flex-1">
              Pending {pending.length > 0 && <Badge className="ml-1.5 text-[10px] bg-amber-500">{pending.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex-1">Approved</TabsTrigger>
            <TabsTrigger value="rejected" className="flex-1">Rejected</TabsTrigger>
          </TabsList>

          {['pending', 'approved', 'rejected'].map(t => (
            <TabsContent key={t} value={t} className="mt-3 space-y-2">
              {isLoading ? (
                <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : tabItems.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {t === 'pending' ? 'No items pending review.' : t === 'approved' ? 'No approved items yet.' : 'No rejected items.'}
                </div>
              ) : tabItems.map(item => (
                <div key={item.id} className="app-card p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${PRIORITY_DOT[item.priority] || PRIORITY_DOT.normal}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-foreground leading-snug">{item.title}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other}`}>
                          {item.category?.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">By {item.submitted_by_name} · {item.source_type?.replace('_', ' ')}</p>
                    </div>
                  </div>

                  {t === 'pending' && canApproveNexus && (
                    <div className="flex gap-2 pt-1 border-t border-border/60">
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate({ id: item.id, item })}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/5"
                        disabled={rejectMutation.isPending}
                        onClick={() => rejectMutation.mutate({ id: item.id, reason: 'Rejected by reviewer', item })}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setReviewTarget(item)}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  {t !== 'pending' && (
                    <button
                      onClick={() => setReviewTarget(item)}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      View details <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {reviewTarget && (
        <NexusItemModal
          item={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onApprove={() => { approveMutation.mutate({ id: reviewTarget.id, item: reviewTarget }); setReviewTarget(null); }}
          onReject={(reason) => { rejectMutation.mutate({ id: reviewTarget.id, reason, item: reviewTarget }); setReviewTarget(null); }}
        />
      )}
      {showSubmit && canSubmitNexus && (
        <NexusSubmitModal
          company={company}
          session={session}
          onClose={() => setShowSubmit(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['nexus-items', company?.id] }); setShowSubmit(false); }}
        />
      )}
    </AppLayout>
  );
}