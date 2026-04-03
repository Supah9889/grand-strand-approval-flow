import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { getOpStatusConfig } from '@/lib/jobHelpers';

const PRIORITY_COLORS = {
  high:   'border-l-red-400 bg-red-50/50',
  medium: 'border-l-amber-400 bg-amber-50/50',
  low:    'border-l-slate-300 bg-card',
};

function AttentionItem({ label, address, sub, priority = 'medium', onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left border border-border border-l-4 rounded-xl px-3 py-2.5 transition-colors hover:border-primary/30 ${PRIORITY_COLORS[priority]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{address}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{sub}</p>}
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
      </div>
    </button>
  );
}

export default function DashNeedsAttention({ jobs = [], invoices = [], tasks = [], leads = [], bills = [] }) {
  const navigate = useNavigate();
  const items = [];

  // Pending signatures — high priority
  jobs.filter(j => j.status === 'pending').slice(0, 5).forEach(j => items.push({
    id: `sig-${j.id}`,
    label: 'Needs signature',
    address: j.address,
    sub: j.customer_name,
    priority: 'high',
    onClick: () => navigate(`/approve?jobId=${j.id}`),
  }));

  // Overdue invoices — high
  invoices.filter(i => i.status === 'overdue').slice(0, 5).forEach(i => items.push({
    id: `inv-${i.id}`,
    label: `Overdue invoice · $${Number(i.balance_due || i.amount || 0).toLocaleString()} due`,
    address: i.job_address || i.customer_name,
    sub: i.customer_name,
    priority: 'high',
    onClick: () => navigate('/invoices'),
  }));

  // Waiting jobs — driven by op_status
  const WAITING_STATUSES = ['waiting_homeowner','waiting_builder','waiting_vendor','waiting_materials','on_hold','needs_scheduling','needs_review'];
  jobs.filter(j => WAITING_STATUSES.includes(j.op_status || '')).slice(0, 6).forEach(j => {
    const cfg = getOpStatusConfig(j.op_status);
    items.push({
      id: `wait-${j.id}`,
      label: cfg.label,
      address: j.address,
      sub: j.customer_name,
      priority: j.op_status === 'on_hold' ? 'medium' : 'medium',
      onClick: () => navigate(`/job-hub?jobId=${j.id}`),
    });
  });

  // Unpaid sent invoices — medium
  invoices.filter(i => i.status === 'sent').slice(0, 4).forEach(i => items.push({
    id: `sinv-${i.id}`,
    label: `Invoice sent · awaiting payment · $${Number(i.balance_due || i.amount || 0).toLocaleString()}`,
    address: i.job_address || i.customer_name,
    sub: i.customer_name,
    priority: 'medium',
    onClick: () => navigate('/invoices'),
  }));

  // Unpaid bills — medium
  bills.filter(b => ['open', 'draft'].includes(b.status)).slice(0, 3).forEach(b => items.push({
    id: `bill-${b.id}`,
    label: `Unpaid bill · $${Number(b.amount || 0).toLocaleString()}`,
    address: b.vendor_name || b.job_address,
    sub: b.job_address,
    priority: 'medium',
    onClick: () => navigate('/bills'),
  }));

  // Presale leads needing follow-up
  leads.filter(l => l.status === 'follow_up_needed' || (l.follow_up_date && l.follow_up_date <= new Date().toISOString().split('T')[0])).slice(0, 4).forEach(l => items.push({
    id: `lead-${l.id}`,
    label: 'Lead needs follow-up',
    address: l.contact_name,
    sub: l.property_address || l.company_name,
    priority: 'medium',
    onClick: () => navigate(`/sales/${l.id}`),
  }));

  // Overdue tasks
  tasks.filter(t => t.due_date && t.due_date < new Date().toISOString().split('T')[0] && ['open','in_progress'].includes(t.status)).slice(0, 4).forEach(t => items.push({
    id: `task-${t.id}`,
    label: `Task overdue · ${t.due_date}`,
    address: t.title,
    sub: t.job_address,
    priority: 'medium',
    onClick: () => navigate(`/tasks/${t.id}`),
  }));

  // Jobs explicitly needing scheduling per op_status (avoid duplicates from waiting section)
  jobs.filter(j => j.op_status === 'needs_scheduling' && !WAITING_STATUSES.includes(j.op_status)).slice(0, 3).forEach(j => items.push({
    id: `sched-${j.id}`,
    label: 'Needs Scheduling',
    address: j.address,
    sub: j.customer_name,
    priority: 'low',
    onClick: () => navigate(`/job-hub?jobId=${j.id}`),
  }));

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-5">
        <AlertCircle className="w-4 h-4 text-green-500" />
        <p className="text-xs text-muted-foreground">Nothing needs attention right now</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {items.slice(0, 10).map(item => (
        <AttentionItem key={item.id} {...item} />
      ))}
      {items.length > 10 && (
        <p className="text-[10px] text-muted-foreground text-center pt-1">+{items.length - 10} more items</p>
      )}
    </div>
  );
}