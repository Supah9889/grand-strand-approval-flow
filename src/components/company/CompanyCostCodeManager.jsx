import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, X, Edit2, Check } from 'lucide-react';

const CATEGORIES = ['labor','materials','subcontractor','equipment','admin','other'];
const EXAMPLE_CODES = {
  DH:   ['DH-MOLD-TECH','DH-WATER-MIT','DH-AIR-SAMPLE','DH-DEMO','DH-CONTENTS','DH-ADMIN'],
  GSCP: ['GSCP-PAINT-LABOR','GSCP-DRYWALL','GSCP-CARPENTRY','GSCP-MATERIALS','GSCP-SUBS'],
  ADMIN: ['ADMIN-OFFICE','ADMIN-VEHICLE','ADMIN-INSURANCE'],
};

export default function CompanyCostCodeManager({ companies = [] }) {
  const qc = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState(companies[0]?.id || '');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ code: '', label: '', category: 'labor', description: '', default_hourly_rate: '' });
  const [saving, setSaving] = useState(false);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ['company-cost-codes', selectedCompanyId],
    queryFn: () => selectedCompanyId
      ? base44.entities.CompanyCostCode.filter({ company_id: selectedCompanyId }, 'code')
      : Promise.resolve([]),
    enabled: !!selectedCompanyId,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => {
    setEditTarget(null);
    setForm({ code: '', label: '', category: 'labor', description: '', default_hourly_rate: '' });
    setShowForm(true);
  };

  const openEdit = (code) => {
    setEditTarget(code);
    setForm({ code: code.code, label: code.label, category: code.category, description: code.description || '', default_hourly_rate: code.default_hourly_rate || '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.label) return;
    setSaving(true);
    const data = { ...form, company_id: selectedCompanyId, company_slug: selectedCompany?.slug || '', default_hourly_rate: form.default_hourly_rate ? Number(form.default_hourly_rate) : undefined, is_active: true };
    if (editTarget) {
      await base44.entities.CompanyCostCode.update(editTarget.id, data);
    } else {
      await base44.entities.CompanyCostCode.create(data);
    }
    qc.invalidateQueries({ queryKey: ['company-cost-codes', selectedCompanyId] });
    setSaving(false);
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.CompanyCostCode.delete(id);
    qc.invalidateQueries({ queryKey: ['company-cost-codes', selectedCompanyId] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select className="h-9 rounded-lg border border-input bg-background px-3 text-sm flex-1 min-w-0" value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)}>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" /> Add Code</Button>
      </div>

      {selectedCompany && Object.entries(EXAMPLE_CODES).find(([s]) => selectedCompany.slug?.startsWith(s)) && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          Example codes for {selectedCompany.slug}: {(EXAMPLE_CODES[selectedCompany.slug] || []).join(', ')}
        </div>
      )}

      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : codes.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No cost codes yet for this company.</div>
      ) : (
        <div className="space-y-1.5">
          {codes.map(c => (
            <div key={c.id} className="app-card px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-foreground">{c.code}</span>
                  <Badge variant="secondary" className="text-[10px]">{c.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
              </div>
              <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-muted transition-colors"><Edit2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
              <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors"><X className="w-3.5 h-3.5 text-destructive" /></button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
          <div className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editTarget ? 'Edit Cost Code' : 'New Cost Code'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Code *</label>
                <Input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="GSCP-PAINT-LABOR" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Label *</label>
                <Input value={form.label} onChange={e => set('label', e.target.value)} placeholder="Painting Labor" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" value={form.category} onChange={e => set('category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Default Rate/hr</label>
                  <Input type="number" value={form.default_hourly_rate} onChange={e => set('default_hourly_rate', e.target.value)} placeholder="0.00" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editTarget ? 'Save' : 'Add Code')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}