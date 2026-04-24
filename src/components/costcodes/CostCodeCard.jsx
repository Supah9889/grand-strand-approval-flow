import React from 'react';
import { Edit2, Archive, ToggleLeft, ToggleRight, ChevronRight } from 'lucide-react';

const CATEGORY_LABELS = {
  labor: 'Labor', materials: 'Materials', equipment: 'Equipment',
  subcontractor: 'Subcontractor', overhead: 'Overhead', administrative: 'Administrative',
  permit_inspection: 'Permit / Inspection', travel: 'Travel', disposal_cleanup: 'Disposal / Cleanup',
  miscellaneous: 'Miscellaneous', revenue_billing: 'Revenue / Billing', other: 'Other',
};

const CATEGORY_COLORS = {
  labor: 'bg-blue-100 text-blue-700', materials: 'bg-green-100 text-green-700',
  equipment: 'bg-purple-100 text-purple-700', subcontractor: 'bg-orange-100 text-orange-700',
  overhead: 'bg-slate-100 text-slate-600', administrative: 'bg-gray-100 text-gray-600',
  permit_inspection: 'bg-yellow-100 text-yellow-700', travel: 'bg-cyan-100 text-cyan-700',
  disposal_cleanup: 'bg-lime-100 text-lime-700', miscellaneous: 'bg-pink-100 text-pink-700',
  revenue_billing: 'bg-emerald-100 text-emerald-700', other: 'bg-muted text-muted-foreground',
};

const TYPE_COLORS = {
  expense: 'bg-red-50 text-red-600', billable: 'bg-blue-50 text-blue-600',
  non_billable: 'bg-gray-50 text-gray-500', revenue: 'bg-emerald-50 text-emerald-600',
  labor: 'bg-indigo-50 text-indigo-600', material: 'bg-green-50 text-green-600',
  time: 'bg-violet-50 text-violet-600', vendor_charge: 'bg-orange-50 text-orange-600',
  subcontractor_charge: 'bg-amber-50 text-amber-600', internal_only: 'bg-slate-50 text-slate-500',
};

const TYPE_LABELS = {
  expense: 'Expense', billable: 'Billable', non_billable: 'Non-Billable', revenue: 'Revenue',
  labor: 'Labor', material: 'Material', time: 'Time', vendor_charge: 'Vendor Charge',
  subcontractor_charge: 'Sub Charge', internal_only: 'Internal',
};

const RECORD_TYPE_LABELS = {
  expense: 'EXP', bill: 'BILL', invoice: 'INV', estimate: 'EST', time_entry: 'TIME', job: 'JOB',
};

export default function CostCodeCard({ code, onEdit, onToggleActive, onArchive, usageCounts }) {
  const isActive = code.status === 'active';
  const isArchived = code.status === 'archived';

  let allowedOn = [];
  try { allowedOn = JSON.parse(code.allowed_on || '[]'); } catch {}

  const totalUsage = usageCounts ? Object.values(usageCounts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className={`bg-card border rounded-2xl p-4 transition-all ${isArchived ? 'opacity-50 border-dashed' : 'border-border hover:border-primary/30'}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Number badge */}
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <span className="font-mono text-xs font-bold text-muted-foreground">{code.code_number}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground">{code.name}</p>
              {!isActive && (
                <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                  isArchived ? 'bg-slate-100 text-slate-500' : 'bg-orange-100 text-orange-600'
                }`}>
                  {isArchived ? 'Archived' : 'Inactive'}
                </span>
              )}
            </div>
            {code.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{code.description}</p>
            )}
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {code.category && (
                <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${CATEGORY_COLORS[code.category] || CATEGORY_COLORS.other}`}>
                  {CATEGORY_LABELS[code.category] || code.category}
                </span>
              )}
              {code.code_type && (
                <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${TYPE_COLORS[code.code_type] || ''}`}>
                  {TYPE_LABELS[code.code_type] || code.code_type}
                </span>
              )}
              {allowedOn.slice(0, 4).map(rt => (
                <span key={rt} className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">
                  {RECORD_TYPE_LABELS[rt] || rt}
                </span>
              ))}
              {allowedOn.length > 4 && (
                <span className="text-xs text-muted-foreground">+{allowedOn.length - 4}</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {!isArchived && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onEdit(code)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Edit">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onToggleActive(code)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title={isActive ? 'Deactivate' : 'Activate'}>
              {isActive ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4" />}
            </button>
            {isActive && (
              <button onClick={() => onArchive(code)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Archive">
                <Archive className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* QB mapping row */}
      {(code.qb_account_name || code.qb_item_name) && (
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-3">
          <div className="w-4 h-4 rounded bg-emerald-100 flex items-center justify-center shrink-0">
            <span className="text-[8px] font-bold text-emerald-700">QB</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {code.qb_account_name && <span>{code.qb_account_name}</span>}
            {code.qb_account_name && code.qb_item_name && <span className="mx-1.5">·</span>}
            {code.qb_item_name && <span>{code.qb_item_name}</span>}
          </div>
        </div>
      )}

      {/* Usage counts */}
      {usageCounts && totalUsage > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-3 flex-wrap">
          {Object.entries(usageCounts).filter(([, v]) => v > 0).map(([type, count]) => (
            <span key={type} className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{count}</span> {type}
            </span>
          ))}
        </div>
      )}

      {/* Validation rule indicators */}
      {(code.requires_memo || code.requires_vendor || code.requires_employee || code.requires_approval || code.requires_attachment) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {code.requires_vendor && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">vendor req.</span>}
          {code.requires_employee && <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">employee req.</span>}
          {code.requires_memo && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-50 text-slate-500">memo req.</span>}
          {code.requires_approval && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-600">approval req.</span>}
          {code.requires_attachment && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">attachment req.</span>}
        </div>
      )}
    </div>
  );
}