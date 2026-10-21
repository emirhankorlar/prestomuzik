// Vercel'de şifre ortam değişkeninde durduğu için panelden değiştirilemez.
module.exports = (req, res) => {
  res.status(400).json({ error: 'Şifre Vercel panelinden değiştirilir: Settings → Environment Variables → ADMIN_PASSWORD, ardından Redeploy.' });
};
