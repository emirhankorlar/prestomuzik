# Presto Müzik — web sitesi + yönetim paneli

Veritabanı yok, npm paketi yok. Tüm içerik `data/content.json` içinde, yüklenen dosyalar `public/uploads/` içinde durur.

## Çalıştırma

```bash
node server.js            # http://localhost:3000
PORT=8080 node server.js  # farklı port
```

Node 18 veya üzeri gerekir.

- Site: `/`
- Sanatçı sayfası: `/sanatci/<adres>` (örn. `/sanatci/sky-g`)
- Yönetim paneli: `/admin`, ilk şifre **presto2026**. İlk girişten sonra **Ayarlar** sekmesinden değiştirin.
  (Sunucuyu ilk kez `ADMIN_PASSWORD=... node server.js` ile başlatırsanız ilk şifre o olur.)

## Panelden neler değişir

- **Sanatçılar:** ekle, sil, sırala. Spotify sanatçı linkini yapıştırıp **Spotify'dan çek**'e basınca popüler parçalar, kapaklar, 30 sn önizlemeler ve profil fotoğrafı otomatik iner. Biyografi, renk, fotoğraf, sosyal linkler ve YouTube videoları elle düzenlenir.
- **Genel metinler:** giriş başlığı, hakkımızda yazısı, rakamlar, iletişim, adres, SEO.
- **Hizmetler**, **Stüdyo galerisi**, **Klipler**
- Her kayıtta eski içerik `data/backups/` klasörüne yedeklenir (son 30 kayıt).

## GitHub Pages ile yayın (sunucusuz)

`main` dalına her push'ta `.github/workflows/pages.yml` siteyi Pages'e yayınlar
(repo ayarlarında **Settings → Pages → Source: GitHub Actions** seçili olmalı).

- Site: `https://<kullanıcı>.github.io/<repo>/`
- Admin: `https://<kullanıcı>.github.io/<repo>/admin.html` — giriş şifreyle değil, **GitHub token** ile yapılır.
  Token hiçbir yere kaydedilmez, sadece o sekmede tutulur.
  - GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token
  - Repository access: sadece bu repo
  - Permissions: **Contents: Read and write**, **Actions: Read and write**
- Kaydet'e basınca `data/content.json` repoya commit edilir, site ~1 dakikada güncellenir.
- Yüklenen görseller/sesler `public/uploads/` klasörüne commit edilir.
- "Spotify'dan çek" butonu `.github/workflows/spotify-import.yml` işini tetikler (~1 dk sürer).

## Kendi sunucunda yayın

Node.js çalıştırabilen her yerde çalışır: VPS, cPanel "Setup Node.js App", Render, Railway vb.
Başlangıç dosyası `server.js`. Yayına alırken sunucuda **`data/` ve `public/uploads/` klasörleri kalıcı olmalı**,
çünkü panelden yapılan değişiklikler buraya yazılıyor. HTTPS'i reverse proxy (nginx/Cloudflare) üzerinden verin.

## Dosya yapısı

```
server.js            statik sunucu + API (giriş, içerik, dosya yükleme, Spotify içe aktarma)
scripts/seed.js      ilk içeriği oluşturur (bir kez; --force ile yeniden)
data/content.json    sitenin tüm içeriği
public/              index.html, artist.html, admin.html, css/, js/, assets/, uploads/, vendor/three
```
