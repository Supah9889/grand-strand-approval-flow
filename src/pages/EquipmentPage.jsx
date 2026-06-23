import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Cpu, Plus, Loader2, X, ChevronRight } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useCompanyGuard, NoAccessState } from '@/components/CompanyGuard';
import usePermissions from '@/hooks/usePermissions';

function getActiveCompany() {
  try { return JSON.parse(sessionStorage.getItem('active_company')); } catch { return null; }
}

const TYPES = ['dehumidifier','air_mover','hepa_scrubber','moisture_meter','thermal_camera','containment','other'];
const STATUSES = ['available','deployed','maintenance','retired'];
const STATUS_STYLES = {
  available: 'bg-emerald-100 text-emerald-700',
  deployed: 'bg-blue-100 text-blue-700',
  maintenance: 'bg-amber-100 text-amber-700',
  retired: 'bg-muted text-muted-foreground',
};

function EquipmentForm({ company, equipment, jobs, onClose, onSaved }) {
  const isEdit = !!equipment?.id;
  const [form, setForm] = useState({
    name: '', equipment_type: 'dehumidifier', serial_number: '', status: 'available',
    current_job_id: '', notes: '', ...equipment,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      company_id: company?.id,
      company_slug: company?.slug,
    };
    if (form.current_job_id) {
      const job = jobs.find(j => j.id === form.current_job_id);
      payload.current_job_address = job?.address || '';
      payload.status = 'deployed';
    } else {
      payload.current_job_address = '';
      payload.current_room_id = '';
      payload.current_room_name = '';
      if (form.status === 'deployed') payload.status = 'available';
    }
    if (isEdit) { await base44.entities.RestorationEquipment.update(equipment.id, payload); }
    else { await base44.entities.RestorationEquipment.create(payload); }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-card rounded-t-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{isEdit ? 'Edit Equipment' : 'Add Equipment'}</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Name *</label>
          <input className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1"
            placeholder="e.g. Dri-Eaz LGR 2800i #3" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Type</label>
            <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
              value={form.equipment_type} onChange={e => set('equipment_type', e.target.value)}>
              {TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
              value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Serial Number</label>
          <input className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1"
            value={form.serial_number} onChange={e => set('serial_number', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Assign to Job</label>
          <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
            value={form.current_job_id} onChange={e => set('current_job_id', e.target.value)}>
            <option value="">None</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.address}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Notes</label>
          <textarea className="w-full border border-input rounded-xl px-3 py-2 text-sm mt-1 resize-none h-16"
            value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-input text-sm text-muted-foreground">Cancel</button>
          <button onClick={save} disabled={!form.name.trim() || saving}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : isEdit ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EquipmentPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const company = getActiveCompany();
  const { canManageRestoration } = usePermissions();
  const companyGuard = useCompanyGuard('Select a company to manage equipment.');
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editEq, setEditEq] = useState(null);

  const { data: equipment = [], isLoading, refetch } = useQuery({
    queryKey: ['equipment', company?.id],
    queryFn: () => company
      ? base44.entities.RestorationEquipment.filter({ company_id: company.id })
      : base44.entities.RestorationEquipment.list(),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['equip-jobs', company?.id],
    queryFn: () => company
      ? base44.entities.Job.filter({ company_id: company.id }, '-created_date', 100)
      : base44.entities.Job.list('-created_date', 100),
  });

  const filtered = filter === 'all' ? equipment : equipment.filter(e => e.status === filter);

  if (companyGuard) return <AppLayout title="Equipment">{companyGuard}</AppLayout>;
  if (!canManageRestoration) return <AppLayout title="Equipment"><NoAccessState message="You do not have permission to manage equipment." /></AppLayout>;

  return (
    <AppLayout title="Equipment">
      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold flex items-center gap-2"><Cpu className="w-4 h-4 text-indigo-600" /> Equipment</h1>
          <button onClick={() => { setEditEq(null); setShowForm(true); }}
            className="flex items-center gap-1.5 h-9 px-3 bg-primary text-primary-foreground text-sm font-semibold rounded-xl">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {['all',...STATUSES].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 h-7 px-3 rounded-full text-xs font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {f}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-12">No equipment</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(eq => (
              <div key={eq.id} className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:bg-muted/20"
                onClick={() => { setEditEq(eq); setShowForm(true); }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{eq.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{eq.equipment_type?.replace('_', ' ')}</p>
                    {eq.current_job_address && <p className="text-xs text-blue-600 mt-0.5 truncate">{eq.current_job_address}</p>}
                    {eq.serial_number && <p className="text-[11px] text-muted-foreground">S/N: {eq.serial_number}</p>}
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[eq.status] || 'bg-muted text-muted-foreground'}`}>
                    {eq.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showForm && (
        <EquipmentForm
          company={company}
          equipment={editEq}
          jobs={jobs}
          onClose={() => { setShowForm(false); setEditEq(null); }}
          onSaved={() => { setShowForm(false); setEditEq(null); refetch(); }}
        />
      )}
    </AppLayout>
  );
}