import test from 'node:test';
import assert from 'node:assert/strict';
import { getCsrfHeaders } from '../src/utils/csrf.ts';

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

function setCookie(cookie: string) {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { cookie }
  });
}

function restoreDocument() {
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
}

test('CSRF helper returns the decoded session token header', () => {
  setCookie('theme=light; aaksh_csrf=csrf%2Ftoken-123');
  try {
    assert.deepEqual(getCsrfHeaders(), { 'X-CSRF-Token': 'csrf/token-123' });
  } finally { restoreDocument(); }
});

test('CSRF helper fails closed when the token cookie is missing', () => {
  setCookie('theme=light');
  try {
    assert.throws(() => getCsrfHeaders(), /Security token is missing/);
  } finally { restoreDocument(); }
});

test('CSRF helper fails closed when the token cookie is malformed', () => {
  setCookie('aaksh_csrf=%E0%A4%A');
  try {
    assert.throws(() => getCsrfHeaders(), /Security token is invalid/);
  } finally { restoreDocument(); }
});
