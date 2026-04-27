import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Trash2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { generateNumber, INVOICE_STATUS_CONFIG } from '@/lib/financialHelpers';
import { getInternalRole } from '@/lib/adminAuth';

function newLine() {
  return { id: Date.now(), description: '', qty: 1, unit: 'ea', unit_price: 0, total: 0 };
}

export default function InvoiceFullForm({
  jobs = [], estimates = [], changeOrders = [], existingNums = [],
  onSave, onCancel, prefillJobId, initialData,
}) {
  const role = getInternalRole();
  const isEdit = !!initialData;

  const [form, setForm] = useState(() => {
    if (initialData) {
      return {
        invoice_number: initialData.invoice_number || '',
        job_id: initialData.job_id || '',
        job_address: initialData.job_address || '',
        customer_name: initialData.customer_name || '',
        invoice_date: initialData.invoice_date || new Date().toISOString().split('T')[0],
        due_date: initialData.due_date || '',
        status: initialData.status || 'draft',
        source_type: initialData.source_type || 'manual',
        source_id: initialData.source_id || '',
        title: initialData.title || '',
        notes: initialData.notes || '',
        internal_notes: initialData.internal_notes || '',
        tax_rate: initialData.tax_rate || 0,
        created_by_name: initialData.created_by_name || role || 'admin',
        qb_sync_status: initialData.qb_sync_status || 'not_synced',
      };
    }
    return {
      invoice_number: generateNumber('INV', existingNums),
      job_id: prefillJobId || '',
      job_address: '',
      customer_name: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '',
      status: 'draft',
      source_type: 'manual',
      source_id: '',
      title: '',
      notes: '',
      internal_notes: '',
      tax_rate: 0,
      created_by_name: role || 'admin',
      qb_sync_status: 'not_synced',
    };
  });

  const [lines, setLines] = useState(() => {
    if (initialData?.line_items) {
      try {
        const parsed = JSON.parse(initialData.line_items);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(l => ({ ...l, id: l.id || Date.now() + Math.random() }));
        }
      } catch {}
    }
    return [newLine()];
  });

  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const updateLine = (id, key, val) => {
    setLines(ls => ls.map(l => {
      if (l.id !== id) return l;
      const u = { ...l, [key]: val };
      if (key === 'qty' || key === 'unit_price') u.total = Number(u.qty) * Number(u.unit_price);
      return u;
    }));
  };

  const subtotal = lines.reduce((s, l) => s + Number(l.total || 0), 0);
  const taxAmt = subtotal * (Number(form.tax_rate) / 100);
  const total = subtotal + taxAmt;

  const handleJobSelect = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    set('job_id', jobId);
    if (job) {
      set('job_address', job.address || '');
      set('customer_name', job.customer_name || '');
    }
  };

  const handleEstimateSelect = (estId) => {
    set('source_id', estId);
    const est = estimates.find(e => e.id === estId);
    if (est) {
      set('customer_name', est.client_name || '');
      set('title', est.title || '');
      if (est.line_items) {
        try {
          const estLines = JSON.parse(est.line_items);
          setLines(estLines.map(l => ({ id: Date.now() + Math.random(), description: l.description || '', qty: l.qty || 1, unit: 'ea', unit_price: l.unit_price || 0, total: (l.qty || 1) * (l.unit_price || 0) })));
        } catch {}
      }
    }
  };

  const handleCOSelect = (coId) => {
    set('source_id', coId);
    const co = changeOrders.find(c => c.id === coId);
    if (co) {
      set('title', co.title || '');
      set('customer_name', co.customer_name || '');
      if (co.cost_impact) {
        setLines([{ id: Date.now(), description: co.title || 'Change Order', qty: 1, unit: 'ea', unit_price: Number(co.total_financial_impact || 0), total: Number(co.total_financial_impact || 0) }]);
      }
    }
  };

  const handleSave = async () => {
    if (!form.customer_name) { toast.error('Customer name is required'); return; }
    if (!form.job_id) { toast.error('Job linking is required. Please select a job.'); return; }
    setSaving(true);
    await onSave({
      ...form,
      line_items: JSON.stringify(lines),
      subtotal,
      tax_amount: taxAmt,
      amount: total,
      balance_due: isEdit ? (initialData.balance_due ?? total) : total,
      amount_paid: isEdit ? (initialData.amount_paid ?? 0) : 0,
    });
    setSaving(false);
  };

  const approvedCOs = changeOrders.filter(co => co.status === 'approved');

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      {/* Identity */}
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

        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Linked Job <span className="text-destructive">*</span></label>
          <Select value={form.job_id || ''} onValueChange={handleJobSelect}>
            <SelectTrigger className={`h-9 rounded-lg text-sm ${!form.job_id ? 'border-destructive/50' : ''}`}><SelectValue placeholder="Select job..." /></SelectTrigger>
            <SelectContent>
              {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address || j.title}</SelectItem>)}
            </SelectContent>
          </Select>
          {!form.job_id && <p className="text-xs text-destructive mt-1">Job linking is required for all invoices.</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Source Type</label>
          <Select value={form.source_type} onValueChange={v => { set('source_type', v); set('source_id', ''); }}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="estimate">From Estimate</SelectItem>
              <SelectItem value="change_order">From Change Order</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form.source_type === 'estimate' && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Select Estimate</label>
            <Select value={form.source_id} onValueChange={handleEstimateSelect}>
              <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Pick estimate..." /></SelectTrigger>
              <SelectContent>
                {estimates.map(e => <SelectItem key={e.id} value={e.id}>{e.estimate_number} — {e.client_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {form.source_type === 'change_order' && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Select Change Order</label>
            <Select value={form.source_id} onValueChange={handleCOSelect}>
              <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Pick CO..." /></SelectTrigger>
              <SelectContent>
                {approvedCOs.map(co => <SelectItem key={co.id} value={co.id}>{co.co_number} — {co.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Customer / Billing Target *</label>
          <Input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} placeholder="Customer or billing target name" className="h-9 rounded-lg text-sm" />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Invoice Title</label>
          <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Final Invoice — Exterior Repaint" className="h-9 rounded-lg text-sm" />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Invoice Date</label>
          <Input type="date" value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Due Date</label>
          <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
      </div>

      {/* Line Items */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line Items</p>
          <button onClick={() => setLines(ls => [...ls, newLine()])} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus className="w-3 h-3" /> Add Line
          </button>
        </div>
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-12 gap-1 text-xs text-muted-foreground px-1">
            <span className="col-span-5">Description</span><span className="col-span-2">Qty</span><span className="col-span-2">Price</span><span className="col-span-2 text-right">Total</span><span className="col-span-1" />
          </div>
          {lines.map(l => (
            <div key={l.id} className="grid grid-cols-12 gap-1 items-center">
              <Input value={l.description} onChange={e => updateLine(l.id, 'description', e.target.value)} placeholder="Description" className="col-span-5 h-8 text-xs rounded-lg" />
              <Input type="number" min="0" value={l.qty} onChange={e => updateLine(l.id, 'qty', e.target.value)} className="col-span-2 h-8 text-xs rounded-lg text-center" />
              <Input type="number" min="0" step="0.01" value={l.unit_price} onChange={e => updateLine(l.id, 'unit_price', e.target.value)} className="col-span-2 h-8 text-xs rounded-lg text-right" />
              <span className="col-span-2 text-xs font-medium text-right pr-1">${Number(l.total).toFixed(2)}</span>
              <button onClick={() => setLines(ls => ls.filter(x => x.id !== l.id))} className="col-span-1 flex justify-center text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">${subtotal.toFixed(2)}</span></div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tax Rate (%)</span>
            <Input type="number" min="0" max="100" step="0.1" value={form.tax_rate} onChange={e => set('tax_rate', e.target.value)} className="w-20 h-7 text-right text-sm rounded-lg" />
          </div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax</span><span className="font-medium">${taxAmt.toFixed(2)}</span></div>
          <div className="flex justify-between text-base font-bold border-t border-border pt-2"><span>Total</span><span className="text-primary">${total.toFixed(2)}</span></div>
        </div>
      </div>

      {/* Notes */}
      <div className="border-t border-border pt-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Client-Facing Notes</label>
          <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="rounded-lg text-sm min-h-12" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Internal Notes</label>
          <Textarea value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)} className="rounded-lg text-sm min-h-10" />
        </div>
      </div>

      <div className="flex gap-2 border-t border-border pt-4 sticky bottom-0 bg-card pb-1">
        <Button variant="outline" className="flex-1 h-9 rounded-xl" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1 h-9 rounded-xl gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> {isEdit ? 'Save Changes' : 'Save Invoice'}</>}
        </Button>
      </div>
    </div>
  );
}