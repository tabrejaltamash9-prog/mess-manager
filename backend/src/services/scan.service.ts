import { supabase } from '../config/supabase';
import { verifyQrPayload } from '../utils/qrSigner';

export interface ScanResult {
  success: boolean;
  reason?: string;        // for failures
  student?: {
    id: string;
    name: string;
    roll_no: string;
    email: string;
    department: string | null;
    hostel_block: string | null;
    photo_url: string | null;
  };
  scanned_at?: string;    // ISO string of when the scan was recorded
  already_scanned_at?: string; // if already taken
}

/**
 * Core scan verification — the single source of trust.
 * Called when staff scan a student QR code.
 */
export async function verifyScan(
  qrString: string,
  staffId: string
): Promise<ScanResult> {
  // ── Step 1: Verify QR signature ─────────────────────────────────────
  let payload: { student_id: string; meal_window_id: string; issued_at: number };
  try {
    payload = verifyQrPayload(qrString);
  } catch (err: any) {
    return { success: false, reason: err.message ?? 'Invalid QR code.' };
  }

  const { student_id, meal_window_id } = payload;

  // ── Step 2: Check meal window is currently OPEN ──────────────────────
  const { data: window, error: windowError } = await supabase
    .from('meal_windows')
    .select('id, meal_type, status, start_time, end_time')
    .eq('id', meal_window_id)
    .single();

  if (windowError || !window) {
    return { success: false, reason: 'Meal window not found.' };
  }

  if (window.status !== 'open') {
    const statusMsg =
      window.status === 'upcoming'
        ? `Meal window hasn't opened yet.`
        : `Meal window is closed.`;
    return { success: false, reason: statusMsg };
  }

  // ── Step 3: Check if student has already eaten this meal ─────────────
  const { data: existing } = await supabase
    .from('attendance')
    .select('scanned_at')
    .eq('student_id', student_id)
    .eq('meal_window_id', meal_window_id)
    .maybeSingle();

  if (existing) {
    const time = new Date(existing.scanned_at).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
    return {
      success: false,
      reason: `Meal already taken at ${time}.`,
      already_scanned_at: existing.scanned_at,
    };
  }

  // ── Step 4: Fetch student info (for photo display on staff screen) ───
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, name, roll_no, email, department, hostel_block, photo_url, is_active')
    .eq('id', student_id)
    .single();

  if (studentError || !student) {
    return { success: false, reason: 'Student not found.' };
  }

  if (!student.is_active) {
    return { success: false, reason: 'Student account is deactivated.' };
  }

  // ── Step 5: Insert attendance row ────────────────────────────────────
  // The UNIQUE(student_id, meal_window_id) constraint is the final safety net.
  // Even if two scanners hit this simultaneously, only one INSERT wins.
  const { data: record, error: insertError } = await supabase
    .from('attendance')
    .insert({
      student_id,
      meal_window_id,
      scanned_by: staffId,
      is_manual: false,
    })
    .select('scanned_at')
    .single();

  if (insertError) {
    // Postgres unique violation code = 23505
    if (insertError.code === '23505') {
      return {
        success: false,
        reason: 'Meal already taken (race condition prevented by database).',
      };
    }
    console.error('[scan] DB insert error:', insertError);
    return { success: false, reason: 'Server error. Please try again.' };
  }

  // ── Step 6: Return success + student info for photo verification ─────
  return {
    success: true,
    scanned_at: record.scanned_at,
    student: {
      id: student.id,
      name: student.name,
      roll_no: student.roll_no,
      email: student.email,
      department: student.department,
      hostel_block: student.hostel_block,
      photo_url: student.photo_url,
    },
  };
}
