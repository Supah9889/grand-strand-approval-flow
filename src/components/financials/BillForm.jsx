import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateNumber, BILL_STATUS_CONFIG } from '@/lib/financialHelpers';
import { getInternalRole } from '@/lib/adminAuth';
import { validateBill } from '@/lib/validation';
import ValidationPanel from '@/components/shared/ValidationPanel';

const CATEGORIES = ['labor','materials','subcontractor','permit','equipment','travel','disposal','admin','other'];

export default function BillForm({ jobId, jobAddress, existingNums = [], onSave, onCancel }) {
  const role = getInternalRole();
  const [form, setForm] = useState({
    bill_number: generateNumber('BILL', existingNums),
    job_id: jobId || '',
    job_address: jobAddress || '',
    vendor_name: '',
    bill_date: new Date().toISOString().split('T')[0],
    due_date: '',
    amount: '',
    category: 'other',
    status: 'open',
    notes: '',
    created_by_name: role || 'admin',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.vendor_name) { toast.error('Vendor is required'); return; }
    if (!form.amount) { toast.error('Amount is required'); return; }
    setSaving(true);
    await onSave({ ...form, amount: parseFloat(form.amount) || 0 });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Bill #</label>
          <Input value={form.bill_number} onChange={e => set('bill_number', e.target.value)} className="h-9 rounded-lg text-sm font-mono" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(BILL_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Vendor *</label>
          <Input value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Amount *</label>
          <Input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
          <Select value={form.category} onValueChange={v => set('category', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Bill Date</label>
          <Input type="date" value={form.bill_date} onChange={e => set('bill_date', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Due Date</label>
          <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="rounded-lg text-sm min-h-12" />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 h-9 rounded-xl" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1 h-9 rounded-xl" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Bill'}
        </Button>
      </div>
    </div>
  );
}