import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { CheckSquare, Square, ChevronDown, ChevronRight } from 'lucide-react';

const STORAGE_KEY = 'rollout_checklist_v1';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function save(d) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {}
}

const SECTIONS = [
  {
    key: 'data_migration',
    label: 'Data Migration',
    items: [
      { key: 'dm_export_proven_jobs', label: 'Export all jobs from Proven Jobs (CSV)' },
      { key: 'dm_upload_csv', label: 'Upload CSV to Legacy Imports' },
      { key: 'dm_review_records', label: 'Review all imported records in Legacy Records' },
      { key: 'dm_resolve_duplicates', label: 'Resolve any flagged duplicate records' },
      { key: 'dm_convert_active', label: 'Convert all active jobs to platform' },
      { key: 'dm_link_customers', label: 'Link or create Customer records for active jobs' },
      { key: 'dm_link_properties', label: 'Link or create Property records for active jobs' },
      { key: 'dm_verify_documents', label: 'Verify documents and notes are attached' },
    ],
  },
  {
    key: 'active_jobs',
    label: 'Active Job Selection',
    items: [
      { key: 'aj_identify', label: 'Identify all currently active jobs in Proven Jobs' },
      { key: 'aj_prioritize', label: 'Prioritize by stage (active field vs. waiting)' },
      { key: 'aj_create_platform', label: 'Create all active jobs in new platform' },
      { key: 'aj_assign_team', label: 'Assign team members to each active job' },
      { key: 'aj_verify_scope', label: 'Verify scope and work orders are accurate' },
    ],
  },
  {
    key: 'employee_access',
    label: 'Employee Access Setup',
    items: [
      { key: 'ea_list_employees', label: 'Compile full employee list with roles' },
      { key: 'ea_invite_admins', label: 'Invite admin/operations team first' },
      { key: 'ea_invite_field', label: 'Invite all field technicians' },
      { key: 'ea_invite_gscp', label: 'Invite GSCP team (Jesus + field)' },
      { key: 'ea_verify_logins', label: 'Verify each person can log in successfully' },
    ],
  },
  {
    key: 'permission_review',
    label: 'Permission Review',
    items: [
      { key: 'pr_assign_roles', label: 'Assign correct permission groups per employee' },
      { key: 'pr_financial_flags', label: 'Set financial visibility flags for appropriate staff' },
      { key: 'pr_vendor_scoping', label: 'Confirm vendor/GSCP scoping is correct' },
      { key: 'pr_test_access', label: 'Test access as a field tech (not admin)' },
      { key: 'pr_test_gscp', label: 'Test GSCP field dashboard and review queue' },
    ],
  },
  {
    key: 'proven_jobs_export',
    label: 'Proven Jobs Export',
    items: [
      { key: 'pj_checklist_complete', label: 'Complete Proven Jobs Export Checklist' },
      { key: 'pj_all_sections', label: 'All 11 checklist sections marked complete' },
      { key: 'pj_missing_items', label: 'Document anything that cannot be exported' },
      { key: 'pj_photos_downloaded', label: 'Job photos downloaded and organized' },
      { key: 'pj_documents_saved', label: 'Contracts, permits, compliance docs saved' },
    ],
  },
  {
    key: 'xactimate',
    label: 'Xactimate Workflow',
    items: [
      { key: 'xact_confirm_workflow', label: 'Confirm Xactimate remains external (paid tool)' },
      { key: 'xact_esx_import_tested', label: 'Test ESX file import with a real file' },
      { key: 'xact_job_link', label: 'Verify Xactimate import links to correct platform job' },
    ],
  },
  {
    key: 'field_training',
    label: 'Field Team Training',
    items: [
      { key: 'ft_time_clock', label: 'Train field techs on time clock (clock in/out)' },
      { key: 'ft_work_orders', label: 'Train on completing work order checklists' },
      { key: 'ft_daily_logs', label: 'Train on daily log / progress note entry' },
      { key: 'ft_restoration', label: 'Train restoration techs on moisture/drying forms' },
      { key: 'ft_nexus', label: 'Train on submitting Nexus items from field' },
      { key: 'ft_mobile_test', label: 'Verify all training on mobile device' },
    ],
  },
  {
    key: 'jesus_workflow',
    label: 'Jesus Review Workflow',
    items: [
      { key: 'jw_account', label: 'Jesus has active account with correct permissions' },
      { key: 'jw_review_queue', label: 'Jesus tested subcontract review queue' },
      { key: 'jw_approve_flow', label: 'Approval flow tested end-to-end (GSCP → Jesus → DH)' },
      { key: 'jw_nexus', label: 'Jesus familiar with Nexus approval process' },
    ],
  },
  {
    key: 'nick_review',
    label: 'Nick Review',
    items: [
      { key: 'nr_review_dashboard', label: 'Nick reviewed Review Dashboard page' },
      { key: 'nr_replacement_map', label: 'Nick reviewed Replacement Map (PJ vs BT vs platform)' },
      { key: 'nr_limitations', label: 'Nick reviewed Known Limitations page' },
      { key: 'nr_feedback', label: 'Nick submitted feedback in Review Dashboard' },
      { key: 'nr_questions_addressed', label: 'All Nick questions answered and documented' },
      { key: 'nr_go_no_go', label: 'Nick gives go/no-go decision on rollout' },
    ],
  },
  {
    key: 'parallel_run',
    label: 'Parallel Run Period',
    items: [
      { key: 'par_start_date', label: 'Agree on parallel run start date' },
      { key: 'par_duration', label: 'Agree on parallel run duration (recommended: 2 weeks)' },
      { key: 'par_proven_still_open', label: 'Proven Jobs kept open during parallel run' },
      { key: 'par_platform_primary', label: 'Platform treated as primary for new entries' },
      { key: 'par_discrepancies', label: 'Document any data discrepancies found during parallel run' },
      { key: 'par_feedback_collected', label: 'Collect field team feedback during parallel run' },
    ],
  },
  {
    key: 'cutover_decision',
    label: 'Cutover Decision',
    items: [
      { key: 'cd_all_jobs_migrated', label: 'All active jobs migrated and verified' },
      { key: 'cd_all_employees_active', label: 'All employees have working platform accounts' },
      { key: 'cd_proven_jobs_archive', label: 'Proven Jobs set to read-only / archived mode' },
      { key: 'cd_nick_approval', label: 'Nick formally approves cutover' },
      { key: 'cd_cutover_date', label: 'Cutover date communicated to all staff' },
      { key: 'cd_proven_jobs_decommission', label: 'Proven Jobs decommission timeline agreed' },
    ],
  },
];

