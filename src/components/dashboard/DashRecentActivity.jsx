import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { getNoteTypeConfig, getEventTypeConfig } from '@/lib/timelineHelpers';

function safeRelative(ts) {
  if (!ts) return '';
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); }
  catch { return ''; }
}

function ActivityRow({ dotColor, badgeColor, typeLabel, address, actor, timestamp, detail, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 py-2.5 border-b border-border last:border-0 hover:bg-muted/40 transition-colors px-1 rounded"
    >
      <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground truncate">{address || typeLabel}</p>
          <p className="text-[10px] text-muted-foreground/60 shrink-0">{safeRelative(timestamp)}</p>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badgeColor}`}>{typeLabel}</span>
          {actor && <span className="text-[10px] text-muted-foreground/60">{actor}</span>}
        </div>
        {detail && <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-1">{detail}</p>}
      </div>
    </button>
  );
}

export default function DashRecentActivity({ auditLogs = [], notes = [], dailyLogs = [], changeOrders = [] }) {
  const navigate = useNavigate();

  const feed = [];

  // Use shared timeline config for consistent styling
  auditLogs.slice(0, 8).forEach(log => {
    const cfg = getEventTypeConfig('system');
    feed.push({
      id: `audit-${log.id}`,
      ts: log.timestamp,
      dotColor: cfg.dotColor,
      badgeColor: cfg.badgeColor,
      typeLabel: log.action?.replace(/_/g, ' ') || 'Update',
      address: log.job_address,
      actor: log.actor,
      detail: log.detail,
      onClick: () => log.job_id ? navigate(`/job-hub?jobId=${log.job_id}`) : navigate('/audit-log'),
    });
  });

  notes.slice(0, 5).forEach(n => {
    const ntCfg = getNoteTypeConfig(n.note_type);
    feed.push({
      id: `note-${n.id}`,
      ts: n.created_date,
      dotColor: ntCfg.dot,
      badgeColor: ntCfg.color,
      typeLabel: ntCfg.label,
      address: n.job_address || n.job_title || 'Note',
      actor: n.author_name || n.author_role,
      detail: n.content,
      onClick: () => n.job_id ? navigate(`/job-hub?jobId=${n.job_id}`) : navigate('/notes'),
    });
  });

  dailyLogs.slice(0, 5).forEach(l => {
    const cfg = getEventTypeConfig('daily_log');
    feed.push({
      id: `log-${l.id}`,
      ts: l.created_date,
      dotColor: cfg.dotColor,
      badgeColor: cfg.badgeColor,
      typeLabel: cfg.label,
      address: l.job_address,
      actor: l.created_by_name,
      detail: l.work_completed,
      onClick: () => navigate(`/daily-logs/${l.id}`),
    });
  });

  changeOrders.slice(0, 4).forEach(co => {
    const cfg = getEventTypeConfig('change_order');
    feed.push({
      id: `co-${co.id}`,
      ts: co.created_date,
      dotColor: cfg.dotColor,
      badgeColor: cfg.badgeColor,
      typeLabel: cfg.label,
      address: co.job_address,
      actor: co.created_by_name,
      detail: co.title,
      onClick: () => navigate(`/change-orders/${co.id}`),
    });
  });

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
        <ActivityRow key={item.id} {...item} timestamp={item.ts} />
      ))}
    </div>
  );
}