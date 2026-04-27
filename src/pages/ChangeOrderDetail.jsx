import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  ArrowLeft, Loader2, Pencil, CheckCircle2, XCircle, Send,
  TrendingUp, TrendingDown, Clock, Save, FileText, Paperclip
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import COStatusBadge from '../components/changeorders/COStatusBadge';
import COActivityFeed from '../components/changeorders/COActivityFeed';
import COForm from '../components/changeorders/COForm';
import { CO_STATUS_CONFIG, CO_CATEGORY_LABELS } from '@/lib/changeOrderHelpers';
import { getInternalRole } from '@/lib/adminAuth';
import { toast } from 'sonner';
import LinkedJobPanel from '@/components/jobs/LinkedJobPanel';

export default function ChangeOrderDetail() {
  const coId = window.location.pathname.split('/').pop();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const [editing, setEditing] = useState(false);
  const [responseNote, setResponseNote] = useState('');
  const [showResponseNote, setShowResponseNote] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);

  const { data: co, isLoading } = useQuery({
    queryKey: ['change-order', coId],
    queryFn: async () => { const r = await base44.entities.ChangeOrder.filter({ id: coId }); return r[0]; },
    enabled: !!coId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['co-activities', coId],
    queryFn: () => base44.entities.ChangeOrderActivity.filter({ co_id: coId }),
    enabled: !!coId,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 200),
  });

  const { data: allCOs = [] } = useQuery({
    queryKey: ['change-orders'],
    queryFn: () => base44.entities.ChangeOrder.list('-created_date'),
  });

  const logActivity = (action, detail) =>
    base44.entities.ChangeOrderActivity.create({ co_id: coId, action, detail, actor: role || 'admin', timestamp: new Date().toISOString() });

  const updateMutation = useMutation({
    mutationFn: async ({ data, action, detail }) => {
      await base44.entities.ChangeOrder.update(coId, data);
      if (action) await logActivity(action, detail || '');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-order', coId] });
      queryClient.invalidateQueries({ queryKey: ['co-activities', coId] });
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
    },
  });

  const saveEdits = async (data) => {
    await updateMutation.mutateAsync({ data, action: 'co_edited', detail: 'Change order updated' });
    setEditing(false);
    toast.success('Change order saved');
  };

  const applyStatus = async (newStatus, notes) => {
    const data = { status: newStatus };
    if (newStatus === 'approved') { data.approval_date = new Date().toISOString(); data.approval_notes = notes; }
    if (newStatus === 'rejected') { data.rejection_date = new Date().toISOString(); data.rejection_notes = notes; }
    if (newStatus === 'sent')     { data.sent_date = new Date().toISOString(); }
    if (newStatus === 'closed')   { data.closed_date = new Date().toISOString(); }
    data.response_recorded_by = role || 'admin';
    await updateMutation.mutateAsync({
      data,
      action: newStatus === 'approved' ? 'approved' : newStatus === 'rejected' ? 'rejected' : newStatus === 'sent' ? 'sent_for_approval' : newStatus === 'closed' ? 'closed' : 'status_changed',
      detail: `Status changed to ${newStatus}${notes ? ': ' + notes : ''}`,
    });
    setShowResponseNote(false);
    setPendingStatus(null);
    setResponseNote('');
    toast.success(`Change order ${newStatus}`);
  };

  const handleStatusAction = (status) => {
    if (['approved','rejected'].includes(status)) {
      setPendingStatus(status);
      setShowResponseNote(true);
    } else {
      applyStatus(status, '');
    }
  };

  if (isLoading) return <AppLayout title="Change Order"><div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div></AppLayout>;
  if (!co) return (
    <AppLayout title="Change Order">
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">Change order not found.</p>
        <Button variant="outline" onClick={() => navigate('/change-orders')} className="rounded-xl"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
      </div>
    </AppLayout>
  );

  const impact = Number(co.total_financial_impact || 0);
  const files = (() => { try { return JSON.parse(co.files || '[]'); } catch { return []; } })();
  const existingNums = allCOs.map(c => c.co_number).filter(Boolean);

  return (
    <AppLayout title={co.co_number || 'Change Order'}>
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">

        <button onClick={() => navigate('/change-orders')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Change Orders
        </button>

        {editing ? (
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold text-foreground mb-4">Edit Change Order</p>
            <COForm initial={co} jobId={co.job_id} jobAddress={co.job_address} jobTitle={co.job_title} customerName={co.customer_name} existingNums={existingNums} jobs={jobs} onSave={saveEdits} onCancel={() => setEditing(false)} />
          </div>
        ) : (
          <>
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{co.co_number}</span>
                    <span className="text-xs text-muted-foreground">{CO_CATEGORY_LABELS[co.category]}</span>
                  </div>
                  <h1 className="text-base font-bold text-foreground">{co.title}</h1>
                  {co.job_address && <p className="text-sm text-muted-foreground mt-0.5">{co.job_address}</p>}
                  {co.customer_name && <p className="text-xs text-muted-foreground">{co.customer_name}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <COStatusBadge status={co.status} size="md" />
                    {impact !== 0 && (
                      <span className={`flex items-center gap-1 text-sm font-bold ${impact > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {impact > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {impact > 0 ? '+' : ''}${Math.abs(impact).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    {Number(co.time_impact_value || 0) !== 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />{co.time_impact_value > 0 ? '+' : ''}{co.time_impact_value} {co.time_impact_unit}
                      </span>
                    )}
                  </div>
                </div>
                {role === 'admin' && (
                  <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs gap-1 shrink-0" onClick={() => setEditing(true)}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                )}
              </div>
              {co.assigned_to && <p className="text-xs text-muted-foreground">Assigned: <span className="font-medium text-foreground">{co.assigned_to}</span></p>}
              {co.created_by_name && <p className="text-xs text-muted-foreground">Created by: <span className="font-medium text-foreground">{co.created_by_name}</span></p>}
              {co.created_date && <p className="text-xs text-muted-foreground">Created: {format(parseISO(co.created_date), 'MMMM d, yyyy')}</p>}
              {co.approval_date && <p className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Approved {format(parseISO(co.approval_date), 'MMM d, yyyy')}</p>}
              {co.rejection_date && <p className="text-xs text-red-600 font-medium flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />Rejected {format(parseISO(co.rejection_date), 'MMM d, yyyy')}</p>}
            </motion.div>

            {/* Details */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              {co.description && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Description of Change</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{co.description}</p>
                </div>
              )}
              {co.reason && (
                <div className="pt-3 border-t border-border/60">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Reason</p>
                  <p className="text-sm text-foreground">{co.reason}</p>
                </div>
              )}
              {co.scope_summary && (
                <div className="pt-3 border-t border-border/60">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Scope Summary</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{co.scope_summary}</p>
                </div>
              )}

              {/* Impact table */}
              <div className="pt-3 border-t border-border/60">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Impact Summary</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Cost Impact</span><span className="font-medium">{co.cost_impact > 0 ? '+' : ''}${Number(co.cost_impact || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax Impact</span><span className="font-medium">${Number(co.tax_impact || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm font-bold border-t border-border pt-1.5">
                    <span>Total Financial Impact</span>
                    <span className={impact >= 0 ? 'text-green-600' : 'text-red-600'}>{impact > 0 ? '+' : ''}${Math.abs(impact).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {Number(co.time_impact_value || 0) !== 0 && (
                    <div className="flex justify-between text-sm border-t border-border pt-1.5">
                      <span className="text-muted-foreground">Time Impact</span>
                      <span className="font-medium">{co.time_impact_value > 0 ? '+' : ''}{co.time_impact_value} {co.time_impact_unit}</span>
                    </div>
                  )}
                  {co.schedule_notes && <p className="text-xs text-muted-foreground">{co.schedule_notes}</p>}
                </div>
              </div>

              {co.internal_notes && (
                <div className="pt-3 border-t border-border/60">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Internal Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{co.internal_notes}</p>
                </div>
              )}
              {co.client_facing_notes && (
                <div className="pt-3 border-t border-border/60">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Client-Facing Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{co.client_facing_notes}</p>
                </div>
              )}
              {(co.approval_notes || co.rejection_notes) && (
                <div className="pt-3 border-t border-border/60">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Response Notes</p>
                  <p className="text-sm text-foreground">{co.approval_notes || co.rejection_notes}</p>
                </div>
              )}
            </div>

            {/* Files */}
            {files.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Paperclip className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Attachments ({files.length})</p>
                </div>
                <div className="space-y-2">
                  {files.map((url, i) => {
                    const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
                    return isImg ? (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden bg-muted hover:opacity-90 transition-opacity">
                        <img src={url} alt={`Attachment ${i + 1}`} className="w-full max-h-48 object-cover" />
                      </a>
                    ) : (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs bg-muted/60 rounded-lg px-3 py-2 hover:bg-muted transition-colors">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-foreground truncate">Attachment {i + 1}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            {role === 'admin' && !['approved','rejected','closed','canceled'].includes(co.status) && (
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  {co.status !== 'sent' && (
                    <Button variant="outline" className="h-9 rounded-xl text-sm gap-2" onClick={() => handleStatusAction('sent')}>
                      <Send className="w-3.5 h-3.5" /> Send for Approval
                    </Button>
                  )}
                  <Button className="h-9 rounded-xl text-sm gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleStatusAction('approved')}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </Button>
                  <Button variant="outline" className="h-9 rounded-xl text-sm gap-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleStatusAction('rejected')}>
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </Button>
                  <Select value={co.status} onValueChange={handleStatusAction}>
                    <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(CO_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {showResponseNote && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pt-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {pendingStatus === 'approved' ? 'Approval notes (optional)' : 'Rejection reason (optional)'}
                    </p>
                    <Textarea value={responseNote} onChange={e => setResponseNote(e.target.value)} placeholder="Add notes..." className="rounded-lg text-sm min-h-14" />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="rounded-lg" onClick={() => { setShowResponseNote(false); setPendingStatus(null); }}>Cancel</Button>
                      <Button size="sm" className={`rounded-lg ${pendingStatus === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white`}
                        onClick={() => applyStatus(pendingStatus, responseNote)}>
                        <Save className="w-3.5 h-3.5 mr-1" /> Confirm {pendingStatus === 'approved' ? 'Approval' : 'Rejection'}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* Linked Job */}
            {co.job_id && <LinkedJobPanel jobId={co.job_id} />}

            {/* Activity */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Activity Timeline</p>
              <COActivityFeed activities={[...activities].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))} />
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}