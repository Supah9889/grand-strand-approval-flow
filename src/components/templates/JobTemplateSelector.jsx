/**
 * JobTemplateSelector
 * Dropdown for selecting a JobTemplate in NewJobPage.
 * On confirm, calls onApply(template) with the parsed template object.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { LayoutTemplate, ChevronDown, CheckCircle2, X } from 'lucide-react';

export default function JobTemplateSelector({ companyId, onApply, appliedTemplateName }) {
  const [open, setOpen] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['job-templates', companyId],
    queryFn: () => companyId
      ? base44.entities.JobTemplate.filter({ company_id: companyId, active: true }, 'name')
      : base44.entities.JobTemplate.filter({ active: true }, 'name'),
  });

  const handleSelect = (tpl) => {
    setOpen(false);
    onApply(tpl);
  };

  const SERVICE_LINE_LABELS = {
    water_mitigation: 'Water Mitigation',
    mold_mitigation: 'Mold Mitigation',
    air_sample_testing: 'Air Sample Testing',
    reconstruction: 'Reconstruction',
    emergency_response: 'Emergency Response',
    interior_painting: 'Interior Painting',
    exterior_painting: 'Exterior Painting',
    drywall: 'Drywall',
    insulation: 'Insulation',
    other: 'Other',
  };

  return (
    <div className="relative">
      {appliedTemplateName ? (
        <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-emerald-300 bg-emerald-50 text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1 text-emerald-800 font-medium text-xs truncate">Template: {appliedTemplateName}</span>
          <button type="button" onClick={() => onApply(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-2 h-10 px-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-sm text-primary hover:bg-primary/10 transition-colors"
        >
          <LayoutTemplate className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left text-xs font-medium">Apply a Job Template (optional)</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}

      {open && !appliedTemplateName && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {templates.length === 0 && (
            <p className="px-3 py-3 text-xs text-muted-foreground">No templates available. Create one in Field Templates.</p>
          )}
          {templates.map(tpl => (
            <button
              key={tpl.id}
              type="button"
              onMouseDown={() => handleSelect(tpl)}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors border-b border-border/50 last:border-0"
            >
              <p className="font-medium text-foreground text-xs">{tpl.name}</p>
              {tpl.service_line && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{SERVICE_LINE_LABELS[tpl.service_line] || tpl.service_line}</p>
              )}
              {tpl.description && (
                <p className="text-[11px] text-muted-foreground truncate">{tpl.description}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}