// Oyun kaynaklarını (oyun/) tek bir HTML dosyasında birleştirir.
// Çıktılar: app/src/main/assets/index.html (Android) ve dist/uc-beyleri.html (tarayıcı)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = f => fs.readFileSync(path.join(root, 'oyun', f), 'utf8');
const fontCss = src('fonts/fonts.css').replace(/url\(([\w.-]+\.woff2)\)/g, (m, f) => 'url(data:font/woff2;base64,' + fs.readFileSync(path.join(root, 'oyun', 'fonts', f)).toString('base64') + ')');
const page = src('ui.html')
  .replace('/*FONTS*/', () => fontCss)
  .replace('/*CORE*/', () => src('core.js'))
  .replace('/*NET*/', () => src('net.js'))
  .replace('/*SFX*/', () => src('sfx.js'))
  .replace('/*SCENE*/', () => src('scene.js'))
  .replace('/*SCENE3D*/', () => src('scene3d.js'))
  .replace('/*THREE*/', () => src('vendor/three.min.js'))
  .replace('/*MAPCASTLE*/', () => src('mapcastle.js'))
  .replace('/*MAPMOVES*/', () => src('mapmoves.js'));
const head = '<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n' +
  '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:0}html,body{margin:0;height:100%}[hidden]{display:none!important}</style>\n';
const cut = page.indexOf('</style>') + '</style>'.length;
// derleme numarası (CI'da APK için verilir); giriş ekranında görünür
const BUILD = String(process.env.UB_BUILD || '').replace(/[^0-9a-z]/gi, '');
const head2 = (b) => head + (b ? `<script>window.UB_BUILD='${b}'</script>\n` : '');
const html = head2(BUILD) + page.slice(0, cut) + '\n</head><body>\n' + page.slice(cut) + '\n</body></html>\n';
for (const out of ['app/src/main/assets/index.html', 'dist/uc-beyleri.html']) {
  fs.mkdirSync(path.dirname(path.join(root, out)), { recursive: true });
  fs.writeFileSync(path.join(root, out), html);
}
// Web sürümü (iPhone / tarayıcı): site/ klasörü GitHub Pages'e yüklenir
const webHead = '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n' +
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="Uç Beyleri">\n' +
  '<meta name="theme-color" content="#0f1829">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icon-180.png">\n<link rel="icon" href="icon-192.png">\n';
const site = path.join(root, 'site');
fs.mkdirSync(site, { recursive: true });
fs.writeFileSync(path.join(site, 'index.html'), (head2('web') + html.slice(head2(BUILD).length)).replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n' + webHead));
for (const f of ['icon-180.png', 'icon-192.png', 'icon-512.png']) fs.copyFileSync(path.join(root, 'oyun', 'web', f), path.join(site, f));
fs.writeFileSync(path.join(site, 'manifest.webmanifest'), JSON.stringify({
  name: 'Uç Beyleri', short_name: 'Uç Beyleri', lang: 'tr', start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
  background_color: '#0f1829', theme_color: '#0f1829',
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
}, null, 2));
// ---------- Divan: yönetim uygulaması (ayrı APK + site/yonetim) ----------
const adminPage = src('yonetim.html').replace('/*FONTS*/', () => fontCss).replace('/*CORE*/', () => src('core.js')).replace('/*NET*/', () => src('net.js'));
const acut = adminPage.indexOf('</style>') + '</style>'.length;
const ahead = '<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="robots" content="noindex">\n';
const adminHtml = ahead + adminPage.slice(0, acut) + '\n</head><body>\n' + adminPage.slice(acut) + '\n</body></html>\n';
fs.mkdirSync(path.join(root, 'yonetim/src/main/assets'), { recursive: true });
fs.writeFileSync(path.join(root, 'yonetim/src/main/assets/index.html'), adminHtml);
const asite = path.join(site, 'yonetim'); fs.mkdirSync(asite, { recursive: true });
fs.writeFileSync(path.join(asite, 'index.html'), adminHtml.replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="Divan">\n<meta name="theme-color" content="#15110e">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="divan-180.png">\n<link rel="icon" href="divan-192.png">\n'));
for (const f of ['divan-180.png', 'divan-192.png', 'divan-512.png']) fs.copyFileSync(path.join(root, 'oyun', 'web', f), path.join(asite, f));
fs.writeFileSync(path.join(asite, 'manifest.webmanifest'), JSON.stringify({ name: 'Divan · Uç Beyleri Yönetim', short_name: 'Divan', lang: 'tr', start_url: './', scope: './', display: 'standalone', background_color: '#15110e', theme_color: '#15110e',
  icons: [{ src: 'divan-192.png', sizes: '192x192', type: 'image/png' }, { src: 'divan-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2));
console.log('Yönetim uygulaması üretildi:', (adminHtml.length / 1024).toFixed(0), 'KB');
console.log('Oyun dosyası üretildi:', (html.length / 1024).toFixed(0), 'KB');
