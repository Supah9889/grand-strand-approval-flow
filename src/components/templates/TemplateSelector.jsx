/**
 * TemplateSelector
 * Dropdown to pick a JobTemplate or WorkOrderTemplate and apply its defaults.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { LayoutTemplate, ChevronDown, CheckCircle2 } from 'lucide-react';
import { getCurrentCompany } from '@/lib/permissions';

export default function TemplateSelector({ type = 'job', onApply, className = '' }) {
  const company = getCurrentCompany();
  const [open, setOpen] = useState(false);

  const entity = type === 'job' ? 'JobTemplate' : 'WorkOrderTemplate';
  const queryKey = type === 'job' ? ['job-templates', company?.id] : ['wo-templates', company?.id];

  const { data: templates = [] } = useQuery({
    queryKey,
    queryFn: () => company
      ? base44.entities[entity].filter({ company_id: company.id, active: true }, 'name')
      : base44.entities[entity].filter({ active: true }, 'name'),
  });

  if (templates.length === 0) return null;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input bg-background text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
      >
        <LayoutTemplate className="w-3.5 h-3.5" />
        Apply Template
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full mt-1 left-0 w-64 bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
            {templates.map(tpl => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => { onApply(tpl); setOpen(false); }}
                className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors"
              >
                <p className="text-sm font-medium text-foreground">{tpl.name}</p>
                {tpl.service_line && (
                  <p className="text-xs text-muted-foreground mt-0.5">{tpl.service_line.replace(/_/g, ' ')}</p>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}