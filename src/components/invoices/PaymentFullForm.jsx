import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '@/lib/financialHelpers';
import { getInternalRole } from '@/lib/adminAuth';

const METHODS = ['check','ach','card','cash','zelle','venmo','other'];

export default function PaymentFullForm({ jobs = [], invoices = [], onSave, onCancel, prefillInvoiceId }) {
  const role = getInternalRole();
  const [form, setForm] = useState({
    invoice_id: prefillInvoiceId || '',
    job_id: '',
    job_address: '',
    customer_name: '',
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_method: 'check',
    reference_number: '',
    notes: '',
    recorded_by: role || 'admin',
    qb_sync_status: 'not_synced',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleInvoiceSelect = (invId) => {
    set('invoice_id', invId);
    const inv = invoices.find(i => i.id === invId);
    if (inv) {
      set('customer_name', inv.customer_name || '');
      set('job_id', inv.job_id || '');
      set('job_address', inv.job_address || '');
      const bal = Number(inv.balance_due || inv.amount || 0) - Number(inv.amount_paid || 0);
      set('amount', Math.max(0, bal).toFixed(2));
    }
  };

  const handleJobSelect = (jobId) => {
    set('job_id', jobId);
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      set('job_address', job.address || '');
      set('customer_name', job.customer_name || '');
    }
  };

  const selectedInvoice = invoices.find(i => i.id === form.invoice_id);

  const handleSave = async () => {
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Amount is required'); return; }
    if (!form.job_id && !form.invoice_id) { toast.error('Link to a job or invoice'); return; }
    setSaving(true);
    await onSave({ ...form, amount: parseFloat(form.amount) || 0 });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Invoice link */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Apply to Invoice (optional)</label>
        <Select value={form.invoice_id} onValueChange={handleInvoiceSelect}>
          <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select invoice..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>No specific invoice</SelectItem>
            {invoices.map(i => (
              <SelectItem key={i.id} value={i.id}>
                {i.invoice_number} — {i.customer_name} (${fmt(i.balance_due ?? i.amount)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedInvoice && (
          <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-700">
            Balance due: ${fmt(Number(selectedInvoice.balance_due ?? selectedInvoice.amount) - Number(selectedInvoice.amount_paid || 0))}
          </div>
        )}
      </div>

      {/* Job link */}
      {!form.invoice_id && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Linked Job</label>
          <Select value={form.job_id} onValueChange={handleJobSelect}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select job..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>No job linked</SelectItem>
              {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address || j.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Customer</label>
        <Input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} placeholder="Customer name" className="h-9 rounded-lg text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Amount Received *</label>
          <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" className="h-9 rounded-lg text-sm" />
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
          <label className="block text-xs font-medium text-muted-foreground mb-1">Check / Reference #</label>
          <Input value={form.reference_number} onChange={e => set('reference_number', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="rounded-lg text-sm min-h-12" />
      </div>

      <div className="flex gap-2 border-t border-border pt-4">
        <Button variant="outline" className="flex-1 h-9 rounded-xl" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1 h-9 rounded-xl" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Payment'}
        </Button>
      </div>
    </div>
  );
}