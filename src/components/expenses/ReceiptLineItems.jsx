import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { UNIT_OPTIONS, makeBlankItem } from './ReceiptParser';
import CostCodePicker from '@/components/costcodes/CostCodePicker';

function calcLineTotal(item) {
  const qty = parseFloat(item.quantity) || 0;
  const cost = parseFloat(item.unit_cost) || 0;
  return qty * cost;
}

export default function ReceiptLineItems({ items, onChange }) {
  const update = (id, field, value) => {
    onChange(items.map(item => {
      if (item._id !== id) return item;
      const updated = { ...item, [field]: value };
      // auto-recalculate line total when qty or cost changes
      if (field === 'quantity' || field === 'unit_cost') {
        updated.line_total = String(calcLineTotal(updated).toFixed(2));
      }
      return updated;
    }));
  };

  const addRow = () => onChange([...items, makeBlankItem()]);
  const removeRow = (id) => onChange(items.filter(i => i._id !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-foreground">Line Items ({items.length})</p>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs rounded-lg gap-1" onClick={addRow}>
          <Plus className="w-3 h-3" /> Add Row
        </Button>
      </div>

      {/* Header */}
      <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_2fr_1fr_auto] gap-1.5 px-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        <span>Description</span>
        <span>Unit Cost</span>
        <span>Qty</span>
        <span>Unit</span>
        <span>Cost Code</span>
        <span>Total</span>
        <span></span>
      </div>

      {items.map((item, idx) => (
        <div key={item._id} className="border border-border rounded-xl p-3 space-y-2 md:space-y-0 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_2fr_1fr_auto] md:gap-1.5 md:items-center bg-card">
          {/* Mobile label */}
          <div className="flex items-center justify-between md:hidden mb-1">
            <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
            <button type="button" onClick={() => removeRow(item._id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1 md:space-y-0">
            <label className="text-[10px] text-muted-foreground md:hidden">Description</label>
            <Input
              value={item.title}
              placeholder="Item description"
              onChange={e => update(item._id, 'title', e.target.value)}
              className="h-8 text-xs rounded-lg"
            />
            {item.sku && (
              <p className="text-[10px] text-muted-foreground mt-0.5">SKU: {item.sku}</p>
            )}
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground md:hidden">Unit Cost</label>
            <Input
              type="number"
              value={item.unit_cost}
              placeholder="0.00"
              onChange={e => update(item._id, 'unit_cost', e.target.value)}
              className="h-8 text-xs rounded-lg"
            />
            {item.original_price && parseFloat(item.original_price) > parseFloat(item.unit_cost) && (
              <p className="text-[10px] text-muted-foreground line-through mt-0.5">${item.original_price}</p>
            )}
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground md:hidden">Qty</label>
            <Input
              type="number"
              value={item.quantity}
              placeholder="1"
              min="0"
              step="any"
              onChange={e => update(item._id, 'quantity', e.target.value)}
              className="h-8 text-xs rounded-lg"
            />
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground md:hidden">Unit</label>
            <Select value={item.unit} onValueChange={v => update(item._id, 'unit', v)}>
              <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground md:hidden">Cost Code</label>
            <CostCodePicker
              value={item.cost_code_id || ''}
              label={item.cost_code || ''}
              onSelect={(id, code) => {
                update(item._id, 'cost_code_id', id);
                update(item._id, 'cost_code', code?.name || '');
              }}
              onClear={() => {
                update(item._id, 'cost_code_id', '');
                update(item._id, 'cost_code', '');
              }}
              recordType="expense"
              compact
            />
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground md:hidden">Total</label>
            <div className="h-8 flex items-center px-2 bg-muted/50 rounded-lg text-xs font-semibold text-foreground border border-border">
              ${calcLineTotal(item).toFixed(2)}
            </div>
          </div>

          <button type="button" onClick={() => removeRow(item._id)} className="hidden md:flex items-center justify-center text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">No items. Click "Add Row" to add one.</p>
      )}
    </div>
  );
}