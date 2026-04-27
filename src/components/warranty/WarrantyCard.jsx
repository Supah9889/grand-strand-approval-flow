import React from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Calendar, User, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { WARRANTY_STATUS_CONFIG, WARRANTY_CATEGORY_LABELS, WARRANTY_PRIORITY_CONFIG } from '@/lib/warrantyHelpers';

export default function WarrantyCard({ item, onStatusChange, onClick }) {
  const cfg = WARRANTY_STATUS_CONFIG[item.status] || WARRANTY_STATUS_CONFIG.new;
  const priCfg = WARRANTY_PRIORITY_CONFIG[item.priority] || WARRANTY_PRIORITY_CONFIG.normal;
  const photos = (() => { try { return JSON.parse(item.photos || '[]'); } catch { return []; } })();

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors cursor-pointer" onClick={onClick}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
              <span className={`text-xs font-medium ${priCfg.color}`}>{priCfg.label}</span>
              {!item.covered_under_warranty && (
                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" /> Not Covered
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.customer_name}{item.job_address ? ` · ${item.job_address}` : ''}</p>
            {item.category && <p className="text-xs text-muted-foreground mt-0.5">{WARRANTY_CATEGORY_LABELS[item.category] || item.category}</p>}
          </div>
          {photos.length > 0 && (
            <div className="w-12 h-12 rounded-lg overflow-hidden border border-border shrink-0">
              <img src={photos[0]} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {item.issue_description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{item.issue_description}</p>
        )}

        <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-muted-foreground">
          {item.date_reported && <span>Reported {format(parseISO(item.date_reported), 'MMM d, yyyy')}</span>}
          {item.assigned_to && <span className="flex items-center gap-1"><User className="w-3 h-3" />{item.assigned_to}</span>}
          {item.appointment_date && (
            <span className="flex items-center gap-1 text-violet-600 font-medium">
              <Calendar className="w-3 h-3" />Appt: {format(parseISO(item.appointment_date), 'MMM d')}
            </span>
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-border/60" onClick={e => e.stopPropagation()}>
          <Select value={item.status} onValueChange={onStatusChange}>
            <SelectTrigger className="h-7 text-xs rounded-lg w-auto min-w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(WARRANTY_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}