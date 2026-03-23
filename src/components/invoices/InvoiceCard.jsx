import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AlertCircle, ChevronDown, ChevronUp, CreditCard, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { INVOICE_STATUS_CONFIG, fmt } from '@/lib/financialHelpers';
import AttachmentManager from '@/components/attachments/AttachmentManager';
import { getInternalRole } from '@/lib/adminAuth';
import { validateInvoice } from '@/lib/validation';
import { toast } from 'sonner';

const SOURCE_LABELS = { estimate: 'From Estimate', change_order: 'Change Order', manual: 'Manual' };

export default function InvoiceCard({ invoice: inv, payments = [], isOverdue, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const cfg = INVOICE_STATUS_CONFIG[inv.status] || INVOICE_STATUS_CONFIG.draft;
  const role = getInternalRole();
  const isAdmin = role === 'admin';

  const BLOCKED_STATUSES = ['paid', 'sent'];
  const handleStatusChange = (newStatus) => {
    if (BLOCKED_STATUSES.includes(newStatus)) {
      const errors = validateInvoice(inv).filter(i => i.level === 'error');
      if (errors.length > 0) {
        toast.error(errors[0].message);
        return;
      }
    }
    onStatusChange(newStatus);
  };
  const lines = (() => { try { return JSON.parse(inv.line_items || '[]'); } catch { return []; } })();
  const balanceDue = Number(inv.balance_due ?? inv.amount ?? 0);
  const amtPaid = Number(inv.amount_paid || 0);

  return (
    <div className={`bg-card border rounded-xl overflow-hidden ${isOverdue ? 'border-red-200' : 'border-border'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">{inv.invoice_number}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
              {isOverdue && <span className="flex items-center gap-0.5 text-xs text-red-600 font-medium"><AlertCircle className="w-3 h-3" />Overdue</span>}
              {inv.source_type && <span className="text-xs text-muted-foreground">{SOURCE_LABELS[inv.source_type]}</span>}
            </div>
            <p className="text-sm font-semibold text-foreground">{inv.customer_name}</p>
            {inv.title && <p className="text-xs text-foreground/70">{inv.title}</p>}
            {inv.job_address && <p className="text-xs text-muted-foreground truncate">{inv.job_address}</p>}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {inv.invoice_date && <span>{format(parseISO(inv.invoice_date), 'MMM d, yyyy')}</span>}
              {inv.due_date && <span className={isOverdue ? 'text-red-600 font-medium' : ''}>Due {format(parseISO(inv.due_date), 'MMM d, yyyy')}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <p className="text-base font-bold text-foreground">${fmt(inv.amount)}</p>
            {amtPaid > 0 && <p className="text-xs text-green-600">Paid: ${fmt(amtPaid)}</p>}
            {balanceDue > 0 && amtPaid > 0 && <p className="text-xs text-amber-600 font-medium">Bal: ${fmt(balanceDue)}</p>}
            <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground mt-1">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/60">
          <Select value={inv.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-7 text-xs rounded-lg w-auto min-w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(INVOICE_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
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
                  <span className="text-muted-foreground mx-3">{l.qty} × ${Number(l.unit_price).toFixed(2)}</span>
                  <span className="font-medium">${Number(l.total).toFixed(2)}</span>
                </div>
              ))}
              {inv.tax_amount > 0 && (
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-muted-foreground">Tax</span>
                  <span>${fmt(inv.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-1 border-t border-border">
                <span>Total</span><span>${fmt(inv.amount)}</span>
              </div>
            </div>
          )}

          {payments.length > 0 && (
            <div className="pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payments Applied</p>
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between text-xs py-1">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <CreditCard className="w-3 h-3" />
                    {p.payment_date ? format(parseISO(p.payment_date), 'MMM d, yyyy') : '—'}
                    · {p.payment_method?.toUpperCase()}
                  </span>
                  <span className="font-medium text-green-600">+${fmt(p.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {inv.notes && (
            <div className="pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
              <p className="text-xs text-foreground">{inv.notes}</p>
            </div>
          )}

          {inv.job_id && (
            <div className="pt-3">
              <button
                onClick={() => navigate(`/job-hub?jobId=${inv.job_id}`)}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
              >
                <ExternalLink className="w-3 h-3" /> View Job: {inv.job_address || inv.job_id}
              </button>
            </div>
          )}

          <div className="pt-3 border-t border-border/60 mt-3">
            <AttachmentManager
              recordType="invoice"
              recordId={inv.id}
              jobId={inv.job_id}
              isAdmin={isAdmin}
              defaultCategory="invoice_support"
              defaultVisibility="internal"
            />
          </div>
        </div>
      )}
    </div>
  );
}