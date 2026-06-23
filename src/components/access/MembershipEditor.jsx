/**
 * MembershipEditor — full-featured sheet for creating or editing a CompanyMembership.
 * Covers: company, employee, role, permission group, individual permission toggles,
 * reviewer assignment, financial visibility, and active status.
 */
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Loader2, DollarSign, Shield, Eye, CheckCircle2 } from 'lucide-react';
import { PERMISSION_GROUPS, ROLE_TO_PERMISSION_GROUP } from '@/lib/permissions';
import { toast } from 'sonner';

const ROLES = [
  'owner','operations_admin','estimator','field_technician',
  'office_support','vendor','nexus_reviewer',
];

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-primary' : 'bg-muted'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

export default function MembershipEditor({ initial = {}, companies = [], employees = [], onClose, onSaved }) {
  const isEdit = !!initial.id;

  const [form, setForm] = useState({
    company_id: initial.company_id || '',
    company_name: initial.company_name || '',
    company_slug: initial.company_slug || '',
    employee_id: initial.employee_id || '',
    employee_name: initial.employee_name || '',
    role: initial.role || 'field_technician',
    permission_group: initial.permission_group || '',
    is_active: initial.is_active !== false,
    can_view_financials: initial.can_view_financials || false,
    can_edit_financials: initial.can_edit_financials || false,
    can_approve_nexus: initial.can_approve_nexus || false,
    can_review_subcontract_notes: initial.can_review_subcontract_notes || false,
    can_manage_users: initial.can_manage_users || false,
    can_view_assigned_only: initial.can_view_assigned_only || false,
    reviewer_assignment: initial.reviewer_assignment || '',
    notes: initial.notes || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleRoleChange = (role) => {
    const defaultGroup = ROLE_TO_PERMISSION_GROUP[role] || role;
    const groupDef = PERMISSION_GROUPS.find(g => g.value === defaultGroup);
    set('role', role);
    if (!form.permission_group) {
      set('permission_group', defaultGroup);
    }
    if (groupDef) {
      set('can_view_financials', groupDef.defaultFinancialView || false);
      set('can_edit_financials', groupDef.defaultFinancialEdit || false);
      set('can_manage_users', groupDef.defaultManageUsers || false);
      set('can_review_subcontract_notes', groupDef.defaultReviewSubcontract || false);
    }
  };

  const handleGroupChange = (group) => {
    const groupDef = PERMISSION_GROUPS.find(g => g.value === group);
    set('permission_group', group);
    if (groupDef) {
      set('can_view_financials', groupDef.defaultFinancialView || false);
      set('can_edit_financials', groupDef.defaultFinancialEdit || false);
      set('can_manage_users', groupDef.defaultManageUsers || false);
      set('can_review_subcontract_notes', groupDef.defaultReviewSubcontract || false);
    }
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.company_id || !form.employee_id) {
      toast.error('Company and employee are required.');
      return;
    }
    setSaving(true);
    const company = companies.find(c => c.id === form.company_id);
    const employee = employees.find(e => e.id === form.employee_id);
    const payload = {
      ...form,
      company_name: company?.name || form.company_name,
      company_slug: company?.slug || form.company_slug,
      employee_name: employee?.name || form.employee_name,
    };
    if (isEdit) {
      await base44.entities.CompanyMembership.update(initial.id, payload);
      toast.success('Membership updated');
    } else {
      await base44.entities.CompanyMembership.create(payload);
      toast.success('Member added');
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:px-4">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-base">{isEdit ? 'Edit Member' : 'Add Member'}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Company */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company</label>
            <select
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={form.company_id}
              onChange={e => {
                const c = companies.find(c => c.id === e.target.value);
                set('company_id', e.target.value);
                set('company_name', c?.name || '');
                set('company_slug', c?.slug || '');
              }}
            >
              <option value="">— Select Company —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Employee */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employee</label>
            <select
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={form.employee_id}
              onChange={e => {
                const emp = employees.find(emp => emp.id === e.target.value);
                set('employee_id', e.target.value);
                set('employee_name', emp?.name || '');
              }}
            >
              <option value="">— Select Employee —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          {/* Role + Permission Group */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</label>
              <select
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={form.role}
                onChange={e => handleRoleChange(e.target.value)}
              >
                {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Permission Group</label>
              <select
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={form.permission_group}
                onChange={e => handleGroupChange(e.target.value)}
              >
                <option value="">— Select Group —</option>
                {PERMISSION_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
          </div>

          {/* Reviewer assignment */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reviewer Assignment</label>
            <input
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              placeholder="e.g. GSCP Subcontract Notes, Nexus Category…"
              value={form.reviewer_assignment}
              onChange={e => set('reviewer_assignment', e.target.value)}
            />
          </div>

          {/* Permission Toggles */}
          <div className="space-y-3 border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Permission Overrides
            </p>

            <Toggle
              label="View Financials"
              description="Invoice amounts, estimate totals, claim values, payment status"
              checked={form.can_view_financials || form.can_edit_financials}
              onChange={v => { set('can_view_financials', v); if (!v) set('can_edit_financials', false); }}
            />
            {(form.can_view_financials || form.can_edit_financials) && (
              <div className="ml-12">
                <Toggle
                  label="Edit Financials"
                  description="Can create/update invoices, estimates, payments"
                  checked={form.can_edit_financials}
                  onChange={v => set('can_edit_financials', v)}
                />
              </div>
            )}

            <Toggle
              label="Approve Nexus Items"
              description="Can approve or reject items in the Nexus inbox"
              checked={form.can_approve_nexus}
              onChange={v => set('can_approve_nexus', v)}
            />

            <Toggle
              label="Review Subcontract Notes"
              description="Can review GSCP field updates before DH sees them (Jesus Reviewer)"
              checked={form.can_review_subcontract_notes}
              onChange={v => set('can_review_subcontract_notes', v)}
            />

            <Toggle
              label="Manage Users"
              description="Can add/edit/deactivate members within this company"
              checked={form.can_manage_users}
              onChange={v => set('can_manage_users', v)}
            />

            <Toggle
              label="Assigned-Only View"
              description="Restrict to only records explicitly assigned to this user"
              checked={form.can_view_assigned_only}
              onChange={v => set('can_view_assigned_only', v)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
            <textarea
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none h-16"
              placeholder="Internal notes about this membership…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          {/* Active status */}
          {isEdit && (
            <Toggle
              label="Active Membership"
              description="Deactivating removes all access immediately"
              checked={form.is_active}
              onChange={v => set('is_active', v)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border px-5 py-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving || !form.company_id || !form.employee_id}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save Changes' : 'Add Member'}
          </Button>
        </div>
      </div>
    </div>
  );
}