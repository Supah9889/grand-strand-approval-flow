import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Loader2 } from 'lucide-react';

const INDUSTRIES = ['restoration','painting','construction','other'];

export default function CompanyForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    slug: initial?.slug || '',
    color: initial?.color || '#1e7a6a',
    industry: initial?.industry || 'other',
    address: initial?.address || '',
    phone: initial?.phone || '',
    email: initial?.email || '',
    website: initial?.website || '',
    is_active: initial?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) { setError('Name and slug are required'); return; }
    setSaving(true);
    setError('');
    try {
      if (initial?.id) {
        await base44.entities.Company.update(initial.id, form);
      } else {
        await base44.entities.Company.create(form);
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
      <div className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-xl flex flex-col max-h-[92dvh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">{initial ? 'Edit Company' : 'New Company'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Company Name *</label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Destination Home" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Slug * (short ID, e.g. DH)</label>
            <Input value={form.slug} onChange={e => set('slug', e.target.value.toUpperCase())} placeholder="DH" maxLength={10} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Industry</label>
            <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" value={form.industry} onChange={e => set('industry', e.target.value)}>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Brand Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color} onChange={e => set('color', e.target.value)} className="h-10 w-14 rounded-lg border border-input cursor-pointer" />
              <Input value={form.color} onChange={e => set('color', e.target.value)} className="flex-1 font-mono text-sm" />
            </div>
          </div>
          {[['phone','Phone'],['email','Email'],['address','Address'],['website','Website']].map(([k, label]) => (
            <div key={k} className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{label}</label>
              <Input value={form[k]} onChange={e => set(k, e.target.value)} />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4 rounded" />
            <label htmlFor="is_active" className="text-sm text-foreground">Active</label>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (initial ? 'Save' : 'Create Company')}
          </Button>
        </div>
      </div>
    </div>
  );
}