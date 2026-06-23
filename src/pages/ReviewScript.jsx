import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Link } from 'react-router-dom';
import { CheckSquare, Square, ArrowRight, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

const STORAGE_KEY = 'review_script_progress_v1';
function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } }
function save(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} }

const STEPS = [
  {
    num: 1,
    title: 'Review Dashboard',
    link: '/review-dashboard',
    show: 'Open the Review Dashboard. Walk through the Executive Summary: what is ready, what is partial, what is not yet built. Expand each section card to see specific feature status.',
    question: 'Does this match your expectations for where we are? Any immediate surprises?',
    decision: 'Confirm understanding of current platform state before diving into specifics.',
  },
  {
    num: 2,
    title: 'Replacement Map',
    link: '/replacement-map',
    show: 'Open the Replacement Map. Walk through Proven Jobs features first — show every core feature is covered (Built) or in progress (Partial). Then Buildertrend features. Point out QuickBooks as the main gap.',
    question: 'Are there any Proven Jobs or Buildertrend features that are critical for day-one that you don\'t see covered here?',
    decision: 'Identify any blocking feature gaps that must be resolved before rollout.',
  },
  {
    num: 3,
    title: 'Demo Data',
    link: '/demo-data',
    show: 'Open Demo Data. If demo data hasn\'t been created yet, click "Create Demo Data." This seeds a water mitigation job, work order, restoration readings, a legacy record, and a Nexus item — all marked demo.',
    question: 'No decision needed — this just populates sample data so you can see the workflows in action.',
    decision: 'Confirm demo data is created before continuing the walkthrough.',
  },
  {
    num: 4,
    title: 'Destination Home Workflow',
    link: '/field',
    show: 'Navigate to Field Dashboard. Show the active demo job. Then go to Restoration Hub → open the demo job → show the moisture readings, drying log, and air sample. Show Room tracking. Show Job Documentation checklist.',
    question: 'Does this match how your techs currently document water mitigation jobs? What\'s missing from their daily routine?',
    decision: 'Confirm restoration documentation workflow is sufficient for DH field teams.',
  },
  {
    num: 5,
    title: 'GSCP Subcontract Workflow',
    link: '/subcontracts',
    show: 'Navigate to Subcontract View (DH side). Show the demo GSCP subcontract work order. Explain the flow: DH creates WO → GSCP field submits updates → Jesus reviews → DH sees approved updates. Then go to /subcontract-review to show Jesus\'s review queue.',
    question: 'Is this the right level of control for how DH and GSCP currently work together? Does Jesus need to approve everything or just flagged items?',
    decision: 'Confirm GSCP review chain is correct. Decide if Jesus approval should be required vs. optional.',
  },
  {
    num: 6,
    title: 'Proven Jobs Migration Dashboard',
    link: '/migration-dashboard',
    show: 'Open the Migration Dashboard. Walk through the metrics: imports, records, cutover status. Show the Export Checklist link and the demo legacy record in Legacy Records. Show the cutover workflow on a record.',
    question: 'How many active jobs are currently in Proven Jobs? Do you have a rough idea of when you\'d want to do the export?',
    decision: 'Agree on a target date for the Proven Jobs data export.',
  },
  {
    num: 7,
    title: 'Access Management',
    link: '/access-management',
    show: 'Open Access Management. Walk through the permission groups (field tech, operations admin, nexus reviewer, etc.). Show the financial visibility toggle. Show company memberships.',
    question: 'Do these permission levels match your team structure? Any roles you need that don\'t exist yet?',
    decision: 'Confirm permission model is sufficient for your team before inviting employees.',
  },
  {
    num: 8,
    title: 'Nexus Approval Inbox',
    link: '/nexus',
    show: 'Open Nexus Inbox. Show the demo pending item from the field. Show how a reviewer approves or rejects it. Explain that field staff submit observations and decisions flow up through the inbox.',
    question: 'Who on your team should be the Nexus reviewer? Is one reviewer sufficient or do you need multiple?',
    decision: 'Identify Nexus reviewer(s) and confirm the approval workflow meets your oversight needs.',
  },
  {
    num: 9,
    title: 'Known Limitations',
    link: '/known-limitations',
    show: 'Open Known Limitations. Walk through each limitation honestly. Emphasize: QuickBooks not integrated, offline mode not built, photo upload from docs tab not wired, real employee accounts not yet tested.',
    question: 'Which of these limitations would block your team from using the platform day-to-day right now? Which can you work around?',
    decision: 'Identify any hard blockers that must be resolved before parallel run begins.',
  },
  {
    num: 10,
    title: 'Feedback Capture',
    link: '/review-dashboard',
    show: 'Return to Review Dashboard. Open the "Leave Feedback" panel. Ask Nick to submit at least one piece of feedback — anything: a question, a concern, a feature request, or a confirmation that something looks good.',
    question: 'What is your single biggest concern going into the rollout? What would make you most confident?',
    decision: 'Nick submits feedback. This is the formal record of the review.',
  },
  {
    num: 11,
    title: 'Rollout Decision',
    link: '/review-decisions',
    show: 'Open Review Decisions. Walk through the decision types: Continue Development, Begin Parallel Run, Begin Limited Pilot, Approve Cutover Planning, Blocked. Explain what each means operationally.',
    question: 'Based on everything you\'ve seen today — what is your decision? Are you ready to begin a parallel run, or do you need more development first?',
    decision: 'Nick makes a formal rollout decision. This is recorded in Review Decisions and links to the Rollout Checklist.',
  },
];

