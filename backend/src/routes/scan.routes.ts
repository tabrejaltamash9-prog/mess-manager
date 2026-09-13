import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { verifyScan } from '../services/scan.service';
import { supabase } from '../config/supabase';

const router = Router();

// All scan routes require authentication
router.use(authenticate);

// ── POST /api/scan/verify ─────────────────────────────────────────────────────
// Staff-only. Core scan endpoint.
const verifyScanSchema = z.object({
  qr: z.string().min(1, 'QR data is required.'),
});

router.post('/verify', authorize('mess_staff', 'admin'), async (req: Request, res: Response) => {
  const parsed = verifyScanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const result = await verifyScan(parsed.data.qr, req.user!.userId);

  // Always return 200 so the frontend can parse the business logic result (success/failure)
  // and display the appropriate UI screen instead of throwing a raw HTTP error.
  res.status(200).json(result);
});

// ── GET /api/scan/counter/:mealWindowId ───────────────────────────────────────
// Staff-only. Real-time scan counter for the current meal.
router.get('/counter/:mealWindowId', authorize('mess_staff', 'admin'), async (req: Request, res: Response) => {
  const { mealWindowId } = req.params;

  const { count: scanned, error } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .eq('meal_window_id', mealWindowId);

  if (error) {
    res.status(500).json({ error: 'Failed to fetch counter.' });
    return;
  }

  // Total active students (for denominator)
  const { count: total } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  res.json({ scanned: scanned ?? 0, total: total ?? 0 });
});

// ── POST /api/scan/manual-override ────────────────────────────────────────────
// Admin-only. Mark a student present without scanning (lost phone, guest, etc.)
const manualOverrideSchema = z.object({
  student_id: z.string().uuid(),
  meal_window_id: z.string().uuid(),
  note: z.string().min(1, 'A reason note is required for manual overrides.'),
});

router.post('/manual-override', authorize('admin'), async (req: Request, res: Response) => {
  const parsed = manualOverrideSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { student_id, meal_window_id, note } = parsed.data;

  // Check window exists
  const { data: window } = await supabase
    .from('meal_windows')
    .select('id, status')
    .eq('id', meal_window_id)
    .maybeSingle();

  if (!window) {
    res.status(404).json({ error: 'Meal window not found.' });
    return;
  }

  // Allow overrides on open or closed windows (closed = admin cleaning up missed scans)
  const { error: insertError } = await supabase.from('attendance').insert({
    student_id,
    meal_window_id,
    scanned_by: req.user!.userId,
    is_manual: true,
    override_note: note,
  });

  if (insertError) {
    if (insertError.code === '23505') {
      res.status(409).json({ error: 'Student already marked present for this meal.' });
      return;
    }
    res.status(500).json({ error: 'Failed to record override.' });
    return;
  }

  // Audit log
  await supabase.from('audit_log').insert({
    action: 'manual_attendance_override',
    actor_id: req.user!.userId,
    actor_type: 'staff',
    target_id: student_id,
    meta: { meal_window_id, note },
  });

  res.json({ message: 'Student marked present manually.' });
});

export default router;
