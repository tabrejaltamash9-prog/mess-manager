import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { supabase } from '../config/supabase';

const router = Router();
router.use(authenticate);

// Multer: memory storage (we stream directly to Supabase Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per photo
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed.'));
      return;
    }
    cb(null, true);
  },
});

// ── GET /api/students ─────────────────────────────────────────────────────────
router.get('/', authorize('admin', 'mess_staff'), async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = req.query.search as string | undefined;
  const from = (page - 1) * limit;

  let query = supabase
    .from('students')
    .select('id, name, roll_no, email, department, hostel_block, photo_url, is_active, created_at', { count: 'exact' })
    .order('name')
    .range(from, from + limit - 1);

  if (search) {
    query = query.or(`name.ilike.%${search}%,roll_no.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    res.status(500).json({ error: 'Failed to fetch students.' });
    return;
  }

  res.json({ students: data, total: count, page, limit });
});

// ── GET /api/students/:id ─────────────────────────────────────────────────────
router.get('/:id', authorize('admin', 'mess_staff'), async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }

  res.json(data);
});

// ── POST /api/students ────────────────────────────────────────────────────────
const createStudentSchema = z.object({
  name: z.string().min(1),
  roll_no: z.string().min(1),
  email: z.string().email(),
  department: z.string().optional(),
  hostel_block: z.string().optional(),
});

router.post('/', authorize('admin'), async (req: Request, res: Response) => {
  const parsed = createStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { data, error } = await supabase
    .from('students')
    .insert({ ...parsed.data, email: parsed.data.email.toLowerCase() })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'A student with this email or roll number already exists.' });
      return;
    }
    res.status(500).json({ error: 'Failed to create student.' });
    return;
  }

  res.status(201).json(data);
});

// ── POST /api/students/bulk ───────────────────────────────────────────────────
// Admin: bulk import from CSV (parsed client-side, sent as JSON array)
const bulkStudentSchema = z.array(
  z.object({
    name: z.string().min(1),
    roll_no: z.string().min(1),
    email: z.string().email(),
    department: z.string().optional(),
    hostel_block: z.string().optional(),
  })
).min(1).max(500);

router.post('/bulk', authorize('admin'), async (req: Request, res: Response) => {
  const parsed = bulkStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid student data format.', details: parsed.error.flatten() });
    return;
  }

  const rows = parsed.data.map((s) => ({ ...s, email: s.email.toLowerCase() }));

  const { data, error } = await supabase
    .from('students')
    .upsert(rows, { onConflict: 'email', ignoreDuplicates: false })
    .select('id, name, roll_no, email');

  if (error) {
    res.status(500).json({ error: 'Bulk import failed.', detail: error.message });
    return;
  }

  res.status(201).json({ imported: data?.length ?? 0, students: data });
});

// ── POST /api/students/:id/photo ──────────────────────────────────────────────
// Admin: upload student photo → Supabase Storage
router.post(
  '/:id/photo',
  authorize('admin'),
  upload.single('photo'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'Photo file is required.' });
      return;
    }

    const { id } = req.params;

    // Verify student exists
    const { data: student } = await supabase
      .from('students')
      .select('id, roll_no')
      .eq('id', id)
      .single();

    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const ext = req.file.mimetype.split('/')[1]; // jpg, png, webp
    const filePath = `students/${student.roll_no}.${ext}`;

    // Upload to Supabase Storage bucket 'student-photos'
    const { error: uploadError } = await supabase.storage
      .from('student-photos')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true, // overwrite if re-uploading
      });

    if (uploadError) {
      console.error('[photo-upload] Storage error:', uploadError);
      res.status(500).json({ error: 'Photo upload failed.' });
      return;
    }

    // Get public URL (or signed URL if bucket is private)
    const { data: urlData } = supabase.storage
      .from('student-photos')
      .getPublicUrl(filePath);

    const photoUrl = urlData.publicUrl;

    // Update student record
    await supabase
      .from('students')
      .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
      .eq('id', id);

    res.json({ photo_url: photoUrl });
  }
);

// ── PUT /api/students/:id ─────────────────────────────────────────────────────
router.put('/:id', authorize('admin'), async (req: Request, res: Response) => {
  const { name, department, hostel_block, is_active } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (department !== undefined) updates.department = department;
  if (hostel_block !== undefined) updates.hostel_block = hostel_block;
  if (is_active !== undefined) updates.is_active = is_active;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to update student.' });
    return;
  }

  res.json(data);
});

// ── GET /api/students/me/history ──────────────────────────────────────────────
// Student: view their own meal history (last 7 days from archive)
router.get('/me/history', authorize('student'), async (req: Request, res: Response) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('attendance_archive')
    .select(`
      id,
      scanned_at,
      is_manual,
      meal_window_id,
      meal_windows!inner(meal_type, date)
    `)
    .eq('student_id', req.user!.userId)
    .gte('scanned_at', sevenDaysAgo.toISOString())
    .order('scanned_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: 'Failed to fetch history.' });
    return;
  }

  res.json(data);
});

export default router;
