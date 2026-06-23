import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getCurrentCompany } from '@/lib/permissions';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';

const DEMO_TAG = true; // is_demo flag value

function buildDemoRecords(companyId, companySlug) {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  return {
    customers: [
      {
        company_id: companyId, company_slug: companySlug,
        name: '[DEMO] Jane Homeowner', phone: '555-867-5309', email: 'jane.demo@example.com',
        is_demo: DEMO_TAG,
      },
    ],
    properties: [
      {
        company_id: companyId, company_slug: companySlug,
        address: '123 Demo Lane, Columbus, OH 43215',
        customer_name: '[DEMO] Jane Homeowner',
        is_demo: DEMO_TAG,
      },
    ],
    jobs: [
      {
        company_id: companyId, company_slug: companySlug, company_name: 'Destination Home',
        title: '[DEMO] Water Mitigation - 123 Demo Lane',
        customer_name: '[DEMO] Jane Homeowner',
        address: '123 Demo Lane, Columbus, OH 43215',
        service_line: 'water_mitigation', job_group: 'water_mitigation',
        lifecycle_status: 'in_progress', op_status: 'in_progress',
        priority: 'high', description: 'Demo water mitigation job for review',
        price: 4500, source_system: 'manual_entry',
        is_demo: DEMO_TAG,
      },
      {
        company_id: companyId, company_slug: companySlug, company_name: 'Destination Home',
        title: '[DEMO] Mold Mitigation - 456 Sample Ave',
        customer_name: '[DEMO] Bob Builder',
        address: '456 Sample Ave, Columbus, OH 43220',
        service_line: 'mold_mitigation', job_group: 'water_mitigation',
        lifecycle_status: 'open', op_status: 'needs_scheduling',
        priority: 'normal', description: 'Demo mold mitigation job for review',
        price: 6200, source_system: 'manual_entry',
        is_demo: DEMO_TAG,
      },
    ],
    legacyRecords: [
      {
        company_id: companyId, company_slug: companySlug,
        source_system: 'Proven Jobs', legacy_id: 'PJ-DEMO-001',
        customer_name: '[DEMO] Legacy Customer', property_address: '789 Old Address Blvd',
        job_name: '[DEMO] Legacy Water Job', job_status: 'Completed',
        service_line: 'water_mitigation', migration_status: 'needs_review',
        cutover_status: 'not_started',
        notes: 'Demo legacy record for migration review',
        is_demo: DEMO_TAG,
      },
    ],
    nexusItems: [
      {
        company_id: companyId, company_slug: companySlug,
        title: '[DEMO] Moisture reading unusually high in bedroom 2',
        category: 'field_observation', priority: 'high',
        status: 'pending', source_type: 'manual',
        description: 'Demo Nexus item — moisture meter reading 28% on drywall, above 18% dry standard.',
        is_demo: DEMO_TAG,
      },
    ],
  };
}

