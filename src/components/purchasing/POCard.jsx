import React, { useState } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { PO_STATUS_CONFIG, fmt } from '@/lib/financialHelpers';

export default function POCard({ po, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = PO_STATUS_CONFIG[po.status] || PO_STATUS_CONFIG.draft;
  const lines = (() => { try { return JSON.parse(po.line_items || '[]'); } catch { return []; } })();

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono text-muted-foreground">{po.po_number}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{po.vendor_name}</p>
            {po.title && <p className="text-xs text-muted-foreground">{po.title}</p>}
            {po.job_address && <p className="text-xs text-muted-foreground truncate">{po.job_address}</p>}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {po.date_created && <span>{format(parseISO(po.date_created), 'MMM d, yyyy')}</span>}
              {po.expected_delivery && <span>Delivery: {format(parseISO(po.expected_delivery), 'MMM d')}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <p className="text-base font-bold text-foreground">${fmt(po.total)}</p>
            <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground transition-colors">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/60">
          <Select value={po.status} onValueChange={onStatusChange}>
            <SelectTrigger className="h-7 text-xs rounded-lg flex-1 max-w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PO_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {po.file_url && (
            <a href={po.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> View Doc
            </a>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/60 bg-muted/20">
          {lines.length > 0 && (
            <div className="pt-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Line Items</p>
              {lines.map((l, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                  <span className="flex-1 text-foreground">{l.description || '—'}</span>
                  <span className="text-muted-foreground mx-3">{l.qty} × ${Number(l.unit_cost).toFixed(2)}</span>
                  <span className="font-medium">${Number(l.total).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-end pt-1">
                <span className="text-sm font-bold">Total: ${fmt(po.total)}</span>
              </div>
            </div>
          )}
          {po.notes && (
            <div className="pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
              <p className="text-xs text-foreground">{po.notes}</p>
            </div>
          )}
          {po.created_by_name && (
            <p className="text-xs text-muted-foreground mt-2">Created by {po.created_by_name}</p>
          )}
        </div>
      )}
    </div>
  );
}