import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { redis } from '../config/redis';
import { env } from '../config/env';

const OTP_EXPIRY_SECONDS = parseInt(env.OTP_EXPIRY_MINUTES) * 60;
const MAX_ATTEMPTS = parseInt(env.OTP_MAX_ATTEMPTS);
const RATE_LIMIT = parseInt(env.OTP_RATE_LIMIT_PER_HOUR);

// Redis key namespaces
const otpKey = (email: string) => `otp:${email}`;
const rateLimitKey = (email: string) => `otp_rate:${email}`;

interface OtpRecord {
  hash: string;
  attempts: number;
  expiresAt: number;
}

/**
 * Generate a 6-digit OTP, hash it, store in Redis with TTL.
 * Returns the plaintext OTP (to be emailed — never stored plaintext).
 */
export async function generateOtp(email: string): Promise<string> {
  // Rate limiting: max N OTP requests per hour per email
  const rateLimitKeyStr = rateLimitKey(email);
  const currentCount = await redis.incr(rateLimitKeyStr);
  if (currentCount === 1) {
    await redis.expire(rateLimitKeyStr, 3600); // 1 hour window
  }
  if (currentCount > RATE_LIMIT) {
    throw new Error(`Too many OTP requests. Please wait before trying again.`);
  }

  // Generate 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();

  // Hash it
  const saltRounds = 10;
  const hash = await bcrypt.hash(otp, saltRounds);

  const record: OtpRecord = {
    hash,
    attempts: 0,
    expiresAt: Date.now() + OTP_EXPIRY_SECONDS * 1000,
  };

  await redis.set(otpKey(email), JSON.stringify(record), { ex: OTP_EXPIRY_SECONDS });

  return otp;
}

/**
 * Verify the OTP provided by the user.
 * Returns true on success. Increments attempt counter.
 * Deletes OTP record on successful verification.
 */
export async function verifyOtp(email: string, inputOtp: string): Promise<boolean> {
  const raw = await redis.get<string>(otpKey(email));

  if (!raw) {
    throw new Error('OTP has expired or was never requested.');
  }

  const record: OtpRecord = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (Date.now() > record.expiresAt) {
    await redis.del(otpKey(email));
    throw new Error('OTP has expired. Please request a new one.');
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await redis.del(otpKey(email));
    throw new Error('Too many incorrect attempts. Please request a new OTP.');
  }

  const isValid = await bcrypt.compare(inputOtp, record.hash);

  if (!isValid) {
    record.attempts += 1;
    await redis.set(otpKey(email), JSON.stringify(record), {
      ex: Math.max(0, Math.floor((record.expiresAt - Date.now()) / 1000)),
    });
    throw new Error(`Incorrect OTP. ${MAX_ATTEMPTS - record.attempts} attempts remaining.`);
  }

  // Success — delete the OTP record (single-use)
  await redis.del(otpKey(email));
  return true;
}
