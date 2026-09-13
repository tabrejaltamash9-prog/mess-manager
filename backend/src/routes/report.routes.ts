import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { supabase } from '../config/supabase';

const router = Router();
router.use(authenticate, authorize('admin'));

// ── GET /api/reports/daily ────────────────────────────────────────────────────
// Daily attendance summary for a given date (defaults to today)
router.get('/daily', async (req: Request, res: Response) => {
  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);

  const { data: windows, error } = await supabase
    .from('meal_windows')
    .select('id, meal_type, status, start_time, end_time')
    .eq('date', date);

  if (error) {
    res.status(500).json({ error: 'Failed to fetch report.' });
    return;
  }

  const { count: totalStudents } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  // For each window, get count from hot table (today) or archive (past)
  const isToday = date === new Date().toISOString().slice(0, 10);
  const table = isToday ? 'attendance' : 'attendance_archive';

  const results = await Promise.all(
    (windows ?? []).map(async (w) => {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('meal_window_id', w.id);

      return {
        meal_type: w.meal_type,
        status: w.status,
        start_time: w.start_time,
        end_time: w.end_time,
        scanned: count ?? 0,
        total: totalStudents ?? 0,
        percentage: totalStudents
          ? Math.round(((count ?? 0) / totalStudents) * 100)
          : 0,
      };
    })
  );

  res.json({ date, meals: results, total_students: totalStudents });
});

// ── GET /api/reports/hostel ───────────────────────────────────────────────────
// Breakdown by hostel block for a given meal window
router.get('/hostel', async (req: Request, res: Response) => {
  const { meal_window_id } = req.query;
  if (!meal_window_id) {
    res.status(400).json({ error: 'meal_window_id query param required.' });
    return;
  }

  // Check if this window is in archive or hot table
  const { data: inHot } = await supabase
    .from('attendance')
    .select('id')
    .eq('meal_window_id', meal_window_id)
    .limit(1);

  const table = inHot && inHot.length > 0 ? 'attendance' : 'attendance_archive';

  const { data: scanned } = await supabase
    .from(table)
    .select('students!inner(hostel_block)')
    .eq('meal_window_id', meal_window_id);

  const { data: allStudents } = await supabase
    .from('students')
    .select('hostel_block')
    .eq('is_active', true);

  // Aggregate by hostel block
  const blockMap: Record<string, { scanned: number; total: number }> = {};

  (allStudents ?? []).forEach((s) => {
    const block = s.hostel_block ?? 'Unknown';
    if (!blockMap[block]) blockMap[block] = { scanned: 0, total: 0 };
    blockMap[block].total++;
  });

  (scanned ?? []).forEach((row: any) => {
    const block = row.students?.hostel_block ?? 'Unknown';
    if (!blockMap[block]) blockMap[block] = { scanned: 0, total: 0 };
    blockMap[block].scanned++;
  });

  const breakdown = Object.entries(blockMap).map(([block, data]) => ({
    hostel_block: block,
    scanned: data.scanned,
    total: data.total,
    percentage: data.total > 0 ? Math.round((data.scanned / data.total) * 100) : 0,
  }));

  res.json({ meal_window_id, breakdown });
});

// ── GET /api/reports/no-shows ─────────────────────────────────────────────────
// List students who did NOT eat a specific meal
router.get('/no-shows', async (req: Request, res: Response) => {
  const { meal_window_id } = req.query;
  if (!meal_window_id) {
    res.status(400).json({ error: 'meal_window_id query param required.' });
    return;
  }

  const { data: inHot } = await supabase
    .from('attendance')
    .select('student_id')
    .eq('meal_window_id', meal_window_id);

  const { data: inArchive } = await supabase
    .from('attendance_archive')
    .select('student_id')
    .eq('meal_window_id', meal_window_id);

  const scannedIds = new Set([
    ...(inHot ?? []).map((r) => r.student_id),
    ...(inArchive ?? []).map((r) => r.student_id),
  ]);

  const { data: allStudents } = await supabase
    .from('students')
    .select('id, name, roll_no, email, hostel_block')
    .eq('is_active', true);

  const noShows = (allStudents ?? []).filter((s) => !scannedIds.has(s.id));

  res.json({ meal_window_id, no_shows: noShows, count: noShows.length });
});

export default router;
