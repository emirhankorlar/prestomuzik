// İçerikte eksik kalan yeni alanlar için varsayılanlar (eski kayıtlar da sorunsuz açılsın).
// Hem site hem yönetim paneli içeriği yükledikten sonra withDefaults'tan geçirir.

// Ana sayfa bölümleri: id sabit, sıra / menü / başlık / arka plan panelden değişir.
// scene: arka plandaki 3D efekt (wave = nokta dalgası, vinyl = plak), fade: 0..1 parlaklık
export const SECTION_DEFAULTS = {
  about: { anchor: 'hakkimizda', name: 'Hakkımızda', title: 'Notaların ötesinde bir anlatım.', scene: 'wave', fade: 0.45, menu: false },
  services: { anchor: 'hizmetler', name: 'Hizmetler', label: 'Neler yapıyoruz', title: 'Hizmet listesi', text: 'Fikirden yayına tek çatı altında: kayıt, prodüksiyon, mix & mastering, görsel ve dağıtım.', scene: 'wave', fade: 0.45, menu: true },
  studio: { anchor: 'studyo', name: 'Stüdyo', title: 'İçeriden bir tur', text: 'Stüdyoyu gezmeye gel', scene: 'wave', fade: 0.3, menu: true },
  artists: { anchor: 'sanatcilar', name: 'Sanatçılar', label: 'Kadro', title: 'Presto kadrosu', text: 'Stüdyomuzda üreten, Presto çatısı altında yayınlanan sanatçılar ve ekibimiz. Plağı çek, dinlemeye başla.', scene: 'vinyl', fade: 0.4, menu: true },
  tracks: { anchor: 'dinle', name: 'Dinle', label: 'Stüdyodan çıkanlar', title: 'Son çıkanlar — dinle.', scene: 'vinyl', fade: 0.4, menu: false },
  clips: { anchor: 'klipler', name: 'Klipler', label: 'Presto Medya', title: 'Çektiğimiz klipler', text: "YouTube'da izle", scene: 'vinyl', fade: 0.35, menu: true },
  contact: { anchor: 'iletisim', name: 'İletişim', title: 'Aynı notada buluşalım.', scene: 'wave', fade: 0.45, menu: false },
};

export const COLOR_DEFAULTS = { accent: '#ff8a1f', accent2: '#ff3b2f', logo1: '#ff8a1f', logo2: '#ffffff' };

export const TEAM_CATEGORIES = ['Prodüktör', 'Yönetmen', 'AI Video Prodüktör', 'Cover Art Artist'];

export function withDefaults(c) {
  const site = (c.site = c.site || {});
  site.colors = { ...COLOR_DEFAULTS, ...(site.colors || {}) };
  if (site.logoScale == null) site.logoScale = 1.1;
  site.menuLinks = site.menuLinks || [];

  // bölümler: kayıtlı sıra korunur, eksik olanlar sona eklenir, bilinmeyenler atılır
  const saved = (site.sections || []).filter((s) => SECTION_DEFAULTS[s.id]);
  for (const id of Object.keys(SECTION_DEFAULTS)) if (!saved.some((s) => s.id === id)) saved.push({ id });
  site.sections = saved.map((s) => {
    const d = SECTION_DEFAULTS[s.id];
    const legacyTitle = s.id === 'about' ? site.aboutTitle : s.id === 'contact' ? site.contactTitle : null;
    return { id: s.id, visible: true, channel: '', label: d.label || d.name, menuName: d.name, menu: d.menu, title: legacyTitle || d.title, text: d.text || '', scene: d.scene, fade: d.fade, ...s };
  });
  delete site.aboutTitle;
  delete site.contactTitle;

  c.services = c.services || [];
  c.gallery = c.gallery || [];
  c.clips = c.clips || [];
  c.artists = c.artists || [];
  c.team = c.team || [];
  c.teamCategories = c.teamCategories || [...TEAM_CATEGORIES];
  site.artistsLabel = site.artistsLabel || 'Sanatçılar';
  return c;
}

export const sectionAnchor = (id) => SECTION_DEFAULTS[id]?.anchor || id;
