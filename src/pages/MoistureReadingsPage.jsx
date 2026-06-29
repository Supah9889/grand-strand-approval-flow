import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Droplets, Loader2, CheckCircle2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { format } from 'date-fns';
import { useCompanyGuard } from '@/components/CompanyGuard';

function getActiveCompany() {
  try { return JSON.parse(sessionStorage.getItem('active_company')); } catch { return null; }
}

export default function MoistureReadingsPage() {
  const navigate = useNavigate();
  const company = getActiveCompany();
  const companyGuard = useCompanyGuard('Select a company to view moisture readings.');
  const [filter, setFilter] = useState('all');

  const { data: readings = [], isLoading } = useQuery({
    queryKey: ['all-moisture', company?.id],
    queryFn: () => company
      ? base44.entities.MoistureReading.filter({ company_id: company.id }, '-taken_at', 300)
      : Promise.resolve([]),
    enabled: !!company?.id,
  });

  const filtered = filter === 'wet' ? readings.filter(r => !r.is_dry) : filter === 'dry' ? readings.filter(r => r.is_dry) : readings;

  if (companyGuard) return <AppLayout title="Moisture Readings">{companyGuard}</AppLayout>;

  return (
    <AppLayout title="Moisture Readings">
      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold flex items-center gap-2"><Droplets className="w-4 h-4 text-blue-600" /> Moisture Readings</h1>
        </div>
        <div className="flex gap-1.5">
          {['all','wet','dry'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`h-7 px-3 rounded-full text-xs font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {f === 'all' ? 'All' : f === 'wet' ? 'Wet / Active' : 'Dry / Clear'}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-12">No readings</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => (
              <div key={r.id} className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:bg-muted/20"
                onClick={() => navigate(`/jobs/${r.job_id}/documentation`)}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{r.reading_value}% <span className="text-muted-foreground font-normal">({r.material})</span></p>
                  {r.is_dry ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Droplets className="w-4 h-4 text-blue-500" />}
                </div>
                <p className="text-xs text-muted-foreground truncate">{r.job_address} {r.room_name ? `· ${r.room_name}` : ''}</p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                  <span>{r.reading_type}</span>
                  {r.taken_at && <span>{format(new Date(r.taken_at), 'MMM d, h:mm a')}</span>}
                  {r.taken_by && <span>by {r.taken_by}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
