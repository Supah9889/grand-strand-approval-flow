import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Loader2 } from 'lucide-react';

const TYPES = ['homeowner','tenant','builder','property_manager','insurance','commercial','other'];
const REFERRAL_SOURCES = ['Word of Mouth','Google','Insurance Referral','Builder Referral','Repeat Customer','Social Media','Door Hanger','Other'];

export default function CustomerForm({ company, initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    company_id: company?.id || '',
    company_slug: company?.slug || '',
    full_name: initial?.full_name || '',
    first_name: initial?.first_name || '',
    last_name: initial?.last_name || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    type: initial?.type || 'homeowner',
    referral_source: initial?.referral_source || '',
    billing_address: initial?.billing_address || '',
    notes: initial?.notes || '',
    insurance_company: initial?.insurance_company || '',
    insurance_claim_number: initial?.insurance_claim_number || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.full_name.trim()) { setError('Full name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (initial?.id) {
        await base44.entities.Customer.update(initial.id, form);
      } else {
        await base44.entities.Customer.create(form);
      }
      onSaved();
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-xl flex flex-col max-h-[92dvh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{initial ? 'Edit Customer' : 'New Customer'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Full Name *</label>
            <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Jane Smith" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">First Name</label>
              <Input value={form.first_name} onChange={e => set('first_name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Last Name</label>
              <Input value={form.last_name} onChange={e => set('last_name', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <select
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={form.type}
              onChange={e => set('type', e.target.value)}
            >
              {TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <Input value={form.email} onChange={e => set('email', e.target.value)} type="email" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Phone</label>
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Referral Source</label>
            <select
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={form.referral_source}
              onChange={e => set('referral_source', e.target.value)}
            >
              <option value="">— Select —</option>
              {REFERRAL_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Billing Address</label>
            <Input value={form.billing_address} onChange={e => set('billing_address', e.target.value)} />
          </div>
          {form.type === 'insurance' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Insurance Company</label>
                <Input value={form.insurance_company} onChange={e => set('insurance_company', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Claim Number</label>
                <Input value={form.insurance_claim_number} onChange={e => set('insurance_claim_number', e.target.value)} />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[72px] resize-none"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (initial ? 'Save Changes' : 'Create Customer')}
          </Button>
        </div>
      </div>
    </div>
  );
}