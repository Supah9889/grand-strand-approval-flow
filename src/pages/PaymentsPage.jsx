import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Search, Plus, X, Loader2, CreditCard, AlertCircle, Trash2 } from 'lucide-react';
import { format, parseISO, isThisWeek } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import PaymentFullForm from '../components/invoices/PaymentFullForm';
import { fmt } from '@/lib/financialHelpers';
import { getInternalRole } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { toast } from 'sonner';

function DeletePaymentDialog({ payment, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-xs space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Delete Payment?</p>
          <p className="text-xs text-muted-foreground">
            ${fmt(payment.amount)} from <span className="font-medium text-foreground">{payment.customer_name || payment.job_address || 'this record'}</span> will be permanently deleted and cannot be recovered.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 h-9 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 h-9 rounded-xl bg-destructive text-white text-xs font-medium hover:bg-destructive/90 transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

const METHODS = { check: 'Check', ach: 'ACH', card: 'Card', cash: 'Cash', zelle: 'Zelle', venmo: 'Venmo', other: 'Other' };

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterJob, setFilterJob] = useState('all');
  const [sort, setSort] = useState('newest');
  const [confirmDelete, setConfirmDelete] = useState(null); // payment object to delete

  const { data: payments = [], isLoading } = useQuery({ queryKey: ['payments'], queryFn: () => base44.entities.Payment.list('-created_date') });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list('-created_date') });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list('-created_date', 200) });

  const createPayment = useMutation({
    mutationFn: async (d) => {
      const p = await base44.entities.Payment.create(d);
      if (d.invoice_id) {
        const inv = invoices.find(i => i.id === d.invoice_id);
        if (inv) {
          const paid = Number(inv.amount_paid || 0) + Number(d.amount);
          const bal = Number(inv.amount) - paid;
          await base44.entities.Invoice.update(d.invoice_id, {
            amount_paid: paid,
            balance_due: Math.max(0, bal),
            status: bal <= 0 ? 'paid' : 'partial',
            paid_date: bal <= 0 ? new Date().toISOString() : undefined,
          });
        }
      }
      return p;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowForm(false);
      toast.success('Payment recorded');
    },
  });

  const deletePayment = useMutation({
    mutationFn: async (payment) => {
      await base44.entities.Payment.delete(payment.id);
      const user = await base44.auth.me().catch(() => null);
      logAudit(
        payment.job_id || payment.id,
        'payment_edited',
        user?.email || role,
        `Logged payment permanently deleted: $${fmt(payment.amount)} from ${payment.customer_name || payment.job_address || 'unknown'} on ${payment.payment_date || 'unknown date'}`,
        {
          module: 'payment',
          record_id: payment.id,
          job_id: payment.job_id,
          job_address: payment.job_address,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setConfirmDelete(null);
      toast.success('Payment deleted');
    },
    onError: (err) => {
      setConfirmDelete(null);
      toast.error(`Delete failed: ${err?.message || 'Unknown error'}`);
    },
  });

  const activeJobs = jobs.filter(j => j.status !== 'archived');

  const totals = useMemo(() => ({
    thisWeek: payments.filter(p => p.payment_date && isThisWeek(parseISO(p.payment_date))).reduce((s, p) => s + Number(p.amount || 0), 0),
    total: payments.reduce((s, p) => s + Number(p.amount || 0), 0),
    count: payments.length,
  }), [payments]);

  const filtered = useMemo(() => {
    let l = payments;
    if (filterMethod !== 'all') l = l.filter(p => p.payment_method === filterMethod);
    if (filterJob !== 'all') l = l.filter(p => p.job_id === filterJob);
    if (search) {
      const q = search.toLowerCase();
      l = l.filter(p =>
        p.customer_name?.toLowerCase().includes(q) ||
        p.job_address?.toLowerCase().includes(q) ||
        p.reference_number?.toLowerCase().includes(q) ||
        String(p.amount).includes(q)
      );
    }
    const sortFns = {
      newest: (a, b) => (b.payment_date || b.created_date || '').localeCompare(a.payment_date || a.created_date || ''),
      oldest: (a, b) => (a.payment_date || a.created_date || '').localeCompare(b.payment_date || b.created_date || ''),
      amount_high: (a, b) => Number(b.amount || 0) - Number(a.amount || 0),
      amount_low: (a, b) => Number(a.amount || 0) - Number(b.amount || 0),
    };
    return [...l].sort(sortFns[sort] || sortFns.newest);
  }, [payments, filterMethod, filterJob, search, sort]);

  if (role !== 'admin') {
    return (
      <AppLayout title="Payments">
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
    <AppLayout title="Payments">
      {confirmDelete && (
        <DeletePaymentDialog
          payment={confirmDelete}
          onConfirm={() => deletePayment.mutate(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Payments</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Incoming payments & receivables</p>
          </div>
          <Button className="h-9 rounded-xl text-sm gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" /> Record Payment
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Total Received',    value: `$${fmt(totals.total)}`,    color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200' },
            { label: 'This Week',         value: `$${fmt(totals.thisWeek)}`, color: 'text-primary',    bg: 'bg-secondary',  border: 'border-primary/20' },
            { label: 'Total Payments',    value: totals.count,               color: 'text-slate-600',  bg: 'bg-slate-50',   border: 'border-slate-200' },
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
                  <p className="text-sm font-semibold text-foreground">Record Payment</p>
                  <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>
                <PaymentFullForm
                  jobs={activeJobs}
                  invoices={invoices.filter(i => !['paid','closed'].includes(i.status))}
                  onSave={createPayment.mutate}
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
            <Input placeholder="Search customer, job, reference..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl text-sm" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {Object.entries(METHODS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
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
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <CreditCard className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => {
              const inv = invoices.find(i => i.id === p.invoice_id);
              return (
                <div key={p.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{p.customer_name || p.job_address || 'Payment'}</p>
                      {p.job_address && p.customer_name && <p className="text-xs text-muted-foreground truncate">{p.job_address}</p>}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-md font-medium">{METHODS[p.payment_method] || p.payment_method}</span>
                        {p.reference_number && <span className="text-xs text-muted-foreground">#{p.reference_number}</span>}
                        {inv && <span className="text-xs text-muted-foreground">→ {inv.invoice_number}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.payment_date ? format(parseISO(p.payment_date), 'MMMM d, yyyy') : ''}</p>
                      {p.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{p.notes}</p>}
                    </div>
                    <div className="shrink-0 text-right flex flex-col items-end gap-1">
                      <p className="text-lg font-black text-green-600">+${fmt(p.amount)}</p>
                      {p.recorded_by && <p className="text-xs text-muted-foreground">{p.recorded_by}</p>}
                      <button
                        onClick={() => setConfirmDelete(p)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors mt-1"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}