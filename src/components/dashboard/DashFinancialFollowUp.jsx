import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, DollarSign, ArrowRight, Receipt, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';

function FinRow({ icon: Icon, iconBg, label, meta, sub, urgent, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors hover:border-primary/30
        ${urgent ? 'border-red-200 bg-red-50/60' : 'border-border bg-card'}`}
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {meta && <span className={`text-xs font-semibold ${urgent ? 'text-red-600' : 'text-foreground'}`}>{meta}</span>}
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />
      </div>
    </button>
  );
}

export default function DashFinancialFollowUp({ invoices = [], bills = [], expenses = [] }) {
  const navigate = useNavigate();

  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const unpaidBills = bills.filter(b => ['open','draft'].includes(b.status));
  const newExpenses = expenses.filter(e => e.inbox_status === 'new').slice(0, 3);
  const partialInvoices = invoices.filter(i => i.status === 'partial').slice(0, 3);

  const hasAnything = overdueInvoices.length || unpaidBills.length || newExpenses.length || partialInvoices.length;

  if (!hasAnything) {
    return (
      <div className="flex items-center justify-center gap-2 py-5">
        <DollarSign className="w-4 h-4 text-green-500" />
        <p className="text-xs text-muted-foreground">No financial items need attention</p>
      </div>
    );
  }

  const totalOverdue = overdueInvoices.reduce((s, i) => s + Number(i.balance_due || i.amount || 0), 0);
  const totalUnpaidBills = unpaidBills.reduce((s, b) => s + Number(b.amount || 0), 0);

  return (
    <div className="space-y-1.5">
      {overdueInvoices.length > 0 && (
        <FinRow
          icon={AlertCircle}
          iconBg="bg-red-100 text-red-600"
          label={`${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? 's' : ''}`}
          sub={overdueInvoices[0]?.customer_name}
          meta={`$${totalOverdue.toLocaleString()}`}
          urgent
          onClick={() => navigate('/invoices')}
        />
      )}

      {unpaidBills.length > 0 && (
        <FinRow
          icon={FileText}
          iconBg="bg-amber-100 text-amber-600"
          label={`${unpaidBills.length} unpaid bill${unpaidBills.length > 1 ? 's' : ''}`}
          sub={unpaidBills[0]?.vendor_name}
          meta={`$${totalUnpaidBills.toLocaleString()}`}
          onClick={() => navigate('/bills')}
        />
      )}

      {partialInvoices.map(i => (
        <FinRow
          key={i.id}
          icon={DollarSign}
          iconBg="bg-blue-100 text-blue-600"
          label={`Partial payment · ${i.customer_name}`}
          sub={i.job_address}
          meta={`$${Number(i.balance_due || 0).toLocaleString()} remaining`}
          onClick={() => navigate('/invoices')}
        />
      ))}

      {newExpenses.map(e => (
        <FinRow
          key={e.id}
          icon={Receipt}
          iconBg="bg-orange-100 text-orange-600"
          label={`New cost inbox · ${e.vendor_name || 'Expense'}`}
          sub={e.job_address}
          meta={`$${Number(e.total_amount || 0).toFixed(2)}`}
          onClick={() => navigate('/expenses')}
        />
      ))}
    </div>
  );
}