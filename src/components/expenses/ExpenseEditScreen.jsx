/**
 * ExpenseEditScreen — unified create/edit screen for expenses.
 * Used for: new parsed receipt review, editing a filed expense.
 * Props:
 *   initialData   — parsed or existing expense object
 *   fileUrl       — uploaded file URL
 *   fileName      — uploaded file name
 *   jobs          — job list for linking
 *   onSave        — (expenseData) => void
 *   onCancel      — () => void
 *   saving        — boolean
 *   isEdit        — boolean (true = editing existing record)
 *   progressLabel — e.g. "Receipt 2 of 3" for multi-receipt queue
 *   expenseId     — existing expense id for updates
 */
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { calcMatchStatus } from './ReceiptParser';
import ReceiptLineItems from './ReceiptLineItems';
import AttachmentManager from '@/components/attachments/AttachmentManager';

const MATCH_CONFIG = {
  matched:      { label: 'Totals Matched',   icon: CheckCircle2,  color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  needs_review: { label: 'Needs Review',      icon: Clock,         color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  mismatch:     { label: 'Mismatch Detected', icon: AlertTriangle, color: 'text-red-600',   bg: 'bg-red-50 border-red-200' },
};
const CONFIDENCE_LABEL = {
  high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence — review carefully',
};

function normalizeLineItems(raw) {
  if (!raw) return [];
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return []; } }
  return (Array.isArray(raw) ? raw : []).map(item => ({
    _id: item._id || Math.random().toString(36).slice(2),
    title: item.title || '',
    quantity: String(item.quantity ?? 1),
    unit_cost: String(item.unit_cost ?? ''),
    unit: item.unit || 'EACH',
    line_total: String(item.line_total ?? ''),
    original_price: String(item.original_price ?? ''),
    discount_amount: String(item.discount_amount ?? ''),
    sku: item.sku || '',
    cost_code: item.cost_code || '',
    cost_code_id: item.cost_code_id || '',
  }));
}

