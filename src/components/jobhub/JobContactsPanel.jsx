import React, { useState } from 'react';
import { Phone, Mail, User, ChevronDown, ChevronUp, Users } from 'lucide-react';

function ContactRow({ name, role, phone, email, notes }) {
  if (!name && !phone && !email) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <User className="w-3.5 h-3.5 text-primary" />
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

export default function JobContactsPanel({ job, assignments = [] }) {
  const [expanded, setExpanded] = useState(false);

  // Build contacts list from existing job data
  const contacts = [];

  // Primary customer/homeowner
  if (job.customer_name || job.customer_phone || job.customer_email) {
    contacts.push({
      name: job.customer_name,
      role: 'Client / Homeowner',
      phone: job.customer_phone || job.phone,
      email: job.customer_email || job.email,
    });
  }

  // Assigned team members from JobAssignment records
  assignments.forEach(a => {
    contacts.push({
      name: a.employee_name,
      role: a.role_on_job?.replace(/_/g, ' ') || 'Team Member',
      phone: null,
      email: null,
      notes: a.assigned_by ? `Assigned by ${a.assigned_by}` : null,
    });
  });

  // Assigned_to field (may be a name string)
  if (job.assigned_to && !assignments.some(a => a.employee_name === job.assigned_to)) {
    contacts.push({
      name: job.assigned_to,
      role: 'Project Lead',
      phone: null,
      email: null,
    });
  }

  const hasContacts = contacts.length > 0;
  const preview = contacts.slice(0, 2);
  const rest = contacts.slice(2);
  const showToggle = rest.length > 0;

  return (
    <div className="bg-card border border-border rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contacts</p>
          {hasContacts && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{contacts.length}</span>
          )}
        </div>
        {showToggle && (
          <button onClick={() => setExpanded(e => !e)} className="text-[11px] text-muted-foreground flex items-center gap-0.5">
            {expanded ? <><ChevronUp className="w-3 h-3" /> Less</> : <><ChevronDown className="w-3 h-3" /> +{rest.length} more</>}
          </button>
        )}
      </div>

      {!hasContacts ? (
        <p className="text-xs text-muted-foreground italic py-2">No contacts linked to this job.</p>
      ) : (
        <div>
          {preview.map((c, i) => <ContactRow key={i} {...c} />)}
          {expanded && rest.map((c, i) => <ContactRow key={`r${i}`} {...c} />)}
        </div>
      )}
    </div>
  );
}