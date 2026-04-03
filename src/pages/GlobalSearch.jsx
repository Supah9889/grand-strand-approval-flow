import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import {
  Search, MapPin, FileText, Receipt, Clock, DollarSign, Building2,
  Loader2, X, StickyNote, Calendar, Paperclip, Users, Phone, Mail,
  ChevronRight, AlertCircle
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { getInternalRole, isAdmin as getIsAdmin } from '@/lib/adminAuth';

// ── Type config ───────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  job:      { label: 'Job',      color: 'bg-blue-50 text-blue-700',    dot: 'bg-blue-400' },
  note:     { label: 'Note',     color: 'bg-amber-50 text-amber-700',  dot: 'bg-amber-400' },
  invoice:  { label: 'Invoice',  color: 'bg-green-50 text-green-700',  dot: 'bg-green-500' },
  bill:     { label: 'Bill',     color: 'bg-orange-50 text-orange-700',dot: 'bg-orange-500' },
  file:     { label: 'File',     color: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  schedule: { label: 'Schedule', color: 'bg-cyan-50 text-cyan-700',    dot: 'bg-cyan-500' },
  contact:  { label: 'Contact',  color: 'bg-violet-50 text-violet-700',dot: 'bg-violet-400' },
  vendor:   { label: 'Vendor',   color: 'bg-teal-50 text-teal-700',    dot: 'bg-teal-500' },
  expense:  { label: 'Expense',  color: 'bg-red-50 text-red-700',      dot: 'bg-red-400' },
  estimate: { label: 'Estimate', color: 'bg-indigo-50 text-indigo-700',dot: 'bg-indigo-400' },
};

const GROUP_ORDER = ['job', 'contact', 'note', 'schedule', 'invoice', 'bill', 'file', 'vendor', 'expense', 'estimate'];

const FILTER_TABS = [
  { key: 'all',      label: 'All' },
  { key: 'job',      label: 'Jobs' },
  { key: 'note',     label: 'Notes' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'invoice',  label: 'Invoices' },
  { key: 'bill',     label: 'Bills' },
  { key: 'file',     label: 'Files' },
  { key: 'contact',  label: 'Contacts' },
  { key: 'vendor',   label: 'Vendors' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function hl(text, query) {
  // Returns text with no JSX — just truncated plaintext for now
  return text;
}

function inDateRange(isoStr, from, to) {
  if (!isoStr || (!from && !to)) return true;
  try {
    const d = new Date(isoStr);
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(to + 'T23:59:59')) return false;
    return true;
  } catch { return true; }
}

function fmtDate(iso) {
  if (!iso) return null;
  try { return format(parseISO(iso.length > 10 ? iso : iso + 'T00:00:00'), 'MMM d, yyyy'); }
  catch { return iso; }
}

function fmtMoney(n) {
  return `$${Number(n || 0).toLocaleString()}`;
}

// ── Result card ───────────────────────────────────────────────────────────────
function ResultCard({ result }) {
  const cfg = TYPE_CONFIG[result.type] || TYPE_CONFIG.job;
  return (
    <button
      onClick={result.action}
      className="w-full bg-card border border-border rounded-xl px-3.5 py-3 flex items-start gap-3 hover:border-primary/40 hover:shadow-sm transition-all text-left group"
    >
      {/* dot */}
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />

      {/* main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${cfg.color}`}>
            {cfg.label}
          </span>
          {result.badge && (
            <span className="text-[10px] text-muted-foreground/70 italic">{result.badge}</span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground leading-snug truncate">{result.primary}</p>
        {result.secondary && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{result.secondary}</p>
        )}
        {result.body && (
          <p className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-2 italic">{result.body}</p>
        )}
      </div>

      {/* right meta */}
      <div className="shrink-0 flex flex-col items-end gap-1 ml-1">
        {result.amount && <span className="text-xs font-semibold text-foreground">{result.amount}</span>}
        {result.status && <span className="text-[10px] text-muted-foreground">{result.status}</span>}
        {result.date && <span className="text-[10px] text-muted-foreground">{result.date}</span>}
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors mt-auto" />
      </div>
    </button>
  );
}

// ── Grouped results section ───────────────────────────────────────────────────
function ResultGroup({ type, items }) {
  const [expanded, setExpanded] = useState(true);
  const cfg = TYPE_CONFIG[type] || {};
  const label = cfg.label || type;
  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-0.5"
      >
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}s · {items.length}
        </span>
        <span className="text-[10px] text-muted-foreground">{expanded ? 'hide' : 'show'}</span>
      </button>
      {expanded && items.map((r, i) => <ResultCard key={`${r.type}-${r.id}-${i}`} result={r} />)}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GlobalSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = getIsAdmin();
  const inputRef = useRef(null);

  // Seed query from ?q= param (for DashQuickSearch hand-off)
  const urlParams = new URLSearchParams(location.search);
  const [query, setQuery] = useState(urlParams.get('q') || '');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  // Auto-focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  // ── Data fetches ────────────────────────────────────────────────────────────
  const { data: jobs = [],     isLoading: ljobs } = useQuery({ queryKey: ['gs-jobs'],     queryFn: () => base44.entities.Job.list('-updated_date', 500) });
  const { data: notes = [],    isLoading: lnotes } = useQuery({ queryKey: ['gs-notes'],    queryFn: () => base44.entities.JobNote.list('-created_date', 400) });
  const { data: invoices = [], isLoading: linvs }  = useQuery({ queryKey: ['gs-invoices'], queryFn: () => base44.entities.Invoice.list('-created_date', 300), enabled: isAdmin });
  const { data: bills = [],    isLoading: lbills }  = useQuery({ queryKey: ['gs-bills'],    queryFn: () => base44.entities.Bill.list('-created_date', 300), enabled: isAdmin });
  const { data: files = [],    isLoading: lfiles }  = useQuery({ queryKey: ['gs-files'],    queryFn: () => base44.entities.JobFile.list('-created_date', 300) });
  const { data: events = [],   isLoading: levts }   = useQuery({ queryKey: ['gs-events'],   queryFn: () => base44.entities.CalendarEvent.list('-start_date', 300) });
  const { data: contacts = [], isLoading: lcnts }   = useQuery({ queryKey: ['gs-contacts'], queryFn: () => base44.entities.JobContact.list('name', 300) });
  const { data: vendors = [],  isLoading: lvens }   = useQuery({ queryKey: ['gs-vendors'],  queryFn: () => base44.entities.Vendor.list('company_name', 200), enabled: isAdmin });
  const { data: expenses = [], isLoading: lexps }   = useQuery({ queryKey: ['gs-expenses'], queryFn: () => base44.entities.Expense.list('-created_date', 200), enabled: isAdmin });
  const { data: estimates = [],isLoading: lests }   = useQuery({ queryKey: ['gs-estimates'],queryFn: () => base44.entities.Estimate.list('-created_date', 200), enabled: isAdmin });

  const isLoading = ljobs || lnotes || linvs || lbills || lfiles || levts || lcnts || lvens || lexps || lests;

  // ── Search logic ─────────────────────────────────────────────────────────────
  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase().trim();
    const all = [];

    // Score helper — exact/prefix matches rank higher
    const score = (val) => {
      if (!val) return 0;
      const v = val.toLowerCase();
      if (v === q) return 3;
      if (v.startsWith(q)) return 2;
      if (v.includes(q)) return 1;
      return 0;
    };
    const matches = (fields) => fields.some(f => f && f.toLowerCase().includes(q));

    // ── Jobs ───────────────────────────────────────────────────────────────────
    if (typeFilter === 'all' || typeFilter === 'job') {
      jobs
        .filter(j => matches([j.address, j.customer_name, j.title, j.job_number, j.customer_phone, j.customer_email, j.phone, j.email, j.description]))
        .filter(j => inDateRange(j.updated_date, dateFrom, dateTo))
        .map(j => ({
          type: 'job', id: j.id,
          _score: Math.max(score(j.address), score(j.customer_name), score(j.job_number)) + (j.lifecycle_status === 'in_progress' ? 0.5 : 0),
          primary: j.address || j.title,
          secondary: [j.customer_name, j.customer_phone || j.phone].filter(Boolean).join(' · '),
          badge: j.job_number || null,
          status: j.lifecycle_status,
          date: j.updated_date ? fmtDate(j.updated_date) : null,
          action: () => navigate(`/job-hub?jobId=${j.id}`),
        }))
        .sort((a, b) => b._score - a._score)
        .forEach(r => all.push(r));
    }

    // ── Notes ──────────────────────────────────────────────────────────────────
    if (typeFilter === 'all' || typeFilter === 'note') {
      notes
        .filter(n => matches([n.content, n.job_address, n.author_name, n.note_type]))
        .filter(n => inDateRange(n.created_date, dateFrom, dateTo))
        .slice(0, 40)
        .forEach(n => all.push({
          type: 'note', id: n.id,
          _score: score(n.content) + score(n.job_address),
          primary: n.job_address || 'Note',
          secondary: n.author_name ? `by ${n.author_name}` : n.note_type || null,
          body: n.content?.substring(0, 100),
          date: n.created_date ? fmtDate(n.created_date) : null,
          action: () => navigate(`/job-hub?jobId=${n.job_id}`),
        }));
    }

    // ── Schedule items ─────────────────────────────────────────────────────────
    if (typeFilter === 'all' || typeFilter === 'schedule') {
      events
        .filter(e => matches([e.title, e.job_address, e.assigned_to, e.notes]))
        .filter(e => inDateRange(e.start_date, dateFrom, dateTo))
        .slice(0, 30)
        .forEach(e => all.push({
          type: 'schedule', id: e.id,
          _score: score(e.title) + score(e.job_address),
          primary: e.title,
          secondary: [e.job_address, e.assigned_to].filter(Boolean).join(' · '),
          status: e.status,
          date: e.start_date ? fmtDate(e.start_date) : null,
          action: () => navigate('/calendar'),
        }));
    }

    // ── Invoices ───────────────────────────────────────────────────────────────
    if (isAdmin && (typeFilter === 'all' || typeFilter === 'invoice')) {
      invoices
        .filter(i => matches([i.invoice_number, i.customer_name, i.job_address, i.notes]))
        .filter(i => inDateRange(i.created_date, dateFrom, dateTo))
        .forEach(i => all.push({
          type: 'invoice', id: i.id,
          _score: score(i.invoice_number) * 2 + score(i.customer_name),
          primary: `Invoice ${i.invoice_number || '—'}`,
          secondary: [i.customer_name, i.job_address].filter(Boolean).join(' · '),
          amount: fmtMoney(i.amount),
          status: i.status,
          date: i.created_date ? fmtDate(i.created_date) : null,
          action: () => navigate('/invoices'),
        }));
    }

    // ── Bills ──────────────────────────────────────────────────────────────────
    if (isAdmin && (typeFilter === 'all' || typeFilter === 'bill')) {
      bills
        .filter(b => matches([b.vendor_name, b.job_address, b.notes, b.category]))
        .filter(b => inDateRange(b.created_date, dateFrom, dateTo))
        .forEach(b => all.push({
          type: 'bill', id: b.id,
          _score: score(b.vendor_name) + score(b.job_address),
          primary: b.vendor_name || 'Bill',
          secondary: b.job_address || null,
          amount: fmtMoney(b.amount),
          status: b.status,
          date: b.due_date ? `Due ${fmtDate(b.due_date)}` : (b.created_date ? fmtDate(b.created_date) : null),
          action: () => navigate('/bills'),
        }));
    }

    // ── Files ──────────────────────────────────────────────────────────────────
    if (typeFilter === 'all' || typeFilter === 'file') {
      files
        .filter(f => matches([f.file_name, f.job_address, f.description, f.category, f.uploaded_by_name]))
        .filter(f => inDateRange(f.created_date, dateFrom, dateTo))
        .slice(0, 30)
        .forEach(f => all.push({
          type: 'file', id: f.id,
          _score: score(f.file_name) * 2,
          primary: f.file_name,
          secondary: [f.job_address, f.category?.replace(/_/g, ' ')].filter(Boolean).join(' · '),
          badge: f.uploaded_by_name ? `by ${f.uploaded_by_name}` : null,
          date: f.created_date ? fmtDate(f.created_date) : null,
          action: () => window.open(f.file_url, '_blank'),
        }));
    }

    // ── Contacts ───────────────────────────────────────────────────────────────
    if (typeFilter === 'all' || typeFilter === 'contact') {
      contacts
        .filter(c => matches([c.name, c.phone, c.email, c.company, c.job_address]))
        .slice(0, 30)
        .forEach(c => all.push({
          type: 'contact', id: c.id,
          _score: score(c.name) * 2 + score(c.phone) * 2 + score(c.email),
          primary: c.name,
          secondary: [c.role?.replace(/_/g, ' '), c.job_address].filter(Boolean).join(' · '),
          badge: c.phone || c.email || null,
          action: () => navigate(`/job-hub?jobId=${c.job_id}`),
        }));
    }

    // ── Vendors ────────────────────────────────────────────────────────────────
    if (isAdmin && (typeFilter === 'all' || typeFilter === 'vendor')) {
      vendors
        .filter(v => matches([v.company_name, v.contact_name, v.email, v.phone, v.address]))
        .slice(0, 20)
        .forEach(v => all.push({
          type: 'vendor', id: v.id,
          _score: score(v.company_name) * 2 + score(v.contact_name),
          primary: v.company_name,
          secondary: [v.contact_name, v.phone || v.email].filter(Boolean).join(' · '),
          status: v.type?.replace(/_/g, ' ') || null,
          action: () => navigate('/vendors'),
        }));
    }

    // ── Expenses ───────────────────────────────────────────────────────────────
    if (isAdmin && (typeFilter === 'all' || typeFilter === 'expense')) {
      expenses
        .filter(e => matches([e.vendor_name, e.job_address, e.description, e.notes]))
        .filter(e => inDateRange(e.expense_date || e.created_date, dateFrom, dateTo))
        .slice(0, 20)
        .forEach(e => all.push({
          type: 'expense', id: e.id,
          _score: score(e.vendor_name) + score(e.job_address),
          primary: e.vendor_name || 'Expense',
          secondary: e.job_address || null,
          amount: `$${Number(e.total_amount || 0).toFixed(2)}`,
          status: e.category || null,
          date: e.expense_date ? fmtDate(e.expense_date) : null,
          action: () => navigate('/expenses'),
        }));
    }

    // ── Estimates ──────────────────────────────────────────────────────────────
    if (isAdmin && (typeFilter === 'all' || typeFilter === 'estimate')) {
      estimates
        .filter(e => matches([e.estimate_number, e.client_name, e.property_address, e.scope_summary]))
        .filter(e => inDateRange(e.date_created || e.created_date, dateFrom, dateTo))
        .slice(0, 20)
        .forEach(e => all.push({
          type: 'estimate', id: e.id,
          _score: score(e.estimate_number) * 2 + score(e.client_name),
          primary: `Estimate ${e.estimate_number || '—'}`,
          secondary: [e.client_name, e.property_address].filter(Boolean).join(' · '),
          amount: fmtMoney(e.total),
          status: e.status,
          date: e.date_created ? fmtDate(e.date_created) : null,
          action: () => navigate(`/estimates/${e.id}`),
        }));
    }

    return all;
  }, [query, typeFilter, dateFrom, dateTo, jobs, notes, invoices, bills, files, events, contacts, vendors, expenses, estimates]);

  // Group results by type, sorted by GROUP_ORDER, each group sorted by _score
  const grouped = useMemo(() => {
    if (typeFilter !== 'all') {
      return results.length > 0 ? [{ type: typeFilter, items: results.sort((a, b) => b._score - a._score) }] : [];
    }
    const map = {};
    results.forEach(r => {
      if (!map[r.type]) map[r.type] = [];
      map[r.type].push(r);
    });
    return GROUP_ORDER
      .filter(t => map[t]?.length > 0)
      .map(t => ({ type: t, items: map[t].sort((a, b) => b._score - a._score).slice(0, 15) }));
  }, [results, typeFilter]);

  const totalCount = grouped.reduce((s, g) => s + g.items.length, 0);
  const hasDateFilter = dateFrom || dateTo;

  return (
    <AppLayout title="Search">
      <div className="max-w-2xl mx-auto w-full px-4 py-4 space-y-3">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div>
          <h1 className="text-base font-semibold text-foreground">Search</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Jobs · Notes · Invoices · Bills · Files · Contacts · Vendors
          </p>
        </div>

        {/* ── Search input ────────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            placeholder="Address, name, phone, invoice #, note text, file name..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9 pr-9 h-11 rounded-xl text-sm"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Date filter toggle ───────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDateFilter(v => !v)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors font-medium ${
              hasDateFilter
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
            }`}
          >
            {hasDateFilter ? '📅 Date filtered' : '📅 Date range'}
          </button>
          {hasDateFilter && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-[10px] text-destructive hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {showDateFilter && (
          <div className="flex gap-2 items-center bg-muted/40 rounded-xl px-3 py-2.5">
            <span className="text-xs text-muted-foreground shrink-0">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="flex-1 h-8 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground shrink-0">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="flex-1 h-8 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}

        {/* ── Type filter pills ────────────────────────────────────── */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {FILTER_TABS.filter(t => t.key === 'all' || t.key === 'job' || t.key === 'note' || t.key === 'schedule' || t.key === 'file' || t.key === 'contact' || isAdmin).map(t => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key)}
              className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                typeFilter === t.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              {query.length >= 2 && t.key !== 'all' && results.filter(r => r.type === t.key).length > 0 && (
                <span className="ml-1 opacity-70">{results.filter(r => r.type === t.key).length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Loading ──────────────────────────────────────────────── */}
        {isLoading && query.length < 2 && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* ── Empty prompt ─────────────────────────────────────────── */}
        {query.length < 2 && !isLoading && (
          <div className="space-y-4 pt-2">
            <div className="text-center py-8">
              <Search className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium">Search for anything</p>
              <p className="text-xs text-muted-foreground mt-1">Address · Name · Phone · Email · Invoice # · Note text · File name</p>
            </div>

            {/* Search tips */}
            <div className="bg-muted/40 rounded-xl p-3.5 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What you can search</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  ['📍', 'Job address'],
                  ['👤', 'Customer name'],
                  ['📞', 'Phone number'],
                  ['✉️', 'Email address'],
                  ['📝', 'Note content'],
                  ['🧾', 'Invoice number'],
                  ['🏢', 'Vendor / sub'],
                  ['📎', 'File name'],
                  ['📅', 'Date range'],
                  ['🗓️', 'Schedule items'],
                ].map(([icon, label]) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{icon}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── No results ───────────────────────────────────────────── */}
        {query.length >= 2 && totalCount === 0 && !isLoading && (
          <div className="text-center py-10 space-y-2">
            <AlertCircle className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No results for <span className="font-medium text-foreground">"{query}"</span></p>
            {hasDateFilter && <p className="text-xs text-muted-foreground">Try clearing the date range filter</p>}
            {typeFilter !== 'all' && (
              <button onClick={() => setTypeFilter('all')} className="text-xs text-primary underline">Search all types</button>
            )}
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────── */}
        {totalCount > 0 && (
          <div className="space-y-4">
            <p className="text-[11px] text-muted-foreground px-0.5">
              {totalCount} result{totalCount !== 1 ? 's' : ''}
              {hasDateFilter && ' (date filtered)'}
              {isLoading && <Loader2 className="w-3 h-3 animate-spin inline ml-1.5" />}
            </p>

            {typeFilter === 'all'
              ? grouped.map(g => <ResultGroup key={g.type} type={g.type} items={g.items} />)
              : grouped[0]?.items.map((r, i) => <ResultCard key={`${r.type}-${r.id}-${i}`} result={r} />)
            }
          </div>
        )}
      </div>
    </AppLayout>
  );
}