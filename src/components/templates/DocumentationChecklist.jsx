/**
 * DocumentationChecklist
 * Shows required documentation items for a job or work order,
 * evaluates what's satisfied, and warns about missing items.
 */
import React, { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, Circle, Camera, FileText, Droplets, Wind, Wrench, PenLine, UserCheck } from 'lucide-react';

const REQ_ICONS = {
  photo: Camera,
  note: FileText,
  moisture_reading: Droplets,
  drying_log: Wind,
  air_sample: Wind,
  equipment_assignment: Wrench,
  customer_signature: PenLine,
  manager_review: UserCheck,
};

function itemSatisfied(item, context) {
  const { photos = [], notes = [], moistureReadings = [], dryingLogs = [], airSamples = [], equipment = [], signature } = context;
  switch (item.requirement_type) {
    case 'photo': return photos.length > 0;
    case 'note': return notes.length > 0;
    case 'moisture_reading': return moistureReadings.length > 0;
    case 'drying_log': return dryingLogs.length > 0;
    case 'air_sample': return airSamples.length > 0;
    case 'equipment_assignment': return equipment.length > 0;
    case 'customer_signature': return !!signature;
    default: return false;
  }
}

export default function DocumentationChecklist({ requirements = [], context = {}, className = '' }) {
  const evaluated = useMemo(() =>
    requirements.map(item => ({ ...item, satisfied: itemSatisfied(item, context) })),
    [requirements, context]
  );

  const satisfied = evaluated.filter(i => i.satisfied).length;
  const total = evaluated.length;
  const allDone = satisfied === total;

  if (total === 0) return null;

  return (
    <div className={`rounded-xl border ${allDone ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'} p-3 space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          {allDone
            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
          Documentation Checklist
        </p>
        <span className={`text-xs font-bold ${allDone ? 'text-emerald-600' : 'text-amber-700'}`}>{satisfied}/{total}</span>
      </div>

      {!allDone && (
        <p className="text-[11px] text-amber-700">Complete all required items before marking this work order done.</p>
      )}

      <div className="space-y-1">
        {evaluated.map((item, i) => {
          const Icon = REQ_ICONS[item.requirement_type] || Circle;
          return (
            <div key={i} className="flex items-center gap-2">
              {item.satisfied
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                : <Circle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className={`text-xs ${item.satisfied ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}