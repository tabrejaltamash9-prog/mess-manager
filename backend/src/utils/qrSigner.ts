import crypto from 'crypto';
import { env } from '../config/env';

export interface QrPayload {
  student_id: string;
  meal_window_id: string;
  issued_at: number; // Unix ms
}

/**
 * Create a signed QR string for a student + meal window.
 * Format: Base64( JSON({ student_id, meal_window_id, issued_at, sig }) )
 */
export function signQrPayload(payload: QrPayload): string {
  const data = `${payload.student_id}:${payload.meal_window_id}:${payload.issued_at}`;
  const sig = crypto
    .createHmac('sha256', env.QR_HMAC_SECRET)
    .update(data)
    .digest('hex');

  const full = { ...payload, sig };
  return Buffer.from(JSON.stringify(full)).toString('base64url');
}

/**
 * Decode and verify a QR string. Returns the payload if valid.
 * Throws an error if tampered or malformed.
 */
export function verifyQrPayload(qrString: string): QrPayload {
  let full: QrPayload & { sig: string };

  try {
    const decoded = Buffer.from(qrString, 'base64url').toString('utf-8');
    full = JSON.parse(decoded);
  } catch {
    throw new Error('Invalid QR code format.');
  }

  const { sig, ...payload } = full;

  if (!payload.student_id || !payload.meal_window_id || !payload.issued_at) {
    throw new Error('Malformed QR payload.');
  }

  const data = `${payload.student_id}:${payload.meal_window_id}:${payload.issued_at}`;
  const expectedSig = crypto
    .createHmac('sha256', env.QR_HMAC_SECRET)
    .update(data)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
    throw new Error('QR signature invalid — possible tampering.');
  }

  return payload;
}
