import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getCurrentCompany } from '@/lib/permissions';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { CheckSquare, Square, Save, Loader2, ChevronDown, ChevronRight, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const CHECKLIST_SECTIONS = [
  {
    key: 'customers',
    label: 'Customers',
    items: [
      { key: 'customer_list_exported', label: 'Customer list exported (name, phone, email, address)' },
      { key: 'customer_history_notes', label: 'Customer history / relationship notes captured' },
      { key: 'customer_contact_prefs', label: 'Contact preferences noted' },
    ],
  },
  {
    key: 'properties',
    label: 'Properties',
    items: [
      { key: 'property_addresses', label: 'All property addresses exported' },
      { key: 'property_linked_customers', label: 'Properties linked to customers' },
      { key: 'property_access_notes', label: 'Property access notes / gate codes captured' },
    ],
  },
  {
    key: 'active_jobs',
    label: 'Active Jobs',
    items: [
      { key: 'active_jobs_list', label: 'Active job list exported' },
      { key: 'active_jobs_status', label: 'Current status of each active job documented' },
      { key: 'active_jobs_assigned', label: 'Assigned team members documented per job' },
      { key: 'active_jobs_next_steps', label: 'Next steps / open work documented' },
      { key: 'active_jobs_photos', label: 'In-progress photos exported' },
    ],
  },
  {
    key: 'closed_jobs',
    label: 'Closed Jobs',
    items: [
      { key: 'closed_jobs_list', label: 'Closed job list exported' },
      { key: 'closed_jobs_dates', label: 'Completion dates captured' },
      { key: 'closed_jobs_financials', label: 'Final financial amounts noted (if permitted)' },
    ],
  },
  {
    key: 'notes',
    label: 'Notes',
    items: [
      { key: 'notes_all_exported', label: 'All job notes exported' },
      { key: 'notes_authors_timestamps', label: 'Note authors and timestamps preserved' },
      { key: 'notes_customer_visible', label: 'Customer-visible notes flagged separately' },
    ],
  },
  {
    key: 'photos',
    label: 'Photos',
    items: [
      { key: 'photos_before', label: 'Before photos exported' },
      { key: 'photos_during', label: 'During / progress photos exported' },
      { key: 'photos_after', label: 'After / completion photos exported' },
      { key: 'photos_labeled', label: 'Photos labeled by job / room / date' },
    ],
  },
  {
    key: 'documents',
    label: 'Documents',
    items: [
      { key: 'docs_contracts', label: 'Signed contracts / agreements exported' },
      { key: 'docs_permits', label: 'Permits exported' },
      { key: 'docs_warranty', label: 'Warranty documents exported' },
      { key: 'docs_compliance', label: 'Compliance / insurance documents exported' },
    ],
  },
  {
    key: 'work_orders',
    label: 'Work Orders',
    items: [
      { key: 'wo_open', label: 'Open work orders exported' },
      { key: 'wo_completed', label: 'Completed work orders exported' },
      { key: 'wo_assigned', label: 'Assigned personnel per work order noted' },
    ],
  },
  {
    key: 'estimates',
    label: 'Estimates',
    items: [
      { key: 'estimates_pending', label: 'Pending estimates exported' },
      { key: 'estimates_approved', label: 'Approved estimate amounts noted' },
      { key: 'estimates_declined', label: 'Declined estimates noted' },
    ],
  },
  {
    key: 'invoices',
    label: 'Invoices (if permitted)',
    items: [
      { key: 'invoices_open', label: 'Open invoices and balances exported' },
      { key: 'invoices_paid', label: 'Paid invoice history exported' },
      { key: 'invoices_disputes', label: 'Disputed or partial invoices flagged' },
    ],
  },
  {
    key: 'users',
    label: 'User / Employee List',
    items: [
      { key: 'users_employee_list', label: 'Employee list exported (name, role, contact)' },
      { key: 'users_roles_mapped', label: 'Roles mapped to new platform roles' },
      { key: 'users_inactive', label: 'Inactive users noted (do not re-invite)' },
    ],
  },
];

const STORAGE_KEY = 'proven_jobs_checklist';

function loadChecklist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveChecklist(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

export default function ProvenJobsChecklist() {
  const { user } = useAuth();
  const company = getCurrentCompany();
  const [checked, setChecked] = useState(loadChecklist);
  const [meta, setMeta] = useState({
    export_date: '',
    exported_by: user?.full_name || '',
    files_received: '',
    notes: '',
    missing_items: '',
    next_action: '',
  });
  const [collapsed, setCollapsed] = useState({});
  const [saved, setSaved] = useState(false);

  const toggle = (key) => {
    setChecked(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveChecklist(next);
      return next;
    });
  };

  const totalItems = CHECKLIST_SECTIONS.reduce((s, sec) => s + sec.items.length, 0);
  const checkedItems = Object.values(checked).filter(Boolean).length;
  const pct = Math.round((checkedItems / totalItems) * 100);

  const toggleSection = (key) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSave = () => {
    saveChecklist(checked);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AppLayout title="Proven Jobs Export Checklist">
      <div className="app-page max-w-3xl space-y-5">

        {/* Header */}
        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Proven Jobs Export Checklist</h1>
            <p className="app-page-subtitle">Ensure all data is captured before decommissioning Proven Jobs</p>
          </div>
          <Button size="sm" onClick={handleSave}>
            {saved ? <><CheckSquare className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> Save Progress</>}
          </Button>
        </div>

        {/* Progress */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Checklist Progress</span>
            <span className="font-bold text-primary">{checkedItems} / {totalItems} ({pct}%)</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Meta fields */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Export Record</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'export_date', label: 'Export Date', type: 'date' },
              { key: 'exported_by', label: 'Exported By', type: 'text' },
              { key: 'files_received', label: 'Files Received', type: 'text', placeholder: 'e.g. jobs.csv, photos.zip' },
              { key: 'next_action', label: 'Next Action', type: 'text', placeholder: 'e.g. Upload to Legacy Imports' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
                <input
                  type={type}
                  className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm"
                  value={meta[key]}
                  placeholder={placeholder}
                  onChange={e => setMeta(m => ({ ...m, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Missing Items</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-input bg-card text-sm resize-none"
              rows={2}
              placeholder="List anything you could not export or that was unavailable..."
              value={meta.missing_items}
              onChange={e => setMeta(m => ({ ...m, missing_items: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-input bg-card text-sm resize-none"
              rows={2}
              placeholder="General notes about the export process..."
              value={meta.notes}
              onChange={e => setMeta(m => ({ ...m, notes: e.target.value }))}
            />
          </div>
        </div>

        {/* Checklist sections */}
        {CHECKLIST_SECTIONS.map(section => {
          const sectionChecked = section.items.filter(i => checked[i.key]).length;
          const isCollapsed = collapsed[section.key];
          return (
            <div key={section.key} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                onClick={() => toggleSection(section.key)}
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  <span className="text-sm font-semibold text-foreground">{section.label}</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    sectionChecked === section.items.length
                      ? 'bg-green-100 text-green-700'
                      : sectionChecked > 0
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {sectionChecked}/{section.items.length}
                  </span>
                </div>
                {sectionChecked === section.items.length && (
                  <CheckSquare className="w-4 h-4 text-green-600 shrink-0" />
                )}
              </button>
              {!isCollapsed && (
                <div className="border-t border-border divide-y divide-border/60">
                  {section.items.map(item => (
                    <label
                      key={item.key}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 cursor-pointer"
                    >
                      <button
                        type="button"
                        onClick={() => toggle(item.key)}
                        className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                          checked[item.key]
                            ? 'bg-primary border-primary text-white'
                            : 'border-input bg-card'
                        }`}
                      >
                        {checked[item.key] && <CheckSquare className="w-3.5 h-3.5" />}
                      </button>
                      <span className={`text-sm ${checked[item.key] ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Bottom save */}
        <div className="flex justify-end pb-8">
          <Button onClick={handleSave}>
            {saved ? 'Saved!' : 'Save Progress'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}