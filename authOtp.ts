import { createHmac, randomBytes, randomInt } from 'node:crypto';

export type OtpChallengeMaterial = {
  challengeToken: string;
  challengeTokenHash: string;
  otp: string;
  otpHash: string;
};

export function createOtpChallengeMaterial(pepper: string): OtpChallengeMaterial {
  if (!pepper || pepper.length < 32) {
    throw new Error('AAKSH_OTP_PEPPER must contain at least 32 characters.');
  }
  const challengeToken = randomBytes(32).toString('base64url');
  const otp = String(randomInt(100000, 1000000));
  return {
    challengeToken,
    challengeTokenHash: createHash('sha256').update(challengeToken).digest('hex'),
    otp,
    otpHash: hashEmailOtp(otp, pepper)
  };
}

export function hashEmailOtp(otp: string, pepper: string): string {
  if (!/^\d{6}$/.test(otp)) throw new Error('OTP must be exactly six digits.');
  if (!pepper || pepper.length < 32) throw new Error('AAKSH_OTP_PEPPER must contain at least 32 characters.');
  return createHmac('sha256', pepper).update(otp, 'utf8').digest('hex');
}

export async function sendEmailOtp(
  email: string,
  otp: string,
  options: { apiKey?: string; from?: string; fetchImpl?: typeof fetch } = {}
): Promise<void> {
  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY ?? '';
  const from = options.from ?? process.env.RESEND_FROM_EMAIL ?? '';
  if (!apiKey || !from) {
    throw new Error('Email OTP delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.');
  }
  if (!/^\d{6}$/.test(otp)) throw new Error('OTP must be exactly six digits.');
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Your AAKSH AI verification code',
      text: `Your AAKSH AI verification code is ${otp}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`
    })
  });
  if (!response.ok) {
    // Never include the OTP or provider response body in thrown errors/logs.
    throw new Error(`Email OTP delivery failed (HTTP ${response.status}).`);
  }
}
