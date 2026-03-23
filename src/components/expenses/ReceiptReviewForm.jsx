import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { calcMatchStatus } from './ReceiptParser';
import ReceiptLineItems from './ReceiptLineItems';

const MATCH_CONFIG = {
  matched:      { label: 'Totals Matched',      icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-50 border-green-200' },
  needs_review: { label: 'Needs Review',         icon: Clock,         color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200' },
  mismatch:     { label: 'Mismatch Detected',    icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
};

const CONFIDENCE_LABEL = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence — review carefully' };

export default function ReceiptReviewForm({ parsed, fileUrl, fileName, jobs = [], onSave, onCancel, saving = false }) {
  const [header, setHeader] = useState({
    vendor_name:    parsed.vendor_name || '',
    store_location: parsed.store_location || '',
    receipt_date:   parsed.receipt_date || '',
    receipt_number: parsed.receipt_number || '',
    subtotal:       parsed.subtotal || '',
    discount_total: parsed.discount_total || '',
    tax_amount:     parsed.tax_amount || '',
    final_total:    parsed.final_total || '',
    payment_method: parsed.payment_method || '',
    notes:          parsed.notes || '',
    currency:       parsed.currency || 'USD',
    job_id:         '',
    job_address:    '',
    cost_code:      '',
    cost_code_id:   '',
  });
  const [lineItems, setLineItems] = useState(parsed.line_items || []);
  const [showHeader, setShowHeader] = useState(true);

  // Recalculate computed totals
  const itemSum = lineItems.reduce((s, item) => {
    return s + (parseFloat(item.unit_cost) || 0) * (parseFloat(item.quantity) || 1);
  }, 0);
  const computedTotal = itemSum + (parseFloat(header.tax_amount) || 0) - (parseFloat(header.discount_total) || 0);
  const receiptTotal = parseFloat(header.final_total) || 0;
  const matchStatus = calcMatchStatus(lineItems, header.final_total, header.tax_amount, header.discount_total);
  const matchCfg = MATCH_CONFIG[matchStatus];
  const MatchIcon = matchCfg.icon;
  const confidence = parsed.parse_confidence || 'medium';

  const handleJobSelect = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    setHeader(h => ({ ...h, job_id: jobId, job_address: job?.address || '' }));
  };

  const handleSave = () => {
    // Build line_items JSON for storage
    const itemsForStorage = lineItems.map(({ _id, ...rest }) => rest);
    onSave({
      vendor_name:    header.vendor_name,
      store_location: header.store_location,
      receipt_date:   header.receipt_date,
      expense_date:   header.receipt_date,
      receipt_number: header.receipt_number,
      subtotal:       parseFloat(header.subtotal) || 0,
      discount_total: parseFloat(header.discount_total) || 0,
      tax_amount:     parseFloat(header.tax_amount) || 0,
      total_amount:   receiptTotal || computedTotal,
      payment_method: header.payment_method,
      notes:          header.notes,
      job_id:         header.job_id,
      job_address:    header.job_address,
      cost_code:      header.cost_code,
      cost_code_id:   header.cost_code_id,
      receipt_image_url: fileUrl,
      file_name:      fileName,
      file_url:       fileUrl,
      line_items:     JSON.stringify(itemsForStorage),
      // Store parsing metadata
      parsed_confidence:     confidence,
      parsed_match_status:   matchStatus,
      parsed_item_count:     lineItems.length,
      source_system:         'receipt_scan',
      category:              'materials', // default, user can change
    });
  };

  return (
    <div className="space-y-4">
      {/* Parse confidence + match status bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium ${
          confidence === 'high' ? 'bg-green-50 text-green-700' :
          confidence === 'low'  ? 'bg-red-50 text-red-700' :
                                   'bg-amber-50 text-amber-700'
        }`}>
          {CONFIDENCE_LABEL[confidence] || 'Parsed'}
        </span>
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border font-medium ${matchCfg.bg} ${matchCfg.color}`}>
          <MatchIcon className="w-3 h-3" />
          {matchCfg.label}
        </span>
      </div>

      {/* Review warnings */}
      {matchStatus !== 'matched' && (
        <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${matchCfg.bg}`}>
          <MatchIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${matchCfg.color}`} />
          <p className={matchCfg.color}>
            {matchStatus === 'mismatch'
              ? `Mismatch detected: item totals sum to $${computedTotal.toFixed(2)} but receipt total is $${receiptTotal.toFixed(2)}. Please review before saving.`
              : 'Receipt was partially parsed or discounts could not be fully allocated. Review totals and items before saving.'
            }
          </p>
        </div>
      )}

      {/* Receipt file link */}
      {fileUrl && (
        <div className="flex items-center gap-2 p-2.5 bg-muted/40 rounded-xl border border-border">
          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex-1">
            {fileName || 'View uploaded receipt'}
          </a>
          <span className="text-[10px] text-muted-foreground font-mono uppercase">
            {fileName?.match(/\.pdf$/i) ? 'PDF' : 'IMG'}
          </span>
        </div>
      )}

      {/* Header fields toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowHeader(h => !h)}
          className="flex items-center gap-1.5 text-xs font-semibold text-foreground w-full"
        >
          {showHeader ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Receipt Header Fields
        </button>

        {showHeader && (
          <div className="mt-2 space-y-2">
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
                  <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue placeholder="Link to job (optional)" /></SelectTrigger>
                  <SelectContent>{jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address}</SelectItem>)}</SelectContent>
                </Select>
              </div>
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

      {/* Totals summary */}
      <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-1.5">
        <p className="text-xs font-semibold text-foreground mb-2">Totals</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <div>
            <label className="text-[10px] text-muted-foreground block">Subtotal (receipt)</label>
            <Input type="number" value={header.subtotal} onChange={e => setHeader(h => ({...h, subtotal: e.target.value}))}
              placeholder="0.00" className="h-8 rounded-lg text-xs mt-0.5" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block">Discount Total</label>
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
        {/* Comparison row */}
        <div className={`mt-2 flex items-center justify-between pt-2 border-t border-border/60 text-xs`}>
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

      {/* Line items */}
      <ReceiptLineItems items={lineItems} onChange={setLineItems} />

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1 h-10 rounded-xl text-sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          className="flex-2 h-10 rounded-xl text-sm flex-1"
          disabled={!header.vendor_name || saving}
          onClick={handleSave}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Expense'}
        </Button>
      </div>
    </div>
  );
}