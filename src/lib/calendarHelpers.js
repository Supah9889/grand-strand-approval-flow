export const EVENT_TYPE_CONFIG = {
  job_visit:            { label: 'Job Visit',            icon: '🏠' },
  work_block:           { label: 'Work Block',           icon: '🔨' },
  estimate_appointment: { label: 'Estimate Appt',        icon: '📋' },
  warranty_appointment: { label: 'Warranty Appt',        icon: '🛡' },
  follow_up:            { label: 'Follow-Up',            icon: '📞' },
  task_deadline:        { label: 'Task Deadline',        icon: '✅' },
  delivery:             { label: 'Delivery',             icon: '📦' },
  inspection:           { label: 'Inspection',           icon: '🔍' },
  meeting:              { label: 'Meeting',              icon: '👥' },
  other:                { label: 'Other',                icon: '📌' },
};

export const EVENT_STATUS_CONFIG = {
  scheduled:   { label: 'Scheduled',   color: 'bg-blue-100 text-blue-700' },
  confirmed:   { label: 'Confirmed',   color: 'bg-green-100 text-green-700' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  completed:   { label: 'Completed',   color: 'bg-gray-100 text-gray-500' },
  waiting:     { label: 'Waiting',     color: 'bg-orange-100 text-orange-700' },
  canceled:    { label: 'Canceled',    color: 'bg-red-100 text-red-600' },
  rescheduled: { label: 'Rescheduled', color: 'bg-violet-100 text-violet-700' },
};

export const BLOCK_PRESETS = [
  { label: '7 AM – 11 AM', start: '07:00', end: '11:00' },
  { label: '8 AM – 12 PM', start: '08:00', end: '12:00' },
  { label: '12 PM – 4 PM', start: '12:00', end: '16:00' },
  { label: '8 AM – 4 PM',  start: '08:00', end: '16:00' },
];

export function getEventColor(e) {
  return e.color || '#3d8b7a';
}

export function formatEventTime(isoString) {
  if (!isoString || !isoString.includes('T')) return null;
  const [, time] = isoString.split('T');
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2,'0')} ${ampm}`;
}