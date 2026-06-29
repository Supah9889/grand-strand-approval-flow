export const PUBLIC_PATHS = new Set(['/', '/gate']);
export const PUBLIC_GRANT_PATHS = new Set(['/signature', '/approval', '/approve', '/confirmation', '/review']);
export const PUBLIC_PORTAL_PATHS = new Set(['/portal/client', '/portal/vendor']);

const SIGNING_GRANT_KEYS = [
  'token',
  'signatureToken',
  'signature_token',
  'approvalToken',
  'approval_token',
];

function paramsFromSearch(search = '') {
  return new URLSearchParams(search || '');
}

export function getPublicGrantToken(search = '') {
  const params = paramsFromSearch(search);
  return SIGNING_GRANT_KEYS.map(key => params.get(key)).find(Boolean) || '';
}

export function hasPublicGrant(search = '') {
  return Boolean(getPublicGrantToken(search));
}

export function hasPortalToken(search = '') {
  return Boolean(paramsFromSearch(search).get('token'));
}

export function canBypassUnlock(pathname, search = '') {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (PUBLIC_GRANT_PATHS.has(pathname)) return hasPublicGrant(search);
  if (PUBLIC_PORTAL_PATHS.has(pathname)) return hasPortalToken(search);
  return false;
}

export function shouldRequireUnlock(pathname, search = '') {
  return !canBypassUnlock(pathname, search);
}

export function hasSelectedCompany(company) {
  if (typeof company === 'string') return company.trim().length > 0;
  return Boolean(company?.id);
}
