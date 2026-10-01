// ============================================================
//  KÖY — 3B (three.js / WebGL)
//  Gerçek ışık ve gölge, dokulu ve kabartmalı yüzeyler, döndürülebilir kamera.
//  Yerleşim, binaların seviye ekleri, yollar ve işçi rotaları 2B sahneyle aynı verileri kullanır.
//  WebGL yoksa 2B sahne (scene.js) kullanılır.
// ============================================================
const V3 = (() => {
const T = window.THREE;
let ok = false;
try { const c = document.createElement('canvas'); ok = !!(T && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) {}
if (!ok) return { ok: false };

const st = { r: null, scene: null, cam: null, cv: null, ov: null, sun: null, hemi: null, vil: null, sig: '', world: null, bgrp: null, dyn: [], flags: [], smokes: [], picks: [], anchors: {}, raf: 0, last: 0, night: null, glow: null,
  view: { tx: 6.6, tz: 7.6, yaw: Math.PI / 4, pitch: .86, dist: 23 }, ptrs: new Map(), pinch: null, moved: false, quality: 1 };
const DEF_VIEW = { tx: 6.6, tz: 7.6, yaw: Math.PI / 4, pitch: .86, dist: 23 };
let OFF3 = [0, 0];
const PCOL = () => (S && S.player ? S.player.color : '#e3b341');
const X = u => u + OFF3[0], Z = v => v + OFF3[1];

// ---------- dokular ve malzemeler ----------
const TEXI = {   // 2B dokular: mantıksal boyut / birim başına piksel
  stone: [120, 72, 44], fort: [160, 84, 44], plaster: [80, 80, 44], roof: [48, 40, 30], lead: [40, 40, 44], wood: [48, 64, 44], turq: [20, 20, 70],
  dirt: [96, 96, 44], pave: [48, 48, 44], rock: [96, 96, 44], wheat: [32, 32, 40], crop: [33, 32, 40], plowed: [32, 32, 40],
};
const MATP = {
  stone: { r: .88, n: .9 }, fort: { r: .92, n: 1.1 }, plaster: { r: .95, n: .25 }, roof: { r: .72, n: 1.2 }, lead: { r: .42, m: .55, n: .5 }, wood: { r: .85, n: .8 },
  turq: { r: .28, m: .05, n: .6 }, dirt: { r: 1, n: .5 }, pave: { r: .9, n: 1 }, rock: { r: .95, n: 1.3 }, wheat: { r: 1, n: .6 }, crop: { r: 1, n: .5 }, plowed: { r: 1, n: .8 },
};
function normalFrom(cv, k) {
  const w = cv.width, h = cv.height, src = cv.getContext('2d').getImageData(0, 0, w, h).data, out = document.createElement('canvas'); out.width = w; out.height = h;
  const og = out.getContext('2d'), id = og.createImageData(w, h), d = id.data, L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (src[i * 4] * .3 + src[i * 4 + 1] * .59 + src[i * 4 + 2] * .11) / 255;
  const at = (x, y) => L[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * k * 2, dy = (at(x, y + 1) - at(x, y - 1)) * k * 2, nz = 1 / Math.hypot(dx, dy, 1);
    const o = (y * w + x) * 4; d[o] = (-dx * nz * .5 + .5) * 255; d[o + 1] = (dy * nz * .5 + .5) * 255; d[o + 2] = (nz * .5 + .5) * 255; d[o + 3] = 255;
  }
  og.putImageData(id, 0, 0); return out;
}
const MATS = {};
function texMat(name) {
  if (MATS[name]) return MATS[name];
  if (!TEX) TEX = buildTex();
  const p = MATP[name] || {}, cv = TEX[name];
  const map = new T.CanvasTexture(cv); map.wrapS = map.wrapT = T.RepeatWrapping; map.colorSpace = T.SRGBColorSpace; map.anisotropy = 8;
  const nm = new T.CanvasTexture(normalFrom(cv, 2.2)); nm.wrapS = nm.wrapT = T.RepeatWrapping;
  const m = new T.MeshStandardMaterial({ map, normalMap: nm, normalScale: new T.Vector2(p.n || .8, p.n || .8), roughness: p.r != null ? p.r : .9, metalness: p.m || 0, side: T.DoubleSide });
  m.userData.sc = [TEXI[name][0] / TEXI[name][2], TEXI[name][1] / TEXI[name][2]];
  return MATS[name] = m;
}
function colMat(col, o = {}) {
  const key = col + JSON.stringify(o); if (MATS[key]) return MATS[key];
  const m = new T.MeshStandardMaterial(Object.assign({ color: col, roughness: .8, metalness: 0, side: T.DoubleSide }, o)); m.userData.sc = [1, 1];
  return MATS[key] = m;
}
const M = n => (TEXI[n] ? texMat(n) : colMat(n));

// ---------- geometri yardımcıları ----------
let G = null;   // o an kurulan bina grubu
function add(mesh, opt = {}) { mesh.castShadow = opt.shadow !== false; mesh.receiveShadow = true; if (opt.dyn) mesh.userData.dyn = true; G.add(mesh); return mesh; }
function scaleUV(geo, faces) {   // faces: [ [dimU, dimV, mat], ... ] her yüz 4 köşe
  const uv = geo.attributes.uv;
  faces.forEach(([du, dv, m], f) => { const [sx, sy] = m.userData.sc; for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * du / sx, uv.getY(i) * dv / sy); });
  uv.needsUpdate = true;
}
function box(u0, v0, w, d, z0, h, tex, top, opt = {}) {
  const geo = new T.BoxGeometry(w, h, d), ms = M(tex), mt = top === null ? ms : M(top || tex);
  scaleUV(geo, [[d, h, ms], [d, h, ms], [w, d, mt], [w, d, mt], [w, h, ms], [w, h, ms]]);
  const mesh = new T.Mesh(geo, [ms, ms, mt, mt, ms, ms]); mesh.position.set(X(u0 + w / 2), z0 + h / 2, Z(v0 + d / 2));
  return add(mesh, opt);
}
// düzlem çokgen: noktalar [u, v, z]
function poly(pts, tex, opt = {}) {
  const P3 = pts.map(([u, v, z]) => new T.Vector3(X(u), z, Z(v)));
  const e1 = P3[1].clone().sub(P3[0]).normalize(), nrm = new T.Vector3().crossVectors(P3[1].clone().sub(P3[0]), P3[P3.length - 1].clone().sub(P3[0])).normalize(), e2 = new T.Vector3().crossVectors(nrm, e1);
  const m = M(tex), [sx, sy] = m.userData.sc, pos = [], uv = [];
  for (let i = 1; i < P3.length - 1; i++) for (const p of [P3[0], P3[i], P3[i + 1]]) { pos.push(p.x, p.y, p.z); uv.push(p.dot(e1) / sx, p.dot(e2) / sy); }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
  return add(new T.Mesh(geo, m), opt);
}
function hipRoof(u0, v0, w, d, z, rh, tex, ov = .1) {
  u0 -= ov; v0 -= ov; w += 2 * ov; d += 2 * ov;
  const A = [u0, v0, z], B = [u0 + w, v0, z], C = [u0 + w, v0 + d, z], D = [u0, v0 + d, z];
  if (w >= d) { const r1 = [u0 + d / 2, v0 + d / 2, z + rh], r2 = [u0 + w - d / 2, v0 + d / 2, z + rh]; poly([B, A, r1, r2], tex); poly([A, D, r1], tex); poly([C, B, r2], tex); poly([D, C, r2, r1], tex); }
  else { const r1 = [u0 + w / 2, v0 + w / 2, z + rh], r2 = [u0 + w / 2, v0 + d - w / 2, z + rh]; poly([B, A, r1], tex); poly([A, D, r2, r1], tex); poly([C, B, r1, r2], tex); poly([D, C, r2], tex); }
  // saçak altı (alttan bakınca koyu)
  poly([A, B, C, D], '#3a2a20', { shadow: false });
}
function cyl(u, v, z0, h, r, tex, base, opt = {}) {
  const geo = new T.CylinderGeometry(opt.r1 != null ? opt.r1 : r, r, h, opt.seg || 20, 1);
  const m = tex ? M(tex) : colMat(base || '#999', { roughness: .85 });
  if (tex) { const [sx, sy] = m.userData.sc, uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * r / sx, uv.getY(i) * h / sy); }
  const mesh = new T.Mesh(geo, m); mesh.position.set(X(u), z0 + h / 2, Z(v)); return add(mesh, opt);
}
function cone(u, v, z, r, hg, base, tex) {
  const geo = new T.ConeGeometry(r, hg, 20, 1), m = tex ? M(tex) : colMat(base);
  if (tex) { const [sx, sy] = m.userData.sc, uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * r / sx, uv.getY(i) * hg / sy); }
  const mesh = new T.Mesh(geo, m); mesh.position.set(X(u), z + hg / 2, Z(v)); add(mesh);
  return [X(u), z + hg, Z(v)];
}
const GOLD = () => colMat('#e3b54e', { roughness: .3, metalness: .85 });
function alem(x, y, z) {
  const rod = new T.Mesh(new T.CylinderGeometry(.012, .012, .26, 6), GOLD()); rod.position.set(x, y + .13, z); add(rod);
  const ball = new T.Mesh(new T.SphereGeometry(.04, 10, 8), GOLD()); ball.position.set(x, y + .12, z); add(ball);
  const cr = new T.Mesh(new T.TorusGeometry(.065, .014, 6, 16, Math.PI * 1.35), GOLD()); cr.position.set(x, y + .3, z); cr.rotation.z = Math.PI * 1.17; add(cr);
}
function dome(u, v, z, r, hg, c1, c2, c3, metal) {
  const geo = new T.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const m = colMat(c2, metal ? { roughness: .35, metalness: .6 } : { roughness: .22, metalness: .08 });
  const mesh = new T.Mesh(geo, m); mesh.scale.y = hg / r; mesh.position.set(X(u), z, Z(v)); add(mesh);
  alem(X(u), z + hg, Z(v));
}
// pencere / kapı: yüzü 2B'deki gibi ön (+v) ya da sağ (+u) yüze yapıştırır
const WIN = () => st.glow || (st.glow = new T.MeshStandardMaterial({ color: '#2a2019', emissive: '#ffb45a', emissiveIntensity: 0, roughness: .6 }));
function hole(a, b, z0, z1, arch, col = '#2a2019', glow = true) {
  const front = Math.abs(a[1] - b[1]) < 1e-6, W = front ? Math.abs(b[0] - a[0]) : Math.abs(b[1] - a[1]), H = z1 - z0, rise = (arch || 0) * 2;
  const s = new T.Shape(); s.moveTo(0, 0); s.lineTo(W, 0); s.lineTo(W, H); if (rise) s.quadraticCurveTo(W / 2, H + rise * 1.4, 0, H); else s.lineTo(0, H); s.lineTo(0, 0);
  const geo = new T.ShapeGeometry(s, 8), m = glow ? WIN() : colMat(col === '#3a2414' ? '#4a2c18' : col, { roughness: .8 });
  const mesh = new T.Mesh(geo, m);
  if (front) mesh.position.set(X(Math.min(a[0], b[0])), z0, Z(a[1]) + .006);
  else { mesh.rotation.y = Math.PI / 2; mesh.position.set(X(a[0]) + .006, z0, Z(Math.max(a[1], b[1]))); }
  add(mesh, { shadow: false });
  // çerçeve ve denizlik
  if (glow) {
    const sill = new T.Mesh(new T.BoxGeometry(front ? W + .06 : .05, .025, front ? .05 : W + .06), colMat('#e8dcc0', { roughness: .8 }));
    if (front) sill.position.set(X(Math.min(a[0], b[0])) + W / 2, z0 - .012, Z(a[1]) + .02); else sill.position.set(X(a[0]) + .02, z0 - .012, Z(Math.max(a[1], b[1])) - W / 2);
    add(sill, { shadow: false });
  }
}
// bayrak: rengi oyuncu rengi, üzerinde hilal ve yıldız
const FLAGTX = {};
function flagTex(col) {
  if (FLAGTX[col]) return FLAGTX[col];
  const c = document.createElement('canvas'); c.width = 128; c.height = 80; const g = c.getContext('2d');
  g.fillStyle = col; g.fillRect(0, 0, 128, 80); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 70, 128, 10);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(50, 40, 20, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(57, 40, 16, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.6 : 8.5; g.lineTo(78 + Math.cos(a) * r, 40 + Math.sin(a) * r); } g.fill();
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return FLAGTX[col] = t;
}
function flagPole(u, v, z, h, col, s = 1) {
  cyl(u, v, z, h, .012, null, '#4a3f35', { seg: 6 });
  const top = new T.Mesh(new T.SphereGeometry(.025, 8, 6), GOLD()); top.position.set(X(u), z + h + .02, Z(v)); add(top);
  const fw = .42 * s, fh = .26 * s, geo = new T.PlaneGeometry(fw, fh, 10, 2); geo.translate(fw / 2, -fh / 2, 0);
  const m = new T.MeshStandardMaterial({ map: flagTex(col), side: T.DoubleSide, roughness: .9 });
  const mesh = new T.Mesh(geo, m); mesh.position.set(X(u), z + h - .01, Z(v)); mesh.rotation.y = -Math.PI / 4 + .3;
  if (st.thumb) { mesh.geometry.attributes.position.array.forEach((x, i, arr) => { if (i % 3 === 2) arr[i] = Math.sin(arr[i - 2] * 14) * .02 * arr[i - 2] / .42; }); add(mesh, { shadow: false }); return; }
  add(mesh, { shadow: false, dyn: true });
  st.flags.push({ mesh, base: geo.attributes.position.array.slice(), ph: u * 3 + v });
}
function smokeAt(u, v, z, ph) { st.smokes.push({ x: X(u), y: z, z: Z(v), ph }); }
function contact(u0, v0, w, d) {}   // 3B'de gerçek gölge var

