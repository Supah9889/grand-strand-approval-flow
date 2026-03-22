// Role-based PIN auth for internal access.
// Codes: 1234 = staff, 4321 = admin
const CODES = {
  '1234': 'staff',
  '4321': 'admin',
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

/** Attempt login by code. Returns role string or null. */
export function attemptLogin(code) {
  const role = CODES[code?.trim()];
  if (role) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role }));
    return role;
  }
  return null;
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