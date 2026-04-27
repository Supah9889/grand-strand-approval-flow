import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BottomSheetSelect from '@/components/BottomSheetSelect';
import { Search, Plus, X, Loader2, Receipt, AlertCircle } from 'lucide-react';
import { isPast, isToday, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import PullToRefresh from '../components/PullToRefresh';
import BillDetailForm from '../components/purchasing/BillDetailForm';
import BillDetailCard from '../components/purchasing/BillDetailCard';
import { BILL_STATUS_CONFIG, fmt } from '@/lib/financialHelpers';
import { getInternalRole } from '@/lib/adminAuth';
import { toast } from 'sonner';

export default function Bills() {
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterVendor, setFilterVendor] = useState('all');
  const [filterJob, setFilterJob] = useState('all');
  const [filterOverdue, setFilterOverdue] = useState('all');
  const [sort, setSort] = useState('newest');

  const { data: bills = [], isLoading } = useQuery({ queryKey: ['bills'], queryFn: () => base44.entities.Bill.list('-created_date') });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list('-created_date', 200) });
  const { data: vendors = [] } = useQuery({ queryKey: ['vendors'], queryFn: () => base44.entities.Vendor.list('company_name') });

  const createBill = useOptimisticMutation({
    mutationFn: d => base44.entities.Bill.create(d),
    queryKey: ['bills'],
    optimisticUpdate: (prev, billData) => [
      { ...billData, id: `temp-${Date.now()}`, created_date: new Date().toISOString(), updated_date: new Date().toISOString() },
      ...prev,
    ],
    rollback: (prev) => prev,
    onSuccess: () => { setShowForm(false); toast.success('Bill created'); },
    onError: () => toast.error('Failed to create bill'),
  });
  const updateBill = useOptimisticMutation({
    mutationFn: ({ id, data }) => base44.entities.Bill.update(id, data),
    queryKey: ['bills'],
    optimisticUpdate: (prev, newData, { id, data }) =>
      prev.map(bill => bill.id === id ? { ...bill, ...data } : bill),
    rollback: (prev) => prev,
    onSuccess: () => toast.success('Bill updated'),
  });

  const isOverdueFn = (b) => b.due_date && !['paid','closed'].includes(b.status) && isPast(parseISO(b.due_date)) && !isToday(parseISO(b.due_date));

  const existingNums = bills.map(b => b.bill_number).filter(Boolean);
  const activeJobs = jobs.filter(j => j.status !== 'archived');
  const vendorNames = [...new Set(bills.map(b => b.vendor_name).filter(Boolean))];

  const totals = useMemo(() => ({
    open: bills.filter(b => b.status === 'open').reduce((s, b) => s + Number(b.amount || 0), 0),
    overdue: bills.filter(b => isOverdueFn(b)).reduce((s, b) => s + Number(b.amount || 0), 0),
    paid: bills.filter(b => b.status === 'paid').reduce((s, b) => s + Number(b.amount || 0), 0),
    count: bills.filter(b => ['open','overdue'].includes(b.status) || isOverdueFn(b)).length,
  }), [bills]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.refetchQueries({ queryKey: ['bills'] });
    await queryClient.refetchQueries({ queryKey: ['jobs'] });
    await queryClient.refetchQueries({ queryKey: ['vendors'] });
    setIsRefreshing(false);
  };

  const filtered = useMemo(() => {
    let l = bills;
    if (filterStatus !== 'all') l = l.filter(b => b.status === filterStatus);
    if (filterVendor !== 'all') l = l.filter(b => b.vendor_name === filterVendor);
    if (filterJob !== 'all') l = l.filter(b => b.job_id === filterJob);
    if (filterOverdue === 'yes') l = l.filter(b => isOverdueFn(b));
    if (filterOverdue === 'no') l = l.filter(b => !isOverdueFn(b));
    if (search) {
      const q = search.toLowerCase();
      l = l.filter(b =>
        b.bill_number?.toLowerCase().includes(q) ||
        b.vendor_name?.toLowerCase().includes(q) ||
        b.job_address?.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q) ||
        String(b.amount).includes(q)
      );
    }
    const sortFns = {
      newest: (a, b) => (b.created_date || '').localeCompare(a.created_date || ''),
      oldest: (a, b) => (a.created_date || '').localeCompare(b.created_date || ''),
      due_soon: (a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'),
      overdue_first: (a, b) => (isOverdueFn(b) ? 1 : 0) - (isOverdueFn(a) ? 1 : 0),
      amount_high: (a, b) => Number(b.amount || 0) - Number(a.amount || 0),
      amount_low: (a, b) => Number(a.amount || 0) - Number(b.amount || 0),
      vendor: (a, b) => (a.vendor_name || '').localeCompare(b.vendor_name || ''),
    };
    return [...l].sort(sortFns[sort] || sortFns.newest);
  }, [bills, filterStatus, filterVendor, filterJob, filterOverdue, search, sort]);

  if (role !== 'admin') {
    return (
      <AppLayout title="Bills">
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
    <AppLayout title="Bills">
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Bills</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Vendor bills & payables by job</p>
          </div>
          <Button 
            className="h-9 rounded-xl text-sm gap-1.5" 
            onClick={() => setShowForm(true)}
            aria-label="Create new bill"
          >
            <Plus className="w-3.5 h-3.5" /> New Bill
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Open Bills',    value: `$${fmt(totals.open)}`,    color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
            { label: 'Overdue',       value: `$${fmt(totals.overdue)}`,  color: totals.overdue > 0 ? 'text-red-700' : 'text-slate-500',    bg: 'bg-red-50',    border: 'border-red-200' },
            { label: 'Paid',          value: `$${fmt(totals.paid)}`,     color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
            { label: 'Outstanding',   value: totals.count,               color: 'text-primary',    bg: 'bg-secondary', border: 'border-primary/20' },
          ].map(s => (
            <div key={s.label} className={`p-3 rounded-xl border-2 ${s.bg} ${s.border}`}>
              <p className={`text-base font-bold leading-none ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* New Bill form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-foreground">New Bill</p>
                  <button 
                    onClick={() => setShowForm(false)} 
                    aria-label="Close bill form"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <BillDetailForm
                  jobs={activeJobs}
                  vendors={vendors}
                  existingNums={existingNums}
                  onSave={createBill.mutate}
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
            <Input 
              placeholder="Search bill #, vendor, job, amount..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              aria-label="Search bills by number, vendor, job, or amount"
              className="pl-9 h-9 rounded-xl text-sm" 
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <BottomSheetSelect value={filterStatus} onChange={setFilterStatus} label="Status" options={[
              { label: 'All Statuses', value: 'all' },
              ...Object.entries(BILL_STATUS_CONFIG).map(([v, c]) => ({ label: c.label, value: v })),
            ]} />
            <BottomSheetSelect value={filterOverdue} onChange={setFilterOverdue} label="Overdue" options={[
              { label: 'All', value: 'all' },
              { label: 'Overdue Only', value: 'yes' },
              { label: 'Not Overdue', value: 'no' },
            ]} />
            <BottomSheetSelect value={filterVendor} onChange={setFilterVendor} label="Vendor" options={[
              { label: 'All Vendors', value: 'all' },
              ...vendorNames.map(v => ({ label: v, value: v })),
            ]} />
            <BottomSheetSelect value={filterJob} onChange={setFilterJob} label="Job" options={[
              { label: 'All Jobs', value: 'all' },
              ...activeJobs.map(j => ({ label: j.address || j.title, value: j.id })),
            ]} />
            <BottomSheetSelect value={sort} onChange={setSort} label="Sort" options={[
              { label: 'Newest First', value: 'newest' },
              { label: 'Oldest First', value: 'oldest' },
              { label: 'Due Soonest', value: 'due_soon' },
              { label: 'Overdue First', value: 'overdue_first' },
              { label: 'Amount ↓', value: 'amount_high' },
              { label: 'Amount ↑', value: 'amount_low' },
              { label: 'Vendor A–Z', value: 'vendor' },
            ]} />
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <Receipt className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No bills found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(bill => (
              <BillDetailCard
                key={bill.id}
                bill={bill}
                isOverdue={isOverdueFn(bill)}
                onStatusChange={(status) => updateBill.mutate({ id: bill.id, data: { status } })}
                onUpdate={(data) => updateBill.mutate({ id: bill.id, data })}
              />
            ))}
          </div>
        )}
      </div>
    </PullToRefresh>
    </AppLayout>
  );
}