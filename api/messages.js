const { saveMessage, listMessages, deleteMessage } = require('../lib/store');
const { requireAuth } = require('../lib/auth');
const { cleanMessage } = require('../lib/messages');

// POST: ziyaretçi formu (herkese açık) · GET / DELETE: yönetim paneli
module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const { msg, error, spam } = cleanMessage(req.body);
      if (error) return res.status(400).json({ error });
      if (!spam) await saveMessage(msg);
      return res.status(200).json({ ok: true });
    }
    if (!requireAuth(req, res)) return;
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET') return res.status(200).json(await listMessages());
    if (req.method === 'DELETE') {
      await deleteMessage(req.body && req.body.id);
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'İzin verilmiyor' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Sunucu hatası' });
  }
};
