import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  ArrowLeft, Briefcase, Loader2, User, Building2, Users,
  Settings2, CheckCircle2, Plus, X, Bell, BellOff, Search, ExternalLink, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';
import { JOB_GROUP_CONFIG, JOB_LIFECYCLE_CONFIG } from '@/lib/jobHelpers';
import { validateJob } from '@/lib/validation';
import ValidationPanel from '@/components/shared/ValidationPanel';
import { getInternalRole, isAdmin as getIsAdmin } from '@/lib/adminAuth';
import { audit } from '@/lib/audit';
import AppLayout from '../components/AppLayout';

const JOB_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706',
  '#7c3aed', '#0891b2', '#be185d', '#374151',
];

const ROLE_OPTIONS = [
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'lead', label: 'Lead' },
  { value: 'crew', label: 'Crew' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'estimator', label: 'Estimator' },
  { value: 'other', label: 'Other' },
];

const TABS = [
  { key: 'details',   label: 'Job Details',     icon: Briefcase },
  { key: 'clients',   label: 'Clients',          icon: User },
  { key: 'team',      label: 'Internal Users',   icon: Users },
  { key: 'vendors',   label: 'Subs / Vendors',   icon: Building2 },
  { key: 'advanced',  label: 'Advanced',         icon: Settings2 },
];

const EMPTY_FORM = {
  title: '', address: '', city: '', state: '', zip: '',
  customer_name: '', customer_phone: '', customer_email: '', billing_address: '',
  description: '', internal_notes: '', vendor_notes: '',
  price: '', color: JOB_COLORS[0],
  status: 'pending', lifecycle_status: 'open', job_group: 'painting',
  job_type: '',
  start_date: '', actual_start_date: '', end_date: '', actual_end_date: '',
  work_days: '', square_footage: '', permit_number: '', lot_info: '',
  assigned_to: '', buildertrend_id: '',
};

