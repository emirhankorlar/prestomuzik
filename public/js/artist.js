import { loadContent, initNav, initReveal, initBackdrop, renderFooter, esc, icons, fmtTime, ytThumb, splitLines, applyColors, renderMenu, mountWhatsApp, accentTitle, clampRows, SOCIALS } from './common.js';
import { player, mountMiniPlayer, bindTrackList } from './player.js';
import { initPortrait } from './artist3d.js';

const $ = (s, r = document) => r.querySelector(s);

const content = await loadContent();
const slug = new URLSearchParams(location.search).get('id') || '';
const artist = content.artists.find((a) => a.slug === slug);
if (!artist) location.replace('index.html#sanatcilar');

applyColors(content.site);
const accent = artist.accent || content.site.colors.accent;
document.documentElement.style.setProperty('--accent', accent);
document.title = `${artist.name} — Presto Müzik`;
document.querySelector('meta[name="description"]').content = artist.bio?.[0] || `${artist.name}, Presto Müzik sanatçısı.`;

renderMenu(content.site, { prefix: 'index.html', extra: [{ name: 'Ana Sayfa', href: './' }] });
initNav();
mountMiniPlayer();
mountWhatsApp(content.site);

// önizlemeden tam şarkıya: parçaya özel link varsa o, yoksa sanatçının Spotify profili
const profile = artist.socials?.spotify || (artist.spotifyId && `https://open.spotify.com/artist/${artist.spotifyId}`) || '';
const tracks = (artist.tracks || []).map((t) => ({ ...t, artistImage: artist.image, profile }));
const playable = tracks.filter((t) => t.preview);

/* ---------- render ---------- */
$('[data-role]').textContent = artist.role || '';
$('[data-realname]').textContent = artist.realName || '';
$('[data-name]').innerHTML = splitLines(esc(artist.name));
$('[data-tagline]').textContent = artist.tagline || '';
$('[data-bio]').innerHTML = (artist.bio || []).map((p) => `<p>${esc(p)}</p>`).join('');

const s = artist.socials || {};
$('[data-links]').innerHTML = SOCIALS.filter(([k]) => s[k])
  .map(([k, n, v]) => `<a href="${esc(s[k])}" target="_blank" rel="noopener">${n} <span>${v} ↗</span></a>`).join('');

$('[data-tracks-title]').innerHTML = accentTitle(artist.tracksTitle || 'Popüler parçalar');
const profileLink = $('[data-profile]');
if (profile) profileLink.href = profile;
else profileLink.closest('p').hidden = true;

const list = $('[data-tracks]');
list.innerHTML = tracks.map((t, i) => `
  <li class="track reveal">
    <span class="track-i">${String(i + 1).padStart(2, '0')}</span>
    <img class="track-cover" src="${esc(t.cover || artist.image)}" alt="" loading="lazy">
    <div><div class="track-title">${esc(t.title)}</div><div class="track-artist">${esc(t.artists || artist.name)}</div></div>
    <span class="track-dur">${fmtTime(t.duration)}</span>
    <span class="track-play">${icons.play}<span class="eq"><i></i><i></i><i></i></span></span>
  </li>`).join('');
bindTrackList(list, tracks);

const videos = artist.videos || [];
if (!videos.length) $('#videolar').remove();
$('[data-videos]').innerHTML = videos.map((v) => `
  <div class="clip reveal">
    <div class="clip-media" data-yt="${esc(v.youtubeId)}">
      <img src="${ytThumb(v.youtubeId)}" alt="" loading="lazy" onerror="this.onerror=null;this.classList.add('lb');this.src='https://i.ytimg.com/vi/${esc(v.youtubeId)}/hqdefault.jpg'">
      <button class="clip-play" aria-label="Oynat"><span>${icons.play}</span></button>
    </div>
    <h3>${esc(v.title)}</h3>
  </div>`).join('');
document.querySelectorAll('[data-yt]').forEach((m) => m.addEventListener('click', () => {
  player.audio.pause();
  m.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${m.dataset.yt}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
}, { once: true }));
clampRows($('[data-videos]'), $('[data-more]'));

const others = content.artists.filter((a) => a.slug !== artist.slug);
if (!others.length) document.querySelector('.a-others').remove();
$('[data-others]').innerHTML = others.map((a, i) => `
  <a class="sleeve sleeve--sm reveal" href="artist.html?id=${esc(a.slug)}" style="--accent:${esc(a.accent || content.site.colors.accent)}">
    <div class="sleeve-stage">
      <div class="vinyl"><img src="${esc(a.tracks?.[0]?.cover || a.image)}" alt=""></div>
      <div class="sleeve-cover">
        <img src="${esc(a.image)}" alt="${esc(a.name)}" loading="lazy">
        <span class="sleeve-tag mono">${esc(a.tag || `PM-${String(content.artists.indexOf(a) + 1).padStart(3, '0')}`)}</span>
        <h3 class="display sleeve-name">${esc(a.name)}</h3>
      </div>
    </div>
    <div class="sleeve-meta mono"><b>${esc(a.role || '')}</b><span>${a.tracks?.length || 0} parça →</span></div>
  </a>`).join('');
renderFooter(content.site);

initReveal();

/* ---------- şu an çalıyor ---------- */
const now = $('[data-now]');
$('[data-now-toggle]').addEventListener('click', () => {
  if (player.state.track) player.toggle();
  else if (playable.length) player.play(playable, 0);
});
const nowLink = $('[data-now-link]');
const setNow = (t) => {
  $('[data-now-title]').textContent = t.title;
  const href = t.link || t.profile;
  nowLink.hidden = !href;
  if (href) { nowLink.href = href; nowLink.textContent = /spotify\.com/.test(href) ? "Spotify'da dinle ↗" : 'Tamamını dinle ↗'; }
};
if (playable[0]) setNow(playable[0]);
player.on(({ track, playing }) => {
  now.classList.toggle('is-playing', playing);
  if (track) setNow(track);
});
player.audio.addEventListener('timeupdate', () => {
  const a = player.audio;
  $('[data-now-bar]').style.width = `${(a.currentTime / (a.duration || 30)) * 100}%`;
  $('[data-now-time]').textContent = fmtTime(a.currentTime);
});

try {
  await initPortrait($('#scene'), { image: artist.image, accent, cover: playable[0]?.cover });
} catch (err) {
  console.warn('WebGL başlatılamadı', err);
}

// sayfa başında büyük oynatıcı görünür; mini oynatıcı aşağı inince çıkar
const onTop = () => document.body.classList.toggle('at-top', scrollY < innerHeight * 0.6);
addEventListener('scroll', onTop, { passive: true });
onTop();

// arka planda soluk stüdyo fotoğrafları, aşağı indikçe değişir
const showBackdrop = initBackdrop(content.gallery.map((g) => g.src));
const pageSections = [...document.querySelectorAll('main > section')];
const onSection = () => {
  const mid = scrollY + innerHeight * 0.5;
  let i = 0;
  pageSections.forEach((s, k) => { if (s.offsetTop <= mid) i = k; });
  if (content.gallery.length) showBackdrop(content.gallery[(i + 2) % content.gallery.length].src);
};
addEventListener('scroll', onSection, { passive: true });
onSection();
