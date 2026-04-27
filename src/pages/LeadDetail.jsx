import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, Loader2, Pencil, ArrowRight, Phone, Mail, MapPin,
  Calendar, User, DollarSign, AlertCircle, CheckCircle2, StickyNote
} from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import LeadStatusBadge, { STATUS_CONFIG } from '../components/sales/LeadStatusBadge';
import LeadActivityFeed from '../components/sales/LeadActivityFeed';
import LeadForm from '../components/sales/LeadForm';
import ConvertToJobModal from '../components/sales/ConvertToJobModal';
import { getInternalRole } from '@/lib/adminAuth';
import { toast } from 'sonner';

const label = s => s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';

export default function LeadDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const leadId = window.location.pathname.split('/').pop();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getInternalRole();

  const [editing, setEditing] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: async () => {
      const res = await base44.entities.Lead.filter({ id: leadId });
      return res[0];
    },
    enabled: !!leadId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['lead-activities', leadId],
    queryFn: () => base44.entities.LeadActivity.filter({ lead_id: leadId }),
    enabled: !!leadId,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => base44.entities.Vendor.list('company_name'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ data, logAction, logDetail }) => {
      await base44.entities.Lead.update(leadId, data);
      if (logAction) {
        await base44.entities.LeadActivity.create({
          lead_id: leadId,
          action: logAction,
          detail: logDetail || '',
          actor: role || 'admin',
          timestamp: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setEditing(false);
      toast.success('Lead updated');
    },
  });

  const saveNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    await base44.entities.LeadActivity.create({
      lead_id: leadId,
      action: 'note_added',
      detail: noteText.trim(),
      actor: role || 'admin',
      timestamp: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
    setNoteText('');
    setAddingNote(false);
    toast.success('Note added');
  };

  const changeStatus = (newStatus) => {
    updateMutation.mutate({
      data: { status: newStatus },
      logAction: 'status_changed',
      logDetail: `Status changed to: ${label(newStatus)}`,
    });
  };

  if (isLoading) {
    return <AppLayout title="Lead"><div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div></AppLayout>;
  }

  if (!lead) {
    return (
      <AppLayout title="Lead">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-muted-foreground text-sm">Lead not found.</p>
          <Button variant="outline" onClick={() => navigate('/sales')} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sales
          </Button>
        </div>
      </AppLayout>
    );
  }

  const followUpDate = lead.follow_up_date ? parseISO(lead.follow_up_date) : null;
  const followUpOverdue = followUpDate && isPast(followUpDate) && !isToday(followUpDate);
  const followUpToday = followUpDate && isToday(followUpDate);

  if (editing) {
    return (
      <AppLayout title="Edit Lead">
        <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-4">
          <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Cancel
          </button>
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold text-foreground mb-4">Edit Lead</p>
            <LeadForm
              initial={lead}
              vendors={vendors}
              onSubmit={(data) => updateMutation.mutate({ data, logAction: 'field_updated', logDetail: 'Record fields updated' })}
              onCancel={() => setEditing(false)}
              isLoading={updateMutation.isPending}
            />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={lead.contact_name || 'Lead'}>
      <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-4">

        {/* Back */}
        <button onClick={() => navigate('/sales')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Sales
        </button>

        {/* Main card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-5 space-y-4">

          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground leading-snug">{lead.contact_name}</h1>
              {lead.company_name && <p className="text-sm text-muted-foreground">{lead.company_name}</p>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <LeadStatusBadge status={lead.status} size="md" />
                {lead.priority && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    lead.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                    lead.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                    lead.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {label(lead.priority)} priority
                  </span>
                )}
                {lead.converted_to_job && (
                  <span className="flex items-center gap-1 text-xs text-primary font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Converted
                  </span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl h-8 gap-1.5 shrink-0" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
          </div>

          {/* Follow-up alert */}
          {(followUpOverdue || followUpToday) && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${
              followUpOverdue ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {followUpOverdue ? `Follow-up overdue — was due ${format(followUpDate, 'MMM d')}` : 'Follow-up due today'}
            </div>
          )}

          {/* Contact details */}
          <div className="space-y-2.5">
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="flex items-center gap-2.5 group">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground group-hover:text-primary transition-colors">{lead.phone}</span>
                {lead.phone_secondary && <span className="text-xs text-muted-foreground">/ {lead.phone_secondary}</span>}
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="flex items-center gap-2.5 group">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground group-hover:text-primary transition-colors">{lead.email}</span>
              </a>
            )}
            {lead.property_address && (
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{lead.property_address}{lead.city ? `, ${lead.city}` : ''}{lead.state ? ` ${lead.state}` : ''}{lead.zip ? ` ${lead.zip}` : ''}</span>
              </div>
            )}
            {lead.assigned_to && (
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">Assigned to {lead.assigned_to}</span>
              </div>
            )}
            {lead.follow_up_date && (
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">Follow-up: {format(parseISO(lead.follow_up_date), 'EEEE, MMM d, yyyy')}</span>
              </div>
            )}
          </div>

          {/* Presale info */}
          {(lead.presale_job_title || lead.service_type || lead.approximate_value || lead.work_scope_summary) && (
            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Presale Info</p>
              {lead.presale_job_title && <p className="text-sm font-medium text-foreground">{lead.presale_job_title}</p>}
              {lead.service_type && <p className="text-xs text-muted-foreground">{label(lead.service_type)}</p>}
              {lead.approximate_value > 0 && (
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-bold text-primary">${Number(lead.approximate_value).toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">estimated</span>
                </div>
              )}
              {lead.billing_type && <p className="text-xs text-muted-foreground">{label(lead.billing_type)}</p>}
              {lead.work_scope_summary && <p className="text-sm text-muted-foreground">{lead.work_scope_summary}</p>}
            </div>
          )}

          {/* Source */}
          {(lead.lead_source || lead.referral_source) && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Source</p>
              <div className="flex flex-wrap gap-2">
                {lead.lead_source && <span className="text-xs px-2 py-1 bg-secondary rounded-lg text-foreground">{label(lead.lead_source)}</span>}
                {lead.referral_source && <span className="text-xs px-2 py-1 bg-secondary rounded-lg text-foreground">Referral: {lead.referral_source}</span>}
              </div>
            </div>
          )}

          {/* Internal notes */}
          {lead.internal_notes && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</p>
              <p className="text-sm text-foreground leading-relaxed">{lead.internal_notes}</p>
            </div>
          )}

          {/* Linked job */}
          {lead.linked_job_id && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Linked Job</p>
              <button
                onClick={() => navigate(`/approve?jobId=${lead.linked_job_id}`)}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <CheckCircle2 className="w-4 h-4" /> {lead.linked_job_address || 'View Job'} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </motion.div>

        {/* Quick status change */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Update Status</p>
          <Select value={lead.status} onValueChange={changeStatus} disabled={lead.converted_to_job}>
            <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([v, c]) => (
                <SelectItem key={v} value={v}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!lead.converted_to_job && (lead.status === 'won' || lead.status === 'waiting_on_approval') && (
            <Button
              className="w-full h-9 rounded-xl text-sm gap-2"
              onClick={() => setShowConvert(true)}
            >
              <ArrowRight className="w-4 h-4" /> Convert to Active Job
            </Button>
          )}
        </div>

        {/* Add note */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Internal Note</p>
          </div>
          <Textarea
            placeholder="Add a note to this lead's activity log..."
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            className="rounded-xl text-sm min-h-16"
          />
          <Button
            size="sm"
            className="h-8 rounded-xl text-xs"
            disabled={!noteText.trim() || addingNote}
            onClick={saveNote}
          >
            {addingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Note'}
          </Button>
        </div>

        {/* Activity feed */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Activity Timeline</p>
          <LeadActivityFeed activities={[...activities].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))} />
        </div>
      </div>

      <ConvertToJobModal
        lead={lead}
        open={showConvert}
        onClose={() => setShowConvert(false)}
        onConverted={() => setShowConvert(false)}
      />
    </AppLayout>
  );
}