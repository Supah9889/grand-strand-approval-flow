/**
 * DuplicateWarningModal — shown when a newly saved expense closely matches existing records.
 * Allows human review/override before proceeding.
 */
import React from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';

function fmtDate(d) {
  if (!d) return '—';
  try { return format(parseISO(d), 'MM/dd/yy'); } catch { return d; }
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CONFIDENCE_LABELS = {
  high:   { label: 'Likely Duplicate',   color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
  medium: { label: 'Possible Duplicate', color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200' },
  low:    { label: 'Similar Record',     color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200' },
};

export default function DuplicateWarningModal({ newExpense, matches, onKeepBoth, onDiscard, onIgnore }) {
  if (!matches || matches.length === 0) return null;

  // Highest confidence match determines overall banner
  const topConfidence = matches[0]?.confidence || 'medium';
  const cfg = CONFIDENCE_LABELS[topConfidence];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Copy className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{cfg.label} Found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {matches.length} possible match{matches.length > 1 ? 'es' : ''} already in the inbox. Review before saving.
            </p>
          </div>
        </div>

        {/* New expense summary */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1.5">New Entry</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-muted-foreground">Vendor</span>
            <span className="font-medium text-foreground truncate">{newExpense.vendor_name || '—'}</span>
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium">{fmtDate(newExpense.expense_date || newExpense.receipt_date)}</span>
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">${fmt(newExpense.total_amount)}</span>
            {newExpense.receipt_number && <>
              <span className="text-muted-foreground">Receipt #</span>
              <span className="font-medium">{newExpense.receipt_number}</span>
            </>}
            {newExpense.job_address && <>
              <span className="text-muted-foreground">Job</span>
              <span className="font-medium truncate">{newExpense.job_address}</span>
            </>}
          </div>
        </div>

        {/* Matching records */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Matching Existing Records</p>
          {matches.map((match, i) => (
            <div key={match.expense.id || i} className={`border rounded-xl p-3 ${cfg.bg}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.color}`}>
                  {cfg.label} · {match.reasons.join(', ')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Vendor</span>
                <span className="font-medium truncate">{match.expense.vendor_name || '—'}</span>
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{fmtDate(match.expense.expense_date || match.expense.receipt_date)}</span>
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">${fmt(match.expense.total_amount)}</span>
                {match.expense.receipt_number && <>
                  <span className="text-muted-foreground">Receipt #</span>
                  <span className="font-medium">{match.expense.receipt_number}</span>
                </>}
                {match.expense.job_address && <>
                  <span className="text-muted-foreground">Job</span>
                  <span className="font-medium truncate">{match.expense.job_address}</span>
                </>}
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{match.expense.inbox_status || 'new'}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <p className="text-[10px] text-muted-foreground">What would you like to do?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-9 rounded-xl text-xs border-destructive/30 text-destructive hover:bg-destructive/5"
              onClick={onDiscard}>
              Discard New Entry
            </Button>
            <Button variant="outline" className="h-9 rounded-xl text-xs"
              onClick={onKeepBoth}>
              Keep Both Records
            </Button>
          </div>
          <Button variant="ghost" className="w-full h-8 rounded-xl text-xs text-muted-foreground"
            onClick={onIgnore}>
            Ignore Warning — Save Anyway
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          Legitimate repeat purchases at the same vendor are fine — use "Keep Both Records" in that case.
        </p>
      </div>
    </div>
  );
}