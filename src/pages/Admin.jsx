import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Loader2, Upload, List, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import CompanyLogo from '../components/CompanyLogo';
import AdminPinGate from '../components/admin/AdminPinGate';
import CsvImportFlow from '../components/admin/CsvImportFlow';
import JobsTable from '../components/admin/JobsTable';
import { isAdminAuthed, adminLogout } from '@/lib/adminAuth';
import { toast } from 'sonner';

const emptyJob = { address: '', customer_name: '', description: '', price: '', buildertrend_id: '', email: '', phone: '' };

export default function Admin() {
  const [authed, setAuthed] = useState(isAdminAuthed());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyJob);
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date'),
    enabled: authed,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Job.create({ ...data, price: Number(data.price), status: 'pending' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setForm(emptyJob);
      setShowForm(false);
      toast.success('Job created');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.address || !form.customer_name || !form.description || !form.price) return;
    createMutation.mutate(form);
  };

  const handleLogout = () => {
    adminLogout();
    setAuthed(false);
  };

  if (!authed) {
    return <AdminPinGate onAuthed={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-background font-inter">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CompanyLogo className="h-10 w-auto" />
            <div>
              <h1 className="text-base font-semibold text-foreground leading-tight">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">Grand Strand Custom Painting</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="w-4 h-4 mr-1.5" />
            Lock
          </Button>
        </div>

        <Tabs defaultValue="jobs">
          <TabsList className="w-full rounded-xl mb-6 h-11">
            <TabsTrigger value="jobs" className="flex-1 rounded-lg text-sm gap-2">
              <List className="w-4 h-4" />
              Jobs
            </TabsTrigger>
            <TabsTrigger value="import" className="flex-1 rounded-lg text-sm gap-2">
              <Upload className="w-4 h-4" />
              CSV Import
            </TabsTrigger>
          </TabsList>

          {/* JOBS TAB */}
          <TabsContent value="jobs" className="mt-0 space-y-4">
            <Button
              className="w-full h-11 rounded-xl"
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
                  className="bg-card border border-border rounded-2xl p-5 space-y-3 overflow-hidden"
                >
                  <Input placeholder="Address *" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="h-11 rounded-xl text-sm" />
                  <Input placeholder="Customer Name *" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} className="h-11 rounded-xl text-sm" />
                  <Textarea placeholder="Job Description *" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="rounded-xl text-sm min-h-20" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input type="number" placeholder="Price *" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="h-11 rounded-xl text-sm" />
                    <Input placeholder="Buildertrend ID" value={form.buildertrend_id} onChange={e => setForm({ ...form, buildertrend_id: e.target.value })} className="h-11 rounded-xl text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-11 rounded-xl text-sm" />
                    <Input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-11 rounded-xl text-sm" />
                  </div>
                  <Button type="submit" className="w-full h-11 rounded-xl" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Job'}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>

            <JobsTable jobs={jobs} isLoading={isLoading} />
          </TabsContent>

          {/* IMPORT TAB */}
          <TabsContent value="import" className="mt-0">
            <div className="bg-card border border-border rounded-2xl p-5">
              <CsvImportFlow existingJobs={jobs} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}