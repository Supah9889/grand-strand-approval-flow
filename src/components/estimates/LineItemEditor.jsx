import React from 'react';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';

const empty = () => ({ id: crypto.randomUUID(), description: '', qty: 1, unit: 'each', unit_price: 0, taxable: false });

export default function LineItemEditor({ items = [], onChange }) {
  const add = () => onChange([...items, empty()]);

  const update = (id, field, value) => {
    onChange(items.map(li => li.id === id ? { ...li, [field]: value } : li));
  };

  const remove = (id) => onChange(items.filter(li => li.id !== id));

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_56px_80px_88px_72px_32px] gap-1.5 px-1">
        {['Description', 'Qty', 'Unit', 'Unit Price', 'Total', ''].map(h => (
          <p key={h} className="text-xs font-medium text-muted-foreground">{h}</p>
        ))}
      </div>

      {items.map((li, i) => {
        const lineTotal = (Number(li.qty) * Number(li.unit_price)) || 0;
        return (
          <div key={li.id} className="grid grid-cols-[1fr_56px_80px_88px_72px_32px] gap-1.5 items-center">
            <Input
              value={li.description}
              onChange={e => update(li.id, 'description', e.target.value)}
              placeholder="Line item description"
              className="h-8 text-xs rounded-lg"
            />
            <Input
              type="number"
              min="0"
              value={li.qty}
              onChange={e => update(li.id, 'qty', e.target.value)}
              className="h-8 text-xs rounded-lg text-center"
            />
            <Input
              value={li.unit}
              onChange={e => update(li.id, 'unit', e.target.value)}
              placeholder="unit"
              className="h-8 text-xs rounded-lg"
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              value={li.unit_price}
              onChange={e => update(li.id, 'unit_price', e.target.value)}
              className="h-8 text-xs rounded-lg text-right"
            />
            <p className="text-xs font-semibold text-right text-foreground tabular-nums">
              ${lineTotal.toFixed(2)}
            </p>
            <button
              type="button"
              onClick={() => remove(li.id)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium py-1 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add Line Item
      </button>
    </div>
  );
}