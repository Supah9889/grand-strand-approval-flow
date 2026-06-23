import React from 'react';
import AppLayout from '@/components/AppLayout';
import { AlertTriangle, Clock, XCircle, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

const LIMITATIONS = [
  {
    category: 'Security & Access',
    severity: 'medium',
    items: [
      {
        title: 'Backend enforcement relies on platform defaults',
        detail: 'Route guards and UI filters are fully implemented. However, server-side entity-level rules use the platform\'s default access model — custom per-entity permission enforcement is not yet coded. An authenticated user who knows an entity ID could theoretically access it directly via the API.',
        workaround: 'All sensitive routes have frontend admin guards. For launch, access is controlled at the session level.',
      },
      {
        title: 'Financial pages are admin-only',
        detail: 'Invoices, bills, estimates, payments, and financials are visible only to admin-role users. There is no manager read-only view — managers who need to see financials must be granted admin or have the financial visibility flag set.',
        workaround: 'Use the financial visibility flag on CompanyMembership to grant read access selectively.',
      },
    ],
  },
  {
    category: 'Data Migration',
    severity: 'high',
    items: [
      {
        title: 'Proven Jobs CSV export not yet tested against real data',
        detail: 'The import pipeline and field mapper were built based on expected Proven Jobs export format. The actual Proven Jobs export has not been tested end-to-end. Column names or structure may differ from what was assumed.',
        workaround: 'Perform a test export from Proven Jobs with a small batch (10–20 jobs) before full migration.',
      },
      {
        title: 'Bulk AI-assisted CSV field mapping not built',
        detail: 'Column mapping is done manually — admins must match incoming CSV columns to platform fields. For large or complex exports this is tedious. AI-assisted auto-mapping is planned but not built.',
        workaround: 'Use the manual column mapper in the BT Import flow; document your mapping for repeat runs.',
      },
    ],
  },
  {
    category: 'Integrations',
    severity: 'high',
    items: [
      {
        title: 'QuickBooks integration not built',
        detail: 'No QuickBooks sync exists yet. Invoices, bills, time entries, and expenses must be entered manually in both systems. The QB connection page has a placeholder but no live sync.',
        workaround: 'Export data from the platform manually and enter in QuickBooks. This is the highest-priority future integration.',
      },
    ],
  },
  {
    category: 'Field Operations',
    severity: 'medium',
    items: [
      {
        title: 'Mobile offline mode not built',
        detail: 'The app requires an active internet connection. Field technicians in areas with poor signal (basements, rural sites) may experience failures when clocking in, submitting notes, or completing checklists.',
        workaround: 'Advise field staff to complete time entries and submissions when back in signal range. An offline queue is planned.',
      },
      {
        title: 'Photo upload from Job Documentation tab not wired',
        detail: 'The Job Documentation page shows a photo section but the upload/camera capture flow is not connected. Photos can be uploaded via Job Files and Job Comms, but not directly from the documentation checklist view.',
        workaround: 'Use the Job Files tab or Job Comms file upload for all field photos.',
      },
    ],
  },
  {
    category: 'Testing & Rollout',
    severity: 'medium',
    items: [
      {
        title: 'Real employee accounts not yet created',
        detail: 'All testing has been done using admin sessions. Field technician, GSCP, and reviewer workflows have been validated by design but not by real users with actual employee accounts.',
        workaround: 'Invite a small pilot group (2–3 field techs + Jesus) for a parallel test run before full rollout.',
      },
      {
        title: 'Edge cases in permission logic not fully stress-tested',
        detail: 'Vendor scoping (can_view_assigned_only), cross-company subcontract note visibility, and nexus reviewer assignments have been built but not exhaustively tested with all role combinations.',
        workaround: 'Use the Access Tests page (/access-tests) to validate permission scenarios before inviting staff.',
      },
      {
        title: 'Proven Jobs parallel run period not scheduled',
        detail: 'A parallel run (using both Proven Jobs and the new platform simultaneously) is strongly recommended before decommissioning Proven Jobs. This period has not been formally scheduled or agreed upon.',
        workaround: 'See the Rollout Checklist for parallel run planning items.',
      },
    ],
  },
];

const SEVERITY_CONFIG = {
  high: { label: 'High', color: 'bg-red-100 text-red-700', icon: XCircle },
  medium: { label: 'Medium', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  low: { label: 'Low', color: 'bg-blue-100 text-blue-700', icon: Info },
};

export default function KnownLimitations() {
  const total = LIMITATIONS.reduce((s, c) => s + c.items.length, 0);

  return (
    <AppLayout title="Known Limitations">
      <div className="app-page max-w-3xl space-y-6">

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Known Limitations</h1>
            <p className="app-page-subtitle">Honest accounting of what is not yet complete — {total} items documented</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Before Go-Live</p>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              Review all high-severity items with Nick before committing to a cutover date.
              Medium-severity items can be addressed during or after the parallel run period.
              See the <Link to="/rollout-checklist" className="underline font-medium">Rollout Checklist</Link> for sequencing.
            </p>
          </div>
        </div>

        {LIMITATIONS.map(category => {
          const cfg = SEVERITY_CONFIG[category.severity];
          return (
            <div key={category.category} className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category.category}</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label} priority</span>
              </div>
              <div className="space-y-2">
                {category.items.map((item, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <cfg.icon className={`w-4 h-4 shrink-0 mt-0.5 ${cfg.label === 'High' ? 'text-red-500' : cfg.label === 'Medium' ? 'text-orange-500' : 'text-blue-500'}`} />
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-6">{item.detail}</p>
                    {item.workaround && (
                      <div className="pl-6">
                        <p className="text-[11px] font-semibold text-foreground">Workaround:</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{item.workaround}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">What IS solid</p>
            <p className="text-xs text-green-700 mt-1 leading-relaxed">
              Core daily field operations, restoration documentation, subcontract workflows, Nexus approval,
              time tracking, scheduling, and the Proven Jobs migration tooling are all fully built and ready.
              The limitations above are known gaps — not unexpected surprises.
            </p>
          </div>
        </div>

        <div className="pb-8" />
      </div>
    </AppLayout>
  );
}