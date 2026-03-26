/**
 * CostInboxTable — inbox-style list of expense records.
 * Actions (Archive/Delete for active, Restore/Delete for archived) are inline
 * buttons on each row — no dropdown, no z-index layering issues.
 */
import React, { useState, useMemo } from 'react';
import { Search, AlertTriangle, CheckCircle2, Clock, FileText, Inbox, X, Copy, Trash2, ArchiveRestore, XCircle, Archive } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import { validateExpense } from '@/lib/validation';

const STATUS_CONFIG = {
  new:          { label: 'New',          color: 'bg-blue-100 text-blue-700' },
  in_review:    { label: 'In Review',    color: 'bg-amber-100 text-amber-700' },
  confirmed:    { label: 'Confirmed',    color: 'bg-green-100 text-green-700' },
  needs_review: { label: 'Needs Review', color: 'bg-red-100 text-red-700' },
  filed:        { label: 'Filed',        color: 'bg-slate-100 text-slate-600' },
  archived:     { label: 'Archived',     color: 'bg-muted text-muted-foreground' },
};

const MATCH_ICON = {
  matched:      <CheckCircle2 className="w-3 h-3 text-green-500" />,
  needs_review: <Clock className="w-3 h-3 text-amber-500" />,
  mismatch:     <AlertTriangle className="w-3 h-3 text-red-500" />,
};

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  try { return format(parseISO(d), 'MM/dd/yy'); } catch { return d; }
}

