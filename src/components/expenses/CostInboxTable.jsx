/**
 * CostInboxTable — inbox-style list of expense records.
 * Supports delete (archive), duplicate badges, and filter by duplicate status.
 */
import React, { useState, useMemo } from 'react';
import { Search, AlertTriangle, CheckCircle2, Clock, FileText, Inbox, X, Copy, Trash2, MoreHorizontal, ArchiveRestore, XCircle, Archive } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import { validateExpense } from '@/lib/validation';

const STATUS_CONFIG = {
  new:          { label: 'New',          color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  in_review:    { label: 'In Review',    color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400' },
  confirmed:    { label: 'Confirmed',    color: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  needs_review: { label: 'Needs Review', color: 'bg-red-100 text-red-700',      dot: 'bg-red-500'   },
  filed:        { label: 'Filed',        color: 'bg-slate-100 text-slate-600',  dot: 'bg-slate-400' },
  archived:     { label: 'Archived',     color: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
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
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' hides archived by default
  const [sortBy, setSortBy] = useState('created_date');
  const [menuOpenId, setMenuOpenId] = useState(null);

  const filtered = useMemo(() => {
    let list = [...expenses];

    // Status filter
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
    const active    = expenses.filter(e => (e.inbox_status || 'new') !== 'archived').length;
    const archived  = expenses.filter(e => (e.inbox_status || 'new') === 'archived').length;
    const dupes     = expenses.filter(e => e.duplicate_status === 'possible_duplicate' || e.duplicate_status === 'needs_review').length;
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
          { key: 'active',             label: `Active (${counts.active})` },
          { key: 'all',                label: `All (${expenses.length})` },
          ...(counts.dupes > 0 ? [{ key: 'possible_duplicate', label: `Duplicates (${counts.dupes})`, warn: true }] : []),
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
        {Object.entries(STATUS_CONFIG).filter(([key]) => !['archived'].includes(key)).map(([key, cfg]) => {
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
        <div className="space-y-1.5">
          {/* Column header — desktop */}
          <div className="hidden md:grid grid-cols-[auto_1fr_1fr_auto_auto_auto_auto] gap-3 px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            <span className="w-8" />
            <span>Vendor / File</span>
            <span>Job</span>
            <span>Date</span>
            <span>Amount</span>
            <span>Status</span>
            <span className="w-8" />
          </div>

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
                className={`relative w-full bg-card border rounded-xl group transition-all ${isArchived ? 'opacity-60 border-dashed border-muted' : 'border-border hover:border-primary/40 hover:shadow-sm'}`}
              >
                {/* Main clickable row */}
                <button
                  onClick={() => { setMenuOpenId(null); onOpen(expense); }}
                  className="w-full text-left p-3"
                >
                  {/* Duplicate + validation badges */}
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

                  {/* Mobile layout */}
                  <div className="md:hidden space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isArchived ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                          {expense.vendor_name || 'Unknown Vendor'}
                        </p>
                        {expense.store_location && <p className="text-xs text-muted-foreground truncate">{expense.store_location}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                        <p className="text-sm font-bold text-primary">${fmt(expense.total_amount)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {(expense.expense_date || expense.receipt_date) && (
                        <span className="text-xs text-muted-foreground">{fmtDate(expense.expense_date || expense.receipt_date)}</span>
                      )}
                      {expense.job_address && <span className="text-xs text-muted-foreground truncate max-w-[160px]">{expense.job_address}</span>}
                      {expense.cost_code && <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{expense.cost_code}</span>}
                      {expense.parsed_match_status && MATCH_ICON[expense.parsed_match_status]}
                      {lineItemCount > 0 && <span className="text-xs text-muted-foreground">{lineItemCount} items</span>}
                      {(expense.receipt_image_url || expense.file_url) && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                          <FileText className="w-3 h-3" />{isPDF ? 'PDF' : 'IMG'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden md:grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-3 items-center">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {isPDF
                        ? <span className="text-[9px] font-bold text-red-500">PDF</span>
                        : <FileText className="w-3.5 h-3.5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate transition-colors ${isArchived ? 'text-muted-foreground line-through' : 'group-hover:text-primary text-foreground'}`}>
                        {expense.vendor_name || 'Unknown Vendor'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {expense.file_name || expense.store_location || (expense.receipt_number ? `#${expense.receipt_number}` : '—')}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{expense.job_address || '—'}</p>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(expense.expense_date || expense.receipt_date)}</p>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">${fmt(expense.total_amount)}</p>
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        {expense.parsed_match_status && MATCH_ICON[expense.parsed_match_status]}
                        {lineItemCount > 0 && <span className="text-[10px] text-muted-foreground">{lineItemCount}i</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                </button>

                {/* Action menu button */}
                <div className="absolute top-2 right-2">
                  <button
                    onPointerDown={e => { e.stopPropagation(); e.preventDefault(); setMenuOpenId(menuOpenId === expense.id ? null : expense.id); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {/* Dropdown */}
                  {menuOpenId === expense.id && (
                    <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-xl shadow-xl w-44 py-1 text-sm">
                      {!isArchived ? (
                        <>
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-amber-700 hover:bg-amber-50 active:bg-amber-100 transition-colors min-h-[40px]"
                            onPointerDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); setMenuOpenId(null); onArchive(expense); }}
                          >
                            <Archive className="w-3.5 h-3.5 shrink-0" />
                            Archive
                          </button>
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-destructive hover:bg-destructive/5 active:bg-destructive/10 transition-colors min-h-[40px]"
                            onPointerDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); setMenuOpenId(null); onDelete(expense); }}
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors min-h-[40px]"
                            onPointerDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); setMenuOpenId(null); onRestore(expense); }}
                          >
                            <ArchiveRestore className="w-3.5 h-3.5 shrink-0" />
                            Restore
                          </button>
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-destructive hover:bg-destructive/5 active:bg-destructive/10 transition-colors min-h-[40px]"
                            onPointerDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); setMenuOpenId(null); onDelete(expense); }}
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Close dropdown on outside tap — z-40 sits below the z-50 dropdown so it only catches outside clicks */}
      {menuOpenId && (
        <div className="fixed inset-0 z-40" onPointerDown={() => setMenuOpenId(null)} />
      )}
    </div>
  );
}