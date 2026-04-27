import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Search, Plus, X, Loader2, ShoppingCart, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import POForm from '../components/purchasing/POForm';
import POCard from '../components/purchasing/POCard';
import { PO_STATUS_CONFIG, fmt } from '@/lib/financialHelpers';
import { getInternalRole } from '@/lib/adminAuth';
import { toast } from 'sonner';

export default function PurchaseOrders() {
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterVendor, setFilterVendor] = useState('all');
  const [filterJob, setFilterJob] = useState('all');
  const [sort, setSort] = useState('newest');

  const { data: pos = [], isLoading } = useQuery({ queryKey: ['purchase-orders'], queryFn: () => base44.entities.PurchaseOrder.list('-created_date') });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list('-created_date', 200) });
  const { data: vendors = [] } = useQuery({ queryKey: ['vendors'], queryFn: () => base44.entities.Vendor.list('company_name') });

  const createPO = useMutation({
    mutationFn: d => base44.entities.PurchaseOrder.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); setShowForm(false); toast.success('Purchase order created'); },
  });
  const updatePO = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PurchaseOrder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }),
  });

  const existingNums = pos.map(p => p.po_number).filter(Boolean);
  const activeJobs = jobs.filter(j => j.status !== 'archived');
  const vendorNames = [...new Set(pos.map(p => p.vendor_name).filter(Boolean))];

  const totals = useMemo(() => ({
    open: pos.filter(p => ['sent','ordered'].includes(p.status)).reduce((s, p) => s + Number(p.total || 0), 0),
    pending: pos.filter(p => p.status === 'ordered').length,
    received: pos.filter(p => p.status === 'received').length,
    total: pos.reduce((s, p) => s + Number(p.total || 0), 0),
  }), [pos]);

  const filtered = useMemo(() => {
    let l = pos;
    if (filterStatus !== 'all') l = l.filter(p => p.status === filterStatus);
    if (filterVendor !== 'all') l = l.filter(p => p.vendor_name === filterVendor);
    if (filterJob !== 'all') l = l.filter(p => p.job_id === filterJob);
    if (search) {
      const q = search.toLowerCase();
      l = l.filter(p =>
        p.po_number?.toLowerCase().includes(q) ||
        p.vendor_name?.toLowerCase().includes(q) ||
        p.job_address?.toLowerCase().includes(q) ||
        p.title?.toLowerCase().includes(q) ||
        p.created_by_name?.toLowerCase().includes(q)
      );
    }
    const sortFns = {
      newest: (a, b) => (b.created_date || '').localeCompare(a.created_date || ''),
      oldest: (a, b) => (a.created_date || '').localeCompare(b.created_date || ''),
      amount_high: (a, b) => Number(b.total || 0) - Number(a.total || 0),
      amount_low: (a, b) => Number(a.total || 0) - Number(b.total || 0),
      vendor: (a, b) => (a.vendor_name || '').localeCompare(b.vendor_name || ''),
    };
    return [...l].sort(sortFns[sort] || sortFns.newest);
  }, [pos, filterStatus, filterVendor, filterJob, search, sort]);

  if (role !== 'admin') {
    return (
      <AppLayout title="Purchase Orders">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">Access restricted to admin users.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Purchase Orders">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Purchase Orders</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Track committed purchasing by job & vendor</p>
          </div>
          <Button className="h-9 rounded-xl text-sm gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" /> New PO
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Open Value',  value: `$${fmt(totals.open)}`,   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
            { label: 'Ordered',     value: totals.pending,            color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
            { label: 'Received',    value: totals.received,           color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
            { label: 'Total Value', value: `$${fmt(totals.total)}`,   color: 'text-primary',    bg: 'bg-secondary', border: 'border-primary/20' },
          ].map(s => (
            <div key={s.label} className={`p-3 rounded-xl border-2 ${s.bg} ${s.border}`}>
              <p className={`text-base font-bold leading-none ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* New PO form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-foreground">New Purchase Order</p>
                  <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>
                <POForm
                  jobs={activeJobs}
                  vendors={vendors}
                  existingNums={existingNums}
                  onSave={createPO.mutate}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search PO #, vendor, job, title..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl text-sm" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(PO_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterVendor} onValueChange={setFilterVendor}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendorNames.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterJob} onValueChange={setFilterJob}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                {activeJobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address || j.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="amount_high">Amount ↓</SelectItem>
                <SelectItem value="amount_low">Amount ↑</SelectItem>
                <SelectItem value="vendor">Vendor A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <ShoppingCart className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No purchase orders found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(po => (
              <POCard key={po.id} po={po} onStatusChange={(status) => updatePO.mutate({ id: po.id, data: { status } })} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}