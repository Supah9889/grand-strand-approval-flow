import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isAdmin } from '@/lib/adminAuth';
import { BOOTSTRAP_COMPANY_MEMBERSHIPS_CONFIRM } from '@/lib/companyMembershipBootstrap';

function CountTile({ label, value, loading }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{loading ? '-' : value}</p>
    </div>
  );
}

function ResultPanel({ result }) {
  if (!result) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-sm">
      <div className="flex items-center gap-2">
        {result.dryRun ? (
          <AlertTriangle className="h-4 w-4 text-amber-600" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        )}
        <p className="font-semibold text-foreground">{result.dryRun ? 'Dry Run Result' : 'Live Bootstrap Complete'}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span>Admin memberships to create</span>
        <span className="text-right font-medium text-foreground">{result.adminOwnerMembershipsToCreate || 0}</span>
        <span>Created</span>
        <span className="text-right font-medium text-foreground">{result.createdCount || 0}</span>
        <span>Skipped existing</span>
        <span className="text-right font-medium text-foreground">{result.skippedCount || 0}</span>
        <span>Manual review required</span>
        <span className="text-right font-medium text-foreground">{result.manualReviewRequired?.length || 0}</span>
      </div>
      {result.sampleRecords?.adminOwnerMembershipsToCreate?.length > 0 && (
        <div className="mt-3 rounded-lg bg-muted/40 p-3">
          <p className="text-xs font-semibold text-foreground">Sample admin memberships</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {result.sampleRecords.adminOwnerMembershipsToCreate.slice(0, 5).map((record, index) => (
              <li key={`${record.employee_id}-${record.company_id}-${index}`}>
                {record.employee_name || record.employee_id} - {record.company_name || record.company_id}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.manualReviewInstructions && (
        <p className="mt-3 text-xs text-muted-foreground">{result.manualReviewInstructions}</p>
      )}
    </div>
  );
}

export default function MembershipBootstrap() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState('');
  const [lastResult, setLastResult] = useState(null);

  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ['bootstrap-companies'],
    queryFn: () => base44.entities.Company.list('name', 1000).catch(() => []),
  });
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['bootstrap-employees'],
    queryFn: () => base44.entities.Employee.list('name', 1000).catch(() => []),
  });
  const { data: memberships = [], isLoading: loadingMemberships } = useQuery({
    queryKey: ['bootstrap-company-memberships'],
    queryFn: () => base44.entities.CompanyMembership.list('created_date', 5000).catch(() => []),
  });

  const dryRunMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('bootstrapCompanyMemberships', { dryRun: true });
      return response?.data || response;
    },
    onSuccess: setLastResult,
  });

  const liveMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('bootstrapCompanyMemberships', {
        dryRun: false,
        confirm,
      });
      return response?.data || response;
    },
    onSuccess: (result) => {
      setLastResult(result);
      queryClient.clear();
    },
  });

  if (!isAdmin()) {
    return (
      <AppLayout title="Bootstrap Memberships">
        <div className="flex min-h-[60vh] items-center justify-center px-4 text-center text-sm text-muted-foreground">
          Owner or admin access is required.
        </div>
      </AppLayout>
    );
  }

  const loading = loadingCompanies || loadingEmployees || loadingMemberships;
  const membershipsEmpty = !loadingMemberships && memberships.length === 0;
  const canLiveRun = confirm === BOOTSTRAP_COMPANY_MEMBERSHIPS_CONFIRM && !liveMutation.isPending;

  return (
    <AppLayout title="Bootstrap Memberships">
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Company Membership Bootstrap</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recover admin access by creating missing owner/admin memberships across active companies.
          </p>
        </div>

        {membershipsEmpty && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">Company memberships are empty.</p>
            <p className="mt-1 text-xs">Admin fallback access is active. Run dry run first, then live bootstrap when ready.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CountTile label="Companies" value={companies.filter(company => company.is_active !== false).length} loading={loadingCompanies} />
          <CountTile label="Employees" value={employees.filter(employee => employee.active !== false).length} loading={loadingEmployees} />
          <CountTile label="Memberships" value={memberships.length} loading={loadingMemberships} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">Run Bootstrap</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Dry run does not write. Live bootstrap creates missing memberships only for owner/admin employees and never deletes existing records.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => dryRunMutation.mutate()}
              disabled={loading || dryRunMutation.isPending}
            >
              {dryRunMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Run Dry Run
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              onClick={() => liveMutation.mutate()}
              disabled={!canLiveRun}
            >
              {liveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Run Live Bootstrap
            </Button>
          </div>
          <Input
            className="mt-3 rounded-xl"
            value={confirm}
            onChange={event => setConfirm(event.target.value)}
            placeholder={BOOTSTRAP_COMPANY_MEMBERSHIPS_CONFIRM}
          />
        </div>

        <ResultPanel result={lastResult} />

        {lastResult && !lastResult.dryRun && (
          <Button type="button" className="rounded-xl" onClick={() => navigate('/company-select')}>
            Go to Company Selector
          </Button>
        )}
      </div>
    </AppLayout>
  );
}
