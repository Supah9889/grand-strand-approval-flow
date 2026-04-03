import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, MapPin, FileText, Receipt, User, ArrowRight } from 'lucide-react';

const TYPE_COLORS = {
  job:     'bg-blue-50 text-blue-700',
  invoice: 'bg-green-50 text-green-700',
  expense: 'bg-orange-50 text-orange-700',
  vendor:  'bg-teal-50 text-teal-700',
  note:    'bg-amber-50 text-amber-700',
};

export default function DashQuickSearch({ jobs = [], invoices = [], expenses = [], notes = [], vendors = [] }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const all = [];

    jobs.filter(j =>
      j.address?.toLowerCase().includes(q) ||
      j.customer_name?.toLowerCase().includes(q) ||
      j.phone?.toLowerCase().includes(q) ||
      j.email?.toLowerCase().includes(q) ||
      j.job_number?.toLowerCase().includes(q)
    ).slice(0, 5).forEach(j => all.push({
      type: 'job', id: j.id,
      title: j.address || j.title,
      sub: j.customer_name,
      meta: j.lifecycle_status,
      icon: MapPin,
      action: () => navigate(`/job-hub?jobId=${j.id}`),
    }));

    invoices.filter(i =>
      i.invoice_number?.toLowerCase().includes(q) ||
      i.customer_name?.toLowerCase().includes(q) ||
      i.job_address?.toLowerCase().includes(q)
    ).slice(0, 3).forEach(i => all.push({
      type: 'invoice', id: i.id,
      title: `Invoice ${i.invoice_number || ''}`,
      sub: i.customer_name,
      meta: `$${Number(i.amount || 0).toLocaleString()}`,
      icon: FileText,
      action: () => navigate('/invoices'),
    }));

    expenses.filter(e =>
      e.vendor_name?.toLowerCase().includes(q) ||
      e.job_address?.toLowerCase().includes(q)
    ).slice(0, 3).forEach(e => all.push({
      type: 'expense', id: e.id,
      title: e.vendor_name || 'Expense',
      sub: e.job_address,
      meta: `$${Number(e.total_amount || 0).toFixed(2)}`,
      icon: Receipt,
      action: () => navigate('/expenses'),
    }));

    vendors.filter(v =>
      v.company_name?.toLowerCase().includes(q) ||
      v.contact_name?.toLowerCase().includes(q)
    ).slice(0, 3).forEach(v => all.push({
      type: 'vendor', id: v.id,
      title: v.company_name,
      sub: v.contact_name,
      meta: v.type,
      icon: User,
      action: () => navigate('/vendors'),
    }));

    notes.filter(n => n.content?.toLowerCase().includes(q))
      .slice(0, 3).forEach(n => all.push({
        type: 'note', id: n.id,
        title: n.job_address || 'Note',
        sub: n.content?.substring(0, 60),
        meta: '',
        icon: FileText,
        action: () => navigate('/notes'),
      }));

    return all.slice(0, 12);
  }, [query, jobs, invoices, expenses, vendors, notes]);

  const showDropdown = query.length >= 2;

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search address, name, invoice #, phone..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && query.length >= 2) {
              navigate(`/global-search?q=${encodeURIComponent(query)}`);
              setQuery('');
            }
          }}
          className="w-full pl-9 pr-9 h-10 rounded-xl border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {query ? (
          <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => navigate('/global-search')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
            title="Full search"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">No results — <button onClick={() => navigate(`/global-search?q=${encodeURIComponent(query)}`)} className="text-primary underline">full search</button></p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-72 overflow-y-auto">
              {results.map((r, i) => {
                const Icon = r.icon;
                return (
                  <button
                    key={`${r.type}-${r.id}-${i}`}
                    onClick={() => { r.action(); setQuery(''); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left"
                  >
                    <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{r.title}</p>
                      {r.sub && <p className="text-[10px] text-muted-foreground truncate">{r.sub}</p>}
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${TYPE_COLORS[r.type] || 'bg-muted text-muted-foreground'}`}>{r.meta || r.type}</span>
                  </button>
                );
              })}
              <button
                onClick={() => { navigate(`/global-search?q=${encodeURIComponent(query)}`); setQuery(''); }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs text-primary hover:bg-muted transition-colors"
              >
                <Search className="w-3 h-3" /> Full search →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}