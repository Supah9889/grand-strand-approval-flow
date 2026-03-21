// Role-based PIN auth for internal access.
// Two roles: 'admin' and 'staff', each with their own PIN.
const PINS = {
  admin: '2580',
  staff: '1234',
};

const SESSION_KEY = 'gscp_internal_auth';

export function getInternalRole() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { role } = JSON.parse(raw);
    return role || null;
  } catch {
    return null;
  }
}

export function isAdminAuthed() {
  return !!getInternalRole();
}

export function isAdmin() {
  return getInternalRole() === 'admin';
}

export function isStaff() {
  return getInternalRole() === 'staff';
}

export function attemptAdminLogin(pin, role = 'admin') {
  if (PINS[role] && pin === PINS[role]) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role }));
    return true;
  }
  return false;
}

export function adminLogout() {
  sessionStorage.removeItem(SESSION_KEY);
}