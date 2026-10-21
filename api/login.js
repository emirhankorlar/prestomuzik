const { checkPassword, sessionCookie } = require('../lib/auth');

module.exports = (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'İzin verilmiyor' });
  if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD Vercel ayarlarında tanımlı değil' });
  if (!checkPassword(req.body && req.body.password)) return res.status(401).json({ error: 'Şifre yanlış' });
  res.setHeader('Set-Cookie', sessionCookie());
  res.status(200).json({ ok: true });
};
