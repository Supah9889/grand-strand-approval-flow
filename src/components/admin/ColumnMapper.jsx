import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { APP_FIELDS } from '@/lib/csvParser';

export default function ColumnMapper({ csvHeaders, mapping, onMappingChange, onConfirm }) {
  const requiredFields = APP_FIELDS.filter(f => f.required);
  const allRequiredMapped = requiredFields.every(f => mapping[f.key]);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-foreground text-base">Map CSV Columns</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Match each app field to a column from your CSV file.
        </p>
      </div>

      <div className="space-y-3">
        {APP_FIELDS.map(({ key, label, required }) => {
          const mapped = !!mapping[key];
          return (
            <div key={key} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  {required && <span className="text-destructive text-xs">*</span>}
                </div>
              </div>
              <div className="w-48 shrink-0">
                <Select
                  value={mapping[key] || '__none__'}
                  onValueChange={(val) =>
                    onMappingChange({ ...mapping, [key]: val === '__none__' ? '' : val })
                  }
                >
                  <SelectTrigger className={`h-9 rounded-lg text-xs ${
                    required && !mapped ? 'border-amber-300 bg-amber-50' : ''
                  }`}>
                    <SelectValue placeholder="— skip —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— skip —</SelectItem>
                    {csvHeaders.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-5 shrink-0">
                {mapped
                  ? <CheckCircle2 className="w-4 h-4 text-primary" />
                  : required
                  ? <AlertCircle className="w-4 h-4 text-amber-400" />
                  : null}
              </div>
            </div>
          );
        })}
      </div>

      {!allRequiredMapped && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
          Please map all required fields (*) before continuing.
        </p>
      )}

      <Button
        className="w-full h-11 rounded-xl"
        disabled={!allRequiredMapped}
        onClick={onConfirm}
      >
        Preview Records
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}