import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getCurrentCompany, canViewFinancials, canEditFinancials } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { X, Loader2, AlertTriangle } from 'lucide-react';

export default function LegacyJobConvertModal({ record, onClose, onConverted }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const company = getCurrentCompany();

  const [step, setStep] = useState('review'); // review | confirm
  const [form, setForm] = useState({
    customer_name: record.customer_name || '',
    property_address: record.property_address || '',
    job_name: record.job_name || '',
    service_line: record.service_line || '',
    description: `Migrated from ${record.source_system}. Legacy ID: ${record.legacy_id || 'N/A'}`,
    internal_notes: record.notes || '',
  });
  const [error, setError] = useState(null);

  const canFinancials = canViewFinancials() && canEditFinancials();

  const convert = useMutation({
    mutationFn: async () => {
      // 1. Create / find Customer
      let customer_id = record.linked_customer_id;
      if (!customer_id) {
        const cust = await base44.entities.Customer.create({
          company_id: company.id,
          company_slug: company.slug,
          name: form.customer_name,
          source_system: 'imported',
        });
        customer_id = cust.id;
        await base44.entities.LegacyCustomerRecord.filter({ company_id: company.id, customer_name: form.customer_name })
          .then(rows => rows.length && base44.entities.LegacyCustomerRecord.update(rows[0].id, {
            linked_customer_id: cust.id, migration_status: 'converted'
          })).catch(() => {});
      }

      // 2. Create / find Property
      let property_id = record.linked_property_id;
      if (!property_id) {
        const prop = await base44.entities.Property.create({
          company_id: company.id,
          company_slug: company.slug,
          customer_id,
          customer_name: form.customer_name,
          address: form.property_address,
        });
        property_id = prop.id;
      }

      // 3. Create Job
      const jobPayload = {
        company_id: company.id,
        company_slug: company.slug,
        company_name: company.name,
        title: form.job_name,
        address: form.property_address,
        customer_name: form.customer_name,
        customer_id,
        property_id,
        description: form.description,
        internal_notes: form.internal_notes,
        service_line: form.service_line || undefined,
        source_system: 'imported',
        lifecycle_status: 'open',
        op_status: 'new',
        status: 'pending',
        priority: 'normal',
        price: 0,
      };
      // Only copy start/close dates — no financial values without permission
      if (record.start_date) jobPayload.start_date = record.start_date;
      if (record.close_date) jobPayload.end_date = record.close_date;

      const job = await base44.entities.Job.create(jobPayload);

      // 4. Update LegacyJobRecord
      await base44.entities.LegacyJobRecord.update(record.id, {
        linked_job_id: job.id,
        linked_customer_id: customer_id,
        linked_property_id: property_id,
        migration_status: 'converted',
        converted_by: user?.full_name,
        converted_at: new Date().toISOString(),
      });

      logAudit('legacy_job_converted', 'LegacyJobRecord', record.id, {
        new_job_id: job.id,
        customer_name: form.customer_name,
        source_system: record.source_system,
      });

      return job;
    },
    onSuccess: (job) => {
      qc.invalidateQueries(['legacy-records']);
      onConverted?.(job);
    },
    onError: (err) => setError(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Convert Legacy Job to New Platform</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Safety Warning */}
          <div className="flex gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-yellow-800">Read-only source preserved</p>
              <p className="text-xs text-yellow-700">Raw legacy data will not be modified. A new Job record will be created. {!canFinancials && 'Financial values are not copied (no financial permission).'}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Customer Name</label>
              <input className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm"
                value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Property Address</label>
              <input className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm"
                value={form.property_address} onChange={e => setForm(f => ({ ...f, property_address: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Job Name</label>
              <input className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm"
                value={form.job_name} onChange={e => setForm(f => ({ ...f, job_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Service Line</label>
              <select className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm"
                value={form.service_line} onChange={e => setForm(f => ({ ...f, service_line: e.target.value }))}>
                <option value="">— None —</option>
                {['water_mitigation','mold_mitigation','air_sample_testing','reconstruction','emergency_response','interior_painting','exterior_painting','drywall','insulation','other']
                  .map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <textarea className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none"
                rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-lg p-2">{error}</p>
          )}
        </div>

        <div className="flex gap-2 justify-end p-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => convert.mutate()} disabled={convert.isPending}>
            {convert.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Convert to New Job
          </Button>
        </div>
      </div>
    </div>
  );
}