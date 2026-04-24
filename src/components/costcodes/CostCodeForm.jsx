import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const CATEGORIES = [
  { value: 'labor',            label: 'Labor' },
  { value: 'materials',        label: 'Materials' },
  { value: 'equipment',        label: 'Equipment' },
  { value: 'subcontractor',    label: 'Subcontractor' },
  { value: 'overhead',         label: 'Overhead' },
  { value: 'administrative',   label: 'Administrative' },
  { value: 'permit_inspection',label: 'Permit / Inspection' },
  { value: 'travel',           label: 'Travel' },
  { value: 'disposal_cleanup', label: 'Disposal / Cleanup' },
  { value: 'miscellaneous',    label: 'Miscellaneous' },
  { value: 'revenue_billing',  label: 'Revenue / Billing' },
  { value: 'other',            label: 'Other' },
];

const CODE_TYPES = [
  { value: 'expense',             label: 'Expense' },
  { value: 'billable',            label: 'Billable' },
  { value: 'non_billable',        label: 'Non-Billable' },
  { value: 'revenue',             label: 'Revenue' },
  { value: 'labor',               label: 'Labor' },
  { value: 'material',            label: 'Material' },
  { value: 'time',                label: 'Time' },
  { value: 'vendor_charge',       label: 'Vendor Charge' },
  { value: 'subcontractor_charge',label: 'Subcontractor Charge' },
  { value: 'internal_only',       label: 'Internal Only' },
];

const ACCT_CATEGORIES = [
  { value: 'direct_labor',        label: 'Direct Labor' },
  { value: 'direct_materials',    label: 'Direct Materials' },
  { value: 'subcontracted_labor', label: 'Subcontracted Labor' },
  { value: 'office_overhead',     label: 'Office Overhead' },
  { value: 'job_supplies',        label: 'Job Supplies' },
  { value: 'travel_expense',      label: 'Travel Expense' },
  { value: 'equipment_rental',    label: 'Equipment Rental' },
  { value: 'disposal',            label: 'Disposal' },
  { value: 'permit_fees',         label: 'Permit Fees' },
  { value: 'revenue',             label: 'Revenue' },
  { value: 'warranty_work',       label: 'Warranty Work' },
  { value: 'non_billable_internal', label: 'Non-Billable Internal' },
  { value: 'other',               label: 'Other' },
];

const DIRECTIONS = [
  { value: 'expense_only', label: 'Expense Only' },
  { value: 'revenue_only', label: 'Revenue Only' },
  { value: 'both',         label: 'Both' },
  { value: 'internal_only',label: 'Internal Only' },
];

const QB_DIRECTIONS = [
  { value: 'expense',        label: 'Expense' },
  { value: 'income',         label: 'Income' },
  { value: 'both',           label: 'Both' },
  { value: 'not_applicable', label: 'Not Applicable' },
];

const RECORD_TYPE_OPTIONS = [
  { value: 'expense',    label: 'Expense' },
  { value: 'bill',       label: 'Bill' },
  { value: 'invoice',    label: 'Invoice' },
  { value: 'estimate',   label: 'Estimate' },
  { value: 'time_entry', label: 'Time Entry' },
  { value: 'job',        label: 'Job / Project Default' },
];

const DEFAULT = {
  code_number: '',
  name: '',
  description: '',
  status: 'active',
  category: 'labor',
  subcategory: '',
  code_type: 'expense',
  allowed_on: '["expense","bill","estimate"]',
  internal_accounting_category: 'direct_labor',
  accounting_direction: 'expense_only',
  default_usage_notes: '',
  qb_account_name: '',
  qb_income_account: '',
  qb_item_name: '',
  qb_class_name: '',
  qb_location_name: '',
  qb_direction: 'expense',
  default_taxable: false,
  export_eligible: true,
  default_vendor_name: '',
  default_rate: '',
  labor_category: '',
  requires_memo: false,
  requires_vendor: false,
  requires_employee: false,
  requires_approval: false,
  requires_attachment: false,
  display_order: 0,
};

function CheckRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} className="rounded h-4 w-4" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </label>
  );
}

