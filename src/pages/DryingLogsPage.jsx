import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Wind, Loader2, Send } from 'lucide-react';
import AppLayout from '@/components/AppLayout';

function getActiveCompany() {
  try { return JSON.parse(sessionStorage.getItem('active_company')); } catch { return null; }
}

export default function DryingLogsPage() {
  const navigate = useNavigate();
  const company = getActiveCompany();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['all-drying', company?.id],
    queryFn: () => company
      ? base44.entities.DryingLog.filter({ company_id: company.id }, '-log_date', 300)
      : base44.entities.DryingLog.list('-log_date', 300),
  });

  return (
    <AppLayout title="Drying Logs">
      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-4">
        <h1 className="text-base font-semibold flex items-center gap-2"><Wind className="w-4 h-4 text-cyan-600" /> Drying Logs</h1>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : logs.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-12">No drying logs yet</p>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:bg-muted/20"
                onClick={() => navigate(`/jobs/${log.job_id}/documentation`)}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{log.log_date}</p>
                  {log.nexus_submitted && <Send className="w-3.5 h-3.5 text-purple-500" />}
                </div>
                <p className="text-xs text-muted-foreground truncate">{log.job_address} {log.room_name ? `· ${log.room_name}` : ''}</p>
                <div className="flex gap-3 text-[11px] text-muted-foreground mt-1">
                  {log.temperature != null && <span>{log.temperature}°F</span>}
                  {log.relative_humidity != null && <span>{log.relative_humidity}% RH</span>}
                  {log.gpp != null && <span>{log.gpp} GPP</span>}
                  {log.technician && <span>by {log.technician}</span>}
                </div>
                {log.moisture_notes && <p className="text-xs text-foreground mt-1 line-clamp-2">{log.moisture_notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}