import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight } from 'lucide-react';
import JobLifecycleBadge from '../jobs/JobLifecycleBadge';
import JobGroupBadge from '../jobs/JobGroupBadge';
import { format } from 'date-fns';

// Generic drill-down list shown beneath the stat cards when a section is active
export default function DrillDownList({ section, data, label, onClear }) {
  const navigate = useNavigate();

  const handleItemClick = (item) => {
    if (section === 'pending') navigate(`/approve?jobId=${item.id}`);
    else if (section === 'leads') navigate(`/sales/${item.id}`);
    else if (section === 'todos') navigate(`/tasks/${item.id}`);
    else if (section === 'change_orders') navigate(`/change-orders/${item.id}`);
    else if (section === 'warranty') navigate(`/warranty/${item.id}`);
    else if (section === 'invoices') navigate(`/invoices`);
    else if (section === 'time_today') navigate(`/time-entries`);
    else if (section === 'daily_logs') navigate(`/daily-logs/${item.id}`);
    else if (section === 'notes') navigate(`/notes`);
    else navigate(`/approve?jobId=${item.id}`);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <button onClick={onClear} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3 h-3" /> Clear
        </button>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nothing here — all clear.</p>
      ) : (
        <div className="space-y-2">
          {data.map(item => (
            <DrillItem key={item.id} item={item} section={section} onClick={() => handleItemClick(item)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DrillItem({ item, section, onClick }) {
  const isClickable = !['time_today', 'invoices', 'notes'].includes(section);

  const content = (() => {
    // Jobs (pending, approved, active, waiting, in_progress, warranty)
    if (['pending','approved','active','in_progress','waiting','warranty_jobs'].includes(section)) {
      return (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground truncate">{item.address}</p>
            <p className="text-xs font-semibold text-primary shrink-0">${Number(item.price||0).toLocaleString()}</p>
          </div>
          <p className="text-xs text-muted-foreground">{item.customer_name}</p>
          <div className="flex gap-1.5 mt-1 flex-wrap">
            {item.lifecycle_status && <JobLifecycleBadge status={item.lifecycle_status} />}
            {item.job_group && <JobGroupBadge group={item.job_group} />}
          </div>
          {item.approval_timestamp && <p className="text-xs text-muted-foreground/60 mt-0.5">Signed {format(new Date(item.approval_timestamp), 'MMM d, yyyy')}</p>}
        </>
      );
    }
    // Leads
    if (section === 'leads') {
      return (
        <>
          <p className="text-sm font-medium text-foreground">{item.contact_name}</p>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-xs text-muted-foreground">{item.property_address || item.company_name || '—'}</p>
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{item.status?.replace(/_/g,' ')}</span>
          </div>
          {item.follow_up_date && <p className="text-xs text-amber-600 mt-0.5">Follow-up: {item.follow_up_date}</p>}
        </>
      );
    }
    // Tasks/todos
    if (section === 'todos') {
      return (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${item.priority === 'urgent' ? 'bg-red-100 text-red-700' : item.priority === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}>{item.priority}</span>
          </div>
          {item.job_address && <p className="text-xs text-muted-foreground">{item.job_address}</p>}
          {item.due_date && <p className={`text-xs mt-0.5 ${new Date(item.due_date) < new Date() ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>Due: {item.due_date}</p>}
        </>
      );
    }
    // Change orders
    if (section === 'change_orders') {
      return (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
            <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{item.status}</span>
          </div>
          <p className="text-xs text-muted-foreground">{item.job_address}</p>
          {item.total_financial_impact !== 0 && (
            <p className={`text-xs font-semibold mt-0.5 ${item.total_financial_impact > 0 ? 'text-primary' : 'text-red-600'}`}>
              {item.total_financial_impact > 0 ? '+' : ''}${Number(item.total_financial_impact||0).toLocaleString()}
            </p>
          )}
        </>
      );
    }
    // Warranty
    if (section === 'warranty') {
      return (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
            <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">{item.status}</span>
          </div>
          <p className="text-xs text-muted-foreground">{item.job_address}</p>
          {item.customer_name && <p className="text-xs text-muted-foreground">{item.customer_name}</p>}
        </>
      );
    }
    // Invoices
    if (section === 'invoices') {
      return (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground truncate">{item.customer_name}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${item.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}>{item.status}</span>
          </div>
          <p className="text-xs text-muted-foreground">{item.job_address}</p>
          <p className="text-xs font-semibold text-foreground mt-0.5">${Number(item.balance_due||item.amount||0).toLocaleString()} due</p>
        </>
      );
    }
    // Time today
    if (section === 'time_today') {
      return (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{item.employee_name}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.status === 'clocked_in' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {item.status === 'clocked_in' ? 'Active' : item.duration_minutes ? `${Math.floor(item.duration_minutes/60)}h ${item.duration_minutes%60}m` : '—'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{item.job_address} · {item.cost_code}</p>
        </>
      );
    }
    // Daily logs
    if (section === 'daily_logs') {
      return (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{item.log_date}</p>
            {item.follow_up_needed && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Follow-up</span>}
          </div>
          <p className="text-xs text-muted-foreground">{item.job_address}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.work_completed}</p>
        </>
      );
    }
    // Notes
    if (section === 'notes') {
      return (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{item.job_address || 'General Note'}</p>
            {!item.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{item.content}</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">{item.author_role} · {item.created_date ? format(new Date(item.created_date), 'MMM d, h:mm a') : ''}</p>
        </>
      );
    }
    return <p className="text-sm text-foreground">{item.title || item.id}</p>;
  })();

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`bg-card border border-border rounded-xl p-4 transition-colors ${isClickable ? 'cursor-pointer hover:border-primary/30' : ''}`}
    >
      {content}
      {isClickable && (
        <div className="flex justify-end mt-2">
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}