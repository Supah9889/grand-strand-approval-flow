import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Search, Loader2, FileDiff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import COCard from '../components/changeorders/COCard';
import COForm from '../components/changeorders/COForm';
import { CO_STATUS_CONFIG, CO_CATEGORY_LABELS } from '@/lib/changeOrderHelpers';
import { getInternalRole } from '@/lib/adminAuth';
import { toast } from 'sonner';

const STATS = [
  { key: 'total',    label: 'Total',           color: 'text-slate-700',  bg: 'bg-slate-50',  border: 'border-slate-200' },
  { key: 'draft',    label: 'Draft',            color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200' },
  { key: 'sent',     label: 'Awaiting Approval',color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  { key: 'approved', label: 'Approved',          color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  { key: 'rejected', label: 'Rejected',          color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
  { key: 'in_review',label: 'In Review',         color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
];

export default function ChangeOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterJob, setFilterJob] = useState('all');
  const [sort, setSort] = useState('newest');
  const [activeStat, setActiveStat] = useState(null);

  const { data: changeOrders = [], isLoading } = useQuery({
    queryKey: ['change-orders'],
    queryFn: () => base44.entities.ChangeOrder.list('-created_date'),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const co = await base44.entities.ChangeOrder.create(data);
      await base44.entities.ChangeOrderActivity.create({
        co_id: co.id,
        action: 'co_created',
        detail: `Change order ${data.co_number} created`,
        actor: role || 'admin',
        timestamp: new Date().toISOString(),
      });
      return co;
    },
    onSuccess: (co) => {
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
      setShowForm(false);
      toast.success('Change order created');
      navigate(`/change-orders/${co.id}`);
    },
  });

  const stats = useMemo(() => {
    const m = { total: changeOrders.length, draft: 0, sent: 0, approved: 0, rejected: 0, in_review: 0 };
    changeOrders.forEach(c => {
      if (m[c.status] !== undefined) m[c.status]++;
    });
    return m;
  }, [changeOrders]);

  const approvedTotal = useMemo(() => (
    changeOrders.filter(c => c.status === 'approved').reduce((sum, c) => sum + Number(c.total_financial_impact || 0), 0)
  ), [changeOrders]);

  const filtered = useMemo(() => {
    let list = changeOrders;
    if (activeStat && activeStat !== 'total') list = list.filter(c => c.status === activeStat);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.co_number?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.job_address?.toLowerCase().includes(q) ||
        c.customer_name?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') list = list.filter(c => c.status === filterStatus);
    if (filterCategory !== 'all') list = list.filter(c => c.category === filterCategory);
    if (filterJob !== 'all') list = list.filter(c => c.job_id === filterJob);

    if (sort === 'newest') list = [...list].sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
    if (sort === 'oldest') list = [...list].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
    if (sort === 'highest') list = [...list].sort((a, b) => Number(b.total_financial_impact || 0) - Number(a.total_financial_impact || 0));
    if (sort === 'lowest')  list = [...list].sort((a, b) => Number(a.total_financial_impact || 0) - Number(b.total_financial_impact || 0));
    if (sort === 'updated') list = [...list].sort((a, b) => (b.updated_date || '').localeCompare(a.updated_date || ''));
    if (sort === 'alpha')   list = [...list].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    return list;
  }, [changeOrders, search, filterStatus, filterCategory, filterJob, sort, activeStat]);

  const existingNums = changeOrders.map(c => c.co_number).filter(Boolean);

  return (
    <AppLayout title="Change Orders">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Change Orders</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Formal scope, cost & schedule changes</p>
          </div>
          {role === 'admin' && (
            <Button className="h-9 rounded-xl text-sm gap-1.5" onClick={() => setShowForm(true)}>
              <Plus className="w-3.5 h-3.5" /> New CO
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {STATS.map(g => (
            <button key={g.key} onClick={() => setActiveStat(activeStat === g.key ? null : g.key)}
              className={`text-left p-3 rounded-xl border-2 transition-all ${activeStat === g.key ? `${g.bg} ${g.border}` : 'bg-card border-border hover:border-primary/20'}`}>
              <p className={`text-lg font-bold leading-none ${g.color}`}>{stats[g.key] || 0}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">{g.label}</p>
            </button>
          ))}
        </div>

        {/* Approved total banner */}
        {approvedTotal !== 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-green-700 font-medium">Total Approved Change Order Value</span>
            <span className="text-sm font-bold text-green-700">{approvedTotal > 0 ? '+' : ''}${Math.abs(approvedTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        )}

        {/* New CO Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-foreground">New Change Order</p>
                  <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>
                <COForm jobs={jobs} existingNums={existingNums} onSave={createMutation.mutate} onCancel={() => setShowForm(false)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by number, title, job address..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl text-sm" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(CO_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CO_CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterJob} onValueChange={setFilterJob}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                {jobs.filter(j => j.status !== 'archived').map(j => <SelectItem key={j.id} value={j.id}>{j.address || j.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="highest">Highest Impact</SelectItem>
                <SelectItem value="lowest">Lowest Impact</SelectItem>
                <SelectItem value="updated">Recently Updated</SelectItem>
                <SelectItem value="alpha">A–Z Title</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <FileDiff className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No change orders found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(co => <COCard key={co.id} co={co} onClick={() => navigate(`/change-orders/${co.id}`)} />)}
          </div>
        )}
      </div>
    </AppLayout>
  );
}