require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'temubalik-secret-key-change-in-production';

// Koneksi PostgreSQL / Supabase (Opsional: otomatis fallback ke memory jika belum diset)
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiting sesuai Bagian 10 design.md
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 30,
  message: { error: 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.' }
});

// Data Awal (Digunakan jika menjalankan tanpa PostgreSQL eksternal)
const db = {
  users: [
    {
      id: 'u-101',
      display_name: 'Budi Santoso',
      email: 'budi@contoh.id',
      password_hash: bcrypt.hashSync('password123', 10),
      role: 'user',
      created_at: '2025-02-10T08:00:00Z'
    },
    {
      id: 'u-mod',
      display_name: 'Moderator TemuBalik',
      email: 'mod@temubalik.id',
      password_hash: bcrypt.hashSync('password123', 10),
      role: 'moderator',
      created_at: '2025-02-01T08:00:00Z'
    }
  ],
  reports: [
    {
      id: 'rpt-8f92a1',
      owner_id: 'u-101',
      type: 'lost',
      title: 'Dompet Kulit Cokelat Tua di Sekitar Stasiun Tebet',
      category: 'Tas & Dompet',
      public_description: 'Kehilangan dompet lipat kulit warna cokelat tua saat jam pulang kerja. Di dalamnya terdapat kartu transportasi dan beberapa kartu penting.',
      private_verification_notes: 'Ada foto anak kecil di slot kiri dan stiker inisial BS di balik tempat uang kertas.',
      city: 'Jakarta Selatan',
      area_label: 'Pintu Barat Stasiun KRL Tebet',
      incident_date: '2025-02-24',
      status: 'active',
      image_url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&auto=format&fit=crop&q=60',
      created_at: '2025-02-24T14:20:00Z',
      updated_at: '2025-02-24T14:20:00Z'
    },
    {
      id: 'rpt-3c71b9',
      owner_id: 'u-mod',
      type: 'found',
      title: 'Kunci Motor Honda dengan Gantungan Karakter',
      category: 'Kunci',
      public_description: 'Ditemukan kunci motor Honda keyless di kursi taman dekat perpustakaan pusat. Saat ini diamankan di pos keamanan.',
      private_verification_notes: 'Gantungan karet karakter warna kuning dengan nomor loker 14.',
      city: 'Bandung',
      area_label: 'Sekitar Perpustakaan Kampus Ganesha',
      incident_date: '2025-02-25',
      status: 'active',
      image_url: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=600&auto=format&fit=crop&q=60',
      created_at: '2025-02-25T09:10:00Z',
      updated_at: '2025-02-25T09:10:00Z'
    }
  ],
  claims: [],
  moderation_logs: []
};

// Middleware Autentikasi Opsional & Wajib
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Autentikasi diperlukan' });

  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir' });
  }
}

function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    } catch { /* abaikan jika token kadaluarsa pada endpoint publik */ }
  }
  next();
}

// Hapus private_verification_notes untuk pengunjung umum (Bagian 9 & 10 design.md)
function sanitizeReport(report, reqUser) {
  const isOwnerOrMod = reqUser && (reqUser.id === report.owner_id || reqUser.role === 'moderator');
  if (isOwnerOrMod) return report;

  const { private_verification_notes, ...publicSafeReport } = report;
  return publicSafeReport;
}

// ==================== ENDPOINT AUTENTIKASI ====================
app.post('/api/auth/register', writeLimiter, async (req, res) => {
  const { display_name, email, password } = req.body;
  if (!display_name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Nama, email, dan kata sandi (min. 6 karakter) wajib diisi.' });
  }

  const exists = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'Email sudah terdaftar.' });

  const newUser = {
    id: `u-${crypto.randomUUID().slice(0, 8)}`,
    display_name: display_name.trim(),
    email: email.toLowerCase().trim(),
    password_hash: await bcrypt.hash(password, 10),
    role: 'user',
    created_at: new Date().toISOString()
  };
  db.users.push(newUser);

  const token = jwt.sign({ id: newUser.id, display_name: newUser.display_name, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: { id: newUser.id, display_name: newUser.display_name, email: newUser.email, role: newUser.role } });
});

app.post('/api/auth/login', writeLimiter, async (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user || !(await bcrypt.compare(String(password || ''), user.password_hash))) {
    return res.status(401).json({ error: 'Email atau kata sandi salah.' });
  }

  const token = jwt.sign({ id: user.id, display_name: user.display_name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, display_name: user.display_name, email: user.email, role: user.role } });
});

// ==================== ENDPOINT LAPORAN ====================
app.get('/api/reports', optionalAuth, (req, res) => {
  const { type, category, city, q } = req.query;
  let results = db.reports.filter(r => r.status === 'active' || r.status === 'resolved');

  if (type) results = results.filter(r => r.type === type);
  if (category) results = results.filter(r => r.category === category);
  if (city) results = results.filter(r => r.city.toLowerCase() === city.toLowerCase());
  if (q) {
    const keyword = q.toLowerCase();
    results = results.filter(r =>
      r.title.toLowerCase().includes(keyword) ||
      r.public_description.toLowerCase().includes(keyword) ||
      r.area_label.toLowerCase().includes(keyword)
    );
  }

  // Pastikan private_verification_notes TIDAK PERNAH bocor di daftar publik
  res.json({ reports: results.map(r => sanitizeReport(r, null)) });
});

app.get('/api/reports/:id', optionalAuth, (req, res) => {
  const report = db.reports.find(r => r.id === req.params.id && r.status !== 'hidden');
  if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
  res.json({ report: sanitizeReport(report, req.user) });
});

