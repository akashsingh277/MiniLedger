
import { randomInt } from 'node:crypto';

type OtpRecord = {
  code: string;
  expiresAt: number;
};

const otpStore = new Map<string, OtpRecord>();

export function generateOtp(phone: string): string {
  const code = randomInt(100000, 1000000).toString();

  const ttlMinutes = Number(process.env.OTP_TTL_MINUTES) || 5;

  otpStore.set(phone, {
    code,
    expiresAt: Date.now() + ttlMinutes * 60 * 1000
  });

  // Assignment requirement: print the mock OTP in the server log.
  console.log(`Mock OTP for ${phone}: ${code}`);

  return code;
}

export function verifyOtp(phone: string, code: string): boolean {
  const record = otpStore.get(phone);

  if (!record || record.expiresAt < Date.now() || record.code !== code) {
    return false;
  }

  // OTPs are single-use.
  otpStore.delete(phone);

  return true;
}
