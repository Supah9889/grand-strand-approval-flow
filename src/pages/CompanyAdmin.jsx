import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Building2, Users, Code2, Edit2, Loader2, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CompanyForm from '@/components/company/CompanyForm';
import CostCodeManager from '@/components/company/CompanyCostCodeManager';
import MembershipManager from '@/components/company/MembershipManager';
import { isAdmin } from '@/lib/adminAuth';

export default function CompanyAdmin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState('companies');
  const [editTarget, setEditTarget] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list('-created_date'),
  });

  if (!isAdmin()) {
    return (
      <AppLayout title="Company Admin">
        <div className="app-page flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Admin access required.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Company Admin">
      <div className="app-page space-y-4">
        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Company Administration</h1>
            <p className="app-page-subtitle">Manage companies, memberships, and cost codes</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate('/access-management')}>
              <Shield className="w-4 h-4" /> Access
            </Button>
            {tab === 'companies' && (
              <Button size="sm" onClick={() => { setEditTarget(null); setShowForm(true); }}>
                <Plus className="w-4 h-4" /> New Company
              </Button>
            )}
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="companies" className="flex-1"><Building2 className="w-3.5 h-3.5 mr-1.5" />Companies</TabsTrigger>
            <TabsTrigger value="memberships" className="flex-1"><Users className="w-3.5 h-3.5 mr-1.5" />Members</TabsTrigger>
            <TabsTrigger value="cost_codes" className="flex-1"><Code2 className="w-3.5 h-3.5 mr-1.5" />Cost Codes</TabsTrigger>
          </TabsList>

          <TabsContent value="companies" className="mt-3 space-y-2">
            {isLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : companies.map(c => (
              <div key={c.id} className="app-card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="font-bold text-primary text-sm">{c.slug}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{c.industry}</p>
                </div>
                <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-[10px]">
                  {c.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <Button size="icon" variant="ghost" onClick={() => { setEditTarget(c); setShowForm(true); }}>
                  <Edit2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {!isLoading && companies.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">No companies yet.</div>
            )}
          </TabsContent>

          <TabsContent value="memberships" className="mt-3">
            <MembershipManager companies={companies} />
          </TabsContent>

          <TabsContent value="cost_codes" className="mt-3">
            <CostCodeManager companies={companies} />
          </TabsContent>
        </Tabs>
      </div>

      {showForm && (
        <CompanyForm
          initial={editTarget}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['companies'] }); setShowForm(false); setEditTarget(null); }}
        />
      )}
    </AppLayout>
  );
}