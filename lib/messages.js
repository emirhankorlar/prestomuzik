// İletişim formundan gelen mesajı doğrular ve temizler (yerel sunucu ve Vercel ortak kullanır).
const LIMITS = { name: 100, phone: 40, service: 100, message: 3000 };

function cleanMessage(body) {
  const b = body || {};
  // botlar gizli "website" alanını doldurur; sessizce yok sayılır
  if (b.website) return { spam: true };
  const msg = { date: new Date().toISOString(), via: b.via === 'mail' ? 'mail' : 'wa' };
  for (const [k, max] of Object.entries(LIMITS)) msg[k] = String(b[k] || '').trim().slice(0, max);
  if (!msg.name) return { error: 'Ad soyad gerekli' };
  return { msg };
}

module.exports = { cleanMessage };
