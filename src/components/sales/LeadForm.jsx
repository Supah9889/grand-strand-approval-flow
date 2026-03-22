import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { STATUSES } from './LeadStatusBadge';

const SOURCES = ['website','google','referral','repeat_customer','buildertrend','facebook','instagram','yard_sign','door_hanger','nextdoor','other'];
const SERVICE_TYPES = ['interior_painting','exterior_painting','cabinet_painting','deck_staining','commercial_painting','drywall_repair','power_washing','epoxy_floor','other'];
const PRIORITIES = ['low','medium','high','urgent'];
const BILLING = ['customer_pay','insurance','builder','property_manager','other'];
const URGENCY = ['flexible','within_month','within_2_weeks','asap'];
const CONTACT_METHODS = ['phone','text','email','any'];
const INITIAL_STATUSES = ['new_lead','contacted','qualified','prospect'];

const label = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function LeadForm({ initial = {}, onSubmit, onCancel, isLoading, vendors = [] }) {
  const [form, setForm] = useState({
    contact_name: '', company_name: '', contact_type: 'lead',
    phone: '', phone_secondary: '', email: '', email_secondary: '',
    property_address: '', city: '', state: '', zip: '',
    lead_source: '', referral_source: '', assigned_to: '',
    status: 'new_lead', priority: 'medium',
    follow_up_date: '', follow_up_notes: '',
    preferred_contact_method: '', best_time_to_contact: '',
    internal_notes: '', presale_job_title: '', service_type: '',
    work_scope_summary: '', estimate_needed: true,
    approximate_value: '', billing_type: '', urgency_level: 'flexible',
    requested_timeline: '',
    ...initial,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    if (data.approximate_value) data.approximate_value = Number(data.approximate_value);
    onSubmit(data);
  };

  const F = ({ label: lbl, field, placeholder, type = 'text', half }) => (
    <div className={half ? '' : 'col-span-2'}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{lbl}</label>
      <Input type={type} placeholder={placeholder || lbl} value={form[field] || ''} onChange={e => set(field, e.target.value)} className="h-9 rounded-lg text-sm" />
    </div>
  );

  const S = ({ label: lbl, field, options, half }) => (
    <div className={half ? '' : 'col-span-2'}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{lbl}</label>
      <Select value={form[field] || ''} onValueChange={v => set(field, v)}>
        <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder={`Select ${lbl}`} /></SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o} value={o}>{label(o)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Contact Info */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contact</p>
        <div className="grid grid-cols-2 gap-3">
          <F label="Contact Name *" field="contact_name" half />
          <F label="Company Name" field="company_name" half />
          <F label="Primary Phone" field="phone" type="tel" half />
          <F label="Secondary Phone" field="phone_secondary" type="tel" half />
          <F label="Primary Email" field="email" type="email" half />
          <F label="Secondary Email" field="email_secondary" type="email" half />
          <S label="Contact Type" field="contact_type" options={['lead','prospect','customer']} half />
          <S label="Preferred Contact" field="preferred_contact_method" options={CONTACT_METHODS} half />
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Best Time to Contact</label>
            <Input placeholder="e.g. Mornings, After 3pm" value={form.best_time_to_contact || ''} onChange={e => set('best_time_to_contact', e.target.value)} className="h-9 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      {/* Location */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Location</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Property Address</label>
            <Input placeholder="Property Address" value={form.property_address || ''} onChange={e => set('property_address', e.target.value)} className="h-9 rounded-lg text-sm" />
          </div>
          <F label="City" field="city" half />
          <F label="State" field="state" half />
          <F label="ZIP" field="zip" half />
        </div>
      </div>

      {/* Source & Assignment */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Source & Assignment</p>
        <div className="grid grid-cols-2 gap-3">
          <S label="Lead Source" field="lead_source" options={SOURCES} half />
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Referral Source</label>
            {vendors.length > 0 ? (
              <Select value={form.referral_source || ''} onValueChange={v => set('referral_source', v)}>
                <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  {vendors.map(v => <SelectItem key={v.id} value={v.company_name}>{v.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input placeholder="Referral source name" value={form.referral_source || ''} onChange={e => set('referral_source', e.target.value)} className="h-9 rounded-lg text-sm" />
            )}
          </div>
          <F label="Assigned To" field="assigned_to" half />
          <S label="Priority" field="priority" options={PRIORITIES} half />
          <S label="Status" field="status" options={['new_lead','contacted','qualified','estimate_scheduled','estimate_in_progress','estimate_sent','waiting_on_approval','follow_up_needed','on_hold']} half />
        </div>
      </div>

      {/* Presale / Estimate */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Presale Info</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Presale Job Title</label>
            <Input placeholder="e.g. Full Exterior Repaint" value={form.presale_job_title || ''} onChange={e => set('presale_job_title', e.target.value)} className="h-9 rounded-lg text-sm" />
          </div>
          <S label="Service Type" field="service_type" options={SERVICE_TYPES} half />
          <F label="Approx. Value ($)" field="approximate_value" type="number" half />
          <S label="Billing Type" field="billing_type" options={BILLING} half />
          <S label="Urgency" field="urgency_level" options={URGENCY} half />
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Requested Timeline</label>
            <Input placeholder="e.g. Spring 2025, ASAP" value={form.requested_timeline || ''} onChange={e => set('requested_timeline', e.target.value)} className="h-9 rounded-lg text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Scope Summary</label>
            <Textarea placeholder="Brief description of work needed..." value={form.work_scope_summary || ''} onChange={e => set('work_scope_summary', e.target.value)} className="rounded-lg text-sm min-h-16" />
          </div>
        </div>
      </div>

      {/* Follow-Up */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Follow-Up</p>
        <div className="grid grid-cols-2 gap-3">
          <F label="Follow-Up Date" field="follow_up_date" type="date" half />
          <F label="Follow-Up Time" field="follow_up_time" type="time" half />
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Follow-Up Notes</label>
            <Input placeholder="What to follow up about..." value={form.follow_up_notes || ''} onChange={e => set('follow_up_notes', e.target.value)} className="h-9 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      {/* Internal Notes */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Internal Notes</p>
        <Textarea placeholder="Internal notes about this lead..." value={form.internal_notes || ''} onChange={e => set('internal_notes', e.target.value)} className="rounded-lg text-sm min-h-24" />
      </div>

      <div className="flex gap-2 pt-1">
        {onCancel && <Button type="button" variant="outline" className="flex-1 h-10 rounded-xl" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" className="flex-1 h-10 rounded-xl" disabled={!form.contact_name || isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Lead'}
        </Button>
      </div>
    </form>
  );
}