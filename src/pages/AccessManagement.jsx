import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Plus, Loader2, X, Users, Shield, Building2, ChevronDown,
  Edit2, CheckCircle2, Search
} from 'lucide-react';
import { isAdmin } from '@/lib/adminAuth';
import { PERMISSION_GROUPS } from '@/lib/permissions';
import { toast } from 'sonner';
import MembershipEditor from '@/components/access/MembershipEditor';

const ROLE_COLORS = {
  owner: 'bg-amber-100 text-amber-800',
  operations_admin: 'bg-primary/10 text-primary',
  estimator: 'bg-cyan-100 text-cyan-800',
  field_technician: 'bg-green-100 text-green-800',
  office_support: 'bg-purple-100 text-purple-800',
  vendor: 'bg-orange-100 text-orange-800',
  nexus_reviewer: 'bg-indigo-100 text-indigo-800',
};

function PermissionBadge({ label, active }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground/60'}`}>
      {label}
    </span>
  );
}

function MemberCard({ member, onEdit, onToggleActive, canManage }) {
  const pg = PERMISSION_GROUPS.find(g => g.value === member.permission_group);
  return (
    <div className={`app-card p-4 space-y-2 ${!member.is_active ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 font-bold text-sm text-muted-foreground">
          {member.employee_name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{member.employee_name}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${ROLE_COLORS[member.role] || 'bg-muted text-muted-foreground'}`}>
              {member.role?.replace(/_/g, ' ')}
            </span>
            {pg && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${pg.color}`}>
                {pg.label}
              </span>
            )}
            {!member.is_active && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">Inactive</span>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onEdit(member)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={() => onToggleActive(member)}
              className={`p-1.5 rounded-lg transition-colors ${member.is_active ? 'hover:bg-destructive/10' : 'hover:bg-emerald-50'}`}
            >
              {member.is_active
                ? <X className="w-3.5 h-3.5 text-destructive" />
                : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
            </button>
          </div>
        )}
      </div>

      {/* Permission flags row */}
      <div className="flex flex-wrap gap-1 pl-12">
        <PermissionBadge label="Financials" active={member.can_view_financials || member.can_edit_financials} />
        <PermissionBadge label="Edit $" active={member.can_edit_financials} />
        <PermissionBadge label="Nexus" active={member.can_approve_nexus} />
        <PermissionBadge label="Sub Review" active={member.can_review_subcontract_notes} />
        <PermissionBadge label="Mgmt" active={member.can_manage_users} />
      </div>

      {member.reviewer_assignment && (
        <p className="text-xs text-muted-foreground pl-12">Reviewer: {member.reviewer_assignment}</p>
      )}
    </div>
  );
}

function CompanySummaryCard({ company, members, onSelect }) {
  const active = members.filter(m => m.is_active !== false);
  const roles = [...new Set(active.map(m => m.role))];
  return (
    <button onClick={() => onSelect(company)}
      className="app-card p-4 text-left hover:border-primary/40 transition-colors w-full">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <span className="font-bold text-primary text-sm">{company.slug}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{company.name}</p>
          <p className="text-xs text-muted-foreground">{active.length} active member{active.length !== 1 ? 's' : ''}</p>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {roles.slice(0, 4).map(r => (
          <span key={r} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${ROLE_COLORS[r] || 'bg-muted text-muted-foreground'}`}>
            {r.replace(/_/g, ' ')}
          </span>
        ))}
        {roles.length > 4 && <span className="text-[10px] text-muted-foreground">+{roles.length - 4} more</span>}
      </div>
    </button>
  );
}