export default function CostInboxTable({ expenses, onOpen, onArchive, onDelete, onRestore, isLoading }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [sortBy, setSortBy] = useState('created_date');

  const filtered = useMemo(() => {
    let list = [...expenses];

    if (statusFilter === 'active') {
      list = list.filter(e => (e.inbox_status || 'new') !== 'archived');
    } else if (statusFilter === 'archived') {
      list = list.filter(e => (e.inbox_status || 'new') === 'archived');
    } else if (statusFilter === 'possible_duplicate') {
      list = list.filter(e => e.duplicate_status === 'possible_duplicate' || e.duplicate_status === 'needs_review');
    } else if (statusFilter !== 'all') {
      list = list.filter(e => (e.inbox_status || 'new') === statusFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.vendor_name?.toLowerCase().includes(q) ||
        e.job_address?.toLowerCase().includes(q) ||
        e.file_name?.toLowerCase().includes(q) ||
        e.receipt_number?.toLowerCase().includes(q) ||
        e.cost_code?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'amount') return (b.total_amount || 0) - (a.total_amount || 0);
      if (sortBy === 'vendor') return (a.vendor_name || '').localeCompare(b.vendor_name || '');
      if (sortBy === 'date')   return (b.expense_date || b.receipt_date || '').localeCompare(a.expense_date || a.receipt_date || '');
      return (b.created_date || '').localeCompare(a.created_date || '');
    });

    return list;
  }, [expenses, search, statusFilter, sortBy]);

  const counts = useMemo(() => {
    const active   = expenses.filter(e => (e.inbox_status || 'new') !== 'archived').length;
    const archived = expenses.filter(e => (e.inbox_status || 'new') === 'archived').length;
    const dupes    = expenses.filter(e => e.duplicate_status === 'possible_duplicate' || e.duplicate_status === 'needs_review').length;
    const perStatus = {};
    expenses.forEach(e => {
      const s = e.inbox_status || 'new';
      perStatus[s] = (perStatus[s] || 0) + 1;
    });
    return { active, archived, dupes, perStatus };
  }, [expenses]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Loading inbox…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: 'active',   label: `Active (${counts.active})` },
          { key: 'all',      label: `All (${expenses.length})` },
          ...(counts.dupes > 0    ? [{ key: 'possible_duplicate', label: `Duplicates (${counts.dupes})`, warn: true }] : []),
          ...(counts.archived > 0 ? [{ key: 'archived', label: `Archived (${counts.archived})` }] : []),
        ].map(({ key, label, warn }) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              statusFilter === key
                ? warn ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-foreground text-background border-foreground'
                : warn ? 'border-amber-200 text-amber-600 hover:border-amber-400' : 'border-border text-muted-foreground hover:border-primary/50'
            }`}>
            {label}
          </button>
        ))}
        {Object.entries(STATUS_CONFIG).filter(([key]) => key !== 'archived').map(([key, cfg]) => {
          const count = counts.perStatus[key] || 0;
          if (count === 0) return null;
          return (
            <button key={key} onClick={() => setStatusFilter(statusFilter === key ? 'active' : key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${statusFilter === key ? cfg.color + ' border-transparent' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search + sort */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendor, job, file…"
            className="pl-9 h-9 rounded-xl text-xs" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-9 w-36 rounded-xl text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created_date">Newest First</SelectItem>
            <SelectItem value="date">Purchase Date</SelectItem>
            <SelectItem value="amount">Amount</SelectItem>
            <SelectItem value="vendor">Vendor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Entries */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Inbox className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No expenses in inbox</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(expense => {
            const statusCfg = STATUS_CONFIG[expense.inbox_status || 'new'];
            const isPDF = expense.file_name?.match(/\.pdf$/i) || expense.receipt_image_url?.match(/\.pdf/i);
            const isArchived = expense.inbox_status === 'archived';
            const isDupe = expense.duplicate_status === 'possible_duplicate' || expense.duplicate_status === 'needs_review';
            const dupeIgnored = expense.duplicate_status === 'ignored';
            const validationErrors = !isArchived ? validateExpense(expense).filter(i => i.level === 'error') : [];
            const lineItemCount = (() => {
              try { return expense.line_items ? JSON.parse(expense.line_items).length : 0; } catch { return 0; }
            })();

            return (
              <div
                key={expense.id}
                className={`w-full bg-card border rounded-xl transition-all ${isArchived ? 'opacity-70 border-dashed border-muted' : 'border-border hover:border-primary/40 hover:shadow-sm'}`}
              >
                {/* Main info row — clickable to open/edit */}
                <button
                  type="button"
                  onClick={() => onOpen(expense)}
                  className="w-full text-left px-3 pt-3 pb-2"
                >
                  {/* Badges */}
                  {(isDupe || dupeIgnored || validationErrors.length > 0) && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      {isDupe && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                          <Copy className="w-2.5 h-2.5" /> Possible Duplicate
                        </span>
                      )}
                      {dupeIgnored && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          <Copy className="w-2.5 h-2.5" /> Duplicate Ignored
                        </span>
                      )}
                      {validationErrors.map((e, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[10px] text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                          <XCircle className="w-2.5 h-2.5 shrink-0" /> {e.message}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: icon + vendor + meta */}
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        {isPDF
                          ? <span className="text-[9px] font-bold text-red-500">PDF</span>
                          : <FileText className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${isArchived ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                          {expense.vendor_name || 'Unknown Vendor'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {expense.file_name || expense.store_location || (expense.receipt_number ? `#${expense.receipt_number}` : '—')}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {(expense.expense_date || expense.receipt_date) && (
                            <span className="text-xs text-muted-foreground">{fmtDate(expense.expense_date || expense.receipt_date)}</span>
                          )}
                          {expense.job_address && (
                            <span className="text-xs text-muted-foreground truncate max-w-[140px]">{expense.job_address}</span>
                          )}
                          {expense.cost_code && (
                            <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full">{expense.cost_code}</span>
                          )}
                          {expense.parsed_match_status && MATCH_ICON[expense.parsed_match_status]}
                          {lineItemCount > 0 && <span className="text-xs text-muted-foreground">{lineItemCount} items</span>}
                        </div>
                      </div>
                    </div>

                    {/* Right: amount + status */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">${fmt(expense.total_amount)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Action buttons — always visible, directly bound, no dropdown */}
                <div className="flex items-center gap-2 px-3 pb-2.5 pt-1 border-t border-border/40">
                  {!isArchived ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onArchive(expense)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-100 active:bg-amber-200 transition-colors"
                      >
                        <Archive className="w-3.5 h-3.5 shrink-0" />
                        Archive
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(expense)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-medium hover:bg-red-100 active:bg-red-200 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onRestore(expense)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/20 active:bg-primary/30 transition-colors"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5 shrink-0" />
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(expense)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-medium hover:bg-red-100 active:bg-red-200 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}