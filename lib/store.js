// Vercel'de içerik ve yüklenen dosyalar Vercel Blob deposunda tutulur.
// content.json sabit adda üzerine yazılır; her kayıtta backups/ altına bir kopya da alınır.
const { put, head } = require('@vercel/blob');
const seed = require('../data/content.json');

// depo kimliği: OIDC bağlantısında BLOB_STORE_ID (store_<depoId>), eski usulde token (vercel_blob_rw_<depoId>_<gizli>)
// → genel adres https://<depoId>.public.blob.vercel-storage.com
const hasBlob = () => !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
const storeBase = () => {
  const id = (process.env.BLOB_STORE_ID || '').replace(/^store_/, '')
    || (/^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(process.env.BLOB_READ_WRITE_TOKEN || '') || [])[1];
  return id ? `https://${id.toLowerCase()}.public.blob.vercel-storage.com` : null;
};

async function readContent() {
  if (!hasBlob()) return seed;
  const base = storeBase();
  // sorgu parametresi CDN önbelleğini atlar, her zaman son kaydı okur
  let r = base && await fetch(`${base}/content.json?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
  if (!r || !r.ok) {
    const meta = await head('content.json').catch(() => null);
    if (!meta) return seed; // henüz hiç kaydedilmemiş → repodaki ilk içerik
    r = await fetch(`${meta.url}?t=${Date.now()}`, { cache: 'no-store' });
  }
  return r.json();
}

async function writeContent(content) {
  const body = JSON.stringify(content, null, 2);
  await put('content.json', body, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await put(`backups/content-${stamp}.json`, body, { access: 'public', addRandomSuffix: true, contentType: 'application/json' }).catch(() => {});
}

async function saveFile(name, buffer, contentType) {
  const blob = await put(`uploads/${name}`, buffer, { access: 'public', addRandomSuffix: true, contentType });
  return blob.url;
}

module.exports = { readContent, writeContent, saveFile };
