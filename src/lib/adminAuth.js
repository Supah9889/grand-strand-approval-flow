// Simple admin PIN protection for the Admin panel.
// PIN is checked client-side; it keeps customers away without complex auth.
const ADMIN_PIN = '2580';
const SESSION_KEY = 'gscp_admin_auth';

export function isAdminAuthed() {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

export function attemptAdminLogin(pin) {
  if (pin === ADMIN_PIN) {
    sessionStorage.setItem(SESSION_KEY, 'true');
    return true;
  }
  return false;
}

export function adminLogout() {
  sessionStorage.removeItem(SESSION_KEY);
}