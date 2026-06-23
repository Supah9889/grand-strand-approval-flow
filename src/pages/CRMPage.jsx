import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Search, Phone, Mail, MapPin, User, Building2, ChevronRight } from 'lucide-react';
import { getActiveCompany } from './CompanySelect';
import CustomerForm from '@/components/crm/CustomerForm';
import PropertyForm from '@/components/crm/PropertyForm';

const TYPE_COLORS = {
  homeowner: 'bg-blue-100 text-blue-700',
  tenant: 'bg-purple-100 text-purple-700',
  builder: 'bg-amber-100 text-amber-700',
  property_manager: 'bg-cyan-100 text-cyan-700',
  insurance: 'bg-rose-100 text-rose-700',
  commercial: 'bg-green-100 text-green-700',
  other: 'bg-gray-100 text-gray-600',
};

export default function CRMPage() {
  const qc = useQueryClient();
  const company = getActiveCompany();
  const [tab, setTab] = useState('customers');
  const [search, setSearch] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const { data: customers = [], isLoading: cLoading } = useQuery({
    queryKey: ['customers', company?.id],
    queryFn: () => company
      ? base44.entities.Customer.filter({ company_id: company.id }, '-created_date', 200)
      : Promise.resolve([]),
    enabled: !!company,
  });

  const { data: properties = [], isLoading: pLoading } = useQuery({
    queryKey: ['properties', company?.id],
    queryFn: () => company
      ? base44.entities.Property.filter({ company_id: company.id }, '-created_date', 200)
      : Promise.resolve([]),
    enabled: !!company,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ entity, id }) => base44.entities[entity].delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers', company?.id] }),
  });

  const filteredCustomers = customers.filter(c =>
    !search || c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const filteredProperties = properties.filter(p =>
    !search || p.address?.toLowerCase().includes(search.toLowerCase()) ||
    p.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="CRM">
      <div className="app-page space-y-4">
        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">CRM</h1>
            <p className="app-page-subtitle">{company?.name || 'All Companies'} · Customers & Properties</p>
          </div>
          <div className="app-page-actions">
            <Button size="sm" onClick={() => { setEditTarget(null); tab === 'customers' ? setShowCustomerForm(true) : setShowPropertyForm(true); }}>
              <Plus className="w-4 h-4" />
              Add {tab === 'customers' ? 'Customer' : 'Property'}
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customers or properties…"
            className="pl-9"
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="customers" className="flex-1">
              Customers <Badge variant="secondary" className="ml-1.5 text-[10px]">{customers.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="properties" className="flex-1">
              Properties <Badge variant="secondary" className="ml-1.5 text-[10px]">{properties.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers" className="mt-3 space-y-2">
            {cLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No customers found.</div>
            ) : filteredCustomers.map(c => (
              <button
                key={c.id}
                onClick={() => { setEditTarget(c); setShowCustomerForm(true); }}
                className="w-full text-left app-card p-4 hover:border-primary/40 transition-colors flex items-start gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{c.full_name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[c.type] || TYPE_COLORS.other}`}>{c.type?.replace('_', ' ')}</span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {c.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</p>}
                    {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</p>}
                    {c.referral_source && <p className="text-xs text-muted-foreground">Ref: {c.referral_source}</p>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
              </button>
            ))}
          </TabsContent>

          <TabsContent value="properties" className="mt-3 space-y-2">
            {pLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
            ) : filteredProperties.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No properties found.</div>
            ) : filteredProperties.map(p => (
              <button
                key={p.id}
                onClick={() => { setEditTarget(p); setShowPropertyForm(true); }}
                className="w-full text-left app-card p-4 hover:border-primary/40 transition-colors flex items-start gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{p.address}</p>
                  <p className="text-xs text-muted-foreground">{[p.city, p.state, p.zip].filter(Boolean).join(', ')}</p>
                  {p.customer_name && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><User className="w-3 h-3" />{p.customer_name}</p>}
                  {p.property_type && <p className="text-xs text-muted-foreground capitalize">{p.property_type.replace('_', ' ')}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
              </button>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {showCustomerForm && (
        <CustomerForm
          company={company}
          initial={editTarget}
          onClose={() => { setShowCustomerForm(false); setEditTarget(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['customers', company?.id] }); setShowCustomerForm(false); setEditTarget(null); }}
        />
      )}
      {showPropertyForm && (
        <PropertyForm
          company={company}
          customers={customers}
          initial={editTarget}
          onClose={() => { setShowPropertyForm(false); setEditTarget(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['properties', company?.id] }); setShowPropertyForm(false); setEditTarget(null); }}
        />
      )}
    </AppLayout>
  );
}