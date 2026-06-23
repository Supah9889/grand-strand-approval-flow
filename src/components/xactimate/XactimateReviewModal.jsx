import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, CheckCircle2, XCircle, FileText, Loader2, ExternalLink, AlertTriangle } from 'lucide-react';

const STATUS_COLORS = {
  uploaded:     'bg-blue-100 text-blue-700',
  needs_review: 'bg-amber-100 text-amber-700',
  approved:     'bg-green-100 text-green-700',
  rejected:     'bg-red-100 text-red-700',
  imported:     'bg-primary/10 text-primary',
};

export default function XactimateReviewModal({ item, company, session, onClose, onUpdated }) {
  const [form, setForm] = useState({
    customer_name: item.customer_name || '',
    property_address: item.property_address || '',
    claim_number: item.claim_number || '',
    loss_date: item.loss_date || '',
    loss_type: item.loss_type || '',
    carrier_name: item.carrier_name || '',
    adjuster_name: item.adjuster_name || '',
    adjuster_phone: item.adjuster_phone || '',
    scope_summary: item.scope_summary || '',
    review_notes: item.review_notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAction = async (action) => {
    setSaving(true);
    setError('');
    try {
      const reviewerName = session?.employee?.name || 'Admin';
      if (action === 'approve') {
        // Create a Job from this import
        const job = await base44.entities.Job.create({
          title: `${form.loss_type || 'Restoration'} — ${form.customer_name || 'Unknown'}`,
          address: form.property_address || '',
          customer_name: form.customer_name || '',
          description: form.scope_summary || `Xactimate import: ${item.file_name}`,
          price: 0,
          lifecycle_status: 'presale',
          op_status: 'needs_review',
          job_group: 'insurance',
          source_system: 'app',
          internal_notes: `Imported from Xactimate file: ${item.file_name}\nClaim: ${form.claim_number}\nCarrier: ${form.carrier_name}`,
        });
        await base44.entities.XactimateImport.update(item.id, {
          ...form,
          status: 'approved',
          reviewer_name: reviewerName,
          reviewed_at: new Date().toISOString(),
          imported_job_id: job.id,
        });
      } else {
        await base44.entities.XactimateImport.update(item.id, {
          ...form,
          status: 'rejected',
          reviewer_name: reviewerName,
          reviewed_at: new Date().toISOString(),
        });
      }
      onUpdated();
    } catch (e) {
      setError(e.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOnly = async () => {
    setSaving(true);
    setError('');
    try {
      await base44.entities.XactimateImport.update(item.id, { ...form, status: 'needs_review' });
      onUpdated();
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const canAct = !['approved','rejected','imported'].includes(item.status);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
      <div className="w-full sm:max-w-2xl bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-xl flex flex-col max-h-[95dvh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold text-foreground truncate">{item.file_name}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_COLORS[item.status] || STATUS_COLORS.uploaded}`}>
              {item.status?.replace('_', ' ')}
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {item.file_url && (
            <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> View original file
            </a>
          )}

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Extracted Information</p>
          <p className="text-[11px] text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            Review and correct the information below before approving. Approving will create a Job record.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { k: 'customer_name', label: 'Customer Name' },
              { k: 'property_address', label: 'Property Address' },
              { k: 'claim_number', label: 'Claim Number' },
              { k: 'loss_date', label: 'Loss Date', type: 'date' },
              { k: 'loss_type', label: 'Loss Type' },
              { k: 'carrier_name', label: 'Insurance Carrier' },
              { k: 'adjuster_name', label: 'Adjuster Name' },
              { k: 'adjuster_phone', label: 'Adjuster Phone', type: 'tel' },
            ].map(({ k, label, type }) => (
              <div key={k} className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <Input value={form[k]} onChange={e => set(k, e.target.value)} type={type || 'text'} disabled={!canAct} />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Scope Summary</label>
            <textarea
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[96px] resize-none disabled:opacity-60"
              value={form.scope_summary}
              onChange={e => set('scope_summary', e.target.value)}
              disabled={!canAct}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Reviewer Notes</label>
            <textarea
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[64px] resize-none"
              value={form.review_notes}
              onChange={e => set('review_notes', e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border">
          {canAct ? (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={handleSaveOnly} disabled={saving} className="flex-1 sm:flex-none">
                Save Draft
              </Button>
              <Button
                className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                disabled={saving}
                onClick={() => handleAction('approve')}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Approve & Create Job
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/5"
                disabled={saving}
                onClick={() => handleAction('reject')}
              >
                <XCircle className="w-4 h-4" /> Reject
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {item.status === 'approved' ? `Approved by ${item.reviewer_name}` : `Rejected by ${item.reviewer_name}`}
              </p>
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}