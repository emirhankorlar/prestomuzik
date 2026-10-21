import { loadContent, initNav, initReveal, initBackdrop, renderFooter, hideLoader, setMeta, esc, icons, fmtTime, ytThumb, splitLines, isTouch } from './common.js';
import { player, mountMiniPlayer, bindTrackList } from './player.js';
import { initHeroScene } from './hero3d.js';

const $ = (s, r = document) => r.querySelector(s);

const content = await loadContent();
const { site, services, gallery, clips, artists } = content;

setMeta(site);
initNav();
mountMiniPlayer();

/* ---------- render ---------- */
$('[data-kicker]').textContent = site.heroKicker;
if (site.heroTitle) {
  const words = site.heroTitle.trim().split(/\s+/);
  const last = words.pop();
  $('[data-hero-title]').innerHTML = splitLines(`${esc(words.join(' '))}|<span class="serif">${esc(last)}</span>`);
}
$('[data-hero-cta]').textContent = site.heroCta || 'Seans Ayırt';

const mq = (site.marquee || []).map((m) => `<span>${esc(m)}</span>`).join('');
$('[data-marquee]').innerHTML = mq + mq;

// başlığın son kelimesi italik serif vurgu olur
const accentTitle = (t) => {
  const words = String(t || '').trim().split(/\s+/);
  const last = words.pop();
  const half = Math.ceil(words.length / 2);
  return splitLines(`${esc(words.slice(0, half).join(' '))}|${esc(words.slice(half).join(' '))} <span class="serif">${esc(last)}</span>`);
};
$('[data-about-title]').innerHTML = accentTitle(site.aboutTitle);
$('[data-about]').innerHTML = (site.about || []).map((p) => `<p>${esc(p)}</p>`).join('');
$('[data-stats]').innerHTML = (site.stats || []).map((s) => `<div class="stat reveal"><b>${esc(s.value)}</b><span class="mono">${esc(s.label)}</span></div>`).join('');

$('[data-services]').innerHTML = services.map((s, i) => `
  <li class="svc reveal" data-i="${i}">
    <span class="svc-num mono">${String(i + 1).padStart(2, '0')}</span>
    <h3 class="display">${esc(s.title)}</h3>
    <p>${esc(s.text)}</p>
    <span class="svc-arrow">${icons.arrowUpRight}</span>
  </li>`).join('');
$('[data-service-select]').innerHTML = services.map((s) => `<option>${esc(s.title)}</option>`).join('') + '<option>Diğer</option>';

// stüdyo: iki sıra, scroll ile ters yönlere akar (sayfa kilitlenmez)
const shot = (g, i) => `
  <figure class="shot">
    <div class="shot-img" data-full="${esc(g.src)}" data-cap="${esc(g.caption)}"><img src="${esc(g.src)}" alt="${esc(g.caption)}" loading="lazy"></div>
    <figcaption class="mono"><span>${esc(g.caption)}</span><span>${String(i + 1).padStart(2, '0')}</span></figcaption>
  </figure>`;
const half = Math.ceil(gallery.length / 2);
const rowA = gallery.slice(0, half).map((g, i) => shot(g, i));
const rowB = gallery.slice(half).map((g, i) => shot(g, i + half));
// satırlar ekrandan geniş olsun diye tekrar edilir
$('[data-gallery]').innerHTML = `<div class="studio-track">${[...rowA, ...rowA].join('')}</div><div class="studio-track">${[...rowB, ...rowB, ...rowB].join('')}</div>`;

$('[data-artists]').innerHTML = artists.map((a, i) => `
  <a class="sleeve reveal" href="artist.html?id=${esc(a.slug)}" style="--accent:${esc(a.accent || '#ff8a1f')}">
    <div class="sleeve-stage">
      <div class="vinyl"><img src="${esc(a.tracks?.[0]?.cover || a.image)}" alt=""></div>
      <div class="sleeve-cover">
        <img src="${esc(a.image)}" alt="${esc(a.name)}" loading="lazy">
        <span class="sleeve-tag mono">PM-${String(i + 1).padStart(3, '0')}</span>
        <h3 class="display sleeve-name">${esc(a.name)}</h3>
      </div>
    </div>
    <div class="sleeve-meta mono"><b>${esc(a.role || '')}</b><span>${a.tracks?.length || 0} parça →</span></div>
  </a>`).join('');

