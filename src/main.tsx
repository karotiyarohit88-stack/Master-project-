import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthGate } from './components/AuthGate.tsx';
import './index.css';

// Attach the readable CSRF cookie to every same-origin API mutation.
// The session cookie remains HttpOnly and is never exposed to JavaScript.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const requestUrl = input instanceof Request ? input.url : String(input);
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  let target: URL;
  try {
    target = new URL(requestUrl, window.location.origin);
  } catch {
    return nativeFetch(input, init);
  }

  if (target.origin !== window.location.origin || !target.pathname.startsWith('/api/') ||
      !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return nativeFetch(input, init);
  }

  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  const csrfCookie = document.cookie.split(';').map(part => part.trim())
    .find(part => part.startsWith('aaksh_csrf='));
  if (csrfCookie && !headers.has('X-CSRF-Token')) {
    headers.set('X-CSRF-Token', decodeURIComponent(csrfCookie.slice('aaksh_csrf='.length)));
  }
  return nativeFetch(input, { ...init, credentials: init?.credentials || 'same-origin', headers });
};

createRoot(document.getElementById('root')!).render(
  <AuthGate><App /></AuthGate>
);
