// Presto yönetim paneli — şemadan form üretir, içeriği tek JSON olarak kaydeder.
import { createBackend, guessRepo } from './admin-backend.js';

const $ = (s, r = document) => r.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter((k) => k != null && k !== false));
  return el;
};

const slugify = (s) => String(s || '').replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u' }[c]))
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const ytId = (s) => (/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/.exec(s) || /^([\w-]{11})$/.exec(String(s).trim()) || [])[1] || String(s).trim();

let content = null;
let dirty = false;
let tab = 'artists';

const backend = await createBackend();

// oturum düşerse giriş ekranına dön
async function call(fn) {
  try { return await fn(); }
  catch (err) { if (err.status === 401) showLogin(); throw err; }
}

function toast(msg, bad = false) {
  const t = $('[data-toast]');
  t.textContent = msg;
  t.classList.toggle('bad', bad);
  t.classList.add('on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('on'), 2600);
}

function setDirty(v = true) {
  dirty = v;
  $('[data-save]').disabled = !v;
  const s = $('[data-status]');
  s.textContent = v ? '● Kaydedilmemiş değişiklik' : 'Tümü kaydedildi';
  s.classList.toggle('dirty', v);
}
addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

async function uploadFile(file) {
  if (file.size > 24 * 1024 * 1024) throw new Error('Dosya 24MB\'dan büyük olamaz');
  const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  return call(() => backend.upload(file, data));
}

/* ---------- şema ---------- */

const artistSchema = {
  type: 'object',
  fields: [
    { key: '_spotify', type: 'spotify' },
    { key: 'name', label: 'Sahne adı', type: 'text' },
    { key: 'slug', label: 'Sayfa adresi', type: 'slug', help: 'prestomuzik.com/sanatci/…' },
    { key: 'realName', label: 'Gerçek adı', type: 'text' },
    { key: 'role', label: 'Tarz / rol', type: 'text', help: 'Örn: Rap · Hip-Hop' },
    { key: 'tagline', label: 'Kısa söz / slogan', type: 'text', full: true },
    { key: 'bio', label: 'Biyografi', type: 'paragraphs', full: true, help: 'Paragrafları boş satırla ayırın.' },
    { key: 'image', label: 'Fotoğraf (kare, yüz ortada)', type: 'image', help: 'Bu fotoğraf sanatçı sayfasında 3D parçacık portreye dönüşür.' },
    { key: 'accent', label: 'Vurgu rengi', type: 'color' },
    { key: 'socials', label: 'Bağlantılar', type: 'object', fields: [
      { key: 'instagram', label: 'Instagram', type: 'url' },
      { key: 'youtube', label: 'YouTube', type: 'url' },
      { key: 'spotify', label: 'Spotify', type: 'url' },
    ] },
    { key: 'tracks', label: 'Parçalar', type: 'list', compact: true,
      summary: (t) => [t.title || 'Yeni parça', t.artists], thumb: (t) => t.cover,
      create: () => ({ title: '', artists: '', cover: '', preview: '', spotifyId: '', duration: 0 }),
      item: { type: 'object', fields: [
        { key: 'title', label: 'Parça adı', type: 'text' },
        { key: 'artists', label: 'Sanatçılar', type: 'text' },
        { key: 'cover', label: 'Kapak', type: 'image' },
        { key: 'preview', label: 'Önizleme sesi (mp3)', type: 'audio' },
        { key: 'spotifyId', label: 'Spotify parça ID', type: 'text' },
        { key: 'duration', label: 'Süre (saniye)', type: 'number' },
      ] } },
    { key: 'videos', label: 'Videolar', type: 'list', compact: true,
      summary: (v) => [v.title || 'Yeni video'], thumb: (v) => v.youtubeId && `https://i.ytimg.com/vi/${v.youtubeId}/default.jpg`,
      create: () => ({ youtubeId: '', title: '' }),
      item: { type: 'object', fields: [
        { key: 'youtubeId', label: 'YouTube linki', type: 'youtube' },
        { key: 'title', label: 'Başlık', type: 'text' },
      ] } },
  ],
};

const TABS = [
  { key: 'artists', label: 'Sanatçılar', hint: 'Yeni sanatçı ekleyin ya da var olanı düzenleyin. Spotify linkiyle parçalar otomatik gelir.',
    schema: { type: 'list', summary: (a) => [a.name || 'Yeni sanatçı', a.role], thumb: (a) => a.image,
      create: () => ({ name: '', slug: '', realName: '', role: '', tagline: '', bio: [], image: '', accent: '#ff8a1f', socials: {}, spotifyId: '', tracks: [], videos: [] }),
      item: artistSchema } },
  { key: 'site', label: 'Genel metinler', hint: 'Ana sayfa başlıkları, hakkımızda yazısı ve iletişim bilgileri.',
    schema: { type: 'object', fields: [
      { type: 'group', label: 'Giriş (hero)', fields: [
        { key: 'heroKicker', label: 'Üst etiket', type: 'text' },
        { key: 'heroCta', label: 'Buton yazısı', type: 'text' },
        { key: 'heroTitle', label: 'Büyük başlık', type: 'text', full: true, help: 'Son kelime turuncu italik yazılır.' },
        { key: 'marquee', label: 'Kayan yazı (her satır bir öğe)', type: 'lines', full: true },
      ] },
      { type: 'group', label: 'Hakkımızda', fields: [
        { key: 'aboutTitle', label: 'Başlık', type: 'text', full: true },
        { key: 'about', label: 'Metin', type: 'paragraphs', full: true, help: 'Paragrafları boş satırla ayırın.' },
        { key: 'stats', label: 'Rakamlar', type: 'list', compact: true, summary: (s) => [s.value, s.label], create: () => ({ value: '', label: '' }),
          item: { type: 'object', fields: [{ key: 'value', label: 'Değer', type: 'text' }, { key: 'label', label: 'Etiket', type: 'text' }] } },
      ] },
      { type: 'group', label: 'İletişim', fields: [
        { key: 'contactTitle', label: 'Başlık', type: 'text' },
        { key: 'contactText', label: 'Açıklama', type: 'text' },
        { key: 'phone', label: 'Telefon', type: 'text' },
        { key: 'whatsapp', label: 'WhatsApp (905xxxxxxxxx)', type: 'text' },
        { key: 'email', label: 'E-posta', type: 'text' },
        { key: 'address', label: 'Adres', type: 'text' },
        { key: 'city', label: 'İlçe / şehir', type: 'text' },
        { key: 'mapQuery', label: 'Harita araması', type: 'text', help: 'Haritada gösterilecek yer.' },
        { key: 'mapLink', label: 'Google Maps linki', type: 'url' },
      ] },
      { type: 'group', label: 'Sosyal medya & SEO', fields: [
        { key: 'instagram', label: 'Instagram', type: 'url' },
        { key: 'youtube', label: 'YouTube', type: 'url' },
        { key: 'spotifyPlaylist', label: 'Spotify playlist', type: 'url' },
        { key: 'legalName', label: 'Şirket adı', type: 'text' },
        { key: 'seoTitle', label: 'Google başlığı', type: 'text', full: true },
        { key: 'seoDescription', label: 'Google açıklaması', type: 'textarea', full: true },
      ] },
    ] } },
  { key: 'services', label: 'Hizmetler', hint: 'Ana sayfadaki hizmet listesi. Sırayı oklarla değiştirebilirsiniz.',
    schema: { type: 'list', compact: true, summary: (s) => [s.title || 'Yeni hizmet'], create: () => ({ title: '', text: '' }),
      item: { type: 'object', fields: [{ key: 'title', label: 'Başlık', type: 'text' }, { key: 'text', label: 'Kısa açıklama', type: 'text' }] } } },
  { key: 'gallery', label: 'Stüdyo galerisi', hint: 'Stüdyo bölümündeki fotoğraflar (dikey ya da kare fotoğraflar en iyi görünür).',
    schema: { type: 'list', compact: true, summary: (g) => [g.caption || 'Fotoğraf'], thumb: (g) => g.src, create: () => ({ src: '', caption: '' }),
      item: { type: 'object', fields: [{ key: 'src', label: 'Fotoğraf', type: 'image' }, { key: 'caption', label: 'Alt yazı', type: 'text' }] } } },
  { key: 'clips', label: 'Klipler', hint: 'Presto Medya olarak çekilen klipler. İlk klip büyük gösterilir.',
    schema: { type: 'list', compact: true, summary: (c) => [c.title || 'Yeni klip'], thumb: (c) => c.youtubeId && `https://i.ytimg.com/vi/${c.youtubeId}/default.jpg`,
      create: () => ({ youtubeId: '', title: '' }),
      item: { type: 'object', fields: [{ key: 'youtubeId', label: 'YouTube linki', type: 'youtube' }, { key: 'title', label: 'Başlık', type: 'text' }] } } },
  { key: '_settings', label: 'Ayarlar', hint: 'Yönetim şifresini değiştirin.' },
];

/* ---------- alan çizimi ---------- */

function field(f, obj, rerender) {
  const set = (v) => { obj[f.key] = v; setDirty(); };
  const val = obj[f.key];
  const wrap = (input) => h('div', { class: `f${f.full ? ' full' : ''}` }, f.label && h('label', {}, f.label), input, f.help && h('div', { class: 'help' }, f.help));

  switch (f.type) {
    case 'group':
      return h('div', { class: 'group' }, h('h4', {}, f.label), h('div', { class: 'fields' }, f.fields.map((x) => field(x, obj, rerender))));
    case 'text': case 'url':
      return wrap(h('input', { type: f.type === 'url' ? 'url' : 'text', value: val ?? '', oninput: (e) => {
        set(e.target.value);
        if (f.key === 'name' && obj.slug !== undefined && !obj._slugTouched) { obj.slug = slugify(e.target.value); const s = e.target.closest('.fields')?.querySelector('[data-slug]'); if (s) s.value = obj.slug; }
        if (['name', 'title', 'caption'].includes(f.key)) e.target.closest('details')?.querySelector(':scope > summary .t')?.firstChild?.replaceWith(document.createTextNode(e.target.value || '…'));
      } }));
    case 'slug':
      return wrap(h('input', { value: val ?? '', 'data-slug': '', oninput: (e) => { obj._slugTouched = true; set(slugify(e.target.value)); } }));
    case 'number':
      return wrap(h('input', { type: 'number', value: val ?? 0, oninput: (e) => set(Number(e.target.value) || 0) }));
    case 'textarea':
      return wrap(h('textarea', { value: val ?? '', oninput: (e) => set(e.target.value) }));
    case 'paragraphs':
      return wrap(h('textarea', { rows: 6, value: (val || []).join('\n\n'), oninput: (e) => set(e.target.value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) }));
    case 'lines':
      return wrap(h('textarea', { rows: 4, value: (val || []).join('\n'), oninput: (e) => set(e.target.value.split('\n').map((p) => p.trim()).filter(Boolean)) }));
    case 'color':
      return wrap(h('div', { class: 'media-row' },
        h('input', { type: 'color', value: val || '#ff8a1f', oninput: (e) => { set(e.target.value); e.target.nextSibling.value = e.target.value; } }),
        h('input', { value: val || '#ff8a1f', oninput: (e) => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) { set(e.target.value); e.target.previousSibling.value = e.target.value; } } })));
    case 'youtube': {
      const img = h('img', { src: val ? `https://i.ytimg.com/vi/${val}/mqdefault.jpg` : '', alt: '' });
      return wrap(h('div', { class: 'media' }, img, h('input', { value: val ? `https://youtu.be/${val}` : '', placeholder: 'https://youtu.be/…', oninput: (e) => {
        const id = ytId(e.target.value); set(id); img.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
      } })));
    }
    case 'image': case 'audio': {
      const isImg = f.type === 'image';
      const preview = isImg ? (val ? h('img', { src: backend.preview(val), alt: '' }) : h('div', { class: 'ph' })) : h('audio', { controls: true, src: backend.preview(val) || '', preload: 'none' });
      const url = h('input', { value: val || '', placeholder: 'uploads/… ya da https://…', oninput: (e) => { set(e.target.value); preview.src = backend.preview(e.target.value); } });
      const btn = h('label', { class: 'btn sm upload' }, 'Dosya yükle', h('input', { type: 'file', accept: isImg ? 'image/*' : 'audio/*', onchange: async (e) => {
        const file = e.target.files[0]; if (!file) return;
        btn.firstChild.textContent = 'Yükleniyor…';
        try { const u = await uploadFile(file); set(u); url.value = u; rerender(); toast('Dosya yüklendi'); }
        catch (err) { toast(err.message, true); }
        finally { btn.firstChild.textContent = 'Dosya yükle'; }
      } }));
      return wrap(h('div', { class: 'media' }, isImg && preview, h('div', { class: 'media-col' }, !isImg && preview, h('div', { class: 'media-row' }, url, btn))));
    }
    case 'object': {
      obj[f.key] = obj[f.key] || {};
      return h('div', { class: 'group' }, h('h4', {}, f.label), h('div', { class: 'fields' }, f.fields.map((x) => field(x, obj[f.key], rerender))));
    }
    case 'list':
      obj[f.key] = obj[f.key] || [];
      return h('div', { class: 'group' }, h('h4', {}, `${f.label} (${obj[f.key].length})`), listEditor(f, obj[f.key], rerender));
    case 'spotify':
      return spotifyImport(obj, rerender);
    default:
      return null;
  }
}

