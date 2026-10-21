// Spotify'ın herkese açık embed sayfasından sanatçı adı, fotoğraf ve popüler şarkılar (30 sn önizlemeleriyle) çekilir.
// Dosyaların nereye kaydedileceğine çağıran karar verir: save(ad, buffer, contentType) → url
// (yerel sunucuda diske, Vercel'de Blob deposuna).

function slugify(s) {
  const map = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u' };
  return String(s || '').replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => map[c]).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'dosya';
}

async function importSpotifyArtist(input, { slug, save }) {
  const id = (/artist[/:]([A-Za-z0-9]{22})/.exec(input) || /^([A-Za-z0-9]{22})$/.exec(String(input || '').trim()) || [])[1];
  if (!id) throw Object.assign(new Error('Geçerli bir Spotify sanatçı linki girin'), { status: 400 });
  const html = await (await fetch(`https://open.spotify.com/embed/artist/${id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
  const m = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s.exec(html);
  if (!m) throw new Error('Spotify sayfası okunamadı');
  const entity = JSON.parse(m[1]).props.pageProps.state.data.entity;
  const name = entity.name || entity.title;
  const base = slug ? slugify(slug) : slugify(name);

  // indirilemezse orijinal Spotify adresi kullanılır
  const download = async (url, file) => {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) return url;
      const type = r.headers.get('content-type') || 'image/jpeg';
      const ext = type.includes('png') ? '.png' : type.includes('webp') ? '.webp' : type.includes('audio') ? '.mp3' : '.jpg';
      return await save(`${file}${ext}`, Buffer.from(await r.arrayBuffer()), type);
    } catch {
      return url;
    }
  };

  const images = (entity.visualIdentity && entity.visualIdentity.image) || [];
  const biggest = images.slice().sort((a, b) => (b.maxWidth || 0) - (a.maxWidth || 0))[0];

  // tüm indirmeler paralel (Vercel'de süre sınırı var)
  const [image, ...tracks] = await Promise.all([
    biggest ? download(biggest.url, `${base}-spotify`) : '',
    ...(entity.trackList || []).map(async (t) => {
      const trackId = (t.uri || '').split(':').pop();
      const file = `${base}-${slugify(t.title)}`;
      const coverUrl = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`)
        .then((r) => r.json()).then((o) => o.thumbnail_url).catch(() => '');
      const [preview, cover] = await Promise.all([
        t.audioPreview && t.audioPreview.url ? download(t.audioPreview.url, `${file}-preview`) : '',
        coverUrl ? download(coverUrl, `${file}-cover`) : '',
      ]);
      return { title: t.title, artists: t.subtitle || name, spotifyId: trackId, duration: Math.round((t.duration || 0) / 1000), preview, cover };
    }),
  ]);
  return { name, spotifyId: id, image, tracks };
}

module.exports = { importSpotifyArtist, slugify };