// ---------- binalar (2B sahnedeki ölçülerle) ----------
function timber3(u0, v0, w, d, z0, h) {   // ahşap çatkı kirişleri (ön ve sağ yüz)
  const m = colMat('#5a3a22', { roughness: .85 }), t = .028;
  for (const z of [z0 + .02, z0 + h * .52, z0 + h - .02]) {
    let b = new T.Mesh(new T.BoxGeometry(w + .01, t, t), m); b.position.set(X(u0 + w / 2), z, Z(v0 + d) + .008); add(b, { shadow: false });
    b = new T.Mesh(new T.BoxGeometry(t, t, d + .01), m); b.position.set(X(u0 + w) + .008, z, Z(v0 + d / 2)); add(b, { shadow: false });
  }
  const n1 = Math.max(2, Math.round(w / .32)), n2 = Math.max(2, Math.round(d / .32));
  for (let i = 0; i <= n1; i++) { const b = new T.Mesh(new T.BoxGeometry(t, h, t), m); b.position.set(X(u0 + w * i / n1), z0 + h / 2, Z(v0 + d) + .008); add(b, { shadow: false }); }
  for (let i = 0; i <= n2; i++) { const b = new T.Mesh(new T.BoxGeometry(t, h, t), m); b.position.set(X(u0 + w) + .008, z0 + h / 2, Z(v0 + d * i / n2)); add(b, { shadow: false }); }
}
function konak(l) {
  const H = .9 + Math.min(l, 25) * .018, m0 = 5.35, m = 1.7, z0 = .1, fv = m0 + m, fu = m0 + m;
  box(4.75, 4.75, 2.5, 2.5, 0, z0, 'pave', 'pave');
  if (l >= 5) {
    box(4.85, 5.6, .5, 1.2, z0, H * .7, 'plaster', null); timber3(4.85, 5.6, .5, 1.2, z0, H * .7); hipRoof(4.85, 5.6, .5, 1.2, z0 + H * .7, .3, l >= 20 ? 'lead' : 'roof');
    box(5.6, 4.85, 1.2, .5, z0, H * .7, 'plaster', null); timber3(5.6, 4.85, 1.2, .5, z0, H * .7); hipRoof(5.6, 4.85, 1.2, .5, z0 + H * .7, .3, l >= 20 ? 'lead' : 'roof');
  }
  box(m0, m0, m, m, z0, .22, 'stone', null);
  box(m0, m0, m, m, z0 + .22, H - .22, 'plaster', null);
  box(m0 - .02, m0 - .02, m + .04, m + .04, z0 + H - .17, .11, 'turq', null);
  box(m0 - .05, m0 - .05, m + .1, m + .1, z0 + H - .06, .07, 'stone', 'stone');
  for (const a of [5.55, 6.65]) hole([a, fv], [a + .2, fv], z0 + .4, z0 + .66, .06);
  for (const a of [6.65, 5.55]) hole([fu, a + .2], [fu, a], z0 + .4, z0 + .66, .06);
  if (l >= 15) { box(5.8, fv - .02, .8, .16, 0, H + .36, 'stone', 'stone'); poly([[5.9, fv + .141, z0 + .1], [6.5, fv + .141, z0 + .1], [6.5, fv + .141, z0 + H + .2], [5.9, fv + .141, z0 + H + .2]], 'turq'); hole([6.02, fv + .142], [6.38, fv + .142], z0, z0 + .62, .14, '#3a2414', false); }
  else hole([6.02, fv], [6.38, fv], z0, z0 + .6, .13, '#3a2414', false);
  cyl(6.2, 6.2, z0 + H + .01, .2, .6, 'stone', '#cbbd9d');
  dome(6.2, 6.2, z0 + H + .21, .6, .62, '#b9f2e8', '#2fa596', '#10504a');
  if (l >= 20) { dome(5.1, 6.2, z0 + H * .7 + .3, .22, .24, '#d9e3ea', '#8d9ba6', '#4b5761', true); dome(6.2, 5.1, z0 + H * .7 + .3, .22, .24, '#d9e3ea', '#8d9ba6', '#4b5761', true); }
  flagPole(m0 + .1, fv - .1, z0 + H, .55, PCOL()); flagPole(fu - .1, m0 + .1, z0 + H, .55, PCOL());
  smokeAt(m0 + .3, m0 + .3, z0 + H + .1, .2);
  const minaret = (u, v) => { const h = 1.9 + Math.min(l, 25) * .02; box(u - .17, v - .17, .34, .34, 0, .35, 'stone', 'stone'); cyl(u, v, .35, h * .68, .12, 'stone'); cyl(u, v, .35 + h * .68, .05, .19, null, '#c9bb9b'); cyl(u, v, .4 + h * .68, h * .22, .1, 'stone'); const a = cone(u, v, .4 + h * .9, .12, .55, '#8d99a3', 'lead'); alem(a[0], a[1], a[2]); };
  if (l >= 8) minaret(7.35, 5.05);
  if (l >= 15) minaret(5.05, 7.35);
}
function medrese(l) {
  const H = .6 + Math.min(l, 20) * .012, u0 = 7.6, v0 = 5.2, w = 1.15, d = 1.15, fv = v0 + d;
  box(u0, v0, w, d, 0, H, 'stone', 'pave'); box(u0 - .03, v0 - .03, w + .06, d + .06, H, .07, 'stone', 'stone');
  for (const a of [v0 + .75, v0 + .3]) hole([u0 + w, a + .14], [u0 + w, a], H * .45, H * .75, .05);
  box(u0 + .3, fv - .03, .55, .15, 0, H + .28, 'stone', 'stone');
  poly([[u0 + .36, fv + .121, .05], [u0 + .79, fv + .121, .05], [u0 + .79, fv + .121, H + .18], [u0 + .36, fv + .121, H + .18]], 'turq');
  hole([u0 + .45, fv + .122], [u0 + .7, fv + .122], 0, H * .78, .12, '#3a2414', false);
  cyl(u0 + w / 2, v0 + d / 2 - .1, H + .07, .08, .3, 'stone');
  dome(u0 + w / 2, v0 + d / 2 - .1, H + .15, .3, .32, '#d9e3ea', '#8d9ba6', '#4b5761', true);
  if (l >= 10) { cyl(u0 + .12, v0 + .12, H + .07, .5, .07, 'stone'); const a = cone(u0 + .12, v0 + .12, H + .57, .08, .3, '#8d99a3', 'lead'); alem(a[0], a[1], a[2]); }
  if (l >= 15) { const ru = 8.75; box(ru, v0, .3, d, 0, .5, 'stone', 'pave'); for (let i = 0; i < 3; i++) { hole([ru + .3, v0 + d - .08 - i * .37], [ru + .3, v0 + d - .3 - i * .37], 0, .36, .07, '#3a2a1c', false); dome(ru + .15, v0 + d - .19 - i * .37, .5, .13, .13, '#d9e3ea', '#8d9ba6', '#4b5761', true); } }
}
function kervansaray(l) {
  const u0 = 3.3, v0 = 13.0, w = 1.6, d = 1.25, H = .55 + Math.min(l, 20) * .01;
  box(u0, v0, w, d, 0, H, 'stone', 'pave'); box(u0 + .12, v0 + .12, w - .24, d - .24, H - .05, .06, 'pave', 'dirt');
  for (let i = 0; i < 4; i++) box(u0 + .05 + i * .42, v0 - .02, .14, .1, H, .1, 'stone', 'stone');
  box(u0 + .5, v0 + d - .05, .6, .16, 0, H + .3, 'stone', 'stone');
  poly([[u0 + .56, v0 + d + .111, .05], [u0 + 1.04, v0 + d + .111, .05], [u0 + 1.04, v0 + d + .111, H + .2], [u0 + .56, v0 + d + .111, H + .2]], 'turq');
  hole([u0 + .64, v0 + d + .112], [u0 + .96, v0 + d + .112], 0, H * .8, .12, '#3a2414', false);
  for (const a of [u0 + .15, u0 + 1.25]) hole([a, v0 + d], [a + .15, v0 + d], H * .35, H * .7, .05);
  hole([u0 + w, v0 + .8], [u0 + w, v0 + .6], H * .35, H * .7, .05);
  dome(u0 + .8, v0 + d - .2, H + .3, .18, .18, '#d9e3ea', '#8d9ba6', '#4b5761', true);
  flagPole(u0 + .1, v0 + .1, H + .1, .45, PCOL(), .8);
  if (l >= 10) for (const [a, b] of [[u0 + w, v0 + d], [u0 + w, v0]]) { cyl(a, b, 0, H + .22, .13, 'stone'); cone(a, b, H + .22, .16, .22, '#8d99a3', 'lead'); }
  if (l >= 15) for (const a of [u0 + .35, u0 + 1.25]) dome(a, v0 + .45, H + .02, .16, .15, '#d9e3ea', '#8d9ba6', '#4b5761', true);
  const n = Math.min(3, 1 + Math.floor(l / 6));
  for (let i = 0; i < n; i++) camel(u0 - .45, v0 + .25 + i * .45, i);
}
function camel(u, v, i) {
  const g = new T.Group(), body = colMat('#c79a5e', { roughness: .95 });
  const torso = new T.Mesh(new T.SphereGeometry(.13, 12, 8), body); torso.scale.set(1.5, .7, .8); torso.position.y = .2; g.add(torso);
  const hump = new T.Mesh(new T.SphereGeometry(.07, 10, 8), body); hump.position.set(-.02, .29, 0); g.add(hump);
  const neck = new T.Mesh(new T.CylinderGeometry(.03, .04, .2, 6), body); neck.position.set(.2, .3, 0); neck.rotation.z = -.6; g.add(neck);
  const head = new T.Mesh(new T.SphereGeometry(.045, 8, 6), body); head.scale.set(1.5, .9, .9); head.position.set(.28, .39, 0); g.add(head);
  for (const [x, z] of [[-.12, .05], [-.12, -.05], [.12, .05], [.12, -.05]]) { const leg = new T.Mesh(new T.CylinderGeometry(.015, .013, .17, 5), colMat('#8a6a3e')); leg.position.set(x, .085, z); g.add(leg); }
  const bag = colMat(['#a8743e', '#8f9aa6', '#6f7f96'][i % 3], { roughness: .9 });
  for (const z of [.09, -.09]) { const b = new T.Mesh(new T.BoxGeometry(.12, .1, .05), bag); b.position.set(-.03, .24, z); g.add(b); }
  g.position.set(X(u), 0, Z(v)); g.rotation.y = -Math.PI / 2 + .2;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); G.add(g);
}
function divan() {
  const u0 = 7.6, v0 = 7.6, w = 1.0, d = .9, z = .12;
  box(u0 - .05, v0 - .05, w + .1, d + .1, 0, z, 'stone', 'pave');
  box(u0, v0, w, .08, z, .55, 'plaster', null); box(u0, v0, .08, d, z, .55, 'plaster', null);
  for (const [a, b] of [[u0 + w - .08, v0 + .25], [u0 + w - .08, v0 + .55], [u0 + .3, v0 + d - .08], [u0 + .62, v0 + d - .08], [u0 + w - .08, v0 + d - .08]]) cyl(a + .04, b + .04, z, .55, .04, 'stone');
  box(u0 + .1, v0 + .1, .6, .35, z, .08, '#8a2f2a', '#a63a33');   // minder
  box(u0 - .04, v0 - .04, w + .08, d + .08, z + .55, .08, 'turq', null);
  hipRoof(u0, v0, w, d, z + .63, .4, 'lead');
  flagPole(u0 + w / 2, v0 + d / 2, z + 1.0, .45, '#c9a23a', .8);
}
function soldier3(u, v, i, col) {   // durağan asker (birleştirilir)
  const g = new T.Group();
  const coat = colMat('#8a2f2a', { roughness: .9 }), skin = colMat('#d9b48c'), steel = colMat('#b9bcc4', { roughness: .35, metalness: .7 });
  const body = new T.Mesh(new T.CylinderGeometry(.045, .07, .2, 8), coat); body.position.y = .17; g.add(body);
  const belt = new T.Mesh(new T.CylinderGeometry(.06, .06, .02, 8), colMat('#c9a14a', { metalness: .5, roughness: .4 })); belt.position.y = .15; g.add(belt);
  for (const z of [.025, -.025]) { const lg = new T.Mesh(new T.CylinderGeometry(.015, .015, .08, 5), colMat('#2e2419')); lg.position.set(0, .04, z); g.add(lg); }
  const head = new T.Mesh(new T.SphereGeometry(.035, 8, 6), skin); head.position.y = .3; g.add(head);
  const helm = new T.Mesh(new T.ConeGeometry(.04, .07, 8), steel); helm.position.y = .345; g.add(helm);
  const spear = new T.Mesh(new T.CylinderGeometry(.006, .006, .5, 4), colMat('#6e4a26')); spear.position.set(.07, .25, 0); g.add(spear);
  const tip = new T.Mesh(new T.ConeGeometry(.012, .05, 4), steel); tip.position.set(.07, .52, 0); g.add(tip);
  const sh = new T.Mesh(new T.CylinderGeometry(.055, .055, .015, 12), colMat(col, { roughness: .6 })); sh.rotation.z = Math.PI / 2; sh.rotation.y = Math.PI / 4; sh.position.set(-.04, .18, .04); g.add(sh);
  g.position.set(X(u), 0, Z(v)); g.rotation.y = Math.PI / 4;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  G.add(g);
}
function kisla(l) {
  const H = .5 + Math.min(l, 25) * .008;
  if (l >= 6) { box(5.35, 3.5, 1.1, .8, 0, .16, 'stone', null); box(5.35, 3.5, 1.1, .8, .16, H * .85 - .16, 'plaster', null); timber3(5.35, 3.5, 1.1, .8, .16, H * .85 - .16); for (const a of [5.55, 6.05]) hole([a, 4.3], [a + .18, 4.3], .24, .4, .04); hipRoof(5.35, 3.5, 1.1, .8, H * .85, .3, 'roof'); }
  box(3.5, 3.5, 1.8, .9, 0, .18, 'stone', null); box(3.5, 3.5, 1.8, .9, .18, H - .18, 'plaster', null); timber3(3.5, 3.5, 1.8, .9, .18, H - .18);
  for (const a of [3.7, 4.0, 4.95]) hole([a, 4.4], [a + .16, 4.4], .26, .44, .04);
  hole([4.35, 4.4], [4.62, 4.4], 0, .42, .1, '#3a2414', false);
  hole([5.3, 4.15], [5.3, 3.95], .26, .44, .04);
  hipRoof(3.5, 3.5, 1.8, .9, H, .36, 'roof');
  flagPole(5.2, 3.6, H + .15, .5, PCOL(), .8);
  const n = Math.min(4, 1 + Math.floor(l / 5));
  for (let i = 0; i < n; i++) { const u = 6.75 + i * .28, v = 3.55 + (i % 2) * .2; cyl(u, v, 0, .38, .02, null, '#5e3b1f'); const bag = new T.Mesh(new T.SphereGeometry(.07, 8, 6), colMat('#d6bd7e', { roughness: 1 })); bag.scale.y = 1.4; bag.position.set(X(u), .3, Z(v)); add(bag); }
  if (l >= 12) {
    for (const [a, b] of [[3.0, 3.1], [3.32, 3.1], [3.0, 3.42], [3.32, 3.42]]) box(a, b, .06, .06, 0, 1.25, 'wood', 'wood');
    box(2.96, 3.06, .44, .44, 1.0, .08, 'wood', 'wood'); box(2.96, 3.06, .44, .04, 1.08, .16, 'wood', null); box(2.96, 3.06, .04, .44, 1.08, .16, 'wood', null);
    hipRoof(2.96, 3.06, .44, .44, 1.3, .28, 'roof', .06); flagPole(3.18, 3.28, 1.55, .35, PCOL(), .7);
  }
  // kışla önünde nizam içinde bekleyen askerler
  if (st.thumb) return;
  const save = OFF3; OFF3 = [0, 0];
  const cols = Math.min(7, 3 + Math.floor(l / 4)), rows = Math.min(4, 1 + Math.floor(l / 5));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) soldier3(2.3 + r * .32, 6.0 + c * .3, r * 7 + c, PCOL());
  soldier3(2.3, 5.65, 9, PCOL()); flagPole(2.36, 5.65, .2, .75, PCOL(), .9);
  OFF3 = save;
}
function ambar(l) {
  const H = .55 + Math.min(l, 30) * .012, big = l >= 10, u0 = 7.5, v0 = 3.5, w = big ? 1.25 : 1.1, d = big ? 1.2 : 1.1;
  box(u0, v0, w, d, 0, .14, 'stone', null); box(u0, v0, w, d, .14, H, 'wood', null);
  hole([u0 + w * .3, v0 + d], [u0 + w * .7, v0 + d], .14, .14 + H * .72, 0, '#2b1b10', false);
  for (const s of [1, -1]) { const b = new T.Mesh(new T.BoxGeometry(Math.hypot(w * .4, H * .72), .03, .02), colMat('#8a6238')); b.position.set(X(u0 + w / 2), .14 + H * .36, Z(v0 + d) + .02); b.rotation.z = s * Math.atan2(H * .72, w * .4); add(b, { shadow: false }); }
  hipRoof(u0, v0, w, d, .14 + H, .45, 'roof');
  const n = Math.min(5, 1 + Math.floor(l / 5));
  for (let i = 0; i < n; i++) box(u0 + .05 + i * .23, v0 + d + .12, .18, .18, 0, .16, 'wood', 'wood');
  if (l >= 20) { const h = .95 + Math.min(l - 20, 10) * .02; cyl(9.0, 3.85, 0, h, .26, 'stone'); const a = cone(9.0, 3.85, h, .31, .38, '#9b3b27', 'roof'); const b = new T.Mesh(new T.SphereGeometry(.03, 8, 6), GOLD()); b.position.set(a[0], a[1], a[2]); add(b); }
}
function tophane(l) {
  const H = .55 + Math.min(l, 15) * .02, u0 = 3.5, v0 = 7.3, w = 1.2, d = 1.0;
  box(u0, v0, w, d, 0, H, 'fort', 'stone');
  for (let i = 0; i < 5; i++) box(u0 + .04 + i * .26, v0 + d - .1, .12, .1, H, .1, 'fort', 'fort');
  for (let i = 0; i < 4; i++) box(u0 + w - .1, v0 + .04 + i * .26, .1, .12, H, .1, 'fort', 'fort');
  box(u0 + .15, v0 + .15, .24, .24, H, .5, 'stone', 'stone'); smokeAt(u0 + .27, v0 + .27, H + .55, .6);
  hole([u0 + .45, v0 + d], [u0 + .75, v0 + d], 0, .42, .1, '#2b1b10', false);
  hole([u0 + w, v0 + .7], [u0 + w, v0 + .55], .3, .45, .04);
  trebuchet3(5.1, 8.45);
  if (l >= 8) for (const [u, v] of [[3.75, 8.55], [4.2, 8.6]]) cannon3(u, v);
}
function trebuchet3(u, v) {
  const wd = colMat('#5e3b1f', { roughness: .9 }), beam = (a, b, t = .03) => { const A = new T.Vector3(X(a[0]), a[2], Z(a[1])), B = new T.Vector3(X(b[0]), b[2], Z(b[1])), L = A.distanceTo(B); const m = new T.Mesh(new T.BoxGeometry(t, L, t), wd); m.position.copy(A).add(B).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize()); add(m); };
  for (const dv of [-.12, .12]) { beam([u - .2, v + dv, .02], [u + .2, v + dv, .02]); beam([u - .15, v + dv, 0], [u, v + dv, .42]); beam([u + .15, v + dv, 0], [u, v + dv, .42]); }
  beam([u, v - .12, .42], [u, v + .12, .42], .025); beam([u - .38, v, .78], [u + .18, v, .3], .04);
  box(u + .14, v - .05, .1, .1, .2, .1, '#6d6a62', '#6d6a62');
}
function cannon3(u, v) {
  const iron = colMat('#2a2c31', { roughness: .4, metalness: .7 }), wd = colMat('#5e3b1f');
  const barrel = new T.Mesh(new T.CylinderGeometry(.035, .05, .32, 12), iron); barrel.rotation.z = Math.PI / 2 - .25; barrel.position.set(X(u) + .03, .12, Z(v)); add(barrel);
  for (const dz of [.06, -.06]) { const wh = new T.Mesh(new T.CylinderGeometry(.06, .06, .02, 12), wd); wh.rotation.x = Math.PI / 2; wh.position.set(X(u) - .03, .06, Z(v) + dz); add(wh); }
  for (const [dx, dz] of [[.15, .1], [.2, .12], [.18, .06]]) { const b = new T.Mesh(new T.SphereGeometry(.025, 8, 6), iron); b.position.set(X(u) + dx, .025, Z(v) + dz); add(b); }
}
function ahir(l) {
  const H = .48 + Math.min(l, 20) * .012, u0 = 10.0, v0 = 3.6, w = 1.4, d = .9;
  box(u0, v0, w, d, 0, H, 'wood', null);
  for (let i = 0; i < 3; i++) hole([u0 + .12 + i * .44, v0 + d], [u0 + .38 + i * .44, v0 + d], 0, H * .7, 0, '#2b1b10', false);
  hipRoof(u0, v0, w, d, H, .4, 'roof');
  cyl(11.65, 4.0, 0, .16, .13, null, '#d6b25e');
  fence3(10.0, 4.8, 1.8, 1.6);
  if (l >= 10) { box(9.5, 3.7, .45, .72, 0, H * .78, 'wood', null); hipRoof(9.5, 3.7, .45, .72, H * .78, .28, 'roof', .06); hole([9.6, 4.42], [9.85, 4.42], 0, H * .55, 0, '#2b1b10', false); for (const [u, v] of [[9.62, 4.65], [9.85, 4.7]]) cyl(u, v, 0, .12, .1, null, '#d6b25e'); }
  st.horsePen = { u0: X(10.15), v0: Z(4.95), w: 1.5, d: 1.3, n: Math.min(4, Math.ceil(l / 4)) };
}
function fence3(u0, v0, w, d) {
  const wd = colMat('#7a5431', { roughness: .9 });
  const edges = [[[u0, v0], [u0 + w, v0]], [[u0, v0], [u0, v0 + d]], [[u0 + w, v0], [u0 + w, v0 + d]], [[u0, v0 + d], [u0 + w, v0 + d]]];
  for (const [a, b] of edges) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.round(L / .3)), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    for (const z of [.1, .2]) { const r = new T.Mesh(new T.BoxGeometry(L, .02, .02), wd); r.position.set(X((a[0] + b[0]) / 2), z, Z((a[1] + b[1]) / 2)); r.rotation.y = -ang; add(r); }
    for (let i = 0; i <= n; i++) { const p = new T.Mesh(new T.BoxGeometry(.035, .26, .035), wd); p.position.set(X(a[0] + (b[0] - a[0]) * i / n), .13, Z(a[1] + (b[1] - a[1]) * i / n)); add(p); }
  }
}
function kereste(l) {
  box(.6, 7.0, .7, .6, 0, .38, 'wood', null); hipRoof(.6, 7.0, .7, .6, .38, .26, 'roof'); hole([.8, 7.6], [1.0, 7.6], 0, .28, 0, '#2b1b10', false); smokeAt(.75, 7.1, .7, .9);
  const n = Math.min(4, 1 + Math.floor(l / 6)), lg = colMat('#7a5232', { roughness: .95 }), end = colMat('#dcb47a', { roughness: .9 });
  for (let i = 0; i < n; i++) {
    const u = .95 + (i % 2) * .6, v = 6.15 + Math.floor(i / 2) * .5 - (i % 2) * .1;
    for (const [z, dv] of [[0, 0], [0, .14], [0, .28], [.12, .07], [.12, .21], [.24, .14]]) { const m = new T.Mesh(new T.CylinderGeometry(.07, .07, .5, 10), [lg, end, end]); m.rotation.z = Math.PI / 2; m.position.set(X(u + .25), z + .07, Z(v + dv)); add(m); }
  }
  for (const [u, v] of [[1.55, 7.85], [1.9, 8.1], [1.35, 8.2]]) cyl(u, v, 0, .07, .08, null, '#8a6038');
}
function tas(l) {
  const n = Math.min(6, 2 + Math.floor(l / 5));
  const rock = (u0, v0, w, d, h) => { const g = new T.DodecahedronGeometry(1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = .85 + hash2(i, Math.round(u0 * 10), 3) * .3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } g.computeVertexNormals(); const m = new T.Mesh(g, texMat('rock')); m.scale.set(w / 2, h, d / 2); m.position.set(X(u0 + w / 2), 0, Z(v0 + d / 2)); add(m); };
  rock(.55, .3, 1.0, .8, 1.25); rock(1.5, .3, .8, .55, .95); rock(.55, 1.05, .6, .7, .8); rock(1.55, .85, .75, .45, .6); box(1.15, .95, .7, .5, 0, .45, 'stone', 'stone');
  for (let i = 0; i < n; i++) box(1.3 + (i % 3) * .28, 1.95 + Math.floor(i / 3) * .28, .22, .2, 0, .16, 'stone', 'stone');
}
function demir(l) {
  // maden tepesi
  const g = new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = .8 + fbm(p.getX(i) * 2 + 3, p.getZ(i) * 2, 11) * .45; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
  g.computeVertexNormals();
  const hill = new T.Mesh(g, texMat('rock')); hill.scale.set(1.25, .62, 1.0); hill.position.set(X(10.6), 0, Z(.7)); add(hill);
  // galeri ağzı
  const s = new T.Shape(); s.moveTo(-.18, 0); s.lineTo(.18, 0); s.lineTo(.18, .2); s.quadraticCurveTo(0, .38, -.18, .2); s.lineTo(-.18, 0);
  const mouth = new T.Mesh(new T.ShapeGeometry(s, 8), colMat('#120d0a', { roughness: 1 })); mouth.position.set(X(10.45), 0, Z(1.62)); add(mouth, { shadow: false });
  const wd = colMat('#7a5431');
  for (const dx of [-.2, .2]) { const post = new T.Mesh(new T.BoxGeometry(.05, .32, .05), wd); post.position.set(X(10.45) + dx, .16, Z(1.64)); add(post); }
  const lin = new T.Mesh(new T.BoxGeometry(.48, .05, .06), wd); lin.position.set(X(10.45), .33, Z(1.64)); add(lin);
  for (const o of [-.06, .06]) { const r = new T.Mesh(new T.BoxGeometry(.015, .01, .75), colMat('#3b3a35', { metalness: .6 })); r.position.set(X(10.1) + o, .01, Z(1.82)); r.rotation.y = .35; add(r, { shadow: false }); }
  const ore = colMat('#7d93ad', { roughness: .4, metalness: .5 });
  for (let i = 0; i < 6; i++) { const b = new T.Mesh(new T.DodecahedronGeometry(.05), ore); b.position.set(X(10.7) + (i % 3) * .07, .03 + Math.floor(i / 3) * .05, Z(1.85) + (i % 2) * .05); add(b); }
  st.cart = { a: [X(10.45), Z(1.7)], b: [X(9.75), Z(1.95)] };
  if (l >= 10) st.torches.push([X(10.45) - .25, .38, Z(1.66)]);
}
function ciftlik(l) {
  box(10.0, 11.5, .7, .6, 0, .4, 'plaster', null); timber3(10.0, 11.5, .7, .6, 0, .4);
  hole([10.15, 12.1], [10.3, 12.1], .16, .3, .03); hole([10.42, 12.1], [10.58, 12.1], 0, .3, .06, '#3a2414', false);
  hipRoof(10.0, 11.5, .7, .6, .4, .3, 'roof'); smokeAt(10.15, 11.6, .75, .4);
  for (const [u, v] of [[10.95, 11.6], [11.25, 11.75], [11.1, 11.95]]) { cyl(u, v, 0, .14, .12, null, '#d6b25e'); }
  if (l >= 10) {
    cyl(11.95, 12.1, 0, .95, .22, 'stone', null, { r1: .17 }); cone(11.95, 12.1, .95, .26, .35, '#9b3b27', 'roof');
    hole([11.9, 12.32], [12.05, 12.32], 0, .3, .06, '#3a2414', false);
    const hub = new T.Group(); hub.position.set(X(11.95) + .17, .85, Z(12.1) + .17); hub.rotation.y = Math.PI / 4;
    const sail = colMat('#eee6d2', { roughness: .9, side: T.DoubleSide }), arm = colMat('#5e3b1f');
    const rot = new T.Group(); hub.add(rot);
    for (let i = 0; i < 4; i++) { const a = new T.Group(); a.rotation.z = i * Math.PI / 2; const bar = new T.Mesh(new T.BoxGeometry(.03, .62, .02), arm); bar.position.y = .31; a.add(bar); const sl = new T.Mesh(new T.PlaneGeometry(.12, .45), sail); sl.position.set(.07, .38, .005); a.add(sl); rot.add(a); }
    hub.traverse(o => { if (o.isMesh) o.castShadow = true; }); hub.userData.dyn = true; G.add(hub); st.mill = rot;
  }
}
// sur: 1–5 ahşap çit, 6+ taş sur, 10+ köşe burçları, 15+ ara burçlar
function walls(l) {
  if (!l) return;
  if (l <= 5) {
    const h = .45 + l * .06, wd = colMat('#7a5431', { roughness: .9 }), tip = colMat('#9a6a3c');
    const geo = new T.CylinderGeometry(.065, .065, 1, 7), tg = new T.ConeGeometry(.065, .1, 7);
    const pts = [];
    const edge = (u1, v1, u2, v2, gate) => { const n = Math.round(Math.hypot(u2 - u1, v2 - v1) / .15); for (let i = 0; i <= n; i++) { const u = u1 + (u2 - u1) * i / n, v = v1 + (v2 - v1) * i / n; if (gate && u > G0 - .05 && u < G1 + .05) continue; pts.push([u, v, h * (.9 + .2 * hash2(Math.round(u * 50), Math.round(v * 50), 5))]); } };
    edge(WA, WA, WB, WA); edge(WA, WA, WA, WB); edge(WB, WA, WB, WB); edge(WA, WB, WB, WB, true);
    const im = new T.InstancedMesh(geo, wd, pts.length), it = new T.InstancedMesh(tg, tip, pts.length), m4 = new T.Matrix4();
    pts.forEach(([u, v, hh], i) => { m4.compose(new T.Vector3(X(u), hh / 2, Z(v)), new T.Quaternion(), new T.Vector3(1, hh, 1)); im.setMatrixAt(i, m4); m4.makeTranslation(X(u), hh + .05, Z(v)); it.setMatrixAt(i, m4); });
    add(im); add(it);
    cyl(G0 - .08, WB, 0, h + .35, .08, null, '#6e4a26'); cyl(G1 + .08, WB, 0, h + .35, .08, null, '#6e4a26');
    box(G0 - .12, WB - .06, G1 - G0 + .24, .12, h + .25, .1, 'wood', 'wood'); flagPole(G0 - .08, WB, h + .35, .35, PCOL(), .8);
    return;
  }
  const hw = .72 + (l - 6) * .03, t = .3;
  const seg = (u0, v0, w, d) => { box(u0, v0, w, d, 0, hw, 'fort', 'fort'); const along = w > d, L = along ? w : d, n = Math.max(1, Math.floor(L / .26)); for (let i = 0; i < n; i++) { const o = (i + .25) * L / n; if (along) box(u0 + o, v0, .12, d, hw, .13, 'fort', 'fort'); else box(u0, v0 + o, w, .12, hw, .13, 'fort', 'fort'); } };
  seg(WA, WA - t / 2, WB - WA, t); seg(WA - t / 2, WA, t, WB - WA); seg(WB - t / 2, WA, t, WB - WA);
  seg(WA, WB - t / 2, G0 - .3 - WA, t); seg(G1 + .3, WB - t / 2, WB - G1 - .3, t);
  const tower = (u, v, r, h) => { cyl(u, v, 0, h, r, 'fort'); cyl(u, v, h, .08, r + .05, 'fort'); cone(u, v, h + .08, r + .1, r * 2, '#9b3b27', 'roof'); };
  if (l >= 10) { const r = .4 + (l - 10) * .01; for (const [u, v] of [[WA, WA], [WB, WA], [WA, WB], [WB, WB]]) tower(u, v, r, hw + .55); }
  if (l >= 15) for (const [u, v] of [[6, WA], [WA, 6], [WB, 6]]) tower(u, v, .34, hw + .4);
  const hg = hw + .45;
  box(G0 - .35, WB - .22, .4, .44, 0, hg, 'fort', 'fort'); box(G1 - .05, WB - .22, .4, .44, 0, hg, 'fort', 'fort');
  box(G0 + .05, WB - .18, G1 - G0 - .1, .36, hw - .08, hg - hw + .08, 'fort', 'fort');
  for (const u of [G0 - .3, G0 - .08, G1, G1 + .22]) box(u, WB - .22, .1, .44, hg, .12, 'fort', 'fort');
  hole([G0 + .05, WB + .18], [G1 - .05, WB + .18], 0, hw - .35, .12, '#3a2a1c', false);
  flagPole(G0 - .15, WB, hg + .12, .55, PCOL()); flagPole(G1 + .15, WB, hg + .12, .55, PCOL());
  st.torches.push([X(G0 - .02), hw * .7, Z(WB + .25)], [X(G1 + .02), hw * .7, Z(WB + .25)]);
}
function scaffold3(lot, lvl) {
  const [u0, v0, w, d] = lot, h = lvl ? .95 : .5, wd = colMat('#b88d52', { roughness: .9 });
  if (!lvl) { box(u0, v0, w, d, 0, .1, 'stone', 'stone'); box(u0, v0, w, .12, .1, .28, 'stone', 'stone'); box(u0, v0, .12, d, .1, .28, 'stone', 'stone'); }
  for (const [u, v] of [[u0, v0 + d], [u0 + w, v0 + d], [u0 + w, v0], [u0, v0], [u0 + w / 2, v0 + d], [u0 + w, v0 + d / 2]]) { const p = new T.Mesh(new T.BoxGeometry(.03, h + .3, .03), wd); p.position.set(X(u), (h + .3) / 2, Z(v)); add(p); }
  for (const z of [h * .35, h * .7, h + .2]) { let b = new T.Mesh(new T.BoxGeometry(w, .025, .03), wd); b.position.set(X(u0 + w / 2), z, Z(v0 + d)); add(b); b = new T.Mesh(new T.BoxGeometry(.03, .025, d), wd); b.position.set(X(u0 + w), z, Z(v0 + d / 2)); add(b); }
  const mast = new T.Mesh(new T.BoxGeometry(.04, h + .9, .04), colMat('#8a6a3a')); mast.position.set(X(u0 + w + .05), (h + .9) / 2, Z(v0 + .05)); add(mast);
  const jib = new T.Group(); jib.position.set(X(u0 + w + .05), h + .88, Z(v0 + .05)); const arm = new T.Mesh(new T.BoxGeometry(.7, .03, .03), colMat('#8a6a3a')); arm.position.x = -.3; jib.add(arm);
  const load = new T.Mesh(new T.BoxGeometry(.1, .08, .1), texMat('stone')); load.position.set(-.55, -.4, 0); jib.add(load); jib.userData.dyn = true; G.add(jib); st.cranes.push(jib);
}
function emptyLot3(b) {
  const [u0, v0, w, d] = LOTS[b];
  const c = document.createElement('canvas'); c.width = 128; c.height = Math.max(32, Math.round(128 * d / w)); const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,245,220,.12)'; g.fillRect(0, 0, c.width, c.height); g.setLineDash([10, 7]); g.strokeStyle = 'rgba(255,245,220,.85)'; g.lineWidth = 4; g.strokeRect(3, 3, c.width - 6, c.height - 6);
  g.setLineDash([]); g.fillStyle = 'rgba(255,245,220,.9)'; const cx = c.width / 2, cy = c.height / 2; g.fillRect(cx - 3, cy - 14, 6, 28); g.fillRect(cx - 14, cy - 3, 28, 6);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(X(u0 + w / 2), .03, Z(v0 + d / 2));
  add(m, { shadow: false });
}

