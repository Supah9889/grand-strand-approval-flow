import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { getInternalRole } from '@/lib/adminAuth';

export default function ConvertToJobModal({ lead, open, onClose, onConverted }) {
  const queryClient = useQueryClient();
  const role = getInternalRole();

  const [form, setForm] = useState({
    address: lead?.property_address || '',
    customer_name: lead?.contact_name || '',
    description: lead?.work_scope_summary || lead?.presale_job_title || '',
    price: lead?.approximate_value || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
  });
  const [done, setDone] = useState(false);
  const [newJobId, setNewJobId] = useState('');

  const convertMutation = useMutation({
    mutationFn: async () => {
      // Create job
      const job = await base44.entities.Job.create({
        address: form.address,
        customer_name: form.customer_name,
        description: form.description,
        price: Number(form.price) || 0,
        email: form.email,
        phone: form.phone,
        status: 'pending',
      });

      // Update lead
      await base44.entities.Lead.update(lead.id, {
        status: 'converted_to_job',
        converted_to_job: true,
        linked_job_id: job.id,
        linked_job_address: job.address,
      });

      // Log activity
      await base44.entities.LeadActivity.create({
        lead_id: lead.id,
        action: 'converted_to_job',
        detail: `Converted to Job: ${job.address}`,
        actor: role || 'admin',
        timestamp: new Date().toISOString(),
      });

      return job;
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities', lead.id] });
      setNewJobId(job.id);
      setDone(true);
      toast.success('Lead converted to job successfully');
      onConverted?.(job);
    },
  });

  if (!open || !lead) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="cvt-bg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        key="cvt-panel"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Convert to Active Job</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Review fields before creating the job record</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {done ? (
            <div className="p-6 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
              <div>
                <p className="text-base font-semibold text-foreground">Conversion Complete</p>
                <p className="text-sm text-muted-foreground mt-1">This lead is now an active job in the system.</p>
              </div>
              <Button className="w-full h-10 rounded-xl" onClick={onClose}>Done</Button>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="bg-secondary/50 rounded-xl p-3 text-xs text-muted-foreground">
                Fields below will be used to create the new job record. Edit before confirming.
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Address *</label>
                  <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="h-9 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Customer Name *</label>
                  <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} className="h-9 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Description *</label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="rounded-lg text-sm min-h-16" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Price ($)</label>
                    <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="h-9 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
                    <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="h-9 rounded-lg text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="h-9 rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={onClose}>Cancel</Button>
                <Button
                  className="flex-1 h-10 rounded-xl gap-2"
                  disabled={!form.address || !form.customer_name || !form.description || convertMutation.isPending}
                  onClick={() => convertMutation.mutate()}
                >
                  {convertMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><ArrowRight className="w-4 h-4" /> Convert to Job</>}
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}