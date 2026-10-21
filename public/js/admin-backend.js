// Admin paneli iki yerde çalışır:
//  - kendi Node sunucumuzda (server.js) → /api/* uçları, şifreyle giriş
//  - GitHub Pages'te → girişte kullanıcının kendi GitHub token'ı istenir; içerik GitHub API ile repoya
//    commit edilir ve site GitHub Actions ile kendini yeniden yayınlar. Token hiçbir yere yazılmaz,
//    yalnızca bu sekmenin sessionStorage'ında tutulur (sekme kapanınca silinir).

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s) => Uint8Array.from(atob(s.replace(/\s/g, '')), (c) => c.charCodeAt(0));
const fail = (msg, extra = {}) => Object.assign(new Error(msg), extra);

const slugify = (s) => String(s || '').replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u' }[c]))
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'dosya';

/* ---------- kendi sunucumuz ---------- */

function serverBackend() {
  async function api(path, opts = {}) {
    const r = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json' }, body: opts.body && JSON.stringify(opts.body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw fail(data.error || 'Hata', { status: r.status });
    return data;
  }
  return {
    mode: 'server',
    async me() { return (await api('api/me')).authed; },
    login: ({ password }) => api('api/login', { method: 'POST', body: { password } }),
    logout: () => api('api/logout'),
    load: async () => (await fetch('api/content', { cache: 'no-store' })).json(),
    save: (content) => api('api/content', { method: 'PUT', body: content }),
    async upload(file, dataUrl) { return (await api('api/upload', { method: 'POST', body: { name: file.name, data: dataUrl } })).url; },
    spotify: (url, slug) => api('api/spotify', { method: 'POST', body: { url, slug } }),
    password: (current, next) => api('api/password', { method: 'POST', body: { current, next } }),
    preview: (u) => u,
    savedMessage: 'Kaydedildi — site güncellendi',
  };
}

/* ---------- GitHub ---------- */

// emirhankorlar.github.io/prestomuzik → { owner: 'emirhankorlar', repo: 'prestomuzik' }
export function guessRepo() {
  const m = /^([^.]+)\.github\.io$/.exec(location.hostname);
  const seg = location.pathname.split('/').filter(Boolean)[0];
  return { owner: m ? m[1] : '', repo: m && seg && !seg.endsWith('.html') ? seg : '', branch: 'main' };
}

function githubBackend() {
  const SESSION = 'pm_gh_session';
  let session = null;
  try { session = JSON.parse(sessionStorage.getItem(SESSION) || 'null'); } catch { /* özel mod */ }
  let contentSha = null;
  const previews = new Map();

  const keep = (s) => { session = s; try { s ? sessionStorage.setItem(SESSION, JSON.stringify(s)) : sessionStorage.removeItem(SESSION); } catch { /* yok say */ } };

  async function gh(path, { method = 'GET', body, auth = session } = {}) {
    const r = await fetch(`https://api.github.com/repos/${auth.owner}/${auth.repo}${path}`, {
      method,
      headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: body && JSON.stringify(body),
    });
    if (r.status === 404 && method === 'GET') return null;
    const data = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (r.status === 401) { keep(null); throw fail('GitHub erişimi reddedildi — token geçersiz, süresi dolmuş ya da iptal edilmiş', { status: 401 }); }
    if (r.status === 409 || (r.status === 422 && /sha/i.test(data.message || ''))) throw fail('İçerik başka bir yerden değişmiş. Sayfayı yenileyip tekrar deneyin.');
    if (!r.ok) throw fail(`GitHub: ${data.message || r.status}`);
    return data;
  }

  const getFile = (path) => gh(`/contents/${path}?ref=${session.branch}`);
  const putFile = (path, base64, message, sha) => gh(`/contents/${path}`, { method: 'PUT', body: { message, content: base64, branch: session.branch, ...(sha ? { sha } : {}) } });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  return {
    mode: 'github',
    async me() { return !!session?.token; },

    async login({ token, owner, repo, branch }) {
      const auth = { token: token.trim(), owner: owner.trim(), repo: repo.trim(), branch: (branch || 'main').trim() };
      const info = await gh('', { auth });
      if (!info) throw fail('Repo bulunamadı ya da token bu repoya erişemiyor');
      if (!info.permissions?.push) throw fail('Bu token repoya yazma iznine sahip değil');
      keep(auth);
    },

    async logout() { keep(null); },

    async load() {
      const f = await getFile('data/content.json');
      if (!f) throw fail('data/content.json repoda bulunamadı');
      contentSha = f.sha;
      return JSON.parse(dec.decode(fromB64(f.content)));
    },

    async save(content) {
      const r = await putFile('data/content.json', toB64(enc.encode(JSON.stringify(content, null, 2))), 'İçerik güncellendi (admin)', contentSha);
      contentSha = r.content.sha;
    },

    async upload(file, dataUrl) {
      const dot = file.name.lastIndexOf('.');
      const ext = dot > 0 ? file.name.slice(dot).toLowerCase() : '';
      const name = `${slugify(file.name.slice(0, dot > 0 ? dot : undefined))}-${Math.random().toString(16).slice(2, 8)}${ext}`;
      await putFile(`public/uploads/${name}`, dataUrl.replace(/^data:[^;]+;base64,/, ''), `Dosya yüklendi: ${name}`);
      const url = `uploads/${name}`;
      previews.set(url, dataUrl);
      return url;
    },

    // Spotify tarayıcıdan okunamıyor (CORS) → GitHub Actions'taki iş çeker, sonucu data/imports/ altına yazar
    async spotify(url, slug, onStatus = () => {}) {
      const request = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      await gh('/actions/workflows/spotify-import.yml/dispatches', { method: 'POST', body: { ref: session.branch, inputs: { url, slug: slug || '', request } } });
      const path = `data/imports/${request}.json`;
      for (let i = 1; i <= 60; i++) {
        onStatus(`GitHub'da çekiliyor… ${i * 5} sn`);
        await sleep(5000);
        const f = await getFile(path);
        if (!f) continue;
        const result = JSON.parse(dec.decode(fromB64(f.content)));
        await gh(`/contents/${path}`, { method: 'DELETE', body: { message: 'Spotify içe aktarma dosyası temizlendi', sha: f.sha, branch: session.branch } }).catch(() => {});
        if (result.error) throw fail(result.error);
        return result;
      }
      throw fail('Spotify işi zaman aşımına uğradı. Repodaki Actions sekmesine bakın.');
    },

    // yeni yüklenen dosya site yeniden yayınlanana kadar repodan gösterilir
    preview(u) {
      if (!u || /^(https?:|data:)/.test(u)) return u;
      if (previews.has(u)) return previews.get(u);
      return session ? `https://raw.githubusercontent.com/${session.owner}/${session.repo}/${session.branch}/public/${u}` : u;
    },
    savedMessage: 'Kaydedildi — site ~1 dakika içinde güncellenir',
  };
}

export async function createBackend() {
  try {
    const r = await fetch('api/me', { cache: 'no-store' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) return serverBackend();
  } catch { /* sunucu yok */ }
  return githubBackend();
}
