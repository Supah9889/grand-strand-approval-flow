import React, { useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { CheckCircle2, XCircle, AlertCircle, ShieldAlert } from 'lucide-react';
import { isAdmin } from '@/lib/adminAuth';
import {
  getCurrentCompany,
  getSessionRole,
  canViewAssignedOnly,
  canViewFinancials,
  canEditFinancials,
  canApproveNexus,
  canManageWorkOrders,
  canReviewSubcontractNote,
  canManageAccess,
  canViewJobs,
  getCurrentMembership,
} from '@/lib/permissions';
import { getSessionEmployee } from '@/lib/adminAuth';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

function ResultRow({ label, description, result, expected }) {
  const pass = result === expected;
  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 ${pass ? '' : 'bg-red-50/50'}`}>
      <div className="mt-0.5 shrink-0">
        {pass
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          : <XCircle className="w-4 h-4 text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0 text-right">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {pass ? 'PASS' : 'FAIL'}
        </span>
        <p className="text-[10px] text-muted-foreground mt-0.5">got: {String(result)}</p>
      </div>
    </div>
  );
}

function ScenarioCard({ title, subtitle, results }) {
  const total = results.length;
  const passed = results.filter(r => r.result === r.expected).length;
  const allPass = passed === total;
  return (
    <div className={`rounded-2xl border overflow-hidden ${allPass ? 'border-emerald-200' : 'border-red-200'}`}>
      <div className={`flex items-center justify-between px-4 py-3 ${allPass ? 'bg-emerald-50' : 'bg-red-50'}`}>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${allPass ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
            {passed}/{total}
          </span>
        </div>
      </div>
      <div className="bg-card">
        {results.map((r, i) => <ResultRow key={i} {...r} />)}
      </div>
    </div>
  );
}

export default function AccessTests() {
  const sessionRole = getSessionRole();
  const company = getCurrentCompany();
  const employee = getSessionEmployee();
  const isAdminSession = isAdmin();

  const { data: memberships = [] } = useQuery({
    queryKey: ['access-test-memberships', company?.id],
    queryFn: () => company
      ? base44.entities.CompanyMembership.filter({ company_id: company.id })
      : Promise.resolve([]),
    enabled: !!company,
  });

  const membership = getCurrentMembership(memberships);

  if (!isAdmin()) {
    return (
      <AppLayout title="Access Tests">
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-4">
          <ShieldAlert className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm font-semibold">Admin access required</p>
          <p className="text-xs text-muted-foreground">Only owners and admins can run access tests.</p>
        </div>
      </AppLayout>
    );
  }

  const scenarios = [
    {
      title: 'Session Role Checks',
      subtitle: `Current session role: ${sessionRole || 'none'} · Employee: ${employee?.name || 'none'}`,
      results: [
        {
          label: 'Session role is set',
          description: 'getSessionRole() must return owner, admin, or staff',
          result: ['owner','admin','staff'].includes(sessionRole),
          expected: true,
        },
        {
          label: 'isAdmin() agrees with session role',
          description: 'owner or admin sessions → isAdmin() === true',
          result: isAdminSession,
          expected: ['owner','admin'].includes(sessionRole),
        },
      ],
    },
    {
      title: 'Owner / Admin — Full Access',
      subtitle: 'Owners and admins should have all key permissions',
      results: [
        {
          label: 'Can view jobs',
          description: 'Admin sessions always pass canViewJobs()',
          result: canViewJobs(memberships),
          expected: true,
        },
        {
          label: 'Can manage work orders',
          description: 'Admin sessions always pass canManageWorkOrders()',
          result: canManageWorkOrders(memberships),
          expected: true,
        },
        {
          label: 'Can view financials',
          description: 'Admin sessions always pass canViewFinancials()',
          result: canViewFinancials(memberships),
          expected: true,
        },
        {
          label: 'Not restricted to assigned-only',
          description: 'Admins are never restricted to assigned-only records',
          result: canViewAssignedOnly(memberships),
          expected: false,
        },
      ],
    },
    {
      title: 'Company Selection (Staff)',
      subtitle: 'Staff sessions must have an active company to see data',
      results: [
        {
          label: 'Active company is set',
          description: 'A company must be selected in sessionStorage',
          result: !!company,
          expected: true,
        },
        {
          label: 'Active company has an ID',
          description: 'company.id must be a non-empty string',
          result: !!(company?.id),
          expected: true,
        },
      ],
    },
    {
      title: 'Field Technician — Assigned-Only Scenario',
      subtitle: 'Vendor / field-tech memberships with can_view_assigned_only should be restricted',
      results: [
        {
          label: 'Vendor role → canViewAssignedOnly() = true',
          description: 'If the current membership role is "vendor", assigned-only must be enforced (bypassed in admin session)',
          result: membership?.role === 'vendor' ? canViewAssignedOnly(memberships) : 'N/A (not vendor)',
          expected: membership?.role === 'vendor' ? true : 'N/A (not vendor)',
        },
        {
          label: 'can_view_assigned_only flag → enforces restriction',
          description: 'membership.can_view_assigned_only = true → canViewAssignedOnly() = true',
          result: membership?.can_view_assigned_only === true ? canViewAssignedOnly(memberships) : 'N/A (flag not set)',
          expected: membership?.can_view_assigned_only === true ? true : 'N/A (flag not set)',
        },
      ],
    },
    {
      title: 'Financial Permission Scoping',
      subtitle: 'Financial flags must be consistent with membership permissions',
      results: [
        {
          label: 'can_view_financials flag respected',
          description: 'If membership.can_view_financials = true, canViewFinancials() must also be true',
          result: membership?.can_view_financials === true ? canViewFinancials(memberships) : 'N/A',
          expected: membership?.can_view_financials === true ? true : 'N/A',
        },
        {
          label: 'can_edit_financials implies can_view_financials',
          description: 'Edit access implies view access',
          result: membership?.can_edit_financials === true
            ? canViewFinancials(memberships) && canEditFinancials(memberships)
            : 'N/A',
          expected: membership?.can_edit_financials === true ? true : 'N/A',
        },
        {
          label: 'Field tech without financial flags cannot view financials',
          description: 'Pure field_technician membership without explicit flags → canViewFinancials() = false',
          result: (membership?.role === 'field_technician' && !membership?.can_view_financials && !isAdminSession)
            ? canViewFinancials(memberships)
            : 'N/A (not a plain field tech)',
          expected: (membership?.role === 'field_technician' && !membership?.can_view_financials && !isAdminSession)
            ? false
            : 'N/A (not a plain field tech)',
        },
      ],
    },
    {
      title: 'Nexus & Subcontract Review',
      subtitle: 'Review permissions must respect membership flags',
      results: [
        {
          label: 'can_approve_nexus flag → canApproveNexus() = true',
          description: 'If membership grants Nexus approval, the permission check must agree',
          result: membership?.can_approve_nexus === true ? canApproveNexus(memberships) : 'N/A',
          expected: membership?.can_approve_nexus === true ? true : 'N/A',
        },
        {
          label: 'can_review_subcontract_notes flag respected',
          description: 'Membership flag must surface through canReviewSubcontractNote()',
          result: membership?.can_review_subcontract_notes === true ? canReviewSubcontractNote(memberships) : 'N/A',
          expected: membership?.can_review_subcontract_notes === true ? true : 'N/A',
        },
      ],
    },
    {
      title: 'Access Management Gate',
      subtitle: 'Only owners/admins or users with can_manage_users should pass',
      results: [
        {
          label: 'Admin session → canManageAccess() = true',
          description: 'isAdmin() sessions always pass the access management gate',
          result: canManageAccess(memberships),
          expected: true,
        },
      ],
    },
  ];

  const totalTests = scenarios.reduce((s, sc) => s + sc.results.length, 0);
  const totalPassed = scenarios.reduce((s, sc) => s + sc.results.filter(r => r.result === r.expected).length, 0);

  return (
    <AppLayout title="Access Tests">
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-24">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-foreground">Access Test Scenarios</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Validates permission checks for the current session. Admin-only.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold px-3 py-1.5 rounded-xl ${totalPassed === totalTests ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {totalPassed}/{totalTests} passed
            </span>
          </div>
        </div>

        {/* Session context */}
        <div className="bg-muted/40 rounded-xl px-4 py-3 text-xs space-y-1">
          <p><span className="font-semibold text-muted-foreground">Session role:</span> {sessionRole || '—'}</p>
          <p><span className="font-semibold text-muted-foreground">Employee:</span> {employee?.name || '—'} ({employee?.id?.slice(0,8) || '—'})</p>
          <p><span className="font-semibold text-muted-foreground">Active company:</span> {company ? `${company.name} (${company.id?.slice(0,8)})` : 'None'}</p>
          <p><span className="font-semibold text-muted-foreground">Membership role:</span> {membership?.role || '—'}</p>
          <p><span className="font-semibold text-muted-foreground">Permission group:</span> {membership?.permission_group || '—'}</p>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            These tests reflect the <strong>current session only</strong>. To test a specific role scenario
            (e.g. "GSCP field tech"), log in as that user and return to this page.
          </p>
        </div>

        {/* Scenarios */}
        {scenarios.map((sc, i) => (
          <ScenarioCard key={i} {...sc} />
        ))}
      </div>
    </AppLayout>
  );
}