// sanatçılardan sırayla birer parça alıp "son çıkanlar" listesi
const releases = [];
const pools = artists.map((a) => (a.tracks || []).filter((t) => t.preview).map((t) => ({ ...t, artistImage: a.image, slug: a.slug })));
for (let r = 0; r < 4; r++) pools.forEach((p) => p[r] && releases.push(p[r]));
const relEl = $('[data-releases]');
relEl.innerHTML = releases.map((t, i) => `
  <li class="track reveal">
    <span class="track-i">${String(i + 1).padStart(2, '0')}</span>
    <img class="track-cover" src="${esc(t.cover || t.artistImage)}" alt="" loading="lazy">
    <div><div class="track-title">${esc(t.title)}</div><a class="track-artist" href="artist.html?id=${esc(t.slug)}">${esc(t.artists)}</a></div>
    <span class="track-dur">${fmtTime(t.duration)}</span>
    <span class="track-play">${icons.play}<span class="eq"><i></i><i></i><i></i></span></span>
  </li>`).join('');
bindTrackList(relEl, releases);
$('[data-hero-listen]').addEventListener('click', () => player.play(releases, 0));

$('[data-youtube]').href = site.youtube;
$('[data-clips]').innerHTML = clips.map((c) => `
  <div class="clip reveal">
    <div class="clip-media" data-yt="${esc(c.youtubeId)}">
      <img src="${ytThumb(c.youtubeId)}" alt="" loading="lazy" onerror="this.onerror=null;this.classList.add('lb');this.src='https://i.ytimg.com/vi/${esc(c.youtubeId)}/hqdefault.jpg'">
      <button class="clip-play" aria-label="Oynat"><span>${icons.play}</span></button>
    </div>
    <h3>${esc(c.title)}</h3>
  </div>`).join('');
document.querySelectorAll('[data-yt]').forEach((m) => m.addEventListener('click', () => {
  player.audio.pause();
  m.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${m.dataset.yt}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
}, { once: true }));

$('[data-contact-title]').innerHTML = accentTitle(site.contactTitle);
$('[data-contact-text]').textContent = site.contactText;
const mapsHref = site.mapLink || `https://maps.google.com/?q=${encodeURIComponent(site.mapQuery)}`;
$('[data-contact]').innerHTML = `
  <a href="${esc(mapsHref)}" target="_blank" rel="noopener"><span class="mono">Adres</span><span>${esc(site.address)}<br>${esc(site.city)}</span></a>
  <a href="tel:${esc(site.phone.replace(/\s/g, ''))}"><span class="mono">Telefon</span><span>${esc(site.phone)}</span></a>
  <a href="https://wa.me/${esc(site.whatsapp)}" target="_blank" rel="noopener"><span class="mono">WhatsApp</span><span>Mesaj gönder →</span></a>
  <a href="mailto:${esc(site.email)}"><span class="mono">E-posta</span><span>${esc(site.email)}</span></a>
  <a href="${esc(site.instagram)}" target="_blank" rel="noopener"><span class="mono">Instagram</span><span>@${esc(site.instagram.split('/').filter(Boolean).pop())}</span></a>`;
$('[data-menu-contact]').innerHTML = `${esc(site.phone)}<br>${esc(site.email)}`;
renderFooter(site);

// harita: görünür olunca yüklenir
const mapEl = $('[data-map]');
new IntersectionObserver(([e], o) => {
  if (!e.isIntersecting) return;
  o.disconnect();
  mapEl.innerHTML = `<iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Presto Müzik konum"
    src="https://maps.google.com/maps?q=${encodeURIComponent(site.mapQuery)}&z=16&output=embed"></iframe>
    <a class="btn" href="${esc(mapsHref)}" target="_blank" rel="noopener">Yol tarifi al ${icons.arrowUpRight}</a>`;
}, { rootMargin: '400px' }).observe(mapEl);

