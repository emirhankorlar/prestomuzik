// Presto yönetim paneli — şemadan form üretir, içeriği tek JSON olarak kaydeder.
import { createBackend } from './admin-backend.js';
import { withDefaults, SECTION_DEFAULTS } from './defaults.js';

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

const readDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });

// büyük fotoğrafları yüklemeden önce küçült (sunucu tek istekte ~4MB kabul ediyor)
async function shrinkImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.2 * 1024 * 1024) return file;
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.86));
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

async function uploadFile(original) {
  const file = await shrinkImage(original);
  if (file.size > 3 * 1024 * 1024) throw new Error('Dosya 3MB\'dan büyük olamaz (ses dosyasını kısaltın ya da sıkıştırın)');
  const data = await readDataUrl(file);
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
    { key: 'tag', label: 'Katalog no', type: 'text', placeholder: (a) => `PM-${String(content.artists.indexOf(a) + 1).padStart(3, '0')}`, help: 'Kartın köşesindeki etiket. Boş bırakılırsa sıraya göre otomatik (PM-001…).' },
    { key: 'tagline', label: 'Kısa söz / slogan', type: 'text', full: true },
    { key: 'bio', label: 'Biyografi', type: 'paragraphs', full: true, help: 'Paragrafları boş satırla ayırın.' },
    { key: 'image', label: 'Fotoğraf (kare, yüz ortada)', type: 'image', help: 'Bu fotoğraf sanatçı sayfasında 3D parçacık portreye dönüşür.' },
    { key: 'accent', label: 'Vurgu rengi', type: 'color' },
    { key: 'socials', label: 'Bağlantılar', type: 'object', fields: [
      { key: 'instagram', label: 'Instagram', type: 'url' },
      { key: 'youtube', label: 'YouTube', type: 'url' },
      { key: 'spotify', label: 'Spotify', type: 'url' },
      { key: 'tiktok', label: 'TikTok', type: 'url' },
      { key: 'soundcloud', label: 'SoundCloud', type: 'url' },
    ] },
    { key: 'tracksTitle', label: 'Parçalar başlığı', type: 'text', placeholder: 'Popüler parçalar', help: 'Sanatçı sayfasındaki parça listesinin başlığı. Son kelime turuncu italik yazılır.' },
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
        { key: 'link', label: 'Tamamını dinle linki', type: 'url', full: true, help: 'Boş bırakılırsa önizlemedeki buton sanatçının Spotify profiline gider. Şarkı Spotify\'da değilse (YouTube, SoundCloud…) linkini buraya yapıştırın.' },
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
  { key: 'team', label: 'Kadro', target: '', hint: 'Prodüktör, yönetmen gibi ekip üyeleri. Ana sayfadaki kadro bölümünde kategori sekmeleriyle görünür (sanatçılar ilk sekmede).',
    schema: { type: 'object', fields: [
      { type: 'group', label: 'Kategoriler', fields: [
        { key: 'teamCategories', label: 'Kadro kategorileri (her satır bir kategori)', type: 'lines', full: true, help: 'Yeni kategori eklemek için alta yeni satır yazın. Üyesi olmayan kategori sitede görünmez.' },
      ] },
      { key: 'site', label: 'Sanatçılar sekmesi', type: 'object', fields: [
        { key: 'artistsLabel', label: 'Sekme adı', type: 'text', help: 'Sanatçıların göründüğü ilk sekme.' },
      ] },
      { key: 'team', label: 'Kadro üyeleri', type: 'list', compact: true,
        summary: (m) => [m.name || 'Yeni üye', m.category], thumb: (m) => m.image,
        create: () => ({ name: '', role: '', category: content.teamCategories[0] || '', image: '', socials: {} }),
        item: { type: 'object', fields: [
          { key: 'name', label: 'Ad soyad', type: 'text' },
          { key: 'category', label: 'Kategori', type: 'select', options: () => content.teamCategories },
          { key: 'role', label: 'Ünvan (isteğe bağlı)', type: 'text', help: 'Boş bırakılırsa kategori adı yazılır.' },
          { key: 'image', label: 'Fotoğraf (kare)', type: 'image' },
          { key: 'socials', label: 'Bağlantılar', type: 'object', fields: [
            { key: 'instagram', label: 'Instagram', type: 'url' },
            { key: 'youtube', label: 'YouTube', type: 'url' },
            { key: 'spotify', label: 'Spotify', type: 'url' },
            { key: 'tiktok', label: 'TikTok', type: 'url' },
            { key: 'soundcloud', label: 'SoundCloud', type: 'url' },
          ] },
        ] } },
    ] } },
  { key: 'layout', label: 'Ana sayfa düzeni', target: 'site', hint: 'Bölümlerin sırası (menü de aynı sırayı izler), kanal kodları, başlıklar, arka plan solukluğu, renkler ve logo.',
    schema: { type: 'object', fields: [
      { key: 'sections', label: 'Bölümler', type: 'list', fixed: true,
        summary: (x) => [SECTION_DEFAULTS[x.id].name, `${x.visible ? '' : 'gizli · '}${x.channel || 'CH otomatik'} · ${x.title}`],
        item: { type: 'object', fields: [
          { key: 'visible', label: 'Sayfada göster', type: 'checkbox' },
          { key: 'menu', label: 'Menüde göster', type: 'checkbox' },
          { key: 'menuName', label: 'Menüdeki adı', type: 'text' },
          { key: 'channel', label: 'Kanal kodu', type: 'text', placeholder: 'Otomatik (CH-01, CH-02…)', help: 'Boş bırakılırsa sıraya göre otomatik numaralanır.' },
          { key: 'label', label: 'Kanal etiketi', type: 'text', help: 'Kanal kodunun yanındaki küçük yazı.' },
          { key: 'title', label: 'Başlık', type: 'text', help: 'Son kelime turuncu italik yazılır.' },
          { key: 'text', label: 'Kısa metin / buton yazısı', type: 'text', full: true, when: (x) => ['services', 'studio', 'artists', 'clips'].includes(x.id) },
          { key: 'scene', label: 'Arka plan efekti', type: 'select', options: [['wave', 'Nokta dalgası'], ['vinyl', 'Plak']] },
          { key: 'fade', label: 'Arka plan parlaklığı', type: 'range', help: 'Düşük = daha soluk. Hizmetler bölümü %45.' },
        ] } },
      { key: 'menuLinks', label: 'Ekstra menü linkleri', type: 'list', compact: true,
        summary: (l) => [l.name || 'Yeni link', l.url], create: () => ({ name: '', url: '' }),
        item: { type: 'object', fields: [
          { key: 'name', label: 'Menüde görünen ad', type: 'text' },
          { key: 'url', label: 'Link', type: 'text', placeholder: 'https://… ya da artist.html?id=…', help: 'Menünün sonuna eklenir.' },
        ] } },
      { type: 'group', label: 'Renkler & logo', fields: [
        { key: 'colors', label: 'Site renkleri', type: 'object', fields: [
          { key: 'accent', label: 'Ana vurgu rengi', type: 'color', help: 'Butonlar, başlıklardaki italik kelime, kanal kodları.' },
          { key: 'accent2', label: 'İkinci vurgu', type: 'color', help: 'Dalga ve plaktaki ikinci renk, kayıt noktası.' },
          { key: 'logo1', label: 'Logo rengi 1', type: 'color', help: 'Girişteki 3D logo.' },
          { key: 'logo2', label: 'Logo rengi 2', type: 'color' },
        ] },
        { key: 'logoScale', label: 'Girişteki logo boyutu', type: 'range', min: 0.6, max: 1.4, step: 0.05 },
      ] },
    ] } },
  { key: 'site', label: 'Genel metinler', hint: 'Ana sayfa başlıkları, hakkımızda yazısı ve iletişim bilgileri. Bölüm başlıkları "Ana sayfa düzeni" sekmesinde.',
    schema: { type: 'object', fields: [
      { type: 'group', label: 'Giriş (hero)', fields: [
        { key: 'heroKicker', label: 'Üst etiket', type: 'text' },
        { key: 'heroCta', label: 'Buton yazısı', type: 'text' },
        { key: 'heroTitle', label: 'Büyük başlık', type: 'text', full: true, help: 'Son kelime turuncu italik yazılır.' },
        { key: 'marquee', label: 'Kayan yazı (her satır bir öğe)', type: 'lines', full: true },
      ] },
      { type: 'group', label: 'Hakkımızda', fields: [
        { key: 'about', label: 'Metin', type: 'paragraphs', full: true, help: 'Paragrafları boş satırla ayırın.' },
        { key: 'stats', label: 'Rakamlar', type: 'list', compact: true, summary: (s) => [s.value, s.label], create: () => ({ value: '', label: '' }),
          item: { type: 'object', fields: [{ key: 'value', label: 'Değer', type: 'text' }, { key: 'label', label: 'Etiket', type: 'text' }] } },
      ] },
      { type: 'group', label: 'İletişim', fields: [
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
  { key: 'services', label: 'Hizmetler', hint: 'Ana sayfadaki hizmet listesi. Sırayı oklarla değiştirebilirsiniz. Fotoğraf, fare hizmetin üzerine gelince görünür.',
    schema: { type: 'list', compact: true, summary: (s) => [s.title || 'Yeni hizmet'], thumb: (s) => s.image, create: () => ({ title: '', text: '', image: '' }),
      item: { type: 'object', fields: [
        { key: 'title', label: 'Başlık', type: 'text' }, { key: 'text', label: 'Kısa açıklama', type: 'text' },
        { key: 'image', label: 'Fotoğraf', type: 'image', full: true, help: 'Boş bırakılırsa stüdyo galerisinden sırayla bir fotoğraf gösterilir.' },
      ] } } },
  { key: 'gallery', label: 'Stüdyo galerisi', hint: 'Stüdyo bölümündeki fotoğraflar (dikey ya da kare fotoğraflar en iyi görünür).',
    schema: { type: 'list', compact: true, summary: (g) => [g.caption || 'Fotoğraf'], thumb: (g) => g.src, create: () => ({ src: '', caption: '' }),
      item: { type: 'object', fields: [{ key: 'src', label: 'Fotoğraf', type: 'image' }, { key: 'caption', label: 'Alt yazı', type: 'text' }] } } },
  { key: 'clips', label: 'Klipler', hint: 'Presto Medya olarak çekilen klipler. İlk klip büyük gösterilir.',
    schema: { type: 'list', compact: true, summary: (c) => [c.title || 'Yeni klip'], thumb: (c) => c.youtubeId && `https://i.ytimg.com/vi/${c.youtubeId}/default.jpg`,
      create: () => ({ youtubeId: '', title: '' }),
      item: { type: 'object', fields: [{ key: 'youtubeId', label: 'YouTube linki', type: 'youtube' }, { key: 'title', label: 'Başlık', type: 'text' }] } } },
  { key: '_messages', label: 'Mesajlar', hint: 'Sitedeki iletişim formundan gelenler. WhatsApp ya da e-posta uygulaması açılmasa bile her mesaj buraya düşer.' },
  { key: '_settings', label: 'Ayarlar', hint: 'Yönetim şifresini değiştirin.' },
];

/* ---------- alan çizimi ---------- */

function field(f, obj, rerender) {
  const set = (v) => { obj[f.key] = v; setDirty(); };
  const val = obj[f.key];
  if (f.when && !f.when(obj)) return null;
  const placeholder = typeof f.placeholder === 'function' ? f.placeholder(obj) : f.placeholder;
  const wrap = (input) => h('div', { class: `f${f.full ? ' full' : ''}` }, f.label && h('label', {}, f.label), input, f.help && h('div', { class: 'help' }, f.help));

  switch (f.type) {
    case 'group':
      return h('div', { class: 'group' }, h('h4', {}, f.label), h('div', { class: 'fields' }, f.fields.map((x) => field(x, obj, rerender))));
    case 'text': case 'url':
      return wrap(h('input', { type: f.type === 'url' ? 'url' : 'text', value: val ?? '', placeholder, oninput: (e) => {
        set(e.target.value);
        if (f.key === 'name' && obj.slug !== undefined && !obj._slugTouched) { obj.slug = slugify(e.target.value); const s = e.target.closest('.fields')?.querySelector('[data-slug]'); if (s) s.value = obj.slug; }
        if (['name', 'title', 'caption'].includes(f.key)) e.target.closest('details')?.querySelector(':scope > summary .t')?.firstChild?.replaceWith(document.createTextNode(e.target.value || '…'));
      } }));
    case 'slug':
      return wrap(h('input', { value: val ?? '', 'data-slug': '', oninput: (e) => { obj._slugTouched = true; set(slugify(e.target.value)); } }));
    case 'select': {
      const opts = (typeof f.options === 'function' ? f.options() : f.options).map((o) => (Array.isArray(o) ? o : [o, o]));
      if (val && !opts.some(([v]) => v === val)) opts.push([val, `${val} (silinmiş kategori)`]);
      return wrap(h('select', { onchange: (e) => set(e.target.value) }, opts.map(([v, l]) => h('option', { value: v, selected: v === val }, l))));
    }
    case 'checkbox':
      return h('label', { class: 'f check' }, h('input', { type: 'checkbox', checked: !!val, onchange: (e) => set(e.target.checked) }), h('span', {}, f.label));
    case 'range': {
      // varsayılan 0..1 aralığı yüzde olarak gösterilir
      const min = f.min ?? 0, max = f.max ?? 1, step = f.step ?? 0.05;
      const show = (v) => (f.min == null ? `%${Math.round(v * 100)}` : `${Math.round(v * 100)}%`);
      const out = h('span', { class: 'range-val' }, show(val ?? max));
      return wrap(h('div', { class: 'range' }, h('input', { type: 'range', min, max, step, value: val ?? max, oninput: (e) => { set(Number(e.target.value)); out.textContent = show(Number(e.target.value)); } }), out));
    }
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
          !schema.fixed && h('button', { class: 'icon-btn', title: 'Sil', onclick: stop(() => { if (confirm(`“${title || 'Bu öğe'}” silinsin mi?`)) { arr.splice(i, 1); setDirty(); rerender(); } }) }, '✕'))),
      h('div', { class: 'item-body' }, h('div', { class: 'fields' }, schema.item.fields.map((f) => field(f, item, rerender)))));
    return det;
  });
  return h('div', { class: `list${schema.compact ? ' compact' : ''}` }, items,
    !schema.fixed && h('button', { class: 'btn list-add', onclick: () => { const it = schema.create(); arr.push(it); open.add(it); setDirty(); rerender(); } }, '+ Ekle'));
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

/* ---------- mesajlar ---------- */

let messages = null;
const SEEN_KEY = 'pm_seen_messages';
const lastSeen = () => { try { return localStorage.getItem(SEEN_KEY) || ''; } catch { return ''; } };
const unread = () => (messages || []).filter((m) => m.date > lastSeen()).length;

async function loadMessages() {
  try { messages = await call(() => backend.messages()); }
  catch (err) { messages = []; toast(err.message, true); }
}

function messagesPanel() {
  if (!messages) { loadMessages().then(render); return h('p', { class: 'hint' }, 'Yükleniyor…'); }
  const seen = lastSeen();
  // panel açıldığında hepsi okundu sayılır (yeni etiketi bu açılışta görünmeye devam eder)
  try { if (messages[0]) localStorage.setItem(SEEN_KEY, messages[0].date); } catch { /* gizli sekme */ }
  if (!messages.length) return h('p', { class: 'hint' }, 'Henüz mesaj yok.');
  const fmt = (d) => new Date(d).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
  return h('div', { class: 'msgs' }, messages.map((m) => h('div', { class: `msg${m.date > seen ? ' new' : ''}` },
    h('div', { class: 'msg-head' },
      h('b', {}, m.name), m.date > seen && h('span', { class: 'badge' }, 'Yeni'),
      h('span', { class: 'msg-meta' }, `${fmt(m.date)} · ${m.via === 'mail' ? 'E-posta butonu' : 'WhatsApp butonu'}`),
      h('button', { class: 'icon-btn', title: 'Sil', onclick: async () => {
        if (!confirm(`${m.name} adlı kişinin mesajı silinsin mi?`)) return;
        try { await call(() => backend.deleteMessage(m.id)); messages = messages.filter((x) => x !== m); render(); toast('Mesaj silindi'); }
        catch (err) { toast(err.message, true); }
      } }, '✕')),
    h('div', { class: 'msg-info' },
      m.phone && h('a', { href: `tel:${m.phone.replace(/\s/g, '')}` }, m.phone),
      m.phone && h('a', { href: `https://wa.me/${m.phone.replace(/\D/g, '').replace(/^0/, '90')}`, target: '_blank' }, 'WhatsApp ↗'),
      m.service && h('span', {}, m.service)),
    m.message && h('p', {}, m.message))));
}

/* ---------- çizim ---------- */

function render() {
  const tabs = TABS;
  const t = tabs.find((x) => x.key === tab);
  const count = (x) => (x.key === '_messages' ? (unread() ? `${unread()} yeni` : null) : Array.isArray(content[x.key]) ? content[x.key].length : null);
  $('[data-tabs]').replaceChildren(...tabs.map((x) => h('button', { class: x.key === tab ? 'on' : '', onclick: () => { tab = x.key; render(); scrollTo(0, 0); } },
    x.label, count(x) != null && h('span', {}, count(x)))));
  $('[data-tab-title]').textContent = t.label;
  $('[data-tab-hint]').textContent = t.hint;
  const y = scrollY;
  let body;
  // target: içeriğin hangi kısmı düzenleniyor ('' = içeriğin kendisi)
  const target = t.target === '' ? content : content[t.target ?? t.key];
  if (t.key === '_settings') body = settingsPanel();
  else if (t.key === '_messages') body = messagesPanel();
  else if (t.schema.type === 'list') body = h('div', { class: 'fields' }, listEditor(t.schema, target, render));
  else body = h('div', { class: 'fields' }, t.schema.fields.map((f) => field(f, target, render)));
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
  $('[data-app]').hidden = true;
  $('[data-login]').hidden = false;
}

async function boot() {
  if (!(await backend.me())) return showLogin();
  try { content = withDefaults(await call(() => backend.load())); }
  catch (err) { $('[data-login-err]').textContent = err.message; return showLogin(); }
  $('[data-login]').hidden = true;
  $('[data-app]').hidden = false;
  setDirty(false);
  render();
  loadMessages().then(render); // sekmede yeni mesaj sayısı görünsün
}

$('[data-login-form]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const btn = f.querySelector('button');
  btn.disabled = true;
  try {
    await backend.login({ password: f.password.value });
    f.reset(); $('[data-login-err]').textContent = ''; await boot();
  } catch (err) { $('[data-login-err]').textContent = err.message; }
  finally { btn.disabled = false; }
});
$('[data-save]').addEventListener('click', save);
$('[data-logout]').addEventListener('click', async () => { await backend.logout(); showLogin(); });
addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (dirty) save(); } });

boot();
