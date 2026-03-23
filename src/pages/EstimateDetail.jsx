import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  ArrowLeft, Loader2, Send, CheckCircle2, X, Copy, Printer,
  DollarSign, FileText, History, RefreshCw, AlertCircle, Save
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import EstimateStatusBadge from '../components/estimates/EstimateStatusBadge';
import LineItemEditor from '../components/estimates/LineItemEditor';
import EstimateActivityFeed from '../components/estimates/EstimateActivityFeed';
import SendEstimateModal from '../components/estimates/SendEstimateModal';
import { ESTIMATE_STATUS_CONFIG, generateEstimateNumber, calcTotals } from '@/lib/estimateHelpers';
import { getInternalRole } from '@/lib/adminAuth';
import { toast } from 'sonner';
import LinkedJobPanel from '@/components/jobs/LinkedJobPanel';
import AttachmentManager from '@/components/attachments/AttachmentManager';
import { validateEstimate } from '@/lib/validation';
import ValidationPanel from '@/components/shared/ValidationPanel';

const SERVICE_TYPES = ['interior_painting','exterior_painting','cabinet_painting','deck_staining','commercial_painting','drywall_repair','power_washing','epoxy_floor','other'];
const lbl = s => s?.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()) || '';

export default function EstimateDetail() {
  const estimateId = window.location.pathname.split('/').pop();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getInternalRole();

  const [editing, setEditing] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [validationTouched, setValidationTouched] = useState(false);

  const { data: estimate, isLoading } = useQuery({
    queryKey: ['estimate', estimateId],
    queryFn: async () => {
      const res = await base44.entities.Estimate.filter({ id: estimateId });
      return res[0];
    },
    enabled: !!estimateId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['estimate-activities', estimateId],
    queryFn: () => base44.entities.EstimateActivity.filter({ estimate_id: estimateId }),
    enabled: !!estimateId,
  });

  const { data: allEstimates = [] } = useQuery({
    queryKey: ['estimates'],
    queryFn: () => base44.entities.Estimate.list('-created_date'),
  });

  // Versions of this estimate (same parent or this is parent)
  const versions = allEstimates.filter(e =>
    e.id === estimateId || e.parent_estimate_id === estimateId ||
    (estimate?.parent_estimate_id && (e.id === estimate.parent_estimate_id || e.parent_estimate_id === estimate.parent_estimate_id))
  ).sort((a, b) => (a.version || 1) - (b.version || 1));

  useEffect(() => {
    if (estimate && !form) {
      setForm({ ...estimate });
      setLineItems(() => {
        try { return JSON.parse(estimate.line_items || '[]'); } catch { return []; }
      });
    }
  }, [estimate]);

  const updateMutation = useMutation({
    mutationFn: async ({ data, logAction, logDetail }) => {
      await base44.entities.Estimate.update(estimateId, data);
      if (logAction) {
        await base44.entities.EstimateActivity.create({
          estimate_id: estimateId,
          action: logAction,
          detail: logDetail || '',
          actor: role || 'admin',
          timestamp: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] });
      queryClient.invalidateQueries({ queryKey: ['estimate-activities', estimateId] });
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
    },
  });

  const saveEdits = async () => {
    if (!form) return;
    const issues = validateEstimate(form, lineItems);
    const errors = issues.filter(i => i.level === 'error');
    setValidationTouched(true);
    if (errors.length > 0) { toast.error('Fix the validation errors before saving'); return; }
    setSaving(true);
    const totals = calcTotals(lineItems, form.tax_rate || 0, form.discount_amount || 0);
    await updateMutation.mutateAsync({
      data: { ...form, ...totals, line_items: JSON.stringify(lineItems) },
      logAction: 'estimate_edited',
      logDetail: 'Estimate fields and line items updated',
    });
    setSaving(false);
    setEditing(false);
    setValidationTouched(false);
    toast.success('Estimate saved');
  };

  const changeStatus = (newStatus) => {
    // Block sent/approved if critical fields missing
    const BLOCKED = ['sent', 'approved'];
    if (BLOCKED.includes(newStatus) && form) {
      const issues = validateEstimate(form, lineItems);
      const errors = issues.filter(i => i.level === 'error');
      if (errors.length > 0) {
        toast.error(errors[0].message);
        return;
      }
    }
    const data = { status: newStatus };
    if (newStatus === 'approved') data.approval_date = new Date().toISOString();
    if (newStatus === 'rejected') data.rejection_date = new Date().toISOString();
    updateMutation.mutate({
      data,
      logAction: newStatus === 'approved' ? 'estimate_approved' : newStatus === 'rejected' ? 'estimate_rejected' : 'status_changed',
      logDetail: `Status changed to: ${lbl(newStatus)}`,
    });
    toast.success(`Status updated to ${lbl(newStatus)}`);
  };

  const createRevision = async () => {
    const nums = allEstimates.map(e => e.estimate_number).filter(Boolean);
    // Mark current as superseded
    await base44.entities.Estimate.update(estimateId, { status: 'superseded', is_current_version: false });
    const newVersion = (estimate.version || 1) + 1;
    const newEst = await base44.entities.Estimate.create({
      ...estimate,
      id: undefined,
      created_date: undefined,
      updated_date: undefined,
      estimate_number: estimate.estimate_number,
      version: newVersion,
      is_current_version: true,
      parent_estimate_id: estimate.parent_estimate_id || estimateId,
      status: 'draft',
      approval_date: undefined,
      rejection_date: undefined,
      sent_date: undefined,
      viewed_date: undefined,
      email_history: '[]',
      generated_document_url: undefined,
      date_created: new Date().toISOString(),
    });
    await base44.entities.EstimateActivity.create({
      estimate_id: newEst.id,
      action: 'revision_created',
      detail: `Revision v${newVersion} created from v${estimate.version || 1}`,
      actor: role || 'admin',
      timestamp: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['estimates'] });
    navigate(`/estimates/${newEst.id}`);
    toast.success(`Revision v${newVersion} created`);
  };

  if (isLoading || !form) {
    return <AppLayout title="Estimate"><div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div></AppLayout>;
  }

  if (!estimate) {
    return (
      <AppLayout title="Estimate">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-muted-foreground">Estimate not found.</p>
          <Button variant="outline" onClick={() => navigate('/estimates')} className="rounded-xl"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        </div>
      </AppLayout>
    );
  }

  const totals = calcTotals(lineItems, form.tax_rate || 0, form.discount_amount || 0);
  const isLocked = ['approved','rejected','superseded','canceled'].includes(estimate.status) && !editing;

  return (
    <AppLayout title={estimate.estimate_number || 'Estimate'}>
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">

        {/* Back */}
        <button onClick={() => navigate('/estimates')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Estimates
        </button>

        {/* Header card */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-mono text-muted-foreground">{estimate.estimate_number}</p>
                {estimate.version > 1 && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">v{estimate.version}</span>}
                <span className="text-xs text-muted-foreground capitalize">{lbl(estimate.estimate_type)}</span>
              </div>
              <h1 className="text-lg font-bold text-foreground">{form.client_name || 'Untitled Estimate'}</h1>
              {form.title && <p className="text-sm text-muted-foreground">{form.title}</p>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <EstimateStatusBadge status={estimate.status} size="md" />
                {estimate.approval_date && (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approved {format(parseISO(estimate.approval_date), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {estimate.total > 0 && (
                <p className="text-2xl font-black text-primary">${Number(estimate.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              )}
              {!editing && !isLocked && (
                <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs" onClick={() => setEditing(true)}>Edit</Button>
              )}
            </div>
          </div>

          {/* Versions */}
          {versions.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Versions:</span>
              {versions.map(v => (
                <button key={v.id} onClick={() => navigate(`/estimates/${v.id}`)}
                  className={`text-xs px-2 py-0.5 rounded-lg border transition-colors ${v.id === estimateId ? 'bg-primary text-white border-primary' : 'border-border hover:border-primary/30'}`}>
                  v{v.version || 1}
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Edit / View form */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-5">

          {/* Client & Type */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Client & Type</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Client Name *</label>
                {editing ? <Input value={form.client_name || ''} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} className="h-9 rounded-lg text-sm" />
                  : <p className="text-sm text-foreground">{form.client_name || '—'}</p>}
              </div>
              {[['Company', 'company_name'], ['Email', 'client_email'], ['Phone', 'client_phone']].map(([l, k]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{l}</label>
                  {editing ? <Input value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="h-9 rounded-lg text-sm" />
                    : <p className="text-sm text-foreground">{form[k] || '—'}</p>}
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
                {editing ? (
                  <Select value={form.estimate_type || 'estimate'} onValueChange={v => setForm(f => ({ ...f, estimate_type: v }))}>
                    <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['estimate','proposal','bid','change_order'].map(t => <SelectItem key={t} value={t}>{lbl(t)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : <p className="text-sm text-foreground">{lbl(form.estimate_type)}</p>}
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Property Address</label>
                {editing ? <Input value={form.property_address || ''} onChange={e => setForm(f => ({ ...f, property_address: e.target.value }))} className="h-9 rounded-lg text-sm" />
                  : <p className="text-sm text-foreground">{form.property_address || '—'}</p>}
              </div>
            </div>
          </div>

          {/* Scope */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Scope</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
                {editing ? <Input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Full Exterior Repaint" className="h-9 rounded-lg text-sm" />
                  : <p className="text-sm text-foreground">{form.title || '—'}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Scope Summary</label>
                {editing ? <Textarea value={form.scope_summary || ''} onChange={e => setForm(f => ({ ...f, scope_summary: e.target.value }))} className="rounded-lg text-sm min-h-16" />
                  : <p className="text-sm text-foreground whitespace-pre-wrap">{form.scope_summary || '—'}</p>}
              </div>
              {(editing || form.detailed_scope) && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Detailed Scope</label>
                  {editing ? <Textarea value={form.detailed_scope || ''} onChange={e => setForm(f => ({ ...f, detailed_scope: e.target.value }))} className="rounded-lg text-sm min-h-24" />
                    : <p className="text-sm text-foreground whitespace-pre-wrap">{form.detailed_scope}</p>}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Service Type</label>
                  {editing ? (
                    <Select value={form.service_type || ''} onValueChange={v => setForm(f => ({ ...f, service_type: v }))}>
                      <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{lbl(t)}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <p className="text-sm text-foreground">{lbl(form.service_type) || '—'}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Billing Type</label>
                  {editing ? (
                    <Select value={form.billing_type || ''} onValueChange={v => setForm(f => ({ ...f, billing_type: v }))}>
                      <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{['customer_pay','insurance','builder','property_manager','other'].map(t => <SelectItem key={t} value={t}>{lbl(t)}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <p className="text-sm text-foreground">{lbl(form.billing_type) || '—'}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Line Items</p>
            {editing ? (
              <LineItemEditor items={lineItems} onChange={setLineItems} />
            ) : (
              <div className="space-y-1">
                {lineItems.length === 0 ? <p className="text-sm text-muted-foreground">No line items</p> : (
                  lineItems.map(li => (
                    <div key={li.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                      <p className="text-sm text-foreground flex-1">{li.description || '—'}</p>
                      <p className="text-xs text-muted-foreground">{li.qty} × ${Number(li.unit_price).toFixed(2)}</p>
                      <p className="text-sm font-semibold text-foreground w-20 text-right">${(Number(li.qty) * Number(li.unit_price)).toFixed(2)}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Totals */}
            <div className="mt-4 space-y-1.5 border-t border-border pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">${(editing ? totals.subtotal : Number(estimate.subtotal)).toFixed(2)}</span>
              </div>
              {editing && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tax Rate (%)</span>
                  <Input type="number" min="0" max="100" step="0.1" value={form.tax_rate || 0} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} className="w-20 h-7 text-right text-sm rounded-lg" />
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium">${(editing ? totals.tax_amount : Number(estimate.tax_amount)).toFixed(2)}</span>
              </div>
              {(editing || form.discount_amount > 0) && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Discount</span>
                  {editing ? <Input type="number" min="0" step="0.01" value={form.discount_amount || 0} onChange={e => setForm(f => ({ ...f, discount_amount: e.target.value }))} className="w-24 h-7 text-right text-sm rounded-lg" />
                    : <span className="text-sm font-medium">-${Number(form.discount_amount).toFixed(2)}</span>}
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t border-border pt-2">
                <span>Total</span>
                <span className="text-primary">${(editing ? totals.total : Number(estimate.total)).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dates & Assignment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Expiration Date</label>
                {editing ? <Input type="date" value={form.expiration_date?.split('T')[0] || ''} onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value }))} className="h-9 rounded-lg text-sm" />
                  : <p className="text-sm text-foreground">{form.expiration_date ? format(parseISO(form.expiration_date.split('T')[0]), 'MMM d, yyyy') : '—'}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Assigned To</label>
                {editing ? <Input value={form.assigned_to || ''} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="h-9 rounded-lg text-sm" />
                  : <p className="text-sm text-foreground">{form.assigned_to || '—'}</p>}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Notes</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Internal Notes</label>
                {editing ? <Textarea value={form.internal_notes || ''} onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))} className="rounded-lg text-sm min-h-16" />
                  : <p className="text-sm text-foreground">{form.internal_notes || '—'}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Client-Facing Notes</label>
                {editing ? <Textarea value={form.client_facing_notes || ''} onChange={e => setForm(f => ({ ...f, client_facing_notes: e.target.value }))} className="rounded-lg text-sm min-h-16" />
                  : <p className="text-sm text-foreground">{form.client_facing_notes || '—'}</p>}
              </div>
            </div>
          </div>

          {/* Save/cancel editing */}
          {editing && (
            <div className="flex gap-2 border-t border-border pt-4">
              <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={() => { setEditing(false); setForm({ ...estimate }); setLineItems(() => { try { return JSON.parse(estimate.line_items || '[]'); } catch { return []; } }); }}>Cancel</Button>
              <Button className="flex-1 h-10 rounded-xl gap-2" onClick={saveEdits} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save Changes</>}
              </Button>
            </div>
          )}
        </div>

        {/* Actions */}
        {!editing && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-9 rounded-xl text-sm gap-2" onClick={() => setShowSend(true)} disabled={estimate.status === 'approved' || estimate.status === 'rejected'}>
                <Send className="w-4 h-4" /> Send
              </Button>
              <Button variant="outline" className="h-9 rounded-xl text-sm gap-2" onClick={createRevision} disabled={estimate.status === 'approved'}>
                <RefreshCw className="w-4 h-4" /> New Revision
              </Button>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Update Status</label>
              <Select value={estimate.status} onValueChange={changeStatus}>
                <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ESTIMATE_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {estimate.status === 'approved' && !estimate.linked_job_id && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700">
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                This estimate is approved. You can convert the linked lead to a job from the CRM module.
              </div>
            )}

            {/* Approval/rejection notes */}
            {(estimate.status === 'approved' || estimate.status === 'rejected') && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Response Notes</label>
                <Textarea
                  value={form.response_notes || ''}
                  onChange={e => setForm(f => ({ ...f, response_notes: e.target.value }))}
                  placeholder="Optional notes from client response..."
                  className="rounded-lg text-sm min-h-14"
                />
                <Button size="sm" className="h-7 rounded-lg text-xs mt-1" onClick={() => updateMutation.mutate({ data: { response_notes: form.response_notes }, logAction: 'estimate_edited', logDetail: 'Response notes updated' })}>
                  Save Notes
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Email history */}
        {(() => {
          const history = (() => { try { return JSON.parse(estimate.email_history || '[]'); } catch { return []; } })();
          return history.length > 0 ? (
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Email History</p>
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Send className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-foreground font-medium">{h.subject}</p>
                      <p className="text-muted-foreground">To: {h.to} · {h.sent_at ? format(parseISO(h.sent_at), 'MMM d, yyyy h:mm a') : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null;
        })()}

        {/* Linked Job */}
        {estimate.job_id && <LinkedJobPanel jobId={estimate.job_id} />}

        {/* Attachments */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <AttachmentManager
            recordType="estimate"
            recordId={estimateId}
            jobId={estimate.job_id}
            isAdmin={role === 'admin'}
            defaultCategory="estimate"
            defaultVisibility="internal"
          />
        </div>

        {/* Activity */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Activity Timeline</p>
          <EstimateActivityFeed activities={[...activities].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))} />
        </div>
      </div>

      <SendEstimateModal
        estimate={estimate}
        open={showSend}
        onClose={() => setShowSend(false)}
        onSent={() => {
          setShowSend(false);
          queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] });
          queryClient.invalidateQueries({ queryKey: ['estimate-activities', estimateId] });
          queryClient.invalidateQueries({ queryKey: ['estimates'] });
        }}
      />
    </AppLayout>
  );
}