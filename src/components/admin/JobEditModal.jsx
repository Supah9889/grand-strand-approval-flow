import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, ShieldAlert } from 'lucide-react';
import { logAudit } from '@/lib/audit';
import { base44 } from '@/api/base44Client';

const LOCKED_FIELDS = ['address', 'customer_name', 'description', 'price'];

export default function JobEditModal({ job, open, onClose, onSave, saving }) {
  // Derive street-only from existing address (strip city/state/zip if present)
  const initialStreet = job.city ? job.address?.split(',')[0]?.trim() || job.address : job.address;
  const [form, setForm] = useState({ ...job, _street: initialStreet });
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const isLocked = job.locked && !unlocked;
  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleUnlock = async () => {
    setUnlocking(true);
    await base44.entities.Job.update(job.id, { locked: false });
    await logAudit(job.id, 'record_unlocked', 'Admin', 'Admin unlocked signed record for editing');
    setUnlocked(true);
    setUnlocking(false);
  };

  const handleSave = async () => {
    const wasLocked = job.locked;
    const fullAddress = [form._street, form.city, form.state && form.zip ? `${form.state} ${form.zip}` : (form.state || form.zip)].filter(Boolean).join(', ');
    const { _street, ...rest } = form;
    onSave({ ...rest, price: Number(rest.price), address: fullAddress || rest.address });
    // log after save — parent calls invalidate then closes modal
    // We log optimistically here
    if (wasLocked) {
      await logAudit(job.id, 'post_sign_edit', 'Admin', 'Core fields edited after customer signature');
    } else {
      await logAudit(job.id, 'job_edited', 'Admin', 'Job details updated');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Job
            {job.locked && (
              <span className={`inline-flex items-center gap-1 text-xs font-normal px-2 py-0.5 rounded-full ${
                unlocked ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'
              }`}>
                <Lock className="w-3 h-3" />
                {unlocked ? 'Unlocked' : 'Signed & Locked'}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {job.locked && !unlocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-800">Record is locked</p>
              <p className="text-xs text-amber-700 mt-0.5">
                This job was signed by the customer. Core fields are read-only. Admin unlock required to edit.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={handleUnlock}
                disabled={unlocking}
              >
                {unlocking ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
                Unlock for Editing
              </Button>
            </div>
          </div>
        )}

        {unlocked && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl px-3 py-2 flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-destructive shrink-0" />
            <p className="text-xs text-destructive">Any changes will be logged as post-signature edits.</p>
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Address *</Label>
            <Input
              value={form.address || ''} onChange={e => set('address', e.target.value)}
              className="h-10 rounded-xl text-sm" disabled={isLocked && LOCKED_FIELDS.includes('address')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Customer Name *</Label>
            <Input
              value={form.customer_name || ''} onChange={e => set('customer_name', e.target.value)}
              className="h-10 rounded-xl text-sm" disabled={isLocked && LOCKED_FIELDS.includes('customer_name')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description *</Label>
            <Textarea
              value={form.description || ''} onChange={e => set('description', e.target.value)}
              className="rounded-xl text-sm min-h-16" disabled={isLocked && LOCKED_FIELDS.includes('description')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Price *</Label>
              <Input
                type="number" value={form.price || ''} onChange={e => set('price', e.target.value)}
                className="h-10 rounded-xl text-sm" disabled={isLocked && LOCKED_FIELDS.includes('price')}
              />
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
              disabled={!form.address || !form.customer_name || !form.description || !form.price || saving || (job.locked && !unlocked)}
              onClick={handleSave}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}