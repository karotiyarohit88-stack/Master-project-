export function getCsrfHeaders(): Record<string, string> {
  if (typeof document === 'undefined') {
    throw new Error('Secure session token is unavailable. Refresh the authenticated page.');
  }
  const cookie = document.cookie
    .split('; ')
    .find((value) => value.startsWith('aaksh_csrf='));
  if (!cookie) {
    throw new Error('Security token is missing. Refresh the authenticated page and try again.');
  }
  let token = '';
  try {
    token = decodeURIComponent(cookie.slice('aaksh_csrf='.length));
  } catch {
    throw new Error('Security token is invalid. Refresh the authenticated page and try again.');
  }
  if (!token) {
    throw new Error('Security token is empty. Refresh the authenticated page and try again.');
  }
  return { 'X-CSRF-Token': token };
}
