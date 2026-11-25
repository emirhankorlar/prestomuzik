const fs = require('fs');
const path = require('path');
const { readContent } = require('../lib/store');
const { renderArtistPage, originOf } = require('../lib/seo');

module.exports = async (req, res) => {
  try {
    const html = fs.readFileSync(path.join(process.cwd(), 'public', 'artist.html'), 'utf8');
    const out = renderArtistPage(html, await readContent(), String(req.query.id || ''), originOf(req));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.status(200).send(out);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sunucu hatası');
  }
};