// ---------- birleştirme: aynı malzemeli parçaları tek çizime indirir ----------
function mergeGroup(g, b) {
  g.updateMatrixWorld(true);
  const buckets = new Map(), keep = [];
  g.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return;
    let p = o, dyn = false; while (p && p !== g) { if (p.userData.dyn) dyn = true; p = p.parent; } if (dyn) return;
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()); geo.applyMatrix4(o.matrixWorld);
    const mats = Array.isArray(o.material) ? o.material : [o.material], groups = geo.groups.length ? geo.groups : [{ start: 0, count: geo.attributes.position.count, materialIndex: 0 }];
    for (const gr of groups) {
      const m = mats[gr.materialIndex || 0] || mats[0], key = m.uuid + (o.castShadow ? 's' : 'n');
      let bk = buckets.get(key); if (!bk) { bk = { m, shadow: o.castShadow, pos: [], nor: [], uv: [] }; buckets.set(key, bk); }
      const P = geo.attributes.position.array, N = geo.attributes.normal.array, U = geo.attributes.uv ? geo.attributes.uv.array : null;
      for (let i = gr.start; i < gr.start + gr.count; i++) { bk.pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); bk.nor.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); bk.uv.push(U ? U[i * 2] : 0, U ? U[i * 2 + 1] : 0); }
    }
    geo.dispose(); keep.push(o);
  });
  for (const o of keep) { o.parent.remove(o); o.geometry.dispose(); }
  for (const bk of buckets.values()) {
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(bk.pos, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(bk.nor, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(bk.uv, 2));
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    const mesh = new T.Mesh(geo, bk.m); mesh.castShadow = bk.shadow; mesh.receiveShadow = true; mesh.userData.b = b; g.add(mesh);
  }
  g.traverse(o => { o.userData.b = b; });
}

