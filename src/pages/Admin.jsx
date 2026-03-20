import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Trash2, MapPin, CheckCircle2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CompanyLogo from '../components/CompanyLogo';
import { toast } from 'sonner';

const emptyJob = { address: '', customer_name: '', description: '', price: '', buildertrend_id: '' };

export default function Admin() {
  const [form, setForm] = useState(emptyJob);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Job.create({ ...data, price: Number(data.price), status: 'pending' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      setForm(emptyJob);
      setShowForm(false);
      toast.success('Job created successfully');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Job.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      toast.success('Job deleted');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.address || !form.customer_name || !form.description || !form.price) return;
    createMutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-background font-inter">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex flex-col items-center mb-6">
          <CompanyLogo className="h-12 w-auto mb-4" />
          <h1 className="text-xl font-semibold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground text-sm">Manage jobs for customer approval</p>
        </div>

        <Button
          className="w-full h-11 rounded-xl mb-6"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="w-4 h-4 mr-2" />
          {showForm ? 'Cancel' : 'Add New Job'}
        </Button>

        <AnimatePresence>
          {showForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSubmit}
              className="bg-card border border-border rounded-2xl p-5 mb-6 space-y-4 overflow-hidden"
            >
              <Input
                placeholder="Address *"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="h-11 rounded-xl text-sm"
              />
              <Input
                placeholder="Customer Name *"
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                className="h-11 rounded-xl text-sm"
              />
              <Textarea
                placeholder="Job Description *"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-xl text-sm min-h-20"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  placeholder="Price *"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="h-11 rounded-xl text-sm"
                />
                <Input
                  placeholder="Buildertrend ID"
                  value={form.buildertrend_id}
                  onChange={(e) => setForm({ ...form, buildertrend_id: e.target.value })}
                  className="h-11 rounded-xl text-sm"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 rounded-xl"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Create Job'
                )}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-12">No jobs yet. Add one above.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-card border border-border rounded-xl p-4 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{job.address}</p>
                      <p className="text-xs text-muted-foreground">{job.customer_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={job.status === 'approved' ? 'default' : 'secondary'} className="text-xs">
                      {job.status === 'approved' ? (
                        <><CheckCircle2 className="w-3 h-3 mr-1" />Approved</>
                      ) : (
                        <><Clock className="w-3 h-3 mr-1" />Pending</>
                      )}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(job.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pl-6 line-clamp-1">{job.description}</p>
                <div className="flex items-center justify-between pl-6">
                  <p className="text-sm font-semibold text-primary">
                    ${Number(job.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  {job.review_rating && (
                    <Badge variant="outline" className="text-xs capitalize">{job.review_rating.replace('_', ' ')}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}