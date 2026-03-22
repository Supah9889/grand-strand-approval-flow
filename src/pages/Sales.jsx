import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Search, Loader2, ChevronRight, AlertCircle, Calendar, BarChart2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, isPast, isToday } from 'date-fns';
import AppLayout from '../components/AppLayout';
import LeadStatusBadge, { STATUS_CONFIG } from '../components/sales/LeadStatusBadge';
import LeadForm from '../components/sales/LeadForm';
import { getInternalRole } from '@/lib/adminAuth';
import { toast } from 'sonner';

const PRIORITY_COLORS = {
  low: 'text-slate-500', medium: 'text-amber-600', high: 'text-orange-600', urgent: 'text-red-600',
};
const PRIORITY_DOT = {
  low: 'bg-slate-300', medium: 'bg-amber-400', high: 'bg-orange-500', urgent: 'bg-red-500',
};

function followUpStatus(lead) {
  if (!lead.follow_up_date) return 'none';
  const d = parseISO(lead.follow_up_date);
  if (isToday(d)) return 'today';
  if (isPast(d)) return 'overdue';
  return 'scheduled';
}

const STAT_GROUPS = [
  { key: 'total', label: 'Total', color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
  { key: 'new_lead', label: 'New', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  { key: 'estimate_scheduled', label: 'Est. Scheduled', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  { key: 'waiting_on_approval', label: 'Awaiting Approval', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  { key: 'won', label: 'Won', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  { key: 'lost', label: 'Lost', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  { key: 'follow_up_overdue', label: 'Overdue Follow-Up', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  { key: 'converted_to_job', label: 'Converted', color: 'text-primary', bg: 'bg-secondary', border: 'border-primary/20' },
];

export default function Sales() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [sort, setSort] = useState('newest');
  const [activeStat, setActiveStat] = useState(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date'),
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => base44.entities.Vendor.list('company_name'),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const lead = await base44.entities.Lead.create(data);
      await base44.entities.LeadActivity.create({
        lead_id: lead.id,
        action: 'record_created',
        detail: `Lead created: ${data.contact_name}`,
        actor: role || 'admin',
        timestamp: new Date().toISOString(),
      });
      return lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowForm(false);
      toast.success('Lead created');
    },
  });

  // Stats
  const stats = useMemo(() => {
    const m = {};
    STAT_GROUPS.forEach(g => { m[g.key] = 0; });
    m.total = leads.length;
    leads.forEach(l => {
      if (m[l.status] !== undefined) m[l.status]++;
      if (followUpStatus(l) === 'overdue') m.follow_up_overdue++;
    });
    return m;
  }, [leads]);

  // Filtered + sorted list
  const filtered = useMemo(() => {
    let list = leads;

    // Stat filter
    if (activeStat && activeStat !== 'total') {
      if (activeStat === 'follow_up_overdue') list = list.filter(l => followUpStatus(l) === 'overdue');
      else list = list.filter(l => l.status === activeStat);
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.contact_name?.toLowerCase().includes(q) ||
        l.company_name?.toLowerCase().includes(q) ||
        l.phone?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.property_address?.toLowerCase().includes(q) ||
        l.lead_source?.toLowerCase().includes(q) ||
        l.assigned_to?.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== 'all') list = list.filter(l => l.status === filterStatus);
    if (filterPriority !== 'all') list = list.filter(l => l.priority === filterPriority);
    if (filterSource !== 'all') list = list.filter(l => l.lead_source === filterSource);

    // Sort
    if (sort === 'newest') list = [...list].sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
    if (sort === 'oldest') list = [...list].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
    if (sort === 'follow_up') list = [...list].sort((a, b) => (a.follow_up_date || 'z').localeCompare(b.follow_up_date || 'z'));
    if (sort === 'alpha_contact') list = [...list].sort((a, b) => (a.contact_name || '').localeCompare(b.contact_name || ''));
    if (sort === 'priority') {
      const p = { urgent: 0, high: 1, medium: 2, low: 3 };
      list = [...list].sort((a, b) => (p[a.priority] ?? 2) - (p[b.priority] ?? 2));
    }
    if (sort === 'updated') list = [...list].sort((a, b) => (b.updated_date || '').localeCompare(a.updated_date || ''));

    return list;
  }, [leads, search, filterStatus, filterPriority, filterSource, sort, activeStat]);

  const LEAD_SOURCES = ['website','google','referral','repeat_customer','buildertrend','facebook','instagram','yard_sign','door_hanger','nextdoor','other'];

  return (
    <AppLayout title="Sales / CRM">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Sales & CRM</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Leads, prospects & presale pipeline</p>
          </div>
          <Button className="h-9 rounded-xl text-sm gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" /> New Lead
          </Button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          {STAT_GROUPS.map(g => (
            <button
              key={g.key}
              onClick={() => setActiveStat(activeStat === g.key ? null : g.key)}
              className={`text-left p-3 rounded-xl border-2 transition-all ${
                activeStat === g.key ? `${g.bg} ${g.border}` : 'bg-card border-border hover:border-primary/20'
              }`}
            >
              <p className={`text-lg font-bold leading-none ${g.color}`}>{stats[g.key] || 0}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">{g.label}</p>
            </button>
          ))}
        </div>

        {/* New Lead Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-foreground">New Lead</p>
                  <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <LeadForm
                  vendors={vendors}
                  onSubmit={(data) => createMutation.mutate(data)}
                  onCancel={() => setShowForm(false)}
                  isLoading={createMutation.isPending}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search + Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, email, address..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 rounded-xl text-sm"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {['low','medium','high','urgent'].map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="follow_up">Follow-Up Date</SelectItem>
                <SelectItem value="priority">Highest Priority</SelectItem>
                <SelectItem value="alpha_contact">A–Z by Contact</SelectItem>
                <SelectItem value="updated">Recently Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active stat label */}
        {activeStat && activeStat !== 'total' && (
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">
              Showing: {STAT_GROUPS.find(g => g.key === activeStat)?.label}
            </p>
            <button onClick={() => setActiveStat(null)} className="text-xs text-muted-foreground underline underline-offset-2">Clear</button>
          </div>
        )}

        {/* Lead list */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <p className="text-sm text-muted-foreground">No leads found.</p>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowForm(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add First Lead
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(lead => {
              const fus = followUpStatus(lead);
              return (
                <button
                  key={lead.id}
                  onClick={() => navigate(`/sales/${lead.id}`)}
                  className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[lead.priority] || 'bg-slate-300'}`} />
                        <p className="text-sm font-semibold text-foreground truncate">{lead.contact_name}</p>
                        {lead.company_name && <span className="text-xs text-muted-foreground truncate">· {lead.company_name}</span>}
                      </div>
                      {lead.property_address && (
                        <p className="text-xs text-muted-foreground truncate">{lead.property_address}{lead.city ? `, ${lead.city}` : ''}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {lead.service_type && (
                          <span className="text-xs text-muted-foreground">{lead.service_type.replace(/_/g, ' ')}</span>
                        )}
                        {lead.approximate_value > 0 && (
                          <span className="text-xs font-semibold text-primary">${Number(lead.approximate_value).toLocaleString()}</span>
                        )}
                        {lead.assigned_to && (
                          <span className="text-xs text-muted-foreground">→ {lead.assigned_to}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <LeadStatusBadge status={lead.status} />
                      {fus === 'overdue' && (
                        <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                          <AlertCircle className="w-3 h-3" /> Overdue
                        </span>
                      )}
                      {fus === 'today' && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                          <Calendar className="w-3 h-3" /> Today
                        </span>
                      )}
                    </div>
                  </div>
                  {lead.follow_up_date && fus === 'scheduled' && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Follow-up: {format(parseISO(lead.follow_up_date), 'MMM d, yyyy')}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}