// ---------- dünya: zemin, dere, yollar, ağaçlar, tepeler ----------
function grassTex() {
  const n = 512, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), id = g.createImageData(n, n), d = id.data;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = fbm(i / 40, j / 40, 21), b = hash2(i, j, 4), blade = hash2(i >> 1, j, 9) > .82 ? 18 : 0;
    const o = (j * n + i) * 4; d[o] = 70 + a * 40 + b * 18 - blade * .5; d[o + 1] = 104 + a * 46 + b * 20 + blade; d[o + 2] = 44 + a * 18 + b * 8; d[o + 3] = 255;
  }
  // tileable kenarlar için fbm periyodik değil; yine de tekrar küçük olduğundan göze batmaz
  g.putImageData(id, 0, 0);
  for (let k = 0; k < 900; k++) { const x = hash2(k, 1, 31) * n, y = hash2(k, 2, 31) * n; g.strokeStyle = hash2(k, 3, 31) < .5 ? 'rgba(40,72,24,.5)' : 'rgba(176,196,110,.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (hash2(k, 4, 31) - .5) * 4, y - 4 - hash2(k, 5, 31) * 5); g.stroke(); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t;
}
function ribbon(pts, width, mat, y) {   // pts: [[u,v]...] boyunca şerit
  const pos = [], uv = [], idx = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)], dx = q[0] - o[0], dz = q[1] - o[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
    if (i) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    pos.push(p[0] + nx * width / 2, y, p[1] + nz * width / 2, p[0] - nx * width / 2, y, p[1] - nz * width / 2); uv.push(0, acc, 1, acc);
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new T.Mesh(geo, mat); m.receiveShadow = true; return m;
}
function buildWorld() {
  if (!TEX) TEX = buildTex();
  const W = new T.Group();
  // zemin: büyük ölçekte renk dalgalanması olan çimen
  const ground = new T.PlaneGeometry(120, 120, 96, 96); ground.rotateX(-Math.PI / 2);
  const gp = ground.attributes.position, gc = [];
  for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), z = gp.getZ(i), n = fbm(x / 9 + 50, z / 9, 7), dry = fbm(x / 5, z / 5 + 30, 8); const k = .78 + n * .38; gc.push(k * (dry > .62 ? 1.12 : 1), k, k * (dry > .62 ? .86 : 1)); const far = Math.max(0, Math.hypot(x, z) - 16); gp.setY(i, Math.min(2.2, far * far * .006) * fbm(x / 7, z / 7, 3) * 1.4 - .02); }
  ground.setAttribute('color', new T.Float32BufferAttribute(gc, 3)); ground.computeVertexNormals();
  const gt = grassTex(); gt.repeat.set(30, 30);
  const gm = new T.Mesh(ground, new T.MeshStandardMaterial({ map: gt, vertexColors: true, roughness: 1 })); gm.position.set(6, 0, 7); gm.receiveShadow = true; W.add(gm);
  // dere
  const rv = []; for (let v = -40; v <= 50; v += .5) rv.push([riverU(v), v]);
  const bank = ribbon(rv, 1.7, new T.MeshStandardMaterial({ color: '#a8946a', roughness: 1 }), .012); W.add(bank);
  const wn = new T.CanvasTexture(normalFrom(TEX.rock, 1.2)); wn.wrapS = wn.wrapT = T.RepeatWrapping; wn.repeat.set(2, 8);
  const wm = new T.MeshStandardMaterial({ color: '#2d6f80', roughness: .12, metalness: .25, normalMap: wn, normalScale: new T.Vector2(.35, .35), transparent: true, opacity: .93 });
  const water = ribbon(rv, 1.05, wm, .03); W.add(water); st.water = wn;
  // avlu, yollar, taş yol
  const dm = texMat('dirt');
  const yard = new T.Mesh(new T.PlaneGeometry(WB - WA - .1, WB - WA - .1), dm); yard.rotation.x = -Math.PI / 2; yard.position.set((WA + WB) / 2, .014, (WA + WB) / 2);
  { const [sx, sy] = dm.userData.sc, uv = yard.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (WB - WA) / sx, uv.getY(i) * (WB - WA) / sy); }
  yard.receiveShadow = true; W.add(yard);
  ROADS.forEach((r, ri) => { for (let i = 0; i < r.pts.length - 1; i++) {
    const [a, b] = [r.pts[i], r.pts[i + 1]], h = r.w / 2, u0 = Math.min(a[0], b[0]) - h, u1 = Math.max(a[0], b[0]) + h, v0 = Math.min(a[1], b[1]) - h, v1 = Math.max(a[1], b[1]) + h;
    const m = new T.Mesh(new T.PlaneGeometry(u1 - u0, v1 - v0), dm); m.rotation.x = -Math.PI / 2; m.position.set((u0 + u1) / 2, .016 + (ri * 3 + i) * .0005, (v0 + v1) / 2);
    const [sx, sy] = dm.userData.sc, uv = m.geometry.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (u1 - u0) / sx, uv.getY(k) * (v1 - v0) / sy);
    m.receiveShadow = true; W.add(m);
  } });
  const pm = texMat('pave'), path = new T.Mesh(new T.PlaneGeometry(.5, WB + .1 - 7.25), pm); path.rotation.x = -Math.PI / 2; path.position.set(GC, .02, (7.25 + WB + .1) / 2);
  { const [sx, sy] = pm.userData.sc, uv = path.geometry.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * .5 / sx, uv.getY(k) * (WB - 7.15) / sy); }
  path.receiveShadow = true; W.add(path);
  // ağaçlar (örneklenmiş)
  const rnd = mul32(4242), trees = { mese: [], servi: [], kavak: [] };
  for (let i = 0; i < 20000 && trees.mese.length + trees.servi.length + trees.kavak.length < 520; i++) {
    const u = -16 + rnd() * 44, v = -14 + rnd() * 46;
    if (occupied(u, v) || Math.hypot(u - 6, v - 7) > 24) continue;
    const all = [...trees.mese, ...trees.servi, ...trees.kavak]; if (all.some(t => Math.hypot(t[0] - u, t[1] - v) < .62)) continue;
    const r = rnd(); (r < .3 ? trees.servi : r < .42 ? trees.kavak : trees.mese).push([u, v, .8 + rnd() * .5, rnd()]);
  }
  const mk = (geo, mat, list, f) => { const im = new T.InstancedMesh(geo, mat, list.length), m4 = new T.Matrix4(), c = new T.Color(); list.forEach((t, i) => { f(m4, t); im.setMatrixAt(i, m4); c.setHSL(.25 + (t[3] - .5) * .06, .45 + t[3] * .15, .5 + (t[3] - .5) * .18); im.setColorAt(i, c); }); im.castShadow = true; im.receiveShadow = true; W.add(im); };
  const trunkM = colMat('#4a3524', { roughness: 1 });
  const blob = (() => { const parts = []; for (const [x, y, z, r] of [[0, .62, 0, .34], [.2, .55, .1, .26], [-.18, .58, -.08, .27], [.05, .8, -.05, .25], [-.05, .52, .2, .22]]) { const s = new T.IcosahedronGeometry(r, 1); s.translate(x, y, z); parts.push(s.index ? s.toNonIndexed() : s); } return mergeGeos(parts); })();
  mk(new T.CylinderGeometry(.045, .065, .5, 6).translate(0, .25, 0), trunkM, trees.mese, (m4, t) => m4.compose(new T.Vector3(t[0], 0, t[1]), new T.Quaternion(), new T.Vector3(t[2], t[2], t[2])));
  mk(blob, new T.MeshStandardMaterial({ color: '#ffffff', roughness: .95, flatShading: true }), trees.mese, (m4, t) => m4.compose(new T.Vector3(t[0], 0, t[1]), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), t[3] * 6), new T.Vector3(t[2], t[2], t[2])));
  const lathe = (w, h) => { const pts = []; for (let i = 0; i <= 10; i++) { const f = i / 10; pts.push(new T.Vector2(Math.sin(Math.PI * Math.pow(f, .8)) * w * (1 - f * .35), .12 + f * h)); } return new T.LatheGeometry(pts, 10); };
  const sGeo = lathe(.16, 1.45), kGeo = lathe(.2, 1.3);
  for (const [list, geo, col] of [[trees.servi, sGeo, '#2f5a2c'], [trees.kavak, kGeo, '#6e9442']]) {
    mk(new T.CylinderGeometry(.03, .04, .2, 5).translate(0, .1, 0), trunkM, list, (m4, t) => m4.compose(new T.Vector3(t[0], 0, t[1]), new T.Quaternion(), new T.Vector3(t[2], t[2], t[2])));
    const mat = new T.MeshStandardMaterial({ color: col, roughness: .95, flatShading: true });
    const im = new T.InstancedMesh(geo, mat, list.length), m4 = new T.Matrix4(), c = new T.Color();
    list.forEach((t, i) => { m4.compose(new T.Vector3(t[0], 0, t[1]), new T.Quaternion(), new T.Vector3(t[2], t[2] * (.9 + t[3] * .3), t[2])); im.setMatrixAt(i, m4); c.set(col).offsetHSL((t[3] - .5) * .03, 0, (t[3] - .5) * .1); im.setColorAt(i, c); });
    im.castShadow = true; im.receiveShadow = true; W.add(im);
  }
  // kayalar ve çalılar
  const rocks = [], bush = [];
  for (let i = 0; i < 260; i++) { const u = -14 + rnd() * 40, v = -12 + rnd() * 42; if (occupied(u, v)) continue; (rnd() < .45 ? rocks : bush).push([u, v, .5 + rnd() * .8, rnd()]); }
  mk(new T.DodecahedronGeometry(.08, 0), colMat('#9a958a', { roughness: 1, flatShading: true }), rocks, (m4, t) => m4.compose(new T.Vector3(t[0], .02, t[1]), new T.Quaternion().setFromEuler(new T.Euler(t[3] * 3, t[3] * 5, 0)), new T.Vector3(t[2], t[2] * .7, t[2])));
  mk(new T.IcosahedronGeometry(.12, 0).translate(0, .08, 0), new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }), bush, (m4, t) => m4.compose(new T.Vector3(t[0], 0, t[1]), new T.Quaternion(), new T.Vector3(t[2], t[2] * .8, t[2])));
  // uzak tepeler
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + .3, r = 30 + (i % 3) * 5, g = new T.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const h = new T.Mesh(g, new T.MeshStandardMaterial({ color: i % 2 ? '#5f7d3d' : '#6d8a45', roughness: 1, flatShading: true })); h.scale.set(7 + (i % 4) * 2, 3 + (i % 3) * 1.6, 6 + (i % 5)); h.position.set(6 + Math.cos(a) * r, -.4, 7 + Math.sin(a) * r); h.receiveShadow = true; W.add(h);
  }
  return W;
}
function mergeGeos(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); return geo;
}

