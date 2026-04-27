/**
 * JobLinkedRecords — reusable panel showing all records linked to a job.
 * Drop it into any page that has a job_id.
 * Props: jobId, job (optional pre-loaded job object), showTypes (array of keys to show, default all)
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FileText, Clock, Receipt, FileDiff, ShieldCheck,
  CheckSquare, BookOpen, FolderOpen, ChevronRight, Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

const ALL_TYPES = ['estimates', 'invoices', 'expenses', 'change_orders', 'time', 'tasks', 'warranty', 'logs', 'files'];

const TYPE_META = {
  estimates:     { label: 'Estimates',      icon: FileText,    route: (r) => `/estimates/${r.id}`,         adminOnly: true  },
  invoices:      { label: 'Invoices',       icon: FileText,    route: () => `/invoices`,                   adminOnly: true  },
  expenses:      { label: 'Expenses',       icon: Receipt,     route: () => `/expenses`,                   adminOnly: true  },
  change_orders: { label: 'Change Orders',  icon: FileDiff,    route: (r) => `/change-orders/${r.id}`,     adminOnly: true  },
  time:          { label: 'Time Entries',   icon: Clock,       route: (r) => `/time-entries/${r.id}`,      adminOnly: true  },
  tasks:         { label: 'Tasks',          icon: CheckSquare, route: (r) => `/tasks/${r.id}`,             adminOnly: false },
  warranty:      { label: 'Warranty',       icon: ShieldCheck, route: (r) => `/warranty/${r.id}`,         adminOnly: false },
  logs:          { label: 'Daily Logs',     icon: BookOpen,    route: (r) => `/daily-logs/${r.id}`,        adminOnly: false },
  files:         { label: 'Files',          icon: FolderOpen,  route: (r) => r.file_url,                  adminOnly: false },
};

function fmt$(n) { return `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`; }
function fmtDate(d) { if (!d) return ''; try { return format(parseISO(d), 'MMM d, yy'); } catch { return d; } }

function RecordRow({ item, type, onClick }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;

  const label = (() => {
    if (type === 'estimates') return item.estimate_number ? `EST-${item.estimate_number}` : 'Estimate';
    if (type === 'invoices') return item.invoice_number ? `#${item.invoice_number}` : 'Invoice';
    if (type === 'expenses') return item.vendor_name || 'Expense';
    if (type === 'change_orders') return item.title || item.co_number || 'CO';
    if (type === 'time') return item.employee_name || 'Time Entry';
    if (type === 'tasks') return item.title || 'Task';
    if (type === 'warranty') return item.title || 'Warranty Item';
    if (type === 'logs') return item.log_date ? fmtDate(item.log_date) : 'Daily Log';
    if (type === 'files') return item.file_name || 'File';
    return item.title || item.id;
  })();

  const sub = (() => {
    if (type === 'estimates') return `${item.status || ''} · ${fmt$(item.total_amount || item.amount)}`;
    if (type === 'invoices') return `${item.status || ''} · ${fmt$(item.balance_due || item.amount)} due`;
    if (type === 'expenses') return `${fmtDate(item.expense_date || item.receipt_date)} · ${fmt$(item.total_amount)}`;
    if (type === 'change_orders') return `${item.status || ''} · ${item.total_financial_impact ? (item.total_financial_impact > 0 ? '+' : '') + fmt$(item.total_financial_impact) : ''}`;
    if (type === 'time') return `${item.cost_code || ''} · ${item.duration_minutes ? `${Math.floor(item.duration_minutes / 60)}h ${item.duration_minutes % 60}m` : 'Active'}`;
    if (type === 'tasks') return item.status || '';
    if (type === 'warranty') return item.status || '';
    if (type === 'logs') return item.work_completed ? item.work_completed.slice(0, 60) : '';
    if (type === 'files') return item.category || '';
    return '';
  })();

  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left group">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}

function TypeSection({ type, jobId, isAdmin, navigate }) {
  const [open, setOpen] = useState(false);
  const meta = TYPE_META[type];

  const shouldShow = !(meta.adminOnly && !isAdmin);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['linked', type, jobId],
    queryFn: () => {
      if (type === 'estimates')     return base44.entities.Estimate.filter({ job_id: jobId }, '-created_date', 20);
      if (type === 'invoices')      return base44.entities.Invoice.filter({ job_id: jobId }, '-created_date', 20);
      if (type === 'expenses')      return base44.entities.Expense.filter({ job_id: jobId }, '-created_date', 30);
      if (type === 'change_orders') return base44.entities.ChangeOrder.filter({ job_id: jobId }, '-created_date', 20);
      if (type === 'time')          return base44.entities.TimeEntry.filter({ job_id: jobId }, '-clock_in', 30);
      if (type === 'tasks')         return base44.entities.Task.filter({ job_id: jobId }, '-created_date', 20);
      if (type === 'warranty')      return base44.entities.WarrantyItem.filter({ job_id: jobId }, '-created_date', 20);
      if (type === 'logs')          return base44.entities.DailyLog.filter({ job_id: jobId }, '-log_date', 20);
      if (type === 'files')         return base44.entities.JobFile.filter({ job_id: jobId }, '-created_date', 30);
    },
    enabled: open && shouldShow,
  });

  if (!shouldShow) return null;

  const Icon = meta.icon;

  return (
    <div className="border-b border-border last:border-0">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
        <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold text-foreground flex-1">{meta.label}</span>
        {open && isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        {!isLoading && open && records.length > 0 && (
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">{records.length}</span>
        )}
        <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && !isLoading && (
        records.length === 0
          ? <p className="text-[11px] text-muted-foreground px-4 pb-3">No {meta.label.toLowerCase()} linked.</p>
          : <div className="pb-1">
              {records.map(r => (
                <RecordRow key={r.id} item={r} type={type} onClick={() => {
                  const route = meta.route(r);
                  if (route.startsWith('http') || route.startsWith('blob') || route.includes('://')) {
                    window.open(route, '_blank');
                  } else {
                    navigate(route);
                  }
                }} />
              ))}
            </div>
      )}
    </div>
  );
}

export default function JobLinkedRecords({ jobId, isAdmin = false, showTypes = ALL_TYPES }) {
  const navigate = useNavigate();
  const types = showTypes.filter(t => ALL_TYPES.includes(t));

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/20">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Linked Records</p>
      </div>
      {types.map(type => (
        <TypeSection key={type} type={type} jobId={jobId} isAdmin={isAdmin} navigate={navigate} />
      ))}
    </div>
  );
}