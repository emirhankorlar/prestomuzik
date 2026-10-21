// Vercel'de admin şifresi ADMIN_PASSWORD ortam değişkeninden gelir.
// Oturum: imzalı, HttpOnly çerez (7 gün). Şifre değişince eski oturumlar geçersiz olur.
const crypto = require('crypto');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const key = () => `${process.env.SESSION_SECRET || process.env.BLOB_READ_WRITE_TOKEN || ''}:${process.env.ADMIN_PASSWORD || ''}`;
const sign = (exp) => crypto.createHmac('sha256', key()).update(String(exp)).digest('hex');

function checkPassword(pw) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return crypto.timingSafeEqual(sha(pw || ''), sha(expected));
}

function isAuthed(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const m = /(?:^|;\s*)pm_admin=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const [exp, sig] = decodeURIComponent(m[1]).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}

function sessionCookie() {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 7;
  return `pm_admin=${encodeURIComponent(`${exp}.${sign(exp)}`)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`;
}

const clearCookie = 'pm_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';

// yetkisizse 401 döner ve false verir
function requireAuth(req, res) {
  if (isAuthed(req)) return true;
  res.status(401).json({ error: 'Oturum gerekli' });
  return false;
}

module.exports = { checkPassword, isAuthed, sessionCookie, clearCookie, requireAuth };
