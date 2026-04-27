import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, ChevronDown, X, AlertTriangle } from 'lucide-react';

const CATEGORY_LABELS = {
  labor: 'Labor',
  materials: 'Materials',
  equipment: 'Equipment',
  subcontractor: 'Subcontractor',
  overhead: 'Overhead',
  administrative: 'Administrative',
  permit_inspection: 'Permit / Inspection',
  travel: 'Travel',
  disposal_cleanup: 'Disposal / Cleanup',
  miscellaneous: 'Miscellaneous',
  revenue_billing: 'Revenue / Billing',
  other: 'Other',
};

/**
 * CostCodePicker — reusable structured cost code selector
 * 
 * Props:
 *   value          — selected cost code ID
 *   onChange       — (id, costCodeRecord) => void
 *   recordType     — one of: expense | bill | invoice | estimate | time_entry | job
 *   placeholder    — string override
 *   disabled       — boolean
 *   showWarning    — show warning if selected code is not valid for recordType
 *   filterCategory — restrict to a specific category
 *   className      — wrapper class override
 */
export default function CostCodePicker({
  value,
  onChange,
  recordType,
  placeholder = 'Select cost code…',
  disabled = false,
  showWarning = true,
  filterCategory,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  const { data: allCodes = [] } = useQuery({
    queryKey: ['cost-codes-picker'],
    queryFn: () => base44.entities.CostCode.list('display_order', 500),
    staleTime: 60000,
  });

  // Click outside to close
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeCodes = useMemo(() => {
    return allCodes.filter(c => {
      if (c.status === 'archived') return false;
      if (c.status === 'inactive') return false; // only active codes selectable by users
      if (filterCategory && c.category !== filterCategory) return false;
      return true;
    });
  }, [allCodes, filterCategory]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return activeCodes.filter(c =>
      !q ||
      c.code_number?.toLowerCase().includes(q) ||
      c.name?.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.category?.toLowerCase().includes(q)
    );
  }, [activeCodes, search]);

  // Group by category
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(c => {
      const cat = c.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(c);
    });
    return groups;
  }, [filtered]);

  const selected = allCodes.find(c => c.id === value);

  // Check if selected code is valid for this record type
  const isInvalidForType = useMemo(() => {
    if (!selected || !recordType || !selected.allowed_on) return false;
    try {
      const allowed = JSON.parse(selected.allowed_on);
      return !allowed.includes(recordType);
    } catch { return false; }
  }, [selected, recordType]);

  const handleSelect = (code) => {
    onChange(code.id, code);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null, null);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 h-9 px-3 rounded-md border text-sm transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed bg-muted' : 'bg-background hover:border-primary/50 cursor-pointer'}
          ${open ? 'border-primary ring-1 ring-primary/30' : 'border-input'}
          ${isInvalidForType && showWarning ? 'border-orange-400' : ''}
        `}
      >
        {selected ? (
          <span className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-mono text-xs text-muted-foreground shrink-0">{selected.code_number}</span>
            <span className="truncate text-foreground">{selected.name}</span>
            {selected.status === 'inactive' && (
              <span className="text-xs text-orange-500 shrink-0">(inactive)</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground flex-1 text-left">{placeholder}</span>
        )}
        <span className="flex items-center gap-1 shrink-0">
          {selected && !disabled && (
            <span
              onClick={handleClear}
              className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground rounded"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Warning */}
      {isInvalidForType && showWarning && selected && (
        <div className="flex items-center gap-1.5 mt-1">
          <AlertTriangle className="w-3 h-3 text-orange-500" />
          <p className="text-xs text-orange-600">
            This cost code is not configured for {recordType} records.
          </p>
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-xl overflow-hidden max-h-72 flex flex-col">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by number, name, or category…"
              className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="overflow-y-auto flex-1">
            {Object.keys(grouped).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No active cost codes found</p>
            ) : (
              Object.entries(grouped).map(([cat, codes]) => (
                <div key={cat}>
                  <div className="px-3 py-1.5 bg-muted/40 border-b border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {CATEGORY_LABELS[cat] || cat}
                    </p>
                  </div>
                  {codes.map(code => {
                    const active = code.id === value;
                    let validForType = true;
                    if (recordType && code.allowed_on) {
                      try {
                        const allowed = JSON.parse(code.allowed_on);
                        validForType = allowed.includes(recordType);
                      } catch {}
                    }
                    return (
                      <button
                        key={code.id}
                        type="button"
                        onClick={() => handleSelect(code)}
                        className={`w-full flex items-start gap-3 px-3 py-2 text-left text-sm hover:bg-accent transition-colors border-b border-border/50 last:border-0
                          ${active ? 'bg-secondary' : ''}
                          ${!validForType && recordType ? 'opacity-50' : ''}
                        `}
                      >
                        <span className="font-mono text-xs text-muted-foreground mt-0.5 shrink-0 w-12">{code.code_number}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium ${active ? 'text-primary' : 'text-foreground'}`}>{code.name}</p>
                          {code.description && (
                            <p className="text-xs text-muted-foreground truncate">{code.description}</p>
                          )}
                        </div>
                        {!validForType && recordType && (
                          <AlertTriangle className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}