// ── Searchable dropdown helper ──────────────────────────────────
function SearchableSelect({ placeholder, items, labelKey, onSelect, onCreate, createLabel }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const ref = useRef(null);

  const filtered = useMemo(() => {
    if (!q) return items.slice(0, 20);
    return items.filter(i => (i[labelKey] || '').toLowerCase().includes(q.toLowerCase())).slice(0, 20);
  }, [items, q, labelKey]);

  const choose = (item) => {
    setSelected(item);
    setQ(item[labelKey] || '');
    setOpen(false);
    onSelect(item);
  };

  const clear = () => { setSelected(null); setQ(''); onSelect(null); };

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); setSelected(null); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full h-9 pl-8 pr-8 rounded-xl border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {q && <button type="button" onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
      </div>
      {open && (q || filtered.length > 0) && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map(item => (
            <button key={item.id} type="button" onMouseDown={() => choose(item)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2">
              {selected?.id === item.id && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
              {item[labelKey]}
              {item.email && <span className="text-xs text-muted-foreground ml-auto">{item.email}</span>}
            </button>
          ))}
          {onCreate && q && !filtered.find(i => (i[labelKey] || '').toLowerCase() === q.toLowerCase()) && (
            <button type="button" onMouseDown={() => { onCreate(q); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-accent flex items-center gap-2 border-t border-border">
              <Plus className="w-3.5 h-3.5" /> {createLabel || `Create "${q}"`}
            </button>
          )}
          {filtered.length === 0 && !onCreate && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No results</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
export default function NewJobPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const isAdmin = getIsAdmin();

  const [activeTab, setActiveTab] = useState('details');
  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState(false);

  // Pending assignments / vendor link (created after job save)
  const [pendingAssignments, setPendingAssignments] = useState([]); // [{emp, role, notify}]
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [newVendorName, setNewVendorName] = useState('');
  const [selectedClient, setSelectedClient] = useState(null); // existing Lead/client
  const [newClientFields, setNewClientFields] = useState({ name: '', phone: '', email: '' });
  const [useNewClient, setUseNewClient] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Data fetches
  const { data: jobTypes = [] } = useQuery({
    queryKey: ['job-types'],
    queryFn: () => base44.entities.JobType.filter({ active: true }, 'display_order'),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ active: true }, 'name'),
    enabled: isAdmin,
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-active'],
    queryFn: () => base44.entities.Vendor.filter({ active: true }, 'company_name'),
  });
  const { data: leads = [] } = useQuery({
    queryKey: ['leads-all'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
  });

  // Resolve the effective customer name from the Clients tab or form
  // Lead entity uses contact_name as the primary name field
  const effectiveCustomerName =
    (useNewClient ? newClientFields.name : null) ||
    selectedClient?.contact_name ||
    selectedClient?.name ||
    selectedClient?.customer_name ||
    form.customer_name ||
    '';

  // Validation — use effective customer name so Clients tab satisfies the requirement
  const issues = validateJob({
    ...form,
    price: form.price ? Number(form.price) : 0,
    customer_name: effectiveCustomerName,
  }).map(issue => {
    // Give a clearer message pointing to the Clients tab
    if (issue.field === 'customer_name') {
      return { ...issue, message: 'Please add or select a client in the Clients tab' };
    }
    return issue;
  });
  const errors = issues.filter(i => i.level === 'error');

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      // Resolve client info
      let customerName = form.customer_name;
      let customerEmail = form.customer_email;
      let customerPhone = form.customer_phone;
      let customerId = '';

      if (useNewClient && newClientFields.name) {
        // Create new Lead record
        const newLead = await base44.entities.Lead.create({
          name: newClientFields.name,
          email: newClientFields.email,
          phone: newClientFields.phone,
          status: 'active',
        });
        customerName = newClientFields.name;
        customerEmail = newClientFields.email;
        customerPhone = newClientFields.phone;
        customerId = newLead.id;
      } else if (selectedClient) {
        // Lead entity uses contact_name as the primary name field
        customerName = selectedClient.contact_name || selectedClient.name || selectedClient.customer_name || customerName;
        customerEmail = selectedClient.email || customerEmail;
        customerPhone = selectedClient.phone || customerPhone;
        customerId = selectedClient.id;
      }

      // Assemble address
      const fullAddress = [form.address, form.city, form.state && form.zip ? `${form.state} ${form.zip}` : (form.state || form.zip)].filter(Boolean).join(', ');

      // Resolve vendor
      let vendorId = selectedVendor?.id || '';
      let vendorName = selectedVendor?.company_name || '';
      if (!selectedVendor && newVendorName.trim()) {
        const nv = await base44.entities.Vendor.create({ company_name: newVendorName.trim(), active: true });
        vendorId = nv.id;
        vendorName = nv.company_name;
      }

      // Create job
      const job = await base44.entities.Job.create({
        ...form,
        price: form.price ? Number(form.price) : 0,
        address: fullAddress || form.address,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_id: customerId,
        source_system: 'app',
      });

      // Create job assignments
      for (const pa of pendingAssignments) {
        await base44.entities.JobAssignment.create({
          job_id: job.id,
          job_address: fullAddress || form.address,
          employee_id: pa.emp.id,
          employee_name: pa.emp.name,
          employee_code: pa.emp.employee_code,
          role_on_job: pa.role,
          notify_on_updates: pa.notify,
          assigned_by: role || 'admin',
          notes: pa.notify ? `Notification sent at job creation` : 'No notification at job creation',
        });

        // Audit log each assignment
        await audit.assignment.created(
          job.id,
          role || 'Admin',
          pa.emp.name,
          fullAddress || form.address || `Job ${job.id}`,
          pa.notify,
          { job_address: fullAddress || form.address }
        );

        // Send notification email if chosen
        if (pa.notify && pa.emp.email) {
          base44.integrations.Core.SendEmail({
            to: pa.emp.email,
            subject: `You've been assigned to a new job`,
            body: `Hi ${pa.emp.name},\n\nYou have been assigned to the following job:\n\n${fullAddress || form.address}\nRole: ${pa.role}\n\nAssigned by: ${role || 'Admin'}\n\nPlease log in for details.`,
          }).catch(() => {});
        }
      }

      await logAudit(job.id, 'job_created', role || 'admin', `Master job file created: ${fullAddress || form.address}`);
      return job;
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['cal-jobs'] });
      toast.success('Job created successfully');
      navigate(`/job-hub?jobId=${job.id}`);
    },
    onError: (err) => {
      toast.error(`Failed to create job: ${err?.message || 'Unknown error'}`);
    },
  });

  const handleSave = () => {
    setTouched(true);
    if (errors.length > 0) {
      const hasCustomerError = errors.some(e => e.field === 'customer_name');
      const hasOtherErrors = errors.some(e => e.field !== 'customer_name');
      if (hasCustomerError && !hasOtherErrors) {
        setActiveTab('clients');
      } else {
        setActiveTab('details');
      }
      return;
    }
    createMutation.mutate();
  };

  // ── Assignment helpers ──
  const addAssignment = (empId, roleVal, notify = true) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    if (pendingAssignments.find(a => a.emp.id === empId)) return;
    setPendingAssignments(p => [...p, { emp, role: roleVal, notify }]);
  };
  const removeAssignment = (empId) => setPendingAssignments(p => p.filter(a => a.emp.id !== empId));
  const toggleNotify = (empId) => setPendingAssignments(p => p.map(a => a.emp.id === empId ? { ...a, notify: !a.notify } : a));

  const [addEmpId, setAddEmpId] = useState('');
  const [addEmpRole, setAddEmpRole] = useState('crew');
  const [addEmpNotify, setAddEmpNotify] = useState(true);
  const assignedIds = pendingAssignments.map(a => a.emp.id);
  const availableEmps = employees.filter(e => !assignedIds.includes(e.id));

  // Lead display name helper — Lead entity uses contact_name
  const leadLabel = (l) => l.contact_name || l.name || l.customer_name || l.email || l.id;

  return (
    <AppLayout title="New Job">
      <div className="flex flex-col min-h-full">

        {/* ── Top bar ── */}
        <div className="bg-white border-b border-border sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Briefcase className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground leading-none">New Master Job File</p>
                  <p className="text-[10px] text-muted-foreground">Fill in the sections below, then save</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 rounded-xl" onClick={() => navigate(-1)}>Cancel</Button>
              <Button size="sm" className="h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 gap-2"
                onClick={handleSave} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Create Job</>}
              </Button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="max-w-4xl mx-auto px-4 flex gap-0 overflow-x-auto no-scrollbar border-t border-border">
            {TABS.map(t => {
              const Icon = t.icon;
              const isActive = activeTab === t.key;
              return (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}>
                  <Icon className="w-3.5 h-3.5" />{t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 bg-slate-50">
          <div className="max-w-4xl mx-auto px-4 py-6">

            {/* Validation errors */}
            {touched && issues.length > 0 && (activeTab === 'details' || activeTab === 'clients') && (
              <div className="mb-4"><ValidationPanel issues={issues} /></div>
            )}

            {/* ═══════════════════ JOB DETAILS ═══════════════════ */}
            {activeTab === 'details' && (
              <div className="space-y-8">

                <Section title="Job Identity">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Job Title">
                      <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Smith Exterior Repaint" className="h-10 rounded-xl text-sm" />
                    </Field>
                    <Field label="Contract Price ($)">
                      <Input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" className="h-10 rounded-xl text-sm" />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Job Type">
                      <div className="flex gap-2 items-center">
                        <Select value={form.job_type || ''} onValueChange={v => set('job_type', v)}>
                          <SelectTrigger className="h-10 rounded-xl text-sm flex-1"><SelectValue placeholder="Select type..." /></SelectTrigger>
                          <SelectContent>{jobTypes.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                        {isAdmin && (
                          <button type="button" onClick={() => navigate('/admin?tab=jobtypes')}
                            className="text-xs text-primary hover:underline whitespace-nowrap flex items-center gap-0.5 shrink-0">
                            <ExternalLink className="w-3 h-3" /> Manage
                          </button>
                        )}
                      </div>
                    </Field>
                    <Field label="Job Group">
                      <Select value={form.job_group} onValueChange={v => set('job_group', v)}>
                        <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(JOB_GROUP_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Lifecycle Status">
                      <Select value={form.lifecycle_status} onValueChange={v => set('lifecycle_status', v)}>
                        <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(JOB_LIFECYCLE_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field label="Job Color">
                    <div className="flex gap-2 flex-wrap">
                      {JOB_COLORS.map(c => (
                        <button key={c} type="button" onClick={() => set('color', c)}
                          className="w-7 h-7 rounded-full border-2 transition-all"
                          style={{ backgroundColor: c, borderColor: form.color === c ? '#1e293b' : 'transparent', transform: form.color === c ? 'scale(1.2)' : 'scale(1)' }} />
                      ))}
                    </div>
                  </Field>
                </Section>

                <Section title="Job Site Address">
                  <Field label="Street Address" required>
                    <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main Street" className="h-10 rounded-xl text-sm" />
                  </Field>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <Field label="City">
                        <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" className="h-10 rounded-xl text-sm" />
                      </Field>
                    </div>
                    <Field label="State">
                      <Input value={form.state} onChange={e => set('state', e.target.value)} placeholder="SC" maxLength={2} className="h-10 rounded-xl text-sm uppercase" />
                    </Field>
                    <Field label="ZIP">
                      <Input value={form.zip} onChange={e => set('zip', e.target.value)} placeholder="29577" className="h-10 rounded-xl text-sm" />
                    </Field>
                  </div>
                </Section>

                <Section title="Description & Notes">
                  <Field label="Job Description / Scope of Work" required>
                    <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the work to be performed..." className="rounded-xl text-sm min-h-20" />
                  </Field>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Internal Notes">
                      <Textarea value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)} placeholder="Notes visible to internal team only..." className="rounded-xl text-sm min-h-16" />
                    </Field>
                    <Field label="Vendor / Sub Notes">
                      <Textarea value={form.vendor_notes} onChange={e => set('vendor_notes', e.target.value)} placeholder="Notes visible to subs/vendors..." className="rounded-xl text-sm min-h-16" />
                    </Field>
                  </div>
                </Section>

                <Section title="Project Timeline">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Projected Start">
                      <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="h-10 rounded-xl text-sm" />
                    </Field>
                    <Field label="Actual Start">
                      <Input type="date" value={form.actual_start_date} onChange={e => set('actual_start_date', e.target.value)} className="h-10 rounded-xl text-sm" />
                    </Field>
                    <Field label="Projected Completion">
                      <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="h-10 rounded-xl text-sm" />
                    </Field>
                    <Field label="Actual Completion">
                      <Input type="date" value={form.actual_end_date} onChange={e => set('actual_end_date', e.target.value)} className="h-10 rounded-xl text-sm" />
                    </Field>
                  </div>
                  <Field label="Estimated Work Days">
                    <Input value={form.work_days} onChange={e => set('work_days', e.target.value)} placeholder="e.g. 5" className="h-10 rounded-xl text-sm w-40" />
                  </Field>
                </Section>

                <Section title="Job Details">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Square Footage">
                      <Input type="number" value={form.square_footage} onChange={e => set('square_footage', e.target.value)} placeholder="0" className="h-10 rounded-xl text-sm" />
                    </Field>
                    <Field label="Permit Number">
                      <Input value={form.permit_number} onChange={e => set('permit_number', e.target.value)} placeholder="Permit #" className="h-10 rounded-xl text-sm" />
                    </Field>
                    <Field label="Lot / Parcel Info">
                      <Input value={form.lot_info} onChange={e => set('lot_info', e.target.value)} placeholder="Lot info" className="h-10 rounded-xl text-sm" />
                    </Field>
                  </div>
                </Section>

              </div>
            )}

            {/* ═══════════════════ CLIENTS ═══════════════════ */}
            {activeTab === 'clients' && (
              <div className="space-y-6">
                <div className="bg-white border border-border rounded-2xl p-6 space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-0.5">Primary Client / Contact</h3>
                    <p className="text-xs text-muted-foreground">Search for an existing client or create a new one</p>
                  </div>

                  <div className="flex gap-2 mb-4">
                    <button type="button" onClick={() => setUseNewClient(false)}
                      className={`flex-1 py-2 rounded-xl border-2 text-xs font-medium transition-colors ${!useNewClient ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-border text-muted-foreground hover:border-primary/30'}`}>
                      Search Existing
                    </button>
                    <button type="button" onClick={() => setUseNewClient(true)}
                      className={`flex-1 py-2 rounded-xl border-2 text-xs font-medium transition-colors ${useNewClient ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-border text-muted-foreground hover:border-primary/30'}`}>
                      <Plus className="w-3 h-3 inline mr-1" />New Client
                    </button>
                  </div>

                  {!useNewClient ? (
                    <div className="space-y-3">
                      <SearchableSelect
                        placeholder="Search clients by name or email..."
                        items={leads.map(l => ({ ...l, name: l.contact_name || l.name || l.customer_name || l.email || '' }))}
                        labelKey="name"
                        onSelect={l => {
                          setSelectedClient(l);
                          if (l) {
                            const name = l.contact_name || l.name || l.customer_name || '';
                            set('customer_name', name);
                            set('customer_email', l.email || '');
                            set('customer_phone', l.phone || '');
                          }
                        }}
                      />
                      {selectedClient && (
                        <div className="bg-secondary/40 rounded-xl p-3 space-y-1">
                          <p className="text-sm font-semibold text-foreground">{selectedClient.contact_name || selectedClient.name}</p>
                          {selectedClient.email && <p className="text-xs text-muted-foreground">{selectedClient.email}</p>}
                          {selectedClient.phone && <p className="text-xs text-muted-foreground">{selectedClient.phone}</p>}
                        </div>
                      )}
                      {/* Still allow editing/overriding contact fields */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                        <Field label="Customer Name" required>
                          <Input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} className="h-9 rounded-xl text-sm" />
                        </Field>
                        <Field label="Phone">
                          <Input value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} className="h-9 rounded-xl text-sm" />
                        </Field>
                        <Field label="Email">
                          <Input type="email" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} className="h-9 rounded-xl text-sm" />
                        </Field>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                        A new client record will be created and linked to this job on save.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Field label="Full Name" required>
                          <Input value={newClientFields.name} onChange={e => setNewClientFields(f => ({ ...f, name: e.target.value }))} className="h-9 rounded-xl text-sm" />
                        </Field>
                        <Field label="Phone">
                          <Input value={newClientFields.phone} onChange={e => setNewClientFields(f => ({ ...f, phone: e.target.value }))} className="h-9 rounded-xl text-sm" />
                        </Field>
                        <Field label="Email">
                          <Input type="email" value={newClientFields.email} onChange={e => setNewClientFields(f => ({ ...f, email: e.target.value }))} className="h-9 rounded-xl text-sm" />
                        </Field>
                      </div>
                    </div>
                  )}

                  <Field label="Billing Address (if different from job site)">
                    <Input value={form.billing_address} onChange={e => set('billing_address', e.target.value)} placeholder="Leave blank to use job site address" className="h-9 rounded-xl text-sm" />
                  </Field>
                </div>
              </div>
            )}

            {/* ═══════════════════ INTERNAL USERS ═══════════════════ */}
            {activeTab === 'team' && (
              <div className="bg-white border border-border rounded-2xl p-6 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-0.5">Assign Internal Team</h3>
                  <p className="text-xs text-muted-foreground">Assign employees to this job. Roles and notifications can be adjusted after creation.</p>
                </div>

                {/* Add employee */}
                <div className="space-y-2">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Field label="Employee">
                        <Select value={addEmpId} onValueChange={setAddEmpId}>
                          <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue placeholder="Select employee..." /></SelectTrigger>
                          <SelectContent>
                            {availableEmps.map(e => <SelectItem key={e.id} value={e.id}>{e.name} — {e.employee_code}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <div className="w-40">
                      <Field label="Role">
                        <Select value={addEmpRole} onValueChange={setAddEmpRole}>
                          <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <Button type="button" size="sm" className="h-10 rounded-xl px-4 shrink-0"
                      onClick={() => { addAssignment(addEmpId, addEmpRole, addEmpNotify); setAddEmpId(''); }}
                      disabled={!addEmpId}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {addEmpId && (
                    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-border">
                      <div className="flex items-center gap-2">
                        <Send className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">Send notification on save</span>
                      </div>
                      <button type="button" onClick={() => setAddEmpNotify(v => !v)}
                        className={`w-9 h-5 rounded-full transition-colors relative ${addEmpNotify ? 'bg-primary' : 'bg-muted'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${addEmpNotify ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Assigned list */}
                {pendingAssignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No team members assigned yet.</p>
                ) : (
                  <div className="space-y-2">
                    {pendingAssignments.map(a => (
                      <div key={a.emp.id} className="flex items-center gap-3 bg-secondary/40 rounded-xl px-4 py-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{a.emp.name}</p>
                          <p className="text-xs text-muted-foreground">{ROLE_OPTIONS.find(r => r.value === a.role)?.label} · #{a.emp.employee_code}</p>
                        </div>
                        <button type="button" onClick={() => toggleNotify(a.emp.id)}
                          className={`p-1.5 rounded-lg transition-colors ${a.notify ? 'text-primary' : 'text-muted-foreground'}`}
                          title={a.notify ? 'Will notify on save' : 'No notification'}>
                          {a.notify ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                        </button>
                        <button type="button" onClick={() => removeAssignment(a.emp.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════ SUBS / VENDORS ═══════════════════ */}
            {activeTab === 'vendors' && (
              <div className="bg-white border border-border rounded-2xl p-6 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-0.5">Source / Vendor / Sub</h3>
                  <p className="text-xs text-muted-foreground">Link the vendor, builder, or source who sent this work order.</p>
                </div>

                <SearchableSelect
                  placeholder="Search vendors, subs, builders..."
                  items={vendors.map(v => ({ ...v, name: v.company_name || v.display_name }))}
                  labelKey="name"
                  onSelect={v => {
                    setSelectedVendor(v);
                    setNewVendorName('');
                  }}
                  onCreate={name => { setNewVendorName(name); setSelectedVendor(null); }}
                  createLabel={`Add new vendor "${newVendorName || '...'}"`}
                />

                {selectedVendor && (
                  <div className="bg-secondary/40 rounded-xl p-3 space-y-1">
                    <p className="text-sm font-semibold text-foreground">{selectedVendor.company_name}</p>
                    {selectedVendor.contact_name && <p className="text-xs text-muted-foreground">Contact: {selectedVendor.contact_name}</p>}
                    {selectedVendor.email && <p className="text-xs text-muted-foreground">{selectedVendor.email}</p>}
                    {selectedVendor.phone && <p className="text-xs text-muted-foreground">{selectedVendor.phone}</p>}
                    <button type="button" onClick={() => setSelectedVendor(null)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
                  </div>
                )}

                {newVendorName && !selectedVendor && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-xs text-blue-700 font-medium">New vendor <strong>"{newVendorName}"</strong> will be created and linked on save.</p>
                    <button type="button" onClick={() => setNewVendorName('')} className="text-xs text-muted-foreground hover:text-destructive mt-1">Clear</button>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════ ADVANCED ═══════════════════ */}
            {activeTab === 'advanced' && (
              <div className="space-y-6">
                <div className="bg-white border border-border rounded-2xl p-6 space-y-5">
                  <h3 className="text-sm font-semibold text-foreground">Advanced Settings</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Buildertrend Job ID">
                      <Input value={form.buildertrend_id} onChange={e => set('buildertrend_id', e.target.value)} placeholder="BT reference ID" className="h-10 rounded-xl text-sm" />
                    </Field>
                    <Field label="Approval / Signature Status">
                      <Select value={form.status} onValueChange={v => set('status', v)}>
                        <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending Signature</SelectItem>
                          <SelectItem value="approved">Approved / Signed</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <div className="border border-border rounded-xl p-4 space-y-3 bg-slate-50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">After Save</p>
                    <p className="text-xs text-muted-foreground">After creating this job, you'll be taken directly to the <strong>Job Hub</strong> where you can:</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Add files, photos, and documents</li>
                      <li>Create or link invoices and estimates</li>
                      <li>Track time entries and expenses</li>
                      <li>Manage portal access for clients</li>
                      <li>Add change orders and daily logs</li>
                      <li>Set up custom fields</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom save bar */}
            <div className="mt-8 flex items-center justify-between gap-4 pt-4 border-t border-border">
              <div className="flex gap-2">
                {TABS.map((t, i) => {
                  const idx = TABS.findIndex(x => x.key === activeTab);
                  return null;
                })}
              </div>
              <div className="flex gap-2 ml-auto">
                {TABS.findIndex(t => t.key === activeTab) > 0 && (
                  <Button variant="outline" size="sm" className="h-9 rounded-xl"
                    onClick={() => setActiveTab(TABS[TABS.findIndex(t => t.key === activeTab) - 1].key)}>
                    ← Previous
                  </Button>
                )}
                {TABS.findIndex(t => t.key === activeTab) < TABS.length - 1 && (
                  <Button size="sm" className="h-9 rounded-xl"
                    onClick={() => setActiveTab(TABS[TABS.findIndex(t => t.key === activeTab) + 1].key)}>
                    Next →
                  </Button>
                )}
                <Button size="sm" className="h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 gap-2"
                  onClick={handleSave} disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Create Job</>}
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}