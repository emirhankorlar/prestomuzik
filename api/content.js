const { readContent, writeContent } = require('../lib/store');
const { requireAuth } = require('../lib/auth');

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      // ziyaretçiler için kısa süreli kenar önbelleği; admin ?fresh=1 ile her zaman son hali alır
      res.setHeader('Cache-Control', req.query.fresh ? 'no-store' : 'public, s-maxage=15, stale-while-revalidate=60');
      return res.status(200).json(await readContent());
    }
    if (req.method === 'PUT') {
      if (!requireAuth(req, res)) return;
      const body = req.body;
      if (!body || typeof body !== 'object' || !body.site || !Array.isArray(body.artists)) {
        return res.status(400).json({ error: 'İçerik formatı bozuk' });
      }
      await writeContent(body);
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'İzin verilmiyor' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Sunucu hatası' });
  }
};
