import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Upload, Download, Trash2, Calendar, Loader2, File, Check } from 'lucide-react';
import { parseISO, isPast, format, isToday } from 'date-fns';
import { toast } from 'sonner';
import { getInternalRole, isAdmin as getIsAdmin } from '@/lib/adminAuth';
import { audit } from '@/lib/audit';

export default function VendorCompliancePanel({ vendor, onUpdate }) {
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const isOwnerOrAdmin = getIsAdmin();
  const fileInputRef = useRef({});

  const [coiExpiryDate, setCoiExpiryDate] = useState(vendor.coi_expiration_date || '');
  const [wcExpiryDate, setWcExpiryDate] = useState(vendor.workers_comp_expiration_date || '');
  const [editingExpiry, setEditingExpiry] = useState(null); // 'coi' or 'wc'

  const { data: docs = [] } = useQuery({
    queryKey: ['vendor-compliance-docs', vendor.id],
    queryFn: () => base44.entities.VendorComplianceDocument.filter({ vendor_id: vendor.id, is_current: true }),
  });

  const updateVendorMutation = useMutation({
    mutationFn: (data) => base44.entities.Vendor.update(vendor.id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-compliance-docs', vendor.id] });
      onUpdate(updated);
      toast.success('Expiration date updated');
    },
  });

  const uploadDocMutation = useMutation({
    mutationFn: async (docData) => {
      const doc = await base44.entities.VendorComplianceDocument.create(docData);
      return doc;
    },
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-compliance-docs', vendor.id] });
      toast.success(`${doc.document_type === 'certificate_of_insurance' ? 'COI' : 'Workers\' Comp'} document uploaded`);
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId) => base44.entities.VendorComplianceDocument.delete(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-compliance-docs', vendor.id] });
      toast.success('Document removed');
    },
  });

  const isDateExpired = (dateStr) => {
    if (!dateStr) return false;
    try {
      const date = parseISO(dateStr);
      return isPast(date) && !isToday(date);
    } catch {
      return false;
    }
  };

  const handleUpload = async (docType, file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are allowed');
      return;
    }
    try {
      const uploaded = await base44.integrations.Core.UploadFile({ file });
      const docData = {
        vendor_id: vendor.id,
        vendor_name: vendor.company_name,
        document_type: docType,
        file_url: uploaded.file_url,
        file_name: file.name,
        file_size: file.size,
        uploaded_by: role || 'Admin',
        upload_date: new Date().toISOString(),
        is_current: true,
      };

      await uploadDocMutation.mutate(docData);
      const docTypeLabel = docType === 'certificate_of_insurance' ? 'COI' : 'Workers\' Comp';
      audit.vendor.complianceDocumentUploaded(vendor.id, role || 'Admin', vendor.company_name, docTypeLabel, file.name, {
        vendor_id: vendor.id,
      });
    } catch (err) {
      toast.error('Failed to upload document');
    }
  };

  const handleSaveExpiry = (docType) => {
    const newDate = docType === 'coi' ? coiExpiryDate : wcExpiryDate;
    if (!newDate) {
      toast.error('Please select a date');
      return;
    }

    const oldDate = docType === 'coi' ? vendor.coi_expiration_date : vendor.workers_comp_expiration_date;
    const fieldName = docType === 'coi' ? 'coi_expiration_date' : 'workers_comp_expiration_date';
    const docLabel = docType === 'coi' ? 'COI' : 'Workers\' Comp';

    updateVendorMutation.mutate(
      { [fieldName]: newDate },
      {
        onSuccess: () => {
          audit.vendor.complianceExpirationUpdated(vendor.id, role || 'Admin', vendor.company_name, docLabel, oldDate, newDate, {
            vendor_id: vendor.id,
          });
          setEditingExpiry(null);
        },
      }
    );
  };

  const handleDeleteDoc = (docId, docType) => {
    deleteDocMutation.mutate(docId, {
      onSuccess: () => {
        const docLabel = docType === 'certificate_of_insurance' ? 'COI' : 'Workers\' Comp';
        audit.vendor.complianceDocumentRemoved(vendor.id, role || 'Admin', vendor.company_name, docLabel, {
          vendor_id: vendor.id,
        });
      },
    });
  };

  if (!isOwnerOrAdmin) {
    return null;
  }

  const coiDocs = docs.filter((d) => d.document_type === 'certificate_of_insurance' && d.is_current);
  const wcDocs = docs.filter((d) => d.document_type === 'workers_compensation' && d.is_current);
  const coiExpired = isDateExpired(coiExpiryDate);
  const wcExpired = isDateExpired(wcExpiryDate);

  return (
    <div className="border-t border-border pt-4 mt-4 space-y-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Insurance Compliance</p>

        {/* COI Expiration */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">Certificate of Insurance Expiration</label>
            {editingExpiry !== 'coi' && isOwnerOrAdmin && (
              <button
                onClick={() => { setCoiExpiryDate(vendor.coi_expiration_date || ''); setEditingExpiry('coi'); }}
                className="text-xs text-primary hover:underline"
              >
                {coiExpiryDate ? 'Change' : 'Set'}
              </button>
            )}
          </div>

          {editingExpiry === 'coi' ? (
            <div className="flex gap-2">
              <Input
                type="date"
                value={coiExpiryDate}
                onChange={(e) => setCoiExpiryDate(e.target.value)}
                className="h-8 rounded-lg text-sm flex-1"
              />
              <Button
                size="sm"
                className="h-8 text-xs rounded-lg"
                onClick={() => handleSaveExpiry('coi')}
                disabled={updateVendorMutation.isPending}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs rounded-lg"
                onClick={() => setEditingExpiry(null)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className={`text-sm font-medium ${coiExpired ? 'text-destructive' : 'text-foreground'}`}>
              {coiExpiryDate ? (
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(parseISO(coiExpiryDate), 'MMM d, yyyy')}
                  {coiExpired && <span className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded font-medium">Expired</span>}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs italic">Not set</p>
              )}
            </div>
          )}
        </div>

        {/* COI Documents */}
        <div className="space-y-2 mb-4 bg-secondary/30 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">COI Documents</p>
            {isOwnerOrAdmin && (
              <input
                type="file"
                ref={(el) => (fileInputRef.current.coi_add = el)}
                onChange={(e) => handleUpload('certificate_of_insurance', e.target.files?.[0])}
                className="hidden"
                accept=".pdf"
              />
            )}
          </div>

          {coiDocs.length > 0 ? (
            <div className="space-y-2">
              {coiDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between bg-white rounded-lg p-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <File className="w-3.5 h-3.5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{doc.file_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(parseISO(doc.upload_date), 'MMM d, yyyy')} • {doc.uploaded_by}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <button className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </a>
                    {isOwnerOrAdmin && (
                      <button
                        onClick={() => handleDeleteDoc(doc.id, 'certificate_of_insurance')}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {isOwnerOrAdmin && (
            <button
              onClick={() => fileInputRef.current.coi_add?.click()}
              disabled={uploadDocMutation.isPending}
              className="flex items-center gap-2 text-xs text-primary hover:underline pt-1"
            >
              {uploadDocMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {coiDocs.length > 0 ? 'Add another COI' : 'Upload COI'}
            </button>
          )}
        </div>

        {/* Workers' Comp Expiration */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">Workers' Compensation Expiration</label>
            {editingExpiry !== 'wc' && isOwnerOrAdmin && (
              <button
                onClick={() => { setWcExpiryDate(vendor.workers_comp_expiration_date || ''); setEditingExpiry('wc'); }}
                className="text-xs text-primary hover:underline"
              >
                {wcExpiryDate ? 'Change' : 'Set'}
              </button>
            )}
          </div>

          {editingExpiry === 'wc' ? (
            <div className="flex gap-2">
              <Input
                type="date"
                value={wcExpiryDate}
                onChange={(e) => setWcExpiryDate(e.target.value)}
                className="h-8 rounded-lg text-sm flex-1"
              />
              <Button
                size="sm"
                className="h-8 text-xs rounded-lg"
                onClick={() => handleSaveExpiry('wc')}
                disabled={updateVendorMutation.isPending}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs rounded-lg"
                onClick={() => setEditingExpiry(null)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className={`text-sm font-medium ${wcExpired ? 'text-destructive' : 'text-foreground'}`}>
              {wcExpiryDate ? (
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(parseISO(wcExpiryDate), 'MMM d, yyyy')}
                  {wcExpired && <span className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded font-medium">Expired</span>}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs italic">Not set</p>
              )}
            </div>
          )}
        </div>

        {/* Workers' Comp Documents */}
        <div className="space-y-2 bg-secondary/30 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Workers' Comp Documents</p>
            {isOwnerOrAdmin && (
              <input
                type="file"
                ref={(el) => (fileInputRef.current.wc_add = el)}
                onChange={(e) => handleUpload('workers_compensation', e.target.files?.[0])}
                className="hidden"
                accept=".pdf"
              />
            )}
          </div>

          {wcDocs.length > 0 ? (
            <div className="space-y-2">
              {wcDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between bg-white rounded-lg p-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <File className="w-3.5 h-3.5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{doc.file_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(parseISO(doc.upload_date), 'MMM d, yyyy')} • {doc.uploaded_by}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <button className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </a>
                    {isOwnerOrAdmin && (
                      <button
                        onClick={() => handleDeleteDoc(doc.id, 'workers_compensation')}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {isOwnerOrAdmin && (
            <button
              onClick={() => fileInputRef.current.wc_add?.click()}
              disabled={uploadDocMutation.isPending}
              className="flex items-center gap-2 text-xs text-primary hover:underline pt-1"
            >
              {uploadDocMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {wcDocs.length > 0 ? 'Add another Workers\' Comp' : 'Upload Workers\' Comp'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}