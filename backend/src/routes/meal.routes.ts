import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { supabase } from '../config/supabase';
import { signQrPayload } from '../utils/qrSigner';

const router = Router();

router.use(authenticate);

// ── GET /api/meal/current ─────────────────────────────────────────────────────
// Student: get the currently open (or upcoming) meal window + their signed QR
router.get('/current', authorize('student'), async (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);

  // Find open window first, then upcoming
  const { data: windows } = await supabase
    .from('meal_windows')
    .select('*')
    .eq('date', today)
    .in('status', ['open', 'upcoming'])
    .order('start_time', { ascending: true });

  const openWindow = windows?.find((w) => w.status === 'open');
  const nextWindow = windows?.[0]; // first upcoming if none open

  const activeWindow = openWindow ?? nextWindow ?? null;

  if (!activeWindow) {
    res.json({ window: null, qr: null, message: 'No meal window active today.' });
    return;
  }

  // Generate signed QR for this student + meal window
  const qr = signQrPayload({
    student_id: req.user!.userId,
    meal_window_id: activeWindow.id,
    issued_at: Date.now(),
  });

  // Check if student already scanned this meal
  const { data: alreadyScanned } = await supabase
    .from('attendance')
    .select('scanned_at')
    .eq('student_id', req.user!.userId)
    .eq('meal_window_id', activeWindow.id)
    .maybeSingle();

  res.json({
    window: activeWindow,
    qr: activeWindow.status === 'open' ? qr : null, // only show QR when window is open
    already_scanned: !!alreadyScanned,
    scanned_at: alreadyScanned?.scanned_at ?? null,
  });
});

// ── GET /api/meal/windows ─────────────────────────────────────────────────────
// Admin/Staff: list all meal windows (paginated)
router.get('/windows', authorize('admin', 'mess_staff'), async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const from = (page - 1) * limit;

  const { data, count, error } = await supabase
    .from('meal_windows')
    .select('*', { count: 'exact' })
    .order('date', { ascending: false })
    .order('start_time', { ascending: true })
    .range(from, from + limit - 1);

  if (error) {
    res.status(500).json({ error: 'Failed to fetch meal windows.' });
    return;
  }

  res.json({ windows: data, total: count, page, limit });
});

// ── POST /api/meal/windows ────────────────────────────────────────────────────
// Admin: create a meal window manually (overrides cron for that day/meal)
const createWindowSchema = z.object({
  meal_type: z.enum(['breakfast', 'lunch', 'dinner']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  start_time: z.string(),
  end_time: z.string(),
});

router.post('/windows', authorize('admin'), async (req: Request, res: Response) => {
  const parsed = createWindowSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { meal_type, date, start_time, end_time } = parsed.data;

  const { data, error } = await supabase
    .from('meal_windows')
    .insert({
      meal_type,
      date,
      start_time: new Date(`${date}T${start_time}:00+05:30`).toISOString(),
      end_time: new Date(`${date}T${end_time}:00+05:30`).toISOString(),
      status: 'upcoming',
      created_by: req.user!.userId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'A window for this meal and date already exists.' });
      return;
    }
    res.status(500).json({ error: 'Failed to create meal window.' });
    return;
  }

  res.status(201).json(data);
});

// ── PUT /api/meal/windows/:id ─────────────────────────────────────────────────
// Admin: update timings or status (e.g., close early)
router.put('/windows/:id', authorize('admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { start_time, end_time, status } = req.body;

  const updates: Record<string, any> = {};
  if (start_time) updates.start_time = start_time;
  if (end_time) updates.end_time = end_time;
  if (status) updates.status = status;

  const { data, error } = await supabase
    .from('meal_windows')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to update meal window.' });
    return;
  }

  res.json(data);
});

// ── GET /api/meal/templates ───────────────────────────────────────────────────
// Admin: get default meal timings
router.get('/templates', authorize('admin'), async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('meal_templates')
    .select('*')
    .order('meal_type');

  if (error) {
    res.status(500).json({ error: 'Failed to fetch templates.' });
    return;
  }

  res.json(data);
});

// ── PUT /api/meal/templates/:meal_type ────────────────────────────────────────
// Admin: update default timings for a meal type
const updateTemplateSchema = z.object({
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  is_enabled: z.boolean().optional(),
});

router.put('/templates/:meal_type', authorize('admin'), async (req: Request, res: Response) => {
  const { meal_type } = req.params;
  const parsed = updateTemplateSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { data, error } = await supabase
    .from('meal_templates')
    .update({ ...parsed.data, updated_by: req.user!.userId, updated_at: new Date().toISOString() })
    .eq('meal_type', meal_type)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to update template.' });
    return;
  }

  res.json(data);
});

// ── DELETE /api/meal/windows/:id ──────────────────────────────────────────────
// Admin: completely delete a meal window (useful for testing)
router.delete('/windows/:id', authorize('admin'), async (req: Request, res: Response) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('meal_windows')
    .delete()
    .eq('id', id);

  if (error) {
    res.status(500).json({ error: 'Failed to delete meal window.' });
    return;
  }

  res.json({ success: true, message: 'Meal window deleted.' });
});

export default router;
