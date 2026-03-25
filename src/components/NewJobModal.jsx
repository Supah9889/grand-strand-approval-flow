import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { X, Loader2, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';
import { JOB_GROUP_CONFIG, JOB_LIFECYCLE_CONFIG } from '@/lib/jobHelpers';
import { validateJob } from '@/lib/validation';
import ValidationPanel from '@/components/shared/ValidationPanel';

const JOB_COLORS = [
  '#2563eb', // blue
  '#16a34a', // green
  '#dc2626', // red
  '#d97706', // amber
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#be185d', // pink
  '#374151', // slate
];

const empty = {
  title: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  customer_name: '',
  phone: '',
  email: '',
  description: '',
  price: '',
  color: JOB_COLORS[0],
  status: 'pending',
  lifecycle_status: 'open',
  job_group: 'painting',
};

export default function NewJobModal({ open, onClose }) {
  const [form, setForm] = useState(empty);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Assemble a full address string for downstream display/geo use
      const fullAddress = [data.address, data.city, data.state && data.zip ? `${data.state} ${data.zip}` : (data.state || data.zip)].filter(Boolean).join(', ');
      const job = await base44.entities.Job.create({
        ...data,
        price: data.price ? Number(data.price) : 0,
        // Keep `address` as the full assembled string for all display/geo usage;
        // city/state/zip are stored separately in their own fields.
        address: fullAddress || data.address,
      });
      await logAudit(job.id, 'job_created', 'Admin', `New job created: ${data.address}`);
      return job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['cal-jobs'] });
      toast.success('Job created');
      setForm(empty);
      onClose();
    },
  });

  const [touched, setTouched] = useState(false);
  const issues = validateJob({ ...form, price: form.price ? Number(form.price) : 0 });
  const errors = issues.filter(i => i.level === 'error');

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (errors.length > 0) return;
    createMutation.mutate(form);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="nj-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="nj-modal"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto overflow-y-auto max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                    <Briefcase className="w-3.5 h-3.5 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">New Job</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">

                {/* Color picker */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Job Color</p>
                  <div className="flex gap-2 flex-wrap">
                    {JOB_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, color: c }))}
                        className="w-7 h-7 rounded-full border-2 transition-all"
                        style={{
                          backgroundColor: c,
                          borderColor: form.color === c ? '#000' : 'transparent',
                          transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <Input
                  placeholder="Job Title"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="h-10 rounded-xl text-sm"
                />
                {/* Structured address fields */}
                <Input
                  placeholder="Street Address *"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="h-10 rounded-xl text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="City *"
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    className="h-10 rounded-xl text-sm col-span-1"
                  />
                  <Input
                    placeholder="State *"
                    value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                    className="h-10 rounded-xl text-sm"
                    maxLength={2}
                  />
                  <Input
                    placeholder="ZIP *"
                    value={form.zip}
                    onChange={e => setForm(f => ({ ...f, zip: e.target.value }))}
                    className="h-10 rounded-xl text-sm"
                  />
                </div>
                <Input
                  placeholder="Customer Name *"
                  value={form.customer_name}
                  onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                  className="h-10 rounded-xl text-sm"
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Phone"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="h-10 rounded-xl text-sm"
                  />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="h-10 rounded-xl text-sm"
                  />
                </div>
                <Textarea
                  placeholder="Description *"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="rounded-xl text-sm min-h-16"
                  required
                />
                <Input
                  type="number"
                  placeholder="Price ($)"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  className="h-10 rounded-xl text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Job Group</p>
                    <Select value={form.job_group} onValueChange={v => setForm(f => ({ ...f, job_group: v }))}>
                      <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(JOB_GROUP_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Lifecycle Status</p>
                    <Select value={form.lifecycle_status} onValueChange={v => setForm(f => ({ ...f, lifecycle_status: v }))}>
                      <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(JOB_LIFECYCLE_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {touched && issues.length > 0 && (
                  <ValidationPanel issues={issues} />
                )}
                <div className="pt-1 flex gap-2">
                  <Button type="button" variant="outline" className="flex-1 h-10 rounded-xl" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Job'}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}