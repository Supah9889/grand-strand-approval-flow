/**
 * GeoSettingsPanel — admin-configurable geolocation tracking settings.
 * Embedded inside the Admin page or Time Entries settings area.
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getInternalRole } from '@/lib/adminAuth';

export default function GeoSettingsPanel() {
  const queryClient = useQueryClient();
  const role = getInternalRole();

  const [form, setForm] = useState({ alert_radius_miles: 0.25, alert_email: '', geo_tracking_enabled: true });
  const [recordId, setRecordId] = useState(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['geo-settings'],
    queryFn: () => base44.entities.GeoSettings.list(),
  });

  useEffect(() => {
    if (records.length > 0) {
      const r = records[0];
      setRecordId(r.id);
      setForm({
        alert_radius_miles: r.alert_radius_miles ?? 0.25,
        alert_email: r.alert_email || '',
        geo_tracking_enabled: r.geo_tracking_enabled !== false,
      });
    }
  }, [records]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data, updated_by: role };
      if (recordId) return base44.entities.GeoSettings.update(recordId, payload);
      return base44.entities.GeoSettings.create(payload);
    },
    onSuccess: (saved) => {
      setRecordId(saved.id);
      queryClient.invalidateQueries({ queryKey: ['geo-settings'] });
      toast.success('Geo settings saved');
    },
  });

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <MapPin className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Geolocation Tracking</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Configure the allowed distance radius for time clock punches. Punches beyond the threshold will be flagged and an alert email sent.
      </p>

      <div className="space-y-3">
        {/* Enabled toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setForm(f => ({ ...f, geo_tracking_enabled: !f.geo_tracking_enabled }))}
            className={`relative w-10 h-5 rounded-full transition-colors ${form.geo_tracking_enabled ? 'bg-primary' : 'bg-muted'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.geo_tracking_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
          <span className="text-sm text-foreground">Enable location capture</span>
        </label>

        {/* Radius */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Allowed Radius (miles)</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0.01"
              step="0.05"
              value={form.alert_radius_miles}
              onChange={e => setForm(f => ({ ...f, alert_radius_miles: parseFloat(e.target.value) || 0.25 }))}
              className="h-9 rounded-xl text-sm w-28"
            />
            <span className="text-xs text-muted-foreground">≈ {Math.round((form.alert_radius_miles || 0.25) * 5280)} feet</span>
          </div>
        </div>

        {/* Alert email */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Alert Email</label>
          <Input
            type="email"
            placeholder="management@company.com"
            value={form.alert_email}
            onChange={e => setForm(f => ({ ...f, alert_email: e.target.value }))}
            className="h-9 rounded-xl text-sm"
          />
          <p className="text-[10px] text-muted-foreground">Out-of-range punch alerts will be sent here.</p>
        </div>
      </div>

      <Button
        className="w-full h-9 rounded-xl text-sm gap-2"
        onClick={() => saveMutation.mutate(form)}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5" /> Save Settings</>}
      </Button>
    </div>
  );
}