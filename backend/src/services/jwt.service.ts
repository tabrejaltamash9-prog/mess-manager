import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { supabase } from '../config/supabase';

export type UserType = 'student' | 'staff';

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'student' | 'mess_staff' | 'admin';
  userType: UserType;
}

/**
 * Sign a short-lived access token (15 min default)
 */
export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
  });
}

/**
 * Sign a long-lived refresh token (30 days default)
 * Also stores a hash of the token in DB for rotation/revocation.
 */
export async function signRefreshToken(payload: TokenPayload): Promise<string> {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, 10);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await supabase.from('refresh_tokens').insert({
    user_id: payload.userId,
    user_type: payload.userType,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  // Encode userId + rawToken together so we can look it up later
  const refreshToken = jwt.sign(
    { userId: payload.userId, userType: payload.userType, raw: rawToken },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
  );

  return refreshToken;
}

/**
 * Verify an access token. Throws if invalid or expired.
 */
export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
}

/**
 * Rotate a refresh token: verify old → issue new access + refresh tokens.
 */
export async function rotateRefreshToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; payload: TokenPayload }> {
  let decoded: { userId: string; userType: UserType; raw: string };

  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as any;
  } catch {
    throw new Error('Invalid or expired refresh token.');
  }

  // Find matching (non-revoked, non-expired) refresh tokens for this user
  const { data: tokens } = await supabase
    .from('refresh_tokens')
    .select('*')
    .eq('user_id', decoded.userId)
    .eq('revoked', false)
    .gt('expires_at', new Date().toISOString());

  if (!tokens || tokens.length === 0) {
    throw new Error('Refresh token not found or revoked.');
  }

  // Find the matching one by comparing raw token against all hashes
  let matchedToken: (typeof tokens)[0] | null = null;
  for (const t of tokens) {
    const match = await bcrypt.compare(decoded.raw, t.token_hash);
    if (match) {
      matchedToken = t;
      break;
    }
  }

  if (!matchedToken) {
    throw new Error('Refresh token not found or already used.');
  }

  // Revoke old token
  await supabase
    .from('refresh_tokens')
    .update({ revoked: true })
    .eq('id', matchedToken.id);

  // Fetch user info to rebuild payload
  let payload: TokenPayload;

  if (decoded.userType === 'student') {
    const { data: student } = await supabase
      .from('students')
      .select('id, email')
      .eq('id', decoded.userId)
      .single();
    if (!student) throw new Error('User not found.');
    payload = { userId: student.id, email: student.email, role: 'student', userType: 'student' };
  } else {
    const { data: staff } = await supabase
      .from('staff')
      .select('id, email, role')
      .eq('id', decoded.userId)
      .single();
    if (!staff) throw new Error('User not found.');
    payload = { userId: staff.id, email: staff.email, role: staff.role, userType: 'staff' };
  }

  const newAccessToken = signAccessToken(payload);
  const newRefreshToken = await signRefreshToken(payload);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, payload };
}

/**
 * Revoke all refresh tokens for a user (logout all devices)
 */
export async function revokeAllTokens(userId: string): Promise<void> {
  await supabase
    .from('refresh_tokens')
    .update({ revoked: true })
    .eq('user_id', userId);
}
