import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Search, MapPin, User, FileText, Receipt, Clock, DollarSign, Building2, Loader2, X } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { format } from 'date-fns';
import { getInternalRole, isAdmin as getIsAdmin } from '@/lib/adminAuth';

const TYPES = [
  { key: 'all',         label: 'All' },
  { key: 'jobs',        label: 'Jobs' },
  { key: 'invoices',    label: 'Invoices' },
  { key: 'expenses',    label: 'Expenses' },
  { key: 'estimates',   label: 'Estimates' },
  { key: 'vendors',     label: 'Vendors' },
  { key: 'employees',   label: 'Employees' },
  { key: 'time',        label: 'Time Entries' },
];

export default function GlobalSearch() {
  const navigate = useNavigate();
  const isAdmin = getIsAdmin();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: jobs = [], isLoading: ljobs } = useQuery({ queryKey: ['gs-jobs'], queryFn: () => base44.entities.Job.list('-created_date', 300) });
  const { data: invoices = [], isLoading: linvs } = useQuery({ queryKey: ['gs-invoices'], queryFn: () => base44.entities.Invoice.list('-created_date', 200), enabled: isAdmin });
  const { data: expenses = [], isLoading: lexps } = useQuery({ queryKey: ['gs-expenses'], queryFn: () => base44.entities.Expense.list('-created_date', 200), enabled: isAdmin });
  const { data: estimates = [], isLoading: lests } = useQuery({ queryKey: ['gs-estimates'], queryFn: () => base44.entities.Estimate.list('-created_date', 200), enabled: isAdmin });
  const { data: vendors = [], isLoading: lvens } = useQuery({ queryKey: ['gs-vendors'], queryFn: () => base44.entities.Vendor.list('company_name', 200), enabled: isAdmin });
  const { data: employees = [], isLoading: lemps } = useQuery({ queryKey: ['gs-employees'], queryFn: () => base44.entities.Employee.list('name', 200), enabled: isAdmin });
  const { data: timeEntries = [], isLoading: ltime } = useQuery({ queryKey: ['gs-time'], queryFn: () => base44.entities.TimeEntry.list('-clock_in', 200), enabled: isAdmin });

  const isLoading = ljobs || linvs || lexps || lests || lvens || lemps || ltime;

  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const all = [];

    if (typeFilter === 'all' || typeFilter === 'jobs') {
      jobs.filter(j =>
        j.address?.toLowerCase().includes(q) ||
        j.customer_name?.toLowerCase().includes(q) ||
        j.title?.toLowerCase().includes(q) ||
        j.job_number?.toLowerCase().includes(q)
      ).forEach(j => all.push({ type: 'job', id: j.id, title: j.address || j.title, sub: j.customer_name, meta: j.lifecycle_status, icon: MapPin, action: () => navigate(`/job-hub?jobId=${j.id}`) }));
    }

    if (isAdmin && (typeFilter === 'all' || typeFilter === 'invoices')) {
      invoices.filter(i =>
        i.invoice_number?.toLowerCase().includes(q) ||
        i.customer_name?.toLowerCase().includes(q) ||
        i.job_address?.toLowerCase().includes(q)
      ).forEach(i => all.push({ type: 'invoice', id: i.id, title: `Invoice ${i.invoice_number || ''}`, sub: i.customer_name, meta: `$${Number(i.amount || 0).toLocaleString()}`, icon: FileText, action: () => navigate('/invoices') }));
    }

    if (isAdmin && (typeFilter === 'all' || typeFilter === 'expenses')) {
      expenses.filter(e =>
        e.vendor_name?.toLowerCase().includes(q) ||
        e.job_address?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q)
      ).forEach(e => all.push({ type: 'expense', id: e.id, title: e.vendor_name || 'Expense', sub: e.job_address, meta: `$${Number(e.total_amount || 0).toFixed(2)}`, icon: Receipt, action: () => navigate('/expenses') }));
    }

    if (isAdmin && (typeFilter === 'all' || typeFilter === 'estimates')) {
      estimates.filter(e =>
        e.estimate_number?.toLowerCase().includes(q) ||
        e.customer_name?.toLowerCase().includes(q) ||
        e.job_address?.toLowerCase().includes(q)
      ).forEach(e => all.push({ type: 'estimate', id: e.id, title: `Estimate ${e.estimate_number || ''}`, sub: e.customer_name, meta: e.status, icon: FileText, action: () => navigate(`/estimates/${e.id}`) }));
    }

    if (isAdmin && (typeFilter === 'all' || typeFilter === 'vendors')) {
      vendors.filter(v =>
        v.company_name?.toLowerCase().includes(q) ||
        v.contact_name?.toLowerCase().includes(q) ||
        v.email?.toLowerCase().includes(q)
      ).forEach(v => all.push({ type: 'vendor', id: v.id, title: v.company_name, sub: v.contact_name, meta: v.type, icon: Building2, action: () => navigate('/vendors') }));
    }

    if (isAdmin && (typeFilter === 'all' || typeFilter === 'employees')) {
      employees.filter(e =>
        e.name?.toLowerCase().includes(q) ||
        e.employee_code?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q)
      ).forEach(e => all.push({ type: 'employee', id: e.id, title: e.name, sub: `#${e.employee_code}`, meta: e.role, icon: User, action: () => navigate('/employees') }));
    }

    if (isAdmin && (typeFilter === 'all' || typeFilter === 'time')) {
      timeEntries.filter(t =>
        t.employee_name?.toLowerCase().includes(q) ||
        t.job_address?.toLowerCase().includes(q) ||
        t.cost_code?.toLowerCase().includes(q)
      ).forEach(t => all.push({ type: 'time', id: t.id, title: t.employee_name, sub: t.job_address, meta: t.cost_code, icon: Clock, action: () => navigate(`/time-entries/${t.id}`) }));
    }

    return all.slice(0, 50);
  }, [query, typeFilter, jobs, invoices, expenses, estimates, vendors, employees, timeEntries]);

  const TYPE_COLORS = { job: 'bg-blue-50 text-blue-700', invoice: 'bg-green-50 text-green-700', expense: 'bg-orange-50 text-orange-700', estimate: 'bg-violet-50 text-violet-700', vendor: 'bg-teal-50 text-teal-700', employee: 'bg-slate-100 text-slate-700', time: 'bg-amber-50 text-amber-700' };

  return (
    <AppLayout title="Search">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
        <div>
          <h1 className="text-base font-semibold text-foreground">Global Search</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Search across jobs, invoices, expenses, vendors, and more</p>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search anything..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9 pr-9 h-11 rounded-xl text-sm"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Type filter pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {TYPES.filter(t => t.key === 'all' || t.key === 'jobs' || isAdmin).map(t => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${typeFilter === t.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Results */}
        {isLoading && query.length < 2 && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {query.length >= 2 && results.length === 0 && !isLoading && (
          <div className="text-center py-10 space-y-1">
            <Search className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No results for "{query}"</p>
          </div>
        )}

        {query.length < 2 && !isLoading && (
          <div className="text-center py-10">
            <Search className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Type at least 2 characters to search</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">{results.length} result{results.length !== 1 ? 's' : ''}</p>
            {results.map((r, i) => {
              const Icon = r.icon;
              return (
                <button
                  key={`${r.type}-${r.id}-${i}`}
                  onClick={r.action}
                  className="w-full bg-card border border-border rounded-xl p-3 flex items-center gap-3 hover:border-primary/30 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                    {r.sub && <p className="text-xs text-muted-foreground truncate">{r.sub}</p>}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[r.type] || 'bg-muted text-muted-foreground'}`}>{r.type}</span>
                    {r.meta && <span className="text-[10px] text-muted-foreground">{r.meta}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}