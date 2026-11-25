// Paylaşım (WhatsApp, Instagram, Google) için sunucu tarafında sanatçı sayfası etiketleri ve site haritası.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const abs = (origin, u) => (!u ? '' : /^https?:/.test(u) ? u : `${origin}/${String(u).replace(/^\//, '')}`);

function renderArtistPage(html, content, slug, origin) {
  const a = (content.artists || []).find((x) => x.slug === slug);
  // göreli yollar /sanatci/<ad> altında da çalışsın
  let out = html.replace('<head>', '<head>\n  <base href="/">');
  if (!a) return out;
  const title = `${a.name} — Presto Müzik`;
  const desc = (a.bio?.[0] || a.tagline || `${a.name}, Presto Müzik sanatçısı.`).slice(0, 200);
  const img = abs(origin, a.image || a.tracks?.[0]?.cover);
  const url = `${origin}/sanatci/${encodeURIComponent(a.slug)}`;
  const tags = [
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="profile">`,
    `<meta property="og:site_name" content="Presto Müzik">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    img && `<meta property="og:image" content="${esc(img)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].filter(Boolean).join('\n  ');
  return out
    .replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${esc(desc)}">`)
    .replace('</head>', `  ${tags}\n</head>`);
}

function sitemap(content, origin) {
  const urls = [origin + '/', ...(content.artists || []).map((a) => `${origin}/sanatci/${encodeURIComponent(a.slug)}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`;
}

const originOf = (req) => `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`;

module.exports = { renderArtistPage, sitemap, originOf };
