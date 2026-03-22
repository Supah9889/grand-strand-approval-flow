import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Trash2, Loader2, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { generateNumber } from '@/lib/financialHelpers';
import { getInternalRole } from '@/lib/adminAuth';

function newLine() {
  return { id: Date.now(), description: '', qty: 1, unit: 'ea', unit_cost: 0, total: 0, category: '' };
}

export default function POForm({ jobs = [], vendors = [], existingNums = [], onSave, onCancel, prefillJobId, prefillJobAddress }) {
  const role = getInternalRole();
  const [form, setForm] = useState({
    po_number: generateNumber('PO', existingNums),
    job_id: prefillJobId || '',
    job_address: prefillJobAddress || '',
    vendor_name: '',
    title: '',
    status: 'draft',
    date_created: new Date().toISOString().split('T')[0],
    expected_delivery: '',
    notes: '',
    internal_notes: '',
    created_by_name: role || 'admin',
    file_url: '',
  });
  const [lines, setLines] = useState([newLine()]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const updateLine = (id, key, val) => {
    setLines(ls => ls.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [key]: val };
      if (key === 'qty' || key === 'unit_cost') {
        updated.total = Number(updated.qty) * Number(updated.unit_cost);
      }
      return updated;
    }));
  };

  const removeLine = (id) => setLines(ls => ls.filter(l => l.id !== id));
  const addLine = () => setLines(ls => [...ls, newLine()]);

  const subtotal = lines.reduce((s, l) => s + Number(l.total || 0), 0);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('file_url', file_url);
    setUploading(false);
    toast.success('File attached');
  };

  const handleSave = async () => {
    if (!form.vendor_name) { toast.error('Vendor is required'); return; }
    setSaving(true);
    const job = jobs.find(j => j.id === form.job_id);
    await onSave({
      ...form,
      job_address: job?.address || form.job_address,
      line_items: JSON.stringify(lines),
      subtotal,
      tax: 0,
      total: subtotal,
    });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Identity */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">PO Number</label>
          <Input value={form.po_number} onChange={e => set('po_number', e.target.value)} className="h-9 rounded-lg text-sm font-mono" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['draft','sent','ordered','received','closed','canceled'].map(s => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Vendor *</label>
          <Select value={form.vendor_name} onValueChange={v => set('vendor_name', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select vendor..." /></SelectTrigger>
            <SelectContent>
              {vendors.map(v => <SelectItem key={v.id} value={v.company_name}>{v.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
          {!vendors.length && (
            <Input value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} placeholder="Enter vendor name" className="h-9 rounded-lg text-sm mt-1" />
          )}
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Linked Job</label>
          <Select value={form.job_id} onValueChange={v => set('job_id', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select job..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>No job linked</SelectItem>
              {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address || j.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">PO Title / Description</label>
          <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Paint materials for exterior" className="h-9 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Date Created</label>
          <Input type="date" value={form.date_created} onChange={e => set('date_created', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Expected Delivery</label>
          <Input type="date" value={form.expected_delivery} onChange={e => set('expected_delivery', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
      </div>

      {/* Line Items */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line Items</p>
          <button onClick={addLine} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus className="w-3 h-3" /> Add Item
          </button>
        </div>
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-12 gap-1 text-xs text-muted-foreground px-1 hidden sm:grid">
            <span className="col-span-5">Description</span>
            <span className="col-span-2">Qty</span>
            <span className="col-span-2">Unit $</span>
            <span className="col-span-2 text-right">Total</span>
            <span className="col-span-1" />
          </div>
          {lines.map(l => (
            <div key={l.id} className="grid grid-cols-12 gap-1 items-center">
              <Input value={l.description} onChange={e => updateLine(l.id, 'description', e.target.value)} placeholder="Item description" className="col-span-5 h-8 text-xs rounded-lg" />
              <Input type="number" min="0" value={l.qty} onChange={e => updateLine(l.id, 'qty', e.target.value)} className="col-span-2 h-8 text-xs rounded-lg text-center" />
              <Input type="number" min="0" step="0.01" value={l.unit_cost} onChange={e => updateLine(l.id, 'unit_cost', e.target.value)} className="col-span-2 h-8 text-xs rounded-lg text-right" />
              <span className="col-span-2 text-xs font-medium text-right pr-1">${Number(l.total).toFixed(2)}</span>
              <button onClick={() => removeLine(l.id)} className="col-span-1 flex justify-center text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-2 pt-2 border-t border-border/60">
          <span className="text-sm font-bold text-foreground">Total: ${subtotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Notes & File */}
      <div className="border-t border-border pt-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
          <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="rounded-lg text-sm min-h-12" placeholder="Vendor instructions, delivery notes..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Attach Document</label>
          <label className={`flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-lg px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            <Paperclip className="w-3.5 h-3.5" />
            {uploading ? 'Uploading...' : form.file_url ? 'File attached — change file' : 'Upload PO document / receipt'}
            <input type="file" className="hidden" onChange={handleFileUpload} />
          </label>
          {form.file_url && <p className="text-xs text-green-600 mt-1">✓ File attached</p>}
        </div>
      </div>

      <div className="flex gap-2 border-t border-border pt-4">
        <Button variant="outline" className="flex-1 h-9 rounded-xl" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1 h-9 rounded-xl" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save PO'}
        </Button>
      </div>
    </div>
  );
}