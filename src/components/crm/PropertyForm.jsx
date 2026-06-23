import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Loader2 } from 'lucide-react';

const PROPERTY_TYPES = ['single_family','multi_family','condo','commercial','industrial','other'];

export default function PropertyForm({ company, customers = [], initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    company_id: company?.id || '',
    company_slug: company?.slug || '',
    customer_id: initial?.customer_id || '',
    customer_name: initial?.customer_name || '',
    address: initial?.address || '',
    city: initial?.city || '',
    state: initial?.state || '',
    zip: initial?.zip || '',
    property_type: initial?.property_type || 'single_family',
    square_footage: initial?.square_footage || '',
    notes: initial?.notes || '',
    insurance_company: initial?.insurance_company || '',
    insurance_policy_number: initial?.insurance_policy_number || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCustomerChange = (id) => {
    const c = customers.find(c => c.id === id);
    set('customer_id', id);
    set('customer_name', c?.full_name || '');
  };

  const handleSave = async () => {
    if (!form.address.trim()) { setError('Address is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (initial?.id) {
        await base44.entities.Property.update(initial.id, form);
      } else {
        await base44.entities.Property.create(form);
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
          <h2 className="font-semibold text-foreground">{initial ? 'Edit Property' : 'New Property'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Linked Customer</label>
            <select
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={form.customer_id}
              onChange={e => handleCustomerChange(e.target.value)}
            >
              <option value="">— None —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Street Address *</label>
            <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">City</label>
              <Input value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">State</label>
              <Input value={form.state} onChange={e => set('state', e.target.value)} placeholder="SC" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">ZIP</label>
              <Input value={form.zip} onChange={e => set('zip', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Sq Ft</label>
              <Input type="number" value={form.square_footage} onChange={e => set('square_footage', Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Property Type</label>
            <select
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={form.property_type}
              onChange={e => set('property_type', e.target.value)}
            >
              {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Insurance Company</label>
            <Input value={form.insurance_company} onChange={e => set('insurance_company', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Policy Number</label>
            <Input value={form.insurance_policy_number} onChange={e => set('insurance_policy_number', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[64px] resize-none"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (initial ? 'Save Changes' : 'Add Property')}
          </Button>
        </div>
      </div>
    </div>
  );
}