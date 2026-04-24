import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function JobFilters({ filters, onChange }) {
  const set = (key, val) => onChange({ ...filters, [key]: val });
  const hasActive = filters.search || filters.status !== 'all' || filters.date;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search address or customer…"
          value={filters.search}
          onChange={e => set('search', e.target.value)}
          className="pl-9 h-10 rounded-xl text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Select value={filters.status} onValueChange={v => set('status', v)}>
          <SelectTrigger className="h-9 flex-1 rounded-xl text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filters.date}
          onChange={e => set('date', e.target.value)}
          className="h-9 flex-1 rounded-xl text-xs"
        />
        {hasActive && (
          <Button
            variant="ghost" size="icon"
            className="h-9 w-9 rounded-xl shrink-0"
            onClick={() => onChange({ search: '', status: 'all', date: '' })}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}