require('dotenv').config();
const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3105);
const BASE_URL = (process.env.APP_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const ADMIN_KEY = process.env.ADMIN_KEY || 'change-me';
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 50);

if (process.env.NODE_ENV === 'production' && ADMIN_KEY === 'change-me') {
  console.error('FATAL: ADMIN_KEY wajib diganti pada production.');
  process.exit(1);
}

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'documents.json');
const UPLOAD_DIR = path.join(ROOT, 'uploads');

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(ROOT, 'public')));

function safeText(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function cleanFileName(name) {
  return String(name || 'document')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 140);
}

function makeId() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `DOC-${y}${m}${day}-${suffix}`;
}

async function readDb() {
  try {
    const raw = await fsp.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeDb(data) {
  const tmp = DATA_FILE + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(tmp, DATA_FILE);
}

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.body?.adminKey;
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, message: 'Admin key salah.' });
  }
  next();
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = new Set(['.pdf', '.ppt', '.pptx', '.doc', '.docx', '.xls', '.xlsx', '.zip']);
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowed.has(ext)) return cb(new Error('Tipe file tidak didukung.'));
    cb(null, true);
  }
});

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'QRsign', time: new Date().toISOString() });
});

app.post('/api/documents', requireAdmin, async (req, res) => {
  const title = safeText(req.body.title, 200);
  if (!title) return res.status(400).json({ ok: false, message: 'Judul dokumen wajib diisi.' });

  const docs = await readDb();
  let id;
  do { id = makeId(); } while (docs.some(d => d.id === id));

  const now = new Date().toISOString();
  const doc = {
    id,
    title,
    documentNumber: safeText(req.body.documentNumber, 100),
    issuer: safeText(req.body.issuer, 160),
    description: safeText(req.body.description, 500),
    status: 'DRAFT',
    verificationUrl: `${BASE_URL}/verify/${encodeURIComponent(id)}`,
    file: null,
    sha256: null,
    createdAt: now,
    finalizedAt: null,
    revokedAt: null,
    revokeReason: null
  };

  docs.unshift(doc);
  await writeDb(docs);
  res.json({ ok: true, document: doc, qrUrl: `${BASE_URL}/qr/${encodeURIComponent(id)}.png` });
});

app.post('/api/documents/:id/finalize', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: 'File final wajib dipilih.' });

    const docs = await readDb();
    const idx = docs.findIndex(d => d.id === req.params.id);
    if (idx < 0) {
      await fsp.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ ok: false, message: 'Dokumen tidak ditemukan.' });
    }
    if (docs[idx].status === 'FINAL') {
      await fsp.unlink(req.file.path).catch(() => {});
      return res.status(409).json({ ok: false, message: 'Dokumen sudah difinalisasi dan dikunci.' });
    }
    if (docs[idx].status === 'REVOKED') {
      await fsp.unlink(req.file.path).catch(() => {});
      return res.status(409).json({ ok: false, message: 'Dokumen sudah dicabut.' });
    }

    const hash = await sha256File(req.file.path);
    docs[idx].status = 'FINAL';
    docs[idx].sha256 = hash;
    docs[idx].file = {
      storedName: req.file.filename,
      originalName: cleanFileName(req.file.originalname),
      mimeType: req.file.mimetype,
      size: req.file.size
    };
    docs[idx].finalizedAt = new Date().toISOString();
    await writeDb(docs);

    res.json({ ok: true, document: docs[idx] });
  } catch (err) {
    if (req.file?.path) await fsp.unlink(req.file.path).catch(() => {});
    res.status(500).json({ ok: false, message: err.message || 'Gagal finalisasi.' });
  }
});

app.post('/api/documents/:id/revoke', requireAdmin, async (req, res) => {
  const docs = await readDb();
  const idx = docs.findIndex(d => d.id === req.params.id);
  if (idx < 0) return res.status(404).json({ ok: false, message: 'Dokumen tidak ditemukan.' });
  docs[idx].status = 'REVOKED';
  docs[idx].revokedAt = new Date().toISOString();
  docs[idx].revokeReason = safeText(req.body.reason, 300) || 'Dokumen dicabut oleh administrator.';
  await writeDb(docs);
  res.json({ ok: true, document: docs[idx] });
});

app.get('/api/documents/:id', async (req, res) => {
  const docs = await readDb();
  const doc = docs.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ ok: false, message: 'Dokumen tidak ditemukan.' });
  res.json({ ok: true, document: doc });
});

app.get('/qr/:id.png', async (req, res) => {
  const docs = await readDb();
  const doc = docs.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).send('Not found');
  try {
    const png = await QRCode.toBuffer(doc.verificationUrl, {
      width: 720,
      margin: 2,
      errorCorrectionLevel: 'H'
    });
    res.type('png').send(png);
  } catch {
    res.status(500).send('QR generation failed');
  }
});

app.get('/files/:id', async (req, res) => {
  const docs = await readDb();
  const doc = docs.find(d => d.id === req.params.id);
  if (!doc || !doc.file || doc.status === 'DRAFT') return res.status(404).send('File belum tersedia.');
  const filePath = path.join(UPLOAD_DIR, doc.file.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).send('File tidak ditemukan.');
  res.download(filePath, doc.file.originalName);
});

app.get('/verify/:id', (_req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'verify.html'));
});

app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ ok: false, message: `Upload gagal: ${err.message}` });
  }
  if (err) return res.status(400).json({ ok: false, message: err.message || 'Request gagal.' });
  next();
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`QRsign running on 127.0.0.1:${PORT}`);
  console.log(`Public base URL: ${BASE_URL}`);
  if (ADMIN_KEY === 'change-me') console.warn('WARNING: Ganti ADMIN_KEY sebelum production.');
});
