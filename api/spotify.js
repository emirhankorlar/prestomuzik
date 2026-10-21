const { importSpotifyArtist } = require('../lib/spotify');
const { saveFile } = require('../lib/store');
const { requireAuth } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'İzin verilmiyor' });
  if (!requireAuth(req, res)) return;
  try {
    const { url, slug } = req.body || {};
    res.status(200).json(await importSpotifyArtist(url, { slug, save: saveFile }));
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Spotify verisi alınamadı' });
  }
};
