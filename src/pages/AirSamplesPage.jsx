import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FlaskConical, Loader2, AlertTriangle, Send } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useCompanyGuard } from '@/components/CompanyGuard';

function getActiveCompany() {
  try { return JSON.parse(sessionStorage.getItem('active_company')); } catch { return null; }
}

const RESULT_STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  passed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  needs_review: 'bg-orange-100 text-orange-700',
};

export default function AirSamplesPage() {
  const navigate = useNavigate();
  const company = getActiveCompany();
  const companyGuard = useCompanyGuard('Select a company to view air sample tests.');
  const [filter, setFilter] = useState('all');

  const { data: samples = [], isLoading } = useQuery({
    queryKey: ['all-air-samples', company?.id],
    queryFn: () => company
      ? base44.entities.AirSampleTest.filter({ company_id: company.id }, '-sample_date', 300)
      : Promise.resolve([]),
    enabled: !!company?.id,
  });

  const filtered = filter === 'all' ? samples : samples.filter(s => s.result_status === filter);

  if (companyGuard) return <AppLayout title="Air Samples">{companyGuard}</AppLayout>;

  return (
    <AppLayout title="Air Samples">
      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-4">
        <h1 className="text-base font-semibold flex items-center gap-2"><FlaskConical className="w-4 h-4 text-purple-600" /> Air Sample Tests</h1>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {['all','pending','passed','failed','needs_review'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 h-7 px-3 rounded-full text-xs font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-12">No samples</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(s => (
              <div key={s.id}
                className={`bg-card border rounded-xl p-3 cursor-pointer hover:bg-muted/20 ${s.result_status === 'failed' ? 'border-red-200' : 'border-border'}`}
                onClick={() => navigate(`/jobs/${s.job_id}/documentation`)}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {s.result_status === 'failed' && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                    <p className="text-sm font-medium capitalize">{s.sample_type?.replace(/_/g, ' ')}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${RESULT_STYLES[s.result_status] || 'bg-muted text-muted-foreground'}`}>
                    {s.result_status?.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{s.job_address} {s.room_name ? `· ${s.room_name}` : ''}</p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                  {s.sample_date && <span>{s.sample_date}</span>}
                  {s.lab && <span>{s.lab}</span>}
                  {s.nexus_submitted && <Send className="w-3 h-3 text-purple-500" />}
                </div>
                {s.result_summary && <p className="text-xs text-foreground mt-1 line-clamp-2">{s.result_summary}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
