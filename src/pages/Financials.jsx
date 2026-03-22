import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Search, Loader2, DollarSign, FileText, Receipt, CreditCard,
  TrendingUp, TrendingDown, Plus, X, AlertCircle
} from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import InvoiceForm from '../components/financials/InvoiceForm';
import BillForm from '../components/financials/BillForm';
import PaymentForm from '../components/financials/PaymentForm';
import { INVOICE_STATUS_CONFIG, BILL_STATUS_CONFIG, fmt, calcJobFinancials } from '@/lib/financialHelpers';
import { getInternalRole } from '@/lib/adminAuth';
import { toast } from 'sonner';

const TABS = [
  { key: 'overview',  label: 'Overview',  icon: TrendingUp },
  { key: 'invoices',  label: 'Invoices',  icon: FileText },
  { key: 'bills',     label: 'Bills',     icon: Receipt },
  { key: 'payments',  label: 'Payments',  icon: CreditCard },
];

export default function Financials() {
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const [tab, setTab] = useState('overview');
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterJob, setFilterJob] = useState('all');

  const { data: invoices = [], isLoading: loadInv } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list('-created_date') });
  const { data: bills = [], isLoading: loadBills } = useQuery({ queryKey: ['bills'], queryFn: () => base44.entities.Bill.list('-created_date') });
  const { data: payments = [], isLoading: loadPay } = useQuery({ queryKey: ['payments'], queryFn: () => base44.entities.Payment.list('-created_date') });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list('-created_date', 200) });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list('-created_date') });
  const { data: changeOrders = [] } = useQuery({ queryKey: ['change-orders'], queryFn: () => base44.entities.ChangeOrder.list('-created_date') });
  const { data: budgets = [] } = useQuery({ queryKey: ['budgets'], queryFn: () => base44.entities.JobBudget.list('-created_date') });

  const createInvoice = useMutation({
    mutationFn: d => base44.entities.Invoice.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invoices'] }); setShowForm(false); toast.success('Invoice created'); },
  });
  const createBill = useMutation({
    mutationFn: d => base44.entities.Bill.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bills'] }); setShowForm(false); toast.success('Bill created'); },
  });
  const createPayment = useMutation({
    mutationFn: async (d) => {
      const p = await base44.entities.Payment.create(d);
      if (d.invoice_id) {
        const inv = invoices.find(i => i.id === d.invoice_id);
        if (inv) {
          const paid = Number(inv.amount_paid || 0) + Number(d.amount);
          const bal = Number(inv.amount) - paid;
          await base44.entities.Invoice.update(d.invoice_id, {
            amount_paid: paid, balance_due: bal,
            status: bal <= 0 ? 'paid' : 'partial',
            paid_date: bal <= 0 ? new Date().toISOString() : undefined,
          });
        }
      }
      return p;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payments'] }); queryClient.invalidateQueries({ queryKey: ['invoices'] }); setShowForm(false); toast.success('Payment recorded'); },
  });
  const updateInvoiceStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Invoice.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
  const updateBillStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Bill.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bills'] }),
  });

  const totals = useMemo(() => {
    const totalInvoiced = invoices.filter(i => !['draft','closed'].includes(i.status)).reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalReceived = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const openBills = bills.filter(b => b.status === 'open').reduce((s, b) => s + Number(b.amount || 0), 0);
    const overdueBills = bills.filter(b => b.status === 'overdue' || (b.status === 'open' && b.due_date && isPast(parseISO(b.due_date)) && !isToday(parseISO(b.due_date)))).reduce((s, b) => s + Number(b.amount || 0), 0);
    const approvedCO = changeOrders.filter(co => co.status === 'approved').reduce((s, co) => s + Number(co.total_financial_impact || 0), 0);
    const totalExpenseCost = expenses.reduce((s, e) => s + Number(e.total_amount || 0), 0);
    return { totalInvoiced, totalReceived, openBills, overdueBills, approvedCO, totalExpenseCost };
  }, [invoices, payments, bills, changeOrders, expenses]);

  const filterList = (list) => {
    let l = list;
    if (filterJob !== 'all') l = l.filter(x => x.job_id === filterJob);
    if (filterStatus !== 'all') l = l.filter(x => x.status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      l = l.filter(x =>
        x.invoice_number?.toLowerCase().includes(q) || x.bill_number?.toLowerCase().includes(q) ||
        x.customer_name?.toLowerCase().includes(q) || x.vendor_name?.toLowerCase().includes(q) ||
        x.job_address?.toLowerCase().includes(q)
      );
    }
    return l;
  };

  const existingInvNums = invoices.map(i => i.invoice_number).filter(Boolean);
  const existingBillNums = bills.map(b => b.bill_number).filter(Boolean);

  const activeJobs = jobs.filter(j => j.status !== 'archived');

  return (
    <AppLayout title="Financials">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Job Financials</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Invoices, bills, payments & job costing</p>
          </div>
          {tab !== 'overview' && (
            <Button className="h-9 rounded-xl text-sm gap-1.5" onClick={() => setShowForm(true)}>
              <Plus className="w-3.5 h-3.5" /> New {tab === 'invoices' ? 'Invoice' : tab === 'bills' ? 'Bill' : 'Payment'}
            </Button>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Invoiced',       value: totals.totalInvoiced,  color: 'text-primary',   bg: 'bg-secondary',  border: 'border-primary/20' },
            { label: 'Received',       value: totals.totalReceived,  color: 'text-green-700', bg: 'bg-green-50',   border: 'border-green-200' },
            { label: 'Open Bills',     value: totals.openBills,      color: totals.openBills > 0 ? 'text-amber-700' : 'text-slate-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
            { label: 'Overdue Bills',  value: totals.overdueBills,   color: totals.overdueBills > 0 ? 'text-red-700' : 'text-slate-600',     bg: 'bg-red-50',     border: 'border-red-200' },
          ].map(g => (
            <div key={g.label} className={`p-3 rounded-xl border-2 ${g.bg} ${g.border}`}>
              <p className={`text-base font-bold leading-none ${g.color}`}>${fmt(g.value)}</p>
              <p className="text-xs text-muted-foreground mt-1">{g.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/60 rounded-xl p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setTab(key); setShowForm(false); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${tab === key ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {/* Form panel */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-foreground">New {tab === 'invoices' ? 'Invoice' : tab === 'bills' ? 'Bill' : 'Payment'}</p>
                  <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>
                {tab === 'invoices' && <InvoiceForm existingNums={existingInvNums} onSave={createInvoice.mutate} onCancel={() => setShowForm(false)} />}
                {tab === 'bills' && <BillForm existingNums={existingBillNums} onSave={createBill.mutate} onCancel={() => setShowForm(false)} />}
                {tab === 'payments' && <PaymentForm onSave={createPayment.mutate} onCancel={() => setShowForm(false)} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        {tab !== 'overview' && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl text-sm" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={filterJob} onValueChange={setFilterJob}>
                <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  {activeJobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address || j.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {tab === 'invoices' && Object.entries(INVOICE_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
                  {tab === 'bills' && Object.entries(BILL_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Content per tab */}
        {tab === 'overview' && (
          <OverviewTab jobs={activeJobs} invoices={invoices} bills={bills} payments={payments} expenses={expenses} changeOrders={changeOrders} budgets={budgets} />
        )}
        {tab === 'invoices' && (
          <InvoiceList invoices={filterList(invoices)} jobs={jobs} onStatusChange={(id, status) => updateInvoiceStatus.mutate({ id, status })} />
        )}
        {tab === 'bills' && (
          <BillList bills={filterList(bills)} onStatusChange={(id, status) => updateBillStatus.mutate({ id, status })} />
        )}
        {tab === 'payments' && (
          <PaymentList payments={filterList(payments)} />
        )}
      </div>
    </AppLayout>
  );
}

function OverviewTab({ jobs, invoices, bills, payments, expenses, changeOrders, budgets }) {
  const rows = jobs.map(job => {
    const budget = budgets.find(b => b.job_id === job.id);
    const jobExpenses = expenses.filter(e => e.job_id === job.id);
    const jobInvoices = invoices.filter(i => i.job_id === job.id);
    const jobPayments = payments.filter(p => p.job_id === job.id);
    const jobCOs = changeOrders.filter(co => co.job_id === job.id);
    const fin = calcJobFinancials({ budget, expenses: jobExpenses, timeEntries: [], changeOrders: jobCOs, invoices: jobInvoices, payments: jobPayments });
    return { job, fin, budget };
  }).filter(r => r.fin.totalExpectedRevenue > 0 || r.fin.totalJobCost > 0 || r.fin.invoicesSent > 0);

  if (!rows.length) return (
    <div className="text-center py-14 space-y-2">
      <DollarSign className="w-8 h-8 text-muted-foreground/30 mx-auto" />
      <p className="text-sm text-muted-foreground">No financial data yet. Add budgets, invoices, or expenses to jobs.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {rows.map(({ job, fin }) => (
        <div key={job.id} className="bg-card border border-border rounded-2xl p-4">
          <p className="text-sm font-semibold text-foreground">{job.address || job.title}</p>
          {job.customer_name && <p className="text-xs text-muted-foreground mb-2">{job.customer_name}</p>}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
            <span className="text-muted-foreground">Expected Revenue</span><span className="font-medium text-right">${fmt(fin.totalExpectedRevenue)}</span>
            <span className="text-muted-foreground">Total Cost</span><span className="font-medium text-right">${fmt(fin.totalJobCost)}</span>
            <span className="text-muted-foreground">Invoiced</span><span className="font-medium text-right">${fmt(fin.invoicesSent)}</span>
            <span className="text-muted-foreground">Received</span><span className="font-medium text-right text-green-600">${fmt(fin.paymentsReceived)}</span>
          </div>
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/60">
            <span className="text-xs text-muted-foreground">Gross Profit</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${fin.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fin.grossProfit >= 0 ? '+' : ''}${fmt(fin.grossProfit)}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${fin.grossMarginPct >= 20 ? 'bg-green-100 text-green-700' : fin.grossMarginPct >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                {fin.grossMarginPct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InvoiceList({ invoices, jobs, onStatusChange }) {
  if (!invoices.length) return <p className="text-sm text-muted-foreground text-center py-8">No invoices found.</p>;
  return (
    <div className="space-y-2">
      {invoices.map(inv => {
        const cfg = INVOICE_STATUS_CONFIG[inv.status] || INVOICE_STATUS_CONFIG.draft;
        const isOverdue = inv.due_date && isPast(parseISO(inv.due_date)) && !['paid','closed'].includes(inv.status);
        return (
          <div key={inv.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-muted-foreground">{inv.invoice_number}</span>
                  {isOverdue && <span className="flex items-center gap-0.5 text-xs text-red-600"><AlertCircle className="w-3 h-3" />Overdue</span>}
                </div>
                <p className="text-sm font-semibold text-foreground">{inv.customer_name || inv.job_address}</p>
                {inv.job_address && <p className="text-xs text-muted-foreground truncate">{inv.job_address}</p>}
                {inv.due_date && <p className="text-xs text-muted-foreground">Due {format(parseISO(inv.due_date), 'MMM d, yyyy')}</p>}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <p className="text-base font-bold text-foreground">${fmt(inv.amount)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
              </div>
            </div>
            {inv.balance_due > 0 && inv.amount_paid > 0 && (
              <p className="text-xs text-amber-600 mt-1">Paid: ${fmt(inv.amount_paid)} · Balance: ${fmt(inv.balance_due)}</p>
            )}
            <div className="flex gap-2 mt-2 pt-2 border-t border-border/60">
              <Select value={inv.status} onValueChange={v => onStatusChange(inv.id, v)}>
                <SelectTrigger className="h-7 text-xs rounded-lg flex-1 max-w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(INVOICE_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BillList({ bills, onStatusChange }) {
  if (!bills.length) return <p className="text-sm text-muted-foreground text-center py-8">No bills found.</p>;
  return (
    <div className="space-y-2">
      {bills.map(bill => {
        const cfg = BILL_STATUS_CONFIG[bill.status] || BILL_STATUS_CONFIG.open;
        const isOverdue = bill.due_date && isPast(parseISO(bill.due_date)) && !['paid','closed'].includes(bill.status);
        return (
          <div key={bill.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-muted-foreground">{bill.bill_number}</span>
                  {isOverdue && <span className="flex items-center gap-0.5 text-xs text-red-600"><AlertCircle className="w-3 h-3" />Overdue</span>}
                </div>
                <p className="text-sm font-semibold text-foreground">{bill.vendor_name}</p>
                {bill.job_address && <p className="text-xs text-muted-foreground truncate">{bill.job_address}</p>}
                <p className="text-xs text-muted-foreground capitalize">{bill.category}</p>
                {bill.due_date && <p className="text-xs text-muted-foreground">Due {format(parseISO(bill.due_date), 'MMM d, yyyy')}</p>}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <p className="text-base font-bold text-foreground">${fmt(bill.amount)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-2 pt-2 border-t border-border/60">
              <Select value={bill.status} onValueChange={v => onStatusChange(bill.id, v)}>
                <SelectTrigger className="h-7 text-xs rounded-lg flex-1 max-w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(BILL_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PaymentList({ payments }) {
  const METHODS = { check: 'Check', ach: 'ACH', card: 'Card', cash: 'Cash', zelle: 'Zelle', venmo: 'Venmo', other: 'Other' };
  if (!payments.length) return <p className="text-sm text-muted-foreground text-center py-8">No payments recorded.</p>;
  return (
    <div className="space-y-2">
      {payments.map(p => (
        <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{p.customer_name || p.job_address}</p>
            {p.job_address && p.customer_name && <p className="text-xs text-muted-foreground truncate">{p.job_address}</p>}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-md">{METHODS[p.payment_method] || p.payment_method}</span>
              {p.reference_number && <span className="text-xs text-muted-foreground">Ref: {p.reference_number}</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{p.payment_date ? format(parseISO(p.payment_date), 'MMM d, yyyy') : ''}</p>
          </div>
          <p className="text-base font-bold text-green-600 shrink-0">+${fmt(p.amount)}</p>
        </div>
      ))}
    </div>
  );
}