import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  StickyNote, BookOpen, FileDiff, FileText, DollarSign, Clock,
  ShieldCheck, CheckSquare, Upload, Activity, ChevronRight, Loader2
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const TYPE_CONFIG = {
  note:         { icon: StickyNote,  bg: 'bg-amber-50',   text: 'text-amber-600',  border: 'border-amber-200',  label: 'Note' },
  daily_log:    { icon: BookOpen,    bg: 'bg-orange-50',  text: 'text-orange-600', border: 'border-orange-200', label: 'Daily Log' },
  change_order: { icon: FileDiff,    bg: 'bg-indigo-50',  text: 'text-indigo-600', border: 'border-indigo-200', label: 'Change Order' },
  invoice:      { icon: FileText,    bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200',  label: 'Invoice' },
  expense:      { icon: DollarSign,  bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200', label: 'Expense' },
  time_entry:   { icon: Clock,       bg: 'bg-blue-50',    text: 'text-blue-600',   border: 'border-blue-200',   label: 'Time Entry' },
  warranty:     { icon: ShieldCheck, bg: 'bg-violet-50',  text: 'text-violet-600', border: 'border-violet-200', label: 'Warranty' },
  task:         { icon: CheckSquare, bg: 'bg-teal-50',    text: 'text-teal-600',   border: 'border-teal-200',   label: 'Task' },
  file:         { icon: Upload,      bg: 'bg-slate-50',   text: 'text-slate-600',  border: 'border-slate-200',  label: 'File' },
  audit:        { icon: Activity,    bg: 'bg-muted',      text: 'text-muted-foreground', border: 'border-border', label: 'Update' },
};

function safeRelative(ts) {
  if (!ts) return '';
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); }
  catch { return ''; }
}

