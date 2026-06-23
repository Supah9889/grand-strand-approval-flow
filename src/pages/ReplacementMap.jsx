import React from 'react';
import AppLayout from '@/components/AppLayout';
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink, Minus } from 'lucide-react';

const COVERAGE = {
  built:     { label: 'Built',               icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-100 text-green-700' },
  partial:   { label: 'Partial',             icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-100 text-orange-700' },
  not_built: { label: 'Not built yet',        icon: XCircle,       color: 'text-red-500',   bg: 'bg-red-100 text-red-700' },
  external:  { label: 'Intentionally external', icon: Minus,       color: 'text-muted-foreground', bg: 'bg-muted text-muted-foreground' },
};

function CoverageTag({ status }) {
  const cfg = COVERAGE[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg}`}>
      <cfg.icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

const PROVEN_JOBS_FEATURES = [
  { feature: 'Jobs list and job detail', coverage: 'built', note: 'Job Hub, Job Search, New Job' },
  { feature: 'Job notes', coverage: 'built', note: 'Notes tab, Daily Logs, Field Notes' },
  { feature: 'Photos per job', coverage: 'partial', note: 'Upload works; camera capture from docs in progress' },
  { feature: 'Documents per job', coverage: 'built', note: 'Job Files tab, Job Comms' },
  { feature: 'Work orders', coverage: 'built', note: 'Full work order lifecycle with checklists' },
  { feature: 'Job history / timeline', coverage: 'built', note: 'Audit log + timeline tab on Job Hub' },
  { feature: 'Customer records', coverage: 'built', note: 'CRM, Customer entity, linked to jobs' },
  { feature: 'Property records', coverage: 'built', note: 'Property entity linked to jobs' },
  { feature: 'Assigned team per job', coverage: 'built', note: 'Assigned employees on job, work orders' },
  { feature: 'Status tracking', coverage: 'built', note: 'Lifecycle + op status + priority' },
];

const BUILDERTREND_FEATURES = [
  { feature: 'Scheduling / calendar', coverage: 'built', note: 'Calendar, Field Schedule, Schedule Events' },
  { feature: 'Daily logs', coverage: 'built', note: 'Daily Logs page with staged entries' },
  { feature: 'Financials overview', coverage: 'partial', note: 'Admin-only; no manager read-only view yet' },
  { feature: 'Invoices', coverage: 'built', note: 'Invoices page (admin)' },
  { feature: 'Estimates', coverage: 'built', note: 'Estimates + line items + change orders' },
  { feature: 'Change orders', coverage: 'built', note: 'Change Orders with activity feed' },
  { feature: 'Customer portal', coverage: 'built', note: 'Client portal with job visibility' },
  { feature: 'Vendor portal', coverage: 'built', note: 'Vendor portal for subcontractors' },
  { feature: 'Purchase orders', coverage: 'built', note: 'Purchase Orders page (admin)' },
  { feature: 'Bills', coverage: 'built', note: 'Bills page (admin)' },
  { feature: 'QuickBooks sync', coverage: 'not_built', note: 'Planned; not yet integrated' },
  { feature: 'Customer/project management', coverage: 'built', note: 'CRM, lead pipeline, CRM contacts' },
  { feature: 'Warranty tracking', coverage: 'built', note: 'Warranty page with items + detail view' },
];

const PLATFORM_ONLY = [
  { feature: 'Restoration workflow (moisture/drying/air)', coverage: 'built', note: 'Unique to this platform — not in PJ or BT' },
  { feature: 'GSCP subcontract review (Jesus workflow)', coverage: 'built', note: 'Custom cross-company approval chain' },
  { feature: 'Nexus approval inbox', coverage: 'built', note: 'Field → reviewer → DH workflow' },
  { feature: 'Proven Jobs migration tools', coverage: 'built', note: 'Import, review, convert, cutover' },
  { feature: 'GPS time clock', coverage: 'built', note: 'Punch in/out with geolocation verification' },
  { feature: 'Role-based permission groups', coverage: 'built', note: 'Granular per-employee access' },
  { feature: 'Multi-company workspace', coverage: 'built', note: 'DH + GSCP under one platform' },
  { feature: 'Xactimate ESX import', coverage: 'built', note: 'Upload + review insurance estimates' },
];

const EXTERNAL_TOOLS = [
  { tool: 'Xactimate', reason: 'Industry-standard estimating tool — remains external and paid. Platform imports ESX files only.' },
  { tool: 'QuickBooks', reason: 'Accounting system — future integration planned. Currently no sync; financials entered manually.' },
  { tool: 'Lowe\'s / Home Depot (materials)', reason: 'Materials purchasing is external. Purchase Orders tracked in platform but ordering is manual.' },
];

function FeatureRow({ feature, coverage, note }) {
  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-muted/20">
      <td className="px-4 py-2.5 text-xs text-foreground">{feature}</td>
      <td className="px-4 py-2.5"><CoverageTag status={coverage} /></td>
      <td className="px-4 py-2.5 text-[11px] text-muted-foreground">{note}</td>
    </tr>
  );
}

function FeatureTable({ features, title, subtitle }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/20">
            <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Feature</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Platform Coverage</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Notes</th>
          </tr>
        </thead>
        <tbody>
          {features.map((f, i) => <FeatureRow key={i} {...f} />)}
        </tbody>
      </table>
    </div>
  );
}

export default function ReplacementMap() {
  return (
    <AppLayout title="Replacement Map">
      <div className="app-page max-w-4xl space-y-6">

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">What Replaces Proven Jobs &amp; Buildertrend</h1>
            <p className="app-page-subtitle">Feature coverage comparison — current platform status</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          {Object.entries(COVERAGE).map(([k, cfg]) => (
            <div key={k} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${cfg.bg}`}>
              <cfg.icon className="w-3.5 h-3.5" />
              {cfg.label}
            </div>
          ))}
        </div>

        <FeatureTable
          title="Proven Jobs Features"
          subtitle="Jobs, notes, photos, documents, work orders, history"
          features={PROVEN_JOBS_FEATURES}
        />

        <FeatureTable
          title="Buildertrend Features"
          subtitle="Scheduling, financials, invoices, customer/project management"
          features={BUILDERTREND_FEATURES}
        />

        <FeatureTable
          title="Platform-Only Features"
          subtitle="Capabilities not in Proven Jobs or Buildertrend"
          features={PLATFORM_ONLY}
        />

        {/* External tools */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <p className="text-sm font-semibold text-foreground">Intentionally External Tools</p>
            <p className="text-xs text-muted-foreground mt-0.5">These tools remain outside the platform by design</p>
          </div>
          <div className="divide-y divide-border/60">
            {EXTERNAL_TOOLS.map((t, i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <Minus className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.tool}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-800 mb-1">Summary</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            The platform covers <strong>all core Proven Jobs features</strong> and <strong>most Buildertrend features</strong> except QuickBooks sync.
            It adds significant new capabilities (restoration workflow, GSCP subcontract review, Nexus inbox, GPS time clock).
            Xactimate remains external. QuickBooks is the primary remaining integration gap.
          </p>
        </div>

      </div>
    </AppLayout>
  );
}