// ---------- köy kurulumu ----------
const BF = { konak, kervansaray, medrese, divan, kisla, ambar, tophane, ahir, kereste, tas, demir, ciftlik };
function buildVillage(v) {
  if (st.bgrp) { st.scene.remove(st.bgrp); st.bgrp.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  st.flags = []; st.smokes = []; st.torches = []; st.cranes = []; st.mill = null; st.cart = null; st.horsePen = null;
  const root = new T.Group(); st.picks = []; st.anchors = {};
  const mkGroup = (b, fn) => { G = new T.Group(); OFF3 = (b && SH[b]) || [0, 0]; fn(); OFF3 = [0, 0]; mergeGroup(G, b); root.add(G); if (b) { st.picks.push(G); st.anchors[b] = G; } return G; };
  mkGroup('sur', () => walls(v.b.sur));
  for (const b in BF) if (v.b[b] > 0) mkGroup(b, () => BF[b](v.b[b]));
  for (const q of v.bq) { const lot = LOTS[q.b]; if (lot && q.b !== 'sur' && q.b !== 'ciftlik') mkGroup(q.b, () => scaffold3(lot, v.b[q.b])); }
  for (const b of Object.keys(LOTS)) if (!(v.b[b] > 0) && !v.bq.some(q => q.b === b)) mkGroup(b, () => emptyLot3(b));
  // tarlalar
  if (v.b.ciftlik > 0) mkGroup('ciftlik', () => {
    const n = Math.min(12, 1 + Math.floor(v.b.ciftlik / 2.5));
    for (let i = 0; i < n; i++) { const col = i % 3, row = Math.floor(i / 3), u0 = 9.85 + col * .93, v0 = 7.85 + row * .85, k = ['wheat', 'crop', 'plowed'][(i * 7 + row) % 3]; box(u0, v0, .85, .77, 0, k === 'wheat' ? .06 : .025, 'plowed', k); }
  });
  if (v.b.ahir > 0) { G = new T.Group(); OFF3 = SH.ahir; const m = new T.Mesh(new T.PlaneGeometry(1.8, 1.6), texMat('dirt')); m.rotation.x = -Math.PI / 2; m.position.set(X(10.9), .018, Z(5.6)); m.receiveShadow = true; G.add(m); OFF3 = [0, 0]; root.add(G); }
  st.bgrp = root; st.scene.add(root); root.updateMatrixWorld(true); anchorBoxes();
  // hareketli: işçiler, atlar, araba, kuşlar, duman
  buildDynamic(v);
  st.r.shadowMap.needsUpdate = true;
}

// ---------- canlılar ----------
function person3(col, hat) {
  const g = new T.Group();
  const body = new T.Mesh(new T.CylinderGeometry(.04, .065, .2, 8), colMat(col, { roughness: .95 })); body.position.y = .16; g.add(body);
  const head = new T.Mesh(new T.SphereGeometry(.034, 8, 6), colMat('#d9b48c')); head.position.y = .29; g.add(head);
  const h = new T.Mesh(new T.CylinderGeometry(.03, .036, .03, 8), colMat(hat ? '#f1ece0' : '#5a3a22')); h.position.y = .32; g.add(h);
  const legs = []; for (const z of [.022, -.022]) { const l = new T.Mesh(new T.CylinderGeometry(.013, .013, .08, 5), colMat('#3a2a1e')); l.geometry.translate(0, -.04, 0); l.position.set(0, .08, z); g.add(l); legs.push(l); }
  const sh = new T.Mesh(new T.CircleGeometry(.07, 12), new T.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .25, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = .012; g.add(sh);
  g.userData.legs = legs; return g;
}
const LOADM = { kereste: () => { const m = new T.Mesh(new T.CylinderGeometry(.025, .025, .22, 6), colMat('#7a4f2a')); m.rotation.z = Math.PI / 2; return m; }, tas: () => new T.Mesh(new T.BoxGeometry(.09, .07, .08), texMat('stone')), demir: () => new T.Mesh(new T.DodecahedronGeometry(.045), colMat('#5b4a36', { metalness: .4, roughness: .5 })) };
function buildDynamic(v) {
  if (st.dgrp) { st.scene.remove(st.dgrp); st.dgrp.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const D = new T.Group(); st.dgrp = D; st.workers = []; st.horses = []; st.walkers = [];
  const R = workerRoutes(v); let idx = 0;
  for (const res of ['kereste', 'tas', 'demir']) {
    const l = v.b[res]; if (!l) continue;
    const n = Math.min(3, 1 + Math.floor(l / 7));
    for (let k = 0; k < n; k++) { const p = person3(DRESS[(3 + idx + k) % DRESS.length], (3 + idx + k) % 3 === 0), load = LOADM[res](); load.position.set(.02, .37, 0); p.add(load); D.add(p); st.workers.push({ p, load, res, route: R[res], L: routeLen(R[res]), k, n, idx }); }
    idx++;
  }
  for (let i = 0; i < 2; i++) { const p = person3(DRESS[i], i === 0); D.add(p); st.walkers.push({ p, i }); }
  if (v.b.sur > 0) for (const du of [-.55, .55]) { const p = person3('#8a2f2a', false); p.position.set(GC + du, 0, WB + .45); const sp = new T.Mesh(new T.CylinderGeometry(.006, .006, .5, 4), colMat('#6e4a26')); sp.position.set(.07, .25, 0); p.add(sp); D.add(p); }
  if (st.horsePen) for (let i = 0; i < st.horsePen.n; i++) { const h = horse3(i); D.add(h); st.horses.push({ h, i }); }
  if (st.cart) { const c = new T.Group(); const bed = new T.Mesh(new T.BoxGeometry(.2, .08, .13), colMat('#5a4030')); bed.position.y = .09; c.add(bed); const ore = new T.Mesh(new T.SphereGeometry(.07, 8, 6), colMat('#6f7f96', { metalness: .4 })); ore.scale.y = .5; ore.position.y = .14; c.add(ore); for (const [x, z] of [[-.06, .07], [.06, .07], [-.06, -.07], [.06, -.07]]) { const w = new T.Mesh(new T.CylinderGeometry(.035, .035, .015, 10), colMat('#222')); w.rotation.x = Math.PI / 2; w.position.set(x, .035, z); c.add(w); } D.add(c); st.cartM = c; }
  // duman parçacıkları
  st.smokeSprites = [];
  const sc = document.createElement('canvas'); sc.width = sc.height = 64; const sg = sc.getContext('2d'), gr = sg.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(235,232,225,.9)'); gr.addColorStop(1, 'rgba(235,232,225,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
  const smt = new T.CanvasTexture(sc);
  for (const s of st.smokes) for (let i = 0; i < 6; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: smt, transparent: true, depthWrite: false })); D.add(sp); st.smokeSprites.push({ sp, s, i }); }
  // meşaleler (gece)
  st.torchLights = [];
  for (const [x, y, z] of st.torches.slice(0, 3)) { const L = new T.PointLight('#ffb35a', 0, 3.2, 2); L.position.set(x, y + .1, z); D.add(L); const f = new T.Mesh(new T.SphereGeometry(.03, 8, 6), new T.MeshBasicMaterial({ color: '#ffcf7a' })); f.position.set(x, y + .05, z); D.add(f); st.torchLights.push({ L, f }); }
  // kuşlar
  st.birds = [];
  for (let i = 0; i < 5; i++) { const g = new T.Group(); for (const s of [1, -1]) { const w = new T.Mesh(new T.PlaneGeometry(.18, .05), new T.MeshBasicMaterial({ color: '#2a2a30', side: T.DoubleSide })); w.geometry.translate(s * .09, 0, 0); w.rotation.x = -Math.PI / 2; g.add(w); } D.add(g); st.birds.push({ g, i }); }
  st.scene.add(D);
}
function horse3(i) {
  const g = new T.Group(), col = colMat(['#6b3f22', '#2b211b', '#9a6a3c', '#d9ccb4'][i % 4], { roughness: .7 });
  const body = new T.Mesh(new T.SphereGeometry(.1, 12, 8), col); body.scale.set(1.7, .85, .8); body.position.y = .22; g.add(body);
  const neck = new T.Mesh(new T.CylinderGeometry(.035, .05, .18, 6), col); neck.position.set(.17, .3, 0); neck.rotation.z = -.7; g.add(neck);
  const head = new T.Mesh(new T.BoxGeometry(.12, .05, .05), col); head.position.set(.25, .37, 0); head.rotation.z = -.5; g.add(head);
  const tail = new T.Mesh(new T.CylinderGeometry(.012, .02, .14, 5), colMat('#1d1510')); tail.position.set(-.18, .2, 0); tail.rotation.z = .5; g.add(tail);
  const legs = []; for (const [x, z] of [[-.1, .04], [-.1, -.04], [.1, .04], [.1, -.04]]) { const l = new T.Mesh(new T.CylinderGeometry(.015, .013, .16, 5), col); l.geometry.translate(0, -.08, 0); l.position.set(x, .16, z); g.add(l); legs.push(l); }
  const sh = new T.Mesh(new T.CircleGeometry(.14, 12), new T.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .22, depthWrite: false })); sh.scale.x = 1.6; sh.rotation.x = -Math.PI / 2; sh.position.y = .012; g.add(sh);
  g.userData.legs = legs; return g;
}
function animate(t) {
  const sec = t / 1000, v = st.vil;
  for (const f of st.flags) { const p = f.mesh.geometry.attributes.position, b = f.base; for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, Math.sin(sec * 4 + x * 14 + f.ph) * .03 * x / .42); } p.needsUpdate = true; f.mesh.geometry.computeVertexNormals(); }
  for (const s of st.smokeSprites) { const p = (sec / 3.4 + s.i / 6 + s.s.ph) % 1; s.sp.position.set(s.s.x + Math.sin(p * 5 + s.s.ph * 9) * .08 + p * .25, s.s.y + p * .9, s.s.z - p * .1); const sz = .12 + p * .35; s.sp.scale.set(sz, sz, 1); s.sp.material.opacity = .45 * (1 - p); }
  for (const w of st.workers) {
    const cyc = (sec * .55 + w.k * (2 * w.L / w.n) + w.idx * 3.1) % (2 * w.L), going = cyc < w.L, f = going ? cyc / w.L : 1 - (cyc - w.L) / w.L;
    const [u, vv] = routeAt(w.route, f), [u2, v2] = routeAt(w.route, Math.min(1, Math.max(0, f + (going ? .01 : -.01))));
    w.p.position.set(u, 0, vv); w.p.rotation.y = Math.atan2(-(v2 - vv), u2 - u); w.load.visible = going; walkLegs(w.p, t, w.k);
  }
  for (const w of st.walkers) { const per = 30000 + w.i * 7000, f0 = ((t + w.i * 11000) % per) / per, f = f0 < .5 ? f0 * 2 : 2 - f0 * 2; w.p.position.set(GC + (w.i ? .15 : -.15), 0, 17.5 - f * 4.6); w.p.rotation.y = f0 < .5 ? Math.PI / 2 : -Math.PI / 2; walkLegs(w.p, t, w.i + 5); }
  if (st.horsePen) for (const h of st.horses) { const P = st.horsePen, ph = h.i * 2.3, fu = .5 + .42 * Math.sin(t / 6200 + ph), fv = .5 + .42 * Math.sin(t / 8300 + ph * 1.7), du = Math.cos(t / 6200 + ph) / 6200 * .42 * P.w, dv = Math.cos(t / 8300 + ph * 1.7) * 1.7 / 8300 * .42 * P.d; h.h.position.set(P.u0 + P.w * fu, 0, P.v0 + P.d * fv); h.h.rotation.y = Math.atan2(-dv, du); walkLegs(h.h, t * 1.3, h.i); }
  if (st.cartM && st.cart) { const f = (Math.sin(t / 3200) + 1) / 2, a = st.cart.a, b = st.cart.b; st.cartM.position.set(a[0] + (b[0] - a[0]) * f, 0, a[1] + (b[1] - a[1]) * f); st.cartM.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]); }
  if (st.mill) st.mill.rotation.z = -sec * .9;
  for (const c of st.cranes) c.rotation.y = Math.sin(sec / 1.8) * .9;
  for (const b of st.birds) { const a = sec * .25 + b.i * 1.3, r = 9 + b.i; b.g.position.set(6 + Math.cos(a) * r, 5 + b.i * .4 + Math.sin(sec + b.i) * .3, 7 + Math.sin(a) * r); b.g.rotation.y = -a; const fl = Math.sin(sec * 9 + b.i) * .5; b.g.children[0].rotation.z = fl; b.g.children[1].rotation.z = -fl; }
  if (st.water) st.water.offset.y -= .004;
  for (const tl of st.torchLights) { tl.L.intensity = st.night ? 1.4 + Math.sin(sec * 11 + tl.L.position.x) * .25 : 0; tl.f.visible = !!st.night; }
}
function walkLegs(g, t, i) { const s = Math.sin(t / 140 + i) * .45; const L = g.userData.legs; if (!L) return; for (let k = 0; k < L.length; k++) L[k].rotation.z = k % 2 ? s : -s; }

// ---------- ışık, gece-gündüz ----------
function setLight(night) {
  if (st.night === night) return; st.night = night;
  st.scene.background = new T.Color(night ? '#0d1626' : '#a9c7d6');
  st.scene.fog = new T.Fog(night ? '#0d1626' : '#a9c7d6', 26, 60);
  st.sun.intensity = night ? .35 : 2.6; st.sun.color.set(night ? '#8fa6ff' : '#fff1d8');
  st.hemi.intensity = night ? .35 : 1.05; st.hemi.color.set(night ? '#5a6c9a' : '#cfe4ff'); st.hemi.groundColor.set(night ? '#1a1a22' : '#5a4a32');
  WIN().emissiveIntensity = night ? 2.2 : 0;
  st.r.toneMappingExposure = night ? 1.2 : 1.0;
  st.r.shadowMap.needsUpdate = true;
}

// ---------- kamera ----------
function applyCam() {
  const vw = st.view; vw.dist = Math.max(4.5, Math.min(32, vw.dist)); vw.pitch = Math.max(.45, Math.min(1.25, vw.pitch));
  vw.yaw = Math.max(Math.PI / 4 - 1.25, Math.min(Math.PI / 4 + 1.25, vw.yaw));
  vw.tx = Math.max(-4, Math.min(17, vw.tx)); vw.tz = Math.max(-3, Math.min(18, vw.tz));
  const c = st.cam, cp = Math.cos(vw.pitch);
  c.position.set(vw.tx + Math.sin(vw.yaw) * cp * vw.dist, Math.sin(vw.pitch) * vw.dist, vw.tz + Math.cos(vw.yaw) * cp * vw.dist);
  c.lookAt(vw.tx, 0, vw.tz);
  SC.cam.z = 23 / vw.dist * 1.55;   // 2B ile uyum (etiket ve işçi yazıları için)
}
function panBy(dx, dy) {
  const r = st.cv.getBoundingClientRect(), k = 2 * st.view.dist * Math.tan(st.cam.fov * Math.PI / 360) / r.height;
  const yaw = st.view.yaw, rx = Math.cos(yaw), rz = -Math.sin(yaw), fx = -Math.sin(yaw), fz = -Math.cos(yaw), sp = 1 / Math.sin(st.view.pitch);
  st.view.tx -= (dx * rx - dy * fx * sp) * k; st.view.tz -= (dx * rz - dy * fz * sp) * k; applyCam();
}
function zoomBy(f) { st.view.dist /= f; applyCam(); }

// ---------- dokunma ----------
const ray = new T.Raycaster();
function screenOf(x, y, z) { const r = st.cv.getBoundingClientRect(), p = new T.Vector3(x, y, z).project(st.cam); return { x: (p.x + 1) / 2 * r.width, y: (1 - p.y) / 2 * r.height, behind: p.z > 1 }; }
function anchorBoxes() {
  st.boxes = {};
  for (const b of Object.keys(LOTS)) {
    const g = st.anchors[b]; if (!g) continue;
    const bx = new T.Box3().setFromObject(g); if (bx.isEmpty()) continue;
    if (b === 'ciftlik') { const o = SH.ciftlik; bx.min.set(10.0 + o[0], 0, 11.5 + o[1]); bx.max.set(10.7 + o[0], .7, 12.1 + o[1]); }
    if (b === 'kisla') { const o = SH.kisla; bx.min.set(3.5 + o[0], 0, 3.5 + o[1]); bx.max.set(5.3 + o[0], 1.0, 4.4 + o[1]); }
    if (b === 'sur') { bx.min.set(G0 - .4, 0, WB - .3); bx.max.set(G1 + .4, Math.min(bx.max.y, 1.6), WB + .3); }
    if (b === 'konak') { bx.min.set(4.75, 0, 4.75); bx.max.set(7.25, Math.min(bx.max.y, 2.4), 7.25); }
    st.boxes[b] = bx;
  }
}
function bodyRects3() {
  const out = [];
  for (const b of Object.keys(st.boxes || {})) {
    const bx = st.boxes[b];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const x of [bx.min.x, bx.max.x]) for (const y of [bx.min.y, bx.max.y]) for (const z of [bx.min.z, bx.max.z]) { const p = screenOf(x, y, z); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    const top = screenOf((bx.min.x + bx.max.x) / 2, bx.max.y, (bx.min.z + bx.max.z) / 2);
    const built = st.vil.b[b] > 0 || st.vil.bq.some(q => q.b === b);
    out.push({ b, x0, x1, y0, y1, lx: top.x, ly: top.y, built });
  }
  return out;
}
function tap(cx, cy) {
  const r = st.cv.getBoundingClientRect(), sx = cx - r.left, sy = cy - r.top;
  const lab = (SC.labelHits || []).find(h => sx >= h.x0 - 8 && sx <= h.x1 + 8 && sy >= h.y0 - 8 && sy <= h.y1 + 8);
  if (lab) { selectBuilding(lab.b); return; }
  ray.setFromCamera(new T.Vector2(sx / r.width * 2 - 1, -(sy / r.height) * 2 + 1), st.cam);
  const hit = ray.intersectObjects(st.picks, true).find(h => h.object.userData.b);
  if (hit) { selectBuilding(hit.object.userData.b); return; }
  let best = null, bd = 48;
  for (const h of SC.body || []) { const dx = Math.max(h.x0 - sx, 0, sx - h.x1), dy = Math.max(h.y0 - sy, 0, sy - h.y1), d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = h; } }
  selectBuilding(best ? best.b : null);
}
let selRing = null;
function ringFor(b) {
  if (!selRing) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.strokeStyle = '#ffd36b'; g.lineWidth = 7; g.setLineDash([16, 10]); g.strokeRect(8, 8, 112, 112);
    const t = new T.CanvasTexture(c); selRing = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); selRing.rotation.x = -Math.PI / 2; st.scene.add(selRing);
  }
  const bx = b && st.boxes && st.boxes[b];
  if (!bx) { selRing.visible = false; return; }
  selRing.visible = true;
  selRing.position.set((bx.min.x + bx.max.x) / 2, .04, (bx.min.z + bx.max.z) / 2); selRing.scale.set(bx.max.x - bx.min.x + .3, bx.max.z - bx.min.z + .3, 1);
}