function TimelineItem({ item, onClick }) {
  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.audit;
  const Icon = cfg.icon;
  return (
    <div
      onClick={onClick}
      className={`flex gap-3 cursor-pointer group transition-colors rounded-xl px-3 py-2.5 hover:bg-muted/50`}
    >
      {/* Icon + vertical line */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-7 h-7 rounded-full border flex items-center justify-center ${cfg.bg} ${cfg.border}`}>
          <Icon className={`w-3.5 h-3.5 ${cfg.text}`} />
        </div>
        <div className="w-px flex-1 bg-border/50 mt-1 min-h-3" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
              {cfg.label}
            </span>
            {item.actor && <span className="text-[10px] text-muted-foreground">{item.actor}</span>}
          </div>
          <span className="text-[10px] text-muted-foreground/60 shrink-0">{safeRelative(item.ts)}</span>
        </div>
        <p className="text-sm text-foreground mt-0.5 line-clamp-2 leading-snug">{item.title}</p>
        {item.sub && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.sub}</p>}
        {item.detail && <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1 italic">{item.detail}</p>}
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 mt-2 group-hover:text-muted-foreground transition-colors" />
    </div>
  );
}

export default function JobTimelineTab({ job, isAdmin }) {
  const navigate = useNavigate();
  const [limit, setLimit] = useState(20);

  const { data: notes = [], isLoading: ln } = useQuery({
    queryKey: ['hub-tl-notes', job.id],
    queryFn: () => base44.entities.JobNote.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id,
  });
  const { data: logs = [], isLoading: ll } = useQuery({
    queryKey: ['hub-tl-logs', job.id],
    queryFn: () => base44.entities.DailyLog.filter({ job_id: job.id }, '-log_date'),
    enabled: !!job.id && isAdmin,
  });
  const { data: cos = [], isLoading: lc } = useQuery({
    queryKey: ['hub-tl-cos', job.id],
    queryFn: () => base44.entities.ChangeOrder.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id && isAdmin,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['hub-tl-invoices', job.id],
    queryFn: () => base44.entities.Invoice.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id && isAdmin,
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ['hub-tl-expenses', job.id],
    queryFn: () => base44.entities.Expense.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id && isAdmin,
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['hub-tl-tasks', job.id],
    queryFn: () => base44.entities.Task.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id,
  });
  const { data: warrantyItems = [] } = useQuery({
    queryKey: ['hub-tl-warranty', job.id],
    queryFn: () => base44.entities.WarrantyItem.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id,
  });
  const { data: files = [] } = useQuery({
    queryKey: ['hub-tl-files', job.id],
    queryFn: () => base44.entities.JobFile.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id,
  });
  const { data: timeEntries = [] } = useQuery({
    queryKey: ['hub-tl-time', job.id],
    queryFn: () => base44.entities.TimeEntry.filter({ job_id: job.id }, '-clock_in'),
    enabled: !!job.id && isAdmin,
  });

  const loading = ln || ll || lc;

  const feed = useMemo(() => {
    const items = [];

    notes.forEach(n => items.push({
      id: `note-${n.id}`, type: 'note', ts: n.created_date,
      title: n.content, actor: n.author_role, sub: null,
      onClick: () => {},
    }));

    logs.forEach(l => items.push({
      id: `log-${l.id}`, type: 'daily_log', ts: l.created_date,
      title: l.work_completed || 'Daily log', actor: l.created_by_name,
      sub: `Log date: ${l.log_date}`, detail: l.delays_issues,
      onClick: () => navigate(`/daily-logs/${l.id}`),
    }));

    cos.forEach(co => items.push({
      id: `co-${co.id}`, type: 'change_order', ts: co.created_date,
      title: co.title, actor: co.created_by_name,
      sub: `${co.status}${co.total_financial_impact ? ` · $${Number(co.total_financial_impact).toLocaleString()}` : ''}`,
      onClick: () => navigate(`/change-orders/${co.id}`),
    }));

    invoices.forEach(i => items.push({
      id: `inv-${i.id}`, type: 'invoice', ts: i.created_date,
      title: `Invoice #${i.invoice_number || 'draft'} · $${Number(i.amount || 0).toLocaleString()}`,
      actor: i.created_by_name,
      sub: `${i.status}${i.balance_due > 0 ? ` · $${Number(i.balance_due).toLocaleString()} due` : ''}`,
      onClick: () => navigate('/invoices'),
    }));

    expenses.forEach(e => items.push({
      id: `exp-${e.id}`, type: 'expense', ts: e.created_date,
      title: `${e.vendor_name || 'Expense'} · $${Number(e.total_amount || 0).toFixed(2)}`,
      actor: e.submitted_by,
      sub: `${e.category || ''} · ${e.inbox_status || ''}`,
      onClick: () => navigate('/expenses'),
    }));

    tasks.forEach(t => items.push({
      id: `task-${t.id}`, type: 'task', ts: t.created_date,
      title: t.title, actor: t.created_by_name,
      sub: `${t.status}${t.due_date ? ` · Due ${t.due_date}` : ''}`,
      onClick: () => navigate(`/tasks/${t.id}`),
    }));

    warrantyItems.forEach(w => items.push({
      id: `wt-${w.id}`, type: 'warranty', ts: w.created_date,
      title: w.title || 'Warranty item', actor: null,
      sub: w.status,
      onClick: () => navigate(`/warranty/${w.id}`),
    }));

    files.forEach(f => items.push({
      id: `file-${f.id}`, type: 'file', ts: f.created_date,
      title: f.file_name, actor: f.uploaded_by_name,
      sub: f.category,
      onClick: () => window.open(f.file_url, '_blank'),
    }));

    timeEntries.forEach(e => items.push({
      id: `te-${e.id}`, type: 'time_entry', ts: e.clock_in,
      title: `${e.employee_name} · ${e.duration_minutes ? Math.round(e.duration_minutes / 60 * 10) / 10 + 'h' : 'Active'}`,
      actor: null,
      sub: `${e.cost_code || ''} · ${e.entry_date || ''}`,
      onClick: () => navigate(`/time-entries/${e.id}`),
    }));

    items.sort((a, b) => {
      const at = a.ts ? new Date(a.ts).getTime() : 0;
      const bt = b.ts ? new Date(b.ts).getTime() : 0;
      return bt - at;
    });

    return items;
  }, [notes, logs, cos, invoices, expenses, tasks, warrantyItems, files, timeEntries]);

  if (loading) return (
    <div className="flex justify-center py-10"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
  );

  if (feed.length === 0) return (
    <div className="text-center py-12">
      <Activity className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">No timeline activity yet</p>
      <p className="text-xs text-muted-foreground mt-1">Notes, logs, invoices and other events will appear here</p>
    </div>
  );

  const visible = feed.slice(0, limit);

  return (
    <div>
      <div className="-mx-1">
        {visible.map(item => (
          <TimelineItem key={item.id} item={item} onClick={item.onClick} />
        ))}
      </div>
      {feed.length > limit && (
        <button
          onClick={() => setLimit(l => l + 20)}
          className="w-full text-xs text-primary py-3 hover:underline"
        >
          Load {Math.min(20, feed.length - limit)} more ({feed.length - limit} remaining)
        </button>
      )}
    </div>
  );
}