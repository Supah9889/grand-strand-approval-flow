import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getCurrentCompany } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Loader2, Search, RefreshCw, Send, Archive, Copy, Link2, ArrowRight } from 'lucide-react';
import LegacyStatusBadge from '@/components/legacy/LegacyStatusBadge';
import LegacyJobConvertModal from '@/components/legacy/LegacyJobConvertModal';
import AppLayout from '@/components/AppLayout';
import { format } from 'date-fns';

const TABS = ['jobs', 'customers', 'properties', 'notes', 'documents'];

const MIGRATION_STATUSES = ['all', 'imported', 'needs_review', 'linked', 'converted', 'archived', 'duplicate', 'error'];

const ENTITY_MAP = {
  jobs:       'LegacyJobRecord',
  customers:  'LegacyCustomerRecord',
  properties: 'LegacyPropertyRecord',
  notes:      'LegacyNoteRecord',
  documents:  'LegacyDocumentRecord',
};

function useRecords(tab, companyId) {
  return useQuery({
    queryKey: ['legacy-records', tab, companyId],
    queryFn: () => base44.entities[ENTITY_MAP[tab]].filter({ company_id: companyId }, '-created_date', 200),
    enabled: !!companyId,
  });
}

export default function LegacyRecords() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const company = getCurrentCompany();

  const [tab, setTab] = useState('jobs');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [convertRecord, setConvertRecord] = useState(null);

  const { data: records = [], isLoading, refetch } = useRecords(tab, company?.id);

  const filtered = useMemo(() => {
    let r = records;
    if (statusFilter !== 'all') r = r.filter(rec => rec.migration_status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(rec => {
        const searchable = [
          rec.customer_name, rec.property_address, rec.job_name, rec.address,
          rec.name, rec.note_text, rec.document_name, rec.legacy_id,
        ].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(q);
      });
    }
    return r;
  }, [records, statusFilter, search]);

  const updateStatus = useMutation({
    mutationFn: ({ id, migration_status }) =>
      base44.entities[ENTITY_MAP[tab]].update(id, { migration_status }),
    onSuccess: (_, vars) => {
      const auditKey = vars.migration_status === 'archived' ? 'legacy_record_archived'
        : vars.migration_status === 'duplicate' ? 'legacy_record_marked_duplicate'
        : 'legacy_record_linked';
      logAudit(auditKey, ENTITY_MAP[tab], vars.id, { migration_status: vars.migration_status });
      qc.invalidateQueries(['legacy-records', tab]);
    },
  });

  const sendToNexus = useMutation({
    mutationFn: async (rec) => {
      const nexus = await base44.entities.NexusItem.create({
        company_id: company.id,
        company_slug: company.slug,
        source_type: 'manual',
        source_id: rec.id,
        title: `Legacy Note: ${rec.note_type || 'General'} — ${rec.created_by || 'Unknown'}`,
        summary: rec.note_text?.slice(0, 300) || 'Legacy note imported for review',
        raw_content: rec.note_text,
        category: 'process_improvement',
        priority: 'normal',
        status: 'pending_review',
        submitted_by_id: user?.id,
        submitted_by_name: user?.full_name,
        linked_job_id: rec.linked_job_id || undefined,
      });
      await base44.entities.LegacyNoteRecord.update(rec.id, {
        nexus_item_id: nexus.id,
        migration_status: 'linked',
      });
      logAudit('legacy_record_sent_to_nexus', 'LegacyNoteRecord', rec.id, { nexus_item_id: nexus.id });
      return nexus;
    },
    onSuccess: () => qc.invalidateQueries(['legacy-records', tab]),
  });

  return (
    <AppLayout title="Legacy Records">
      <div className="app-page space-y-5">
        {/* Header */}
        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Legacy Records</h1>
            <p className="app-page-subtitle">Review and migrate Proven Jobs history into the new platform</p>
          </div>
          <div className="app-page-actions">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors
                ${tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-card text-sm"
              placeholder="Search by name, address, ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-9 px-3 rounded-lg border border-input bg-card text-sm"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            {MIGRATION_STATUSES.map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* Count */}
        <p className="text-xs text-muted-foreground">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</p>

        {/* Records */}
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
            <p className="text-sm text-muted-foreground">No records found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(rec => (
              <RecordRow
                key={rec.id}
                tab={tab}
                record={rec}
                onUpdateStatus={(migration_status) => updateStatus.mutate({ id: rec.id, migration_status })}
                onConvert={tab === 'jobs' ? () => setConvertRecord(rec) : undefined}
                onSendNexus={tab === 'notes' ? () => sendToNexus.mutate(rec) : undefined}
                isMutating={updateStatus.isPending || sendToNexus.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {convertRecord && (
        <LegacyJobConvertModal
          record={convertRecord}
          onClose={() => setConvertRecord(null)}
          onConverted={() => {
            setConvertRecord(null);
            qc.invalidateQueries(['legacy-records', tab]);
          }}
        />
      )}
    </AppLayout>
  );
}

function RecordRow({ tab, record: rec, onUpdateStatus, onConvert, onSendNexus, isMutating }) {
  const [expanded, setExpanded] = useState(false);

  const title = rec.job_name || rec.name || rec.address || rec.document_name || `Note #${rec.id?.slice(-6)}`;
  const sub = [rec.customer_name, rec.property_address, rec.legacy_id].filter(Boolean).join(' · ');

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1 min-w-0" onClick={() => setExpanded(v => !v)}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{title}</span>
            <LegacyStatusBadge status={rec.migration_status} />
          </div>
          {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
          {tab === 'notes' && rec.note_text && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rec.note_text}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-1 shrink-0">
          {tab === 'jobs' && rec.migration_status !== 'converted' && (
            <Button size="sm" onClick={onConvert} disabled={isMutating}>
              <ArrowRight className="w-3 h-3" /> Convert
            </Button>
          )}
          {tab === 'notes' && !rec.nexus_item_id && rec.migration_status !== 'archived' && (
            <Button size="sm" variant="outline" onClick={onSendNexus} disabled={isMutating}>
              <Send className="w-3 h-3" /> Nexus
            </Button>
          )}
          {rec.migration_status === 'imported' && (
            <Button size="sm" variant="outline" onClick={() => onUpdateStatus('needs_review')} disabled={isMutating}>
              Flag Review
            </Button>
          )}
          {!['archived', 'converted'].includes(rec.migration_status) && (
            <>
              <Button size="sm" variant="ghost" title="Mark Duplicate"
                onClick={() => onUpdateStatus('duplicate')} disabled={isMutating}>
                <Copy className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" title="Archive"
                onClick={() => onUpdateStatus('archived')} disabled={isMutating}>
                <Archive className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Raw Data */}
      {expanded && rec.raw_data && (
        <div className="border-t border-border bg-muted/40 p-3">
          <p className="text-[11px] font-semibold text-muted-foreground mb-1">Raw Source Data (read-only)</p>
          <pre className="text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap break-all">
            {(() => { try { return JSON.stringify(JSON.parse(rec.raw_data), null, 2); } catch { return rec.raw_data; } })()}
          </pre>
        </div>
      )}

      {/* Linked job indicator */}
      {rec.linked_job_id && (
        <div className="border-t border-border px-3 py-1.5 bg-green-50 flex items-center gap-1.5">
          <Link2 className="w-3 h-3 text-green-600" />
          <span className="text-[11px] text-green-700 font-medium">Linked to Job {rec.linked_job_id.slice(-8)}</span>
        </div>
      )}
    </div>
  );
}