// ---------- başlat / çiz ----------
function start() {
  if (st.showcase || st.sig === 'showcase') { st.view = Object.assign({}, DEF_VIEW); st.showcase = false; }
  let cv = $('scene');
  if (st.r) { if (cv !== st.r.domElement) { cv.replaceWith(st.r.domElement); cv = st.r.domElement; } st.sig = ''; }
  st.cv = cv;
  if (!st.r) {
    st.r = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    st.r.outputColorSpace = T.SRGBColorSpace; st.r.toneMapping = T.ACESFilmicToneMapping; st.r.toneMappingExposure = 1.0;
    st.r.shadowMap.enabled = true; st.r.shadowMap.type = T.PCFSoftShadowMap; st.r.shadowMap.autoUpdate = false;
    for (const k in MATS) delete MATS[k];
    st.scene = new T.Scene();
    st.cam = new T.PerspectiveCamera(32, 1, .1, 200);
    st.hemi = new T.HemisphereLight('#cfe4ff', '#5a4a32', 1.05); st.scene.add(st.hemi);
    st.sun = new T.DirectionalLight('#fff1d8', 2.6); st.sun.position.set(6 - 10, 20, 7 + 6); st.sun.target.position.set(6, 0, 7);
    st.sun.castShadow = true; st.sun.shadow.mapSize.set(2048, 2048); const sc = st.sun.shadow.camera; sc.left = -17; sc.right = 17; sc.top = 17; sc.bottom = -17; sc.near = 1; sc.far = 60; st.sun.shadow.bias = -.0004; st.sun.shadow.normalBias = .02; st.sun.shadow.radius = 3;
    st.scene.add(st.sun); st.scene.add(st.sun.target);
    st.world = buildWorld(); st.scene.add(st.world);
    st.sig = ''; st.night = null; st.bgrp = null; st.dgrp = null; selRing = null;
  }
  // etiket katmanı
  let ov = $('sceneOv');
  if (!ov) { ov = document.createElement('canvas'); ov.id = 'sceneOv'; ov.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; cv.after(ov); }
  st.ov = ov;
  applyCam(); wire(); setLabelBtn();
  frame(performance.now());
  if (!st.raf) st.raf = requestAnimationFrame(loop);
}
function wire() {
  const cv = st.cv;
  wireButtons();
  if (cv.__wired) return; cv.__wired = true;
  cv.addEventListener('pointerdown', e => {
    if (e.isPrimary) st.ptrs.clear();
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    st.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }); st.moved = false;
    if (st.ptrs.size === 2) { const [a, b] = [...st.ptrs.values()]; st.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
  });
  cv.addEventListener('pointermove', e => {
    const p = st.ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 12) st.moved = true;
    if (st.ptrs.size >= 2 && st.pinch) {
      const [a, b] = [...st.ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      zoomBy(d / st.pinch.d);
      let da = ang - st.pinch.ang; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
      st.view.yaw -= da; st.view.pitch += (my - st.pinch.my) * .004; panBy(mx - st.pinch.mx, 0);
      st.pinch = { d, ang, mx, my }; applyCam();
    } else if (st.moved) panBy(dx, dy);
  });
  const up = e => {
    const had = st.ptrs.has(e.pointerId); st.ptrs.delete(e.pointerId);
    if (st.ptrs.size < 2) st.pinch = null;
    if (had && !st.moved && st.ptrs.size === 0 && e.type === 'pointerup') tap(e.clientX, e.clientY);
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('lostpointercapture', e => { st.ptrs.delete(e.pointerId); if (st.ptrs.size < 2) st.pinch = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); if (e.shiftKey) { st.view.yaw += e.deltaY * .003; applyCam(); } else zoomBy(Math.exp(-e.deltaY * .0015)); }, { passive: false });
}
function wireButtons() {
  $('zIn').onclick = () => zoomBy(1.3); $('zOut').onclick = () => zoomBy(1 / 1.3);
  $('zFit').onclick = () => { Object.assign(st.view, DEF_VIEW); applyCam(); };
  $('lblT').onclick = () => { SC.showLabels = !SC.showLabels; try { localStorage.setItem('ub-labels', SC.showLabels ? '1' : '0'); } catch (e) {} setLabelBtn(); toast(SC.showLabels ? 'Bina isimleri açık' : 'Bina isimleri gizlendi', 'info'); };
}
function frame(t) {
  if (!S || !st.cv) return;
  const v = cur(); st.vil = v;
  const r = st.cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2) * st.quality;
  const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
  if (st.cv.width !== W || st.cv.height !== H) { st.r.setPixelRatio(dpr); st.r.setSize(r.width, r.height, false); st.cam.aspect = r.width / r.height; st.cam.updateProjectionMatrix(); }
  if (st.ov.width !== W || st.ov.height !== H) { st.ov.width = W; st.ov.height = H; }
  const sig = v.id + '|' + JSON.stringify(v.b) + '|' + v.bq.map(q => q.b).join() + '|' + PCOL();
  if (sig !== st.sig) { st.sig = sig; buildVillage(v); }
  const hr = SC.hour != null ? SC.hour : new Date().getHours(); setLight(hr >= 20 || hr < 6);
  animate(t);
  ringFor(SC.sel); if (selRing && selRing.visible) selRing.material.opacity = .6 + .35 * Math.sin(t / 250);
  st.r.render(st.scene, st.cam);
  // etiketler ve açılır pencere (2B sahnenin yardımcılarıyla)
  SC.body = bodyRects3();
  const g = st.ov.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const vi = { r, k: 1, ox: 0, oy: 0, dpr, cv: st.cv };
  drawLabels(g, v, vi); placePop(vi);
}
function loop(ts) {
  st.raf = 0;
  if (tab !== 'koy' || !$('scene') || $('scene') !== st.cv) return;
  if (ts - st.last > 33) {
    const t0 = performance.now(); st.last = ts; frame(ts);
    // yavaş cihazda çözünürlüğü kendiliğinden düşür
    const dt = performance.now() - t0; st.slow = (st.slow || 0) * .9 + (dt > 40 ? 1 : 0); if (st.slow > 5 && st.quality > .6) { st.quality -= .15; st.slow = 0; }
  }
  st.raf = requestAnimationFrame(loop);
}

