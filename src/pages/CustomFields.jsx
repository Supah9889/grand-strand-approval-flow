import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, X, Loader2, Settings2, Eye, EyeOff, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { getInternalRole, isAdmin as getIsAdmin } from '@/lib/adminAuth';
import { toast } from 'sonner';

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'dropdown', label: 'Dropdown / Select' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'readonly', label: 'Read-Only Display' },
];

const VISIBILITY_LABELS = { admin_only: 'Admin Only', staff_visible: 'Staff + Admin', all: 'All Roles' };
const EDIT_LABELS = { admin_only: 'Admin Only', staff_editable: 'Staff + Admin' };

const emptyField = {
  label: '', field_key: '', field_type: 'text', help_text: '', default_value: '',
  required: false, active: true, display_order: 0, visibility: 'admin_only',
  editable_by: 'admin_only', dropdown_options: '', apply_to_groups: '',
};

export default function CustomFields() {
  const role = getInternalRole();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyField);
  const [editId, setEditId] = useState(null);

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: () => base44.entities.CustomField.list('display_order'),
  });

  const saveMutation = useMutation({
    mutationFn: d => editId ? base44.entities.CustomField.update(editId, d) : base44.entities.CustomField.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['custom-fields'] }); setShowForm(false); setEditId(null); setForm(emptyField); toast.success(editId ? 'Field updated' : 'Field created'); },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => base44.entities.CustomField.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-fields'] }),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const autoKey = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const handleLabelChange = (val) => {
    set('label', val);
    if (!editId) set('field_key', autoKey(val));
  };

  const handleEdit = (f) => {
    setForm({ ...f });
    setEditId(f.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.label || !form.field_key) { toast.error('Label and key are required'); return; }
    saveMutation.mutate(form);
  };

  if (!getIsAdmin()) {
    return (
      <AppLayout title="Custom Fields">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">Admin access required.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Custom Fields">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Custom Job Fields</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Define extra fields that appear on job records</p>
          </div>
          <Button className="h-9 rounded-xl text-sm gap-1.5" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyField); }}>
            <Plus className="w-3.5 h-3.5" /> New Field
          </Button>
        </div>

        {/* Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{editId ? 'Edit Field' : 'New Custom Field'}</p>
                  <button onClick={() => { setShowForm(false); setEditId(null); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Display Label *</label>
                    <Input value={form.label} onChange={e => handleLabelChange(e.target.value)} placeholder="e.g. Profit Target" className="h-9 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Field Key *</label>
                    <Input value={form.field_key} onChange={e => set('field_key', e.target.value)} placeholder="profit_target" className="h-9 rounded-lg text-sm font-mono" />
                    <p className="text-xs text-muted-foreground mt-0.5">snake_case, no spaces</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Field Type</label>
                    <Select value={form.field_type} onValueChange={v => set('field_type', v)}>
                      <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  {form.field_type === 'dropdown' && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Dropdown Options (one per line)</label>
                      <Textarea
                        value={(() => { try { return JSON.parse(form.dropdown_options || '[]').join('\n'); } catch { return form.dropdown_options || ''; } })()}
                        onChange={e => set('dropdown_options', JSON.stringify(e.target.value.split('\n').filter(Boolean)))}
                        className="rounded-lg text-sm min-h-20"
                        placeholder="Option A&#10;Option B&#10;Option C"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Visibility</label>
                    <Select value={form.visibility} onValueChange={v => set('visibility', v)}>
                      <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(VISIBILITY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Editable By</label>
                    <Select value={form.editable_by} onValueChange={v => set('editable_by', v)}>
                      <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(EDIT_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Default Value</label>
                    <Input value={form.default_value} onChange={e => set('default_value', e.target.value)} className="h-9 rounded-lg text-sm" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Display Order</label>
                    <Input type="number" value={form.display_order} onChange={e => set('display_order', parseInt(e.target.value) || 0)} className="h-9 rounded-lg text-sm" />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Help Text</label>
                    <Input value={form.help_text} onChange={e => set('help_text', e.target.value)} placeholder="Optional guidance for this field" className="h-9 rounded-lg text-sm" />
                  </div>

                  <div className="col-span-2 flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.required} onChange={e => set('required', e.target.checked)} className="rounded" />
                      Required field
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} className="rounded" />
                      Active
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 pt-1 border-t border-border">
                  <Button variant="outline" className="flex-1 h-9 rounded-xl" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
                  <Button className="flex-1 h-9 rounded-xl" onClick={handleSave} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editId ? 'Save Changes' : 'Create Field')}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Field list */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : fields.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Settings2 className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No custom fields defined yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {fields.map(f => (
              <div key={f.id} className={`bg-card border rounded-xl p-4 ${f.active ? 'border-border' : 'border-border/50 opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{f.label}</p>
                      <span className="text-xs font-mono text-muted-foreground">{f.field_key}</span>
                      {f.required && <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full font-medium">Required</span>}
                      {!f.active && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">Inactive</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                      <span>{FIELD_TYPES.find(t => t.value === f.field_type)?.label || f.field_type}</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        {f.visibility === 'admin_only' ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {VISIBILITY_LABELS[f.visibility]}
                      </span>
                    </div>
                    {f.help_text && <p className="text-xs text-muted-foreground italic mt-0.5">{f.help_text}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleActive.mutate({ id: f.id, active: !f.active })}
                      className="text-muted-foreground hover:text-foreground"
                      title={f.active ? 'Deactivate' : 'Activate'}
                    >
                      {f.active ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg" onClick={() => handleEdit(f)}>Edit</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}