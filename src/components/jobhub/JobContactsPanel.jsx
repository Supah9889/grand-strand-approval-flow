import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Phone, Mail, User, ChevronDown, ChevronUp, Users,
  Plus, Pencil, Trash2, X, Save, Loader2, Building2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';

// ── Role config ───────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  homeowner:       { label: 'Homeowner',       color: 'bg-blue-50 text-blue-700' },
  tenant:          { label: 'Tenant',          color: 'bg-cyan-50 text-cyan-700' },
  builder_rep:     { label: 'Builder Rep',     color: 'bg-indigo-50 text-indigo-700' },
  project_lead:    { label: 'Project Lead',    color: 'bg-primary/10 text-primary' },
  estimator:       { label: 'Estimator',       color: 'bg-violet-50 text-violet-700' },
  vendor_sub:      { label: 'Vendor / Sub',    color: 'bg-orange-50 text-orange-700' },
  office:          { label: 'Office',          color: 'bg-slate-100 text-slate-600' },
  billing_contact: { label: 'Billing',         color: 'bg-green-50 text-green-700' },
  other:           { label: 'Contact',         color: 'bg-muted text-muted-foreground' },
};

const ROLE_OPTIONS = Object.entries(ROLE_CONFIG).map(([value, { label }]) => ({ value, label }));

function getRoleConfig(role) {
  return ROLE_CONFIG[role] || ROLE_CONFIG.other;
}

// ── Inline contact form (add or edit) ────────────────────────────────────────
function ContactForm({ jobId, jobAddress, initial, onDone, onCancel }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: initial?.name || '',
    role: initial?.role || 'homeowner',
    phone: initial?.phone || '',
    email: initial?.email || '',
    company: initial?.company || '',
    notes: initial?.notes || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        job_id: jobId,
        job_address: jobAddress,
        name: form.name.trim(),
        role: form.role,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        company: form.company.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (initial?.id) return base44.entities.JobContact.update(initial.id, payload);
      return base44.entities.JobContact.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hub-contacts', jobId] });
      toast.success(initial?.id ? 'Contact updated' : 'Contact added');
      onDone?.();
    },
  });

  return (
    <div className="bg-secondary/30 border border-border rounded-xl p-3 space-y-2.5 mt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">{initial?.id ? 'Edit contact' : 'Add contact'}</p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Name + role row */}
      <div className="flex gap-2">
        <Input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Full name *"
          className="h-8 rounded-lg text-sm flex-1"
          autoFocus
        />
        <Select value={form.role} onValueChange={v => set('role', v)}>
          <SelectTrigger className="h-8 rounded-lg text-xs w-36 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Phone + Email */}
      <div className="flex gap-2">
        <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Phone" className="h-8 rounded-lg text-sm flex-1" />
        <Input value={form.email} onChange={e => set('email', e.target.value)} placeholder="Email" className="h-8 rounded-lg text-sm flex-1" type="email" />
      </div>

      {/* Company */}
      <Input value={form.company} onChange={e => set('company', e.target.value)} placeholder="Company (optional)" className="h-8 rounded-lg text-sm" />

      {/* Notes */}
      <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notes (optional)" className="h-8 rounded-lg text-sm" />

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">Cancel</button>
        <button
          onClick={() => saveMut.mutate()}
          disabled={!form.name.trim() || saveMut.isPending}
          className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {saveMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save
        </button>
      </div>
    </div>
  );
}

