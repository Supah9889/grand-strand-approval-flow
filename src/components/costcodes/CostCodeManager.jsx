import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, X, Loader2, Database } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import CostCodeCard from './CostCodeCard';
import CostCodeForm from './CostCodeForm';
import { logAudit } from '@/lib/audit';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'labor', label: 'Labor' },
  { value: 'materials', label: 'Materials' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'overhead', label: 'Overhead' },
  { value: 'administrative', label: 'Administrative' },
  { value: 'permit_inspection', label: 'Permit / Inspection' },
  { value: 'travel', label: 'Travel' },
  { value: 'disposal_cleanup', label: 'Disposal / Cleanup' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
  { value: 'revenue_billing', label: 'Revenue / Billing' },
  { value: 'other', label: 'Other' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'expense', label: 'Expense' },
  { value: 'billable', label: 'Billable' },
  { value: 'non_billable', label: 'Non-Billable' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'labor', label: 'Labor' },
  { value: 'material', label: 'Material' },
  { value: 'time', label: 'Time' },
  { value: 'vendor_charge', label: 'Vendor Charge' },
  { value: 'subcontractor_charge', label: 'Subcontractor Charge' },
  { value: 'internal_only', label: 'Internal Only' },
];

const RECORD_TYPE_OPTIONS = [
  { value: 'all', label: 'All Record Types' },
  { value: 'expense', label: 'Expense' },
  { value: 'bill', label: 'Bill' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'time_entry', label: 'Time Entry' },
  { value: 'job', label: 'Job / Project' },
];

