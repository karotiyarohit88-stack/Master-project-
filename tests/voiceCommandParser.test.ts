import test from 'node:test';
import assert from 'node:assert/strict';
import { findVoiceControl, isHighImpactVoiceAction, normalizeVoiceText, stripVoiceActionPrefix } from '../src/utils/voiceCommandParser.ts';

test('normalizes English and Hindi text for stable voice matching', () => {
  assert.equal(normalizeVoiceText('Open Camera Studio!'), 'open camera studio');
  assert.equal(normalizeVoiceText('कैमरा स्टूडियो खोलो'), 'कैमरा स्टूडियो खोलो');
});

test('removes supported command prefixes', () => {
  assert.equal(stripVoiceActionPrefix('click Save Draft'), 'save draft');
  assert.equal(stripVoiceActionPrefix('खोलो कैमरा स्टूडियो'), 'कैमरा स्टूडियो');
});

test('matches a visible control by exact or contained label', () => {
  const candidates = [
    { label: 'Open Camera Studio', kind: 'button' as const, id: 'camera' },
    { label: 'Email address', kind: 'input' as const, id: 'email' }
  ];
  assert.equal(findVoiceControl('camera studio', candidates)?.id, 'camera');
  assert.equal(findVoiceControl('focus email address', candidates)?.id, 'email');
  assert.equal(findVoiceControl('unknown action', candidates), undefined);
});

test('requires confirmation for every button and known high-impact labels', () => {
  assert.equal(isHighImpactVoiceAction({ label: 'Run Now', kind: 'button' }), true);
  assert.equal(isHighImpactVoiceAction({ label: 'Delete workflow', kind: 'other' }), true);
  assert.equal(isHighImpactVoiceAction({ label: 'Email address', kind: 'input' }), false);
  assert.equal(isHighImpactVoiceAction({ label: 'Submit', kind: 'other', isSubmit: true }), true);
});
