/**
 * DeleteExpenseDialog — confirmation modal before deleting/archiving an expense.
 * Uses soft-delete (sets inbox_status to 'archived').
 * Stronger warning shown for filed/confirmed records.
 */
import React from 'react';
import { Loader2, Trash2, AlertTriangle, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DeleteExpenseDialog({ expense, onConfirm, onCancel, saving }) {
  if (!expense) return null;

  const isSensitive = ['filed', 'confirmed'].includes(expense.inbox_status);
  const isLinkedToJob = !!expense.job_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        {/* Icon + title */}
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isSensitive ? 'bg-destructive/10' : 'bg-amber-100'}`}>
            {isSensitive ? <Trash2 className="w-5 h-5 text-destructive" /> : <Archive className="w-5 h-5 text-amber-600" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isSensitive ? 'Delete Filed Expense?' : 'Remove from Inbox?'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {expense.vendor_name || 'Unknown Vendor'}
              {expense.total_amount ? ` · $${Number(expense.total_amount).toFixed(2)}` : ''}
              {expense.expense_date ? ` · ${expense.expense_date}` : ''}
            </p>
          </div>
        </div>

        {/* Warning message */}
        <div className={`p-3 rounded-xl border text-xs space-y-1 ${isSensitive ? 'bg-destructive/5 border-destructive/20 text-destructive' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          {isSensitive ? (
            <>
              <p className="font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> This record is already filed or confirmed.
              </p>
              <p>Removing it may affect accounting or export records. This action will archive the record — an admin can restore it if needed.</p>
              {isLinkedToJob && <p className="font-medium">This expense is linked to a job: {expense.job_address}</p>}
            </>
          ) : (
            <p>This will archive the expense and remove it from the active inbox. An admin can restore it if needed.</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1 h-9 rounded-xl text-sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant={isSensitive ? 'destructive' : 'outline'}
            className={`flex-1 h-9 rounded-xl text-sm ${!isSensitive ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : ''}`}
            onClick={onConfirm}
            disabled={saving}
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : isSensitive ? 'Archive Anyway' : 'Archive'
            }
          </Button>
        </div>
      </div>
    </div>
  );
}