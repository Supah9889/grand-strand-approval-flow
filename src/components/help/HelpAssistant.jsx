import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, Send, Loader2, Bot, User, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLocation } from 'react-router-dom';
import { getInternalRole, getSessionEmployee } from '@/lib/adminAuth';

// Map pathnames to friendly module names and context descriptions
function getPageContext(pathname) {
  if (/^\/dashboard|\/admin-overview|\/job-hub/.test(pathname)) return { module: 'Dashboard', desc: 'The user is on the main dashboard / overview screen.' };
  if (/^\/new-job/.test(pathname)) return { module: 'New Job', desc: 'The user is creating a new job/project.' };
  if (/^\/search|\/global-search/.test(pathname)) return { module: 'Job Search', desc: 'The user is searching for jobs or records.' };
  if (/^\/admin$/.test(pathname)) return { module: 'Admin Panel', desc: 'The user is in the main admin management panel.' };
  if (/^\/employees/.test(pathname)) return { module: 'Employee Management', desc: 'The user is managing employees, invite status, roles, and permissions.' };
  if (/^\/employee-permissions/.test(pathname)) return { module: 'Employee Permissions', desc: 'The user is configuring role-based permissions and individual overrides.' };
  if (/^\/time-clock/.test(pathname)) return { module: 'Time Clock', desc: 'The user is on the employee time clock punch-in/punch-out screen.' };
  if (/^\/time-entries/.test(pathname)) return { module: 'Time Entries', desc: 'The user is viewing or editing time entry records.' };
  if (/^\/invoices/.test(pathname)) return { module: 'Invoices', desc: 'The user is managing customer invoices and billing.' };
  if (/^\/expenses/.test(pathname)) return { module: 'Cost Inbox / Expenses', desc: 'The user is reviewing, categorizing, and approving expense receipts via the cost inbox.' };
  if (/^\/payments/.test(pathname)) return { module: 'Payments', desc: 'The user is recording or viewing customer payments.' };
  if (/^\/bills/.test(pathname)) return { module: 'Bills', desc: 'The user is managing vendor/subcontractor bills.' };
  if (/^\/purchase-orders/.test(pathname)) return { module: 'Purchase Orders', desc: 'The user is managing purchase orders to vendors.' };
  if (/^\/financials/.test(pathname)) return { module: 'Financials', desc: 'The user is viewing the financial summary across jobs.' };
  if (/^\/vendors/.test(pathname)) return { module: 'Vendor Bank', desc: 'The user is managing vendors, subcontractors, and their compliance documents (COI, workers comp).' };
  if (/^\/sales\/.+/.test(pathname)) return { module: 'Lead Detail', desc: 'The user is viewing a specific lead/prospect record.' };
  if (/^\/sales/.test(pathname)) return { module: 'Sales / Leads', desc: 'The user is managing the sales pipeline and lead records.' };
  if (/^\/estimates\/.+/.test(pathname)) return { module: 'Estimate Detail', desc: 'The user is viewing or editing a specific estimate.' };
  if (/^\/estimates/.test(pathname)) return { module: 'Estimates', desc: 'The user is managing customer estimates and proposals.' };
  if (/^\/change-orders/.test(pathname)) return { module: 'Change Orders', desc: 'The user is managing change orders on jobs.' };
  if (/^\/daily-logs/.test(pathname)) return { module: 'Daily Logs', desc: 'The user is reviewing or creating field daily log entries.' };
  if (/^\/tasks/.test(pathname)) return { module: 'Tasks', desc: 'The user is managing tasks and punch list items.' };
  if (/^\/warranty/.test(pathname)) return { module: 'Warranty', desc: 'The user is managing warranty service items.' };
  if (/^\/job-comms/.test(pathname)) return { module: 'Job Files & Comms', desc: 'The user is managing files, photos, and internal comments attached to a job.' };
  if (/^\/portal-manager/.test(pathname)) return { module: 'Client Portal Manager', desc: 'The user is managing client portal access, permissions, and links.' };
  if (/^\/portal\/client/.test(pathname)) return { module: 'Client Portal', desc: 'The user is viewing the client-facing portal.' };
  if (/^\/portal\/vendor/.test(pathname)) return { module: 'Vendor Portal', desc: 'The user is viewing the vendor/subcontractor portal.' };
  if (/^\/calendar/.test(pathname)) return { module: 'Calendar', desc: 'The user is viewing the job scheduling calendar.' };
  if (/^\/audit-log/.test(pathname)) return { module: 'Audit Log', desc: 'The user is reviewing the system audit trail.' };
  if (/^\/notes/.test(pathname)) return { module: 'Notes', desc: 'The user is reviewing internal job notes.' };
  if (/^\/custom-fields/.test(pathname)) return { module: 'Custom Fields', desc: 'The user is configuring custom fields for job records.' };
  if (/^\/templates/.test(pathname)) return { module: 'Document Templates', desc: 'The user is managing document templates for estimates, contracts, etc.' };
  return { module: 'General', desc: 'The user is navigating the app.' };
}

