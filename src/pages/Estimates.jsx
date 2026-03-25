import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BottomSheetSelect from '@/components/BottomSheetSelect';
import PullToRefresh from '@/components/PullToRefresh';
import { Plus, Search, Loader2, FileText, X, DollarSign, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, isPast, isToday } from 'date-fns';
import AppLayout from '../components/AppLayout';
import EstimateStatusBadge from '../components/estimates/EstimateStatusBadge';
import { ESTIMATE_STATUS_CONFIG, generateEstimateNumber } from '@/lib/estimateHelpers';
import { getInternalRole } from '@/lib/adminAuth';
import { toast } from 'sonner';

const STAT_GROUPS = [
  { key: 'total',           label: 'Total',            color: 'text-slate-700',  bg: 'bg-slate-50',  border: 'border-slate-200' },
  { key: 'draft',           label: 'Drafts',           color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200' },
  { key: 'sent',            label: 'Sent',             color: 'text-sky-700',    bg: 'bg-sky-50',    border: 'border-sky-200' },
  { key: 'approved',        label: 'Approved',         color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  { key: 'rejected',        label: 'Rejected',         color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
  { key: 'awaiting',        label: 'Awaiting Response',color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  { key: 'expired',         label: 'Expired',          color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  { key: 'total_value',     label: 'Total Value',      color: 'text-primary',    bg: 'bg-secondary', border: 'border-primary/20', isMoney: true },
];

export default function Estimates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sort, setSort] = useState('newest');
  const [activeStat, setActiveStat] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.refetchQueries({ queryKey: ['estimates'] });
    setIsRefreshing(false);
  };

  const { data: estimates = [], isLoading } = useQuery({
    queryKey: ['estimates'],
    queryFn: () => base44.entities.Estimate.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const nums = estimates.map(e => e.estimate_number).filter(Boolean);
      const num = generateEstimateNumber(nums);
      const est = await base44.entities.Estimate.create({
        estimate_number: num,
        estimate_type: 'estimate',
        status: 'draft',
        client_name: '',
        date_created: new Date().toISOString(),
        version: 1,
        is_current_version: true,
        line_items: '[]',
        subtotal: 0, tax_amount: 0, total: 0,
      });
      await base44.entities.EstimateActivity.create({
        estimate_id: est.id,
        action: 'estimate_created',
        detail: `New estimate ${num} created`,
        actor: role || 'admin',
        timestamp: new Date().toISOString(),
      });
      return est;
    },
    onSuccess: (est) => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      navigate(`/estimates/${est.id}`);
    },
  });

  const stats = useMemo(() => {
    const m = { total: estimates.length, draft: 0, sent: 0, approved: 0, rejected: 0, awaiting: 0, expired: 0, total_value: 0 };
    estimates.forEach(e => {
      if (e.status === 'draft') m.draft++;
      if (e.status === 'sent' || e.status === 'viewed') { m.sent++; m.awaiting++; }
      if (e.status === 'approved') m.approved++;
      if (e.status === 'rejected') m.rejected++;
      if (e.status === 'expired') m.expired++;
      if (e.status === 'approved') m.total_value += Number(e.total) || 0;
    });
    return m;
  }, [estimates]);

  const filtered = useMemo(() => {
    let list = estimates.filter(e => e.is_current_version !== false);
    if (activeStat && activeStat !== 'total' && activeStat !== 'total_value') {
      if (activeStat === 'awaiting') list = list.filter(e => e.status === 'sent' || e.status === 'viewed');
      else list = list.filter(e => e.status === activeStat);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.estimate_number?.toLowerCase().includes(q) ||
        e.client_name?.toLowerCase().includes(q) ||
        e.company_name?.toLowerCase().includes(q) ||
        e.title?.toLowerCase().includes(q) ||
        e.property_address?.toLowerCase().includes(q) ||
        e.assigned_to?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') list = list.filter(e => e.status === filterStatus);
    if (filterType !== 'all') list = list.filter(e => e.estimate_type === filterType);

    if (sort === 'newest') list = [...list].sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
    if (sort === 'oldest') list = [...list].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
    if (sort === 'highest') list = [...list].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
    if (sort === 'lowest') list = [...list].sort((a, b) => (Number(a.total) || 0) - (Number(b.total) || 0));
    if (sort === 'alpha') list = [...list].sort((a, b) => (a.client_name || '').localeCompare(b.client_name || ''));
    if (sort === 'expiration') list = [...list].sort((a, b) => (a.expiration_date || 'z').localeCompare(b.expiration_date || 'z'));
    if (sort === 'updated') list = [...list].sort((a, b) => (b.updated_date || '').localeCompare(a.updated_date || ''));
    return list;
  }, [estimates, search, filterStatus, filterType, sort, activeStat]);

  return (
    <AppLayout title="Estimates">
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Estimates / Proposals</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Pricing documents, bids & approval workflow</p>
          </div>
          <Button className="h-9 rounded-xl text-sm gap-1.5" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            New Estimate
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
           {STAT_GROUPS.map(g => (
             <button 
               key={g.key}
               onClick={() => setActiveStat(activeStat === g.key ? null : g.key)}
               aria-label={`Filter by ${g.label}, ${g.isMoney ? `$${(stats[g.key] || 0).toLocaleString()}` : (stats[g.key] || 0)} items`}
               aria-pressed={activeStat === g.key}
               className={`text-left p-3 rounded-xl border-2 transition-all ${activeStat === g.key ? `${g.bg} ${g.border}` : 'bg-card border-border hover:border-primary/20'}`}
             >
              <p className={`text-lg font-bold leading-none ${g.color}`}>
                {g.isMoney ? `$${(stats[g.key] || 0).toLocaleString()}` : (stats[g.key] || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">{g.label}</p>
            </button>
          ))}
        </div>

        {/* Search + filters */}
         <div className="space-y-2">
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
             <Input placeholder="Search by number, client, title, address..." value={search} onChange={e => setSearch(e.target.value)} aria-label="Search estimates by number, client, title, or address" className="pl-9 h-9 rounded-xl text-sm" />
           </div>
           <div className="flex gap-2 flex-wrap">
             <BottomSheetSelect value={filterStatus} onChange={setFilterStatus} label="Status" options={[
               { label: 'All Statuses', value: 'all' },
               ...Object.entries(ESTIMATE_STATUS_CONFIG).map(([v, c]) => ({ label: c.label, value: v })),
             ]} />
             <BottomSheetSelect value={filterType} onChange={setFilterType} label="Type" options={[
               { label: 'All Types', value: 'all' },
               { label: 'Estimate', value: 'estimate' },
               { label: 'Proposal', value: 'proposal' },
               { label: 'Bid', value: 'bid' },
               { label: 'Change Order', value: 'change_order' },
             ]} />
             <BottomSheetSelect value={sort} onChange={setSort} label="Sort" options={[
               { label: 'Newest First', value: 'newest' },
               { label: 'Oldest First', value: 'oldest' },
               { label: 'Highest Total', value: 'highest' },
               { label: 'Lowest Total', value: 'lowest' },
               { label: 'A–Z by Client', value: 'alpha' },
               { label: 'Expiration Date', value: 'expiration' },
               { label: 'Recently Updated', value: 'updated' },
             ]} />
           </div>
         </div>

        {activeStat && activeStat !== 'total' && activeStat !== 'total_value' && (
           <div className="flex items-center justify-between">
             <p className="text-xs font-medium text-foreground">Showing: {STAT_GROUPS.find(g => g.key === activeStat)?.label}</p>
             <button onClick={() => setActiveStat(null)} aria-label="Clear estimate status filter" className="text-xs text-muted-foreground underline underline-offset-2">Clear</button>
           </div>
         )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No estimates found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(est => {
              const expiring = est.expiration_date && isPast(parseISO(est.expiration_date)) && est.status !== 'approved' && est.status !== 'rejected';
              return (
                <button 
                   key={est.id} 
                   onClick={() => navigate(`/estimates/${est.id}`)}
                   aria-label={`View estimate ${est.estimate_number}: $${Number(est.total).toLocaleString()} for ${est.client_name || 'Untitled'}, Status: ${est.status}`}
                   className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
                 >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-mono text-muted-foreground">{est.estimate_number}</p>
                        {est.version > 1 && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">v{est.version}</span>}
                        <span className="text-xs text-muted-foreground capitalize">{est.estimate_type?.replace(/_/g,' ')}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{est.client_name || 'Untitled'}</p>
                      {est.title && <p className="text-xs text-muted-foreground truncate">{est.title}</p>}
                      {est.property_address && <p className="text-xs text-muted-foreground truncate">{est.property_address}</p>}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {est.assigned_to && <span className="text-xs text-muted-foreground">→ {est.assigned_to}</span>}
                        {est.sent_date && <span className="text-xs text-muted-foreground">Sent {format(parseISO(est.sent_date), 'MMM d')}</span>}
                        {expiring && <span className="flex items-center gap-1 text-xs text-orange-600 font-medium"><AlertCircle className="w-3 h-3" />Expired</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <EstimateStatusBadge status={est.status} />
                      {est.total > 0 && (
                        <span className="text-sm font-bold text-primary">${Number(est.total).toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </PullToRefresh>
    </AppLayout>
  );
}