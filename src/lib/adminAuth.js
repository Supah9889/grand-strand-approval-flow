// Role-based PIN auth for internal access.
// Codes: 1234 = staff, 4321 = admin, 2341 = owner (temporary testing PINs)
const CODES = {
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