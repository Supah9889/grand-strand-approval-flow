import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2, Shield, AlertTriangle, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import AppLayout from '../components/AppLayout';
import { ACTION_LABELS } from '@/lib/audit';
import { getInternalRole, isAdmin as getIsAdmin } from '@/lib/adminAuth';
import { useNavigate } from 'react-router-dom';

const MODULES = ['job','signature','estimate','change_order','invoice','payment','bill','purchase_order','budget','time_entry','warranty','task','daily_log','lead','employee','portal','expense','system'];

export default function AuditLogPage() {
  const navigate = useNavigate();
  const role = getInternalRole();
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState('all');
  const [filterSensitive, setFilterSensitive] = useState('all');
  const [filterDate, setFilterDate] = useState('');

  if (role !== 'admin') {
    return (
      <AppLayout title="Audit Log">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Admin access required.</p>
        </div>
      </AppLayout>
    );
  }

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-log-page'],
    queryFn: () => base44.entities.AuditLog.list('-timestamp', 500),
  });

  const filtered = useMemo(() => {
    let l = logs;
    if (filterModule !== 'all') l = l.filter(e => e.module === filterModule);
    if (filterSensitive === 'sensitive') l = l.filter(e => e.is_sensitive);
    if (filterSensitive === 'override') l = l.filter(e => e.is_override);
    if (filterDate) l = l.filter(e => e.timestamp?.startsWith(filterDate));
    if (search) {
      const q = search.toLowerCase();
      l = l.filter(e =>
        e.detail?.toLowerCase().includes(q) ||
        e.actor?.toLowerCase().includes(q) ||
        e.action?.toLowerCase().includes(q) ||
        e.job_address?.toLowerCase().includes(q) ||
        e.reason?.toLowerCase().includes(q)
      );
    }
    return l;
  }, [logs, filterModule, filterSensitive, filterDate, search]);

  const overrideCount = logs.filter(l => l.is_override).length;
  const sensitiveCount = logs.filter(l => l.is_sensitive).length;

  return (
    <AppLayout title="Audit Log">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">
        <div>
          <h1 className="text-base font-semibold text-foreground">Audit Log</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{logs.length} total events · {sensitiveCount} sensitive · {overrideCount} overrides</p>
        </div>

        {/* Stat chips */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterSensitive('sensitive')}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${filterSensitive === 'sensitive' ? 'bg-amber-100 text-amber-700 border-amber-300' : 'border-border text-muted-foreground hover:border-amber-300'}`}>
            <Shield className="w-3 h-3" /> {sensitiveCount} Sensitive
          </button>
          <button onClick={() => setFilterSensitive('override')}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${filterSensitive === 'override' ? 'bg-red-100 text-red-700 border-red-300' : 'border-border text-muted-foreground hover:border-red-300'}`}>
            <AlertTriangle className="w-3 h-3" /> {overrideCount} Overrides
          </button>
          {filterSensitive !== 'all' && (
            <button onClick={() => setFilterSensitive('all')} className="text-xs text-muted-foreground underline">Clear</button>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search actor, detail, address..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl text-sm" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {MODULES.map(m => <SelectItem key={m} value={m}>{m.replace(/_/g,' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="h-8 text-xs rounded-lg w-auto" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No audit events found.</p>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
            {filtered.map((log, i) => {
              const cfg = ACTION_LABELS[log.action] || { label: log.action, color: 'text-foreground' };
              return (
                <div key={log.id || i} className={`px-4 py-3 ${log.is_override ? 'bg-red-50' : log.is_sensitive ? 'bg-amber-50/30' : 'bg-card'}`}>
                  <div className="flex items-start gap-2">
                    {log.is_override && <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />}
                    {!log.is_override && log.is_sensitive && <Shield className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                        <span className="text-xs text-muted-foreground/60 shrink-0">{log.timestamp ? format(parseISO(log.timestamp), 'MMM d, yyyy h:mm a') : ''}</span>
                      </div>
                      {log.detail && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{log.detail}</p>}
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground/70">
                        {log.module && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{log.module}</span>}
                        {log.actor && <span>{log.actor}{log.actor_role ? ` · ${log.actor_role}` : ''}</span>}
                        {log.job_address && <span>{log.job_address}</span>}
                      </div>
                      {log.reason && <p className="text-xs text-amber-700 italic mt-1">Reason: {log.reason}</p>}
                      {(log.old_value || log.new_value) && (
                        <div className="flex gap-2 mt-1.5 flex-wrap text-xs">
                          {log.old_value && <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-100">Old: {log.old_value}</span>}
                          {log.new_value && <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">New: {log.new_value}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}