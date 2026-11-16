import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkAndroidAccessibilityPermission,
  executeSafeAccessibilityAction,
  type AndroidAccessibilityNativeBridge
} from '../src/utils/androidAccessibilityBridge.ts';

const setBridge = (bridge?: AndroidAccessibilityNativeBridge) => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: bridge ? { AndroidAccessibilityBridge: bridge } : {}
  });
};

test('Android accessibility permission fails closed when native bridge is unavailable', async () => {
  setBridge();
  assert.equal(await checkAndroidAccessibilityPermission(), 'unavailable');
  const result = await executeSafeAccessibilityAction('scroll_forward');
  assert.equal(result.ok, false);
});

test('Android accessibility actions are blocked when permission is disabled', async () => {
  let calls = 0;
  setBridge({
    isAccessibilityEnabled: async () => false,
    performAction: async () => { calls += 1; return { ok: true }; }
  });
  assert.equal(await checkAndroidAccessibilityPermission(), 'disabled');
  const result = await executeSafeAccessibilityAction('scroll_forward');
  assert.equal(result.ok, false);
  assert.equal(calls, 0);
});

test('unknown or unallowlisted actions are rejected before native execution', async () => {
  let calls = 0;
  setBridge({
    isAccessibilityEnabled: async () => true,
    performAction: async () => { calls += 1; return { ok: true }; }
  });
  const result = await executeSafeAccessibilityAction('delete_account' as never);
  assert.equal(result.ok, false);
  assert.equal(calls, 0);
});

test('element taps require human confirmation and a validated element ID', async () => {
  let received: unknown;
  setBridge({
    isAccessibilityEnabled: async () => true,
    performAction: async (_action, payload) => { received = payload; return { ok: true }; }
  });
  assert.equal((await executeSafeAccessibilityAction('tap_accessible_element', { elementId: 'settings.save' })).ok, false);
  assert.equal((await executeSafeAccessibilityAction('tap_accessible_element', { elementId: 'javascript:alert(1)' }, true)).ok, false);
  assert.deepEqual(await executeSafeAccessibilityAction('tap_accessible_element', { elementId: 'settings.save' }, true), { ok: true });
  assert.deepEqual(received, { elementId: 'settings.save' });
});

test('safe read and scroll actions pass only constrained payloads', async () => {
  const calls: unknown[] = [];
  setBridge({
    isAccessibilityEnabled: async () => true,
    performAction: async (action, payload) => { calls.push([action, payload]); return { ok: true }; }
  });
  assert.equal((await executeSafeAccessibilityAction('read_visible_text', { maxChars: 4001 })).ok, false);
  assert.equal((await executeSafeAccessibilityAction('read_visible_text', { maxChars: 1200, arbitrary: 'discard' })).ok, true);
  assert.equal((await executeSafeAccessibilityAction('scroll_forward', { arbitrary: 'discard' })).ok, true);
  assert.deepEqual(calls, [
    ['read_visible_text', { maxChars: 1200 }],
    ['scroll_forward', {}]
  ]);
});