// ── Contact row ───────────────────────────────────────────────────────────────
function ContactRow({ contact, isAdmin, onEdit, onDelete }) {
  const roleCfg = getRoleConfig(contact.role);
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0 group">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <User className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          {contact.name && <p className="text-sm font-medium text-foreground">{contact.name}</p>}
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${roleCfg.color}`}>
            {roleCfg.label}
          </span>
        </div>
        {contact.company && (
          <div className="flex items-center gap-1 mt-0.5">
            <Building2 className="w-3 h-3 text-muted-foreground/50 shrink-0" />
            <p className="text-xs text-muted-foreground">{contact.company}</p>
          </div>
        )}
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Phone className="w-3 h-3" />{contact.phone}
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors truncate max-w-[180px]">
              <Mail className="w-3 h-3 shrink-0" />{contact.email}
            </a>
          )}
        </div>
        {contact.notes && <p className="text-[10px] text-muted-foreground mt-0.5 italic">{contact.notes}</p>}
      </div>
      {isAdmin && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
          <button onClick={() => onEdit(contact)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={() => onDelete(contact.id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Legacy contact row (from job fields / assignments, no entity backing) ─────
function LegacyContactRow({ name, role, phone, email, notes }) {
  if (!name && !phone && !email) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <User className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          {name && <p className="text-sm font-medium text-foreground">{name}</p>}
          {role && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{role}</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {phone && (
            <a href={`tel:${phone}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Phone className="w-3 h-3" />{phone}
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors truncate">
              <Mail className="w-3 h-3" />{email}
            </a>
          )}
        </div>
        {notes && <p className="text-[10px] text-muted-foreground mt-0.5 italic">{notes}</p>}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function JobContactsPanel({ job, assignments = [], isAdmin }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  // Fetch entity-backed contacts for this job
  const { data: jobContacts = [] } = useQuery({
    queryKey: ['hub-contacts', job.id],
    queryFn: () => base44.entities.JobContact.filter({ job_id: job.id }, 'created_date'),
    enabled: !!job.id,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.JobContact.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hub-contacts', job.id] });
      toast.success('Contact removed');
    },
  });

  // Legacy contacts derived from job fields + assignments (always shown, read-only)
  const legacyContacts = [];
  const entityNames = new Set(jobContacts.map(c => c.name?.toLowerCase()));

  if (job.customer_name && !entityNames.has(job.customer_name?.toLowerCase())) {
    legacyContacts.push({
      name: job.customer_name,
      role: 'Client / Homeowner',
      phone: job.customer_phone || job.phone,
      email: job.customer_email || job.email,
    });
  }
  assignments.forEach(a => {
    if (a.employee_name && !entityNames.has(a.employee_name?.toLowerCase())) {
      legacyContacts.push({
        name: a.employee_name,
        role: a.role_on_job?.replace(/_/g, ' ') || 'Team Member',
        notes: a.assigned_by ? `Assigned by ${a.assigned_by}` : null,
      });
    }
  });
  if (job.assigned_to && !entityNames.has(job.assigned_to?.toLowerCase()) && !assignments.some(a => a.employee_name === job.assigned_to)) {
    legacyContacts.push({ name: job.assigned_to, role: 'Project Lead' });
  }

  const allCount = jobContacts.length + legacyContacts.length;
  const PREVIEW = 3;
  const showToggle = allCount > PREVIEW && !showForm && !editingContact;

  const visibleEntity = expanded ? jobContacts : jobContacts.slice(0, Math.max(0, PREVIEW - legacyContacts.length));
  const visibleLegacy = expanded ? legacyContacts : legacyContacts.slice(0, PREVIEW - visibleEntity.length);

  const handleEdit = (c) => { setEditingContact(c); setShowForm(false); };
  const handleAdd = () => { setEditingContact(null); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingContact(null); };

  return (
    <div className="bg-card border border-border rounded-2xl px-4 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contacts</p>
          {allCount > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{allCount}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showToggle && (
            <button onClick={() => setExpanded(e => !e)} className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              {expanded ? <><ChevronUp className="w-3 h-3" />Less</> : <><ChevronDown className="w-3 h-3" />+{allCount - PREVIEW} more</>}
            </button>
          )}
          {isAdmin && !showForm && !editingContact && (
            <button onClick={handleAdd} className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors">
              <Plus className="w-3 h-3" />Add
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {allCount === 0 && !showForm && (
        <p className="text-xs text-muted-foreground italic py-2">No contacts linked yet.{isAdmin ? '' : ''}</p>
      )}

      {/* Entity-backed contacts */}
      {visibleEntity.map(c => (
        editingContact?.id === c.id ? (
          <ContactForm
            key={c.id}
            jobId={job.id}
            jobAddress={job.address}
            initial={c}
            onDone={closeForm}
            onCancel={closeForm}
          />
        ) : (
          <ContactRow
            key={c.id}
            contact={c}
            isAdmin={isAdmin}
            onEdit={handleEdit}
            onDelete={(id) => deleteMut.mutate(id)}
          />
        )
      ))}

      {/* Legacy / derived contacts */}
      {visibleLegacy.map((c, i) => (
        <LegacyContactRow key={`legacy-${i}`} {...c} />
      ))}

      {/* Add form */}
      {showForm && (
        <ContactForm
          jobId={job.id}
          jobAddress={job.address}
          onDone={closeForm}
          onCancel={closeForm}
        />
      )}
    </div>
  );
}