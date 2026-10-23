// Global önizleme oynatıcı + WebAudio analizörü (3D sahneler sesle tepki versin diye).
import { icons, esc } from './common.js';

const audio = new Audio();
audio.crossOrigin = 'anonymous';
audio.preload = 'none';

let ctx, analyser, freq;
let queue = [];
let index = -1;
const listeners = new Set();
const levels = { bass: 0, mid: 0, high: 0, level: 0 };

function ensureGraph() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.8;
  freq = new Uint8Array(analyser.frequencyBinCount);
  ctx.createMediaElementSource(audio).connect(analyser);
  analyser.connect(ctx.destination);
}

function emit() { listeners.forEach((fn) => fn(state())); }

function state() {
  return { track: queue[index] || null, index, queue, playing: !audio.paused, time: audio.currentTime, duration: audio.duration || 30 };
}

const band = (from, to) => {
  let s = 0;
  for (let i = from; i < to; i++) s += freq[i];
  return s / ((to - from) * 255);
};

export const player = {
  audio,
  get state() { return state(); },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  async play(list, i = 0) {
    ensureGraph();
    if (ctx && ctx.state === 'suspended') await ctx.resume();
    if (list) queue = list.filter((t) => t.preview);
    if (!queue.length) return;
    index = (i + queue.length) % queue.length;
    const t = queue[index];
    if (audio.dataset.src !== t.preview) {
      audio.src = t.preview;
      audio.dataset.src = t.preview;
    }
    try { await audio.play(); } catch (e) { console.warn(e); }
    emit();
  },

  toggle() {
    if (index < 0) return;
    if (audio.paused) { ctx?.resume(); audio.play(); } else audio.pause();
  },

  next() { if (queue.length) this.play(null, index + 1); },

  isCurrent(t) { return queue[index] && t && queue[index].preview === t.preview; },

  // 0..1 seviyeleri; her karede çağrılır
  levels() {
    if (!analyser || audio.paused) {
      levels.bass *= 0.92; levels.mid *= 0.92; levels.high *= 0.92; levels.level *= 0.92;
      return levels;
    }
    analyser.getByteFrequencyData(freq);
    levels.bass = band(1, 8);
    levels.mid = band(8, 48);
    levels.high = band(48, 160);
    levels.level = band(1, 160);
    return levels;
  },
};

audio.addEventListener('play', emit);
audio.addEventListener('pause', emit);
audio.addEventListener('ended', () => player.next());

/* ---------- mini player UI ---------- */
export function mountMiniPlayer() {
  const el = document.createElement('div');
  el.className = 'mini';
  el.innerHTML = `
    <img alt="">
    <div class="mini-info">
      <div class="mini-title"></div>
      <div class="mini-artist"></div>
      <div class="mini-bar"><i></i></div>
    </div>
    <div class="mini-ctrl">
      <a class="mini-link" target="_blank" rel="noopener" aria-label="Tamamını dinle" hidden>${icons.arrowUpRight}</a>
      <button class="mini-toggle" aria-label="Oynat / duraklat">${icons.play}${icons.pause}</button>
      <button class="mini-next" aria-label="Sonraki">${icons.next}</button>
    </div>`;
  document.body.append(el);
  const bar = el.querySelector('.mini-bar i');
  el.querySelector('.mini-toggle').onclick = () => player.toggle();
  el.querySelector('.mini-next').onclick = () => player.next();
  el.querySelector('.mini-bar').onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (audio.duration) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  };
  audio.addEventListener('timeupdate', () => { bar.style.width = `${(audio.currentTime / (audio.duration || 30)) * 100}%`; });
  player.on(({ track, playing }) => {
    if (!track) return;
    el.classList.add('is-on');
    el.classList.toggle('is-playing', playing);
    el.querySelector('img').src = track.cover || track.artistImage || '';
    el.querySelector('.mini-title').innerHTML = `${esc(track.title)} <span class="mono" style="color:var(--accent);font-size:9px">· önizleme</span>`;
    el.querySelector('.mini-artist').textContent = track.artists || '';
    // önizlemeden tam şarkıya: parçaya özel link, yoksa sanatçının Spotify profili
    const link = el.querySelector('.mini-link');
    const href = track.link || track.profile;
    link.hidden = !href;
    if (href) { link.href = href; link.title = /spotify\.com/.test(href) ? "Spotify'da dinle" : 'Tamamını dinle'; }
    document.body.classList.add('has-mini');
  });
  return el;
}

// Bir .track listesi için oynat durumlarını senkronlar
export function bindTrackList(listEl, tracks) {
  listEl.querySelectorAll('.track').forEach((row, i) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const t = tracks[i];
      if (!t.preview) {
        const href = t.link || (t.spotifyId ? `https://open.spotify.com/track/${t.spotifyId}` : t.profile);
        if (href) open(href, '_blank', 'noopener');
        return;
      }
      if (player.isCurrent(t)) return player.toggle();
      const playable = tracks.filter((x) => x.preview);
      player.play(playable, playable.indexOf(t));
    });
  });
  const sync = () => {
    listEl.querySelectorAll('.track').forEach((row, i) => {
      const cur = player.isCurrent(tracks[i]);
      row.classList.toggle('is-playing', cur);
      row.classList.toggle('is-paused', cur && audio.paused);
    });
  };
  player.on(sync);
}