export default function DemoDataPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const company = getCurrentCompany();
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);

  const { data: existingDemo = [] } = useQuery({
    queryKey: ['demo-jobs', company?.id],
    queryFn: () => base44.entities.Job.filter({ company_id: company?.id, is_demo: true }, '-created_date', 50),
    enabled: !!company?.id,
  });

  const createDemo = useMutation({
    mutationFn: async () => {
      if (!company?.id) throw new Error('No company selected');
      const records = buildDemoRecords(company.id, company.slug);
      const lines = [];

      for (const c of records.customers) {
        await base44.entities.Customer.create(c);
        lines.push('✓ Customer: ' + c.name);
      }
      for (const p of records.properties) {
        await base44.entities.Property.create(p);
        lines.push('✓ Property: ' + p.address);
      }
      const createdJobs = [];
      for (const j of records.jobs) {
        const created = await base44.entities.Job.create(j);
        createdJobs.push(created);
        lines.push('✓ Job: ' + j.title);
      }

      // Work order for first job
      if (createdJobs[0]) {
        const wo = await base44.entities.WorkOrder.create({
          company_id: company.id, company_slug: company.slug,
          job_id: createdJobs[0].id, job_address: createdJobs[0].address,
          job_title: createdJobs[0].title,
          title: '[DEMO] GSCP Subcontract — Water Extraction', status: 'assigned',
          is_subcontract: true, priority: 'high',
          checklist: JSON.stringify([
            { item: 'Extract standing water', completed: true },
            { item: 'Set dehumidifiers', completed: true },
            { item: 'Set air movers', completed: false },
            { item: 'Moisture readings baseline', completed: false },
          ]),
          is_demo: DEMO_TAG,
        });
        lines.push('✓ Work Order: ' + wo.title);

        // Room
        const room = await base44.entities.Room.create({
          company_id: company.id, company_slug: company.slug,
          job_id: createdJobs[0].id, job_address: createdJobs[0].address,
          name: '[DEMO] Master Bedroom', room_type: 'bedroom', status: 'drying',
          is_demo: DEMO_TAG,
        });
        lines.push('✓ Room: ' + room.name);

        // Moisture reading
        await base44.entities.MoistureReading.create({
          company_id: company.id, company_slug: company.slug,
          job_id: createdJobs[0].id, job_address: createdJobs[0].address,
          room_id: room.id, room_name: room.name,
          material: 'drywall', reading_value: 24.5,
          reading_type: 'pin', taken_by: '[DEMO] Tech',
          taken_at: new Date().toISOString(), is_dry: false,
          is_demo: DEMO_TAG,
        });
        lines.push('✓ Moisture Reading: 24.5% drywall');

        // Drying log
        await base44.entities.DryingLog.create({
          company_id: company.id, company_slug: company.slug,
          job_id: createdJobs[0].id, job_address: createdJobs[0].address,
          room_id: room.id, room_name: room.name,
          log_date: new Date().toISOString().slice(0, 10),
          temperature: 72, relative_humidity: 58, gpp: 62,
          technician: '[DEMO] Tech',
          is_demo: DEMO_TAG,
        });
        lines.push('✓ Drying Log: Day 1 entry');

        // Air sample
        await base44.entities.AirSampleTest.create({
          company_id: company.id, company_slug: company.slug,
          job_id: createdJobs[0].id, job_address: createdJobs[0].address,
          room_id: room.id, room_name: room.name,
          sample_type: 'indoor_air', sample_date: new Date().toISOString().slice(0, 10),
          result_status: 'pending', technician: '[DEMO] Tech',
          is_demo: DEMO_TAG,
        });
        lines.push('✓ Air Sample: Pending result');
      }

      for (const lr of records.legacyRecords) {
        await base44.entities.LegacyJobRecord.create(lr);
        lines.push('✓ Legacy Record: ' + lr.job_name);
      }
      for (const ni of records.nexusItems) {
        await base44.entities.NexusItem.create(ni);
        lines.push('✓ Nexus Item: ' + ni.title);
      }

      // Field note (JobNote on first job)
      if (createdJobs[0]) {
        await base44.entities.JobNote.create({
          company_id: company.id, company_slug: company.slug,
          job_id: createdJobs[0].id, job_address: createdJobs[0].address,
          content: '[DEMO] Field note from tech: dehumidifiers running, moisture down to 22% on day 2. Customer notified.',
          note_type: 'field_update', author_name: '[DEMO] Field Tech',
          is_demo: DEMO_TAG,
        });
        lines.push('✓ Field Note: Day 2 update');

        // Completion note
        await base44.entities.JobNote.create({
          company_id: company.id, company_slug: company.slug,
          job_id: createdJobs[0].id, job_address: createdJobs[0].address,
          content: '[DEMO] Job completion note: all readings below 16%, equipment removed, customer signed off.',
          note_type: 'completion', author_name: '[DEMO] Lead Tech',
          is_demo: DEMO_TAG,
        });
        lines.push('✓ Completion Note: final sign-off');

        // Photo placeholder JobFile
        await base44.entities.JobFile.create({
          company_id: company.id, company_slug: company.slug,
          job_id: createdJobs[0].id, job_address: createdJobs[0].address,
          file_name: '[DEMO] before-photo-bedroom.jpg',
          file_type: 'image/jpeg',
          label: 'Before - Bedroom 2',
          category: 'photo',
          is_demo: DEMO_TAG,
        });
        lines.push('✓ Photo Placeholder: before-photo-bedroom.jpg');

        // GSCP subcontract note
        await base44.entities.SubcontractNote.create({
          work_order_id: 'demo', job_id: createdJobs[0].id,
          job_address: createdJobs[0].address,
          performing_company_id: company.id,
          performing_company_name: '[DEMO] GSCP',
          author_name: '[DEMO] Jesus',
          note_type: 'field_update',
          content: '[DEMO] GSCP field update: water extraction complete, 3 dehumidifiers placed, air movers running.',
          review_status: 'pending', visible_to_origin: false,
          is_demo: DEMO_TAG,
        });
        lines.push('✓ GSCP Subcontract Note: pending review');

        // Time entry
        const clockIn = new Date();
        clockIn.setHours(7, 0, 0, 0);
        const clockOut = new Date();
        clockOut.setHours(15, 30, 0, 0);
        await base44.entities.TimeEntry.create({
          company_id: company.id, company_slug: company.slug,
          employee_id: 'demo', employee_name: '[DEMO] Field Tech',
          job_id: createdJobs[0].id, job_address: createdJobs[0].address,
          job_title: createdJobs[0].title,
          cost_code: 'Other Labor/Sub',
          clock_in: clockIn.toISOString(),
          clock_out: clockOut.toISOString(),
          duration_minutes: 510, total_hours: 8.5,
          entry_date: new Date().toISOString().slice(0, 10),
          status: 'clocked_out', approval_status: 'pending',
          entry_source: 'employee_clock',
          is_demo: DEMO_TAG,
        });
        lines.push('✓ Time Entry: 8.5 hrs demo tech');

        // Review feedback
        await base44.entities.ReviewFeedback.create({
          company_id: company.id,
          reviewer_name: '[DEMO] Nick',
          reviewer_role: 'Owner',
          section: 'daily_field',
          feedback_text: '[DEMO] The time clock and field dashboard look solid. I want to make sure field techs can easily see their assigned jobs without scrolling.',
          priority: 'medium',
          status: 'new',
          created_at: new Date().toISOString(),
          is_demo: DEMO_TAG,
        });
        lines.push('✓ Review Feedback: Nick demo comment');
      }

      return lines;
    },
    onSuccess: (lines) => {
      setLog(lines);
      setDone(true);
      qc.invalidateQueries(['demo-jobs']);
    },
    onError: (err) => setLog(['❌ Error: ' + err.message]),
  });

  const clearDemo = useMutation({
    mutationFn: async () => {
      const lines = [];
      const ents = ['Job', 'Customer', 'Property', 'WorkOrder', 'Room', 'MoistureReading', 'DryingLog', 'AirSampleTest', 'LegacyJobRecord', 'NexusItem', 'JobNote', 'JobFile', 'SubcontractNote', 'TimeEntry', 'ReviewFeedback'];
      for (const name of ents) {
        await base44.entities[name].deleteMany({ company_id: company?.id, is_demo: true });
        lines.push('🗑 Cleared demo ' + name + ' records');
      }
      return lines;
    },
    onSuccess: (lines) => {
      setLog(lines);
      setDone(false);
      qc.invalidateQueries(['demo-jobs']);
    },
    onError: (err) => setLog(['❌ Error: ' + err.message]),
  });

  const hasDemoData = existingDemo.length > 0;

  return (
    <AppLayout title="Demo Data">
      <div className="app-page max-w-2xl space-y-5">

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Demo Data Tool</h1>
            <p className="app-page-subtitle">Seed sample records for review — all marked is_demo: true</p>
          </div>
        </div>

        {hasDemoData && (
          <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Demo data already exists ({existingDemo.length} demo job{existingDemo.length !== 1 ? 's' : ''} found).
              Clear it before creating a fresh set.
            </p>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">What gets created</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            {[
              'Customer: Jane Homeowner',
              'Property: 123 Demo Lane',
              'Job: Water Mitigation (in progress, high priority)',
              'Job: Mold Mitigation (open)',
              'Work Order: GSCP Subcontract — Water Extraction (with checklist)',
              'Room: Master Bedroom',
              'Moisture Reading: 24.5% drywall',
              'Drying Log: Day 1 (temp/RH/GPP)',
              'Air Sample: Pending result',
              'Legacy Record: PJ-DEMO-001 (needs review)',
              'Nexus Item: High moisture observation (pending)',
              'Field Note: Day 2 tech update',
              'Completion Note: Final sign-off',
              'Photo Placeholder: before-photo-bedroom.jpg',
              'GSCP Subcontract Note: pending Jesus review',
              'Time Entry: 8.5 hrs demo tech',
              'Review Feedback: Demo Nick comment',
            ].map((item, i) => (
              <li key={i} className="flex gap-1.5"><span className="text-primary">+</span>{item}</li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground border-t border-border pt-2 mt-2">
            All records are tagged <code className="bg-muted px-1 rounded">is_demo: true</code> and can be cleared without affecting real data.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => { setLog([]); createDemo.mutate(); }}
            disabled={createDemo.isPending || clearDemo.isPending || hasDemoData}
            className="flex-1"
          >
            {createDemo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Create Demo Data
          </Button>
          <Button
            variant="destructive"
            onClick={() => { setLog([]); clearDemo.mutate(); }}
            disabled={createDemo.isPending || clearDemo.isPending || !hasDemoData}
          >
            {clearDemo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Clear Demo Data
          </Button>
        </div>

        {log.length > 0 && (
          <div className="bg-muted/40 border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">{done ? 'Created:' : clearDemo.isSuccess ? 'Cleared:' : 'Log:'}</p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {log.map((line, i) => (
                <p key={i} className="text-xs text-foreground font-mono">{line}</p>
              ))}
            </div>
            {done && (
              <div className="flex items-center gap-2 mt-3 text-xs text-green-700">
                <CheckCircle2 className="w-4 h-4" /> Demo data created. Navigate to Field Dashboard, Restoration Hub, or Legacy Records to see it.
              </div>
            )}
          </div>
        )}

      </div>
    </AppLayout>
  );
}