import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Search, Plus, X, Loader2, FileText, AlertCircle } from 'lucide-react';
import { isPast, isToday, parseISO, format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import InvoiceFullForm from '../components/invoices/InvoiceFullForm';
import InvoiceCard from '../components/invoices/InvoiceCard';
import { INVOICE_STATUS_CONFIG, fmt, generateNumber } from '@/lib/financialHelpers';
import { getInternalRole, isAdmin as getIsAdmin } from '@/lib/adminAuth';
import { toast } from 'sonner';

export default function Invoices() {
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const isOwnerOrAdmin = getIsAdmin();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterJob, setFilterJob] = useState('all');
  const [filterOverdue, setFilterOverdue] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [sort, setSort] = useState('newest');

  const { data: invoices = [], isLoading } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list('-created_date') });
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => base44.entities.Payment.list('-created_date') });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list('-created_date', 200) });
  const { data: estimates = [] } = useQuery({ queryKey: ['estimates'], queryFn: () => base44.entities.Estimate.list('-created_date') });
  const { data: changeOrders = [] } = useQuery({ queryKey: ['change-orders'], queryFn: () => base44.entities.ChangeOrder.list('-created_date') });

  const createInvoice = useMutation({
    mutationFn: d => base44.entities.Invoice.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invoices'] }); setShowForm(false); toast.success('Invoice created'); },
  });
  const updateInvoice = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const isOverdueFn = (inv) => inv.due_date && !['paid','closed','canceled'].includes(inv.status) && isPast(parseISO(inv.due_date)) && !isToday(parseISO(inv.due_date));
  const existingNums = invoices.map(i => i.invoice_number).filter(Boolean);
  const activeJobs = jobs.filter(j => j.status !== 'archived');

  const totals = useMemo(() => ({
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    overdue: invoices.filter(i => isOverdueFn(i)).length,
    outstanding: invoices.filter(i => !['paid','closed','draft'].includes(i.status)).reduce((s, i) => s + Number(i.balance_due || i.amount || 0), 0),
    received: payments.reduce((s, p) => s + Number(p.amount || 0), 0),
  }), [invoices, payments]);

  const filtered = useMemo(() => {
    let l = invoices;
    if (filterStatus !== 'all') l = l.filter(i => i.status === filterStatus);
    if (filterJob !== 'all') l = l.filter(i => i.job_id === filterJob);
    if (filterSource !== 'all') l = l.filter(i => i.source_type === filterSource);
    if (filterOverdue === 'yes') l = l.filter(i => isOverdueFn(i));
    if (filterOverdue === 'no') l = l.filter(i => !isOverdueFn(i));
    if (search) {
      const q = search.toLowerCase();
      l = l.filter(i =>
        i.invoice_number?.toLowerCase().includes(q) ||
        i.customer_name?.toLowerCase().includes(q) ||
        i.job_address?.toLowerCase().includes(q) ||
        String(i.amount).includes(q)
      );
    }
    const sortFns = {
      newest: (a, b) => (b.created_date || '').localeCompare(a.created_date || ''),
      oldest: (a, b) => (a.created_date || '').localeCompare(b.created_date || ''),
      due_soon: (a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'),
      overdue_first: (a, b) => (isOverdueFn(b) ? 1 : 0) - (isOverdueFn(a) ? 1 : 0),
      amount_high: (a, b) => Number(b.amount || 0) - Number(a.amount || 0),
      amount_low: (a, b) => Number(a.amount || 0) - Number(b.amount || 0),
      customer: (a, b) => (a.customer_name || '').localeCompare(b.customer_name || ''),
    };
    return [...l].sort(sortFns[sort] || sortFns.newest);
  }, [invoices, filterStatus, filterJob, filterSource, filterOverdue, search, sort]);

  if (!isOwnerOrAdmin) {
    return (
      <AppLayout title="Invoices">
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
    <AppLayout title="Invoices">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Invoices</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Billing & receivables by job</p>
          </div>
          <Button className="h-9 rounded-xl text-sm gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" /> New Invoice
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Outstanding',   value: `$${fmt(totals.outstanding)}`, color: 'text-primary',    bg: 'bg-secondary',  border: 'border-primary/20' },
            { label: 'Received',      value: `$${fmt(totals.received)}`,    color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200' },
            { label: 'Overdue',       value: totals.overdue,                color: totals.overdue > 0 ? 'text-red-700' : 'text-slate-500', bg: 'bg-red-50', border: 'border-red-200' },
            { label: 'Draft',         value: totals.draft,                  color: 'text-slate-600',  bg: 'bg-slate-50',   border: 'border-slate-200' },
          ].map(s => (
            <div key={s.label} className={`p-3 rounded-xl border-2 ${s.bg} ${s.border}`}>
              <p className={`text-base font-bold leading-none ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-foreground">New Invoice</p>
                  <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>
                <InvoiceFullForm
                  jobs={activeJobs}
                  estimates={estimates}
                  changeOrders={changeOrders}
                  existingNums={existingNums}
                  onSave={createInvoice.mutate}
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
            <Input placeholder="Search invoice #, customer, job..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl text-sm" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(INVOICE_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterOverdue} onValueChange={setFilterOverdue}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Overdue Only</SelectItem>
                <SelectItem value="no">Not Overdue</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="estimate">From Estimate</SelectItem>
                <SelectItem value="change_order">From Change Order</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
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
                <SelectItem value="due_soon">Due Soonest</SelectItem>
                <SelectItem value="overdue_first">Overdue First</SelectItem>
                <SelectItem value="amount_high">Amount ↓</SelectItem>
                <SelectItem value="amount_low">Amount ↑</SelectItem>
                <SelectItem value="customer">Customer A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No invoices found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(inv => (
              <InvoiceCard
                key={inv.id}
                invoice={inv}
                payments={payments.filter(p => p.invoice_id === inv.id)}
                isOverdue={isOverdueFn(inv)}
                onStatusChange={(status) => updateInvoice.mutate({ id: inv.id, data: { status } })}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}