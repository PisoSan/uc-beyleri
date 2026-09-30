# Uç Beyleri

Anadolu beylikleri döneminde geçen, kalıcı dünyalı mobil strateji oyunu.

## APK nasıl indirilir?
Her yüklemede APK otomatik derlenir. Deponun sağ tarafındaki **Releases** bölümüne gir,
en üstteki sürümdeki `uc-beyleri-N.apk` dosyasını indir ve telefona kur.

## Klasörler
- `oyun/` — oyunun kaynak dosyaları
  - `core.js`: bütün kurallar (kaynak, bina, birlik, savaş, fetih, klan, pazar, rakip beyler). İleride sunucuda da çalışacak.
  - `ui.html`: telefon arayüzü
  - `scene.js`: köy görünümü
  - `mapcastle.js`, `mapmoves.js`: harita kaleleri ve ordu animasyonları
- `tools/build.js` — kaynakları tek dosyada birleştirir (`node tools/build.js`)
- `app/` — Android uygulaması (oyunu tam ekran gösterir)

## Kendi bilgisayarında derlemek
1. `node tools/build.js`
2. Android Studio'da klasörü aç, **Build → Generate App Bundles or APKs → Generate APKs**.

## Arkadaşlarla oynama (Supabase)

- `oyun/net.js`: anonim giriş, dünya kurma/katılma (6 harfli kod), sıkıştırılmış dünya kaydı ve 4 saniyede bir senkron.
- `supabase/migrations/…_cok_oyunculu.sql`: tablolar, güvenlik kuralları ve fonksiyonlar. Supabase SQL Editor'de bir kez çalıştırılır.
- Her cihaz hamlesini kendi uygular ve sürüm kontrolüyle kaydeder. Çakışmada hamle yeni duruma yeniden uygulanır. Rastgelelik tohumlu olduğu için savaş sonuçları her cihazda aynıdır.
