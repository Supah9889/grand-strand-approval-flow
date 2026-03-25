import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Search, Loader2, Users, Globe, X, CheckCircle2,
  ShieldOff, Eye, Mail, Building2, User, Link as LinkIcon, RefreshCw
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { getInternalRole } from '@/lib/adminAuth';
import { toast } from 'sonner';

const STATUS_CFG = {
  invited:   { label: 'Invited',  color: 'bg-amber-100 text-amber-700' },
  active:    { label: 'Active',   color: 'bg-green-100 text-green-700' },
  disabled:  { label: 'Disabled', color: 'bg-slate-100 text-slate-500' },
  revoked:   { label: 'Revoked',  color: 'bg-red-100 text-red-600' },
};

const TYPE_CFG = {
  client:        { label: 'Client',        icon: User,     color: 'text-blue-600' },
  vendor:        { label: 'Vendor',        icon: Building2,color: 'text-amber-600' },
  subcontractor: { label: 'Subcontractor', icon: Users,    color: 'text-violet-600' },
};

function generateToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

const EMPTY_FORM = { name: '', email: '', portal_type: 'client', job_ids: [], internal_notes: '' };

export default function PortalManager() {
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: portalUsers = [], isLoading } = useQuery({
    queryKey: ['portal-users'],
    queryFn: () => base44.entities.PortalUser.list('-created_date'),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const token = generateToken();
      return base44.entities.PortalUser.create({
        name: data.name,
        email: data.email,
        portal_type: data.portal_type,
        access_status: 'invited',
        linked_job_ids: JSON.stringify(data.job_ids || []),
        invited_by: role || 'admin',
        invite_date: new Date().toISOString(),
        access_token: token,
        internal_notes: data.internal_notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-users'] });
      setShowForm(false);
      setForm(EMPTY_FORM);
      toast.success('Portal user created');
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => {
      const patch = { access_status: status };
      if (status === 'active') patch.activated_date = new Date().toISOString();
      return base44.entities.PortalUser.update(id, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-users'] });
      toast.success('Access updated');
    },
  });

  const filtered = useMemo(() => {
    let list = portalUsers;
    if (filterType !== 'all') list = list.filter(u => u.portal_type === filterType);
    if (filterStatus !== 'all') list = list.filter(u => u.access_status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }
    return list;
  }, [portalUsers, filterType, filterStatus, search]);

  const stats = useMemo(() => ({
    total: portalUsers.length,
    active: portalUsers.filter(u => u.access_status === 'active').length,
    invited: portalUsers.filter(u => u.access_status === 'invited').length,
    client: portalUsers.filter(u => u.portal_type === 'client').length,
    vendor: portalUsers.filter(u => u.portal_type === 'vendor' || u.portal_type === 'subcontractor').length,
  }), [portalUsers]);

  const activeJobs = jobs.filter(j => j.status !== 'archived');

  const regenerateMutation = useMutation({
    mutationFn: (id) => base44.entities.PortalUser.update(id, {
      access_token: Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['portal-users'] }); toast.success('New link generated'); },
  });

  const getPortalUrl = (user) => {
    const base = window.location.origin;
    return `${base}/portal/client?token=${user.access_token}`;
  };

  const copyLink = (user) => {
    navigator.clipboard.writeText(getPortalUrl(user));
    toast.success('Portal link copied');
  };

  return (
    <AppLayout title="Portal Access">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Portal Access Manager</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage client & vendor/sub portal access</p>
          </div>
          <Button className="h-9 rounded-xl text-sm gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" /> Invite User
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { key: 'total',   label: 'Total',     color: 'text-slate-700',  bg: 'bg-slate-50',  border: 'border-slate-200' },
            { key: 'active',  label: 'Active',    color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
            { key: 'invited', label: 'Pending',   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
            { key: 'client',  label: 'Clients',   color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
            { key: 'vendor',  label: 'Vendors',   color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
          ].map(g => (
            <div key={g.key} className={`p-3 rounded-xl border-2 ${g.bg} ${g.border}`}>
              <p className={`text-lg font-bold leading-none ${g.color}`}>{stats[g.key]}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">{g.label}</p>
            </div>
          ))}
        </div>

        {/* New user form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Invite Portal User</p>
                  <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-9 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Email *</label>
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="h-9 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Portal Type</label>
                    <Select value={form.portal_type} onValueChange={v => setForm(f => ({ ...f, portal_type: v }))}>
                      <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Client / Homeowner</SelectItem>
                        <SelectItem value="vendor">Vendor</SelectItem>
                        <SelectItem value="subcontractor">Subcontractor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Linked Jobs (select all that apply)</label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto border border-border rounded-xl p-2">
                    {activeJobs.map(j => (
                      <label key={j.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted cursor-pointer">
                        <input type="checkbox" className="rounded"
                          checked={form.job_ids.includes(j.id)}
                          onChange={e => setForm(f => ({
                            ...f,
                            job_ids: e.target.checked ? [...f.job_ids, j.id] : f.job_ids.filter(id => id !== j.id)
                          }))} />
                        <span className="text-sm text-foreground">{j.address || j.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Internal Notes</label>
                  <Textarea value={form.internal_notes} onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))} className="rounded-lg text-sm min-h-12" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-9 rounded-xl" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button className="flex-1 h-9 rounded-xl" onClick={() => createMutation.mutate(form)} disabled={!form.name || !form.email || createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create & Invite'}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl text-sm" />
          </div>
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="subcontractor">Subcontractor</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="invited">Invited</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* User list */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <Globe className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No portal users yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(user => {
              const typeCfg = TYPE_CFG[user.portal_type] || TYPE_CFG.client;
              const TypeIcon = typeCfg.icon;
              const statusCfg = STATUS_CFG[user.access_status] || STATUS_CFG.invited;
              const linkedJobIds = (() => { try { return JSON.parse(user.linked_job_ids || '[]'); } catch { return []; } })();
              const linkedJobs = jobs.filter(j => linkedJobIds.includes(j.id));

              return (
                <div key={user.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <TypeIcon className={`w-4 h-4 ${typeCfg.color}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{user.email}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                          <span className={`text-xs font-medium ${typeCfg.color}`}>{typeCfg.label}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button onClick={() => copyLink(user)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                        <LinkIcon className="w-3 h-3" /> Copy Link
                      </button>
                      <button onClick={() => regenerateMutation.mutate(user.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <RefreshCw className="w-3 h-3" /> New Link
                      </button>
                    </div>
                  </div>

                  {linkedJobs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {linkedJobs.map(j => (
                        <span key={j.id} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-lg truncate max-w-[180px]">{j.address || j.title}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap pt-1 border-t border-border/60">
                    {user.access_status !== 'active' && (
                      <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                        onClick={() => updateStatus.mutate({ id: user.id, status: 'active' })}>
                        <CheckCircle2 className="w-3 h-3" /> Activate
                      </Button>
                    )}
                    {user.access_status === 'active' && (
                      <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs gap-1"
                        onClick={() => updateStatus.mutate({ id: user.id, status: 'disabled' })}>
                        <ShieldOff className="w-3 h-3" /> Disable
                      </Button>
                    )}
                    {user.access_status !== 'revoked' && (
                      <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => updateStatus.mutate({ id: user.id, status: 'revoked' })}>
                        <X className="w-3 h-3" /> Revoke
                      </Button>
                    )}
                    <a href={getPortalUrl(user)} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs gap-1">
                        <Eye className="w-3 h-3" /> Preview Portal
                      </Button>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}