// Oyun kaynaklarını (oyun/) tek bir HTML dosyasında birleştirir.
// Çıktılar: app/src/main/assets/index.html (Android) ve dist/uc-beyleri.html (tarayıcı)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = f => fs.readFileSync(path.join(root, 'oyun', f), 'utf8');
const page = src('ui.html')
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
const html = head + page.slice(0, cut) + '\n</head><body>\n' + page.slice(cut) + '\n</body></html>\n';
for (const out of ['app/src/main/assets/index.html', 'dist/uc-beyleri.html']) {
  fs.mkdirSync(path.dirname(path.join(root, out)), { recursive: true });
  fs.writeFileSync(path.join(root, out), html);
}
console.log('Oyun dosyası üretildi:', (html.length / 1024).toFixed(0), 'KB');
