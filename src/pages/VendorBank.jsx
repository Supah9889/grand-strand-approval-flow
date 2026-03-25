import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Search, Building2, Phone, Mail, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseISO, isPast, isToday, format } from 'date-fns';
import AppLayout from '../components/AppLayout';
import VendorDetailPanel from '../components/vendors/VendorDetailPanel';
import { toast } from 'sonner';
import { getInternalRole, isAdmin as getIsAdmin } from '@/lib/adminAuth';
import { audit } from '@/lib/audit';

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

const emptyVendor = { company_name: '', contact_name: '', phone: '', email: '', address: '', type: 'vendor', notes: '', active: true, coi_expiration_date: '', workers_comp_expiration_date: '' };

export default function VendorBank() {
  const role = getInternalRole();
  const isOwnerOrAdmin = getIsAdmin();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [form, setForm] = useState(emptyVendor);
  const queryClient = useQueryClient();

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => base44.entities.Vendor.list('company_name'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Vendor.create(data),
    onSuccess: (vendor) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      audit.vendor.created(vendor.id, role || 'Admin', vendor.company_name, { vendor_id: vendor.id });
      setForm(emptyVendor);
      setShowForm(false);
      toast.success('Vendor added');
    },
  });

  const isDateExpired = (dateStr) => {
    if (!dateStr) return false;
    try {
      const date = parseISO(dateStr);
      return isPast(date) && !isToday(date);
    } catch {
      return false;
    }
  };

  const filtered = vendors.filter(v => {
    const q = search.toLowerCase();
    return !q ||
      v.company_name?.toLowerCase().includes(q) ||
      v.contact_name?.toLowerCase().includes(q) ||
      v.type?.toLowerCase().includes(q);
  });

  return (
    <AppLayout title="Vendor Bank">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Vendor / Referral Bank</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{vendors.length} records</p>
          </div>
          <Button className="h-9 rounded-xl text-sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add
          </Button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-card border border-border rounded-2xl p-5 space-y-3 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">New Vendor / Referral</p>
                <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <Input placeholder="Company Name *" value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} className="h-10 rounded-xl text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Contact Name" value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} className="h-10 rounded-xl text-sm" />
                <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                  <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="h-10 rounded-xl text-sm" />
                <Input placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="h-10 rounded-xl text-sm" />
              </div>
              <Input placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="h-10 rounded-xl text-sm" />
              <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="rounded-xl text-sm min-h-14" />
              
              {isOwnerOrAdmin && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Insurance Compliance (Optional)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">COI Expiration</label>
                      <Input type="date" value={form.coi_expiration_date} onChange={e => setForm({...form, coi_expiration_date: e.target.value})} className="h-10 rounded-xl text-sm mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Workers' Comp Expiration</label>
                      <Input type="date" value={form.workers_comp_expiration_date} onChange={e => setForm({...form, workers_comp_expiration_date: e.target.value})} className="h-10 rounded-xl text-sm mt-1" />
                    </div>
                  </div>
                </>
              )}

              <Button className="w-full h-10 rounded-xl" disabled={!form.company_name || createMutation.isPending} onClick={() => createMutation.mutate(form)}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Vendor'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl text-sm" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No vendors found.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(v => {
              const coiExpired = isDateExpired(v.coi_expiration_date);
              const wcExpired = isDateExpired(v.workers_comp_expiration_date);
              const hasExpiredCompliance = coiExpired || wcExpired;

              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedVendor(v)}
                  className="bg-card border border-border rounded-xl p-4 w-full text-left hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Building2 className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{v.company_name}</p>
                        {hasExpiredCompliance && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <AlertCircle className="w-3 h-3 text-destructive" />
                            <span className="text-xs text-destructive font-medium">Compliance expired</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground shrink-0">
                      {TYPES.find(t => t.value === v.type)?.label || v.type}
                    </span>
                  </div>
                  {v.contact_name && <p className="text-xs text-muted-foreground mt-1 pl-6">{v.contact_name}</p>}
                  <div className="flex items-center gap-4 mt-2 pl-6 flex-wrap">
                    {v.phone && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="w-3 h-3" />{v.phone}</span>}
                    {v.email && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="w-3 h-3" />{v.email}</span>}
                  </div>
                  {(v.coi_expiration_date || v.workers_comp_expiration_date) && (
                    <div className="flex items-center gap-4 mt-2 pl-6 text-xs flex-wrap">
                      {v.coi_expiration_date && (
                        <span className={coiExpired ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                          COI: {format(parseISO(v.coi_expiration_date), 'MMM d, yyyy')}
                          {coiExpired && ' (Expired)'}
                        </span>
                      )}
                      {v.workers_comp_expiration_date && (
                        <span className={wcExpired ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                          WC: {format(parseISO(v.workers_comp_expiration_date), 'MMM d, yyyy')}
                          {wcExpired && ' (Expired)'}
                        </span>
                      )}
                    </div>
                  )}
                  {v.notes && <p className="text-xs text-muted-foreground italic mt-2 pl-6">{v.notes}</p>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}