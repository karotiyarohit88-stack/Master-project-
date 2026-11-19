import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkAndroidAccessibilityPermission,
  executeSafeAccessibilityAction,
  type AndroidAccessibilityNativeBridge,
  type AndroidAccessibilityPermissionState
} from '../src/utils/androidAccessibilityBridge.ts';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

function setBridge(bridge?: AndroidAccessibilityNativeBridge) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: bridge ? { AndroidAccessibilityBridge: bridge } : {}
  });
}

test.after(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});

test('permission states distinguish Enabled, Disabled, Unavailable and Unknown', async () => {
  const cases: Array<{ expected: AndroidAccessibilityPermissionState; bridge?: AndroidAccessibilityNativeBridge }> = [
    { expected: 'unavailable' },
    { expected: 'disabled', bridge: { isAccessibilityEnabled: async () => false, performAction: async () => ({ ok: true }) } },
    { expected: 'enabled', bridge: { isAccessibilityEnabled: async () => true, performAction: async () => ({ ok: true }) } },
    { expected: 'unknown', bridge: { isAccessibilityEnabled: async () => { throw new Error('native status unavailable'); }, performAction: async () => ({ ok: true }) } }
  ];
  for (const item of cases) {
    setBridge(item.bridge);
    assert.equal(await checkAndroidAccessibilityPermission(), item.expected);
  }
});

test('all explicitly allowlisted actions are forwarded only when permission is enabled', async () => {
  const actions = ['read_visible_text', 'scroll_forward', 'scroll_backward', 'tap_accessible_element'] as const;
  const calls: Array<{ action: string; payload: unknown }> = [];
  setBridge({
    isAccessibilityEnabled: async () => true,
    performAction: async (action, payload) => {
      calls.push({ action, payload });
      return { ok: true };
    }
  });

  assert.equal((await executeSafeAccessibilityAction('read_visible_text')).ok, true);
  assert.equal((await executeSafeAccessibilityAction('scroll_forward')).ok, true);
  assert.equal((await executeSafeAccessibilityAction('scroll_backward')).ok, true);
  assert.equal((await executeSafeAccessibilityAction('tap_accessible_element', { elementId: 'view.button' }, true)).ok, true);
  assert.deepEqual(calls.map(call => call.action), actions);
});

test('unallowlisted actions and payload injection fail closed without native calls', async () => {
  let calls = 0;
  setBridge({
    isAccessibilityEnabled: async () => true,
    performAction: async () => { calls += 1; return { ok: true }; }
  });
  assert.equal((await executeSafeAccessibilityAction('delete_account' as never)).ok, false);
  assert.equal((await executeSafeAccessibilityAction('tap_accessible_element', { elementId: 'javascript:alert(1)' }, true)).ok, false);
  assert.equal((await executeSafeAccessibilityAction('read_visible_text', { maxChars: 4001 })).ok, false);
  assert.equal(calls, 0);
});

test('element tap requires explicit human confirmation and a valid accessible element ID', async () => {
  let received: unknown;
  setBridge({
    isAccessibilityEnabled: async () => true,
    performAction: async (_action, payload) => { received = payload; return { ok: true }; }
  });
  assert.equal((await executeSafeAccessibilityAction('tap_accessible_element', { elementId: 'settings.save' })).ok, false);
  assert.equal((await executeSafeAccessibilityAction('tap_accessible_element', {}, true)).ok, false);
  assert.equal((await executeSafeAccessibilityAction('tap_accessible_element', { elementId: 'settings.save' }, true)).ok, true);
  assert.deepEqual(received, { elementId: 'settings.save' });
});

test('missing bridge, disabled permission, unknown permission and native exceptions all fail closed', async () => {
  setBridge();
  assert.equal((await executeSafeAccessibilityAction('scroll_forward')).ok, false);

  setBridge({
    isAccessibilityEnabled: async () => false,
    performAction: async () => { throw new Error('must not execute'); }
  });
  assert.equal((await executeSafeAccessibilityAction('scroll_forward')).ok, false);

  setBridge({
    isAccessibilityEnabled: async () => { throw new Error('unknown'); },
    performAction: async () => ({ ok: true })
  });
  assert.equal((await executeSafeAccessibilityAction('scroll_forward')).ok, false);

  setBridge({
    isAccessibilityEnabled: async () => true,
    performAction: async () => { throw new Error('native failure'); }
  });
  assert.deepEqual(await executeSafeAccessibilityAction('scroll_forward'), {
    ok: false, message: 'Android accessibility action failed safely.'
  });
});
