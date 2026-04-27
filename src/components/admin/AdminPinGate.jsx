/**
 * AdminPinGate — Legacy secondary PIN gate, formerly used inline in some pages.
 *
 * This component is DEPRECATED. The primary access path is the main AccessGate (/gate).
 * This component now simply redirects to /gate rather than accepting a separate PIN.
 *
 * Kept in place to avoid breaking any remaining import references during transition.
 * If no pages import this component, it can be safely deleted.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAdminAuthed } from '@/lib/adminAuth';

export default function AdminPinGate({ onAuthed }) {
  const navigate = useNavigate();

  useEffect(() => {
    // If the session is already active (user came through /gate), call onAuthed immediately
    if (isAdminAuthed()) {
      onAuthed?.(null); // role already set in session
    } else {
      // Otherwise redirect to the real gate
      navigate('/gate', { replace: true });
    }
  }, []);

  return null;
}