const open = new WeakSet();

function listEditor(schema, arr, rerender) {
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; setDirty(); rerender(); };
  const items = arr.map((item, i) => {
    const [title, sub] = schema.summary(item);
    const thumb = schema.thumb?.(item);
    const stop = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
    const det = h('details', { class: 'item', open: open.has(item), ontoggle: (e) => (e.target.open ? open.add(item) : open.delete(item)) },
      h('summary', {},
        schema.thumb && (thumb ? h('img', { class: 'thumb', src: backend.preview(thumb), alt: '' }) : h('div', { class: 'thumb' })),
        h('span', { class: 't' }, title || '…', sub && h('small', {}, sub)),
        h('span', { class: 'ctrls' },
          h('button', { class: 'icon-btn', title: 'Yukarı', onclick: stop(() => move(i, -1)) }, '↑'),
          h('button', { class: 'icon-btn', title: 'Aşağı', onclick: stop(() => move(i, 1)) }, '↓'),
          h('button', { class: 'icon-btn', title: 'Sil', onclick: stop(() => { if (confirm(`“${title || 'Bu öğe'}” silinsin mi?`)) { arr.splice(i, 1); setDirty(); rerender(); } }) }, '✕'))),
      h('div', { class: 'item-body' }, h('div', { class: 'fields' }, schema.item.fields.map((f) => field(f, item, rerender)))));
    return det;
  });
  return h('div', { class: `list${schema.compact ? ' compact' : ''}` }, items,
    h('button', { class: 'btn list-add', onclick: () => { const it = schema.create(); arr.push(it); open.add(it); setDirty(); rerender(); } }, '+ Ekle'));
}