const SYSTEM_PROMPT = `You are a helpful in-app assistant for Grand Strand Custom Painting's internal business management platform. Your job is to help internal users (owners, admins, staff, field employees) understand how the app works, navigate workflows, and troubleshoot issues.

ABOUT THIS APP:
This is a construction/painting company management platform. It covers:
- Jobs (master job files with lifecycle: presale → open → in_progress → waiting → completed → warranty → closed)
- Job Groups: painting, drywall, carpentry, water_mitigation, warranty, estimate_only, insurance, builder_vendor, residential, commercial, internal, other
- Sales/Leads pipeline with statuses (new_lead, contacted, qualified, estimate_scheduled, won, lost, converted_to_job)
- Estimates & Proposals (draft, ready_to_send, sent, viewed, approved, rejected, converted)
- Change Orders (draft, in_review, sent, approved, rejected)
- Invoices with approval/archive/delete controls (admin-only delete, soft archive available to staff)
- Payments recorded against invoices
- Bills and Purchase Orders for vendor payments
- Time Entries: employees clock in/out with their employee code at /time-clock, admin reviews entries
- Time Clock uses employee codes (not logins). Employees must be verified (invite confirmed) first.
- Cost Inbox / Expenses: receipt scanning, AI parsing, inbox_status flow (new → in_review → confirmed → filed)
- Duplicate detection on expenses with duplicate_status flags
- Vendor Bank: vendors, subcontractors with COI and workers comp expiration tracking
- Vendor Compliance: coi_expiration_date, workers_comp_expiration_date fields on Vendor records
- Employee onboarding: invite sent via email → employee clicks verify link → confirms → gets employee code → can clock in at /gate then /time-clock
- Employee roles: admin, staff, field. Owner is a special override role.
- Permissions system: role-level defaults + individual employee permission_overrides (JSON)
- Key permissions: share_files_externally, edit_locked_records, delete_records, manage_employees, approve_timesheets, view_financials, etc.
- Client Portal: portal users get a unique access_token link to view job progress, sign documents, see shared files
- Daily Logs: field notes per job per day with photos, crew info, weather, follow-ups
- Tasks and Punch Lists linked to jobs
- Warranty items linked to completed jobs
- Job Files & Comms: files (with category + visibility), comments, internal notes per job
- Calendar: CalendarEvent records for scheduling
- Audit Log: all significant actions are logged with actor, timestamp, detail

ROLES:
- Owner: full access, sees everything, override code login
- Admin: full access to most things, can manage employees, approve time, delete records
- Staff: limited access, may not see financials, cannot delete, cannot manage permissions
- Field: very limited, mainly time clock only via /gate → /time-clock

ACCESS FLOW:
- Internal users log in at /gate using their override code (admin/owner) or employee code
- After /gate login they see the app based on their role
- Field employees typically only see Time Clock
- The Sidebar has full nav for admin/owner users
- Bottom Nav shows Dashboard, Search, Time, Financials (admin+), Admin

COMMON WORKFLOWS:
1. New job: /new-job or click New Job in sidebar → fill details → creates Job record
2. Estimate flow: Create estimate → mark ready_to_send → send → customer approves → convert to job
3. Invoice flow: Create invoice → save → send → mark paid when payment received
4. Time approval: Admin goes to Time Entries → filters by pending approval → approves entries
5. Cost inbox: Expenses land in inbox → set inbox_status to in_review → verify fields → confirm → file
6. Employee invite: Admin goes to Employees → select employee → Send Invite → employee gets email → clicks link → confirms → can use code at /gate
7. Client portal: Portal Manager → create portal user → send access link to client
8. Vendor compliance: Vendor Bank → select vendor → add COI expiration and workers comp expiration dates

TROUBLESHOOTING COMMON ISSUES:
- "I can't delete an invoice": Delete is admin-only. Staff can archive instead.
- "I can't edit a locked record": Records lock after signature. Admin can override with edit_locked_records permission.
- "Employee can't clock in": Check if invite is confirmed and employee is active. Their code must be entered at /gate.
- "I don't see the Financials tab": Only admin/owner roles see the Financials bottom nav item.
- "Permission denied on a feature": Check Employee Permissions page for role defaults and individual overrides.
- "Duplicate expense warning": The system detected a possible duplicate. Review the flagged expense and either confirm or ignore the warning.
- "Client portal link not working": The portal user must have access_status = active and a valid access_token.

RESPONSE STYLE:
- Be concise and practical. No fluff.
- Use the current page/module as context for your answer.
- If something is role-restricted, say so clearly.
- If you don't know something specific about this app, say "I'm not sure about that specific detail — check with your admin or manager."
- Do not make up features that may not exist.
- Do not perform any actions (create, edit, delete records). Only explain and guide.
- Keep responses under 200 words unless a detailed step-by-step is genuinely needed.`;