export default function CostCodeManager({ actorName }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterRecordType, setFilterRecordType] = useState('all');

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ['cost-codes'],
    queryFn: () => base44.entities.CostCode.list('display_order', 500),
  });

  // Usage counts from related entities
  const { data: expenses = [] } = useQuery({ queryKey: ['cc-expenses'], queryFn: () => base44.entities.Expense.list('-created_date', 1000) });
  const { data: bills = [] } = useQuery({ queryKey: ['cc-bills'], queryFn: () => base44.entities.Bill.list('-created_date', 500) });
  const { data: invoices = [] } = useQuery({ queryKey: ['cc-invoices'], queryFn: () => base44.entities.Invoice.list('-created_date', 1000) });
  const { data: estimates = [] } = useQuery({ queryKey: ['cc-estimates'], queryFn: () => base44.entities.Estimate.list('-created_date', 500) });
  const { data: timeEntries = [] } = useQuery({ queryKey: ['cc-time-entries'], queryFn: () => base44.entities.TimeEntry.list('-clock_in', 2000) });

  // Build usage map: cost_code_id -> { expenses, bills, invoices, estimates, time_entries }
  const usageMap = useMemo(() => {
    const map = {};
    const add = (records, type) => records.forEach(r => {
      const id = r.cost_code_id;
      if (!id) return;
      if (!map[id]) map[id] = {};
      map[id][type] = (map[id][type] || 0) + 1;
    });
    add(expenses, 'expenses');
    add(bills, 'bills');
    add(invoices, 'invoices');
    add(estimates, 'estimates');
    add(timeEntries, 'time entries');
    return map;
  }, [expenses, bills, invoices, estimates, timeEntries]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CostCode.create({ ...data, created_by_name: actorName || 'Admin' }),
    onSuccess: async (code) => {
      queryClient.invalidateQueries({ queryKey: ['cost-codes'] });
      queryClient.invalidateQueries({ queryKey: ['cost-codes-picker'] });
      await logAudit(code.id, 'record_created', actorName || 'Admin', `Cost code created: ${code.code_number} - ${code.name}`, 'system');
      toast.success('Cost code created');
      setShowForm(false);
      setEditingCode(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CostCode.update(id, { ...data, last_modified_by: actorName || 'Admin' }),
    onSuccess: async (code) => {
      queryClient.invalidateQueries({ queryKey: ['cost-codes'] });
      queryClient.invalidateQueries({ queryKey: ['cost-codes-picker'] });
      await logAudit(code.id, 'record_edited', actorName || 'Admin', `Cost code updated: ${code.code_number} - ${code.name}`, 'system');
      toast.success('Cost code updated');
      setShowForm(false);
      setEditingCode(null);
    },
  });

  const handleSave = (formData) => {
    if (editingCode) {
      updateMutation.mutate({ id: editingCode.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (code) => {
    setEditingCode(code);
    setShowForm(true);
  };

  const handleToggleActive = async (code) => {
    const newStatus = code.status === 'active' ? 'inactive' : 'active';
    await base44.entities.CostCode.update(code.id, { status: newStatus, last_modified_by: actorName || 'Admin' });
    queryClient.invalidateQueries({ queryKey: ['cost-codes'] });
    queryClient.invalidateQueries({ queryKey: ['cost-codes-picker'] });
    await logAudit(code.id, 'status_changed', actorName || 'Admin', `Cost code ${newStatus}: ${code.code_number} - ${code.name}`, 'system');
    toast.success(`Cost code ${newStatus}`);
  };

  const handleArchive = async (code) => {
    if (!confirm(`Archive cost code ${code.code_number} - ${code.name}? It will no longer be selectable.`)) return;
    await base44.entities.CostCode.update(code.id, { status: 'archived', last_modified_by: actorName || 'Admin' });
    queryClient.invalidateQueries({ queryKey: ['cost-codes'] });
    queryClient.invalidateQueries({ queryKey: ['cost-codes-picker'] });
    await logAudit(code.id, 'record_archived', actorName || 'Admin', `Cost code archived: ${code.code_number} - ${code.name}`, 'system');
    toast.success('Cost code archived');
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingCode(null);
  };

  // Filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return codes.filter(c => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (filterCategory !== 'all' && c.category !== filterCategory) return false;
      if (filterType !== 'all' && c.code_type !== filterType) return false;
      if (filterRecordType !== 'all') {
        try {
          const allowed = JSON.parse(c.allowed_on || '[]');
          if (!allowed.includes(filterRecordType)) return false;
        } catch { return false; }
      }
      if (q) {
        const match = c.code_number?.toLowerCase().includes(q) ||
          c.name?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || (a.code_number || '').localeCompare(b.code_number || ''));
  }, [codes, search, filterCategory, filterType, filterStatus, filterRecordType]);

  // Summary stats
  const stats = useMemo(() => ({
    total: codes.length,
    active: codes.filter(c => c.status === 'active').length,
    inactive: codes.filter(c => c.status === 'inactive').length,
    archived: codes.filter(c => c.status === 'archived').length,
  }), [codes]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground ml-2">Loading cost codes…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + Create button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Database className="w-4 h-4 text-indigo-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Cost Codes</p>
            <p className="text-xs text-muted-foreground">{stats.active} active · {stats.inactive} inactive · {stats.archived} archived</p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => { setEditingCode(null); setShowForm(true); }}
            className="flex items-center gap-1.5 h-9 px-3 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Code
          </button>
        )}
      </div>

      {/* Summary stat pills */}
      <div className="flex flex-wrap gap-2">
        {['all', 'active', 'inactive', 'archived'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium border transition-colors ${
              filterStatus === s ? 'border-primary bg-secondary text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            <span className={`px-1 rounded-full text-xs ${filterStatus === s ? 'bg-primary/20' : 'bg-muted'}`}>
              {s === 'all' ? stats.total : stats[s] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Create / Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card border border-primary/30 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-foreground">
                  {editingCode ? `Edit: ${editingCode.code_number} - ${editingCode.name}` : 'New Cost Code'}
                </p>
                <button onClick={handleCancel} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <CostCodeForm
                initial={editingCode}
                onSave={handleSave}
                onCancel={handleCancel}
                saving={isSaving}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by number, name, or description…"
            className="pl-8 h-9 rounded-xl text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterRecordType} onValueChange={setFilterRecordType}>
            <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RECORD_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {(filterCategory !== 'all' || filterType !== 'all' || filterRecordType !== 'all' || search) && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            <button
              onClick={() => { setSearch(''); setFilterCategory('all'); setFilterType('all'); setFilterRecordType('all'); }}
              className="text-primary underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Code list */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 bg-muted/20 rounded-2xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            {codes.length === 0 ? 'No cost codes yet. Create your first one.' : 'No codes match these filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(code => (
            <CostCodeCard
              key={code.id}
              code={code}
              onEdit={handleEdit}
              onToggleActive={handleToggleActive}
              onArchive={handleArchive}
              usageCounts={usageMap[code.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}