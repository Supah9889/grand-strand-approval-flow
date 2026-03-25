// Role-based PIN auth for internal access.
// Override codes: 1234 = staff, 4321 = admin, 2341 = owner
// Individual employee codes also work at /gate — see AccessGate.jsx
const OVERRIDE_CODES = {
  '1234': 'staff',
  '4321': 'admin',
  '2341': 'owner',
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

/** Returns the full session object including employee info if logged in via employee code */
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Returns the logged-in employee object if they authenticated via their own code */
export function getSessionEmployee() {
  const session = getSession();
  return session?.employee || null;
}

export function isAdminAuthed() {
  return !!getInternalRole();
}

export function isOwner() {
  return getInternalRole() === 'owner';
}

/** Returns true for both admin AND owner — owner is a superset of admin */
export function isAdmin() {
  const role = getInternalRole();
  return role === 'admin' || role === 'owner';
}

export function isStaff() {
  return getInternalRole() === 'staff';
}

/** Returns true only for owner — for owner-exclusive actions */
export function isOwnerOnly() {
  return getInternalRole() === 'owner';
}

/**
 * Attempt login with an override code (returns role string or null).
 * Does NOT handle employee codes — those are resolved async in AccessGate.
 */
export function attemptOverrideLogin(code) {
  const role = OVERRIDE_CODES[code?.trim()];
  if (role) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role }));
    return role;
  }
  return null;
}

/**
 * Log in as a specific employee.
 * Maps employee.role to the internal session role:
 *   admin  → 'admin'
 *   staff  → 'staff'
 *   field  → 'staff'  (field workers get staff-level access)
 */
export function loginAsEmployee(employee) {
  const roleMap = { admin: 'admin', staff: 'staff', field: 'staff' };
  const role = roleMap[employee.role] || 'staff';
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    role,
    employee: {
      id: employee.id,
      name: employee.name,
      employee_code: employee.employee_code,
      role: employee.role,
    },
  }));
  return role;
}

/** Legacy: kept for backward compat — same as attemptOverrideLogin */
export function attemptLogin(code) {
  return attemptOverrideLogin(code);
}

/** Legacy support — checks staff or admin pin */
export function attemptAdminLogin(pin, role = 'admin') {
  const legacyPins = { admin: '2580', staff: '1234' };
  if (legacyPins[role] && pin === legacyPins[role]) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role }));
    return true;
  }
  return false;
}

export function adminLogout() {
  sessionStorage.removeItem(SESSION_KEY);
}