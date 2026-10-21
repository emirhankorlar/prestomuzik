// GitHub Actions'ta çalışır (bkz. .github/workflows/spotify-import.yml).
// Girdiler ortam değişkenlerinden okunur; sonuç data/imports/<REQUEST_ID>.json dosyasına yazılır.
const fs = require('fs');
const path = require('path');
const { importSpotifyArtist, slugify } = require('../server');

const { SPOTIFY_URL, ARTIST_SLUG, REQUEST_ID } = process.env;
if (!/^[a-z0-9]{4,40}$/.test(REQUEST_ID || '')) {
  console.error('Geçersiz istek kimliği');
  process.exit(1);
}
const out = path.join(__dirname, '..', 'data', 'imports', `${REQUEST_ID}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });

importSpotifyArtist(SPOTIFY_URL, { slug: ARTIST_SLUG ? slugify(ARTIST_SLUG) : undefined })
  .then((result) => fs.writeFileSync(out, JSON.stringify(result, null, 2)))
  .catch((err) => {
    console.error(err);
    fs.writeFileSync(out, JSON.stringify({ error: err.message || 'Spotify verisi alınamadı' }));
  });
