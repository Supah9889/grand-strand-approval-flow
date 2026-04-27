import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { X, Loader2, Edit2, Check } from 'lucide-react';
import VendorCompliancePanel from './VendorCompliancePanel';
import { toast } from 'sonner';
import { getInternalRole, isAdmin as getIsAdmin } from '@/lib/adminAuth';

const TYPES = [
  { value: 'vendor', label: 'Vendor' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'builder', label: 'Builder' },
  { value: 'property_manager', label: 'Property Manager' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'referral', label: 'Referral' },
  { value: 'homeowner_contact', label: 'Homeowner Contact' },
  { value: 'other', label: 'Other' },
];

export default function VendorDetailPanel({ vendor, onClose, onUpdate }) {
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const isOwnerOrAdmin = getIsAdmin();

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    company_name: vendor.company_name,
    contact_name: vendor.contact_name || '',
    phone: vendor.phone || '',
    email: vendor.email || '',
    address: vendor.address || '',
    city: vendor.city || '',
    state: vendor.state || '',
    zip: vendor.zip || '',
    type: vendor.type || 'vendor',
    notes: vendor.notes || '',
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Vendor.update(vendor.id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      onUpdate(updated);
      setIsEditing(false);
      toast.success('Vendor updated');
    },
  });

  const handleSave = () => {
    if (!form.company_name) {
      toast.error('Company name is required');
      return;
    }
    updateMutation.mutate(form);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{vendor.company_name}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Basic Info */}
          {!isEditing ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor Information</p>
                {isOwnerOrAdmin && (
                  <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium">Type</p>
                  <p className="text-sm text-foreground">{TYPES.find((t) => t.value === vendor.type)?.label || vendor.type}</p>
                </div>
                {vendor.contact_name && (
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium">Contact</p>
                    <p className="text-sm text-foreground">{vendor.contact_name}</p>
                  </div>
                )}
              </div>

              {vendor.phone && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium">Phone</p>
                  <a href={`tel:${vendor.phone}`} className="text-sm text-primary hover:underline">
                    {vendor.phone}
                  </a>
                </div>
              )}

              {vendor.email && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium">Email</p>
                  <a href={`mailto:${vendor.email}`} className="text-sm text-primary hover:underline">
                    {vendor.email}
                  </a>
                </div>
              )}

              {vendor.address && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium">Address</p>
                  <p className="text-sm text-foreground">
                    {vendor.address}
                    {vendor.city ? `, ${vendor.city}` : ''}
                    {vendor.state ? `, ${vendor.state}` : ''}
                    {vendor.zip ? ` ${vendor.zip}` : ''}
                  </p>
                </div>
              )}

              {vendor.notes && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium">Notes</p>
                  <p className="text-sm text-foreground">{vendor.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edit Vendor Information</p>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Company Name *</label>
                <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="h-8 rounded-lg text-sm mt-1" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger className="h-8 rounded-lg text-sm mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Contact Name</label>
                  <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="h-8 rounded-lg text-sm mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Phone</label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 rounded-lg text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-8 rounded-lg text-sm mt-1" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Address</label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-8 rounded-lg text-sm mt-1" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">City</label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="h-8 rounded-lg text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">State</label>
                  <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength="2" className="h-8 rounded-lg text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Zip</label>
                  <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} className="h-8 rounded-lg text-sm mt-1" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-lg text-sm min-h-12 mt-1" />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-8 rounded-lg text-xs" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button className="flex-1 h-8 rounded-lg text-xs gap-1" onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Save Changes
                </Button>
              </div>
            </div>
          )}

          {/* Compliance Panel */}
          <VendorCompliancePanel
            vendor={vendor}
            onUpdate={(updated) => {
              queryClient.invalidateQueries({ queryKey: ['vendors'] });
              onUpdate(updated);
            }}
          />
        </div>
      </div>
    </div>
  );
}