const path = require('path');
const crypto = require('crypto');
const { saveFile } = require('../lib/store');
const { requireAuth } = require('../lib/auth');
const { slugify } = require('../lib/spotify');

const TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.mp4': 'video/mp4',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'İzin verilmiyor' });
  if (!requireAuth(req, res)) return;
  try {
    const { name, data } = req.body || {};
    const ext = path.extname(String(name || '')).toLowerCase();
    if (!TYPES[ext]) return res.status(400).json({ error: 'Bu dosya türü desteklenmiyor' });
    const buffer = Buffer.from(String(data || '').replace(/^data:[^;]+;base64,/, ''), 'base64');
    const file = `${slugify(path.basename(name, ext))}-${crypto.randomBytes(3).toString('hex')}${ext}`;
    res.status(200).json({ url: await saveFile(file, buffer, TYPES[ext]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Yükleme başarısız' });
  }
};
