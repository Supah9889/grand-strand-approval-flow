import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, X, Users } from 'lucide-react';

const ROLES = ['owner','operations_admin','estimator','field_technician','office_support','vendor','nexus_reviewer'];

const ROLE_COLORS = {
  owner:             'bg-amber-100 text-amber-700',
  operations_admin:  'bg-primary/10 text-primary',
  estimator:         'bg-cyan-100 text-cyan-700',
  field_technician:  'bg-green-100 text-green-700',
  office_support:    'bg-purple-100 text-purple-700',
  vendor:            'bg-orange-100 text-orange-700',
  nexus_reviewer:    'bg-indigo-100 text-indigo-700',
};

export default function MembershipManager({ companies = [] }) {
  const qc = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState(companies[0]?.id || '');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employee_name: '', role: 'field_technician', notes: '' });
  const [saving, setSaving] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['memberships', selectedCompanyId],
    queryFn: () => selectedCompanyId
      ? base44.entities.CompanyMembership.filter({ company_id: selectedCompanyId })
      : Promise.resolve([]),
    enabled: !!selectedCompanyId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => base44.entities.Employee.list('name', 200),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  const handleSave = async () => {
    if (!form.employee_name) return;
    setSaving(true);
    const emp = employees.find(e => e.id === form.employee_id || e.name === form.employee_name);
    await base44.entities.CompanyMembership.create({
      company_id: selectedCompanyId,
      company_slug: selectedCompany?.slug || '',
      company_name: selectedCompany?.name || '',
      employee_id: emp?.id || form.employee_name,
      employee_name: emp?.name || form.employee_name,
      role: form.role,
      notes: form.notes,
      is_active: true,
    });
    qc.invalidateQueries({ queryKey: ['memberships', selectedCompanyId] });
    setSaving(false);
    setShowForm(false);
    setForm({ employee_name: '', role: 'field_technician', notes: '' });
  };

  const handleRemove = async (id) => {
    await base44.entities.CompanyMembership.delete(id);
    qc.invalidateQueries({ queryKey: ['memberships', selectedCompanyId] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select className="h-9 rounded-lg border border-input bg-background px-3 text-sm flex-1 min-w-0" value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)}>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Add Member</Button>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : members.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <Users className="w-8 h-8 text-muted-foreground/40" />
          No members assigned to this company yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {members.map(m => (
            <div key={m.id} className="app-card px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-muted-foreground">{m.employee_name?.[0] || '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground">{m.employee_name}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${ROLE_COLORS[m.role] || ROLE_COLORS.field_technician}`}>
                {m.role?.replace('_', ' ')}
              </span>
              <button onClick={() => handleRemove(m.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                <X className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
          <div className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Add Member</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Employee</label>
                <select
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                  value={form.employee_id || ''}
                  onChange={e => { const emp = employees.find(emp => emp.id === e.target.value); set('employee_id', e.target.value); set('employee_name', emp?.name || ''); }}
                >
                  <option value="">— Select Employee —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Role</label>
                <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" value={form.role} onChange={e => set('role', e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving || !form.employee_id}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}