import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, RefreshCw, SkipForward, PlusCircle, Loader2 } from 'lucide-react';

const DUP_OPTIONS = [
  { value: 'skip',   label: 'Skip',           icon: SkipForward  },
  { value: 'update', label: 'Update existing', icon: RefreshCw    },
  { value: 'new',    label: 'Import as new',   icon: PlusCircle   },
];

export default function ImportPreview({ rows, duplicates, onImport, importing }) {
  const [decisions, setDecisions] = useState(() =>
    rows.map((_, i) => (duplicates[i] ? 'skip' : 'new'))
  );

  const setAllDupes = (val) => {
    setDecisions(prev => prev.map((d, i) => (duplicates[i] ? val : d)));
  };

  const dupCount = duplicates.filter(Boolean).length;
  const newCount = rows.length - dupCount;

  const toImport  = rows.filter((_, i) => decisions[i] !== 'skip').length;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-foreground text-base">Preview Import</h3>
        <div className="flex gap-3 mt-2 flex-wrap">
          <Badge variant="secondary">{rows.length} total records</Badge>
          <Badge variant="secondary" className="text-primary">{newCount} new</Badge>
          {dupCount > 0 && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">{dupCount} duplicates</Badge>
          )}
        </div>
      </div>

      {dupCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-medium text-amber-700">
            <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
            {dupCount} duplicate{dupCount > 1 ? 's' : ''} detected. Apply same action to all:
          </p>
          <div className="flex gap-2">
            {DUP_OPTIONS.map(({ value, label }) => (
              <Button
                key={value}
                size="sm"
                variant="outline"
                className="text-xs h-7 rounded-lg border-amber-300"
                onClick={() => setAllDupes(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {rows.map((row, i) => {
          const dup = duplicates[i];
          return (
            <div
              key={i}
              className={`border rounded-xl p-3 text-xs space-y-1.5 ${
                dup ? 'border-amber-200 bg-amber-50/50' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{row.address}</p>
                  <p className="text-muted-foreground truncate">{row.customer_name} · ${Number(row.price || 0).toFixed(2)}</p>
                  {row.buildertrend_id && (
                    <p className="text-muted-foreground">BT: {row.buildertrend_id}</p>
                  )}
                </div>
                {dup ? (
                  <Select
                    value={decisions[i]}
                    onValueChange={(val) =>
                      setDecisions(prev => prev.map((d, j) => (j === i ? val : d)))
                    }
                  >
                    <SelectTrigger className="h-7 w-32 text-xs rounded-lg border-amber-300 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DUP_OPTIONS.map(({ value, label, icon: Icon }) => (
                        <SelectItem key={value} value={value}>
                          <div className="flex items-center gap-1.5">
                            <Icon className="w-3 h-3" />
                            {label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary" className="text-xs text-primary shrink-0">
                    <CheckCircle2 className="w-3 h-3 mr-1" />New
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button
        className="w-full h-11 rounded-xl"
        onClick={() => onImport(decisions)}
        disabled={importing || toImport === 0}
      >
        {importing ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing…</>
        ) : (
          `Import ${toImport} Record${toImport !== 1 ? 's' : ''}`
        )}
      </Button>
    </div>
  );
}