function spotifyImport(artist, rerender) {
  const input = h('input', { placeholder: 'https://open.spotify.com/artist/…', value: artist.socials?.spotify || '' });
  const btn = h('button', { class: 'btn primary', onclick: async () => {
    if (!input.value.trim()) return toast('Spotify sanatçı linkini yapıştırın', true);
    btn.disabled = true; btn.textContent = 'Çekiliyor… (biraz sürebilir)';
    try {
      const slug = artist.slug || undefined;
      const r = await call(() => backend.spotify(input.value, slug, (msg) => { btn.textContent = msg; }));
      if (!artist.name) artist.name = r.name;
      if (!artist.slug) artist.slug = slugify(r.name);
      if (!artist.image || confirm('Fotoğraf Spotify profil fotoğrafıyla değiştirilsin mi?')) artist.image = r.image;
      artist.spotifyId = r.spotifyId;
      artist.socials = { ...(artist.socials || {}), spotify: `https://open.spotify.com/artist/${r.spotifyId}` };
      artist.tracks = r.tracks;
      setDirty(); rerender();
      toast(`${r.tracks.length} parça çekildi — Kaydet'e basmayı unutmayın`);
    } catch (err) { toast(err.message, true); }
    finally { btn.disabled = false; btn.textContent = 'Spotify\'dan çek'; }
  } }, 'Spotify\'dan çek');
  return h('div', { class: 'callout' },
    h('div', { class: 'f' }, h('label', {}, 'Spotify sanatçı linki'), input), btn,
    h('p', {}, 'Popüler parçalar, kapaklar, 30 saniyelik önizlemeler ve profil fotoğrafı otomatik indirilir. Var olan parça listesi yenisiyle değişir.'));
}

