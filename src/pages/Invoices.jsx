import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BottomSheetSelect from '@/components/BottomSheetSelect';
import { Search, Plus, X, Loader2, FileText, AlertCircle, Archive } from 'lucide-react';
import { isPast, isToday, parseISO, format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import PullToRefresh from '../components/PullToRefresh';
import InvoiceFullForm from '../components/invoices/InvoiceFullForm';
import InvoiceCard from '../components/invoices/InvoiceCard';
import InvoiceConfirmDialog from '../components/invoices/InvoiceConfirmDialog';
import { INVOICE_STATUS_CONFIG, fmt, generateNumber } from '@/lib/financialHelpers';
import { getInternalRole, isAdmin as getIsAdmin } from '@/lib/adminAuth';
import { audit, audit_linking } from '@/lib/audit';
import { toast } from 'sonner';

export default function Invoices() {
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const isOwnerOrAdmin = getIsAdmin();
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null); // { type: 'archive'|'delete', invoice }
  const [ariaLiveMessage, setAriaLiveMessage] = useState('');

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterJob, setFilterJob] = useState('all');
  const [filterOverdue, setFilterOverdue] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterArchived, setFilterArchived] = useState('active'); // 'active' | 'archived' | 'all'
  const [sort, setSort] = useState('newest');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date'),
  });
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => base44.entities.Payment.list('-created_date') });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list('-created_date', 200) });
  const { data: estimates = [] } = useQuery({ queryKey: ['estimates'], queryFn: () => base44.entities.Estimate.list('-created_date') });
  const { data: changeOrders = [] } = useQuery({ queryKey: ['change-orders'], queryFn: () => base44.entities.ChangeOrder.list('-created_date') });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  const createInvoice = useMutation({
    mutationFn: d => base44.entities.Invoice.create(d),
    onSuccess: (inv) => {
      invalidate();
      setShowForm(false);
      audit.invoice.created(inv.id, role || 'Admin', inv.customer_name, fmt(inv.amount), inv.job_address, { job_id: inv.job_id, job_address: inv.job_address });
      toast.success('Invoice created');
    },
  });

  const updateInvoice = useOptimisticMutation({
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    queryKey: ['invoices'],
    optimisticUpdate: (prev, { id, data }) =>
      prev.map(inv => inv.id === id ? { ...inv, ...data } : inv),
    rollback: (prev) => prev,
    onSuccess: () => {
      invalidate();
    },
  });

  const isOverdueFn = (inv) => inv.due_date && !['paid', 'closed', 'canceled'].includes(inv.status) && isPast(parseISO(inv.due_date)) && !isToday(parseISO(inv.due_date));
  const existingNums = invoices.map(i => i.invoice_number).filter(Boolean);
  const activeJobs = jobs.filter(j => j.status !== 'archived');

  const totals = useMemo(() => {
    const active = invoices.filter(i => i.status !== 'closed');
    return {
      draft: active.filter(i => i.status === 'draft').length,
      sent: active.filter(i => i.status === 'sent').length,
      overdue: active.filter(i => isOverdueFn(i)).length,
      outstanding: active.filter(i => !['paid', 'closed', 'draft'].includes(i.status)).reduce((s, i) => s + Number(i.balance_due || i.amount || 0), 0),
      received: payments.reduce((s, p) => s + Number(p.amount || 0), 0),
    };
  }, [invoices, payments]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.refetchQueries({ queryKey: ['invoices'] });
    await queryClient.refetchQueries({ queryKey: ['payments'] });
    await queryClient.refetchQueries({ queryKey: ['jobs'] });
    setIsRefreshing(false);
  };

  const filtered = useMemo(() => {
    let l = invoices;

    // Archived visibility
    if (filterArchived === 'active') l = l.filter(i => i.status !== 'closed');
    else if (filterArchived === 'archived') l = l.filter(i => i.status === 'closed');
    // 'all' shows everything

    if (filterStatus !== 'all') l = l.filter(i => i.status === filterStatus);
    if (filterJob !== 'all') l = l.filter(i => i.job_id === filterJob);
    if (filterSource !== 'all') l = l.filter(i => i.source_type === filterSource);
    if (filterOverdue === 'yes') l = l.filter(i => isOverdueFn(i));
    if (filterOverdue === 'no') l = l.filter(i => !isOverdueFn(i));
    if (search) {
      const q = search.toLowerCase();
      l = l.filter(i =>
        i.invoice_number?.toLowerCase().includes(q) ||
        i.customer_name?.toLowerCase().includes(q) ||
        i.job_address?.toLowerCase().includes(q) ||
        String(i.amount).includes(q)
      );
    }
    const sortFns = {
      newest: (a, b) => (b.created_date || '').localeCompare(a.created_date || ''),
      oldest: (a, b) => (a.created_date || '').localeCompare(b.created_date || ''),
      due_soon: (a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'),
      overdue_first: (a, b) => (isOverdueFn(b) ? 1 : 0) - (isOverdueFn(a) ? 1 : 0),
      amount_high: (a, b) => Number(b.amount || 0) - Number(a.amount || 0),
      amount_low: (a, b) => Number(a.amount || 0) - Number(b.amount || 0),
      customer: (a, b) => (a.customer_name || '').localeCompare(b.customer_name || ''),
    };
    return [...l].sort(sortFns[sort] || sortFns.newest);
  }, [invoices, filterStatus, filterJob, filterSource, filterOverdue, filterArchived, search, sort]);

  // ── Handlers ──
  const handleSaveNew = (data) => {
    if (!data.job_id) {
      toast.error('Job linking is required. Please select a job.');
      return;
    }
    createInvoice.mutate(data);
  };

  const handleSaveEdit = (data) => {
    if (!data.job_id) {
      toast.error('Job linking is required. Please select a job.');
      return;
    }
    const inv = editingInvoice;
    const oldStatus = inv.status;
    const oldJobId = inv.job_id;
    const newJobId = data.job_id;

    updateInvoice.mutate({ id: inv.id, data });
    audit.invoice.edited(inv.id, role || 'Admin', inv.invoice_number || inv.id, {
      job_id: inv.job_id, job_address: inv.job_address,
      old_value: oldStatus !== data.status ? `status: ${oldStatus}` : undefined,
      new_value: oldStatus !== data.status ? `status: ${data.status}` : undefined,
    });
    if (oldStatus !== data.status) {
      audit.invoice.statusChanged(inv.id, role || 'Admin', inv.invoice_number || inv.id, oldStatus, data.status, { job_id: inv.job_id, job_address: inv.job_address });
    }
    if (oldJobId !== newJobId) {
      const oldJobAddr = invoices.find(i => i.job_id === oldJobId)?.job_address;
      const newJobAddr = invoices.find(i => i.job_id === newJobId)?.job_address || data.job_address;
      audit_linking.jobChanged(inv.id, role || 'Admin', 'Invoice', oldJobId, newJobId, oldJobAddr, newJobAddr);
    }
    setEditingInvoice(null);
    toast.success('Invoice updated');
  };

  const handleStatusChange = (inv, status) => {
    const oldStatus = inv.status;
    updateInvoice.mutate({ id: inv.id, data: { status } });
    setAriaLiveMessage(`Invoice ${inv.invoice_number || inv.id} status changed from ${oldStatus} to ${status}`);
    audit.invoice.statusChanged(inv.id, role || 'Admin', inv.invoice_number || inv.id, oldStatus, status, { job_id: inv.job_id, job_address: inv.job_address });
  };

  const handleArchiveConfirm = async () => {
    const inv = confirmDialog.invoice;
    updateInvoice.mutate({ id: inv.id, data: { status: 'closed' } });
    audit.invoice.archived(inv.id, role || 'Admin', inv.invoice_number || inv.id, { job_id: inv.job_id, job_address: inv.job_address });
    toast.success('Invoice archived');
    if (editingInvoice?.id === inv.id) setEditingInvoice(null);
    setConfirmDialog(null);
  };

  const handleDeleteConfirm = async () => {
    const inv = confirmDialog.invoice;
    await base44.entities.Invoice.delete(inv.id);
    invalidate();
    audit.invoice.deleted(inv.id, role || 'Admin', inv.invoice_number || inv.id, { job_id: inv.job_id, job_address: inv.job_address });
    toast.success('Invoice deleted');
    if (editingInvoice?.id === inv.id) setEditingInvoice(null);
    setConfirmDialog(null);
  };

  if (!isOwnerOrAdmin) {
    return (
      <AppLayout title="Invoices">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">Access restricted to admin users.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Invoices">
      {/* Aria live region for status announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {ariaLiveMessage}
      </div>
      
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Invoices</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Billing & receivables by job</p>
          </div>
          <Button 
            className="h-9 rounded-xl text-sm gap-1.5" 
            onClick={() => { setEditingInvoice(null); setShowForm(true); }}
            aria-label="Create new invoice"
          >
            <Plus className="w-3.5 h-3.5" /> New Invoice
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Outstanding',   value: `$${fmt(totals.outstanding)}`, color: 'text-primary',    bg: 'bg-secondary',  border: 'border-primary/20' },
            { label: 'Received',      value: `$${fmt(totals.received)}`,    color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200' },
            { label: 'Overdue',       value: totals.overdue,                color: totals.overdue > 0 ? 'text-red-700' : 'text-slate-500', bg: 'bg-red-50', border: 'border-red-200' },
            { label: 'Draft',         value: totals.draft,                  color: 'text-slate-600',  bg: 'bg-slate-50',   border: 'border-slate-200' },
          ].map(s => (
            <div key={s.label} className={`p-3 rounded-xl border-2 ${s.bg} ${s.border}`}>
              <p className={`text-base font-bold leading-none ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-foreground">New Invoice</p>
                  <button 
                    onClick={() => setShowForm(false)} 
                    aria-label="Close invoice form"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <InvoiceFullForm
                  jobs={activeJobs}
                  estimates={estimates}
                  changeOrders={changeOrders}
                  existingNums={existingNums}
                  onSave={handleSaveNew}
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
          <Input 
            placeholder="Search invoice #, customer, job..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            aria-label="Search invoices"
            className="pl-9 h-9 rounded-xl text-sm" 
          />
          </div>
          <div className="flex gap-2 flex-wrap">
            <BottomSheetSelect value={filterArchived} onChange={setFilterArchived} label="Visibility" options={[
              { label: 'Active Only', value: 'active' },
              { label: 'Archived Only', value: 'archived' },
              { label: 'Show All', value: 'all' },
            ]} />
            <BottomSheetSelect value={filterStatus} onChange={setFilterStatus} label="Status" options={[
              { label: 'All Statuses', value: 'all' },
              ...Object.entries(INVOICE_STATUS_CONFIG).map(([v, c]) => ({ label: c.label, value: v })),
            ]} />
            <BottomSheetSelect value={filterOverdue} onChange={setFilterOverdue} label="Overdue" options={[
              { label: 'All', value: 'all' },
              { label: 'Overdue Only', value: 'yes' },
              { label: 'Not Overdue', value: 'no' },
            ]} />
            <BottomSheetSelect value={filterSource} onChange={setFilterSource} label="Source" options={[
              { label: 'All Sources', value: 'all' },
              { label: 'From Estimate', value: 'estimate' },
              { label: 'From Change Order', value: 'change_order' },
              { label: 'Manual', value: 'manual' },
            ]} />
            <BottomSheetSelect value={filterJob} onChange={setFilterJob} label="Job" options={[
              { label: 'All Jobs', value: 'all' },
              ...activeJobs.map(j => ({ label: j.address || j.title, value: j.id })),
            ]} />
            <BottomSheetSelect value={sort} onChange={setSort} label="Sort" options={[
              { label: 'Newest First', value: 'newest' },
              { label: 'Oldest First', value: 'oldest' },
              { label: 'Due Soonest', value: 'due_soon' },
              { label: 'Overdue First', value: 'overdue_first' },
              { label: 'Amount ↓', value: 'amount_high' },
              { label: 'Amount ↑', value: 'amount_low' },
              { label: 'Customer A–Z', value: 'customer' },
            ]} />
          </div>
        </div>

        {/* Inline edit form */}
        <AnimatePresence>
          {editingInvoice && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-card border border-primary/30 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-foreground">Edit Invoice <span className="font-mono text-primary">{editingInvoice.invoice_number}</span></p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfirmDialog({ type: 'archive', invoice: editingInvoice })}
                      className="flex items-center gap-1 text-xs text-amber-600 hover:bg-amber-50 px-2 py-1 rounded-lg transition-colors"
                    >
                      <Archive className="w-3 h-3" /> Archive
                    </button>
                    <button onClick={() => setEditingInvoice(null)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <InvoiceFullForm
                  jobs={activeJobs}
                  estimates={estimates}
                  changeOrders={changeOrders}
                  existingNums={existingNums.filter(n => n !== editingInvoice.invoice_number)}
                  initialData={editingInvoice}
                  onSave={handleSaveEdit}
                  onCancel={() => setEditingInvoice(null)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {filterArchived === 'archived' ? 'No archived invoices.' : 'No invoices found.'}
            </p>
            {filterArchived === 'archived' && (
              <button onClick={() => setFilterArchived('active')} className="text-xs text-primary hover:underline">Back to active invoices</button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filterArchived === 'archived' && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <Archive className="w-3.5 h-3.5 shrink-0" />
                Showing archived invoices. These are preserved for historical/accounting traceability.
              </div>
            )}
            {filtered.map(inv => (
               <InvoiceCard
                 key={inv.id}
                 invoice={inv}
                 payments={payments.filter(p => p.invoice_id === inv.id)}
                 isOverdue={isOverdueFn(inv)}
                 onStatusChange={(status) => handleStatusChange(inv, status)}
                 onEdit={() => { setShowForm(false); setEditingInvoice(inv); }}
                 onArchive={() => setConfirmDialog({ type: 'archive', invoice: inv })}
                 onDelete={() => setConfirmDialog({ type: 'delete', invoice: inv })}
                 aria-label={`Invoice ${inv.invoice_number}: $${inv.amount} from ${inv.customer_name}, Status: ${inv.status}`}
               />
             ))}
          </div>
        )}
      </div>

      {/* Confirmation dialogs */}
      {confirmDialog && (
        <InvoiceConfirmDialog
          type={confirmDialog.type}
          invoice={confirmDialog.invoice}
          onConfirm={confirmDialog.type === 'delete' ? handleDeleteConfirm : handleArchiveConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
      </PullToRefresh>
      </AppLayout>
      );
      }