const TOTAL = SECTIONS.reduce((s, sec) => s + sec.items.length, 0);

export default function RolloutChecklist() {
  const [checked, setChecked] = useState(load);
  const [collapsed, setCollapsed] = useState({});

  const toggle = (key) => {
    setChecked(prev => {
      const next = { ...prev, [key]: !prev[key] };
      save(next);
      return next;
    });
  };

  const checkedCount = Object.values(checked).filter(Boolean).length;
  const pct = Math.round((checkedCount / TOTAL) * 100);

  return (
    <AppLayout title="Rollout Checklist">
      <div className="app-page max-w-3xl space-y-5">

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Rollout Checklist</h1>
            <p className="app-page-subtitle">Step-by-step preparation for full production go-live</p>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="font-bold text-primary">{checkedCount} / {TOTAL} ({pct}%)</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Section progress summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SECTIONS.map(sec => {
            const done = sec.items.filter(i => checked[i.key]).length;
            const complete = done === sec.items.length;
            return (
              <div key={sec.key} className={`rounded-xl border px-3 py-2 ${complete ? 'bg-green-50 border-green-200' : 'bg-card border-border'}`}>
                <p className="text-[11px] font-semibold text-foreground truncate">{sec.label}</p>
                <p className={`text-xs font-bold mt-0.5 ${complete ? 'text-green-600' : 'text-muted-foreground'}`}>{done}/{sec.items.length}</p>
              </div>
            );
          })}
        </div>

        {/* Sections */}
        {SECTIONS.map(section => {
          const done = section.items.filter(i => checked[i.key]).length;
          const isCollapsed = collapsed[section.key];
          return (
            <div key={section.key} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                onClick={() => setCollapsed(prev => ({ ...prev, [section.key]: !prev[section.key] }))}>
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  <span className="text-sm font-semibold">{section.label}</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    done === section.items.length ? 'bg-green-100 text-green-700'
                    : done > 0 ? 'bg-blue-100 text-blue-700'
                    : 'bg-muted text-muted-foreground'}`}>
                    {done}/{section.items.length}
                  </span>
                </div>
                {done === section.items.length && <CheckSquare className="w-4 h-4 text-green-600 shrink-0" />}
              </button>
              {!isCollapsed && (
                <div className="border-t border-border divide-y divide-border/60">
                  {section.items.map(item => (
                    <button key={item.key} type="button" onClick={() => toggle(item.key)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 text-left transition-colors">
                      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                        checked[item.key] ? 'bg-primary border-primary text-white' : 'border-input bg-card'}`}>
                        {checked[item.key] && <CheckSquare className="w-3.5 h-3.5" />}
                      </div>
                      <span className={`text-sm ${checked[item.key] ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="pb-8" />
      </div>
    </AppLayout>
  );
}