/* ---------- ayarlar ---------- */

function settingsPanel() {
  const cur = h('input', { type: 'password', autocomplete: 'current-password' });
  const nxt = h('input', { type: 'password', autocomplete: 'new-password' });
  return h('div', { class: 'fields' }, h('div', { class: 'group' }, h('h4', {}, 'Şifre değiştir'), h('div', { class: 'fields' },
    h('div', { class: 'f' }, h('label', {}, 'Mevcut şifre'), cur),
    h('div', { class: 'f' }, h('label', {}, 'Yeni şifre (en az 6 karakter)'), nxt),
    h('div', { class: 'f full' }, h('button', { class: 'btn primary', onclick: async () => {
      try { await call(() => backend.password(cur.value, nxt.value)); toast('Şifre değişti, yeniden giriş yapın'); setTimeout(showLogin, 1200); }
      catch (err) { toast(err.message, true); }
    } }, 'Şifreyi güncelle')))));
}

/* ---------- çizim ---------- */

function render() {
  // GitHub modunda giriş token'la yapıldığı için şifre ayarı yok
  const tabs = TABS.filter((x) => !(x.key === '_settings' && backend.mode === 'github'));
  const t = tabs.find((x) => x.key === tab);
  $('[data-tabs]').replaceChildren(...tabs.map((x) => h('button', { class: x.key === tab ? 'on' : '', onclick: () => { tab = x.key; render(); scrollTo(0, 0); } },
    x.label, Array.isArray(content[x.key]) && h('span', {}, content[x.key].length))));
  $('[data-tab-title]').textContent = t.label;
  $('[data-tab-hint]').textContent = t.hint;
  const y = scrollY;
  let body;
  if (t.key === '_settings') body = settingsPanel();
  else if (t.schema.type === 'list') body = h('div', { class: 'fields' }, listEditor(t.schema, content[t.key], render));
  else body = h('div', { class: 'fields' }, t.schema.fields.map((f) => field(f, content[t.key], render)));
  $('[data-panel]').replaceChildren(body);
  scrollTo(0, y);
}

