import React from 'react';
import { format, parseISO } from 'date-fns';
import { TrendingUp, TrendingDown, Clock, AlertCircle } from 'lucide-react';
import COStatusBadge from './COStatusBadge';
import { CO_CATEGORY_LABELS } from '@/lib/changeOrderHelpers';

export default function COCard({ co, onClick }) {
  const impact = Number(co.total_financial_impact || 0);
  const hasTime = Number(co.time_impact_value || 0) !== 0;

  return (
    <button onClick={onClick} className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted-foreground">{co.co_number}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{CO_CATEGORY_LABELS[co.category] || co.category}</span>
          </div>
          <p className="text-sm font-semibold text-foreground">{co.title}</p>
          {co.job_address && <p className="text-xs text-muted-foreground mt-0.5 truncate">{co.job_address}</p>}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {impact !== 0 && (
              <span className={`flex items-center gap-1 text-xs font-medium ${impact > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {impact > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {impact > 0 ? '+' : ''}${Math.abs(impact).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            )}
            {hasTime && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />{co.time_impact_value > 0 ? '+' : ''}{co.time_impact_value} {co.time_impact_unit}
              </span>
            )}
            {co.signature_required && (
              <span className="flex items-center gap-1 text-xs text-amber-600"><AlertCircle className="w-3 h-3" />Sig. Required</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <COStatusBadge status={co.status} />
          <span className="text-xs text-muted-foreground">{co.created_date ? format(parseISO(co.created_date), 'MMM d') : ''}</span>
        </div>
      </div>
    </button>
  );
}