export default function HelpAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const location = useLocation();
  const role = getInternalRole();
  const sessionEmployee = getSessionEmployee();

  const pageCtx = getPageContext(location.pathname);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Hi! I'm your help assistant. You're currently on the **${pageCtx.module}** screen.\n\nWhat can I help you with?`,
      }]);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const contextBlock = `CURRENT CONTEXT:
- Page/Module: ${pageCtx.module}
- ${pageCtx.desc}
- User role: ${role || 'unknown'}
${sessionEmployee ? `- Employee name: ${sessionEmployee.name}` : ''}

CONVERSATION SO FAR:
${nextMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}

Now answer the user's latest message helpfully and concisely.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `${SYSTEM_PROMPT}\n\n${contextBlock}`,
      });

      setMessages(prev => [...prev, { role: 'assistant', content: typeof result === 'string' ? result : result?.response || 'Sorry, I could not generate a response.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Hide on public/gate pages
  if (!role) return null;

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-20 right-4 z-50 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
            aria-label="Open Help Assistant"
          >
            <HelpCircle className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] bg-white border border-border rounded-2xl shadow-2xl flex flex-col"
            style={{ height: '420px' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary text-primary-foreground rounded-t-2xl shrink-0">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                <span className="text-sm font-semibold">Help Assistant</span>
                <span className="text-xs opacity-70 bg-white/20 px-1.5 py-0.5 rounded-full">{pageCtx.module}</span>
              </div>
              <button onClick={() => setOpen(false)} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3 h-3 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}>
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3 h-3 text-slate-600" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-3 h-3 text-primary" />
                  </div>
                  <div className="bg-muted rounded-xl px-3 py-2 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Thinking…</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 pb-3 pt-2 border-t border-border shrink-0">
              <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-1.5">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask anything about this page…"
                  rows={1}
                  className="flex-1 bg-transparent text-xs resize-none outline-none placeholder:text-muted-foreground leading-relaxed max-h-16"
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || loading}
                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 shrink-0"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-1 text-center">Guidance only · Does not edit records</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}