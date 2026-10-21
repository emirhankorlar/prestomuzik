// Presto Müzik — bağımlılıksız Node sunucusu.
// İçerik data/content.json'da durur, yüklenen dosyalar public/uploads'a gider.
// Çalıştır: node server.js   (PORT ve ADMIN_PASSWORD ortam değişkenleri opsiyonel)

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const spotify = require('./lib/spotify');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const UPLOADS = path.join(PUBLIC, 'uploads');
const DATA = path.join(ROOT, 'data');
const CONTENT = path.join(DATA, 'content.json');
const AUTH = path.join(DATA, 'auth.json');
const BACKUPS = path.join(DATA, 'backups');
const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY = 25 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
const UPLOAD_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp3', '.m4a', '.wav', '.mp4']);

/* ---------- auth ---------- */

function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') };
}

function loadAuth() {
  if (!fs.existsSync(AUTH)) {
    const initial = process.env.ADMIN_PASSWORD || 'presto2026';
    const auth = { ...hashPassword(initial), secret: crypto.randomBytes(32).toString('hex') };
    fs.mkdirSync(DATA, { recursive: true });
    fs.writeFileSync(AUTH, JSON.stringify(auth, null, 2));
    console.log(`[auth] Admin şifresi oluşturuldu: ${initial}  (admin panelinden değiştirin)`);
  }
  return JSON.parse(fs.readFileSync(AUTH, 'utf8'));
}
let auth = loadAuth();

function checkPassword(pw) {
  const { hash } = hashPassword(String(pw || ''), auth.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(auth.hash, 'hex'));
}

function signToken(exp) {
  const payload = `${exp}`;
  const sig = crypto.createHmac('sha256', auth.secret + auth.hash).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function isAuthed(req) {
  const m = /(?:^|;\s*)pm_admin=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const [exp, sig] = decodeURIComponent(m[1]).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = signToken(exp).split('.')[1];
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}

/* ---------- helpers ---------- */

function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, { 'Content-Type': isObj ? MIME['.json'] : 'text/plain; charset=utf-8', ...headers });
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('Dosya çok büyük (en fazla 25MB)'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(Object.assign(new Error('Geçersiz JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

const { slugify } = spotify;

async function writeContent(content) {
  await fsp.mkdir(BACKUPS, { recursive: true });
  if (fs.existsSync(CONTENT)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fsp.copyFile(CONTENT, path.join(BACKUPS, `content-${stamp}.json`));
    const old = (await fsp.readdir(BACKUPS)).filter((f) => f.endsWith('.json')).sort();
    for (const f of old.slice(0, Math.max(0, old.length - 30))) await fsp.unlink(path.join(BACKUPS, f));
  }
  const tmp = CONTENT + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(content, null, 2));
  await fsp.rename(tmp, CONTENT);
}

// Spotify içe aktarma: dosyalar public/uploads'a yazılır
async function saveUpload(name, buffer) {
  await fsp.mkdir(UPLOADS, { recursive: true });
  await fsp.writeFile(path.join(UPLOADS, name), buffer);
  return `uploads/${name}`;
}
const importSpotifyArtist = (input, { slug } = {}) => spotify.importSpotifyArtist(input, { slug, save: saveUpload });

/* ---------- api ---------- */

async function api(req, res, pathname) {
  if (pathname === '/api/content' && req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 200, JSON.parse(await fsp.readFile(CONTENT, 'utf8')));
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    const { password } = await readBody(req);
    if (!checkPassword(password)) return send(res, 401, { error: 'Şifre yanlış' });
    const exp = Date.now() + 1000 * 60 * 60 * 24 * 7;
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    return send(res, 200, { ok: true }, {
      'Set-Cookie': `pm_admin=${encodeURIComponent(signToken(exp))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure}`,
    });
  }

  if (pathname === '/api/logout') {
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'pm_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }

  if (pathname === '/api/me') return send(res, 200, { authed: isAuthed(req) });

  if (!isAuthed(req)) return send(res, 401, { error: 'Oturum gerekli' });

  if (pathname === '/api/content' && req.method === 'PUT') {
    const body = await readBody(req);
    if (!body || typeof body !== 'object' || !body.site || !Array.isArray(body.artists)) {
      return send(res, 400, { error: 'İçerik formatı bozuk' });
    }
    await writeContent(body);
    return send(res, 200, { ok: true });
  }

  if (pathname === '/api/upload' && req.method === 'POST') {
    const { name, data } = await readBody(req);
    const ext = path.extname(String(name || '')).toLowerCase();
    if (!UPLOAD_EXT.has(ext)) return send(res, 400, { error: 'Bu dosya türü desteklenmiyor' });
    const b64 = String(data || '').replace(/^data:[^;]+;base64,/, '');
    const file = `${slugify(path.basename(name, ext))}-${crypto.randomBytes(3).toString('hex')}${ext}`;
    await fsp.mkdir(UPLOADS, { recursive: true });
    await fsp.writeFile(path.join(UPLOADS, file), Buffer.from(b64, 'base64'));
    return send(res, 200, { url: `uploads/${file}` });
  }

  if (pathname === '/api/spotify' && req.method === 'POST') {
    const { url, slug } = await readBody(req);
    return send(res, 200, await importSpotifyArtist(url, { slug }));
  }

  if (pathname === '/api/password' && req.method === 'POST') {
    const { current, next } = await readBody(req);
    if (!checkPassword(current)) return send(res, 400, { error: 'Mevcut şifre yanlış' });
    if (!next || String(next).length < 6) return send(res, 400, { error: 'Yeni şifre en az 6 karakter olmalı' });
    auth = { ...auth, ...hashPassword(String(next)) };
    await fsp.writeFile(AUTH, JSON.stringify(auth, null, 2));
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'pm_admin=; Path=/; Max-Age=0' });
  }

  return send(res, 404, { error: 'Bulunamadı' });
}

/* ---------- static ---------- */

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  // eski adresler: /admin ve /sanatci/<slug> → göreli yollarla çalışan sayfalara yönlendir
  const old = /^\/sanatci\/([^/]+)\/?$/.exec(rel);
  if (old) { res.writeHead(301, { Location: `/artist.html?id=${encodeURIComponent(old[1])}` }); return res.end(); }
  if (rel === '/admin' || rel === '/admin/') { res.writeHead(302, { Location: '/admin.html' }); return res.end(); }
  if (rel === '/') rel = '/index.html';

  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'Yasak');

  let stat;
  try { stat = await fsp.stat(file); } catch { stat = null; }
  if (!stat || !stat.isFile()) {
    const notFound = await fsp.readFile(path.join(PUBLIC, 'index.html'));
    return send(res, 404, notFound, { 'Content-Type': MIME['.html'] });
  }

  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const longCache = rel.startsWith('/uploads/') || rel.startsWith('/vendor/') || rel.startsWith('/assets/');
  const headers = {
    'Content-Type': type,
    'Cache-Control': longCache ? 'public, max-age=604800' : 'no-cache',
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
  };

  // Ses/video için Range desteği (seek için gerekli)
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

/* ---------- boot ---------- */

if (require.main === module) {
  http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://x');
    try {
      if (pathname.startsWith('/api/')) await api(req, res, pathname);
      else await serveStatic(req, res, pathname);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) send(res, err.status || 500, { error: err.message || 'Sunucu hatası' });
    }
  }).listen(PORT, () => console.log(`Presto Müzik → http://localhost:${PORT}   (admin: /admin)`));
}

module.exports = { importSpotifyArtist, slugify };
