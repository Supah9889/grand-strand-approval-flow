import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { FileText, DollarSign, Receipt, CreditCard, ArrowRight, Loader2, TrendingUp } from 'lucide-react';
import { fmt } from '@/lib/financialHelpers';
import { calcJobFinancials } from '@/lib/financialHelpers';

const STATUS_COLORS = {
  draft:    'bg-muted text-muted-foreground',
  sent:     'bg-blue-50 text-blue-700',
  viewed:   'bg-cyan-50 text-cyan-700',
  paid:     'bg-green-100 text-green-700',
  partial:  'bg-amber-50 text-amber-700',
  overdue:  'bg-red-100 text-red-700',
  closed:   'bg-muted text-muted-foreground',
  open:     'bg-amber-50 text-amber-700',
  new:      'bg-blue-50 text-blue-700',
  confirmed:'bg-primary/10 text-primary',
  filed:    'bg-muted text-muted-foreground',
};

function FinRow({ icon: Icon, iconBg, label, amount, status, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors text-left"
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{label}</p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {amount != null && <span className="text-sm font-semibold">${fmt(amount)}</span>}
        {status && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[status] || 'bg-muted text-muted-foreground'}`}>
            {status}
          </span>
        )}
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30" />
      </div>
    </button>
  );
}

export default function JobFinancialsTab({ job, isAdmin }) {
  const navigate = useNavigate();

  const { data: invoices = [], isLoading: li } = useQuery({
    queryKey: ['hub-fin-invoices', job.id],
    queryFn: () => base44.entities.Invoice.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id,
  });
  const { data: bills = [], isLoading: lb } = useQuery({
    queryKey: ['hub-fin-bills', job.id],
    queryFn: () => base44.entities.Bill.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id,
  });
  const { data: expenses = [], isLoading: le } = useQuery({
    queryKey: ['hub-fin-expenses', job.id],
    queryFn: () => base44.entities.Expense.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id,
  });
  const { data: payments = [] } = useQuery({
    queryKey: ['hub-fin-payments', job.id],
    queryFn: () => base44.entities.Payment.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id,
  });
  const { data: timeEntries = [] } = useQuery({
    queryKey: ['hub-fin-time', job.id],
    queryFn: () => base44.entities.TimeEntry.filter({ job_id: job.id }, '-clock_in'),
    enabled: !!job.id,
  });
  const { data: changeOrders = [] } = useQuery({
    queryKey: ['hub-fin-cos', job.id],
    queryFn: () => base44.entities.ChangeOrder.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id,
  });

  const loading = li || lb || le;

  const fin = !loading ? calcJobFinancials({ job, expenses, bills, timeEntries, changeOrders, invoices, payments }) : null;

  if (loading) return (
    <div className="flex justify-center py-10"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
  );

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      {fin && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financial Summary</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5">
              <p className="text-base font-bold text-blue-700">${fmt(fin.invoicesSent)}</p>
              <p className="text-muted-foreground mt-0.5">Invoiced</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-2.5">
              <p className="text-base font-bold text-green-700">${fmt(fin.paymentsReceived)}</p>
              <p className="text-muted-foreground mt-0.5">Received</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5">
              <p className="text-base font-bold text-amber-700">${fmt(fin.totalJobCost)}</p>
              <p className="text-muted-foreground mt-0.5">Total Cost</p>
            </div>
            <div className={`rounded-xl p-2.5 border ${fin.grossProfit >= 0 ? 'bg-primary/5 border-primary/20' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-base font-bold ${fin.grossProfit >= 0 ? 'text-primary' : 'text-red-600'}`}>
                {fin.grossProfit >= 0 ? '+' : ''}${fmt(fin.grossProfit)}
              </p>
              <p className="text-muted-foreground mt-0.5">Gross Profit ({fin.grossMarginPct.toFixed(0)}%)</p>
            </div>
          </div>
          {fin.laborHours > 0 && (
            <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border">
              Labor: {fin.laborHours.toFixed(1)} hrs {fin.laborCost > 0 ? `· $${fmt(fin.laborCost)}` : ''}
            </p>
          )}
        </div>
      )}

      {/* Invoices */}
      {invoices.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Invoices ({invoices.length})
          </p>
          {invoices.map(i => (
            <FinRow key={i.id}
              icon={FileText} iconBg="bg-green-50 text-green-600"
              label={`Invoice #${i.invoice_number || 'draft'}`}
              amount={i.amount} status={i.status}
              sub={i.balance_due > 0 ? `$${fmt(i.balance_due)} due · ${i.customer_name}` : i.customer_name}
              onClick={() => navigate('/invoices')}
            />
          ))}
        </div>
      )}

      {/* Bills */}
      {bills.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Bills ({bills.length})
          </p>
          {bills.map(b => (
            <FinRow key={b.id}
              icon={DollarSign} iconBg="bg-amber-50 text-amber-600"
              label={b.vendor_name || 'Bill'}
              amount={b.amount} status={b.status}
              sub={b.bill_date || ''}
              onClick={() => navigate('/bills')}
            />
          ))}
        </div>
      )}

      {/* Expenses / Cost Inbox */}
      {expenses.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" /> Cost Inbox ({expenses.length})
          </p>
          {expenses.map(e => (
            <FinRow key={e.id}
              icon={Receipt} iconBg="bg-orange-50 text-orange-600"
              label={e.vendor_name || 'Expense'}
              amount={e.total_amount} status={e.inbox_status}
              sub={`${e.category || ''} · ${e.expense_date || ''}`}
              onClick={() => navigate('/expenses')}
            />
          ))}
        </div>
      )}

      {/* Payments */}
      {payments.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" /> Payments ({payments.length})
          </p>
          {payments.map(p => (
            <FinRow key={p.id}
              icon={CreditCard} iconBg="bg-primary/10 text-primary"
              label={`Payment · ${p.payment_method || 'manual'}`}
              amount={p.amount} status={null}
              sub={p.payment_date || ''}
              onClick={() => navigate('/payments')}
            />
          ))}
        </div>
      )}

      {invoices.length === 0 && bills.length === 0 && expenses.length === 0 && payments.length === 0 && (
        <div className="text-center py-10">
          <DollarSign className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No financial records yet</p>
        </div>
      )}
    </div>
  );
}