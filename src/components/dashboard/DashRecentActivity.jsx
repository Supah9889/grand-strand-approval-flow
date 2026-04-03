import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, FileText, StickyNote, BookOpen, FileDiff, ShieldCheck, ArrowRight } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

function safeRelative(ts) {
  if (!ts) return '';
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return '';
  }
}

function ActivityRow({ icon: Icon, iconBg, label, address, actor, timestamp, detail, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 py-2.5 border-b border-border last:border-0 hover:bg-muted/40 transition-colors px-1 rounded"
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${iconBg}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground truncate">{address || label}</p>
          <p className="text-[10px] text-muted-foreground/60 shrink-0">{safeRelative(timestamp)}</p>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
        {detail && <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-1">{detail}</p>}
        {actor && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{actor}</p>}
      </div>
    </button>
  );
}

export default function DashRecentActivity({ auditLogs = [], notes = [], dailyLogs = [], changeOrders = [] }) {
  const navigate = useNavigate();

  // Build a unified feed sorted by timestamp
  const feed = [];

  auditLogs.slice(0, 8).forEach(log => feed.push({
    id: `audit-${log.id}`,
    ts: log.timestamp,
    icon: Clock,
    iconBg: 'bg-muted text-muted-foreground',
    label: log.action?.replace(/_/g, ' '),
    address: log.job_address,
    actor: log.actor,
    detail: log.detail,
    onClick: () => log.job_id ? navigate(`/job-hub?jobId=${log.job_id}`) : navigate('/audit-log'),
  }));

  notes.slice(0, 5).forEach(n => feed.push({
    id: `note-${n.id}`,
    ts: n.created_date,
    icon: StickyNote,
    iconBg: 'bg-amber-50 text-amber-600',
    label: 'Note added',
    address: n.job_address || 'Note',
    actor: n.author_role,
    detail: n.content,
    onClick: () => navigate('/notes'),
  }));

  dailyLogs.slice(0, 5).forEach(l => feed.push({
    id: `log-${l.id}`,
    ts: l.created_date,
    icon: BookOpen,
    iconBg: 'bg-orange-50 text-orange-600',
    label: `Daily log · ${l.log_date}`,
    address: l.job_address,
    actor: l.created_by_name,
    detail: l.work_completed,
    onClick: () => navigate(`/daily-logs/${l.id}`),
  }));

  changeOrders.slice(0, 4).forEach(co => feed.push({
    id: `co-${co.id}`,
    ts: co.created_date,
    icon: FileDiff,
    iconBg: 'bg-indigo-50 text-indigo-600',
    label: `Change order · ${co.status}`,
    address: co.job_address,
    actor: co.created_by_name,
    detail: co.title,
    onClick: () => navigate(`/change-orders/${co.id}`),
  }));

  // Sort newest first
  feed.sort((a, b) => {
    const at = a.ts ? new Date(a.ts).getTime() : 0;
    const bt = b.ts ? new Date(b.ts).getTime() : 0;
    return bt - at;
  });

  const top = feed.slice(0, 10);

  if (top.length === 0) {
    return (
      <div className="py-5 text-center">
        <p className="text-xs text-muted-foreground">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl px-3 py-1">
      {top.map(item => (
        <ActivityRow
          key={item.id}
          icon={item.icon}
          iconBg={item.iconBg}
          label={item.label}
          address={item.address}
          actor={item.actor}
          timestamp={item.ts}
          detail={item.detail}
          onClick={item.onClick}
        />
      ))}
    </div>
  );
}