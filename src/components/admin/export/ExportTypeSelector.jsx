import React from 'react';
import { EXPORT_TYPES } from '@/lib/exportHelpers';

export default function ExportTypeSelector({ activeType, onSelect, recordCounts }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {EXPORT_TYPES.map(t => {
        const count = recordCounts[t.key] ?? '—';
        const isActive = activeType === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onSelect(t.key)}
            className={`text-left p-3 rounded-xl border transition-all ${
              isActive
                ? 'border-primary bg-secondary text-primary'
                : 'border-border text-foreground hover:border-primary/40 hover:bg-muted/40'
            }`}
          >
            <p className={`text-xs font-semibold truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
              {t.label}
            </p>
            <p className={`text-xs mt-0.5 ${isActive ? 'text-primary/70' : 'text-muted-foreground'}`}>
              {typeof count === 'number' ? `${count} records` : count}
            </p>
          </button>
        );
      })}
    </div>
  );
}