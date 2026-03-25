/**
 * ClientPortalManager — embedded in a Job's Clients tab
 * Manages portal users linked to this specific job and their section permissions.
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, Link as LinkIcon, X, CheckCircle2, ShieldOff, RefreshCw,
  Mail, Eye, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { parseSections, SECTION_LABELS, DEFAULT_SECTIONS } from '@/lib/portalSections';
import { getInternalRole } from '@/lib/adminAuth';

function generateToken() {
  const a = Math.random().toString(36).slice(2);
  const b = Date.now().toString(36);
  const c = Math.random().toString(36).slice(2);
  return `${a}${b}${c}`;
}

function getPortalUrl(user) {
  return `${window.location.origin}/portal/client?token=${user.access_token}`;
}

function SectionToggles({ sections, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Object.entries(SECTION_LABELS).map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={() => onChange(key, !sections[key])}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
              sections[key] ? 'bg-primary border-primary' : 'border-slate-300 bg-white'
            }`}
          >
            {sections[key] && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
          </div>
          <span className="text-xs text-slate-700">{label}</span>
        </label>
      ))}
    </div>
  );
}

export default function ClientPortalManager({ job }) {
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const isAdminLike = role === 'admin' || role === 'owner';

  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({ name: '', email: '' });

  const { data: portalUsers = [], isLoading } = useQuery({
    queryKey: ['job-portal-users', job.id],
    queryFn: () => base44.entities.PortalUser.filter({ job_id: job.id }),
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.PortalUser.create({
      name: form.name,
      email: form.email,
      portal_type: 'client',
      access_status: 'active',
      job_id: job.id,
      job_address: job.address,
      linked_job_ids: JSON.stringify([job.id]),
      invited_by: role || 'admin',
      invite_date: new Date().toISOString(),
      access_token: generateToken(),
      section_permissions: JSON.stringify(DEFAULT_SECTIONS),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-portal-users', job.id] });
      setShowForm(false);
      setForm({ name: '', email: '' });
      toast.success('Portal access created');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }) => base44.entities.PortalUser.update(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-portal-users', job.id] });
    },
  });

  const updateSections = (user, key, value) => {
    const current = parseSections(user.section_permissions);
    const next = { ...current, [key]: value };
    updateMutation.mutate({ id: user.id, patch: { section_permissions: JSON.stringify(next) } });
  };

  const revokeAccess = (user) => {
    updateMutation.mutate({ id: user.id, patch: { access_status: 'revoked' } });
    toast.success('Access revoked');
  };

  const activateAccess = (user) => {
    updateMutation.mutate({ id: user.id, patch: { access_status: 'active' } });
    toast.success('Access activated');
  };

  const regenerateLink = (user) => {
    updateMutation.mutate({ id: user.id, patch: { access_token: generateToken() } });
    toast.success('New link generated');
  };

  const copyLink = (user) => {
    navigator.clipboard.writeText(getPortalUrl(user));
    toast.success('Portal link copied');
  };

  if (!isAdminLike) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Portal Access</p>
        <Button size="sm" className="h-7 rounded-lg text-xs gap-1" onClick={() => setShowForm(v => !v)}>
          <Plus className="w-3 h-3" /> Add Client
        </Button>
      </div>

      {/* New portal user form */}
      {showForm && (
        <div className="bg-secondary/40 border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-foreground">New Portal Access</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">Client Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-8 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">Email *</label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="h-8 rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8 rounded-lg text-xs" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" className="flex-1 h-8 rounded-lg text-xs" onClick={() => createMutation.mutate()}
              disabled={!form.name || !form.email || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create & Copy Link'}
            </Button>
          </div>
        </div>
      )}

      {/* Portal user list */}
      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
      ) : portalUsers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-xs">No portal access granted yet for this job.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {portalUsers.map(user => {
            const sections = parseSections(user.section_permissions);
            const isExpanded = expandedId === user.id;
            const isActive = user.access_status === 'active';

            return (
              <div key={user.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                        isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}>{isActive ? 'Active' : user.access_status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" />{user.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => copyLink(user)} title="Copy portal link"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                      <LinkIcon className="w-3.5 h-3.5" />
                    </button>
                    <a href={getPortalUrl(user)} target="_blank" rel="noopener noreferrer">
                      <button title="Preview portal"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </a>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : user.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded: section permissions + actions */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-4 space-y-4 bg-secondary/20">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-3">Visible Sections</p>
                      <SectionToggles sections={sections} onChange={(key, val) => updateSections(user, key, val)} />
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
                      <button onClick={() => regenerateLink(user)}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground">
                        <RefreshCw className="w-3 h-3" /> Regenerate Link
                      </button>
                      {isActive ? (
                        <button onClick={() => revokeAccess(user)}
                          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                          <ShieldOff className="w-3 h-3" /> Revoke Access
                        </button>
                      ) : (
                        <button onClick={() => activateAccess(user)}
                          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors">
                          <CheckCircle2 className="w-3 h-3" /> Restore Access
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}