export default function AccessManagement() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('by_company');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [search, setSearch] = useState('');

  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list('-created_date'),
  });

  const { data: allMemberships = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['all-memberships'],
    queryFn: () => base44.entities.CompanyMembership.list('-created_date', 500),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => base44.entities.Employee.list('name', 200),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (member) =>
      base44.entities.CompanyMembership.update(member.id, { is_active: !member.is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-memberships'] });
      qc.invalidateQueries({ queryKey: ['company-memberships'] });
      toast.success('Member access updated');
    },
  });

  if (!isAdmin()) {
    return (
      <AppLayout title="Access Management">
        <div className="app-page flex items-center justify-center py-20">
          <div className="text-center">
            <Shield className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-semibold">Admin access required</p>
            <p className="text-xs text-muted-foreground mt-1">Only owners and admins can manage access.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const companyMembers = (companyId) =>
    allMemberships.filter(m => m.company_id === companyId);

  const filteredBySearch = search
    ? allMemberships.filter(m =>
        m.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
        m.company_name?.toLowerCase().includes(search.toLowerCase()) ||
        m.role?.includes(search.toLowerCase())
      )
    : allMemberships;

  return (
    <AppLayout title="Access Management">
      <div className="app-page space-y-4 pb-24">
        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Access Management</h1>
            <p className="app-page-subtitle">Manage company memberships, roles, and permissions</p>
          </div>
          <Button size="sm" onClick={() => setEditTarget({})}>
            <Plus className="w-4 h-4" /> Add Member
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="by_company" className="flex-1">
              <Building2 className="w-3.5 h-3.5 mr-1.5" />By Company
            </TabsTrigger>
            <TabsTrigger value="all_members" className="flex-1">
              <Users className="w-3.5 h-3.5 mr-1.5" />All Members
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex-1">
              <Shield className="w-3.5 h-3.5 mr-1.5" />Permission Groups
            </TabsTrigger>
          </TabsList>

          {/* ── By Company ── */}
          <TabsContent value="by_company" className="mt-3 space-y-3">
            {loadingCompanies ? (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : selectedCompany ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedCompany(null)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    ← All Companies
                  </button>
                  <span className="text-xs text-muted-foreground">/ {selectedCompany.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold flex-1">{selectedCompany.name} Members</h2>
                  <Button size="sm" variant="outline" onClick={() => setEditTarget({ company_id: selectedCompany.id, company_name: selectedCompany.name, company_slug: selectedCompany.slug })}>
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Button>
                </div>

                {loadingMembers ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : companyMembers(selectedCompany.id).length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No members assigned yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {companyMembers(selectedCompany.id).map(m => (
                      <MemberCard
                        key={m.id}
                        member={m}
                        canManage={true}
                        onEdit={setEditTarget}
                        onToggleActive={toggleActiveMutation.mutate}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              companies.map(c => (
                <CompanySummaryCard
                  key={c.id}
                  company={c}
                  members={companyMembers(c.id)}
                  onSelect={setSelectedCompany}
                />
              ))
            )}
          </TabsContent>

          {/* ── All Members ── */}
          <TabsContent value="all_members" className="mt-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-background text-sm"
                placeholder="Search by name, company, or role…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {loadingMembers ? (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : filteredBySearch.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">No members found.</p>
            ) : (
              <div className="space-y-2">
                {filteredBySearch.map(m => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    canManage={true}
                    onEdit={setEditTarget}
                    onToggleActive={toggleActiveMutation.mutate}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Permission Groups reference ── */}
          <TabsContent value="groups" className="mt-3 space-y-2">
            {PERMISSION_GROUPS.map(g => (
              <div key={g.value} className="app-card p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${g.color}`}>{g.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{g.description}</p>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  {g.defaultFinancialView && <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">View Financials</span>}
                  {g.defaultFinancialEdit && <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">Edit Financials</span>}
                  {g.defaultManageUsers && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">Manage Users</span>}
                  {g.defaultReviewSubcontract && <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full">Review Subcontracts</span>}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {editTarget !== null && (
        <MembershipEditor
          initial={editTarget}
          companies={companies}
          employees={employees}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['all-memberships'] });
            qc.invalidateQueries({ queryKey: ['company-memberships'] });
            setEditTarget(null);
          }}
        />
      )}
    </AppLayout>
  );
}