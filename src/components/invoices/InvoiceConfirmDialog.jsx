import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Archive, Trash2 } from 'lucide-react';

export default function InvoiceConfirmDialog({ type, invoice, onConfirm, onCancel }) {
  const isDelete = type === 'delete';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDelete ? 'bg-destructive/10' : 'bg-amber-100'}`}>
            {isDelete
              ? <Trash2 className="w-4 h-4 text-destructive" />
              : <Archive className="w-4 h-4 text-amber-600" />
            }
          </div>
          <div>
            <p className={`text-sm font-semibold ${isDelete ? 'text-destructive' : 'text-foreground'}`}>
              {isDelete ? 'Permanently Delete Invoice?' : 'Archive Invoice?'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Invoice <span className="font-mono font-medium">{invoice?.invoice_number}</span>
              {invoice?.customer_name ? ` — ${invoice.customer_name}` : ''}
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {isDelete
            ? 'This will permanently remove the invoice from the system. This action cannot be undone. Linked job summaries will be updated. An audit log entry will be created.'
            : 'Archiving will remove this invoice from active views while preserving the record and audit history. Archived invoices can be retrieved using the Archived filter.'
          }
        </p>

        {isDelete && (
          <div className="flex items-start gap-2 bg-destructive/5 border border-destructive/20 rounded-xl p-3">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">
              This is a destructive action. If this invoice has accounting significance, consider archiving instead.
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1 h-9 rounded-xl text-sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={isDelete ? 'destructive' : 'default'}
            className={`flex-1 h-9 rounded-xl text-sm gap-1.5 ${!isDelete ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
            onClick={onConfirm}
          >
            {isDelete ? <><Trash2 className="w-3.5 h-3.5" /> Delete Forever</> : <><Archive className="w-3.5 h-3.5" /> Archive</>}
          </Button>
        </div>
      </div>
    </div>
  );
}