app.post('/api/reports', authenticate, writeLimiter, (req, res) => {
  const { type, title, category, public_description, private_verification_notes, city, area_label, incident_date, image_url } = req.body;

  // Validasi Sisi Server sesuai Bagian 8 design.md
  if (!['lost', 'found'].includes(type)) return res.status(400).json({ error: 'Jenis laporan tidak valid.' });
  if (!title || title.length < 5 || title.length > 100) return res.status(400).json({ error: 'Judul wajib 5–100 karakter.' });
  if (!public_description || public_description.length < 20 || public_description.length > 1000) {
    return res.status(400).json({ error: 'Deskripsi publik wajib 20–1.000 karakter.' });
  }
  if (!private_verification_notes || private_verification_notes.length < 5) {
    return res.status(400).json({ error: 'Ciri khusus verifikasi rahasia wajib diisi.' });
  }

  const newReport = {
    id: `rpt-${crypto.randomUUID().slice(0, 8)}`,
    owner_id: req.user.id,
    type,
    title: title.trim(),
    category,
    public_description: public_description.trim(),
    private_verification_notes: private_verification_notes.trim(),
    city,
    area_label: area_label.trim(),
    incident_date,
    status: 'active',
    image_url: image_url || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.reports.unshift(newReport);
  res.status(201).json({ report: newReport });
});

app.patch('/api/reports/:id/status', authenticate, (req, res) => {
  const report = db.reports.find(r => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
  if (report.owner_id !== req.user.id && req.user.role !== 'moderator') {
    return res.status(403).json({ error: 'Anda tidak berhak mengubah laporan ini.' });
  }

  report.status = req.body.status === 'resolved' ? 'resolved' : report.status;
  report.updated_at = new Date().toISOString();
  res.json({ report });
});

app.post('/api/reports/:id/flag', optionalAuth, writeLimiter, (req, res) => {
  const report = db.reports.find(r => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan.' });

  report.status = 'pending_review';
  db.moderation_logs.unshift({
    id: `log-${crypto.randomUUID().slice(0, 8)}`,
    moderator_id: req.user ? req.user.id : 'visitor',
    report_id: report.id,
    action: 'flagged_by_user',
    reason: req.body.reason || 'Dilaporkan pengguna',
    created_at: new Date().toISOString()
  });

  res.json({ message: 'Laporan masuk ke antrean peninjauan moderator.' });
});

// ==================== ENDPOINT KLAIM & DASHBOARD ====================
app.post('/api/reports/:id/claims', authenticate, writeLimiter, (req, res) => {
  const report = db.reports.find(r => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
  if (report.owner_id === req.user.id) return res.status(400).json({ error: 'Tidak dapat mengklaim laporan sendiri.' });

  const claim = {
    id: `clm-${crypto.randomUUID().slice(0, 8)}`,
    report_id: report.id,
    claimant_id: req.user.id,
    claimant_name: req.user.display_name,
    message: String(req.body.message || '').trim(),
    verification_status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.claims.unshift(claim);
  res.status(201).json({ claim });
});

app.get('/api/dashboard', authenticate, (req, res) => {
  const myReports = db.reports.filter(r => r.owner_id === req.user.id);
  const myReportIds = new Set(myReports.map(r => r.id));

  const incomingClaims = db.claims
    .filter(c => myReportIds.has(c.report_id))
    .map(c => {
      const rpt = db.reports.find(r => r.id === c.report_id);
      return {
        ...c,
        report_title: rpt ? rpt.title : '',
        private_verification_notes: rpt ? rpt.private_verification_notes : ''
      };
    });

  const myClaims = db.claims.filter(c => c.claimant_id === req.user.id);
  res.json({ myReports, incomingClaims, myClaims });
});

app.patch('/api/claims/:id/verify', authenticate, (req, res) => {
  const claim = db.claims.find(c => c.id === req.params.id);
  if (!claim) return res.status(404).json({ error: 'Klaim tidak ditemukan.' });

  const report = db.reports.find(r => r.id === claim.report_id);
  if (!report || report.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Hanya pemilik laporan yang dapat memverifikasi klaim.' });
  }

  claim.verification_status = ['approved', 'rejected'].includes(req.body.verification_status)
    ? req.body.verification_status
    : 'pending';
  claim.updated_at = new Date().toISOString();

  res.json({ claim });
});

// ==================== ENDPOINT MODERASI ====================
app.get('/api/moderation/queue', authenticate, (req, res) => {
  if (req.user.role !== 'moderator') {
    return res.status(403).json({ error: 'Akses khusus moderator.' });
  }
  const queue = db.reports.filter(r => r.status === 'pending_review' || r.status === 'hidden');
  res.json({ queue, logs: db.moderation_logs });
});

app.post('/api/moderation/action', authenticate, (req, res) => {
  if (req.user.role !== 'moderator') {
    return res.status(403).json({ error: 'Akses khusus moderator.' });
  }
  const { report_id, action, reason } = req.body;
  const report = db.reports.find(r => r.id === report_id);
  if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan.' });

  report.status = action === 'approve' ? 'active' : 'hidden';
  report.updated_at = new Date().toISOString();

  db.moderation_logs.unshift({
    id: `log-${crypto.randomUUID().slice(0, 8)}`,
    moderator_id: req.user.id,
    report_id,
    action,
    reason: reason || 'Tindakan moderasi',
    created_at: new Date().toISOString()
  });

  res.json({ report });
});

// Fallback ke index.html untuk SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`TemuBalik server berjalan di http://localhost:${PORT}`);
});