export default function ExpenseEditScreen({
  initialData = {},
  fileUrl,
  fileName,
  jobs = [],
  onSave,
  onCancel,
  saving = false,
  isEdit = false,
  progressLabel = null,
  expenseId = null,
}) {
  const [header, setHeader] = useState({
    vendor_name:    initialData.vendor_name || '',
    store_location: initialData.store_location || '',
    receipt_date:   initialData.receipt_date || initialData.expense_date || '',
    receipt_number: initialData.receipt_number || '',
    subtotal:       initialData.subtotal != null ? String(initialData.subtotal) : '',
    discount_total: initialData.discount_total != null ? String(initialData.discount_total) : '',
    tax_amount:     initialData.tax_amount != null ? String(initialData.tax_amount) : '',
    final_total:    initialData.total_amount != null ? String(initialData.total_amount) :
                    initialData.final_total != null ? String(initialData.final_total) : '',
    payment_method: initialData.payment_method || '',
    notes:          initialData.notes || '',
    currency:       initialData.currency || 'USD',
    job_id:         initialData.job_id || '',
    job_address:    initialData.job_address || '',
    cost_code:      initialData.cost_code || '',
    cost_code_id:   initialData.cost_code_id || '',
    category:       initialData.category || 'materials',
  });

  const [lineItems, setLineItems] = useState(normalizeLineItems(initialData.line_items));
  const [showHeader, setShowHeader] = useState(true);

  const itemSum = lineItems.reduce((s, item) =>
    s + (parseFloat(item.unit_cost) || 0) * (parseFloat(item.quantity) || 1), 0);
  const computedTotal = itemSum + (parseFloat(header.tax_amount) || 0) - (parseFloat(header.discount_total) || 0);
  const receiptTotal = parseFloat(header.final_total) || 0;
  const matchStatus = calcMatchStatus(lineItems, header.final_total, header.tax_amount, header.discount_total);
  const matchCfg = MATCH_CONFIG[matchStatus];
  const MatchIcon = matchCfg.icon;
  const confidence = initialData.parsed_confidence || initialData.parse_confidence || null;

  const resolvedFileUrl = fileUrl || initialData.receipt_image_url || initialData.file_url;
  const resolvedFileName = fileName || initialData.file_name;

  const handleJobSelect = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    setHeader(h => ({ ...h, job_id: jobId, job_address: job?.address || '' }));
  };

  const handleSave = () => {
    const itemsForStorage = lineItems.map(({ _id, ...rest }) => rest);
    onSave({
      vendor_name:      header.vendor_name,
      store_location:   header.store_location,
      receipt_date:     header.receipt_date,
      expense_date:     header.receipt_date,
      receipt_number:   header.receipt_number,
      subtotal:         parseFloat(header.subtotal) || 0,
      discount_total:   parseFloat(header.discount_total) || 0,
      tax_amount:       parseFloat(header.tax_amount) || 0,
      total_amount:     receiptTotal || computedTotal,
      payment_method:   header.payment_method,
      notes:            header.notes,
      category:         header.category,
      job_id:           header.job_id,
      job_address:      header.job_address,
      cost_code:        header.cost_code,
      cost_code_id:     header.cost_code_id,
      receipt_image_url: resolvedFileUrl,
      file_name:        resolvedFileName,
      file_url:         resolvedFileUrl,
      line_items:       JSON.stringify(itemsForStorage),
      parsed_confidence:   confidence || initialData.parsed_confidence,
      parsed_match_status: matchStatus,
      parsed_item_count:   lineItems.length,
      source_system:       isEdit ? (initialData.source_system || 'app') : 'receipt_scan',
      inbox_status:        'confirmed',
    });
  };

  const CATEGORIES = [
    'materials','tools_equipment','fuel_travel','subcontractor',
    'permit_fees','disposal','meals','office_supplies','other'
  ];

  return (
    <div className="space-y-4">
      {/* Progress indicator (multi-receipt) */}
      {progressLabel && (
        <div className="flex items-center gap-2 text-xs text-primary font-semibold bg-primary/5 px-3 py-2 rounded-lg border border-primary/20">
          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">→</span>
          {progressLabel}
        </div>
      )}

      {/* Confidence + match status */}
      <div className="flex flex-wrap items-center gap-2">
        {confidence && (
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium ${
            confidence === 'high' ? 'bg-green-50 text-green-700' :
            confidence === 'low'  ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {CONFIDENCE_LABEL[confidence] || 'Parsed'}
          </span>
        )}
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border font-medium ${matchCfg.bg} ${matchCfg.color}`}>
          <MatchIcon className="w-3 h-3" />
          {matchCfg.label}
        </span>
      </div>

      {/* Review warning */}
      {matchStatus !== 'matched' && (
        <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${matchCfg.bg}`}>
          <MatchIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${matchCfg.color}`} />
          <p className={matchCfg.color}>
            {matchStatus === 'mismatch'
              ? `Mismatch: items total $${computedTotal.toFixed(2)} but receipt shows $${receiptTotal.toFixed(2)}. Review before saving.`
              : 'Partially parsed or discounts unclear. Review totals and items before saving.'}
          </p>
        </div>
      )}

      {/* File attachment */}
      {resolvedFileUrl && (
        <div className="flex items-center gap-2 p-2.5 bg-muted/40 rounded-xl border border-border">
          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <a href={resolvedFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex-1">
            {resolvedFileName || 'View receipt'}
          </a>
          <span className="text-[10px] text-muted-foreground font-mono uppercase shrink-0">
            {resolvedFileName?.match(/\.pdf$/i) ? 'PDF' : 'IMG'}
          </span>
        </div>
      )}

      {/* Header fields */}
      <div>
        <button type="button" onClick={() => setShowHeader(h => !h)}
          className="flex items-center gap-1.5 text-xs font-semibold text-foreground w-full mb-2">
          {showHeader ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Receipt Details
        </button>
        {showHeader && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">Vendor *</label>
                <Input value={header.vendor_name} onChange={e => setHeader(h => ({...h, vendor_name: e.target.value}))}
                  placeholder="Vendor / store name" className="h-9 rounded-lg text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">Date</label>
                <Input type="date" value={header.receipt_date} onChange={e => setHeader(h => ({...h, receipt_date: e.target.value}))}
                  className="h-9 rounded-lg text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">Store Location</label>
                <Input value={header.store_location} onChange={e => setHeader(h => ({...h, store_location: e.target.value}))}
                  placeholder="Store location" className="h-9 rounded-lg text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">Receipt #</label>
                <Input value={header.receipt_number} onChange={e => setHeader(h => ({...h, receipt_number: e.target.value}))}
                  placeholder="Receipt / transaction #" className="h-9 rounded-lg text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">Link to Job</label>
                <Select value={header.job_id} onValueChange={handleJobSelect}>
                  <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue placeholder="Link job (optional)" /></SelectTrigger>
                  <SelectContent>{jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">Category</label>
                <Select value={header.category} onValueChange={v => setHeader(h => ({...h, category: v}))}>
                  <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">Payment Method</label>
                <Input value={header.payment_method} onChange={e => setHeader(h => ({...h, payment_method: e.target.value}))}
                  placeholder="Cash / Card / etc." className="h-9 rounded-lg text-xs" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">Notes / Memo</label>
              <Textarea value={header.notes} onChange={e => setHeader(h => ({...h, notes: e.target.value}))}
                placeholder="Notes or memo" className="rounded-lg text-xs min-h-12" />
            </div>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
        <p className="text-xs font-semibold text-foreground">Totals</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <label className="text-[10px] text-muted-foreground block">Subtotal</label>
            <Input type="number" value={header.subtotal} onChange={e => setHeader(h => ({...h, subtotal: e.target.value}))}
              placeholder="0.00" className="h-8 rounded-lg text-xs mt-0.5" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block">Discount</label>
            <Input type="number" value={header.discount_total} onChange={e => setHeader(h => ({...h, discount_total: e.target.value}))}
              placeholder="0.00" className="h-8 rounded-lg text-xs mt-0.5" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block">Tax</label>
            <Input type="number" value={header.tax_amount} onChange={e => setHeader(h => ({...h, tax_amount: e.target.value}))}
              placeholder="0.00" className="h-8 rounded-lg text-xs mt-0.5" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block">Receipt Total (paid)</label>
            <Input type="number" value={header.final_total} onChange={e => setHeader(h => ({...h, final_total: e.target.value}))}
              placeholder="0.00" className="h-8 rounded-lg text-xs mt-0.5" />
          </div>
        </div>
        <div className="pt-2 border-t border-border/60 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Calculated from items</span>
            <span className={`font-semibold ${matchStatus === 'matched' ? 'text-green-600' : matchStatus === 'mismatch' ? 'text-red-600' : 'text-amber-600'}`}>
              ${computedTotal.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Receipt total</span>
            <span className="font-semibold text-foreground">${receiptTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Line items */}
      <ReceiptLineItems items={lineItems} onChange={setLineItems} />

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1 h-10 rounded-xl text-sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" className="flex-1 h-10 rounded-xl text-sm"
          disabled={!header.vendor_name || saving} onClick={handleSave}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save Changes' : 'Confirm & Save'}
        </Button>
      </div>
    </div>
  );
}