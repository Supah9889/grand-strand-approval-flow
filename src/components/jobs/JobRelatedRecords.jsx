/**
 * JobRelatedRecords Component
 * Displays organized related records (invoices, expenses, time entries, etc.) for a job.
 * Acts as the hub for viewing and navigating to linked records from within the job.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, DollarSign, Clock, Zap, Users, Globe, Folder,
  ChevronRight, AlertCircle, Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fmt } from '@/lib/financialHelpers';
import { RELATED_RECORD_COLORS } from '@/lib/recordLinking';

const RECORD_TYPES = [
  { key: 'invoices', label: 'Invoices', icon: FileText, color: RELATED_RECORD_COLORS.invoice },
  { key: 'expenses', label: 'Expenses', icon: DollarSign, color: RELATED_RECORD_COLORS.expense },
  { key: 'timeEntries', label: 'Time Entries', icon: Clock, color: RELATED_RECORD_COLORS.timeEntry },
  { key: 'estimates', label: 'Estimates', icon: Zap, color: RELATED_RECORD_COLORS.estimate },
  { key: 'assignments', label: 'Team Assignments', icon: Users, color: RELATED_RECORD_COLORS.assignment },
  { key: 'portalUsers', label: 'Portal Users', icon: Globe, color: RELATED_RECORD_COLORS.portalUser },
  { key: 'changeOrders', label: 'Change Orders', icon: DollarSign, color: RELATED_RECORD_COLORS.changeOrder },
  { key: 'tasks', label: 'Tasks', icon: Zap, color: RELATED_RECORD_COLORS.task },
  { key: 'dailyLogs', label: 'Daily Logs', icon: Folder, color: RELATED_RECORD_COLORS.dailyLog },
  { key: 'files', label: 'Files', icon: Folder, color: RELATED_RECORD_COLORS.file },
];

function RelatedRecordRow({ type, record, onClick }) {
  const nav = useNavigate();
  const typeConfig = RECORD_TYPES.find(t => t.key === type);
  if (!typeConfig) return null;

  let label = '';
  let detail = '';
  let amount = null;

  if (type === 'invoices') {
    label = `Invoice ${record.invoice_number}`;
    detail = `${record.customer_name} • ${record.status}`;
    amount = `$${fmt(record.amount)}`;
  } else if (type === 'expenses') {
    label = `Expense ${record.expense_number || record.id}`;
    detail = `${record.vendor_name} • ${record.category}`;
    amount = `$${fmt(record.total_amount)}`;
  } else if (type === 'timeEntries') {
    label = `Time Entry`;
    detail = `${record.employee_name} • ${record.total_hours || 0}h`;
    amount = null;
  } else if (type === 'estimates') {
    label = `Estimate ${record.estimate_number}`;
    detail = `${record.client_name} • ${record.status}`;
    amount = `$${fmt(record.total)}`;
  } else if (type === 'assignments') {
    label = `Assignment`;
    detail = `${record.employee_name} • ${record.role_on_job}`;
    amount = null;
  } else if (type === 'portalUsers') {
    label = `Portal User`;
    detail = `${record.name} • ${record.access_status}`;
    amount = null;
  } else if (type === 'changeOrders') {
    label = `Change Order ${record.co_number}`;
    detail = `${record.title} • ${record.status}`;
    amount = `$${fmt(record.total_financial_impact)}`;
  } else if (type === 'tasks') {
    label = `Task`;
    detail = `${record.title} • ${record.status}`;
    amount = null;
  } else if (type === 'dailyLogs') {
    label = `Daily Log`;
    detail = `${record.log_date ? format(parseISO(record.log_date), 'MMM d, yyyy') : 'No date'}`;
    amount = null;
  } else if (type === 'files') {
    label = `File`;
    detail = `${record.file_name} • ${record.category}`;
    amount = null;
  }

  const Icon = typeConfig.icon;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all hover:shadow-sm ${typeConfig.color.bg} ${typeConfig.color.border} border`}
    >
      <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${typeConfig.color.bg}`}>
        <Icon className={`w-3.5 h-3.5 ${typeConfig.color.text}`} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className={`text-xs font-semibold ${typeConfig.color.text}`}>{label}</p>
        <p className="text-xs text-muted-foreground truncate">{detail}</p>
      </div>
      {amount && <span className="text-xs font-medium shrink-0">{amount}</span>}
      <ChevronRight className={`w-3.5 h-3.5 ${typeConfig.color.text} shrink-0`} />
    </button>
  );
}

export default function JobRelatedRecords({ related, isLoading }) {
  const navigate = useNavigate();
  const [expandedType, setExpandedType] = useState(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!related) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-muted/20 rounded-lg">
        <AlertCircle className="w-3.5 h-3.5" />
        Unable to load related records.
      </div>
    );
  }

  // Group records with counts
  const recordGroups = RECORD_TYPES.map(rt => ({
    ...rt,
    records: related[rt.key] || [],
    count: (related[rt.key] || []).length,
  })).filter(g => g.count > 0);

  if (recordGroups.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p className="text-xs">No related records yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recordGroups.map(group => (
        <div key={group.key}>
          <button
            onClick={() => setExpandedType(expandedType === group.key ? null : group.key)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors mb-2"
          >
            <group.icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">{group.label}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${group.color.bg} ${group.color.text}`}>
              {group.count}
            </span>
          </button>

          {expandedType === group.key && (
            <div className="space-y-2 pl-2 border-l border-border">
              {group.records.slice(0, 10).map(record => (
                <RelatedRecordRow
                  key={record.id}
                  type={group.key}
                  record={record}
                  onClick={() => {
                    // Route based on record type
                    if (group.key === 'invoices') navigate('/invoices', { state: { openInvoiceId: record.id } });
                    else if (group.key === 'expenses') navigate('/expenses', { state: { openExpenseId: record.id } });
                    else if (group.key === 'timeEntries') navigate(`/time-entries/${record.id}`);
                    else if (group.key === 'estimates') navigate(`/estimates/${record.id}`);
                    else if (group.key === 'changeOrders') navigate(`/change-orders/${record.id}`);
                    else if (group.key === 'tasks') navigate(`/tasks/${record.id}`);
                    else if (group.key === 'dailyLogs') navigate(`/daily-logs/${record.id}`);
                    else if (group.key === 'assignments') navigate('/employees');
                    else if (group.key === 'portalUsers') navigate('/portal-manager');
                  }}
                />
              ))}
              {group.records.length > 10 && (
                <p className="text-xs text-muted-foreground px-3 py-1">
                  +{group.records.length - 10} more
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}