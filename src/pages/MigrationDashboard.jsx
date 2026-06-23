import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getCurrentCompany } from '@/lib/permissions';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import {
  Database, FileText, AlertTriangle, CheckCircle2, XCircle,
  ArrowRight, Users, Brain, Copy, Loader2, ClipboardList
} from 'lucide-react';
import { findDuplicateCandidates } from '@/lib/legacyDuplicates';

function MetricCard({ icon: Icon, label, value, sub, color, to }) {
  const inner = (
    <div className={`bg-card border border-border rounded-xl p-4 flex items-start gap-3 hover:border-primary/40 transition-colors ${to ? 'cursor-pointer' : ''}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {to && <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto self-center shrink-0" />}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export default function MigrationDashboard() {
  const company = getCurrentCompany();

  const { data: imports = [], isLoading: loadingImports } = useQuery({
    queryKey: ['legacy-imports', company?.id],
    queryFn: () => base44.entities.LegacyImport.filter({ company_id: company?.id }, '-created_date', 200),
    enabled: !!company?.id,
  });

  const { data: jobRecords = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['legacy-jobs-all', company?.id],
    queryFn: () => base44.entities.LegacyJobRecord.filter({ company_id: company?.id }, '-created_date', 500),
    enabled: !!company?.id,
  });

  const { data: nexusItems = [] } = useQuery({
    queryKey: ['nexus-legacy', company?.id],
    queryFn: () => base44.entities.NexusItem.filter({ company_id: company?.id, source_type: 'manual' }, '-created_date', 200),
    enabled: !!company?.id,
  });

  const isLoading = loadingImports || loadingJobs;

  // Computed metrics
  const totalImports = imports.length;
  const totalJobs = jobRecords.length;
  const needsReview = jobRecords.filter(r => r.migration_status === 'needs_review').length;
  const converted = jobRecords.filter(r => r.migration_status === 'converted').length;
  const errors = jobRecords.filter(r => r.migration_status === 'error').length;
  const readyForCutover = jobRecords.filter(r => r.cutover_status === 'ready_for_cutover').length;
  const cutoverComplete = jobRecords.filter(r => r.cutover_status === 'cutover_complete').length;
  const blocked = jobRecords.filter(r => r.cutover_status === 'blocked').length;

  // Duplicate detection — run against all non-archived jobs
  const activeForDupCheck = jobRecords.filter(r => !['archived', 'converted'].includes(r.migration_status));
  const dupCandidates = new Set();
  for (const rec of activeForDupCheck) {
    const found = findDuplicateCandidates(rec, activeForDupCheck);
    if (found.some(c => c.score >= 60)) dupCandidates.add(rec.id);
  }

  // Progress
  const pct = totalJobs > 0 ? Math.round((converted / totalJobs) * 100) : 0;

  return (
    <AppLayout title="Migration Dashboard">
      <div className="app-page space-y-6">

        {/* Header */}
        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Migration Dashboard</h1>
            <p className="app-page-subtitle">Proven Jobs → Platform readiness overview</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/proven-jobs-checklist"
              className="flex items-center gap-1.5 h-9 px-3 bg-muted rounded-lg text-xs font-semibold text-foreground hover:bg-accent transition-colors">
              <ClipboardList className="w-4 h-4" /> Export Checklist
            </Link>
            <Link to="/legacy-imports"
              className="flex items-center gap-1.5 h-9 px-3 bg-muted rounded-lg text-xs font-semibold text-foreground hover:bg-accent transition-colors">
              <Database className="w-4 h-4" /> Imports
            </Link>
            <Link to="/legacy-records"
              className="flex items-center gap-1.5 h-9 px-3 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors">
              <ArrowRight className="w-4 h-4" /> Review Records
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Progress Bar */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Overall Conversion Progress</span>
                <span className="font-bold text-primary">{pct}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{converted} of {totalJobs} jobs converted</p>
            </div>

            {/* Import metrics */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Import Overview</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard icon={Database} label="Total Imports" value={totalImports}
                  color="bg-blue-100 text-blue-700" to="/legacy-imports" />
                <MetricCard icon={FileText} label="Legacy Jobs" value={totalJobs}
                  color="bg-purple-100 text-purple-700" to="/legacy-records" />
                <MetricCard icon={AlertTriangle} label="Needs Review" value={needsReview}
                  color="bg-orange-100 text-orange-700" to="/legacy-records" />
                <MetricCard icon={XCircle} label="Errors" value={errors}
                  color="bg-red-100 text-red-700" to="/legacy-records" />
              </div>
            </div>

            {/* Conversion & cutover */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Conversion & Cutover</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard icon={CheckCircle2} label="Converted" value={converted}
                  color="bg-green-100 text-green-700" sub="New platform jobs created" />
                <MetricCard icon={ArrowRight} label="Ready for Cutover" value={readyForCutover}
                  color="bg-cyan-100 text-cyan-700" to="/legacy-records" />
                <MetricCard icon={CheckCircle2} label="Cutover Complete" value={cutoverComplete}
                  color="bg-emerald-100 text-emerald-700" />
                <MetricCard icon={XCircle} label="Blocked" value={blocked}
                  color="bg-red-100 text-red-700" />
              </div>
            </div>

            {/* Intelligence */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Intelligence</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <MetricCard icon={Copy} label="Duplicate Candidates" value={dupCandidates.size}
                  color="bg-yellow-100 text-yellow-700"
                  sub="High-confidence matches" to="/legacy-records" />
                <MetricCard icon={Brain} label="Nexus Items (Legacy)" value={nexusItems.length}
                  color="bg-indigo-100 text-indigo-700" to="/nexus" />
                <MetricCard icon={Users} label="Imports Uploaded" value={imports.filter(i => i.status === 'imported').length}
                  color="bg-teal-100 text-teal-700" to="/legacy-imports" />
              </div>
            </div>

            {/* Status breakdown table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job Record Status Breakdown</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">Count</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">%</th>
                  </tr>
                </thead>
                <tbody>
                  {['imported','needs_review','linked','converted','archived','duplicate','error'].map(s => {
                    const count = jobRecords.filter(r => r.migration_status === s).length;
                    const pctRow = totalJobs > 0 ? Math.round((count / totalJobs) * 100) : 0;
                    return (
                      <tr key={s} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2 text-xs capitalize">{s.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2 text-xs text-right font-medium">{count}</td>
                        <td className="px-4 py-2 text-xs text-right text-muted-foreground">{pctRow}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Next steps guidance */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-blue-800">Recommended Next Steps</p>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                {needsReview > 0 && <li>Review {needsReview} record{needsReview !== 1 ? 's' : ''} flagged for review in Legacy Records</li>}
                {dupCandidates.size > 0 && <li>Investigate {dupCandidates.size} potential duplicate{dupCandidates.size !== 1 ? 's' : ''} before converting</li>}
                {totalJobs === 0 && <li>Upload your first Proven Jobs export in Legacy Imports</li>}
                {readyForCutover > 0 && <li>Complete cutover for {readyForCutover} job{readyForCutover !== 1 ? 's' : ''} marked ready</li>}
                <li>Complete the Proven Jobs Export Checklist to ensure nothing is missed</li>
              </ol>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}