async function save() {
  // doğrulama: sanatçı adresleri benzersiz ve dolu olmalı
  const slugs = new Set();
  for (const a of content.artists) {
    if (!a.name || !a.slug) return toast('Her sanatçının adı ve sayfa adresi olmalı', true);
    if (slugs.has(a.slug)) return toast(`“${a.slug}” adresi iki kez kullanılmış`, true);
    slugs.add(a.slug);
  }
  const clean = JSON.parse(JSON.stringify(content, (k, v) => (k.startsWith('_') ? undefined : v)));
  const btn = $('[data-save]');
  btn.disabled = true; btn.textContent = 'Kaydediliyor…';
  try { await call(() => backend.save(clean)); setDirty(false); toast(backend.savedMessage); }
  catch (err) { toast(err.message, true); btn.disabled = false; }
  finally { btn.textContent = 'Kaydet'; }
}

function showLogin() {
  const gh = backend.mode === 'github';
  const f = $('[data-login-form]');
  $('[data-login-password]').hidden = gh;
  $('[data-login-github]').hidden = !gh;
  f.password.required = !gh;
  f.token.required = gh;
  if (gh && !f.owner.value) { const r = guessRepo(); f.owner.value = r.owner; f.repo.value = r.repo; f.branch.value = r.branch; }
  $('[data-app]').hidden = true;
  $('[data-login]').hidden = false;
}

async function boot() {
  if (!(await backend.me())) return showLogin();
  try { content = await call(() => backend.load()); }
  catch (err) { $('[data-login-err]').textContent = err.message; return showLogin(); }
  $('[data-login]').hidden = true;
  $('[data-app]').hidden = false;
  setDirty(false);
  render();
}

$('[data-login-form]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const btn = f.querySelector('button');
  btn.disabled = true;
  try {
    await backend.login(backend.mode === 'github'
      ? { token: f.token.value, owner: f.owner.value, repo: f.repo.value, branch: f.branch.value }
      : { password: f.password.value });
    f.reset(); $('[data-login-err]').textContent = ''; await boot();
  } catch (err) { $('[data-login-err]').textContent = err.message; }
  finally { btn.disabled = false; }
});
$('[data-save]').addEventListener('click', save);
$('[data-logout]').addEventListener('click', async () => { await backend.logout(); showLogin(); });
addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (dirty) save(); } });

boot();