// ============================================================
//  KÜÇÜK RESİM STÜDYOSU: menülerdeki bina, birlik ve kale resimleri aynı 3B modellerden üretilir
// ============================================================
const TH = { r: null, scene: null, cam: null, sun: null, ground: null, cache: new Map(), q: [], busy: false, cbs: [] };
function thInit() {
  if (TH.r) return;
  const c = document.createElement('canvas'); c.width = c.height = 192;
  TH.r = new T.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
  TH.r.setPixelRatio(1); TH.r.setSize(192, 192, false); TH.r.setClearColor(0x000000, 0);
  TH.r.outputColorSpace = T.SRGBColorSpace; TH.r.toneMapping = T.ACESFilmicToneMapping; TH.r.toneMappingExposure = 1.08;
  TH.r.shadowMap.enabled = true; TH.r.shadowMap.type = T.PCFSoftShadowMap;
  TH.scene = new T.Scene();
  TH.scene.add(new T.HemisphereLight('#dfeeff', '#6a5a42', 1.25));
  TH.sun = new T.DirectionalLight('#fff3dc', 2.6); TH.sun.castShadow = true; TH.sun.shadow.mapSize.set(1024, 1024); TH.sun.shadow.bias = -.0005; TH.sun.shadow.normalBias = .02;
  TH.scene.add(TH.sun); TH.scene.add(TH.sun.target);
  TH.ground = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ opacity: .32 })); TH.ground.rotation.x = -Math.PI / 2; TH.ground.receiveShadow = true; TH.scene.add(TH.ground);
  TH.cam = new T.PerspectiveCamera(28, 1, .02, 200);
}
function thRender(build, opt = {}) {
  thInit();
  const keep = { flags: st.flags, smokes: st.smokes, torches: st.torches, cranes: st.cranes, mill: st.mill, cart: st.cart, horsePen: st.horsePen, G };
  st.flags = []; st.smokes = []; st.torches = []; st.cranes = []; st.thumb = true;
  G = new T.Group(); OFF3 = [0, 0];
  let grp;
  try { build(); grp = G; } finally { const g0 = keep.G; delete keep.G; Object.assign(st, keep); G = g0; st.thumb = false; OFF3 = [0, 0]; }
  grp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  TH.scene.add(grp); grp.updateMatrixWorld(true);
  const bx = opt.box || new T.Box3().setFromObject(grp), c = bx.getCenter(new T.Vector3()), sz = bx.getSize(new T.Vector3());
  const rad = Math.max(sz.x, sz.z) * .62 + sz.y * .32 + .02, yaw = opt.yaw != null ? opt.yaw : Math.PI / 4, pitch = opt.pitch != null ? opt.pitch : .5;
  const d = rad / Math.sin(14 * Math.PI / 180) * (opt.zoom || 1);
  TH.cam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * d, c.y + Math.sin(pitch) * d, c.z + Math.cos(yaw) * Math.cos(pitch) * d); TH.cam.lookAt(c);
  TH.sun.position.set(c.x - rad * 3, c.y + rad * 6, c.z + rad * 2); TH.sun.target.position.copy(c);
  const sc = TH.sun.shadow.camera; sc.left = sc.bottom = -rad * 2; sc.right = sc.top = rad * 2; sc.near = .1; sc.far = rad * 20; sc.updateProjectionMatrix();
  TH.ground.position.set(c.x, bx.min.y + .002, c.z);
  TH.r.render(TH.scene, TH.cam);
  const url = TH.r.domElement.toDataURL('image/png');
  TH.scene.remove(grp); grp.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  return url;
}
const BUCKETS = [1, 5, 8, 10, 12, 15, 20, 25, 30];
const bucket = l => { let b = 1; for (const x of BUCKETS) if (l >= x) b = x; return b; };
function thumbKey(kind, id, lvl) { return kind === 'b' ? 'b:' + id + ':' + bucket(lvl || 1) + ':' + PCOL() : kind === 'u' ? 'u:' + id + ':' + PCOL() : 'c:' + id + ':' + PCOL(); }
function thumbGen(key) {
  const [kind, id, a] = key.split(':');
  if (kind === 'b') {
    const lvl = +a;
    return thRender(() => { if (id === 'sur') walls(Math.max(1, lvl)); else { OFF3 = [0, 0]; BF[id](Math.max(1, Math.min(lvl, C.B[id].max))); } },
      id === 'sur' ? { box: new T.Box3(new T.Vector3(G0 - 1.1, 0, WB - .5), new T.Vector3(G1 + 1.1, 1.4, WB + .5)) } :
      id === 'demir' ? { box: new T.Box3(new T.Vector3(9.3, 0, -.3), new T.Vector3(11.9, .7, 2.2)) } :
      id === 'ciftlik' ? { box: new T.Box3(new T.Vector3(9.9, 0, 11.3), new T.Vector3(12.3, lvl >= 10 ? 1.3 : .7, 12.5)) } :
      id === 'kisla' ? { box: new T.Box3(new T.Vector3(3.3, 0, 3.4), new T.Vector3(6.5, 1.0, 4.5)) } :
      id === 'kereste' ? { box: new T.Box3(new T.Vector3(.5, 0, 6.0), new T.Vector3(2.2, .7, 8.3)) } :
      id === 'ahir' ? { box: new T.Box3(new T.Vector3(lvl >= 10 ? 9.4 : 9.9, 0, 3.5), new T.Vector3(11.9, .9, 6.5)) } : {});
  }
  if (kind === 'u') return thRender(() => unitModel(id), { pitch: .3, yaw: Math.PI / 4 + .25, zoom: id === 'mancinik' ? .9 : .8 });
  if (kind === 'c') return thRender(() => { const fl = castle(+id, a === 'b'); if (a !== 'b') for (const f of fl) mapFlag(G, f, PCOL()); }, { pitch: .62 });
}
function thumb(kind, id, lvl, cb) {
  const key = thumbKey(kind, id, lvl);
  if (TH.cache.has(key)) return TH.cache.get(key);
  if (!TH.q.includes(key)) TH.q.push(key);
  if (!TH.busy) { TH.busy = true; setTimeout(thPump, 30); }
  return null;
}
function thPump() {
  const key = TH.q.shift(); if (!key) { TH.busy = false; return; }
  try { const url = thumbGen(key); TH.cache.set(key, url); for (const el of document.querySelectorAll('[data-thumb="' + key + '"]')) { const img = new Image(); img.src = url; img.className = 'thimg'; img.alt = ''; el.replaceWith(img); } }
  catch (e) { TH.cache.set(key, null); console.warn('thumb', key, e); }
  setTimeout(thPump, 16);
}
// ---------- birlik modelleri ----------
function rider(col, opts = {}) {
  const g = new T.Group();
  const coat = colMat(col, { roughness: .85 }), skin = colMat('#d9b48c'), steel = colMat('#c4c8d0', { roughness: .3, metalness: .75 });
  const body = new T.Mesh(new T.CylinderGeometry(.045, .065, .18, 10), coat); body.position.y = .1; g.add(body);
  const head = new T.Mesh(new T.SphereGeometry(.036, 12, 10), skin); head.position.y = .22; g.add(head);
  if (opts.helm) { const h = new T.Mesh(new T.ConeGeometry(.042, .08, 12), steel); h.position.y = .265; g.add(h); }
  else { const h = new T.Mesh(new T.CylinderGeometry(.03, .04, .05, 10), colMat(opts.cap || '#b0302a')); h.position.y = .25; g.add(h); }
  return g;
}
function foot(col, opts = {}) {
  const g = new T.Group(), r = rider(col, opts); r.position.y = .1; g.add(r);
  for (const z of [.024, -.024]) { const l = new T.Mesh(new T.CylinderGeometry(.016, .014, .12, 6), colMat('#2e2419')); l.position.set(0, .06, z); g.add(l); }
  return g;
}
function mount(col, horseCol, armored) {
  const g = new T.Group(), h = horse3(0); h.scale.setScalar(1.25);
  h.traverse(o => { if (o.isMesh && o.material && o.material.color && o.geometry.type !== 'CircleGeometry') o.material = colMat(horseCol, { roughness: .7 }); });
  g.add(h);
  if (armored) { const bard = new T.Mesh(new T.SphereGeometry(.105, 14, 10, 0, Math.PI * 2, Math.PI * .45, Math.PI * .55), colMat(col, { roughness: .6 })); bard.scale.set(1.75, 1.05, 1.05); bard.position.y = .29; g.add(bard); }
  const saddle = new T.Mesh(new T.BoxGeometry(.1, .03, .1), colMat('#6a2a1a')); saddle.position.y = .37; g.add(saddle);
  return g;
}
function unitModel(u) {
  const P = PCOL(), steel = colMat('#c4c8d0', { roughness: .3, metalness: .75 }), wood = colMat('#6e4a26', { roughness: .8 });
  const put = m => { G.add(m); return m; };
  if (u === 'mizrakli') {
    const f = put(foot('#7a2e28', { helm: true }));
    const sp = new T.Mesh(new T.CylinderGeometry(.007, .007, .62, 6), wood); sp.position.set(.07, .3, .02); f.add(sp);
    const tip = new T.Mesh(new T.ConeGeometry(.016, .07, 6), steel); tip.position.set(.07, .64, .02); f.add(tip);
    const sh = new T.Mesh(new T.CylinderGeometry(.075, .075, .018, 20), colMat(P, { roughness: .5 })); sh.rotation.x = Math.PI / 2; sh.position.set(-.01, .2, .07); f.add(sh);
    const boss = new T.Mesh(new T.SphereGeometry(.022, 10, 8), steel); boss.position.set(-.01, .2, .082); f.add(boss);
  } else if (u === 'baltaci') {
    const f = put(foot('#4a5b2e', { cap: '#3a2a1e' }));
    const hd = new T.Mesh(new T.CylinderGeometry(.008, .008, .32, 6), wood); hd.position.set(.07, .26, .03); hd.rotation.z = -.35; f.add(hd);
    const s = new T.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(.06, .02, .07, .08); s.lineTo(.02, .07); s.lineTo(0, .03);
    const blade = new T.Mesh(new T.ExtrudeGeometry(s, { depth: .008, bevelEnabled: false }), steel); blade.position.set(.11, .32, .026); blade.rotation.z = -.35; f.add(blade);
  } else if (u === 'okcu') {
    const f = put(foot('#2f5d4a', { cap: '#d7c9a0' }));
    const bow = new T.Mesh(new T.TorusGeometry(.13, .007, 6, 20, Math.PI * .9), wood); bow.rotation.z = -Math.PI * .45; bow.position.set(.06, .23, .05); f.add(bow);
    const q = new T.Mesh(new T.CylinderGeometry(.022, .022, .14, 8), colMat('#6a3a1e')); q.position.set(-.05, .25, -.03); q.rotation.z = .3; f.add(q);
    for (let i = 0; i < 3; i++) { const a = new T.Mesh(new T.CylinderGeometry(.003, .003, .06, 4), colMat('#e8dcc0')); a.position.set(-.07 + i * .01, .34, -.03); a.rotation.z = .3; f.add(a); }
  } else if (u === 'casus') {
    const f = put(foot('#2b2b33', { cap: '#1d1d22' }));
    const hood = new T.Mesh(new T.ConeGeometry(.05, .1, 10), colMat('#2b2b33')); hood.position.y = .37; f.add(hood);
    const dag = new T.Mesh(new T.ConeGeometry(.01, .08, 4), steel); dag.position.set(.06, .17, .03); dag.rotation.z = Math.PI; f.add(dag);
  } else if (u === 'akinci' || u === 'sipahi' || u === 'sancakbeyi') {
    const g = put(mount(u === 'sipahi' ? P : '#7a2e28', u === 'sancakbeyi' ? '#e8e0d0' : u === 'sipahi' ? '#3a2a20' : '#8a5a32', u !== 'akinci'));
    const r = rider(u === 'akinci' ? '#a8473a' : u === 'sipahi' ? '#5a6470' : '#6a1f3a', { helm: u !== 'akinci', cap: '#c9a14a' }); r.position.set(-.01, .37, 0); g.add(r);
    if (u === 'akinci') { const sw = new T.Mesh(new T.BoxGeometry(.008, .2, .02), steel); sw.position.set(.08, .55, .05); sw.rotation.z = -.5; g.add(sw); }
    if (u === 'sipahi') { const ln = new T.Mesh(new T.CylinderGeometry(.006, .006, .8, 6), wood); ln.position.set(.12, .55, .06); ln.rotation.z = -.9; g.add(ln); const sh = new T.Mesh(new T.CylinderGeometry(.06, .06, .015, 18), colMat(P)); sh.rotation.x = Math.PI / 2; sh.position.set(-.02, .48, .07); g.add(sh); }
    if (u === 'sancakbeyi') { const pole = new T.Mesh(new T.CylinderGeometry(.007, .007, .7, 6), colMat('#c9a14a', { metalness: .6, roughness: .35 })); pole.position.set(.02, .74, -.05); g.add(pole); const fl = new T.Mesh(new T.PlaneGeometry(.26, .17), new T.MeshStandardMaterial({ map: flagTex(P), side: T.DoubleSide })); fl.position.set(.15, .99, -.05); g.add(fl); const top = new T.Mesh(new T.SphereGeometry(.02, 8, 6), GOLD()); top.position.set(.02, 1.1, -.05); g.add(top); }
    g.rotation.y = -Math.PI / 2 + .9;
  } else if (u === 'mancinik') { OFF3 = [-5.1, -8.45]; trebuchet3(5.1, 8.45); OFF3 = [0, 0]; }
}
// ============================================================
//  KALELER: haritada puana göre 6 kademe (oba → başkent)
// ============================================================
function wallRun(x0, z0, x1, z1, h, t, tex, merl, gaps) {
  const L = Math.hypot(x1 - x0, z1 - z0), along = Math.abs(x1 - x0) > Math.abs(z1 - z0), n = Math.max(1, Math.round(L / .07));
  const segs = gaps ? [[0, .38], [.62, 1]] : [[0, 1]];
  for (const [a, b] of segs) {
    const xa = x0 + (x1 - x0) * a, za = z0 + (z1 - z0) * a, xb = x0 + (x1 - x0) * b, zb = z0 + (z1 - z0) * b;
    if (along) box(Math.min(xa, xb), za - t / 2, Math.abs(xb - xa), t, 0, h, tex, tex); else box(xa - t / 2, Math.min(za, zb), t, Math.abs(zb - za), 0, h, tex, tex);
  }
  if (merl) for (let i = 0; i < n; i += 2) { const f = (i + .5) / n; if (gaps && f > .38 && f < .62) continue; const x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f; box(x - .015, z - t / 2, .03, t, h, .035, tex, tex); }
}
function castle(tier, barb) {
  const flags = [], W = barb ? 'fort' : 'stone', ROOF = 'roof', fl = (x, z, y, s = 1) => { if (!barb) flags.push([x, y, z, s]); };
  const k = barb ? .72 : 1, rubble = () => { for (let i = 0; i < 7; i++) { const r = new T.Mesh(new T.DodecahedronGeometry(.025 + hash2(i, tier, 7) * .03), texMat('fort')); r.position.set((hash2(i, 1, tier) - .5) * .7, .02, (hash2(i, 2, tier) - .5) * .7); G.add(r); } };
  const tower = (x, z, r, h, roof) => { cyl(x, z, 0, h * k, r, W); if (!barb) { cyl(x, z, h, .025, r + .012, W); if (roof === 'dome') dome(x, z, h + .025, r * .9, r * .8, '', '#2fa596', '', false); else cone(x, z, h + .025, r + .02, r * 1.9, '#9b3b27', ROOF); } };
  const house = (x, z, w, d, h, rf) => { box(x - w / 2, z - d / 2, w, d, 0, h * k, barb ? 'fort' : 'plaster', null); if (!barb) hipRoof(x - w / 2, z - d / 2, w, d, h, Math.min(w, d) * .5, rf || ROOF, .02); };
  if (tier === 0) {
    for (const [x, z, s] of [[-.17, -.1, 1], [.17, -.06, .85], [0, .18, .9]]) { cyl(x, z, 0, .1 * s * k, .13 * s, null, barb ? '#8f897a' : '#e6dcc4'); if (!barb) { cone(x, z, .1 * s, .14 * s, .12 * s, '#a8473a'); cyl(x, z, .1 * s - .015, .02, .132 * s, null, '#b0453a'); } }
    const fire = new T.Mesh(new T.ConeGeometry(.04, .06, 6), colMat('#5e3b1f')); fire.position.set(.02, .03, -.02); G.add(fire);
    if (!barb) { const fl2 = new T.Mesh(new T.ConeGeometry(.025, .06, 6), new T.MeshBasicMaterial({ color: '#ffb347' })); fl2.position.set(.02, .07, -.02); G.add(fl2); }
    fl(-.05, .32, 0, .7); if (barb) rubble(); return flags;
  }
  if (tier === 1) {
    house(-.2, -.12, .2, .16, .12); house(.18, -.16, .17, .15, .11); house(.02, .14, .22, .16, .13); house(-.22, .18, .12, .12, .09);
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; if (barb && i % 3 === 0) continue; if (Math.abs(a - Math.PI / 2) < .25) continue; cyl(Math.cos(a) * .42, Math.sin(a) * .42, 0, (.12 + hash2(i, 1, 9) * .03) * k, .016, null, '#7a5431', { seg: 5 }); }
    fl(.32, -.32, 0, .75); if (barb) rubble(); return flags;
  }
  if (tier === 2) {
    const s = .36;
    wallRun(-s, -s, s, -s, .17, .045, 'wood', false, barb); wallRun(-s, -s, -s, s, .17, .045, 'wood', false, barb); wallRun(s, -s, s, s, .17, .045, 'wood', false, barb); wallRun(-s, s, s, s, .17, .045, 'wood', false, true);
    for (const [x, z] of [[-s, -s], [s, -s], [s, s], [-s, s]]) { box(x - .06, z - .06, .12, .12, 0, .3 * k, 'wood', 'wood'); if (!barb) hipRoof(x - .06, z - .06, .12, .12, .3, .08, ROOF, .025); }
    house(-.05, -.05, .26, .2, .17); house(.15, .14, .14, .12, .1);
    fl(-s, -s, .38, .8); fl(s, s, .38, .8); if (barb) rubble(); return flags;
  }
  const P = [[.37, .2, .045, .075, .33], [.4, .24, .05, .085, .4], [.44, .25, .055, .09, .44]][tier - 3];
  const [s, h, t, tr, th] = P;
  wallRun(-s, -s, s, -s, h, t, W, true, barb); wallRun(-s, -s, -s, s, h, t, W, true, false); wallRun(s, -s, s, s, h, t, W, true, barb); wallRun(-s, s, s, s, h, t, W, true, true);
  for (const [x, z] of [[-s, -s], [s, -s], [s, s], [-s, s]]) tower(x, z, tr, th);
  if (tier >= 4) for (const x of [-.09, .09]) tower(x, s, tr * .8, th * .85);
  hole([-.06, s + t / 2 + .002], [.06, s + t / 2 + .002], 0, h * .7, .04, '#2a1c12', false);
  if (tier === 3) { box(-.13, -.13, .26, .26, 0, .42 * k, W, null); if (!barb) hipRoof(-.13, -.13, .26, .26, .42, .16, 'lead', .03); fl(0, 0, .58, .9); }
  if (tier === 4) { box(-.15, -.15, .3, .3, 0, .48 * k, W, null); box(-.16, -.16, .32, .32, .48 * k, .04, 'turq', 'stone'); if (!barb) dome(0, 0, .52, .13, .14, '', '#2fa596', '', false); fl(-.13, -.13, .52, .9); fl(.13, .13, .52, .9); }
  if (tier === 5) {
    const s2 = .23; wallRun(-s2, -s2, s2, -s2, .28, .04, W, true, false); wallRun(-s2, -s2, -s2, s2, .28, .04, W, true, false); wallRun(s2, -s2, s2, s2, .28, .04, W, true, false); wallRun(-s2, s2, s2, s2, .28, .04, W, true, true);
    for (const [x, z] of [[-s2, -s2], [s2, -s2], [s2, s2], [-s2, s2]]) tower(x, z, .055, .42, 'dome');
    box(-.12, -.12, .24, .24, 0, .5 * k, W, null); box(-.13, -.13, .26, .26, .5 * k, .04, 'turq', 'stone');
    if (!barb) { dome(0, 0, .54, .14, .16, '', '#2fa596', '', false); for (const [x, z] of [[.15, -.15], [-.15, .15]]) { cyl(x, z, 0, .62, .022, W); const a = cone(x, z, .62, .03, .1, '#8d99a3', 'lead'); alem(a[0], a[1], a[2]); } }
    fl(-s, -s, th + .1, .8); fl(s, s, th + .1, .8); fl(0, 0, .74, 1);
  }
  if (barb) rubble();
  return flags;
}
const FLAGG = () => FLAGG.g || (FLAGG.g = (() => { const g = new T.PlaneGeometry(.2, .13, 6, 1); g.translate(.1, -.065, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 30) * .012 * p.getX(i) / .2); g.computeVertexNormals(); return g; })());
const FLAGM = {};
function mapFlag(parent, [x, y, z, s], col) {
  const pole = new T.Mesh(new T.CylinderGeometry(.006, .006, .3 * s, 5), colMat('#4a3f35')); pole.position.set(x, y + .15 * s, z); parent.add(pole);
  const m = FLAGM[col] || (FLAGM[col] = new T.MeshStandardMaterial({ map: flagTex(col), side: T.DoubleSide, roughness: .9 }));
  const f = new T.Mesh(FLAGG(), m); f.scale.setScalar(s); f.position.set(x, y + .3 * s, z); f.rotation.y = .4; f.castShadow = true; parent.add(f);
}
// ============================================================
//  3B HARİTA
// ============================================================
const MP = { r: null, scene: null, cam: null, cv: null, ov: null, sun: null, hemi: null, tpl: {}, vg: null, vsig: '', night: null, raf: 0,
  view: { tx: 12.5, tz: 12.5, yaw: 0, pitch: 1.0, dist: 15 }, ptrs: new Map(), pinch: null, moved: false, rings: null, selRing: null, frameN: 0, quality: 1 };
