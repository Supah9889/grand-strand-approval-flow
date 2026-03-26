import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Shield, AlertTriangle, Search, ChevronDown, ChevronUp,
  ExternalLink, Filter, X, Clock, Calendar, Download
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import AppLayout from '../components/AppLayout';
import { ACTION_LABELS } from '@/lib/audit';
import { getInternalRole, isAdmin as getIsAdmin } from '@/lib/adminAuth';
import { useNavigate } from 'react-router-dom';

const MODULES = [
  'job', 'signature', 'estimate', 'change_order', 'invoice', 'payment',
  'bill', 'purchase_order', 'budget', 'time_entry', 'warranty', 'task',
  'daily_log', 'lead', 'employee', 'portal', 'expense', 'system',
];

const MODULE_LABELS = {
  job: 'Job', signature: 'Signature', estimate: 'Estimate', change_order: 'Change Order',
  invoice: 'Invoice', payment: 'Payment', bill: 'Bill', purchase_order: 'Purchase Order',
  budget: 'Budget', time_entry: 'Time Entry', warranty: 'Warranty', task: 'Task',
  daily_log: 'Daily Log', lead: 'Lead', employee: 'Employee', portal: 'Portal',
  expense: 'Expense', system: 'System',
};

const RECORD_ROUTES = {
  job: (id) => `/job-hub?jobId=${id}`,
  task: (id) => `/tasks/${id}`,
  daily_log: (id) => `/daily-logs/${id}`,
  estimate: (id) => `/estimates/${id}`,
  change_order: (id) => `/change-orders/${id}`,
  invoice: () => `/invoices`,
  bill: () => `/bills`,
  purchase_order: () => `/purchase-orders`,
  warranty: (id) => `/warranty/${id}`,
  lead: (id) => `/sales/${id}`,
  expense: () => `/expenses`,
  employee: () => `/employees`,
  portal: () => `/portal-manager`,
  time_entry: (id) => `/time-entries/${id}`,
};

