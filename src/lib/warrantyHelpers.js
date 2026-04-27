export const WARRANTY_STATUS_CONFIG = {
  new:               { label: 'New',               color: 'bg-blue-100 text-blue-700' },
  scheduled:         { label: 'Scheduled',          color: 'bg-violet-100 text-violet-700' },
  in_progress:       { label: 'In Progress',        color: 'bg-amber-100 text-amber-700' },
  completed:         { label: 'Completed',          color: 'bg-green-100 text-green-700' },
  closed:            { label: 'Closed',             color: 'bg-gray-100 text-gray-500' },
  waiting_customer:  { label: 'Waiting on Customer',color: 'bg-orange-100 text-orange-700' },
  waiting_materials: { label: 'Waiting on Materials',color: 'bg-yellow-100 text-yellow-700' },
  on_hold:           { label: 'On Hold',            color: 'bg-slate-100 text-slate-600' },
  not_covered:       { label: 'Not Covered',        color: 'bg-red-100 text-red-700' },
  reopened:          { label: 'Reopened',           color: 'bg-rose-100 text-rose-700' },
};

export const WARRANTY_CATEGORY_LABELS = {
  paint_touchup:    'Paint Touch-Up',
  drywall:          'Drywall Issue',
  carpentry:        'Carpentry Issue',
  water_moisture:   'Water / Moisture',
  material_defect:  'Material Defect',
  workmanship:      'Workmanship Issue',
  customer_concern: 'Customer Concern',
  schedule_visit:   'Schedule / Follow-Up',
  other:            'Other',
};

export const WARRANTY_PRIORITY_CONFIG = {
  low:    { label: 'Low',    color: 'text-slate-500' },
  normal: { label: 'Normal', color: 'text-blue-600' },
  high:   { label: 'High',   color: 'text-amber-600' },
  urgent: { label: 'Urgent', color: 'text-red-600' },
};