function mapTemplate(tier, barb) {
  const key = tier + (barb ? 'b' : '');
  if (MP.tpl[key]) return MP.tpl[key];
  G = new T.Group(); OFF3 = [0, 0]; st.thumb = true;
  const flags = castle(tier, barb); st.thumb = false;
  mergeGroup(G, null); const g = G; G = null;
  return MP.tpl[key] = { g, flags };
}
function mapWorld() {
  const W = new T.Group(), N = C.WORLD;
  // zemin
  const ground = new T.PlaneGeometry(N + 40, N + 40, 120, 120); ground.rotateX(-Math.PI / 2);
  const gp = ground.attributes.position, gc = [];
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i) + N / 2, z = gp.getZ(i) + N / 2, n = fbm(x / 6 + 20, z / 6, 17), dry = fbm(x / 3.5, z / 3.5 + 40, 18);
    const out = Math.max(0, Math.max(-x, x - N, -z, z - N)), k = (.8 + n * .36) * (out > 0 ? Math.max(.62, 1 - out * .03) : 1);
    gc.push(k * (dry > .64 ? 1.12 : 1), k, k * (dry > .64 ? .85 : 1));
    gp.setY(i, out > 0 ? Math.min(3, out * out * .02) * (.5 + fbm(x / 4, z / 4, 5)) : 0);
  }
  ground.setAttribute('color', new T.Float32BufferAttribute(gc, 3)); ground.computeVertexNormals();
  const gt = (MP.gt = MP.gt || grassTex()).clone(); gt.needsUpdate = true; gt.repeat.set(26, 26);
  const gm = new T.Mesh(ground, new T.MeshStandardMaterial({ map: gt, vertexColors: true, roughness: 1 })); gm.position.set(N / 2, 0, N / 2); gm.receiveShadow = true; W.add(gm);
  // ızgara ve sınır
  const lp = []; for (let i = 0; i <= N; i += 5) { lp.push(i, .02, 0, i, .02, N, 0, .02, i, N, .02, i); }
  W.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(lp, 3)), new T.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: .1 })));
  const bp = [0, .03, 0, N, .03, 0, N, .03, 0, N, .03, N, N, .03, N, 0, .03, N, 0, .03, N, 0, .03, 0];
  W.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(bp, 3)), new T.LineBasicMaterial({ color: '#dcaa45', transparent: true, opacity: .55 })));
  // süs: ormanlar, tepeler, kayalar (2B haritadaki dağılımla aynı)
  const occ = new Set(S.vil.map(v => v.x + ',' + v.y)), forest = [], servi = [], hills = [], rocks = [];
  const hsh = (x, y) => { let h = x * 374761393 + y * 668265263 + S.seed; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0); };
  for (let y = -6; y < N + 6; y++) for (let x = -6; x < N + 6; x++) {
    if (occ.has(x + ',' + y)) continue;
    const h = hsh(x, y), d = h % 23, inside = x >= 0 && y >= 0 && x < N && y < N;
    if (d < 3 || (!inside && d < 9)) for (let i = 0; i < 4; i++) { const tx = x + .2 + ((h >> (i * 3)) % 7) / 10, tz = y + .2 + ((h >> (i * 4 + 1)) % 7) / 10, s = .55 + ((h >> (i * 2 + 5)) % 5) / 10; ((h >> i) % 4 === 0 ? servi : forest).push([tx, tz, s, ((h >> (i + 7)) % 100) / 100]); }
    else if (d === 5 || d === 6) hills.push([x + .5, y + .5, .7 + (h % 5) / 10, (h % 100) / 100]);
    else if (d === 9) rocks.push([x + .6, y + .55, .8 + (h % 3) / 5, (h % 100) / 100]);
  }
  const mk = (geo, mat, list, f, cast = true) => { const im = new T.InstancedMesh(geo, mat, Math.max(1, list.length)), m4 = new T.Matrix4(), c = new T.Color(); im.count = list.length; list.forEach((t, i) => { f(m4, t); im.setMatrixAt(i, m4); c.setHSL(.25 + (t[3] - .5) * .06, .45 + t[3] * .15, .5 + (t[3] - .5) * .18); im.setColorAt(i, c); }); im.castShadow = cast; im.receiveShadow = true; W.add(im); };
  const blob = (() => { const parts = []; for (const [x, y, z, r] of [[0, .3, 0, .17], [.1, .27, .05, .13], [-.09, .29, -.04, .13], [.02, .4, -.02, .12]]) { const s2 = new T.IcosahedronGeometry(r, 1); s2.translate(x, y, z); parts.push(s2.index ? s2.toNonIndexed() : s2); } return mergeGeos(parts); })();
  mk(new T.CylinderGeometry(.022, .03, .22, 5).translate(0, .11, 0), colMat('#4a3524'), forest, (m4, t) => m4.compose(new T.Vector3(t[0], 0, t[1]), new T.Quaternion(), new T.Vector3(t[2], t[2], t[2])));
  mk(blob, new T.MeshStandardMaterial({ color: '#ffffff', roughness: .95, flatShading: true }), forest, (m4, t) => m4.compose(new T.Vector3(t[0], 0, t[1]), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), t[3] * 6), new T.Vector3(t[2], t[2], t[2])));
  const lat = (() => { const pts = []; for (let i = 0; i <= 8; i++) { const f = i / 8; pts.push(new T.Vector2(Math.sin(Math.PI * Math.pow(f, .8)) * .08 * (1 - f * .35), .05 + f * .7)); } return new T.LatheGeometry(pts, 8); })();
  mk(lat, new T.MeshStandardMaterial({ color: '#ffffff', roughness: .95, flatShading: true }), servi, (m4, t) => m4.compose(new T.Vector3(t[0], 0, t[1]), new T.Quaternion(), new T.Vector3(t[2], t[2], t[2])));
  const hg = new T.DodecahedronGeometry(.5, 1); { const p = hg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, Math.max(0, y)); } hg.computeVertexNormals(); }
  mk(hg, texMat('rock'), hills, (m4, t) => m4.compose(new T.Vector3(t[0], -.02, t[1]), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), t[3] * 6), new T.Vector3(t[2] * .9, t[2] * .55, t[2] * .8)));
  mk(new T.DodecahedronGeometry(.09, 0), colMat('#9a958a', { roughness: 1, flatShading: true }), rocks, (m4, t) => m4.compose(new T.Vector3(t[0], .03, t[1]), new T.Quaternion().setFromEuler(new T.Euler(t[3] * 3, t[3] * 5, 0)), new T.Vector3(t[2], t[2] * .7, t[2])));
  // dere
  const rv = []; for (let z = -10; z <= N + 10; z += .4) rv.push([3.2 + Math.sin(z * .35) * 1.4 + Math.sin(z * .11) * 2, z]);
  const riv = rv.filter(p => !S.vil.some(v => Math.abs(v.x + .5 - p[0]) < .9 && Math.abs(v.y + .5 - p[1]) < .9));
  if (riv.length === rv.length) { W.add(ribbon(rv, 1.0, new T.MeshStandardMaterial({ color: '#a8946a', roughness: 1 }), .012)); W.add(ribbon(rv, .6, new T.MeshStandardMaterial({ color: '#2d6f80', roughness: .15, metalness: .25 }), .025)); }
  return W;
}
function mapVillages() {
  if (MP.vg) { MP.scene.remove(MP.vg); }
  const g = new T.Group(); MP.vg = g; MP.tiers = {};
  for (const v of S.vil) {
    const tier = tierOf(C.vPoints(v)), barb = v.owner === null, t = mapTemplate(tier, barb), c = t.g.clone();
    c.position.set(v.x + .5, 0, v.y + .5); c.rotation.y = (hash2(v.x, v.y, 3) - .5) * .5;
    if (!barb) for (const f of t.flags) mapFlag(c, f, C.ownerColor(v.owner));
    c.userData.vid = v.id; g.add(c); MP.tiers[v.id] = tier;
  }
  // kendi köylerin altında altın halka
  const ringG = new T.RingGeometry(.44, .5, 40), mine = new T.MeshBasicMaterial({ color: '#dcaa45', transparent: true, opacity: .8, depthWrite: false });
  for (const v of S.vil.filter(v => v.owner === 'P')) { const r = new T.Mesh(ringG, mine); r.rotation.x = -Math.PI / 2; r.position.set(v.x + .5, .035, v.y + .5); g.add(r); }
  MP.scene.add(g); MP.r.shadowMap.needsUpdate = true;
}
function mapSig() { return S.vil.map(v => (v.owner || '-') + tierOf(C.vPoints(v))).join(',') + S.player.color; }
function mapCam() {
  const vw = MP.view, N = C.WORLD; vw.dist = Math.max(3.5, Math.min(30, vw.dist)); vw.pitch = Math.max(.55, Math.min(1.4, vw.pitch));
  vw.tx = Math.max(-1, Math.min(N + 1, vw.tx)); vw.tz = Math.max(-1, Math.min(N + 1, vw.tz));
  const c = MP.cam, cp = Math.cos(vw.pitch);
  c.position.set(vw.tx + Math.sin(vw.yaw) * cp * vw.dist, Math.sin(vw.pitch) * vw.dist, vw.tz + Math.cos(vw.yaw) * cp * vw.dist); c.lookAt(vw.tx, 0, vw.tz);
  const sc = MP.sun.shadow.camera, e = vw.dist * .9 + 3; sc.left = sc.bottom = -e; sc.right = sc.top = e; sc.updateProjectionMatrix();
  MP.sun.position.set(vw.tx - 8, 16, vw.tz + 5); MP.sun.target.position.set(vw.tx, 0, vw.tz); MP.r.shadowMap.needsUpdate = true;
}
function mapProj(x, z) { const r = MP.cv.getBoundingClientRect(), p = new T.Vector3(x, 0, z).project(MP.cam); return { x: (p.x + 1) / 2 * r.width, y: (1 - p.y) / 2 * r.height, z: p.z }; }
function mapPan(dx, dy) {
  const r = MP.cv.getBoundingClientRect(), k = 2 * MP.view.dist * Math.tan(MP.cam.fov * Math.PI / 360) / r.height, yaw = MP.view.yaw, sp = 1 / Math.sin(MP.view.pitch);
  MP.view.tx -= (dx * Math.cos(yaw) + dy * Math.sin(yaw) * sp) * k; MP.view.tz -= (-dx * Math.sin(yaw) + dy * Math.cos(yaw) * sp) * k; mapCam();
}
function mapStart() {
  let cv = $('map');
  if (MP.r) { if (cv !== MP.r.domElement) { cv.replaceWith(MP.r.domElement); cv = MP.r.domElement; } }
  MP.cv = cv;
  if (!MP.r) {
    MP.r = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    MP.r.outputColorSpace = T.SRGBColorSpace; MP.r.toneMapping = T.ACESFilmicToneMapping;
    MP.r.shadowMap.enabled = true; MP.r.shadowMap.type = T.PCFSoftShadowMap; MP.r.shadowMap.autoUpdate = false;
    MP.scene = new T.Scene(); MP.cam = new T.PerspectiveCamera(34, 1, .1, 200);
    MP.hemi = new T.HemisphereLight('#cfe4ff', '#5a4a32', 1.05); MP.scene.add(MP.hemi);
    MP.sun = new T.DirectionalLight('#fff1d8', 2.5); MP.sun.castShadow = true; MP.sun.shadow.mapSize.set(2048, 2048); MP.sun.shadow.bias = -.0004; MP.sun.shadow.normalBias = .02; MP.sun.shadow.camera.near = 1; MP.sun.shadow.camera.far = 60;
    MP.scene.add(MP.sun); MP.scene.add(MP.sun.target);
    MP.world = mapWorld(); MP.scene.add(MP.world); MP.worldSeed = S.seed;
    const sr = new T.Mesh(new T.RingGeometry(.5, .56, 40), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false })); sr.rotation.x = -Math.PI / 2; sr.visible = false; MP.scene.add(sr); MP.selRing = sr;
    cv.style.touchAction = 'none';
    mapWire(cv);
  }
  if (MP.worldSeed !== S.seed) { MP.scene.remove(MP.world); MP.world = mapWorld(); MP.scene.add(MP.world); MP.worldSeed = S.seed; }
  let ov = $('mapOv');
  if (!ov) { ov = document.createElement('canvas'); ov.id = 'mapOv'; ov.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; cv.after(ov); }
  MP.ov = ov; MP.vsig = ''; MP.night = null;
  if (map.ox === null) { mapCenter(cur()); map.ox = 0; }
  mapCam(); mapFrame();
}
function mapCenter(v, keepZoom) { MP.view.tx = v.x + .5; MP.view.tz = v.y + .9; if (MP.cam) mapCam(); }
function mapWire(cv) {
  cv.addEventListener('pointerdown', e => {
    if (e.isPrimary) MP.ptrs.clear();
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    MP.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }); MP.moved = false;
    if (MP.ptrs.size === 2) { const [a, b] = [...MP.ptrs.values()]; MP.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), my: (a.y + b.y) / 2 }; }
  });
  cv.addEventListener('pointermove', e => {
    const p = MP.ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 8) MP.moved = true;
    if (MP.ptrs.size >= 2 && MP.pinch) {
      const [a, b] = [...MP.ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), my = (a.y + b.y) / 2;
      MP.view.dist /= d / MP.pinch.d; let da = ang - MP.pinch.ang; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
      MP.view.yaw -= da; MP.view.pitch += (my - MP.pinch.my) * .004; MP.pinch = { d, ang, my }; mapCam();
    } else if (MP.moved) mapPan(dx, dy);
  });
  const up = e => {
    const had = MP.ptrs.has(e.pointerId); MP.ptrs.delete(e.pointerId); if (MP.ptrs.size < 2) MP.pinch = null;
    if (!had || MP.moved || MP.ptrs.size || e.type !== 'pointerup') return;
    const r = cv.getBoundingClientRect(), ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), MP.cam);
    let hitV = null; const hits = ray.intersectObjects(MP.vg ? MP.vg.children : [], true);
    for (const h of hits) { let o = h.object; while (o && o.userData.vid == null) o = o.parent; if (o) { hitV = o.userData.vid; break; } }
    if (hitV == null) { const pt = new T.Vector3(); if (ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), pt)) { const v = S.vil.find(v => v.x === Math.floor(pt.x) && v.y === Math.floor(pt.z)); hitV = v ? v.id : null; } }
    map.sel = hitV; mapCard();
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('lostpointercapture', e => { MP.ptrs.delete(e.pointerId); if (MP.ptrs.size < 2) MP.pinch = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); if (e.shiftKey) MP.view.yaw += e.deltaY * .003; else MP.view.dist *= Math.exp(e.deltaY * .0015); mapCam(); }, { passive: false });
}
function mapLight(night) {
  if (MP.night === night) return; MP.night = night;
  MP.scene.background = new T.Color(night ? '#0d1626' : '#a9c7d6'); MP.scene.fog = new T.Fog(night ? '#0d1626' : '#a9c7d6', 22, 55);
  MP.sun.intensity = night ? .35 : 2.5; MP.sun.color.set(night ? '#8fa6ff' : '#fff1d8'); MP.hemi.intensity = night ? .35 : 1.05;
  MP.r.toneMappingExposure = night ? 1.2 : 1; MP.r.shadowMap.needsUpdate = true;
}
function mapFrame() {
  if (!MP.cv || !S) return;
  const r = MP.cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2) * MP.quality;
  const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
  if (MP.cv.width !== W || MP.cv.height !== H) { MP.r.setPixelRatio(dpr); MP.r.setSize(r.width, r.height, false); MP.cam.aspect = r.width / r.height; MP.cam.updateProjectionMatrix(); mapCam(); }
  if (MP.ov.width !== W || MP.ov.height !== H) { MP.ov.width = W; MP.ov.height = H; }
  if (MP.frameN++ % 30 === 0 || !MP.vsig) { const sg = mapSig(); if (sg !== MP.vsig) { MP.vsig = sg; mapVillages(); } }
  const hr = SC.hour != null ? SC.hour : new Date().getHours(); mapLight(hr >= 20 || hr < 6);
  const sv = map.sel != null ? S.vil[map.sel] : null;
  MP.selRing.visible = !!sv; if (sv) { MP.selRing.position.set(sv.x + .5, .04, sv.y + .5); MP.selRing.material.opacity = .55 + .4 * Math.sin(performance.now() / 250); }
  MP.r.render(MP.scene, MP.cam);
  // kaplama: güç plakaları, yollar ve ordular (2B çizimler 3B konumlara yansıtılır)
  const a = mapProj(MP.view.tx, MP.view.tz), b = mapProj(MP.view.tx + 1, MP.view.tz); map.T = Math.max(14, Math.hypot(b.x - a.x, b.y - a.y));
  const g = MP.ov.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const armies = drawMoves(g, map.T);
  const T2 = Math.max(30, Math.min(70, map.T));
  const list = S.vil.map(v => ({ v, p: mapProj(v.x + .5, v.y + .95) })).filter(o => o.p.z < 1 && o.p.x > -60 && o.p.x < r.width + 60 && o.p.y > -30 && o.p.y < r.height + 30).sort((p, q) => p.p.y - q.p.y);
  if (map.T > 20) for (const { v, p } of list) powerPlaque(g, p.x, p.y, v, MP.tiers[v.id] != null ? MP.tiers[v.id] : tierOf(C.vPoints(v)), T2);
  armies();
}
// ============================================================
//  BAŞLANGIÇ VİTRİNİ: menünün arkasında yavaşça dönen 3B köy
// ============================================================
function showcase(cv) {
  st.showcase = true;
  if (!st.r) cv.id = 'scene';
  const v = { id: 0, b: { konak: 18, kereste: 20, tas: 20, demir: 18, ambar: 22, ciftlik: 18, kisla: 14, sur: 16, ahir: 12, tophane: 9, kervansaray: 12, medrese: 16, divan: 1 }, bq: [] };
  if (!st.r) {
    st.r = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    st.r.outputColorSpace = T.SRGBColorSpace; st.r.toneMapping = T.ACESFilmicToneMapping;
    st.r.shadowMap.enabled = true; st.r.shadowMap.type = T.PCFSoftShadowMap; st.r.shadowMap.autoUpdate = false;
    st.scene = new T.Scene(); st.cam = new T.PerspectiveCamera(32, 1, .1, 200);
    st.hemi = new T.HemisphereLight('#cfe4ff', '#5a4a32', 1.05); st.scene.add(st.hemi);
    st.sun = new T.DirectionalLight('#fff1d8', 2.6); st.sun.position.set(-4, 20, 13); st.sun.target.position.set(6, 0, 7);
    st.sun.castShadow = true; st.sun.shadow.mapSize.set(2048, 2048); const sc = st.sun.shadow.camera; sc.left = -17; sc.right = 17; sc.top = 17; sc.bottom = -17; sc.near = 1; sc.far = 60; st.sun.shadow.bias = -.0004; st.sun.shadow.normalBias = .02;
    st.scene.add(st.sun); st.scene.add(st.sun.target);
    st.world = buildWorld(); st.scene.add(st.world);
    st.night = null;
  } else if (cv !== st.r.domElement) { cv.replaceWith(st.r.domElement); cv = st.r.domElement; }
  st.cv = cv; st.vil = v; buildVillage(v); st.sig = 'showcase';
  st.night = null; setLight(false);
  const t0 = performance.now();
  let last = 0;
  const loop = ts => {
    if (!$('start') || !document.body.contains(cv) || !st.showcase) { st.showcase = false; return; }
    if (ts - last < 33) { requestAnimationFrame(loop); return; } last = ts;
    const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    if (cv.width !== Math.round(r.width * dpr)) { st.r.setPixelRatio(dpr); st.r.setSize(r.width, r.height, false); st.cam.aspect = r.width / r.height; st.cam.updateProjectionMatrix(); }
    const a = Math.PI / 4 + (ts - t0) / 24000;
    st.view = { tx: 6.4, tz: 7.4, yaw: a, pitch: .62, dist: 19 }; applyCam();
    animate(ts); st.r.render(st.scene, st.cam);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

return { ok: true, start, st, setView: o => { Object.assign(st.view, o); applyCam(); }, showcase, thumb, thumbKey,
  map: { start: mapStart, frame: mapFrame, center: mapCenter, proj: mapProj, zoom: f => { MP.view.dist /= f; mapCam(); }, focus: (x, z) => { MP.view.tx = x; MP.view.tz = z + .4; mapCam(); }, st: MP } };
})();
