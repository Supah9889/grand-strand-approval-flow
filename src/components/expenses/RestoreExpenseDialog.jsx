/**
 * RestoreExpenseDialog — for archived expenses.
 * Options: Restore (back to active) or Delete Permanently.
 */
import React, { useState } from 'react';
import { Loader2, Trash2, AlertTriangle, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RestoreExpenseDialog({ expense, onRestore, onDelete, onCancel, saving }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!expense) return null;

  const expenseSummary = [
    expense.vendor_name || 'Unknown Vendor',
    expense.total_amount ? `$${Number(expense.total_amount).toFixed(2)}` : null,
    expense.expense_date || null,
  ].filter(Boolean).join(' · ');

  const isLinkedToJob = !!expense.job_id;
  const isSensitive = ['filed', 'confirmed'].includes(expense.inbox_status);

  if (confirmDelete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Permanently Delete?</p>
              <p className="text-xs text-muted-foreground mt-0.5">{expenseSummary}</p>
            </div>
          </div>
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 text-xs text-destructive space-y-1">
            <p className="font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> This cannot be undone.
            </p>
            <p>The expense record, receipt data, and all parsed items will be permanently removed.</p>
            {isLinkedToJob && <p className="font-medium">Linked to job: {expense.job_address}</p>}
            {isSensitive && <p className="font-medium">Warning: this record is filed/confirmed — deletion may affect accounting records.</p>}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 h-9 rounded-xl text-sm" onClick={() => setConfirmDelete(false)} disabled={saving}>
              Back
            </Button>
            <Button variant="destructive" className="flex-1 h-9 rounded-xl text-sm" onClick={onDelete} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Delete Forever'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ArchiveRestore className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Archived Expense</p>
            <p className="text-xs text-muted-foreground mt-0.5">{expenseSummary}</p>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={onRestore}
            disabled={saving}
            className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ArchiveRestore className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Restore</p>
                <p className="text-xs text-muted-foreground">Move back to the active Cost Inbox.</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setConfirmDelete(true)}
            disabled={saving}
            className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-destructive/30 hover:bg-destructive/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-4 h-4 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Delete Permanently</p>
                <p className="text-xs text-muted-foreground">Removes the record entirely. Cannot be undone.</p>
              </div>
            </div>
          </button>
        </div>

        <Button variant="ghost" className="w-full h-9 rounded-xl text-sm text-muted-foreground" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}