import React, { useState } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AlertCircle, ExternalLink, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { BILL_STATUS_CONFIG, fmt } from '@/lib/financialHelpers';
import AttachmentManager from '@/components/attachments/AttachmentManager';
import { getInternalRole } from '@/lib/adminAuth';

export default function BillDetailCard({ bill, isOverdue, onStatusChange }) {
  const cfg = BILL_STATUS_CONFIG[bill.status] || BILL_STATUS_CONFIG.open;
  const [expanded, setExpanded] = useState(false);
  const role = getInternalRole();
  const isAdmin = role === 'admin';

  return (
    <div className={`bg-card border rounded-xl p-4 ${isOverdue ? 'border-red-200' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{bill.bill_number}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
            {isOverdue && (
              <span className="flex items-center gap-0.5 text-xs text-red-600 font-medium">
                <AlertCircle className="w-3 h-3" /> Overdue
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground">{bill.vendor_name}</p>
          {bill.description && <p className="text-xs text-foreground/80">{bill.description}</p>}
          {bill.job_address && <p className="text-xs text-muted-foreground truncate">{bill.job_address}</p>}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="capitalize">{bill.category}</span>
            {bill.bill_date && <span>{format(parseISO(bill.bill_date), 'MMM d, yyyy')}</span>}
            {bill.due_date && (
              <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                Due {format(parseISO(bill.due_date), 'MMM d, yyyy')}
              </span>
            )}
          </div>
          {bill.notes && <p className="text-xs text-muted-foreground mt-1 italic">{bill.notes}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <p className="text-base font-bold text-foreground">${fmt(bill.amount)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/60 flex-wrap">
        <Select value={bill.status} onValueChange={onStatusChange}>
          <SelectTrigger className="h-7 text-xs rounded-lg w-auto min-w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(BILL_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
        </Select>
        {bill.file_url && (
          <a href={bill.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
            {/\.pdf/i.test(bill.file_url) || /\.pdf$/i.test(bill.file_name || '')
              ? <><FileText className="w-3.5 h-3.5" /> View PDF</>
              : <><ExternalLink className="w-3.5 h-3.5" /> View File</>
            }
          </a>
        )}
        <button onClick={() => setExpanded(v => !v)} className="ml-auto text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border/60">
          <AttachmentManager
            recordType="bill"
            recordId={bill.id}
            jobId={bill.job_id}
            isAdmin={isAdmin}
            defaultCategory="vendor_document"
            defaultVisibility="internal"
          />
        </div>
      )}
    </div>
  );
}