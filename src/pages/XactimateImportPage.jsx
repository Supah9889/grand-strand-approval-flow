import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Upload, FileText, CheckCircle2, AlertTriangle, Clock, Eye, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { getCurrentCompany } from '@/lib/permissions';
import { getSession } from '@/lib/adminAuth';
import { audit } from '@/lib/audit';
import { toast } from 'sonner';
import XactimateReviewModal from '@/components/xactimate/XactimateReviewModal';
import { useCompanyGuard, NoAccessState } from '@/components/CompanyGuard';
import usePermissions from '@/hooks/usePermissions';

const STATUS_MAP = {
  uploaded:     { label: 'Uploaded',      color: 'bg-blue-100 text-blue-700' },
  parsing:      { label: 'Parsing…',      color: 'bg-yellow-100 text-yellow-700' },
  needs_review: { label: 'Needs Review',  color: 'bg-amber-100 text-amber-700' },
  approved:     { label: 'Approved',      color: 'bg-green-100 text-green-700' },
  rejected:     { label: 'Rejected',      color: 'bg-red-100 text-red-700' },
  imported:     { label: 'Imported',      color: 'bg-primary/10 text-primary' },
};

export default function XactimateImportPage() {
  const qc = useQueryClient();
  const company = getCurrentCompany();
  const session = getSession();
  const { canManageXactimate } = usePermissions();
  const companyGuard = useCompanyGuard('Select a company to access Xactimate imports.');
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [reviewTarget, setReviewTarget] = useState(null);

  const { data: imports = [], isLoading } = useQuery({
    queryKey: ['xactimate-imports', company?.id],
    queryFn: () => company
      ? base44.entities.XactimateImport.filter({ company_id: company.id }, '-created_date', 100)
      : Promise.resolve([]),
    enabled: !!company,
  });

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const record = await base44.entities.XactimateImport.create({
        company_id: company.id,
        company_slug: company.slug,
        file_url,
        file_name: file.name,
        file_size: file.size,
        uploaded_by_id: session?.employee?.id || '',
        uploaded_by_name: session?.employee?.name || session?.name || 'Unknown',
        status: 'needs_review',
      });
      audit.xactimate.uploaded(record.id, session?.employee?.name || 'Admin', file.name)
        .catch(() => toast.warning('Audit log failed'));
      qc.invalidateQueries({ queryKey: ['xactimate-imports', company?.id] });
      setReviewTarget(record);
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const pending = imports.filter(i => ['uploaded', 'needs_review'].includes(i.status));
  const completed = imports.filter(i => ['approved', 'imported', 'rejected'].includes(i.status));

  if (companyGuard) return <AppLayout title="Xactimate Imports">{companyGuard}</AppLayout>;
  if (!canManageXactimate) return (
    <AppLayout title="Xactimate Imports">
      <NoAccessState message="You do not have permission to access Xactimate imports." />
    </AppLayout>
  );

  return (
    <AppLayout title="Xactimate Imports">
      <div className="app-page space-y-4">
        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Xactimate Imports</h1>
            <p className="app-page-subtitle">{company?.name} · ESX File Review Pipeline</p>
          </div>
        </div>

        {/* Upload Zone */}
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${uploading ? 'border-primary bg-primary/5 cursor-not-allowed' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
        >
          <input ref={fileRef} type="file" accept=".esx,.xml,.zip,.pdf" className="hidden" onChange={handleFileSelect} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-primary">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-medium">Uploading file…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="w-8 h-8" />
              <p className="text-sm font-semibold text-foreground">Upload ESX / Xactimate File</p>
              <p className="text-xs">ESX, XML, ZIP, or PDF · Tap to select</p>
            </div>
          )}
        </div>

        {uploadError && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/30 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {uploadError}
          </div>
        )}

        {/* Pending review */}
        {pending.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Pending Review ({pending.length})
            </p>
            {pending.map(imp => (
              <ImportCard key={imp.id} item={imp} onReview={() => setReviewTarget(imp)} />
            ))}
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completed ({completed.length})
            </p>
            {completed.map(imp => (
              <ImportCard key={imp.id} item={imp} onReview={() => setReviewTarget(imp)} />
            ))}
          </div>
        )}

        {!isLoading && imports.length === 0 && !uploading && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No imports yet. Upload an ESX file to begin.
          </div>
        )}
      </div>

      {reviewTarget && (
        <XactimateReviewModal
          item={reviewTarget}
          company={company}
          session={session}
          onClose={() => setReviewTarget(null)}
          onUpdated={() => { qc.invalidateQueries({ queryKey: ['xactimate-imports', company?.id] }); setReviewTarget(null); }}
        />
      )}
    </AppLayout>
  );
}

function ImportCard({ item, onReview }) {
  const s = STATUS_MAP[item.status] || STATUS_MAP.uploaded;
  return (
    <button
      onClick={onReview}
      className="w-full text-left app-card p-4 hover:border-primary/40 transition-colors flex items-start gap-3"
    >
      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
        <FileText className="w-5 h-5 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-foreground truncate">{item.file_name}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.color}`}>{s.label}</span>
        </div>
        {item.customer_name && <p className="text-xs text-muted-foreground mt-0.5">{item.customer_name}</p>}
        {item.property_address && <p className="text-xs text-muted-foreground">{item.property_address}</p>}
        <p className="text-xs text-muted-foreground mt-0.5">By {item.uploaded_by_name}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
    </button>
  );
}