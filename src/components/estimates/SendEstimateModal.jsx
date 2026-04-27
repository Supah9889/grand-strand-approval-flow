import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { getInternalRole } from '@/lib/adminAuth';

export default function SendEstimateModal({ estimate, open, onClose, onSent }) {
  const role = getInternalRole();
  const [form, setForm] = useState({
    to: estimate?.client_email || '',
    cc: '',
    subject: `${estimate?.estimate_type === 'proposal' ? 'Proposal' : 'Estimate'} #${estimate?.estimate_number} – Grand Strand Custom Painting`,
    body: `Hi ${estimate?.client_name || 'there'},\n\nPlease find your ${estimate?.estimate_type || 'estimate'} attached. Review the scope and pricing and let us know if you have any questions.\n\nThank you for the opportunity!\n\nGrand Strand Custom Painting`,
  });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  if (!open || !estimate) return null;

  const handleSend = async () => {
    if (!form.to) return;
    setSending(true);
    // Send email via integration
    await base44.integrations.Core.SendEmail({
      to: form.to,
      subject: form.subject,
      body: form.body.replace(/\n/g, '<br>'),
    });

    // Log email history on estimate record
    const emailRecord = {
      to: form.to,
      cc: form.cc,
      subject: form.subject,
      sent_at: new Date().toISOString(),
      sent_by: role || 'admin',
    };
    const history = (() => {
      try { return JSON.parse(estimate.email_history || '[]'); } catch { return []; }
    })();
    history.push(emailRecord);

    await base44.entities.Estimate.update(estimate.id, {
      status: estimate.status === 'draft' || estimate.status === 'ready_to_send' ? 'sent' : estimate.status,
      sent_date: new Date().toISOString(),
      email_history: JSON.stringify(history),
    });

    await base44.entities.EstimateActivity.create({
      estimate_id: estimate.id,
      action: 'email_sent',
      detail: `Sent to ${form.to}${form.cc ? `, CC: ${form.cc}` : ''}`,
      actor: role || 'admin',
      timestamp: new Date().toISOString(),
    });

    setSending(false);
    setDone(true);
    toast.success('Estimate sent');
    onSent?.();
  };

  return (
    <AnimatePresence>
      <motion.div key="send-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div key="send-panel" initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Send {estimate.estimate_type === 'proposal' ? 'Proposal' : 'Estimate'}</h2>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>

          {done ? (
            <div className="p-6 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
              <p className="text-sm font-semibold text-foreground">Estimate sent successfully</p>
              <Button className="w-full h-10 rounded-xl" onClick={onClose}>Done</Button>
            </div>
          ) : (
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">To *</label>
                <Input value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} type="email" className="h-9 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">CC</label>
                <Input value={form.cc} onChange={e => setForm(f => ({ ...f, cc: e.target.value }))} type="email" placeholder="Optional" className="h-9 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Subject</label>
                <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="h-9 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Message</label>
                <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} className="rounded-lg text-sm min-h-32" />
              </div>
              {estimate.generated_document_url && (
                <div className="bg-secondary/50 rounded-xl px-3 py-2 text-xs text-muted-foreground">
                  Generated document will be referenced in the email history.
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={onClose}>Cancel</Button>
                <Button className="flex-1 h-10 rounded-xl gap-2" onClick={handleSend} disabled={!form.to || sending}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send</>}
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}