import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Search, Plus, X, Loader2, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import WarrantyForm from '../components/warranty/WarrantyForm';
import WarrantyCard from '../components/warranty/WarrantyCard';
import { WARRANTY_STATUS_CONFIG, WARRANTY_CATEGORY_LABELS } from '@/lib/warrantyHelpers';
import { getInternalRole } from '@/lib/adminAuth';
import { toast } from 'sonner';

export default function Warranty() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const role = getInternalRole();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterJob, setFilterJob] = useState('all');
  const [filterAssigned, setFilterAssigned] = useState('all');
  const [sort, setSort] = useState('newest');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['warranty-items'],
    queryFn: () => base44.entities.WarrantyItem.list('-created_date'),
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 200),
  });

  const createItem = useMutation({
    mutationFn: d => base44.entities.WarrantyItem.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['warranty-items'] }); setShowForm(false); toast.success('Warranty request created'); },
  });
  const updateItem = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WarrantyItem.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['warranty-items'] }),
  });

  const activeJobs = jobs.filter(j => j.status !== 'archived');
  const assignees = [...new Set(items.map(i => i.assigned_to).filter(Boolean))];

  const stats = useMemo(() => ({
    new: items.filter(i => i.status === 'new').length,
    scheduled: items.filter(i => i.status === 'scheduled').length,
    inProgress: items.filter(i => i.status === 'in_progress').length,
    open: items.filter(i => !['closed','completed'].includes(i.status)).length,
  }), [items]);

  const filtered = useMemo(() => {
    let l = items;
    if (filterStatus !== 'all') l = l.filter(i => i.status === filterStatus);
    if (filterCategory !== 'all') l = l.filter(i => i.category === filterCategory);
    if (filterJob !== 'all') l = l.filter(i => i.job_id === filterJob);
    if (filterAssigned !== 'all') l = l.filter(i => i.assigned_to === filterAssigned);
    if (search) {
      const q = search.toLowerCase();
      l = l.filter(i =>
        i.title?.toLowerCase().includes(q) ||
        i.customer_name?.toLowerCase().includes(q) ||
        i.job_address?.toLowerCase().includes(q) ||
        i.assigned_to?.toLowerCase().includes(q) ||
        i.issue_description?.toLowerCase().includes(q)
      );
    }
    const sortFns = {
      newest: (a, b) => (b.created_date || '').localeCompare(a.created_date || ''),
      oldest: (a, b) => (a.created_date || '').localeCompare(b.created_date || ''),
      reported: (a, b) => (b.date_reported || '').localeCompare(a.date_reported || ''),
      appointment: (a, b) => (a.appointment_date || '9999').localeCompare(b.appointment_date || '9999'),
      customer: (a, b) => (a.customer_name || '').localeCompare(b.customer_name || ''),
      updated: (a, b) => (b.updated_date || '').localeCompare(a.updated_date || ''),
    };
    return [...l].sort(sortFns[sort] || sortFns.newest);
  }, [items, filterStatus, filterCategory, filterJob, filterAssigned, search, sort]);

  return (
    <AppLayout title="Warranty">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Warranty</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Post-completion service requests & callbacks</p>
          </div>
          <Button className="h-9 rounded-xl text-sm gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" /> New Request
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'New',         value: stats.new,        color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
            { label: 'Scheduled',   value: stats.scheduled,  color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
            { label: 'In Progress', value: stats.inProgress, color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
            { label: 'Total Open',  value: stats.open,       color: 'text-primary',    bg: 'bg-secondary', border: 'border-primary/20' },
          ].map(s => (
            <div key={s.label} className={`p-3 rounded-xl border-2 ${s.bg} ${s.border}`}>
              <p className={`text-xl font-black leading-none ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* New request form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-foreground">New Warranty Request</p>
                  <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>
                <WarrantyForm
                  jobs={activeJobs}
                  onSave={createItem.mutate}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search title, customer, address, staff..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl text-sm" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(WARRANTY_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(WARRANTY_CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterJob} onValueChange={setFilterJob}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                {activeJobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address || j.title}</SelectItem>)}
              </SelectContent>
            </Select>
            {assignees.length > 0 && (
              <Select value={filterAssigned} onValueChange={setFilterAssigned}>
                <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assigned</SelectItem>
                  {assignees.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="reported">Date Reported</SelectItem>
                <SelectItem value="appointment">Appointment Date</SelectItem>
                <SelectItem value="customer">Customer A–Z</SelectItem>
                <SelectItem value="updated">Recently Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <ShieldCheck className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No warranty requests found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => (
              <WarrantyCard
                key={item.id}
                item={item}
                onStatusChange={(status) => updateItem.mutate({ id: item.id, data: { status } })}
                onClick={() => navigate(`/warranty/${item.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}