// Ortak yardımcılar: içerik yükleme, nav, imleç, reveal animasyonları.

export const icons = {
  play: '<svg class="icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
  pause: '<svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 5.5v13a1 1 0 0 0 1.5.86L17 13v5a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v5L6.5 4.64A1 1 0 0 0 5 5.5z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  arrowUpRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="16" height="16"><path d="M7 17L17 7M8 7h9v9"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z"/></svg>',
};

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtTime = (s) => {
  s = Math.max(0, Math.round(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

export async function loadContent() {
  const r = await fetch('/api/content', { cache: 'no-store' });
  if (!r.ok) throw new Error('İçerik yüklenemedi');
  return r.json();
}

export const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- nav ---------- */
export function initNav() {
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('is-solid', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const btn = document.querySelector('.menu-btn');
  btn?.addEventListener('click', () => document.body.classList.toggle('menu-open'));
  document.querySelectorAll('.mobile-menu a').forEach((a) => a.addEventListener('click', () => document.body.classList.remove('menu-open')));

  // DAW tarzı zaman kodu: sayfada geçen süre (SS:DD:SN:KARE)
  const tc = document.querySelector('[data-timecode]');
  if (tc) {
    const t0 = performance.now();
    const tick = () => {
      const ms = performance.now() - t0;
      const f = Math.floor((ms % 1000) / 1000 * 24);
      const s = Math.floor(ms / 1000);
      tc.textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60, f].map((n) => String(n).padStart(2, '0')).join(':');
      requestAnimationFrame(tick);
    };
    tick();
  }
}

/* ---------- arka plan: soluk stüdyo fotoğrafları ---------- */
// Bölüm değiştikçe iki katman arasında yumuşak geçiş yapar.
export function initBackdrop(images) {
  const el = document.createElement('div');
  el.className = 'backdrop';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<img alt=""><img alt=""><i></i>';
  document.body.prepend(el);
  const layers = [...el.querySelectorAll('img')];
  images.forEach((src) => { const i = new Image(); i.src = src; });
  let front = 0, current = null;
  return function show(src) {
    if (!src || src === current) return;
    current = src;
    const next = layers[1 - front];
    next.src = src;
    next.classList.add('is-on');
    layers[front].classList.remove('is-on');
    front = 1 - front;
  };
}

/* ---------- reveal ---------- */
export function initReveal(root = document) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  root.querySelectorAll('.reveal, .split').forEach((el) => io.observe(el));
}

// Başlık satırlarını maskelenmiş satırlara böler: "Satır 1|Satır 2"
export function splitLines(html) {
  return html.split('|').map((l) => `<span class="split-line"><span>${l}</span></span>`).join('');
}

export function hideLoader() {
  const l = document.querySelector('.loader');
  if (!l) return;
  setTimeout(() => l.classList.add('is-done'), 250);
  setTimeout(() => l.remove(), 1400);
}

export function setMeta(site, title) {
  document.title = title || site.seoTitle || site.name;
  const d = document.querySelector('meta[name="description"]');
  if (d && site.seoDescription) d.content = site.seoDescription;
}

/* ---------- footer ---------- */
export function renderFooter(site) {
  const el = document.querySelector('[data-footer]');
  if (!el) return;
  const links = [['Instagram', site.instagram], ['YouTube', site.youtube], ['Spotify', site.spotifyPlaylist]].filter(([, u]) => u);
  el.innerHTML = `
    <div class="footer-top">
      <div class="footer-brand">
        <a class="brand" href="/"><img src="/assets/pm-logo.webp" alt=""><span>Presto Müzik</span></a>
        <p>Eskişehir'de kayıt, prodüksiyon, mix & mastering ve klip stüdyosu.</p>
      </div>
      <nav class="footer-col"><h4 class="mono">Menü</h4>
        <a href="/#hizmetler">Hizmetler</a><a href="/#studyo">Stüdyo</a><a href="/#sanatcilar">Sanatçılar</a><a href="/#klipler">Klipler</a><a href="/#iletisim">İletişim</a>
      </nav>
      <div class="footer-col"><h4 class="mono">İletişim</h4>
        <a href="tel:${esc(String(site.phone || '').replace(/\s/g, ''))}">${esc(site.phone)}</a>
        <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>
        <span>${esc(site.address)}<br>${esc(site.city)}</span>
      </div>
      <div class="footer-col"><h4 class="mono">Takip et</h4>
        ${links.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n} ↗</a>`).join('')}
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} ${esc(site.legalName)}. Tüm hakları saklıdır.</span>
      <a href="https://kreatifik.com" target="_blank" rel="noopener">Bu site <b>kreatifik.com</b> tarafından yapılmıştır.</a>
    </div>`;
}
