import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { EXPORT_STATUS_CONFIG } from '@/lib/exportHelpers';

export default function ExportFilters({ typeCfg, filters, onChange, jobs, employees, vendors }) {
  const set = (k, v) => onChange({ ...filters, [k]: v });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Filters</p>
        <button
          onClick={() => onChange({ dateFrom: '', dateTo: '', exportStatus: 'all', recordStatus: 'all', jobId: 'all', employeeId: 'all', vendorId: 'all', includeArchived: false })}
          className="text-xs text-primary underline"
        >
          Clear all
        </button>
      </div>

      {/* Export Status */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Export Status</p>
        <Select value={filters.exportStatus || 'all'} onValueChange={v => set('exportStatus', v)}>
          <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(EXPORT_STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date range — only if type has a dateField */}
      {typeCfg?.dateField && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">From Date</p>
            <Input type="date" value={filters.dateFrom || ''} onChange={e => set('dateFrom', e.target.value)} className="h-8 rounded-lg text-xs" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">To Date</p>
            <Input type="date" value={filters.dateTo || ''} onChange={e => set('dateTo', e.target.value)} className="h-8 rounded-lg text-xs" />
          </div>
        </div>
      )}

      {/* Job filter — for record types linked to jobs */}
      {['invoices', 'expenses', 'bills', 'time_entries'].includes(typeCfg?.key) && jobs?.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Job / Project</p>
          <Select value={filters.jobId || 'all'} onValueChange={v => set('jobId', v)}>
            <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              {jobs.map(j => (
                <SelectItem key={j.id} value={j.id}>{j.address}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Employee filter — time entries */}
      {typeCfg?.key === 'time_entries' && employees?.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Employee</p>
          <Select value={filters.employeeId || 'all'} onValueChange={v => set('employeeId', v)}>
            <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Vendor filter — bills & expenses */}
      {['bills', 'expenses'].includes(typeCfg?.key) && vendors?.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Vendor</p>
          <Select value={filters.vendorId || 'all'} onValueChange={v => set('vendorId', v)}>
            <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendors.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Include archived toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!filters.includeArchived}
          onChange={e => set('includeArchived', e.target.checked)}
          className="rounded"
        />
        <span className="text-xs text-muted-foreground">Include archived records</span>
      </label>
    </div>
  );
}