function AuditEntryRow({ log }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const cfg = ACTION_LABELS[log.action] || { label: log.action?.replace(/_/g, ' '), color: 'text-foreground' };
  const hasDetails = log.old_value || log.new_value || log.reason || log.record_id;
  const recordRoute = log.module && RECORD_ROUTES[log.module]
    ? RECORD_ROUTES[log.module](log.record_id)
    : null;

  return (
    <div className={`px-4 py-3 ${log.is_override ? 'bg-red-50/70' : log.is_sensitive ? 'bg-amber-50/25' : 'bg-card'}`}>
      <div className="flex items-start gap-2.5">
        {log.is_override
          ? <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
          : log.is_sensitive
            ? <Shield className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
            : <Clock className="w-3.5 h-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className={`text-xs font-semibold ${cfg.color} shrink-0`}>{cfg.label}</span>
              {log.module && (
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium text-muted-foreground uppercase tracking-wide shrink-0">
                  {MODULE_LABELS[log.module] || log.module}
                </span>
              )}
              {log.is_override && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-600 h-4">Override</Badge>}
              {log.is_sensitive && !log.is_override && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600 h-4">Sensitive</Badge>}
            </div>
            <span className="text-[11px] text-muted-foreground/60 shrink-0 whitespace-nowrap">
              {log.timestamp ? format(parseISO(log.timestamp), 'MMM d, h:mm a') : ''}
            </span>
          </div>

          {log.detail && (
            <p className="text-xs text-foreground/80 mt-1 leading-snug">{log.detail}</p>
          )}

          <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-muted-foreground/70">
            {log.actor && (
              <span className="font-medium text-foreground/60">{log.actor}{log.actor_role ? ` (${log.actor_role})` : ''}</span>
            )}
            {log.job_address && (
              <button
                className="text-primary/70 hover:text-primary truncate max-w-[200px]"
                onClick={() => log.job_id && navigate(`/job-hub?jobId=${log.job_id}`)}
              >
                {log.job_address}
              </button>
            )}
          </div>

          {log.reason && (
            <p className="text-xs text-amber-700 italic mt-1">Reason: {log.reason}</p>
          )}

          {hasDetails && (
            <button
              onClick={() => setExpanded(e => !e)}
              aria-label={expanded ? 'Hide audit entry details' : 'Show audit entry details'}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mt-1.5 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Hide details' : 'Show details'}
            </button>
          )}

          {expanded && (
            <div className="mt-2 space-y-1.5">
              {(log.old_value || log.new_value) && (
                <div className="flex gap-2 flex-wrap text-xs">
                  {log.old_value && (
                    <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100 max-w-xs truncate" title={log.old_value}>
                      Before: {log.old_value}
                    </span>
                  )}
                  {log.new_value && (
                    <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100 max-w-xs truncate" title={log.new_value}>
                      After: {log.new_value}
                    </span>
                  )}
                </div>
              )}
              {log.record_id && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>Record ID: <span className="font-mono">{log.record_id}</span></span>
                  {recordRoute && (
                    <button
                      onClick={() => navigate(recordRoute)}
                      className="flex items-center gap-0.5 text-primary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> View record
                    </button>
                  )}
                </div>
              )}
              {log.source && log.source !== 'ui' && (
                <span className="text-[11px] text-muted-foreground">Source: {log.source}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuditLogPage() {
  const navigate = useNavigate();
  const role = getInternalRole();

  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState('all');
  const [filterSensitive, setFilterSensitive] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterActor, setFilterActor] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  if (!getIsAdmin()) {
    return (
      <AppLayout title="Audit Log">
        <div className="flex-1 flex items-center justify-center flex-col gap-3">
          <Shield className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Admin access required to view the audit log.</p>
        </div>
      </AppLayout>
    );
  }

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-log-page'],
    queryFn: () => base44.entities.AuditLog.list('-timestamp', 2000),
    staleTime: 30000,
  });

  const actors = useMemo(() => {
    const s = new Set(logs.map(l => l.actor).filter(Boolean));
    return Array.from(s).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    let l = [...logs];

    if (filterModule !== 'all') l = l.filter(e => e.module === filterModule);
    if (filterSensitive === 'sensitive') l = l.filter(e => e.is_sensitive);
    if (filterSensitive === 'override') l = l.filter(e => e.is_override);
    if (filterActor) l = l.filter(e => e.actor?.toLowerCase().includes(filterActor.toLowerCase()));

    if (filterDateFrom) {
      const from = startOfDay(parseISO(filterDateFrom));
      l = l.filter(e => e.timestamp && parseISO(e.timestamp) >= from);
    }
    if (filterDateTo) {
      const to = endOfDay(parseISO(filterDateTo));
      l = l.filter(e => e.timestamp && parseISO(e.timestamp) <= to);
    }

    if (search) {
      const q = search.toLowerCase();
      l = l.filter(e =>
        e.detail?.toLowerCase().includes(q) ||
        e.actor?.toLowerCase().includes(q) ||
        e.action?.toLowerCase().includes(q) ||
        e.job_address?.toLowerCase().includes(q) ||
        e.reason?.toLowerCase().includes(q) ||
        e.record_id?.toLowerCase().includes(q) ||
        e.old_value?.toLowerCase().includes(q) ||
        e.new_value?.toLowerCase().includes(q)
      );
    }

    if (sortOrder === 'oldest') l = l.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    return l;
  }, [logs, filterModule, filterSensitive, filterActor, filterDateFrom, filterDateTo, search, sortOrder]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const overrideCount = logs.filter(l => l.is_override).length;
  const sensitiveCount = logs.filter(l => l.is_sensitive).length;
  const activeFilterCount = [
    filterModule !== 'all', filterSensitive !== 'all',
    filterDateFrom, filterDateTo, filterActor,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterModule('all'); setFilterSensitive('all');
    setFilterDateFrom(''); setFilterDateTo('');
    setFilterActor(''); setSearch('');
    setPage(0);
  };

  return (
    <AppLayout title="Audit Log">
      <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-foreground">Audit Log</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {logs.length.toLocaleString()} total events
              {' · '}{sensitiveCount} sensitive
              {' · '}{overrideCount} overrides
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className={`h-8 rounded-lg text-xs gap-1.5 ${activeFilterCount > 0 ? 'border-primary text-primary' : ''}`}
              onClick={() => setShowFilters(f => !f)}
            >
              <Filter className="w-3 h-3" />
              Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
            </Button>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Quick filter chips */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setFilterSensitive(s => s === 'sensitive' ? 'all' : 'sensitive'); setPage(0); }}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${filterSensitive === 'sensitive' ? 'bg-amber-100 text-amber-700 border-amber-300' : 'border-border text-muted-foreground hover:border-amber-300'}`}>
            <Shield className="w-3 h-3" /> {sensitiveCount} Sensitive
          </button>
          <button onClick={() => { setFilterSensitive(s => s === 'override' ? 'all' : 'override'); setPage(0); }}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${filterSensitive === 'override' ? 'bg-red-100 text-red-700 border-red-300' : 'border-border text-muted-foreground hover:border-red-300'}`}>
            <AlertTriangle className="w-3 h-3" /> {overrideCount} Overrides
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by actor, detail, address, record ID..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            aria-label="Search audit log by actor, detail, address, or record ID"
            className="pl-9 h-9 rounded-xl text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filter Options</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Module</label>
                <Select value={filterModule} onValueChange={v => { setFilterModule(v); setPage(0); }}>
                  <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    {MODULES.map(m => <SelectItem key={m} value={m}>{MODULE_LABELS[m] || m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Type</label>
                <Select value={filterSensitive} onValueChange={v => { setFilterSensitive(v); setPage(0); }}>
                  <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="sensitive">Sensitive Only</SelectItem>
                    <SelectItem value="override">Overrides Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Actor</label>
                <Select value={filterActor} onValueChange={v => { setFilterActor(v); setPage(0); }}>
                  <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue placeholder="Any actor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Any actor</SelectItem>
                    {actors.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Date From</label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => { setFilterDateFrom(e.target.value); setPage(0); }}
                  className="h-8 text-xs rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Date To</label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={e => { setFilterDateTo(e.target.value); setPage(0); }}
                  className="h-8 text-xs rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Sort</label>
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filtered.length !== logs.length
              ? `Showing ${filtered.length} of ${logs.length} events`
              : `${logs.length} events`}
            {filtered.length > PAGE_SIZE && ` — page ${page + 1} of ${totalPages}`}
          </p>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear all filters</button>
          )}
        </div>

        {/* Log entries */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <Search className="w-8 h-8 text-muted-foreground/20 mx-auto" />
            <p className="text-sm text-muted-foreground">No audit events match your filters.</p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border/60">
            {paginated.map((log, i) => (
              <AuditEntryRow key={log.id || i} log={log} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" disabled={page === 0} onClick={() => setPage(0)}>First</Button>
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>Last</Button>
          </div>
        )}

        {/* Legal footer note */}
        <div className="flex items-start gap-2 bg-muted/30 rounded-xl p-3 border border-border/60">
          <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            This audit trail is a legal and operational record. Entries are append-only and preserved even if referenced records are later edited, archived, or deleted. Only authorized administrators can view this log.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}