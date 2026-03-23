import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Loader2, Upload, List, LogOut, LayoutDashboard, ShieldAlert, Users, Download, BarChart2, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import AdminPinGate from '../components/admin/AdminPinGate';
import CsvImportFlow from '../components/admin/CsvImportFlow';
import JobsTable from '../components/admin/JobsTable';
import DashboardStats from '../components/admin/DashboardStats';
import JobFilters from '../components/admin/JobFilters';
import ReportingPanel from '../components/admin/ReportingPanel';
import QBExportPanel from '../components/admin/QBExportPanel';
import { isAdminAuthed, adminLogout, getInternalRole } from '@/lib/adminAuth';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';
import { format } from 'date-fns';

const emptyJob = { address: '', customer_name: '', description: '', price: '', buildertrend_id: '', email: '', phone: '' };

const SECTION_FILTER = {
  pending:  j => j.status === 'pending',
  approved: j => j.status === 'approved' && !j.review_rating,
  reviewed: j => j.status === 'approved' && !!j.review_rating,
  archived: j => j.status === 'archived',
};

const SECTION_LABELS = {
  pending: 'Pending Signatures',
  approved: 'Signed Jobs',
  reviewed: 'Reviewed / Completed',
  archived: 'Archived',
};

function exportCsv(jobs) {
  const headers = ['Address', 'Customer', 'Description', 'Price', 'Status', 'Email', 'Phone', 'BT ID', 'Signed At', 'Rating'];
  const rows = jobs.map(j => [
    j.address, j.customer_name, j.description, j.price, j.status,
    j.email || '', j.phone || '', j.buildertrend_id || '',
    j.approval_timestamp ? format(new Date(j.approval_timestamp), 'yyyy-MM-dd HH:mm') : '',
    j.review_rating || '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gscp-jobs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
}

export default function Admin() {
  const [authed, setAuthed] = useState(isAdminAuthed());
  const [role, setRole] = useState(getInternalRole());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyJob);
  const [activeSection, setActiveSection] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: 'all', date: '' });
  const queryClient = useQueryClient();

  const isAdminRole = role === 'admin';

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date'),
    enabled: authed,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const job = await base44.entities.Job.create({ ...data, price: Number(data.price), status: 'pending' });
      await logAudit(job.id, 'job_created', 'Admin', `Manually created: ${data.address}`);
      return job;
    },
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
    setRole(null);
  };

  const handleAuthed = (r) => {
    setRole(r);
    setAuthed(true);
  };

  if (!authed) {
    return <AdminPinGate onAuthed={handleAuthed} />;
  }

  // Apply section filter first, then search/status/date filters
  const sectionFiltered = activeSection ? jobs.filter(SECTION_FILTER[activeSection]) : jobs;

  const displayedJobs = sectionFiltered.filter(j => {
    const q = filters.search.toLowerCase();
    const matchSearch = !q ||
      j.address?.toLowerCase().includes(q) ||
      j.customer_name?.toLowerCase().includes(q);
    const matchStatus = filters.status === 'all' || j.status === filters.status;
    const matchDate = !filters.date ||
      (j.created_date && j.created_date.startsWith(filters.date));
    return matchSearch && matchStatus && matchDate;
  });

  return (
    <AppLayout title={isAdminRole ? 'Admin Mode' : 'Staff Mode'}>
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Role badge + sign out */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
              isAdminRole ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
            }`}>
              {isAdminRole ? <ShieldAlert className="w-3 h-3" /> : <Users className="w-3 h-3" />}
              {isAdminRole ? 'Admin Session' : 'Staff Session'}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground h-8">
            <LogOut className="w-4 h-4 mr-1.5" />
            Sign Out
          </Button>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className={`w-full rounded-xl mb-6 h-11 ${isAdminRole ? 'grid-cols-3' : 'grid-cols-1'}`}>
            <TabsTrigger value="dashboard" className="flex-1 rounded-lg text-sm gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            {isAdminRole && (
              <>
                <TabsTrigger value="jobs" className="flex-1 rounded-lg text-sm gap-2">
                  <List className="w-4 h-4" />
                  Manage
                </TabsTrigger>
                <TabsTrigger value="import" className="flex-1 rounded-lg text-sm gap-2">
                  <Upload className="w-4 h-4" />
                  Import
                </TabsTrigger>
                <TabsTrigger value="reporting" className="flex-1 rounded-lg text-sm gap-2">
                  <BarChart2 className="w-4 h-4" />
                  Reports
                </TabsTrigger>
                <TabsTrigger value="export" className="flex-1 rounded-lg text-sm gap-2">
                  <Database className="w-4 h-4" />
                  QB Export
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* ── DASHBOARD TAB ── */}
          <TabsContent value="dashboard" className="mt-0 space-y-5">

            {/* Stats cards */}
            <DashboardStats jobs={jobs} activeSection={activeSection} onSelect={setActiveSection} />

            {/* Active section label */}
            {activeSection && (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{SECTION_LABELS[activeSection]}</p>
                <button
                  onClick={() => setActiveSection(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  Show all
                </button>
              </div>
            )}

            {/* Filters */}
            <JobFilters filters={filters} onChange={setFilters} />

            {/* Export (admin only) */}
            {isAdminRole && (
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl h-9 text-xs gap-1.5"
                onClick={() => exportCsv(displayedJobs)}
                disabled={displayedJobs.length === 0}
              >
                <Download className="w-3.5 h-3.5" />
                Export {displayedJobs.length} record{displayedJobs.length !== 1 ? 's' : ''} to CSV
              </Button>
            )}

            <JobsTable jobs={displayedJobs} isLoading={isLoading} role={role} hideFilters />
          </TabsContent>

          {/* ── MANAGE TAB (admin only) ── */}
          {isAdminRole && (
            <TabsContent value="jobs" className="mt-0 space-y-4">
              <Button className="w-full h-11 rounded-xl" onClick={() => setShowForm(!showForm)}>
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

              <JobsTable jobs={jobs} isLoading={isLoading} role={role} />
            </TabsContent>
          )}

          {/* ── IMPORT TAB (admin only) ── */}
          {isAdminRole && (
            <TabsContent value="import" className="mt-0">
              <div className="bg-card border border-border rounded-2xl p-5">
                <CsvImportFlow existingJobs={jobs} />
              </div>
            </TabsContent>
          )}

          {/* ── REPORTING TAB (admin only) ── */}
          {isAdminRole && (
            <TabsContent value="reporting" className="mt-0">
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Reporting</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Internal only — not visible to customers</p>
                </div>
                <ReportingPanel />
              </div>
            </TabsContent>
          )}

          {/* ── QB EXPORT TAB (admin only) ── */}
          {isAdminRole && (
            <TabsContent value="export" className="mt-0">
              <div className="bg-card border border-border rounded-2xl p-5">
                <QBExportPanel />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}