// form → WhatsApp / e-posta
$('[data-form]').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const via = e.submitter?.dataset.via || 'wa';
  const text = `Merhaba Presto Müzik,\n\nAd: ${f.get('name')}\nTelefon: ${f.get('phone') || '-'}\nHizmet: ${f.get('service')}\n\n${f.get('message') || ''}`;
  if (via === 'wa') open(`https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  else location.href = `mailto:${site.email}?subject=${encodeURIComponent(`Seans talebi — ${f.get('service')}`)}&body=${encodeURIComponent(text)}`;
});

initReveal();

/* ---------- 3D sahne + scroll ---------- */
let scene3d = null;
try {
  scene3d = await initHeroScene($('#scene'), { logoUrl: 'assets/pm-logo.png' });
} catch (err) {
  console.warn('WebGL başlatılamadı', err);
}
hideLoader();

const sections = [...document.querySelectorAll('[data-scene]')];
const studio = $('#studyo');
const rows = [...document.querySelectorAll('.studio-track')];
const meters = [...document.querySelectorAll('[data-meter] i')];
const showBackdrop = initBackdrop(gallery.map((g) => g.src));

function onScroll() {
  const mid = scrollY + innerHeight * 0.5;
  let cur = sections[0];
  for (const s of sections) if (s.offsetTop <= mid) cur = s;
  scene3d?.setTarget(Number(cur.dataset.scene), Number(cur.dataset.fade || 1));
  // her bölümün arkasında farklı bir stüdyo fotoğrafı
  if (gallery.length) showBackdrop(gallery[sections.indexOf(cur) % gallery.length].src);

  // stüdyo sıraları: bölüm ekrandan geçerken 0→1
  const r = studio.getBoundingClientRect();
  if (r.bottom > 0 && r.top < innerHeight) {
    const p = (innerHeight - r.top) / (innerHeight + r.height);
    rows.forEach((row, i) => {
      const max = Math.max(0, row.scrollWidth - innerWidth);
      const x = i === 0 ? -p * max * 0.6 : -(1 - p) * max * 0.6;
      row.style.transform = `translate3d(${x}px,0,0) rotateX(${i === 0 ? 6 : -6}deg)`;
    });
  }
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
onScroll();

// kanal metreleri: müzik çalıyorsa gerçek seviyeler, yoksa hafif rastgele
(function meterLoop() {
  const lv = player.levels();
  const playing = !player.audio.paused;
  meters.forEach((m, i) => {
    const v = playing ? [lv.bass, lv.mid, lv.high, lv.level][i % 4] * 1.4 : 0.15 + Math.random() * 0.25;
    m.style.height = `${Math.min(100, 15 + v * 85)}%`;
  });
  setTimeout(() => requestAnimationFrame(meterLoop), playing ? 0 : 140);
})();

// hizmet listesi: imleci takip eden stüdyo fotoğrafı
if (!isTouch) {
  const prev = $('.svc-preview');
  const img = prev.querySelector('img');
  let px = 0, py = 0, tx = 0, ty = 0, raf;
  document.querySelectorAll('.svc').forEach((row) => {
    row.addEventListener('pointerenter', () => {
      img.src = gallery[Number(row.dataset.i) % gallery.length]?.src || '';
      prev.classList.add('is-on');
    });
    row.addEventListener('pointerleave', () => prev.classList.remove('is-on'));
  });
  addEventListener('pointermove', (e) => { tx = e.clientX + 170; ty = e.clientY; }, { passive: true });
  const follow = () => {
    px += (tx - px) * 0.14; py += (ty - py) * 0.14;
    prev.style.left = `${px}px`; prev.style.top = `${py}px`;
    raf = requestAnimationFrame(follow);
  };
  follow();
}

// galeri: tıklayınca büyük aç, tekrar tıklayınca / X / Esc ile kapat
const lb = $('[data-lightbox]');
const lbImg = $('[data-lightbox-img]');
const closeLb = () => { lb.classList.remove('is-on'); setTimeout(() => { lb.hidden = true; }, 350); document.body.style.overflow = ''; };
document.querySelectorAll('[data-full]').forEach((el) => el.addEventListener('click', () => {
  lbImg.src = el.dataset.full;
  $('[data-lightbox-cap]').textContent = el.dataset.cap;
  lb.hidden = false;
  requestAnimationFrame(() => lb.classList.add('is-on'));
  document.body.style.overflow = 'hidden';
}));
lb.addEventListener('click', closeLb);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) closeLb(); });
