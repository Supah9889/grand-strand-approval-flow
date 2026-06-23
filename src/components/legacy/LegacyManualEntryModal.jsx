import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getCurrentCompany } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';

const SERVICE_LINES = [
  'water_mitigation','mold_mitigation','air_sample_testing','reconstruction',
  'emergency_response','interior_painting','exterior_painting','drywall',
  'insulation','cabinet_painting','epoxy_garage_floor','other',
];

export default function LegacyManualEntryModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const company = getCurrentCompany();

  const [form, setForm] = useState({
    customer_name: '',
    property_address: '',
    job_name: '',
    service_line: '',
    job_status: '',
    assigned_people: '',
    start_date: '',
    notes: '',
    source_reference: '',
  });
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const create = useMutation({
    mutationFn: () => base44.entities.LegacyJobRecord.create({
      company_id: company.id,
      company_slug: company.slug,
      source_system: 'Proven Jobs',
      migration_status: 'needs_review',
      ...form,
    }),
    onSuccess: (record) => {
      logAudit('legacy_manual_job_created', 'LegacyJobRecord', record.id, {
        customer_name: form.customer_name,
        property_address: form.property_address,
        created_by: user?.full_name,
      });
      qc.invalidateQueries(['legacy-records']);
      onCreated?.(record);
    },
    onError: (err) => setError(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Add Legacy Job Manually</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs text-blue-800">This creates a <strong>needs_review</strong> legacy record sourced from Proven Jobs. It is not yet converted to a platform job.</p>
          </div>

          {[
            { key: 'customer_name', label: 'Customer Name *' },
            { key: 'property_address', label: 'Property Address *' },
            { key: 'job_name', label: 'Job Name' },
            { key: 'job_status', label: 'Job Status (from source)', placeholder: 'e.g. Active, In Progress' },
            { key: 'assigned_people', label: 'Assigned People', placeholder: 'Names, comma-separated' },
            { key: 'source_reference', label: 'Source Reference', placeholder: 'Proven Jobs job # or ID' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
              <input
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm"
                value={form[key]}
                placeholder={placeholder}
                onChange={set(key)}
              />
            </div>
          ))}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Service Line</label>
            <select className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm"
              value={form.service_line} onChange={set('service_line')}>
              <option value="">— None —</option>
              {SERVICE_LINES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Start Date</label>
            <input type="date"
              className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm"
              value={form.start_date} onChange={set('start_date')} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none"
              rows={3}
              placeholder="Any notes about this job from Proven Jobs..."
              value={form.notes}
              onChange={set('notes')}
            />
          </div>

          {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg p-2">{error}</p>}
        </div>

        <div className="flex gap-2 justify-end p-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending || !form.customer_name || !form.property_address}>
            {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Legacy Record
          </Button>
        </div>
      </div>
    </div>
  );
}