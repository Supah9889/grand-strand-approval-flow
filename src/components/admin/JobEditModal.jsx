import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export default function JobEditModal({ job, open, onClose, onSave, saving }) {
  const [form, setForm] = useState({ ...job });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit Job</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Address *</Label>
            <Input value={form.address || ''} onChange={e => set('address', e.target.value)} className="h-10 rounded-xl text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Customer Name *</Label>
            <Input value={form.customer_name || ''} onChange={e => set('customer_name', e.target.value)} className="h-10 rounded-xl text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description *</Label>
            <Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} className="rounded-xl text-sm min-h-16" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Price *</Label>
              <Input type="number" value={form.price || ''} onChange={e => set('price', e.target.value)} className="h-10 rounded-xl text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status || 'pending'} onValueChange={v => set('status', v)}>
                <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} className="h-10 rounded-xl text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone || ''} onChange={e => set('phone', e.target.value)} className="h-10 rounded-xl text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Buildertrend ID</Label>
            <Input value={form.buildertrend_id || ''} onChange={e => set('buildertrend_id', e.target.value)} className="h-10 rounded-xl text-sm" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1 rounded-xl"
              disabled={!form.address || !form.customer_name || !form.description || !form.price || saving}
              onClick={() => onSave({ ...form, price: Number(form.price) })}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}