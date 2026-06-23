/**
 * financialGuards.jsx — Shared helpers for financial field masking and assigned-only filtering.
 */

import React from 'react';
import { Lock } from 'lucide-react';
import { getSessionEmployee } from '@/lib/adminAuth';

export function maskFinancialValue(value, canView, format = 'currency') {
  if (!canView) return null;
  if (value == null || value === '') return null;
  if (format === 'currency') {
    const n = Number(value);
    return isNaN(n) ? value : `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  return value;
}

export function RestrictedBadge({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full ${className}`}>
      <Lock className="w-2.5 h-2.5" />
      Restricted
    </span>
  );
}

export function FinancialGuard({ canView, compact = false, children }) {
  if (canView) return children;
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="w-3 h-3" />
        <span>Financial information restricted</span>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-5 text-center space-y-1">
      <Lock className="w-5 h-5 text-muted-foreground/50 mx-auto" />
      <p className="text-sm font-semibold text-foreground">Financial information restricted</p>
      <p className="text-xs text-muted-foreground">Contact an admin to request financial access.</p>
    </div>
  );
}

function isAssignedToRecord(record) {
  const employee = getSessionEmployee();
  if (!employee?.id) return false;
  try {
    const ids = JSON.parse(record.assigned_employee_ids || '[]');
    return ids.includes(employee.id);
  } catch {
    return false;
  }
}

export function filterAssignedRecords(records, canViewAssignedOnly) {
  if (!canViewAssignedOnly) return records;
  return records.filter(r => isAssignedToRecord(r));
}

export function canViewJob(job, company, canViewAssignedOnly) {
  if (!job) return false;
  if (!canViewAssignedOnly) return true;
  return isAssignedToRecord(job);
}

export function canViewWorkOrder(wo, canViewAssignedOnly) {
  if (!wo) return false;
  if (!canViewAssignedOnly) return true;
  return isAssignedToRecord(wo);
}

export function canViewScheduleEvent(event, canViewAssignedOnly) {
  if (!event) return false;
  if (!canViewAssignedOnly) return true;
  return isAssignedToRecord(event);
}

export function AssignedOnlyBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
      <Lock className="w-3.5 h-3.5 shrink-0" />
      <span>You are viewing assigned work only.</span>
    </div>
  );
}

export function NoAccessRecord({ message = 'You do not have access to this record.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <Lock className="w-8 h-8 text-muted-foreground/30 mb-3" />
      <p className="text-sm font-semibold text-foreground">Access restricted</p>
      <p className="text-xs text-muted-foreground mt-1">{message}</p>
    </div>
  );
}

export function SubcontractPendingNotice() {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
      <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>This subcontract update is awaiting approval before it is visible to the origin company.</span>
    </div>
  );
}