/**
 * fileActions.js — centralized helpers for Job Files & Comms file operations.
 * Covers: permission resolution, delete execution, audit logging, query invalidation.
 */
import { base44 } from '@/api/base44Client';
import { logAudit } from '@/lib/audit';

/**
 * Returns true if the current user can delete job files.
 * @param {{ role: string, permissions: object }} param0
 */
export function canDeleteFile({ role, permissions }) {
  if (role === 'owner') return true;
  return !!permissions?.delete_job_files;
}

/**
 * Permanently deletes a JobFile record.
 * Caller is responsible for optimistic UI; this does the server work.
 * @param {{ file: object, user: object }} param0
 */
export async function deleteJobFile({ file, user }) {
  await base44.entities.JobFile.delete(file.id);
  await logFileDeletion({ file, user });
}

/**
 * Logs a file deletion event to the audit log.
 */
export async function logFileDeletion({ file, user }) {
  logAudit(
    file.job_id,
    'record_deleted',
    user?.email || user?.id || 'unknown',
    `File permanently deleted from Job Files & Comms: "${file.file_name}"`,
    {
      module: 'job',
      record_id: file.id,
      job_id: file.job_id,
      job_address: file.job_address,
      related_module: file.related_module || null,
      related_module_id: file.related_module_id || null,
    }
  );
}

/**
 * Invalidates all query caches affected by a file deletion.
 * @param {{ file: object, queryClient: object }} param0
 */
export function refreshFileRelations({ file, queryClient }) {
  queryClient.invalidateQueries({ queryKey: ['job-files', file.job_id] });
  queryClient.invalidateQueries({ queryKey: ['job-files-all'] });
  queryClient.invalidateQueries({ queryKey: ['attachments', file.job_id] });
  if (file.related_module && file.related_module_id) {
    queryClient.invalidateQueries({ queryKey: [file.related_module, file.related_module_id] });
  }
}