function SectionHeader({ title, open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 border-b border-border"
    >
      <p className="text-xs font-semibold text-foreground">{title}</p>
      {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );
}

export default function CostCodeForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ ...DEFAULT, ...initial });
  const [openSections, setOpenSections] = useState({ identity: true, classification: true, accounting: false, qb: false, rules: false });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleSection = (k) => setOpenSections(s => ({ ...s, [k]: !s[k] }));

  // allowed_on as array state
  const allowedOn = (() => {
    try { return JSON.parse(form.allowed_on || '[]'); } catch { return []; }
  })();
  const toggleAllowed = (rt) => {
    const next = allowedOn.includes(rt) ? allowedOn.filter(x => x !== rt) : [...allowedOn, rt];
    set('allowed_on', JSON.stringify(next));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const out = { ...form };
    if (out.default_rate !== '') out.default_rate = Number(out.default_rate);
    else delete out.default_rate;
    if (out.display_order !== '') out.display_order = Number(out.display_order);
    onSave(out);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── IDENTITY ── */}
      <div>
        <SectionHeader title="Identity" open={openSections.identity} onToggle={() => toggleSection('identity')} />
        {openSections.identity && (
          <div className="pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Code Number *</p>
                <Input value={form.code_number} onChange={e => set('code_number', e.target.value)} placeholder="e.g. 1001" className="h-9 rounded-lg text-sm" required />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Name *</p>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Painting Labor" className="h-9 rounded-lg text-sm" required />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional description…" className="rounded-lg text-sm min-h-16 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Display Order</p>
                <Input type="number" value={form.display_order} onChange={e => set('display_order', e.target.value)} placeholder="0" className="h-9 rounded-lg text-sm" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Subcategory</p>
                <Input value={form.subcategory} onChange={e => set('subcategory', e.target.value)} placeholder="Optional" className="h-9 rounded-lg text-sm" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── CLASSIFICATION ── */}
      <div>
        <SectionHeader title="Classification" open={openSections.classification} onToggle={() => toggleSection('classification')} />
        {openSections.classification && (
          <div className="pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Category</p>
                <Select value={form.category} onValueChange={v => set('category', v)}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Code Type</p>
                <Select value={form.code_type} onValueChange={v => set('code_type', v)}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CODE_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Allowed Record Types</p>
              <div className="grid grid-cols-2 gap-1.5">
                {RECORD_TYPE_OPTIONS.map(rt => (
                  <label key={rt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowedOn.includes(rt.value)}
                      onChange={() => toggleAllowed(rt.value)}
                      className="rounded h-4 w-4"
                    />
                    <span className="text-xs text-foreground">{rt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Default Usage Notes</p>
              <Input value={form.default_usage_notes} onChange={e => set('default_usage_notes', e.target.value)} placeholder="Optional notes about when to use this code" className="h-9 rounded-lg text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* ── ACCOUNTING / INTERNAL ── */}
      <div>
        <SectionHeader title="Internal Accounting" open={openSections.accounting} onToggle={() => toggleSection('accounting')} />
        {openSections.accounting && (
          <div className="pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Accounting Category</p>
                <Select value={form.internal_accounting_category} onValueChange={v => set('internal_accounting_category', v)}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCT_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Accounting Direction</p>
                <Select value={form.accounting_direction} onValueChange={v => set('accounting_direction', v)}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIRECTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Default Vendor</p>
                <Input value={form.default_vendor_name} onChange={e => set('default_vendor_name', e.target.value)} placeholder="Optional" className="h-9 rounded-lg text-sm" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Default Rate</p>
                <Input type="number" value={form.default_rate} onChange={e => set('default_rate', e.target.value)} placeholder="e.g. 85.00" className="h-9 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Labor Category</p>
              <Input value={form.labor_category} onChange={e => set('labor_category', e.target.value)} placeholder="e.g. Painting, Drywall, Carpentry…" className="h-9 rounded-lg text-sm" />
            </div>
            <div className="flex gap-4 pt-1">
              <CheckRow label="Default Taxable" checked={form.default_taxable} onChange={v => set('default_taxable', v)} />
              <CheckRow label="Export Eligible" checked={form.export_eligible} onChange={v => set('export_eligible', v)} />
            </div>
          </div>
        )}
      </div>

      {/* ── QB MAPPING ── */}
      <div>
        <SectionHeader title="QuickBooks Mapping (Future)" open={openSections.qb} onToggle={() => toggleSection('qb')} />
        {openSections.qb && (
          <div className="pt-3 space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <p className="text-xs text-amber-700">These fields are placeholders for future QuickBooks Online sync. Populate now so mapping is ready when integration is activated.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">QB Expense Account</p>
                <Input value={form.qb_account_name} onChange={e => set('qb_account_name', e.target.value)} placeholder="e.g. Cost of Goods Sold" className="h-9 rounded-lg text-sm" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">QB Income Account</p>
                <Input value={form.qb_income_account} onChange={e => set('qb_income_account', e.target.value)} placeholder="e.g. Sales of Product Income" className="h-9 rounded-lg text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">QB Product/Service Item</p>
                <Input value={form.qb_item_name} onChange={e => set('qb_item_name', e.target.value)} placeholder="e.g. Painting Labor" className="h-9 rounded-lg text-sm" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">QB Direction</p>
                <Select value={form.qb_direction} onValueChange={v => set('qb_direction', v)}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QB_DIRECTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">QB Class</p>
                <Input value={form.qb_class_name} onChange={e => set('qb_class_name', e.target.value)} placeholder="e.g. Operations" className="h-9 rounded-lg text-sm" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">QB Location</p>
                <Input value={form.qb_location_name} onChange={e => set('qb_location_name', e.target.value)} placeholder="e.g. Myrtle Beach" className="h-9 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">QB Vendor Mapping</p>
              <Input value={form.qb_vendor_mapping} onChange={e => set('qb_vendor_mapping', e.target.value)} placeholder="Optional default QB vendor mapping" className="h-9 rounded-lg text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* ── VALIDATION RULES ── */}
      <div>
        <SectionHeader title="Validation Rules" open={openSections.rules} onToggle={() => toggleSection('rules')} />
        {openSections.rules && (
          <div className="pt-3 space-y-2">
            <CheckRow label="Requires memo on linked records" checked={form.requires_memo} onChange={v => set('requires_memo', v)} />
            <CheckRow label="Requires vendor selection" checked={form.requires_vendor} onChange={v => set('requires_vendor', v)} />
            <CheckRow label="Requires employee selection" checked={form.requires_employee} onChange={v => set('requires_employee', v)} />
            <CheckRow label="Requires approval before export" checked={form.requires_approval} onChange={v => set('requires_approval', v)} />
            <CheckRow label="Requires attachment / receipt" checked={form.requires_attachment} onChange={v => set('requires_attachment', v)} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1 h-11 rounded-xl" disabled={saving}>
          {saving ? 'Saving…' : initial?.id ? 'Save Changes' : 'Create Cost Code'}
        </Button>
      </div>
    </form>
  );
}