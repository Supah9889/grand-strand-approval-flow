import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getInternalRole } from '@/lib/adminAuth';

const METHODS = ['check','ach','card','cash','zelle','venmo','other'];

export default function PaymentForm({ jobId, jobAddress, customerName, invoiceId, onSave, onCancel }) {
  const role = getInternalRole();
  const [form, setForm] = useState({
    job_id: jobId || '',
    job_address: jobAddress || '',
    customer_name: customerName || '',
    invoice_id: invoiceId || '',
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_method: 'check',
    reference_number: '',
    notes: '',
    recorded_by: role || 'admin',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.amount) { toast.error('Amount is required'); return; }
    setSaving(true);
    await onSave({ ...form, amount: parseFloat(form.amount) || 0 });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Amount Received *</label>
          <Input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} className="h-9 rounded-lg text-sm" placeholder="0.00" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Method</label>
          <Select value={form.payment_method} onValueChange={v => set('payment_method', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Date</label>
          <Input type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Reference / Check #</label>
          <Input value={form.reference_number} onChange={e => set('reference_number', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="rounded-lg text-sm min-h-12" />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 h-9 rounded-xl" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1 h-9 rounded-xl" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Payment'}
        </Button>
      </div>
    </div>
  );
}