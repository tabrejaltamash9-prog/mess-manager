import cron from 'node-cron';
import { supabase } from '../config/supabase';

/**
 * Meal Window Lifecycle Cron
 *
 * Runs every minute. Reads meal_windows from the DB (which admin controls).
 * Nothing is hardcoded here — all timings come from the meal_templates table
 * (and therefore from meal_windows rows created by the admin or auto-created below).
 *
 * Jobs:
 *   1. Auto-create today's meal_windows rows from meal_templates (if missing)
 *   2. Open windows whose start_time has passed (status: upcoming → open)
 *   3. Close windows whose end_time has passed (status: open → closed)
 *   4. Archive closed window attendance rows → attendance_archive, then clean hot table
 */

async function autoCreateTodayWindows(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { data: templates } = await supabase
    .from('meal_templates')
    .select('*')
    .eq('is_enabled', true);

  if (!templates || templates.length === 0) return;

  for (const tmpl of templates) {
    // Check if window already exists for today
    const { data: existing } = await supabase
      .from('meal_windows')
      .select('id')
      .eq('meal_type', tmpl.meal_type)
      .eq('date', today)
      .maybeSingle();

    if (existing) continue;

    // Build TIMESTAMPTZ from today's date + template time
    const startTime = new Date(`${today}T${tmpl.start_time}`).toISOString();
    const endTime = new Date(`${today}T${tmpl.end_time}`).toISOString();

    await supabase.from('meal_windows').insert({
      meal_type: tmpl.meal_type,
      date: today,
      start_time: startTime,
      end_time: endTime,
      status: 'upcoming',
    });
  }
}

async function openDueWindows(): Promise<void> {
  const now = new Date().toISOString();

  const { data: toOpen } = await supabase
    .from('meal_windows')
    .select('id')
    .eq('status', 'upcoming')
    .lte('start_time', now);

  if (!toOpen || toOpen.length === 0) return;

  const ids = toOpen.map((w) => w.id);
  await supabase.from('meal_windows').update({ status: 'open' }).in('id', ids);

  console.log(`[cron] Opened ${ids.length} meal window(s):`, ids);
}

async function closeExpiredWindows(): Promise<void> {
  const now = new Date().toISOString();

  const { data: toClose } = await supabase
    .from('meal_windows')
    .select('id')
    .eq('status', 'open')
    .lte('end_time', now);

  if (!toClose || toClose.length === 0) return;

  const ids = toClose.map((w) => w.id);
  await supabase.from('meal_windows').update({ status: 'closed' }).in('id', ids);

  console.log(`[cron] Closed ${ids.length} meal window(s):`, ids);

  // Trigger archive immediately after closing
  for (const id of ids) {
    await archiveWindow(id);
  }
}

async function archiveWindow(mealWindowId: string): Promise<void> {
  // Copy rows from hot attendance → archive
  const { data: rows } = await supabase
    .from('attendance')
    .select('*')
    .eq('meal_window_id', mealWindowId);

  if (!rows || rows.length === 0) return;

  const archiveRows = rows.map((r) => ({
    id: r.id,
    student_id: r.student_id,
    meal_window_id: r.meal_window_id,
    scanned_at: r.scanned_at,
    scanned_by: r.scanned_by,
    is_manual: r.is_manual,
    override_note: r.override_note,
  }));

  const { error: insertError } = await supabase
    .from('attendance_archive')
    .insert(archiveRows);

  if (insertError) {
    console.error('[cron] Archive insert error:', insertError);
    return;
  }

  // Delete from hot table only after successful archive
  const { error: deleteError } = await supabase
    .from('attendance')
    .delete()
    .eq('meal_window_id', mealWindowId);

  if (deleteError) {
    console.error('[cron] Hot table cleanup error:', deleteError);
    return;
  }

  console.log(`[cron] Archived ${rows.length} attendance rows for window ${mealWindowId}`);
}

/**
 * Start all cron jobs.
 * Called once at server startup.
 */
export function startMealCron(): void {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      await autoCreateTodayWindows();
      await openDueWindows();
      await closeExpiredWindows();
    } catch (err) {
      console.error('[cron] Unhandled error:', err);
    }
  });

  console.log('[cron] Meal lifecycle cron started (runs every minute).');
}
