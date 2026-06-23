import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getCurrentCompany } from '@/lib/permissions';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { CheckCircle2, XCircle, AlertTriangle, Clock, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const TEST_SECTIONS = [
  { key: 'auth', label: 'Authentication', tests: [
    { key: 'auth_login_valid', label: 'Valid user can log in and reach dashboard' },
    { key: 'auth_invite_flow', label: 'Invited user can complete registration via email link' },
    { key: 'auth_deactivated', label: 'Deactivated user is denied access' },
    { key: 'auth_no_company', label: 'User with no company membership sees appropriate error' },
  ]},
  { key: 'company_select', label: 'Company Selection', tests: [
    { key: 'cs_switch_company', label: 'Admin can switch between companies' },
    { key: 'cs_no_active', label: 'No active company selected — UI degrades gracefully without errors' },
    { key: 'cs_data_scoped', label: 'Data from Company A not visible when Company B is selected' },
  ]},
  { key: 'multi_company', label: 'Multi-Company Memberships', tests: [
    { key: 'mc_dual_membership', label: 'User with DH + GSCP membership can switch contexts' },
    { key: 'mc_role_per_company', label: 'Different roles per company enforced correctly' },
    { key: 'mc_cross_company_data', label: 'Cross-company subcontract WO visible to both parties' },
  ]},
  { key: 'field_tech', label: 'Field Technician Assigned-Only Access', tests: [
    { key: 'ft_only_assigned', label: 'Field tech only sees jobs assigned to them' },
    { key: 'ft_no_financials', label: 'Field tech cannot access financial pages' },
    { key: 'ft_no_admin_routes', label: 'Field tech denied on admin-only routes' },
    { key: 'ft_can_clock', label: 'Field tech can clock in/out successfully' },
    { key: 'ft_can_wo', label: 'Field tech can complete work order checklist' },
  ]},
  { key: 'vendor_access', label: 'Vendor Assigned-Only Access', tests: [
    { key: 'va_only_assigned', label: 'Vendor only sees work orders assigned to them' },
    { key: 'va_no_other_jobs', label: 'Vendor cannot navigate to unassigned jobs' },
    { key: 'va_no_employees', label: 'Vendor cannot see employee list or financials' },
  ]},
  { key: 'financial_visibility', label: 'Financial Visibility Restriction', tests: [
    { key: 'fv_flag_off', label: 'Employee with can_view_financials=false cannot see invoice amounts' },
    { key: 'fv_flag_on', label: 'Employee with can_view_financials=true can see invoice totals' },
    { key: 'fv_edit_gate', label: 'Employee with can_edit_financials=false cannot edit financial records' },
  ]},
  { key: 'gscp_workflow', label: 'GSCP Subcontract Workflow', tests: [
    { key: 'gscp_create_wo', label: 'DH admin can create subcontract WO assigned to GSCP' },
    { key: 'gscp_field_update', label: 'GSCP field tech can submit progress notes on their WO' },
    { key: 'gscp_pending_review', label: 'GSCP update is held for Jesus review before DH sees it' },
    { key: 'gscp_dh_blocked', label: 'DH cannot see unapproved GSCP notes' },
    { key: 'gscp_complete_flow', label: 'Full GSCP → Jesus approve → DH sees flow works end-to-end' },
  ]},
  { key: 'jesus_review', label: 'Jesus Review Queue', tests: [
    { key: 'jr_queue_visible', label: 'Jesus can see all pending subcontract notes' },
    { key: 'jr_approve', label: 'Jesus approval makes note visible to DH' },
    { key: 'jr_reject', label: 'Jesus rejection sends note back with reason' },
    { key: 'jr_audit', label: 'Approval/rejection logged in audit trail' },
  ]},
  { key: 'dh_visibility', label: 'Destination Home Visibility After Approval', tests: [
    { key: 'dh_approved_visible', label: 'DH can see GSCP note after Jesus approves it' },
    { key: 'dh_rejected_not_visible', label: 'DH cannot see rejected GSCP notes' },
    { key: 'dh_subcontract_view', label: 'Subcontract view shows correct WO status' },
  ]},
  { key: 'nexus', label: 'Nexus Approval/Rejection', tests: [
    { key: 'nx_submit_field', label: 'Field tech can submit Nexus item from field dashboard' },
    { key: 'nx_inbox_visible', label: 'Nexus reviewer sees item in inbox with priority' },
    { key: 'nx_approve', label: 'Approval updates status and logs audit entry' },
    { key: 'nx_reject', label: 'Rejection with reason updates status and logs audit entry' },
    { key: 'nx_not_reviewer', label: 'Non-reviewer cannot approve/reject Nexus items' },
  ]},
  { key: 'xactimate', label: 'Xactimate Import Safety', tests: [
    { key: 'xact_upload_esx', label: 'ESX file uploads and parses correctly' },
    { key: 'xact_review_before_apply', label: 'Import requires review before creating job' },
    { key: 'xact_reject_bad_file', label: 'Invalid/corrupt file shows error gracefully' },
    { key: 'xact_link_to_job', label: 'Approved import links to correct platform job' },
  ]},
  { key: 'legacy_conversion', label: 'Proven Jobs Legacy Conversion', tests: [
    { key: 'leg_csv_upload', label: 'CSV from Proven Jobs uploads and parses' },
    { key: 'leg_review_records', label: 'All legacy records appear in Legacy Records page' },
    { key: 'leg_convert_to_job', label: 'Converting legacy record creates correct platform job' },
    { key: 'leg_link_customer', label: 'Customer linked or created during conversion' },
    { key: 'leg_cutover_checklist', label: 'Cutover checklist items validate correctly' },
    { key: 'leg_cutover_complete', label: 'Marking cutover complete updates record status' },
  ]},
  { key: 'duplicates', label: 'Duplicate Legacy Record Handling', tests: [
    { key: 'dup_detect_customer', label: 'Duplicate customer name flagged during conversion' },
    { key: 'dup_detect_property', label: 'Duplicate property address flagged during conversion' },
    { key: 'dup_mark_duplicate', label: 'Record can be manually marked as duplicate' },
    { key: 'dup_override', label: 'Admin can override duplicate flag and proceed with conversion' },
  ]},
  { key: 'cutover', label: 'Cutover Workflow', tests: [
    { key: 'cut_prepare', label: 'Cutover preparation checklist validates required fields' },
    { key: 'cut_auto_verify', label: 'Auto-verify correctly passes/fails based on data readiness' },
    { key: 'cut_complete', label: 'Marking cutover_complete updates migration_status correctly' },
    { key: 'cut_audit', label: 'Cutover action logged in audit trail with actor' },
  ]},
  { key: 'demo_data', label: 'Demo Data Creation / Clearing', tests: [
    { key: 'demo_create', label: 'Create Demo Data creates all expected records' },
    { key: 'demo_tagged', label: 'All created records have is_demo: true' },
    { key: 'demo_clear', label: 'Clear Demo Data removes all and only demo records' },
    { key: 'demo_no_real_data', label: 'Clear demo does not remove real data records' },
  ]},
  { key: 'rollout_checklist', label: 'Rollout Checklist Status Changes', tests: [
    { key: 'rc_save', label: 'Checklist saves progress to database correctly' },
    { key: 'rc_history', label: 'History panel shows previous checklists' },
    { key: 'rc_status_transition', label: 'Status transitions (draft → ready → approved) work' },
    { key: 'rc_audit', label: 'Status change logged in audit trail' },
  ]},
  { key: 'feedback_nexus', label: 'Review Feedback → Nexus', tests: [
    { key: 'rfn_submit', label: 'Reviewer can submit feedback from Review Dashboard' },
    { key: 'rfn_triage', label: 'Admin can see and update feedback in triage page' },
    { key: 'rfn_send_nexus', label: 'Sending to Nexus creates pending NexusItem' },
    { key: 'rfn_audit', label: 'Status change and Nexus send logged in audit trail' },
  ]},
  { key: 'mobile_field', label: 'Mobile Field Workflow', tests: [
    { key: 'mob_clock_in', label: 'Clock in/out works on mobile browser' },
    { key: 'mob_wo_checklist', label: 'Work order checklist usable on mobile' },
    { key: 'mob_nexus_submit', label: 'Nexus item submission works on mobile' },
    { key: 'mob_bottom_nav', label: 'Bottom nav correct tabs for field tech role' },
    { key: 'mob_pull_refresh', label: 'Pull-to-refresh updates job list on mobile' },
  ]},
  { key: 'edge_data', label: 'Bad / Missing Data Handling', tests: [
    { key: 'bd_no_company', label: 'Pages with getCurrentCompany() degrade if no company set' },
    { key: 'bd_missing_employee', label: 'Employee with no company membership gets clear error' },
    { key: 'bd_job_no_customer', label: 'Job without customer_id does not crash job hub' },
    { key: 'bd_empty_entities', label: 'Empty list views show empty state, not errors' },
    { key: 'bd_invalid_id', label: 'Navigating to nonexistent record ID shows not-found state' },
  ]},
];

const RESULT_CONFIG = {
  not_tested: { label: 'Not Tested', color: 'bg-muted text-muted-foreground',       icon: Clock },
  pass:       { label: 'Pass',       color: 'bg-green-100 text-green-700',           icon: CheckCircle2 },
  fail:       { label: 'Fail',       color: 'bg-red-100 text-red-700',               icon: XCircle },
  blocked:    { label: 'Blocked',    color: 'bg-orange-100 text-orange-700',         icon: AlertTriangle },
};

const ALL_TEST_KEYS = TEST_SECTIONS.flatMap(s => s.tests.map(t => t.key));
const TOTAL_TESTS = ALL_TEST_KEYS.length;

export default function EdgeCaseTests() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const company = getCurrentCompany();

  const [collapsed, setCollapsed] = useState({});
  const [editingNotes, setEditingNotes] = useState({});
  const [noteValues, setNoteValues] = useState({});

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['edge-case-runs', company?.id],
    queryFn: () => base44.entities.EdgeCaseTestRun.filter({ company_id: company?.id }, '-updated_date', 500),
    enabled: !!company?.id,
  });

  // Build a map: test_key → run record
  const runMap = useMemo(() => {
    const m = {};
    runs.forEach(r => { m[r.test_key] = r; });
    return m;
  }, [runs]);

  const passCount = Object.values(runMap).filter(r => r.result === 'pass').length;
  const failCount = Object.values(runMap).filter(r => r.result === 'fail').length;
  const blockedCount = Object.values(runMap).filter(r => r.result === 'blocked').length;
  const testedCount = passCount + failCount + blockedCount;
  const passRate = testedCount > 0 ? Math.round((passCount / testedCount) * 100) : 0;

  const upsertResult = useMutation({
    mutationFn: async ({ testKey, testName, section, result }) => {
      const existing = runMap[testKey];
      const payload = {
        company_id: company.id, test_key: testKey, test_name: testName,
        section, result,
        last_tested_by: user?.full_name || 'Admin',
        last_tested_at: new Date().toISOString(),
      };
      if (existing) return base44.entities.EdgeCaseTestRun.update(existing.id, payload);
      return base44.entities.EdgeCaseTestRun.create(payload);
    },
    onSuccess: () => qc.invalidateQueries(['edge-case-runs', company?.id]),
  });

  const saveNote = useMutation({
    mutationFn: async ({ testKey, testName, section, notes }) => {
      const existing = runMap[testKey];
      const payload = { company_id: company.id, test_key: testKey, test_name: testName, section, notes };
      if (existing) return base44.entities.EdgeCaseTestRun.update(existing.id, { notes });
      return base44.entities.EdgeCaseTestRun.create(payload);
    },
    onSuccess: (_, { testKey }) => {
      setEditingNotes(prev => ({ ...prev, [testKey]: false }));
      qc.invalidateQueries(['edge-case-runs', company?.id]);
    },
  });

  return (
    <AppLayout title="Edge Case Tests">
      <div className="app-page max-w-4xl space-y-5">

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Edge Case Testing Checklist</h1>
            <p className="app-page-subtitle">Manual pre-rollout test coverage · {testedCount}/{TOTAL_TESTS} tested</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Pass', value: passCount,                   color: 'bg-green-50 border-green-200 text-green-700' },
            { label: 'Fail', value: failCount,                   color: 'bg-red-50 border-red-200 text-red-700' },
            { label: 'Blocked', value: blockedCount,             color: 'bg-orange-50 border-orange-200 text-orange-700' },
            { label: 'Not Tested', value: TOTAL_TESTS - testedCount, color: 'bg-muted border-border text-muted-foreground' },
          ].map(m => (
            <div key={m.label} className={`rounded-xl border p-3 ${m.color}`}>
              <p className="text-2xl font-bold">{m.value}</p>
              <p className="text-xs font-semibold mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>

        {testedCount > 0 && (
          <div className="bg-card border border-border rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Pass Rate (of tested)</span>
              <span className="font-bold text-primary">{passRate}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${passRate}%` }} />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            {TEST_SECTIONS.map(section => {
              const sectionPassed = section.tests.filter(t => runMap[t.key]?.result === 'pass').length;
              const sectionFailed = section.tests.filter(t => runMap[t.key]?.result === 'fail').length;
              const allPass = sectionPassed === section.tests.length;
              const hasFail = sectionFailed > 0;
              const isCollapsed = collapsed[section.key];

              return (
                <div key={section.key} className="bg-card border border-border rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
                    onClick={() => setCollapsed(prev => ({ ...prev, [section.key]: !prev[section.key] }))}>
                    <div className="flex items-center gap-2">
                      {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-sm font-semibold text-foreground">{section.label}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        allPass ? 'bg-green-100 text-green-700'
                        : hasFail ? 'bg-red-100 text-red-700'
                        : 'bg-muted text-muted-foreground'}`}>
                        {sectionPassed}/{section.tests.length}
                      </span>
                    </div>
                    {allPass && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                    {hasFail && !allPass && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                  </button>

                  {!isCollapsed && (
                    <div className="border-t border-border divide-y divide-border/50">
                      {section.tests.map(test => {
                        const run = runMap[test.key];
                        const result = run?.result || 'not_tested';
                        const cfg = RESULT_CONFIG[result];
                        const ResultIcon = cfg.icon;
                        const isEditingNote = editingNotes[test.key];

                        return (
                          <div key={test.key} className="px-4 py-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <ResultIcon className={`w-4 h-4 shrink-0 mt-0.5 ${result === 'pass' ? 'text-green-600' : result === 'fail' ? 'text-red-500' : result === 'blocked' ? 'text-orange-500' : 'text-muted-foreground'}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground">{test.label}</p>
                                {run?.last_tested_by && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {run.last_tested_by} · {run.last_tested_at ? format(new Date(run.last_tested_at), 'MMM d, h:mm a') : '—'}
                                  </p>
                                )}
                                {run?.notes && !isEditingNote && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5 italic">"{run.notes}"</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {(['pass', 'fail', 'blocked', 'not_tested']).map(r => {
                                  const rc = RESULT_CONFIG[r];
                                  return (
                                    <button key={r}
                                      onClick={() => upsertResult.mutate({ testKey: test.key, testName: test.label, section: section.key, result: r })}
                                      className={`h-6 px-2 rounded text-[10px] font-semibold border transition-colors ${
                                        result === r ? rc.color + ' border-transparent' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}>
                                      {rc.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {isEditingNote ? (
                              <div className="flex gap-2 pl-6">
                                <input className="flex-1 h-7 px-2 rounded border border-input bg-card text-xs"
                                  placeholder="Add notes..."
                                  value={noteValues[test.key] ?? (run?.notes || '')}
                                  onChange={e => setNoteValues(prev => ({ ...prev, [test.key]: e.target.value }))} />
                                <button
                                  onClick={() => saveNote.mutate({ testKey: test.key, testName: test.label, section: section.key, notes: noteValues[test.key] ?? '' })}
                                  className="h-7 px-2 rounded border border-primary text-primary text-[10px] font-semibold hover:bg-primary/5">
                                  Save
                                </button>
                                <button onClick={() => setEditingNotes(prev => ({ ...prev, [test.key]: false }))}
                                  className="h-7 px-2 rounded border border-border text-muted-foreground text-[10px] hover:bg-muted">
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button className="pl-6 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => { setNoteValues(prev => ({ ...prev, [test.key]: run?.notes || '' })); setEditingNotes(prev => ({ ...prev, [test.key]: true })); }}>
                                {run?.notes ? 'Edit note' : '+ Add note'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="pb-8" />
      </div>
    </AppLayout>
  );
}