import test from 'node:test';
import assert from 'node:assert/strict';
import { createOtpChallengeMaterial, hashEmailOtp, sendEmailOtp } from '../authOtp.ts';

const pepper = 'test-only-otp-pepper-that-is-longer-than-32-characters';

test('OTP challenge material uses six digits and stores only digests for persisted tokens', () => {
  const first = createOtpChallengeMaterial(pepper);
  const second = createOtpChallengeMaterial(pepper);
  assert.match(first.otp, /^\d{6}$/);
  assert.match(first.challengeToken, /^[A-Za-z0-9_-]{40,60}$/);
  assert.match(first.challengeTokenHash, /^[a-f0-9]{64}$/);
  assert.match(first.otpHash, /^[a-f0-9]{64}$/);
  assert.notEqual(first.challengeToken, first.challengeTokenHash);
  assert.notEqual(first.otp, first.otpHash);
  assert.notEqual(first.challengeToken, second.challengeToken);
  assert.notEqual(first.otpHash, second.otpHash);
});

test('OTP HMAC is deterministic and rejects malformed OTPs or weak pepper', () => {
  assert.equal(hashEmailOtp('123456', pepper), hashEmailOtp('123456', pepper));
  assert.notEqual(hashEmailOtp('123456', pepper), hashEmailOtp('123457', pepper));
  assert.throws(() => hashEmailOtp('12345', pepper));
  assert.throws(() => hashEmailOtp('123456', 'weak'));
  assert.throws(() => createOtpChallengeMaterial('weak'));
});

test('Resend delivery sends OTP only to provider and never returns provider content', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({ id: 'email-test-id' }), { status: 200 });
  };
  await sendEmailOtp('person@example.test', '123456', {
    apiKey: 'test-resend-key',
    from: 'AAKSH Test <test@example.test>',
    fetchImpl
  });
  assert.equal(requestUrl, 'https://api.resend.com/emails');
  assert.equal((requestInit?.headers as Record<string, string>).Authorization, 'Bearer test-resend-key');
  const payload = JSON.parse(String(requestInit?.body));
  assert.deepEqual(payload.to, ['person@example.test']);
  assert.match(payload.text, /123456/);
});

test('Resend delivery fails closed when not configured or provider rejects request', async () => {
  await assert.rejects(() => sendEmailOtp('person@example.test', '123456', { apiKey: '', from: '' }), /not configured/);
  await assert.rejects(() => sendEmailOtp('person@example.test', '123456', {
    apiKey: 'test-key', from: 'test@example.test',
    fetchImpl: async () => new Response('sensitive provider response', { status: 500 })
  }), /HTTP 500/);
});
