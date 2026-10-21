// Admin panelinin sunucuyla konuştuğu katman: yerelde server.js, yayında Vercel fonksiyonları (/api/*).
const fail = (msg, extra = {}) => Object.assign(new Error(msg), extra);


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
    load: async () => (await fetch('api/content?fresh=1', { cache: 'no-store' })).json(),
    save: (content) => api('api/content', { method: 'PUT', body: content }),
    async upload(file, dataUrl) { return (await api('api/upload', { method: 'POST', body: { name: file.name, data: dataUrl } })).url; },
    spotify: (url, slug) => api('api/spotify', { method: 'POST', body: { url, slug } }),
    password: (current, next) => api('api/password', { method: 'POST', body: { current, next } }),
    preview: (u) => u,
    savedMessage: 'Kaydedildi — site güncellendi',
  };
}

export async function createBackend() {
  return serverBackend();
}
