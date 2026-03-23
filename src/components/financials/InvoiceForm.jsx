import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { generateNumber, INVOICE_STATUS_CONFIG } from '@/lib/financialHelpers';
import { getInternalRole } from '@/lib/adminAuth';
import { validateInvoice } from '@/lib/validation';
import ValidationPanel from '@/components/shared/ValidationPanel';

export default function InvoiceForm({ jobId, jobAddress, customerName, existingNums = [], onSave, onCancel }) {
  const role = getInternalRole();
  const [form, setForm] = useState({
    invoice_number: generateNumber('INV', existingNums),
    job_id: jobId || '',
    job_address: jobAddress || '',
    customer_name: customerName || '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    amount: '',
    status: 'draft',
    source_type: 'manual',
    notes: '',
    internal_notes: '',
    created_by_name: role || 'admin',
  });
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const issues = validateInvoice({ ...form, amount: parseFloat(form.amount) || 0 });
  const errors = issues.filter(i => i.level === 'error');

  const handleSave = async () => {
    setTouched(true);
    if (errors.length > 0) { toast.error('Please fix the issues before saving'); return; }
    setSaving(true);
    await onSave({ ...form, amount: parseFloat(form.amount) || 0, balance_due: parseFloat(form.amount) || 0, amount_paid: 0 });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Invoice #</label>
          <Input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} className="h-9 rounded-lg text-sm font-mono" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(INVOICE_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Customer</label>
          <Input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Amount *</label>
          <Input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Invoice Date</label>
          <Input type="date" value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Due Date</label>
          <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Source</label>
          <Select value={form.source_type} onValueChange={v => set('source_type', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="estimate">From Estimate</SelectItem>
              <SelectItem value="change_order">From Change Order</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="rounded-lg text-sm min-h-14" />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 h-9 rounded-xl" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1 h-9 rounded-xl" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Invoice'}
        </Button>
      </div>
    </div>
  );
}