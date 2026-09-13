import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { generateOtp, verifyOtp } from '../services/otp.service';
import { sendOtpEmail } from '../services/email.service';
import {
  signAccessToken,
  signRefreshToken,
  rotateRefreshToken,
  revokeAllTokens,
} from '../services/jwt.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ── POST /api/auth/request-otp ───────────────────────────────────────────────
const requestOtpSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

router.post('/request-otp', async (req: Request, res: Response) => {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { email } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Check if email belongs to a student
  const { data: student } = await supabase
    .from('students')
    .select('id, name, is_active')
    .eq('email', normalizedEmail)
    .maybeSingle();

  // Check if email belongs to staff/admin
  const { data: staff } = !student
    ? await supabase
        .from('staff')
        .select('id, name, is_active')
        .eq('email', normalizedEmail)
        .maybeSingle()
    : { data: null };

  if (!student && !staff) {
    // Intentionally vague to avoid email enumeration
    res.status(200).json({
      message: 'If this email is registered, an OTP has been sent.',
    });
    return;
  }

  const user = student ?? staff!;

  if (!user.is_active) {
    res.status(403).json({ error: 'This account has been deactivated. Contact the admin.' });
    return;
  }

  try {
    const otp = await generateOtp(normalizedEmail);
    await sendOtpEmail(normalizedEmail, user.name, otp);

    res.json({
      message: 'OTP sent to your email. It expires in 5 minutes.',
    });
  } catch (err: any) {
    if (err.message?.includes('Too many OTP requests')) {
      res.status(429).json({ error: err.message });
      return;
    }
    console.error('[auth/request-otp] Error:', err);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

// ── POST /api/auth/verify-otp ────────────────────────────────────────────────
const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, 'OTP must be 6 digits.').regex(/^\d{6}$/, 'OTP must be numeric.'),
});

router.post('/verify-otp', async (req: Request, res: Response) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { email, otp } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    await verifyOtp(normalizedEmail, otp);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
    return;
  }

  // Determine user type and fetch profile
  const { data: student } = await supabase
    .from('students')
    .select('id, name, email, roll_no, department, hostel_block, photo_url')
    .eq('email', normalizedEmail)
    .maybeSingle();

  const { data: staffMember } = !student
    ? await supabase
        .from('staff')
        .select('id, name, email, role')
        .eq('email', normalizedEmail)
        .maybeSingle()
    : { data: null };

  if (!student && !staffMember) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const payload = student
    ? {
        userId: student.id,
        email: student.email,
        role: 'student' as const,
        userType: 'student' as const,
      }
    : {
        userId: staffMember!.id,
        email: staffMember!.email,
        role: staffMember!.role as 'mess_staff' | 'admin',
        userType: 'staff' as const,
      };

  const accessToken = signAccessToken(payload);
  const refreshToken = await signRefreshToken(payload);

  res.json({
    accessToken,
    refreshToken,
    user: student ?? staffMember,
    role: payload.role,
  });
});

// ── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken || typeof refreshToken !== 'string') {
    res.status(400).json({ error: 'Refresh token required.' });
    return;
  }

  try {
    const result = await rotateRefreshToken(refreshToken);
    res.json({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  await revokeAllTokens(req.user!.userId);
  res.json({ message: 'Logged out successfully.' });
});

export default router;