export default function ReviewScript() {
  const [completed, setCompleted] = useState(load);
  const [expanded, setExpanded] = useState({ 1: true });

  const toggle = (num) => {
    setCompleted(prev => {
      const next = { ...prev, [num]: !prev[num] };
      save(next);
      return next;
    });
  };

  const doneCount = Object.values(completed).filter(Boolean).length;

  return (
    <AppLayout title="Review Script">
      <div className="app-page max-w-3xl space-y-5">

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Guided Review Script</h1>
            <p className="app-page-subtitle">Step-by-step walkthrough for Nick's platform review · {doneCount}/{STEPS.length} steps complete</p>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Review Progress</span>
            <span className="font-bold text-primary">{doneCount} / {STEPS.length}</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.round((doneCount / STEPS.length) * 100)}%` }} />
          </div>
        </div>

        <div className="space-y-3">
          {STEPS.map(step => {
            const isDone = !!completed[step.num];
            const isExpanded = !!expanded[step.num];
            return (
              <div key={step.num} className={`bg-card border rounded-xl overflow-hidden transition-colors ${isDone ? 'border-green-200' : 'border-border'}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => toggle(step.num)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                      isDone ? 'bg-primary border-primary text-white' : 'border-border bg-card hover:border-primary'}`}>
                    {isDone ? <CheckSquare className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold text-muted-foreground">{step.num}</span>}
                  </button>
                  <button className="flex-1 text-left" onClick={() => setExpanded(prev => ({ ...prev, [step.num]: !prev[step.num] }))}>
                    <p className={`text-sm font-semibold ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{step.title}</p>
                  </button>
                  <Link to={step.link}
                    className="flex items-center gap-1 text-xs text-primary font-medium hover:underline shrink-0">
                    Open <ArrowRight className="w-3 h-3" />
                  </Link>
                  <button onClick={() => setExpanded(prev => ({ ...prev, [step.num]: !prev[step.num] }))}
                    className="text-muted-foreground ml-1 shrink-0">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/5">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">What to Show</p>
                      <p className="text-xs text-foreground leading-relaxed">{step.show}</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide mb-1">Question to Ask Nick</p>
                      <p className="text-xs text-blue-800 italic">"{step.question}"</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Decision Needed</p>
                      <p className="text-xs text-amber-800">{step.decision}</p>
                    </div>
                    <button onClick={() => toggle(step.num)}
                      className={`flex items-center gap-2 text-xs font-semibold px-3 h-7 rounded-lg border transition-colors ${
                        isDone ? 'border-green-300 text-green-700 bg-green-50' : 'border-primary text-primary hover:bg-primary/5'}`}>
                      {isDone ? <><CheckSquare className="w-3.5 h-3.5" /> Step Complete</> : 'Mark Complete'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pb-8" />
      </div>
    </AppLayout>
  );
}