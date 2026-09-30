// ---------- KÖY MANZARASI (izometrik, dokulu, ışık ve gölgeli) ----------
// Mantıksal sahne 720x440. Dünya koordinatı (u, v, z): u sağ-aşağı, v sol-aşağı, z yukarı.
// Durağan katman (zemin, gölgeler, binalar) yalnızca köy değişince yeniden çizilir;
// hareketli katman (duman, bayrak, köylü, su, at) her karede üstüne çizilir.
const SC = { W: 820, H: 1040, hits: [], raf: 0, last: 0, flash: null, stat: null, sig: '', anims: [], wins: [] };
const TW = 56, TH = 28, ZH = 34, O = { x: 330, y: 340 };
let OFF = [0, 0];
const LV = (() => { const l = [-0.5, 0.3, 0.81], m = Math.hypot(...l); return l.map(x => x / m); })();
const SHV = [-LV[0] / LV[2], -LV[1] / LV[2]];
let MODE = 'draw', TRACK = null, SHADOWS = [], TEX = null;
const PATC = new WeakMap();

function mul32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function trackPt(x, y) { if (TRACK) { if (x < TRACK.x0) TRACK.x0 = x; if (x > TRACK.x1) TRACK.x1 = x; if (y < TRACK.y0) TRACK.y0 = y; if (y > TRACK.y1) TRACK.y1 = y; } }
function Pq(u, v, z = 0) { u += OFF[0]; v += OFF[1]; return { x: O.x + (u - v) * TW / 2, y: O.y + (u + v) * TH / 2 - z * ZH }; }
function P(u, v, z = 0) { const p = Pq(u, v, z); if (MODE === 'draw') trackPt(p.x, p.y); return p; }
const RX = r => r * TW / Math.SQRT2, RY = r => r * TH / Math.SQRT2;

// ---------- dokular ----------
const TEXR = 3;   // dokular 3 kat çözünürlükte üretilir: yakınlaşınca bulanıklaşmaz
function mkTex(w, h, fn) { const c = document.createElement('canvas'); c.width = w * TEXR; c.height = h * TEXR; const g = c.getContext('2d'); g.scale(TEXR, TEXR); fn(g, w, h); return c; }
function bricks(g, w, h, rh, minW, maxW, col, rnd, bevel = true) {
  const rows = Math.round(h / rh);
  for (let r = 0; r < rows; r++) {
    const ws = []; let s = 0; while (s < w) { const b = minW + rnd() * (maxW - minW); ws.push(b); s += b; }
    const k = w / s; let x = rnd() * w;
    for (const b0 of ws) {
      const bw = b0 * k, c = col();
      for (const ox of [0, -w]) {
        const X = x + ox + .7, Y = r * rh + .7, W = bw - 1.4, H = rh - 1.4;
        g.fillStyle = c; g.fillRect(X, Y, W, H);
        if (bevel) { g.fillStyle = 'rgba(255,250,235,.18)'; g.fillRect(X, Y, W, 1.1); g.fillRect(X, Y, 1, H); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(X, Y + H - 1.1, W, 1.1); g.fillRect(X + W - 1, Y, 1, H); }
      }
      x += bw;
    }
  }
}
function buildTex() {
  const rnd = mul32(90210), T = {};
  const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;
  const speck = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { const s = .8 + rnd() * 1.6; g.fillStyle = rnd() < .5 ? `rgba(0,0,0,${a * rnd()})` : `rgba(255,255,255,${a * rnd()})`; g.fillRect(rnd() * w, rnd() * h, s, s); } };
  T.stone = mkTex(120, 72, (g, w, h) => { g.fillStyle = hsl(34, 14, 40); g.fillRect(0, 0, w, h); bricks(g, w, h, 12, 16, 30, () => hsl(32 + rnd() * 10, 18 + rnd() * 14, 60 + rnd() * 13), rnd); speck(g, w, h, 900, .12); });
  T.fort = mkTex(160, 84, (g, w, h) => { g.fillStyle = hsl(30, 8, 34); g.fillRect(0, 0, w, h); bricks(g, w, h, 14, 22, 42, () => hsl(28 + rnd() * 14, 7 + rnd() * 10, 50 + rnd() * 15), rnd); speck(g, w, h, 1400, .14); });
  T.plaster = mkTex(80, 80, (g, w, h) => { g.fillStyle = hsl(40, 34, 84); g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(140,110,70,${.03 + rnd() * .04})`; g.beginPath(); g.ellipse(12 + rnd() * 56, 12 + rnd() * 56, 4 + rnd() * 8, 3 + rnd() * 6, rnd() * 3, 0, 7); g.fill(); } speck(g, w, h, 500, .06); });
  T.roof = mkTex(48, 40, (g, w, h) => {
    g.fillStyle = hsl(12, 45, 24); g.fillRect(0, 0, w, h);
    for (let r = 0; r < 5; r++) for (let c = -1; c < 7; c++) {
      const x = c * 8 + (r % 2) * 4, y = r * 8, L = 38 + rnd() * 12;
      const gr = g.createLinearGradient(x, y, x + 8, y); gr.addColorStop(0, hsl(13, 55, L - 9)); gr.addColorStop(.45, hsl(15, 60, L + 7)); gr.addColorStop(1, hsl(12, 55, L - 12));
      g.fillStyle = gr; g.beginPath(); g.moveTo(x + .5, y); g.lineTo(x + 7.5, y); g.lineTo(x + 7.5, y + 6); g.quadraticCurveTo(x + 4, y + 9.5, x + .5, y + 6); g.closePath(); g.fill();
    }
    speck(g, w, h, 160, .1);
  });
  T.lead = mkTex(40, 40, (g, w, h) => { g.fillStyle = hsl(205, 9, 56); g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 10) { g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x, 0, 1, h); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 1, 0, 1, h); } speck(g, w, h, 200, .07); });
  T.wood = mkTex(48, 64, (g, w, h) => {
    for (let x = 0; x < w; x += 8) {
      g.fillStyle = hsl(26, 32 + rnd() * 12, 27 + rnd() * 12); g.fillRect(x, 0, 8, h);
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = .6;
      for (let k = 0; k < 3; k++) { const gx = x + 1.5 + rnd() * 5; g.beginPath(); g.moveTo(gx, 0); g.bezierCurveTo(gx + 1.5, h * .3, gx - 1.5, h * .6, gx, h); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x + 7.2, 0, .8, h);
    }
    speck(g, w, h, 150, .08);
  });
  T.turq = mkTex(20, 20, (g, w, h) => {
    g.fillStyle = hsl(178, 62, 30); g.fillRect(0, 0, w, h);
    g.fillStyle = hsl(174, 58, 50); g.beginPath(); g.moveTo(10, 1.5); g.lineTo(18.5, 10); g.lineTo(10, 18.5); g.lineTo(1.5, 10); g.closePath(); g.fill();
    g.fillStyle = hsl(46, 70, 64); g.beginPath(); g.arc(10, 10, 2.4, 0, 7); g.fill();
    g.fillStyle = hsl(214, 55, 30); for (const [x, y] of [[0, 0], [20, 0], [0, 20], [20, 20]]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, 0, w, 1);
  });
  T.dirt = mkTex(96, 96, (g, w, h) => {
    g.fillStyle = hsl(34, 26, 52); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.fillStyle = `hsla(${28 + rnd() * 12},${20 + rnd() * 15}%,${40 + rnd() * 25}%,.25)`; g.beginPath(); g.ellipse(10 + rnd() * 76, 10 + rnd() * 76, 3 + rnd() * 8, 2 + rnd() * 5, rnd() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 90; i++) { g.fillStyle = hsl(30, 8, 50 + rnd() * 25); g.beginPath(); g.arc(3 + rnd() * (w - 6), 3 + rnd() * (h - 6), .6 + rnd() * 1.2, 0, 7); g.fill(); }
    speck(g, w, h, 900, .1);
  });
  T.pave = mkTex(48, 48, (g, w, h) => { g.fillStyle = hsl(30, 10, 36); g.fillRect(0, 0, w, h); bricks(g, w, h, 8, 7, 12, () => hsl(33 + rnd() * 8, 12 + rnd() * 8, 56 + rnd() * 14), rnd); speck(g, w, h, 300, .1); });
  T.rock = mkTex(96, 96, (g, w, h) => {
    g.fillStyle = hsl(30, 6, 46); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const x = rnd() * w, y = rnd() * h, r = 4 + rnd() * 12; g.fillStyle = hsl(28 + rnd() * 12, 5 + rnd() * 8, 38 + rnd() * 26); g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + rnd() * .5, rr = r * (.6 + rnd() * .5); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = .7;
    for (let i = 0; i < 14; i++) { let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - .5) * 14; y += rnd() * 10; g.lineTo(x, y); } g.stroke(); }
    speck(g, w, h, 900, .14);
  });
  T.wheat = mkTex(32, 32, (g, w, h) => { for (let y = 0; y < h; y += 4) { g.fillStyle = hsl(44, 66, 55 + rnd() * 6); g.fillRect(0, y, w, 2.6); g.fillStyle = hsl(38, 55, 40); g.fillRect(0, y + 2.6, w, 1.4); } speck(g, w, h, 160, .12); });
  T.crop = mkTex(33, 32, (g, w, h) => { g.fillStyle = hsl(30, 35, 28); g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 3) { g.fillStyle = hsl(92 + rnd() * 16, 45, 30 + rnd() * 14); g.beginPath(); g.arc(x + 1.5, y + 1.8, 1.5, 0, 7); g.fill(); } });
  T.plowed = mkTex(32, 32, (g, w, h) => { for (let y = 0; y < h; y += 4) { g.fillStyle = hsl(26, 34, 33); g.fillRect(0, y, w, 2.4); g.fillStyle = hsl(24, 30, 22); g.fillRect(0, y + 2.4, w, 1.6); } speck(g, w, h, 200, .12); });
  return T;
}
function pat(g, name) { let m = PATC.get(g); if (!m) { m = {}; PATC.set(g, m); } if (!m[name]) { const p = g.createPattern(TEX[name], 'repeat'); try { p.setTransform(new DOMMatrix([1 / TEXR, 0, 0, 1 / TEXR, 0, 0])); } catch (e) {} m[name] = p; } return m[name]; }

// ---------- 3B yardımcılar ----------
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = a => Math.hypot(a[0], a[1], a[2]);
function shadeOf(pts) {
  let n = cross3(sub3(pts[1], pts[0]), sub3(pts[pts.length - 1], pts[0]));
  const m = len3(n) || 1; n = n.map(x => x / m);
  if (dot3(n, [1, 1, 1.3]) < 0) n = n.map(x => -x);
  return 0.6 + 0.47 * Math.max(0, dot3(n, LV));
}
function face(g, pts, tex, opt = {}) {
  if (MODE !== 'draw') return;
  const s = pts.map(p => P(p[0], p[1], p[2]));
  g.save();
  if (opt.alpha != null) g.globalAlpha = opt.alpha;
  g.beginPath(); s.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath();
  if (tex) {
    g.save(); g.clip();
    const o = s[0], a = s[1], b = s[s.length - 1];
    const la = len3(sub3(pts[1], pts[0])) || 1, lb = len3(sub3(pts[pts.length - 1], pts[0])) || 1, D = opt.dens || 44;
    g.transform((a.x - o.x) / (la * D), (a.y - o.y) / (la * D), (b.x - o.x) / (lb * D), (b.y - o.y) / (lb * D), o.x, o.y);
    g.fillStyle = pat(g, tex); g.fillRect(-4, -4, la * D + 8, lb * D + 8);
    g.restore();
  } else { g.fillStyle = opt.color || '#888'; g.fill(); }
  const f = opt.shade != null ? opt.shade : shadeOf(pts);
  if (f < 1) { g.fillStyle = `rgba(24,18,36,${Math.min(.7, 1 - f)})`; g.fill(); }
  else if (f > 1) { g.fillStyle = `rgba(255,244,220,${Math.min(.3, f - 1)})`; g.fill(); }
  const zs = pts.map(p => p[2]), zlo = Math.min(...zs), zhi = Math.max(...zs);
  if (opt.grad !== false && zhi - zlo > .12) {   // duvar dibi koyu, üstü aydınlık: binaya hacim verir
    let y0 = Infinity, y1 = -Infinity; for (const p of s) { if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
    const gr = g.createLinearGradient(0, y1, 0, y0);
    gr.addColorStop(0, 'rgba(22,14,20,.30)'); gr.addColorStop(.45, 'rgba(22,14,20,0)'); gr.addColorStop(1, 'rgba(255,240,210,.10)');
    g.fillStyle = gr; g.fill();
  }
  if (opt.edge !== false) { g.strokeStyle = opt.edgeCol || 'rgba(30,20,10,.3)'; g.lineWidth = .6; g.stroke(); }
  g.restore();
}
function hull(p) {
  p = p.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop(); return lo.concat(up);
}
function shPoly(base, h) { const pts = []; for (const [u, v] of base) { pts.push(Pq(u, v)); pts.push(Pq(u + SHV[0] * h, v + SHV[1] * h)); } SHADOWS.push(hull(pts)); }
function shBox(u0, v0, w, d, h) { shPoly([[u0, v0], [u0 + w, v0], [u0 + w, v0 + d], [u0, v0 + d]], h); }
function shCirc(u, v, r, h) { const b = []; for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; b.push([u + Math.cos(a) * r, v + Math.sin(a) * r]); } shPoly(b, h); }

function contactShadow(g, u0, v0, w, d) {
  g.save();
  for (const [e, a] of [[.16, .10], [.07, .16]]) {
    const q = [P(u0 - e * .3, v0 - e * .3), P(u0 + w + e, v0 - e * .3), P(u0 + w + e, v0 + d + e), P(u0 - e * .3, v0 + d + e)];
    g.beginPath(); q.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.fillStyle = `rgba(20,16,10,${a})`; g.fill();
  }
  g.restore();
}
// sıvalı duvara ahşap çatkı (hımış) kirişleri: ön (v0+d) ve sağ (u0+w) yüzlere
function timber(g, u0, v0, w, d, z0, h, full = true) {
  if (MODE !== 'draw') return;
  g.save(); g.strokeStyle = 'rgba(78,50,28,.9)'; g.lineCap = 'round';
  const line = (a, b, lw) => { g.lineWidth = lw; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); };
  const faces = [[u => P(u0 + u * w, v0 + d + .003, 0), w], [u => P(u0 + w + .003, v0 + d - u * d, 0), d]];
  for (const [at, L] of faces) {
    const pt = (f, z) => { const p = at(f); return { x: p.x, y: p.y - z * ZH }; };
    for (const z of full ? [z0 + .03, z0 + h * .52, z0 + h - .03] : [z0 + h * .52]) line(pt(0, z), pt(1, z), 1.5);
    if (!full) continue;
    const n = Math.max(2, Math.round(L / .32));
    for (let i = 0; i <= n; i++) line(pt(i / n, z0 + .03), pt(i / n, z0 + h - .03), i === 0 || i === n ? 1.6 : 1.1);
    for (let i = 0; i < n; i += 2) line(pt(i / n, z0 + .05), pt((i + 1) / n, z0 + h * .5), .9);
  }
  g.restore();
}
function ibox(g, u0, v0, w, d, z0, h, tex, top, opt = {}) {
  if (MODE === 'shadow') { if (!opt.noShadow) shBox(u0, v0, w, d, z0 + h); return; }
  const z1 = z0 + h;
  if (z0 <= .02 && !opt.noAO && MODE === 'draw') contactShadow(g, u0, v0, w, d);
  face(g, [[u0, v0 + d, z1], [u0 + w, v0 + d, z1], [u0 + w, v0 + d, z0], [u0, v0 + d, z0]], tex, opt);
  face(g, [[u0 + w, v0 + d, z1], [u0 + w, v0, z1], [u0 + w, v0, z0], [u0 + w, v0 + d, z0]], tex, opt);
  if (top !== null) face(g, [[u0, v0, z1], [u0 + w, v0, z1], [u0 + w, v0 + d, z1], [u0, v0 + d, z1]], top || tex, { color: opt.color, dens: opt.dens });
}
function hipRoof(g, u0, v0, w, d, z, rh, tex, ov = .1) {
  if (MODE === 'draw') {   // saçağın duvara düşen gölgesi
    const ez = Math.max(0, z - .13);
    face(g, [[u0, v0 + d + .004, z], [u0 + w, v0 + d + .004, z], [u0 + w, v0 + d + .004, ez], [u0, v0 + d + .004, ez]], null, { color: 'rgba(20,12,8,.34)', shade: 1, edge: false, grad: false });
    face(g, [[u0 + w + .004, v0 + d, z], [u0 + w + .004, v0, z], [u0 + w + .004, v0, ez], [u0 + w + .004, v0 + d, ez]], null, { color: 'rgba(20,12,8,.4)', shade: 1, edge: false, grad: false });
  }
  u0 -= ov; v0 -= ov; w += 2 * ov; d += 2 * ov;
  if (MODE === 'shadow') { shBox(u0, v0, w, d, z + rh * .6); return; }
  const A = [u0, v0, z], B = [u0 + w, v0, z], C = [u0 + w, v0 + d, z], D = [u0, v0 + d, z];
  if (w >= d) {
    const r1 = [u0 + d / 2, v0 + d / 2, z + rh], r2 = [u0 + w - d / 2, v0 + d / 2, z + rh];
    face(g, [A, B, r2, r1], tex, { grad: false }); face(g, [D, A, r1], tex, { grad: false }); face(g, [B, C, r2], tex, { grad: false }); face(g, [D, C, r2, r1], tex, { grad: false });
    ridge(g, r1, r2, [D, C, B]);
  } else {
    const r1 = [u0 + w / 2, v0 + w / 2, z + rh], r2 = [u0 + w / 2, v0 + d - w / 2, z + rh];
    face(g, [A, B, r1], tex, { grad: false }); face(g, [D, A, r1, r2], tex, { grad: false }); face(g, [B, C, r2, r1], tex, { grad: false }); face(g, [D, C, r2], tex, { grad: false });
    ridge(g, r1, r2, [D, C, B]);
  }
}
function ridge(g, r1, r2, eave) {
  if (MODE !== 'draw') return;
  const a = P(...r1), b = P(...r2), c = P(...eave[1]);
  g.save(); g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,236,200,.55)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  g.strokeStyle = 'rgba(255,236,200,.28)'; g.lineWidth = .9; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(c.x, c.y); g.stroke();
  const e = eave.map(q => P(...q)); g.strokeStyle = 'rgba(30,16,10,.55)'; g.lineWidth = 1.2; g.beginPath(); e.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke();
  g.restore();
}
function cyl(g, u, v, z0, h, r, tex, base) {
  if (MODE === 'shadow') { shCirc(u, v, r, z0 + h); return; }
  const c0 = P(u, v, z0), c1 = P(u, v, z0 + h), rx = RX(r), ry = RY(r);
  trackPt(c0.x - rx, c0.y + ry); trackPt(c1.x + rx, c1.y - ry);
  if (z0 <= .02 && r > .1) { g.fillStyle = 'rgba(20,16,10,.16)'; g.beginPath(); g.ellipse(c0.x + rx * .1, c0.y + ry * .15, rx * 1.25, ry * 1.3, 0, 0, 7); g.fill(); }
  g.save(); g.beginPath(); g.moveTo(c1.x - rx, c1.y); g.lineTo(c0.x - rx, c0.y); g.ellipse(c0.x, c0.y, rx, ry, 0, Math.PI, 0, true); g.lineTo(c1.x + rx, c1.y); g.closePath();
  g.fillStyle = base; g.fill();
  if (tex) { g.save(); g.clip(); g.translate(c0.x - rx, c1.y); g.scale(.9, .9); g.fillStyle = pat(g, tex); g.fillRect(0, -10, rx * 2.4 + 10, c0.y - c1.y + ry + 30); g.restore(); }
  const gr = g.createLinearGradient(c0.x - rx, 0, c0.x + rx, 0);
  gr.addColorStop(0, 'rgba(255,245,225,.12)'); gr.addColorStop(.3, 'rgba(255,245,225,.05)'); gr.addColorStop(.7, 'rgba(22,16,32,.25)'); gr.addColorStop(1, 'rgba(22,16,32,.5)');
  g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(30,20,10,.3)'; g.lineWidth = .6; g.stroke();
  g.beginPath(); g.ellipse(c1.x, c1.y, rx, ry, 0, 0, 7); g.fillStyle = base; g.fill();
  if (tex) { g.save(); g.clip(); g.fillStyle = pat(g, tex); g.fillRect(c1.x - rx, c1.y - ry, rx * 2, ry * 2); g.restore(); }
  g.fillStyle = 'rgba(255,245,225,.1)'; g.fill(); g.stroke();
  g.restore();
}
function cone(g, u, v, z, r, hg, base, tex) {
  if (MODE === 'shadow') { shCirc(u, v, r * .8, z + hg * .6); return; }
  const c = P(u, v, z), a = P(u, v, z + hg), rx = RX(r), ry = RY(r);
  trackPt(c.x - rx, c.y + ry); trackPt(c.x + rx, a.y);
  g.save(); g.beginPath(); g.moveTo(c.x - rx, c.y); g.lineTo(a.x, a.y); g.lineTo(c.x + rx, c.y); g.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI); g.closePath();
  g.fillStyle = base; g.fill();
  if (tex) { g.save(); g.clip(); g.fillStyle = pat(g, tex); g.fillRect(c.x - rx - 2, a.y - 2, rx * 2 + 4, c.y - a.y + ry + 4); g.restore(); }
  const gr = g.createLinearGradient(c.x - rx, 0, c.x + rx, 0);
  gr.addColorStop(0, 'rgba(255,245,225,.18)'); gr.addColorStop(.4, 'rgba(255,245,225,0)'); gr.addColorStop(1, 'rgba(22,16,32,.5)');
  g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(30,20,10,.35)'; g.lineWidth = .6; g.stroke();
  g.restore();
  return a;
}
function alem(g, x, y) {
  g.strokeStyle = '#b8892c'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 11); g.stroke();
  g.fillStyle = '#e8c15a'; g.beginPath(); g.arc(x, y - 6, 1.7, 0, 7); g.fill();
  g.strokeStyle = '#e8c15a'; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y - 14, 2.8, .15 * Math.PI, .85 * Math.PI); g.stroke();
}
function dome(g, u, v, z, r, hg, c1, c2, c3) {
  if (MODE === 'shadow') { shCirc(u, v, r, z + hg); return; }
  const c = P(u, v, z), rx = RX(r), ry = RY(r), hh = hg * ZH;
  trackPt(c.x - rx, c.y - hh - 14); trackPt(c.x + rx, c.y + ry);
  g.save(); g.beginPath(); g.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI); g.ellipse(c.x, c.y, rx, hh, 0, Math.PI, Math.PI * 2); g.closePath();
  const gr = g.createRadialGradient(c.x - rx * .38, c.y - hh * .6, rx * .05, c.x - rx * .1, c.y - hh * .2, rx * 1.3);
  gr.addColorStop(0, c1); gr.addColorStop(.45, c2); gr.addColorStop(1, c3); g.fillStyle = gr; g.fill();
  g.clip(); g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = .7;
  for (const k of [.33, .66]) { g.beginPath(); g.ellipse(c.x, c.y, rx * k, hh, 0, Math.PI, Math.PI * 2); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(c.x - rx * .38, c.y - hh * .62, rx * .16, hh * .1, -.4, 0, 7); g.fill();
  g.restore();
  alem(g, c.x, c.y - hh);
}
function hole(g, a, b, z0, z1, arch, col = '#2a2019', glow = true) {
  if (MODE !== 'draw') return;
  const s0 = P(a[0], a[1], z1), s1 = P(b[0], b[1], z1), s2 = P(b[0], b[1], z0), s3 = P(a[0], a[1], z0);
  const c = { x: (s0.x + s1.x) / 2, y: (s0.y + s1.y) / 2 - (arch || 0) * ZH * 2 };
  const path = () => { g.beginPath(); g.moveTo(s3.x, s3.y); g.lineTo(s0.x, s0.y); if (arch) g.quadraticCurveTo(c.x, c.y, s1.x, s1.y); else g.lineTo(s1.x, s1.y); g.lineTo(s2.x, s2.y); g.closePath(); };
  path(); g.fillStyle = col; g.fill(); g.strokeStyle = 'rgba(245,230,195,.45)'; g.lineWidth = .7; g.stroke();
  if (glow) {   // pencere: tahta kanat çizgisi ve taş denizlik
    g.strokeStyle = 'rgba(120,80,45,.7)'; g.lineWidth = .6; const m0 = { x: (s0.x + s1.x) / 2, y: (s0.y + s1.y) / 2 }, m1 = { x: (s3.x + s2.x) / 2, y: (s3.y + s2.y) / 2 };
    g.beginPath(); g.moveTo(m0.x, m0.y); g.lineTo(m1.x, m1.y); g.stroke();
    g.strokeStyle = 'rgba(250,238,210,.85)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(s3.x - (s2.x - s3.x) * .12, s3.y + 1 - (s2.y - s3.y) * .12); g.lineTo(s2.x + (s2.x - s3.x) * .12, s2.y + 1 + (s2.y - s3.y) * .12); g.stroke();
    SC.wins.push({ s0, s1, s2, s3, c, arch: !!arch });
  }
}
function flagPole(g, u, v, z, h, col, s = 1) {
  if (MODE !== 'draw') return;
  const a = P(u, v, z), b = P(u, v, z + h);
  g.strokeStyle = '#4a3f35'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  g.fillStyle = '#d8b04a'; g.beginPath(); g.arc(b.x, b.y, 1.3, 0, 7); g.fill();
  SC.anims.push({ k: 'flag', x: b.x, y: b.y + 1, col, s });
}
function smokeAt(u, v, z, ph) { if (MODE === 'draw') { const p = Pq(u, v, z); SC.anims.push({ k: 'smoke', x: p.x, y: p.y, ph }); } }

// ---------- zemin ----------
function hash2(i, j, s) { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, s) { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s), ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy); return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy; }
function fbm(x, y, s) { return vnoise(x, y, s) * .55 + vnoise(x * 2.1, y * 2.1, s + 1) * .3 + vnoise(x * 4.3, y * 4.3, s + 2) * .15; }
function ground(g, pw, ph, seed, rnd) {
  const gw = Math.ceil(pw / 2), gh = Math.ceil(ph / 2), c = document.createElement('canvas'); c.width = gw; c.height = gh;
  const x = c.getContext('2d'), id = x.createImageData(gw, gh), d = id.data, k = SC.W / gw;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const lx = i * k, ly = j * k, n1 = fbm(lx / 95, ly / 70, seed), n2 = fbm(lx / 45 + 50, ly / 34, seed + 7), f = (hash2(i, j, seed + 3) - .5) * 14;
    let r = 74 + 44 * n1, gg = 100 + 44 * n1, b = 44 + 22 * n1;
    if (n2 > .58) { const t = Math.min(1, (n2 - .58) * 3); r += (150 - r) * t * .6; gg += (140 - gg) * t * .5; b += (88 - b) * t * .6; }
    const o = (j * gw + i) * 4; d[o] = r + f; d[o + 1] = gg + f; d[o + 2] = b + f * .6; d[o + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(c, 0, 0, pw, ph); g.restore();
  for (let i = 0; i < 700; i++) {
    const px = rnd() * SC.W, py = rnd() * SC.H, l = 2 + rnd() * 3;
    g.strokeStyle = rnd() < .5 ? 'rgba(40,70,25,.35)' : 'rgba(170,190,110,.3)'; g.lineWidth = .8;
    g.beginPath(); g.moveTo(px, py); g.lineTo(px + (rnd() - .5) * 2, py - l); g.stroke();
  }
  for (let i = 0; i < 60; i++) { g.fillStyle = ['#e8d36a', '#f2f0e8', '#c46a8a', '#8fa8e0'][i % 4]; g.globalAlpha = .7; g.beginPath(); g.arc(rnd() * SC.W, rnd() * SC.H, .9, 0, 7); g.fill(); }
  g.globalAlpha = 1;
}

// ---------- yerleşim ----------
const WA = 1.1, WB = 11.2, G0 = 5.75, G1 = 6.65, GC = 6.2, SPREAD = 1.9;
const LOTS = {
  konak: [4.75, 4.75, 2.5, 2.5], kisla: [3.5, 3.5, 1.8, .9], ambar: [7.5, 3.5, 1.2, 1.15], divan: [7.55, 7.55, 1.1, 1.0],
  tophane: [3.5, 7.3, 1.2, 1.0], kervansaray: [3.3, 13.0, 1.6, 1.25], medrese: [7.6, 5.2, 1.15, 1.15], ahir: [10.0, 3.6, 1.4, .9], kereste: [.6, 7.0, .7, .6], tas: [.55, .3, 1.8, 1.5],
  demir: [9.9, .1, 1.4, 1.3], ciftlik: [9.85, 7.85, 2.8, 3.4], sur: [G0, 8.75, G1 - G0, .35],
};
// binaları köy merkezinden dışarı doğru açar (boyutları aynı kalır)
const SH = {};
for (const k in LOTS) { const [u, v, w, d] = LOTS[k]; SH[k] = (k === 'konak' || k === 'sur') ? [0, 0] : [(u + w / 2 - 6) * (SPREAD - 1), (v + d / 2 - 6) * (SPREAD - 1)]; }
// sur dışındaki yapılar surdan aynı uzaklıkta kalsın
Object.assign(SH, { divan: [.9, .9], kervansaray: [0, 0], ahir: [2.3, -1.0], kereste: [-2.0, 1.3], tas: [-2.3, -2.3], demir: [2.2, -1.9], ciftlik: [2.3, 2.3] });
const shiftR = (r, o) => [r[0] + o[0], r[1] + o[1], r[2], r[3]];
const ROADS = [
  { pts: [[GC, WB], [GC, 18]], w: .55 },
  { pts: [[GC, 12.6], [.45, 12.6], [.45, -1.2]], w: .38 },
  { pts: [[.45, 9.9], [-1.2, 9.9]], w: .3 },
  { pts: [[GC, 12.6], [11.9, 12.6], [11.9, -.1], [12.6, -.1]], w: .38 },
];
const riverU = v => -3.3 + .3 * Math.sin(v * .55);

function occupied(u, v) {
  const inR = (r, m) => u > r[0] - m && u < r[0] + r[2] + m && v > r[1] - m && v < r[1] + r[3] + m;
  if (u > WA - .7 && u < WB + .6 && v > WA - .7 && v < WB + .9) return true;
  for (const k in LOTS) if (inR(shiftR(LOTS[k], SH[k]), .35)) return true;
  if (inR(shiftR([9.9, 3.5, 2.0, 3.0], SH.ahir), .2) || inR(shiftR([9.9, 11.4, 1.6, .9], SH.ciftlik), .3) || inR(shiftR([9.2, -.9, 2.9, 2.6], SH.demir), 0) || inR(shiftR([.5, 6.0, 1.8, 2.4], SH.kereste), .2)) return true;
  for (const r of ROADS) for (let i = 0; i < r.pts.length - 1; i++) {
    const [a, b] = [r.pts[i], r.pts[i + 1]];
    if (inR([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])], r.w / 2 + .35)) return true;
  }
  return Math.abs(u - riverU(v)) < .85;
}

// ---------- ağaçlar ----------
function tree(g, u, v, kind, sz, seed) {
  const tall = kind === 'servi' ? 1.5 : kind === 'kavak' ? 1.4 : 1.0;
  if (MODE === 'shadow') { shCirc(u, v, (kind === 'mese' ? .3 : .13) * sz, tall * sz); return; }
  if (MODE !== 'draw') return;
  const b = Pq(u, v, 0), r = mul32(seed);
  trackPt(b.x - 22 * sz, b.y - 54 * sz); trackPt(b.x + 22 * sz, b.y + 4);
  if (kind === 'mese') {
    g.fillStyle = '#4a3524'; g.fillRect(b.x - 1.6 * sz, b.y - 12 * sz, 3.2 * sz, 12 * sz);
    const cx = b.x, cy = b.y - 22 * sz, blobs = [];
    for (let k = 0; k < 7; k++) blobs.push([cx + (r() - .5) * 17 * sz, cy + (r() - .5) * 11 * sz + (k < 3 ? -3 : 3) * sz, (6.5 + r() * 5) * sz]);
    blobs.sort((a, c) => a[1] - c[1]);
    for (const [x, y, rr] of blobs) {
      const gr = g.createRadialGradient(x - rr * .4, y - rr * .45, rr * .1, x, y, rr);
      gr.addColorStop(0, '#93b65a'); gr.addColorStop(.55, '#4f7a33'); gr.addColorStop(1, '#27451f');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
    }
    for (let k = 0; k < 16; k++) { g.fillStyle = r() < .5 ? 'rgba(180,210,120,.35)' : 'rgba(18,36,14,.28)'; g.beginPath(); g.arc(cx + (r() - .5) * 22 * sz, cy + (r() - .5) * 16 * sz, 1.2 * sz, 0, 7); g.fill(); }
  } else {
    const h = (kind === 'servi' ? 46 : 42) * sz, w = (kind === 'servi' ? 6.5 : 8) * sz;
    g.fillStyle = '#3d2c1e'; g.fillRect(b.x - 1, b.y - 5, 2, 5);
    g.beginPath(); g.moveTo(b.x, b.y - h);
    g.bezierCurveTo(b.x + w * 1.25, b.y - h * .6, b.x + w * 1.1, b.y - h * .12, b.x, b.y - 3);
    g.bezierCurveTo(b.x - w * 1.1, b.y - h * .12, b.x - w * 1.25, b.y - h * .6, b.x, b.y - h);
    const gr = g.createLinearGradient(b.x - w, 0, b.x + w, 0);
    if (kind === 'servi') { gr.addColorStop(0, '#5e8746'); gr.addColorStop(.45, '#35582c'); gr.addColorStop(1, '#19301a'); }
    else { gr.addColorStop(0, '#a9c267'); gr.addColorStop(.45, '#6e9442'); gr.addColorStop(1, '#3a5a27'); }
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(12,28,10,.3)'; g.lineWidth = .7;
    for (let k = 0; k < 10; k++) { const yy = b.y - h * (.15 + r() * .75), xx = b.x + (r() - .5) * w; g.beginPath(); g.moveTo(xx - 2, yy); g.quadraticCurveTo(xx, yy - 2, xx + 2, yy + 1); g.stroke(); }
  }
}

// ---------- binalar ----------
function bKonak(add, l) {
  const H = .9 + Math.min(l, 25) * .018, m0 = 5.35, m = 1.7, z0 = .1, fv = m0 + m, fu = m0 + m;
  add(6, 6, g => {
    ibox(g, 4.75, 4.75, 2.5, 2.5, 0, z0, 'pave', 'pave', { noShadow: true });
    if (l >= 5) {
      ibox(g, 4.85, 5.6, .5, 1.2, z0, H * .7, 'plaster', null); timber(g, 4.85, 5.6, .5, 1.2, z0, H * .7); hipRoof(g, 4.85, 5.6, .5, 1.2, z0 + H * .7, .3, l >= 20 ? 'lead' : 'roof');
      ibox(g, 5.6, 4.85, 1.2, .5, z0, H * .7, 'plaster', null); timber(g, 5.6, 4.85, 1.2, .5, z0, H * .7); hipRoof(g, 5.6, 4.85, 1.2, .5, z0 + H * .7, .3, l >= 20 ? 'lead' : 'roof');
    }
    ibox(g, m0, m0, m, m, z0, .22, 'stone', null);
    ibox(g, m0, m0, m, m, z0 + .22, H - .22, 'plaster', null);
    timber(g, m0, m0, m, m, z0 + .22, H - .22, false);
    ibox(g, m0 - .02, m0 - .02, m + .04, m + .04, z0 + H - .17, .11, 'turq', null, { dens: 70 });
    ibox(g, m0 - .05, m0 - .05, m + .1, m + .1, z0 + H - .06, .07, 'stone', 'stone');
    for (const a of [5.55, 6.65]) hole(g, [a, fv + .002], [a + .2, fv + .002], z0 + .4, z0 + .66, .06);
    for (const a of [6.65, 5.55]) hole(g, [fu + .002, a + .2], [fu + .002, a], z0 + .4, z0 + .66, .06);
    if (l >= 15) {
      ibox(g, 5.8, fv - .02, .8, .16, 0, H + .36, 'stone', 'stone');
      face(g, [[5.9, fv + .141, z0 + H + .2], [6.5, fv + .141, z0 + H + .2], [6.5, fv + .141, z0 + .1], [5.9, fv + .141, z0 + .1]], 'turq', { dens: 70 });
      hole(g, [6.02, fv + .142], [6.38, fv + .142], z0, z0 + .62, .14, '#3a2414', false);
    } else hole(g, [6.02, fv + .002], [6.38, fv + .002], z0, z0 + .6, .13, '#3a2414', false);
    cyl(g, 6.2, 6.2, z0 + H + .01, .2, .6, 'stone', '#cbbd9d');
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283 + .2, p = P(6.2 + Math.cos(a) * .6, 6.2 + Math.sin(a) * .6, z0 + H + .12); if (Math.sin(a) + Math.cos(a) > -.2) { g.fillStyle = '#2a2019'; g.fillRect(p.x - 1.2, p.y - 3, 2.4, 4.5); } }
    dome(g, 6.2, 6.2, z0 + H + .21, .6, .62, '#b9f2e8', '#2fa596', '#10504a');
    if (l >= 20) { dome(g, 5.1, 6.2, z0 + H * .7 + .3, .22, .24, '#d9e3ea', '#8d9ba6', '#4b5761'); dome(g, 6.2, 5.1, z0 + H * .7 + .3, .22, .24, '#d9e3ea', '#8d9ba6', '#4b5761'); }
    flagPole(g, m0 + .1, fv - .1, z0 + H, .55, S.player.color);
    flagPole(g, fu - .1, m0 + .1, z0 + H, .55, S.player.color);
    smokeAt(m0 + .3, m0 + .3, z0 + H + .1, .2);
  }, 'konak');
  const minaret = (u, v) => g => {
    const h = 1.9 + Math.min(l, 25) * .02;
    ibox(g, u - .17, v - .17, .34, .34, 0, .35, 'stone', 'stone');
    cyl(g, u, v, .35, h * .68, .12, 'stone', '#d8ccb0');
    cyl(g, u, v, .35 + h * .68, .05, .19, null, '#c9bb9b');
    cyl(g, u, v, .4 + h * .68, h * .22, .1, 'stone', '#d8ccb0');
    const a = cone(g, u, v, .4 + h * .9, .12, .55, '#8d99a3', 'lead');
    if (a && MODE === 'draw') alem(g, a.x, a.y);
  };
  if (l >= 8) add(7.3, 5.1, minaret(7.35, 5.05), 'konak');
  if (l >= 15) add(5.1, 7.3, minaret(5.05, 7.35), 'konak');
}
function bMedrese(add, l) {
  const H = .6 + Math.min(l, 20) * .012;
  add(8.2, 5.8, g => {
    const u0 = 7.6, v0 = 5.2, w = 1.15, d = 1.15, fv = v0 + d;
    ibox(g, u0, v0, w, d, 0, H, 'stone', 'pave');
    ibox(g, u0 - .03, v0 - .03, w + .06, d + .06, H, .07, 'stone', 'stone', { noShadow: true });
    for (const a of [v0 + .75, v0 + .3]) hole(g, [u0 + w + .002, a + .14], [u0 + w + .002, a], H * .45, H * .75, .05);
    ibox(g, u0 + .3, fv - .03, .55, .15, 0, H + .28, 'stone', 'stone');
    face(g, [[u0 + .36, fv + .121, H + .18], [u0 + .79, fv + .121, H + .18], [u0 + .79, fv + .121, .05], [u0 + .36, fv + .121, .05]], 'turq', { dens: 70 });
    hole(g, [u0 + .45, fv + .122], [u0 + .7, fv + .122], 0, H * .78, .12, '#3a2414', false);
    cyl(g, u0 + w / 2, v0 + d / 2 - .1, H + .07, .08, .3, 'stone', '#cbbd9d');
    dome(g, u0 + w / 2, v0 + d / 2 - .1, H + .15, .3, .32, '#d9e3ea', '#8d9ba6', '#4b5761');
    if (l >= 10) { cyl(g, u0 + .12, v0 + .12, H + .07, .5, .07, 'stone', '#d8ccb0'); const a = cone(g, u0 + .12, v0 + .12, H + .57, .08, .3, '#8d99a3', 'lead'); if (a && MODE === 'draw') alem(g, a.x, a.y); }
  }, 'medrese');
  if (l >= 15) add(9.0, 5.8, g => {   // kubbeli revak (sütunlu avlu kanadı)
    const u0 = 8.75, v0 = 5.2, d = 1.15, h = .5;
    ibox(g, u0, v0, .3, d, 0, h, 'stone', 'pave');
    for (let i = 0; i < 3; i++) hole(g, [u0 + .302, v0 + d - .08 - i * .37], [u0 + .302, v0 + d - .3 - i * .37], 0, h * .72, .07, '#3a2a1c', false);
    for (let i = 0; i < 3; i++) dome(g, u0 + .15, v0 + d - .19 - i * .37, h, .13, .13, '#d9e3ea', '#8d9ba6', '#4b5761');
  }, 'medrese');
}
function bKervansaray(add, l) {
  const u0 = 3.3, v0 = 13.0, w = 1.6, d = 1.25, H = .55 + Math.min(l, 20) * .01;
  add(u0 + w / 2, v0 + d / 2, g => {
    ibox(g, u0, v0, w, d, 0, H, 'stone', 'pave');
    ibox(g, u0 + .12, v0 + .12, w - .24, d - .24, H - .05, .06, 'pave', 'dirt', { noShadow: true });
    for (let i = 0; i < 4; i++) ibox(g, u0 + .05 + i * .42, v0 - .02, .14, .1, H, .1, 'stone', 'stone', { noShadow: true });
    ibox(g, u0 + .5, v0 + d - .05, .6, .16, 0, H + .3, 'stone', 'stone');
    face(g, [[u0 + .56, v0 + d + .111, H + .2], [u0 + 1.04, v0 + d + .111, H + .2], [u0 + 1.04, v0 + d + .111, .05], [u0 + .56, v0 + d + .111, .05]], 'turq', { dens: 70 });
    hole(g, [u0 + .64, v0 + d + .112], [u0 + .96, v0 + d + .112], 0, H * .8, .12, '#3a2414', false);
    for (const a of [u0 + .15, u0 + 1.25]) hole(g, [a, v0 + d + .002], [a + .15, v0 + d + .002], H * .35, H * .7, .05);
    hole(g, [u0 + w + .002, v0 + .8], [u0 + w + .002, v0 + .6], H * .35, H * .7, .05);
    dome(g, u0 + .8, v0 + d - .2, H + .3, .18, .18, '#d9e3ea', '#8d9ba6', '#4b5761');
    flagPole(g, u0 + .1, v0 + .1, H + .1, .45, S.player.color, .8);
    if (l >= 10) for (const [a, b] of [[u0 + w, v0 + d], [u0 + w, v0]]) { cyl(g, a, b, 0, H + .22, .13, 'stone', '#cbbd9d'); cone(g, a, b, H + .22, .16, .22, '#8d99a3', 'lead'); }
    if (l >= 15) for (const a of [u0 + .35, u0 + 1.25]) dome(g, a, v0 + .45, H + .02, .16, .15, '#d9e3ea', '#8d9ba6', '#4b5761');
  }, 'kervansaray');
  const n = Math.min(3, 1 + Math.floor(l / 6));
  for (let i = 0; i < n; i++) { const cu = u0 - .45, cv = v0 + .25 + i * .45; add(cu, cv, g => cam(g, cu, cv, i), 'kervansaray'); }
}
function cam(g, u, v, i) {
  if (MODE === 'shadow') { shCirc(u, v, .12, .3); return; }
  if (MODE !== 'draw') return;
  const p = P(u, v, 0), x = p.x, y = p.y, s = 4.2;
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 2, y, s * 1.3, s * .4, 0, 0, 7); g.fill();
  g.strokeStyle = '#8a6a3e'; g.lineWidth = 1.3; for (const lx of [-.7, -.35, .4, .75]) { g.beginPath(); g.moveTo(x + lx * s, y - s * .9); g.lineTo(x + lx * s, y); g.stroke(); }
  g.fillStyle = '#c79a5e'; g.beginPath(); g.ellipse(x, y - s * 1.1, s * 1.05, s * .45, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(x - s * .1, y - s * 1.5, s * .45, s * .4, 0, 0, 7); g.fill();
  g.beginPath(); g.moveTo(x + s * .8, y - s * 1.2); g.quadraticCurveTo(x + s * 1.5, y - s * 1.4, x + s * 1.45, y - s * 2.2); g.lineTo(x + s * 1.8, y - s * 2.25); g.lineTo(x + s * 1.75, y - s * 1.95); g.quadraticCurveTo(x + s * 1.3, y - s * 1.2, x + s * 1.0, y - s * .9); g.fill();
  g.fillStyle = ['#a8743e', '#8f9aa6', '#6f7f96'][i % 3]; g.fillRect(x - s * .75, y - s * 1.85, s * .6, s * .7); g.fillRect(x + s * .05, y - s * 1.85, s * .6, s * .7);
  g.fillStyle = '#b8403a'; g.fillRect(x - s * .8, y - s * 1.95, s * 1.5, s * .22);
}
function bDivan(add, l) {
  add(8.1, 8.05, g => {
    const u0 = 7.6, v0 = 7.6, w = 1.0, d = .9, z = .12;
    ibox(g, u0 - .05, v0 - .05, w + .1, d + .1, 0, z, 'stone', 'pave');
    ibox(g, u0, v0, w, .08, z, .55, 'plaster', null); ibox(g, u0, v0, .08, d, z, .55, 'plaster', null);
    for (const [a, b] of [[u0 + w - .08, v0 + .25], [u0 + w - .08, v0 + .55], [u0 + .3, v0 + d - .08], [u0 + .62, v0 + d - .08], [u0 + w - .08, v0 + d - .08]]) ibox(g, a, b, .08, .08, z, .55, 'stone', 'stone');
    ibox(g, u0 - .04, v0 - .04, w + .08, d + .08, z + .55, .08, 'turq', null, { dens: 70 });
    hipRoof(g, u0, v0, w, d, z + .63, .4, 'lead');
    flagPole(g, u0 + w / 2, v0 + d / 2, z + 1.0, .45, '#c9a23a', .8);
  }, 'divan');
}
function bKisla(add, l) {
  const H = .5 + Math.min(l, 25) * .008;
  if (l >= 6) add(5.9, 3.9, g => {
    ibox(g, 5.35, 3.5, 1.1, .8, 0, .16, 'stone', null); ibox(g, 5.35, 3.5, 1.1, .8, .16, H * .85 - .16, 'plaster', null); timber(g, 5.35, 3.5, 1.1, .8, .16, H * .85 - .16);
    for (const a of [5.55, 6.05]) hole(g, [a, 4.302], [a + .18, 4.302], .24, .4, .04);
    hipRoof(g, 5.35, 3.5, 1.1, .8, H * .85, .3, 'roof');
  }, 'kisla');
  add(4.4, 3.95, g => {
    ibox(g, 3.5, 3.5, 1.8, .9, 0, .18, 'stone', null); ibox(g, 3.5, 3.5, 1.8, .9, .18, H - .18, 'plaster', null); timber(g, 3.5, 3.5, 1.8, .9, .18, H - .18);
    for (const a of [3.7, 4.0, 4.95]) hole(g, [a, 4.402], [a + .16, 4.402], .26, .44, .04);
    hole(g, [4.35, 4.402], [4.62, 4.402], 0, .42, .1, '#3a2414', false);
    hole(g, [5.302, 4.15], [5.302, 3.95], .26, .44, .04);
    hipRoof(g, 3.5, 3.5, 1.8, .9, H, .36, 'roof');
    flagPole(g, 5.2, 3.6, H + .15, .5, S.player.color, .8);
  }, 'kisla');
  const n = Math.min(4, 1 + Math.floor(l / 5));
  add(7.1, 3.7, g => { for (let i = 0; i < n; i++) dummy(g, 6.75 + i * .28, 3.55 + (i % 2) * .2); }, 'kisla');
  if (l >= 12) add(3.2, 3.3, g => {   // ahşap gözetleme kulesi
    for (const [a, b] of [[3.0, 3.1], [3.32, 3.1], [3.0, 3.42], [3.32, 3.42]]) ibox(g, a, b, .06, .06, 0, 1.25, 'wood', 'wood', { noAO: true });
    ibox(g, 2.96, 3.06, .44, .44, 1.0, .08, 'wood', 'wood');
    ibox(g, 2.96, 3.06, .44, .04, 1.08, .16, 'wood', null, { noShadow: true }); ibox(g, 2.96, 3.06, .04, .44, 1.08, .16, 'wood', null, { noShadow: true });
    hipRoof(g, 2.96, 3.06, .44, .44, 1.3, .28, 'roof', .06);
    flagPole(g, 3.18, 3.28, 1.55, .35, S.player.color, .7);
  }, 'kisla');
  // kışla önünde nizam içinde bekleyen askerler (süs)
  const cols = Math.min(7, 3 + Math.floor(l / 4)), rows = Math.min(4, 1 + Math.floor(l / 5));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const u = 2.3 + r * .32, vv = 6.0 + c * .3;
    add(u, vv, g => soldier(g, u, vv, (r * 7 + c) % 5), 'kisla', [0, 0]);
  }
  const bu = 2.3, bv = 5.65;
  add(bu, bv, g => { soldier(g, bu, bv, 9); flagPole(g, bu + .06, bv, .2, .75, S.player.color, .9); }, 'kisla', [0, 0]);
}
function soldier(g, u, v, i) {
  if (MODE === 'shadow') return;
  if (MODE !== 'draw') return;
  const p = P(u, v, 0), x = p.x, y = p.y, col = S.player.color;
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x + 2, y, 3.6, 1.4, 0, 0, 7); g.fill();
  g.strokeStyle = '#2e2419'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x - 1, y - 3.5); g.lineTo(x - 1.1, y); g.moveTo(x + 1, y - 3.5); g.lineTo(x + 1.1, y); g.stroke();
  g.fillStyle = '#8a2f2a'; g.beginPath(); g.moveTo(x - 2.8, y - 3); g.lineTo(x - 2.2, y - 10); g.lineTo(x + 2.2, y - 10); g.lineTo(x + 2.8, y - 3); g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x + .6, y - 10, 2, 7);
  g.fillStyle = '#c9a14a'; g.fillRect(x - 2.4, y - 6.4, 4.8, .9);
  g.fillStyle = '#d9b48c'; g.beginPath(); g.arc(x, y - 11.6, 1.9, 0, 7); g.fill();
  g.fillStyle = '#b9bcc4'; g.beginPath(); g.arc(x, y - 12.2, 2.2, Math.PI, 0); g.fill();
  g.beginPath(); g.moveTo(x - .6, y - 14.2); g.lineTo(x, y - 16.2); g.lineTo(x + .6, y - 14.2); g.fill();
  g.strokeStyle = '#6e4a26'; g.lineWidth = .9; g.beginPath(); g.moveTo(x + 3.4, y - 1); g.lineTo(x + 3.4, y - 21); g.stroke();
  g.fillStyle = '#d7dbe2'; g.beginPath(); g.moveTo(x + 2.6, y - 21); g.lineTo(x + 3.4, y - 24); g.lineTo(x + 4.2, y - 21); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(x - 2.8, y - 7, 2.6, 0, 7); g.fill();
  g.strokeStyle = '#d8b04a'; g.lineWidth = .7; g.stroke();
  g.fillStyle = '#d8b04a'; g.beginPath(); g.arc(x - 2.8, y - 7, .7, 0, 7); g.fill();
}
function dummy(g, u, v) {
  if (MODE === 'shadow') { shCirc(u, v, .05, .4); return; }
  const a = P(u, v, 0), b = P(u, v, .38);
  g.strokeStyle = '#5e3b1f'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  g.lineWidth = 1.2; g.beginPath(); g.moveTo(b.x - 5, b.y + 5); g.lineTo(b.x + 5, b.y + 5); g.stroke();
  g.fillStyle = '#d6bd7e'; g.beginPath(); g.ellipse(b.x, b.y + 7, 3, 4.5, 0, 0, 7); g.fill();
  g.fillStyle = '#c9ad6a'; g.beginPath(); g.arc(b.x, b.y - 1.5, 2.6, 0, 7); g.fill();
}
function bAmbar(add, l) {
  const H = .55 + Math.min(l, 30) * .012, big = l >= 10;
  add(8.05, 4.05, g => {
    const u0 = 7.5, v0 = 3.5, w = big ? 1.25 : 1.1, d = big ? 1.2 : 1.1;
    ibox(g, u0, v0, w, d, 0, .14, 'stone', null); ibox(g, u0, v0, w, d, .14, H, 'wood', null);
    hole(g, [u0 + w * .3, v0 + d + .002], [u0 + w * .7, v0 + d + .002], .14, .14 + H * .72, 0, '#2b1b10', false);
    if (MODE === 'draw') { const a = P(u0 + w * .3, v0 + d + .003, .14), b = P(u0 + w * .7, v0 + d + .003, .14 + H * .72), c = P(u0 + w * .7, v0 + d + .003, .14), e = P(u0 + w * .3, v0 + d + .003, .14 + H * .72); g.strokeStyle = '#8a6238'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.moveTo(c.x, c.y); g.lineTo(e.x, e.y); g.stroke(); }
    hipRoof(g, u0, v0, w, d, .14 + H, .45, 'roof');
    const n = Math.min(5, 1 + Math.floor(l / 5));
    for (let i = 0; i < n; i++) ibox(g, u0 + .05 + i * .23, v0 + d + .12, .18, .18, 0, .16, 'wood', 'wood');
  }, 'ambar');
  if (l >= 20) add(9.0, 3.85, g => {   // taş tahıl silosu
    cyl(g, 9.0, 3.85, 0, .95 + Math.min(l - 20, 10) * .02, .26, 'stone', '#cbbd9d');
    const a = cone(g, 9.0, 3.85, .95 + Math.min(l - 20, 10) * .02, .31, .38, '#9b3b27', 'roof');
    if (a && MODE === 'draw') { g.fillStyle = '#d8b04a'; g.beginPath(); g.arc(a.x, a.y - 1, 1.6, 0, 7); g.fill(); }
  }, 'ambar');
}
function bTophane(add, l) {
  const H = .55 + Math.min(l, 15) * .02;
  add(4.1, 7.8, g => {
    const u0 = 3.5, v0 = 7.3, w = 1.2, d = 1.0;
    ibox(g, u0, v0, w, d, 0, H, 'fort', 'stone');
    for (let i = 0; i < 5; i++) ibox(g, u0 + .04 + i * .26, v0 + d - .1, .12, .1, H, .1, 'fort', 'fort', { noShadow: true });
    for (let i = 0; i < 4; i++) ibox(g, u0 + w - .1, v0 + .04 + i * .26, .1, .12, H, .1, 'fort', 'fort', { noShadow: true });
    ibox(g, u0 + .15, v0 + .15, .24, .24, H, .5, 'stone', 'stone');
    smokeAt(u0 + .27, v0 + .27, H + .55, .6);
    hole(g, [u0 + .45, v0 + d + .002], [u0 + .75, v0 + d + .002], 0, .42, .1, '#2b1b10', false);
    hole(g, [u0 + w + .002, v0 + .7], [u0 + w + .002, v0 + .55], .3, .45, .04);
  }, 'tophane');
  add(5.1, 8.45, g => trebuchet(g, 5.1, 8.45), 'tophane');
  if (l >= 8) for (const [u, v] of [[3.75, 8.55], [4.2, 8.6]]) add(u, v, g => cannon(g, u, v), 'tophane');
}
function cannon(g, u, v) {
  if (MODE === 'shadow') { shBox(u - .12, v - .06, .28, .12, .12); return; }
  if (MODE !== 'draw') return;
  const a = P(u - .12, v, .1), b = P(u + .18, v, .15), w1 = P(u - .04, v + .05, .05), w2 = P(u - .04, v - .05, .05);
  g.strokeStyle = '#26282d'; g.lineCap = 'round'; g.lineWidth = 4.2; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a.x, a.y - 1.3); g.lineTo(b.x, b.y - 1.3); g.stroke();
  g.fillStyle = '#1b1c20'; g.beginPath(); g.arc(b.x + 1, b.y, 1.5, 0, 7); g.fill();
  for (const w of [w2, w1]) { g.fillStyle = '#5e3b1f'; g.beginPath(); g.ellipse(w.x, w.y, 3.2, 3.4, 0, 0, 7); g.fill(); g.strokeStyle = '#3a2414'; g.lineWidth = .8; g.stroke(); g.fillStyle = '#8a6238'; g.beginPath(); g.arc(w.x, w.y, 1, 0, 7); g.fill(); }
  g.fillStyle = '#2a2a2e'; for (const [dx, dy] of [[5, 3], [7, 2], [6, 1]]) { g.beginPath(); g.arc(w1.x + dx, w1.y + dy, 1.4, 0, 7); g.fill(); }
}
function trebuchet(g, u, v) {
  if (MODE === 'shadow') { shBox(u - .2, v - .15, .4, .3, .5); return; }
  const line = (a, b, w = 1.6, c = '#5e3b1f') => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); };
  const b1 = P(u - .2, v - .12), b2 = P(u + .2, v - .12), b3 = P(u - .2, v + .12), b4 = P(u + .2, v + .12);
  line(b1, b2); line(b3, b4); line(b1, b3); line(b2, b4);
  const t1 = P(u, v - .12, .42), t2 = P(u, v + .12, .42);
  line(P(u - .15, v - .12), t1); line(P(u + .15, v - .12), t1); line(P(u - .15, v + .12), t2); line(P(u + .15, v + .12), t2);
  line(t1, t2, 1.2);
  const piv = P(u, v, .42), arm1 = P(u - .38, v, .78), arm2 = P(u + .18, v, .3);
  line(arm1, arm2, 1.8, '#6e4a26');
  g.fillStyle = '#6d6a62'; g.fillRect(arm2.x - 3, arm2.y, 6, 5);
  g.strokeStyle = '#3a2a1e'; g.lineWidth = .6; g.beginPath(); g.moveTo(arm1.x, arm1.y); g.lineTo(arm1.x - 2, arm1.y + 10); g.stroke();
  g.fillStyle = '#4a4a4a'; g.beginPath(); g.arc(piv.x, piv.y, 1.3, 0, 7); g.fill();
}
function bAhir(add, l) {
  const H = .48 + Math.min(l, 20) * .012;
  add(10.7, 4.05, g => {
    const u0 = 10.0, v0 = 3.6, w = 1.4, d = .9;
    ibox(g, u0, v0, w, d, 0, H, 'wood', null);
    for (let i = 0; i < 3; i++) hole(g, [u0 + .12 + i * .44, v0 + d + .002], [u0 + .38 + i * .44, v0 + d + .002], 0, H * .7, 0, '#2b1b10', false);
    hipRoof(g, u0, v0, w, d, H, .4, 'roof');
    cyl(g, 11.65, 4.0, 0, .16, .13, null, '#d6b25e');
  }, 'ahir');
  add(10.9, 5.6, g => fence(g, 10.0, 4.8, 1.8, 1.6), 'ahir');
  if (l >= 10) add(9.75, 4.0, g => {   // samanlıklı ek ahır
    ibox(g, 9.5, 3.7, .45, .72, 0, H * .78, 'wood', null); hipRoof(g, 9.5, 3.7, .45, .72, H * .78, .28, 'roof', .06);
    hole(g, [9.6, 4.422], [9.85, 4.422], 0, H * .55, 0, '#2b1b10', false);
    for (const [u, v] of [[9.62, 4.65], [9.85, 4.7]]) cyl(g, u, v, 0, .12, .1, null, '#d6b25e');
  }, 'ahir');
  if (MODE === 'draw') SC.anims.push({ k: 'horses', u0: 10.15 + SH.ahir[0], v0: 4.95 + SH.ahir[1], w: 1.5, d: 1.3, n: Math.min(4, Math.ceil(l / 4)) });
}
function fence(g, u0, v0, w, d) {
  if (MODE !== 'draw') return;
  const edges = [[[u0, v0], [u0 + w, v0]], [[u0, v0], [u0, v0 + d]], [[u0 + w, v0], [u0 + w, v0 + d]], [[u0, v0 + d], [u0 + w, v0 + d]]];
  for (const [a, b] of edges) {
    const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / .3));
    for (const z of [.1, .2]) { const p = P(a[0], a[1], z), q = P(b[0], b[1], z); g.strokeStyle = '#8a6238'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); }
    for (let i = 0; i <= n; i++) { const u = a[0] + (b[0] - a[0]) * i / n, v = a[1] + (b[1] - a[1]) * i / n, p = P(u, v, 0), q = P(u, v, .25); g.strokeStyle = '#5e3b1f'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); }
  }
}
function logs(g, u, v) {
  if (MODE === 'shadow') { shBox(u, v, .5, .4, .3); return; }
  const rows = [[0, .0], [0, .14], [0, .28], [.12, .07], [.12, .21], [.24, .14]];
  for (const [z, dv] of rows.sort((a, b) => a[1] - b[1] || a[0] - b[0])) {
    const a = P(u, v + dv, z + .07), b = P(u + .5, v + dv, z + .07), rr = .07 * ZH;
    const gr = g.createLinearGradient(0, a.y - rr, 0, a.y + rr); gr.addColorStop(0, '#8a6038'); gr.addColorStop(1, '#4a311b');
    g.fillStyle = gr; g.beginPath(); g.moveTo(a.x, a.y - rr); g.lineTo(b.x, b.y - rr); g.lineTo(b.x, b.y + rr); g.lineTo(a.x, a.y + rr); g.closePath(); g.fill();
    g.fillStyle = '#dcb47a'; g.beginPath(); g.ellipse(b.x, b.y, rr * .75, rr, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(120,80,40,.6)'; g.lineWidth = .5; g.beginPath(); g.ellipse(b.x, b.y, rr * .4, rr * .55, 0, 0, 7); g.stroke();
  }
}
function bKereste(add, l) {
  add(.95, 7.3, g => {
    ibox(g, .6, 7.0, .7, .6, 0, .38, 'wood', null); hipRoof(g, .6, 7.0, .7, .6, .38, .26, 'roof');
    hole(g, [.8, 7.602], [1.0, 7.602], 0, .28, 0, '#2b1b10', false);
    smokeAt(.75, 7.1, .7, .9);
  }, 'kereste');
  const n = Math.min(4, 1 + Math.floor(l / 6));
  for (let i = 0; i < n; i++) add(1.1 + (i % 2) * .6, 6.2 + Math.floor(i / 2) * .5 - (i % 2) * .1, g => logs(g, .95 + (i % 2) * .6, 6.15 + Math.floor(i / 2) * .5 - (i % 2) * .1), 'kereste');
  add(1.6, 8.0, g => { for (const [u, v] of [[1.55, 7.85], [1.9, 8.1], [1.35, 8.2]]) cyl(g, u, v, 0, .07, .08, null, '#8a6038'); }, 'kereste');
}
function bTas(add, l) {
  const n = Math.min(6, 2 + Math.floor(l / 5));
  add(1.3, 1.0, g => {
    ibox(g, .55, .3, 1.0, .8, 0, 1.25, 'rock', 'rock');
    ibox(g, 1.5, .3, .8, .55, 0, .95, 'rock', 'rock');
    ibox(g, .55, 1.05, .6, .7, 0, .8, 'rock', 'rock');
    ibox(g, 1.15, .95, .7, .5, 0, .45, 'stone', 'stone');
    ibox(g, 1.55, .85, .75, .45, 0, .6, 'rock', 'rock');
  }, 'tas');
  add(2.0, 2.1, g => { for (let i = 0; i < n; i++) ibox(g, 1.3 + (i % 3) * .28, 1.95 + Math.floor(i / 3) * .28, .22, .2, 0, .16, 'stone', 'stone'); }, 'tas');
}
function bDemir(add, l) {
  add(10.6, .8, g => {
    if (MODE === 'shadow') { shCirc(10.6, .75, .75, .55); return; }
    const c = P(10.6, .75, 0); trackPt(c.x - 70, c.y - 60); trackPt(c.x + 70, c.y + 26);
    g.save(); g.beginPath();
    g.moveTo(c.x - 72, c.y + 20);
    g.bezierCurveTo(c.x - 60, c.y - 30, c.x - 22, c.y - 62, c.x + 8, c.y - 56);
    g.bezierCurveTo(c.x + 40, c.y - 50, c.x + 64, c.y - 18, c.x + 74, c.y + 18);
    g.quadraticCurveTo(c.x, c.y + 36, c.x - 72, c.y + 20); g.closePath();
    const gr = g.createLinearGradient(c.x - 40, c.y - 60, c.x + 50, c.y + 20); gr.addColorStop(0, '#9d8a66'); gr.addColorStop(.5, '#7a6547'); gr.addColorStop(1, '#4c3d2b');
    g.fillStyle = gr; g.fill(); g.clip(); g.globalAlpha = .45; g.fillStyle = pat(g, 'rock'); g.fillRect(c.x - 80, c.y - 70, 160, 110); g.globalAlpha = 1;
    for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(90,120,55,.55)'; g.beginPath(); g.arc(c.x - 50 + (i * 37) % 100, c.y - 44 + (i * 23) % 26, 3 + (i % 3), 0, 7); g.fill(); }
    g.restore();
    const e = P(10.45, 1.62, 0);
    g.fillStyle = '#1a1410'; g.beginPath(); g.moveTo(e.x - 9, e.y); g.lineTo(e.x - 9, e.y - 12); g.quadraticCurveTo(e.x, e.y - 22, e.x + 9, e.y - 12); g.lineTo(e.x + 9, e.y); g.closePath(); g.fill();
    g.strokeStyle = '#7a5431'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(e.x - 10, e.y); g.lineTo(e.x - 10, e.y - 16); g.lineTo(e.x + 10, e.y - 16); g.lineTo(e.x + 10, e.y); g.stroke();
    g.fillStyle = '#34363d'; g.beginPath(); g.moveTo(e.x + 16, e.y + 6); g.quadraticCurveTo(e.x + 24, e.y - 4, e.x + 32, e.y + 6); g.closePath(); g.fill();
    g.fillStyle = 'rgba(125,147,173,.8)'; for (let i = 0; i < 6; i++) g.fillRect(e.x + 19 + i * 2, e.y + 1 + (i % 2), 1.6, 1.6);
    const r0 = P(10.45, 1.7, 0), r1 = P(9.75, 1.95, 0);
    g.strokeStyle = '#3b3a35'; g.lineWidth = .8;
    for (const o of [-2, 2]) { g.beginPath(); g.moveTo(r0.x + o, r0.y + o * .5); g.lineTo(r1.x + o, r1.y + o * .5); g.stroke(); }
    SC.anims.push({ k: 'cart', a: { x: r0.x, y: r0.y }, b: { x: r1.x, y: r1.y } });
    if (l >= 10) SC.anims.push({ k: 'torch', x: e.x - 11, y: e.y - 17 });
  }, 'demir');
}
function bCiftlik(add, l) {
  add(10.35, 11.8, g => {
    ibox(g, 10.0, 11.5, .7, .6, 0, .4, 'plaster', null); timber(g, 10.0, 11.5, .7, .6, 0, .4);
    hole(g, [10.15, 12.102], [10.3, 12.102], .16, .3, .03); hole(g, [10.42, 12.102], [10.58, 12.102], 0, .3, .06, '#3a2414', false);
    hipRoof(g, 10.0, 11.5, .7, .6, .4, .3, 'roof');
    smokeAt(10.15, 11.6, .75, .4);
  }, 'ciftlik');
  add(11.2, 11.75, g => { for (const [u, v] of [[10.95, 11.6], [11.25, 11.75], [11.1, 11.95]]) cyl(g, u, v, 0, .14, .12, null, '#d6b25e'); }, 'ciftlik');
  if (l >= 10) add(11.95, 12.1, g => {   // yel değirmeni
    cyl(g, 11.95, 12.1, 0, .95, .22, 'stone', '#d6cbb0');
    cone(g, 11.95, 12.1, .95, .26, .35, '#9b3b27', 'roof');
    hole(g, [11.9, 12.322], [12.05, 12.322], 0, .3, .06, '#3a2414', false);
    if (MODE === 'draw') { const p = P(11.95 + .2, 12.1 + .2, .85); SC.anims.push({ k: 'mill', x: p.x, y: p.y }); }
  }, 'ciftlik');
}
function stake(g, u, v, h) {
  if (MODE === 'shadow') { shCirc(u, v, .06, h); return; }
  cyl(g, u, v, 0, h, .065, null, '#7a5431');
  cone(g, u, v, h, .065, .1, '#9a6a3c');
}
function walls(add, l) {
  if (!l) return;
  if (l <= 5) {
    const h = .45 + l * .06;
    const edge = (u1, v1, u2, v2, gate) => {
      const n = Math.round(Math.hypot(u2 - u1, v2 - v1) / .15);
      for (let i = 0; i <= n; i++) {
        const u = u1 + (u2 - u1) * i / n, v = v1 + (v2 - v1) * i / n;
        if (gate && u > G0 - .05 && u < G1 + .05) continue;
        const hh = h * (.9 + .2 * hash2(Math.round(u * 50), Math.round(v * 50), 5));
        add(u, v, g => stake(g, u, v, hh), null);
      }
    };
    edge(WA, WA, WB, WA); edge(WA, WA, WA, WB); edge(WB, WA, WB, WB); edge(WA, WB, WB, WB, true);
    add(GC, WB + .1, g => {
      cyl(g, G0 - .08, WB, 0, h + .35, .08, null, '#6e4a26'); cyl(g, G1 + .08, WB, 0, h + .35, .08, null, '#6e4a26');
      ibox(g, G0 - .12, WB - .06, G1 - G0 + .24, .12, h + .25, .1, 'wood', 'wood', { noShadow: true });
      flagPole(g, G0 - .08, WB, h + .35, .35, S.player.color, .8);
    }, 'sur');
    return;
  }
  const hw = .72 + (l - 6) * .03, t = .3;
  const seg = (u0, v0, w, d) => add(u0 + w / 2, v0 + d / 2, g => {
    ibox(g, u0, v0, w, d, 0, hw, 'fort', 'fort');
    const along = w > d, L = along ? w : d, n = Math.max(1, Math.floor(L / .26));
    for (let i = 0; i < n; i++) {
      const o = (i + .25) * L / n;
      if (along) ibox(g, u0 + o, v0, .12, d, hw, .13, 'fort', 'fort', { noShadow: true });
      else ibox(g, u0, v0 + o, w, .12, hw, .13, 'fort', 'fort', { noShadow: true });
    }
  }, null);
  const chop = (a, b, f) => { for (let x = a; x < b - 1e-6; x += 1) f(x, Math.min(1, b - x)); };
  chop(WA, WB, (x, w) => seg(x, WA - t / 2, w, t));
  chop(WA, WB, (x, w) => seg(WA - t / 2, x, t, w));
  chop(WA, WB, (x, w) => seg(WB - t / 2, x, t, w));
  chop(WA, G0 - .3, (x, w) => seg(x, WB - t / 2, w, t));
  chop(G1 + .3, WB, (x, w) => seg(x, WB - t / 2, w, t));
  const tower = (u, v, r, h) => add(u, v + .001, g => {
    cyl(g, u, v, 0, h, r, 'fort', '#a39a88');
    cyl(g, u, v, h, .08, r + .05, 'fort', '#a39a88');
    cone(g, u, v, h + .08, r + .1, r * 2, '#9b3b27', 'roof');
    if (MODE === 'draw') { const p = P(u + r * .72, v + r * .72, h * .55); g.fillStyle = '#1e1712'; g.fillRect(p.x - 1, p.y - 4, 2, 7); }
  }, null);
  if (l >= 10) { const r = .4 + (l - 10) * .01; for (const [u, v] of [[WA, WA], [WB, WA], [WA, WB], [WB, WB]]) tower(u, v, r, hw + .55); }
  if (l >= 15) for (const [u, v] of [[6, WA], [WA, 6], [WB, 6]]) tower(u, v, .34, hw + .4);
  add(GC, WB + .12, g => {
    const hg = hw + .45;
    ibox(g, G0 - .35, WB - .22, .4, .44, 0, hg, 'fort', 'fort');
    ibox(g, G1 - .05, WB - .22, .4, .44, 0, hg, 'fort', 'fort');
    ibox(g, G0 + .05, WB - .18, G1 - G0 - .1, .36, hw - .08, hg - hw + .08, 'fort', 'fort');
    hole(g, [G0 + .05, WB + .182], [G1 - .05, WB + .182], hw - .35, hw - .08, .12, 'rgba(35,26,18,.75)', false);
    for (const u of [G0 - .3, G0 - .08, G1, G1 + .22]) ibox(g, u, WB - .22, .1, .44, hg, .12, 'fort', 'fort', { noShadow: true });
    flagPole(g, G0 - .15, WB, hg + .12, .55, S.player.color);
    flagPole(g, G1 + .15, WB, hg + .12, .55, S.player.color);
    if (MODE === 'draw') { const a = P(G0 - .02, WB + .22, hw * .7), b = P(G1 + .02, WB + .22, hw * .7); SC.anims.push({ k: 'torch', x: a.x - 3, y: a.y }, { k: 'torch', x: b.x + 3, y: b.y }); }
  }, 'sur');
}
function scaffold(g, lot, lvl) {
  if (MODE === 'shadow') return;
  const [u0, v0, w, d] = lot, h = lvl ? .95 : .5;
  if (!lvl) { ibox(g, u0, v0, w, d, 0, .1, 'stone', 'stone'); ibox(g, u0, v0, w, .12, .1, .28, 'stone', 'stone'); ibox(g, u0, v0, .12, d, .1, .28, 'stone', 'stone'); }
  const poles = [[u0, v0 + d], [u0 + w, v0 + d], [u0 + w, v0], [u0 + w / 2, v0 + d], [u0 + w, v0 + d / 2]];
  g.strokeStyle = '#b88d52'; g.lineWidth = 1.2;
  for (const [u, v] of poles) { const a = P(u, v, 0), b = P(u, v, h + .3); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
  for (const z of [h * .35, h * .7, h + .2]) {
    const a = P(u0, v0 + d, z), b = P(u0 + w, v0 + d, z), c = P(u0 + w, v0, z);
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.stroke();
  }
  g.lineWidth = .8; const x1 = P(u0, v0 + d, 0), x2 = P(u0 + w, v0 + d, h + .2); g.beginPath(); g.moveTo(x1.x, x1.y); g.lineTo(x2.x, x2.y); g.stroke();
  const top = P(u0 + w + .05, v0 + .05, h + .9), bot = P(u0 + w + .05, v0 + .05, 0);
  g.strokeStyle = '#8a6a3a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(bot.x, bot.y); g.lineTo(top.x, top.y); g.stroke();
  SC.anims.push({ k: 'crane', x: top.x, y: top.y });
}
function emptyLot(g, b) {
  const [u0, v0, w, d] = LOTS[b];
  const s = [P(u0, v0), P(u0 + w, v0), P(u0 + w, v0 + d), P(u0, v0 + d)];
  g.save(); g.beginPath(); s.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath();
  g.fillStyle = 'rgba(255,245,220,.1)'; g.fill(); g.setLineDash([4, 3]); g.strokeStyle = 'rgba(255,245,220,.7)'; g.lineWidth = 1; g.stroke(); g.setLineDash([]);
  const c = Pq(u0 + w / 2, v0 + d / 2);
  g.fillStyle = 'rgba(255,245,220,.85)'; g.fillRect(c.x - .8, c.y - 6, 1.6, 12); g.fillRect(c.x - 6, c.y - .8, 12, 1.6);
  g.restore();
}

// ---------- düz zemin ögeleri ----------
function decals(g, v) {
  // dere
  const L = [], R = [], C = [];
  for (let w = -12; w <= 22; w += .25) { const u = riverU(w); L.push(P(u - .5, w)); R.push(P(u + .5, w)); C.push(Pq(u, w)); }
  g.save(); g.beginPath(); L.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i].x, R[i].y); g.closePath();
  g.strokeStyle = 'rgba(176,150,98,.8)'; g.lineWidth = 6; g.stroke(); g.strokeStyle = 'rgba(60,80,40,.5)'; g.lineWidth = 1; g.stroke();
  const gr = g.createLinearGradient(0, 0, 300, SC.H); gr.addColorStop(0, '#3b7f8c'); gr.addColorStop(1, '#23586a'); g.fillStyle = gr; g.fill();
  g.clip(); g.strokeStyle = 'rgba(160,210,220,.25)'; g.lineWidth = 3; g.beginPath(); C.forEach((p, i) => i ? g.lineTo(p.x - 3, p.y) : g.moveTo(p.x - 3, p.y)); g.stroke();
  g.restore();
  SC.anims.push({ k: 'water', pts: C });
  // avlu ve yollar
  face(g, [[WA + .05, WA + .05, 0], [WB - .05, WA + .05, 0], [WB - .05, WB - .05, 0], [WA + .05, WB - .05, 0]], 'dirt', { shade: .98, edge: false, alpha: .92 });
  face(g, [[GC - .25, 7.25, 0], [GC + .25, 7.25, 0], [GC + .25, WB + .1, 0], [GC - .25, WB + .1, 0]], 'pave', { shade: 1, edge: false });
  for (const r of ROADS) for (let i = 0; i < r.pts.length - 1; i++) {
    const [a, b] = [r.pts[i], r.pts[i + 1]], h = r.w / 2;
    const u0 = Math.min(a[0], b[0]) - h, u1 = Math.max(a[0], b[0]) + h, v0 = Math.min(a[1], b[1]) - h, v1 = Math.max(a[1], b[1]) + h;
    face(g, [[u0, v0, 0], [u1, v0, 0], [u1, v1, 0], [u0, v1, 0]], 'dirt', { shade: 1.02, edge: false });
  }
  // tarlalar
  if (v.b.ciftlik > 0) {
    TRACK = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    const n = Math.min(12, 1 + Math.floor(v.b.ciftlik / 2.5));
    OFF = SH.ciftlik;
    for (let i = 0; i < n; i++) {
      const col = i % 3, row = Math.floor(i / 3), u0 = 9.85 + col * .93, v0 = 7.85 + row * .85;
      face(g, [[u0, v0, 0], [u0 + .85, v0, 0], [u0 + .85, v0 + .77, 0], [u0, v0 + .77, 0]], ['wheat', 'crop', 'plowed'][(i * 7 + row) % 3], { shade: 1, edgeCol: 'rgba(45,70,30,.8)', dens: 40 });
    }
    OFF = [0, 0]; mergeHit('ciftlik', TRACK); TRACK = null;
  }
  if (v.b.ahir > 0) { OFF = SH.ahir; face(g, [[10.0, 4.8, 0], [11.8, 4.8, 0], [11.8, 6.4, 0], [10.0, 6.4, 0]], 'dirt', { shade: 1, edge: false, alpha: .7 }); OFF = [0, 0]; }
  // boş arsalar
  for (const b of Object.keys(LOTS)) {
    if (v.b[b] > 0 || v.bq.some(q => q.b === b)) continue;
    TRACK = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }; OFF = SH[b]; emptyLot(g, b); OFF = [0, 0]; mergeHit(b, TRACK); TRACK = null;
  }
}
function mergeHit(b, t) {
  if (!t || t.x0 > t.x1) return;
  const h = SC.hits.find(x => x.b === b);
  if (h) { h.x0 = Math.min(h.x0, t.x0); h.x1 = Math.max(h.x1, t.x1); h.y0 = Math.min(h.y0, t.y0); h.y1 = Math.max(h.y1, t.y1); }
  else SC.hits.push({ b, x0: t.x0, x1: t.x1, y0: t.y0, y1: t.y1 });
}

// ---------- durağan katman: karo (tile) sistemi ----------
// Sahne bir kez "kurulur" (ağaçlar, binalar, gölgeler, sınır kutuları). Ekrana önce düşük çözünürlüklü
// bir taban resim çizilir; yakınlaştıkça yalnızca görünen parçalar (karolar) o yakınlığa uygun netlikte,
// kare başına birkaç tane olmak üzere çizilir. Böylece yakınlaştırma donmaz ve görüntü bulanıklaşmaz.
const TS = 512, LEVELS = [.6, .9, 1.35, 2, 3, 4.5, 6.75, 10], TILE_MAX = 32;
const TILES = new Map(), NOISE = new Map();
function noiseCanvas(seed) {
  if (NOISE.has(seed)) return NOISE.get(seed);
  const gw = 512, gh = Math.round(512 * SC.H / SC.W), c = document.createElement('canvas'); c.width = gw; c.height = gh;
  const x = c.getContext('2d'), id = x.createImageData(gw, gh), d = id.data, k = SC.W / gw;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const lx = i * k, ly = j * k, n1 = fbm(lx / 95, ly / 70, seed), n2 = fbm(lx / 45 + 50, ly / 34, seed + 7), f = (hash2(i, j, seed + 3) - .5) * 14;
    let r = 74 + 44 * n1, gg = 100 + 44 * n1, b = 44 + 22 * n1;
    if (n2 > .58) { const t = Math.min(1, (n2 - .58) * 3); r += (150 - r) * t * .6; gg += (140 - gg) * t * .5; b += (88 - b) * t * .6; }
    const o = (j * gw + i) * 4; d[o] = r + f; d[o + 1] = gg + f; d[o + 2] = b + f * .6; d[o + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  if (NOISE.size > 6) NOISE.delete(NOISE.keys().next().value);
  NOISE.set(seed, c); return c;
}
function buildStatic(v, vi) {
  if (!TEX) TEX = buildTex();
  const seed = (S.seed + v.id * 977) | 0, rnd = mul32(seed);
  const G = { v, items: [], grass: [], flowers: [], noise: noiseCanvas(seed % 1000) };
  for (let i = 0; i < 700; i++) { const px = rnd() * SC.W, py = rnd() * SC.H, l = 2 + rnd() * 3, c = rnd() < .5, dx = (rnd() - .5) * 2; G.grass.push([px, py, l, c, dx]); }
  for (let i = 0; i < 60; i++) G.flowers.push([rnd() * SC.W, rnd() * SC.H, i % 4]);
  const items = G.items, add = (u, vv, fn, b, o) => { o = o || (b && SH[b]) || [0, 0]; items.push({ key: u + vv + o[0] + o[1], fn: g2 => { OFF = o; fn(g2); OFF = [0, 0]; }, b }); };
  const tr = [];
  for (let i = 0; i < 8000 && tr.length < 240; i++) {
    const u = -20 + rnd() * 50, vv = -20 + rnd() * 54, p = Pq(u, vv);
    if (p.x < -20 || p.x > SC.W + 20 || p.y < 20 || p.y > SC.H + 40) continue;
    if (occupied(u, vv) || tr.some(t => Math.hypot(t[0] - u, t[1] - vv) < .6)) continue;
    const r = rnd(); tr.push([u, vv, r < .3 ? 'servi' : r < .42 ? 'kavak' : 'mese', .8 + rnd() * .45, (rnd() * 1e9) | 0]);
  }
  for (const [u, vv, k, sz, s2] of tr) add(u, vv, g => tree(g, u, vv, k, sz, s2), null);
  walls(add, v.b.sur);
  const BF = { konak: bKonak, kervansaray: bKervansaray, medrese: bMedrese, divan: bDivan, kisla: bKisla, ambar: bAmbar, tophane: bTophane, ahir: bAhir, kereste: bKereste, tas: bTas, demir: bDemir, ciftlik: bCiftlik };
  for (const b in BF) if (v.b[b] > 0) BF[b](add, v.b[b]);
  for (const q of v.bq) { const lot = LOTS[q.b]; if (lot && q.b !== 'sur' && q.b !== 'ciftlik') add(lot[0] + lot[2] / 2, lot[1] + lot[3] / 2 + .05, g => scaffold(g, lot, v.b[q.b]), q.b); }
  // gölgeler: bir kez, yumuşatılmış olarak
  MODE = 'shadow'; SHADOWS = [];
  const dummy = document.createElement('canvas').getContext('2d');
  for (const it of items) it.fn(dummy);
  MODE = 'draw';
  const ss = 1.25, shc = document.createElement('canvas'); shc.width = Math.round(SC.W * ss); shc.height = Math.round(SC.H * ss);
  const sg = shc.getContext('2d'); sg.setTransform(ss, 0, 0, ss, 0, 0); sg.fillStyle = '#000';
  for (const p of SHADOWS) { if (p.length < 3) continue; sg.beginPath(); p.forEach((q, i) => i ? sg.lineTo(q.x, q.y) : sg.moveTo(q.x, q.y)); sg.closePath(); sg.fill(); }
  G.shadow = document.createElement('canvas'); G.shadow.width = shc.width; G.shadow.height = shc.height;
  const bg = G.shadow.getContext('2d'); bg.filter = 'blur(2px)'; bg.drawImage(shc, 0, 0);
  items.sort((a, b) => a.key - b.key);
  // taban resim + sınır kutuları, dokunma alanları, animasyon noktaları
  const bs = Math.min(1.6, Math.max(.6, vi.cover * vi.dpr * .8));
  G.base = document.createElement('canvas'); G.base.width = Math.round(SC.W * bs); G.base.height = Math.round(SC.H * bs); G.bs = G.base.width / SC.W;
  const g = G.base.getContext('2d'); g.setTransform(G.bs, 0, 0, G.bs, 0, 0);
  SC.anims = []; SC.wins = []; SC.hits = [];
  paintStatic(g, G, null, true);
  SC.anims.push({ k: 'birds' }, { k: 'clouds' });
  return G;
}
function paintStatic(g, G, rect, measure) {
  const v = G.v;
  g.imageSmoothingEnabled = true; g.drawImage(G.noise, 0, 0, SC.W, SC.H);
  g.lineWidth = .8;
  for (const [px, py, l, c, dx] of G.grass) { if (rect && (px < rect.x0 - 4 || px > rect.x1 + 4 || py < rect.y0 - 6 || py > rect.y1 + 6)) continue; g.strokeStyle = c ? 'rgba(40,70,25,.35)' : 'rgba(170,190,110,.3)'; g.beginPath(); g.moveTo(px, py); g.lineTo(px + dx, py - l); g.stroke(); }
  g.globalAlpha = .7;
  for (const [x, y, k] of G.flowers) { g.fillStyle = ['#e8d36a', '#f2f0e8', '#c46a8a', '#8fa8e0'][k]; g.beginPath(); g.arc(x, y, .9, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  decals(g, v);
  g.save(); g.globalAlpha = .3; g.drawImage(G.shadow, 0, 0, SC.W, SC.H); g.restore();
  for (const it of G.items) {
    const bb = it.bb;
    if (rect && bb && (bb.x1 < rect.x0 || bb.x0 > rect.x1 || bb.y1 < rect.y0 || bb.y0 > rect.y1)) continue;
    if (measure) TRACK = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    it.fn(g);
    if (measure) {
      if (TRACK.x0 <= TRACK.x1) it.bb = { x0: TRACK.x0 - 8, y0: TRACK.y0 - 8, x1: TRACK.x1 + 8, y1: TRACK.y1 + 8 };
      if (it.b) mergeHit(it.b, TRACK);
      TRACK = null;
    }
  }
  if (measure && v.b.sur > 0) { const a = Pq(WA, WA, 1), b2 = Pq(WB, WA, 0), c2 = Pq(WB, WB, 0), d2 = Pq(WA, WB, 0); SC.hits.push({ b: 'sur', nobadge: true, x0: d2.x, x1: b2.x, y0: a.y, y1: c2.y }); }
  // ışık: sol üstten sıcak güneş, kenarlarda hafif karartma
  const sun = g.createRadialGradient(SC.W * .15, -40, 20, SC.W * .2, 0, SC.W * .9);
  sun.addColorStop(0, 'rgba(255,226,160,.18)'); sun.addColorStop(1, 'rgba(255,226,160,0)'); g.fillStyle = sun; g.fillRect(0, 0, SC.W, SC.H);
  const vg = g.createRadialGradient(SC.W / 2, SC.H * .55, SC.H * .45, SC.W / 2, SC.H * .55, SC.W * .62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,15,25,.32)'); g.fillStyle = vg; g.fillRect(0, 0, SC.W, SC.H);
}
function renderTile(G, L, i, j) {
  const s = LEVELS[L], ts = TS / s, c = document.createElement('canvas'); c.width = c.height = TS + 2;
  const g = c.getContext('2d'), x0 = i * ts, y0 = j * ts;
  g.setTransform(s, 0, 0, s, -x0 * s + 1, -y0 * s + 1);
  const keep = [SC.anims, SC.wins, SC.hits]; SC.anims = []; SC.wins = []; SC.hits = [];   // karo çizimi yan etki bırakmasın
  try {
    g.beginPath(); g.rect(x0 - 1 / s, y0 - 1 / s, ts + 2 / s, ts + 2 / s); g.clip();
    g.fillStyle = '#56733a'; g.fillRect(x0 - 1 / s, y0 - 1 / s, ts + 2 / s, ts + 2 / s);
    paintStatic(g, G, { x0: x0 - 2, y0: y0 - 2, x1: x0 + ts + 2, y1: y0 + ts + 2 }, false);
  } finally { SC.anims = keep[0]; SC.wins = keep[1]; SC.hits = keep[2]; }
  return c;
}
// durağan katmanı ekrana basar; eksik karoları zaman bütçesiyle üretir
function drawStatic(g, vi, pinching, panning) {
  const G = SC.G, k = vi.k, d = vi.dpr, need = k * d;
  g.setTransform(k * d, 0, 0, k * d, vi.ox * d, vi.oy * d); g.imageSmoothingEnabled = true;
  let L = LEVELS.findIndex(x => x >= need * .92); if (L < 0) L = LEVELS.length - 1;
  if (LEVELS[L] <= G.bs * 1.08) { g.drawImage(G.base, 0, 0, SC.W, SC.H); return; }
  const x0 = Math.max(0, -vi.ox / k), y0 = Math.max(0, -vi.oy / k), x1 = Math.min(SC.W, (vi.r.width - vi.ox) / k), y1 = Math.min(SC.H, (vi.r.height - vi.oy) / k);
  const cells = (LL, fn) => { const ts = TS / LEVELS[LL]; for (let j = Math.floor(y0 / ts); j <= Math.floor((y1 - .01) / ts); j++) for (let i = Math.floor(x0 / ts); i <= Math.floor((x1 - .01) / ts); i++) fn(i, j, ts); };
  const put = (LL, i, j, ts, c) => { const e = 1 / LEVELS[LL]; g.drawImage(c, i * ts - e, j * ts - e, ts + 2 * e, ts + 2 * e); };
  const missing = [];
  cells(L, (i, j) => { if (!TILES.has(L + ':' + i + ':' + j)) missing.push([i, j]); });
  if (missing.length) g.drawImage(G.base, 0, 0, SC.W, SC.H);
  if (missing.length) for (let LL = L - 1; LL >= 0 && LEVELS[LL] > G.bs * 1.08; LL--) {   // eksikler için bir alt seviyede ne varsa
    cells(LL, (i, j, ts) => { const c = TILES.get(LL + ':' + i + ':' + j); if (c) put(LL, i, j, ts, c); }); break;
  }
  cells(L, (i, j, ts) => { const key = L + ':' + i + ':' + j, c = TILES.get(key); if (c) { TILES.delete(key); TILES.set(key, c); put(L, i, j, ts, c); } });
  if (!missing.length || pinching) return;
  const ts = TS / LEVELS[L], cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  missing.sort((a, b) => Math.hypot((a[0] + .5) * ts - cx, (a[1] + .5) * ts - cy) - Math.hypot((b[0] + .5) * ts - cx, (b[1] + .5) * ts - cy));
  const t0 = performance.now(), budget = panning ? 4 : 10;
  for (const [i, j] of missing) {
    const c = renderTile(G, L, i, j); TILES.set(L + ':' + i + ':' + j, c);
    g.setTransform(k * d, 0, 0, k * d, vi.ox * d, vi.oy * d); put(L, i, j, ts, c);
    if (performance.now() - t0 > budget) break;
  }
  while (TILES.size > TILE_MAX) TILES.delete(TILES.keys().next().value);
}

// ---------- hareketli katman ----------
function walkerRoutes() { return [[[GC, 13.4], [GC, 9.4]], [[GC, 10.4], [2.45, 10.4], [2.45, 3.0]], [[GC, 10.4], [9.55, 10.4], [9.55, 2.4]], [[2.45, 7.3], [1.45, 7.3]]]; }
function routeAt(pts, f) {
  let tot = 0; const segs = [];
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push(l); tot += l; }
  let d = f * tot;
  for (let i = 0; i < segs.length; i++) { if (d <= segs[i]) { const k = d / segs[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; } d -= segs[i]; }
  return pts[pts.length - 1];
}
const DRESS = ['#7a3b2e', '#2f5d8a', '#6b5a2a', '#8a2f55', '#3d6b4a', '#a0643a'];
function loadIcon(g, x, y, kind) {
  if (kind === 'kereste') { g.fillStyle = '#7a4f2a'; g.fillRect(x - 5, y - 1.6, 10, 3.2); g.fillStyle = '#e0b57a'; g.beginPath(); g.ellipse(x + 5, y, 1.2, 1.6, 0, 0, 7); g.fill(); }
  else if (kind === 'tas') { g.fillStyle = '#b9b2a2'; g.fillRect(x - 3, y - 2.4, 6, 4.4); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x - 3, y - 2.4, 6, 1); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 2, y - 2.4, 1, 4.4); }
  else if (kind === 'demir') { g.fillStyle = '#5b4a36'; g.beginPath(); g.ellipse(x, y, 3.4, 2.8, 0, 0, 7); g.fill(); g.fillStyle = '#9fb3cc'; for (const [a, b] of [[-1.2, -.6], [1, .4], [0, 1.2]]) g.fillRect(x + a, y + b, 1, 1); }
}
const LOAD_NAME = { kereste: 'Kereste', tas: 'Taş', demir: 'Demir' };
function person(g, x, y, t, i, load, walk = true) {
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 1.5, y, 3, 1.2, 0, 0, 7); g.fill();
  const s = walk ? Math.sin(t / 140 + i) * 1.2 : 0;
  g.strokeStyle = '#3a2a1e'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(x - .8, y - 3); g.lineTo(x - .8 + s, y); g.moveTo(x + .8, y - 3); g.lineTo(x + .8 - s, y); g.stroke();
  g.fillStyle = DRESS[i % DRESS.length]; g.beginPath(); g.moveTo(x - 2.4, y - 2.5); g.lineTo(x - 1.8, y - 8.5); g.lineTo(x + 1.8, y - 8.5); g.lineTo(x + 2.4, y - 2.5); g.closePath(); g.fill();
  g.fillStyle = '#d9b48c'; g.beginPath(); g.arc(x, y - 10, 1.8, 0, 7); g.fill();
  g.fillStyle = i % 3 === 0 ? '#f1ece0' : '#5a3a22'; g.beginPath(); g.ellipse(x, y - 11.3, 2.1, 1.2, 0, 0, 7); g.fill();
  if (load) loadIcon(g, x + 1, y - 13.5, load);
}
function horse(g, x, y, dir, t, i) {
  g.save(); g.translate(x, y); g.scale(dir, 1);
  g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(1, 0, 7, 2, 0, 0, 7); g.fill();
  const col = ['#6b3f22', '#2b211b', '#9a6a3c', '#d9ccb4'][i % 4], leg = Math.sin(t / 180 + i) * 1.2;
  g.strokeStyle = col; g.lineWidth = 1.4;
  for (const [lx, o] of [[-4, leg], [-2, -leg], [3, leg], [5, -leg]]) { g.beginPath(); g.moveTo(lx, -5); g.lineTo(lx + o * .5, 0); g.stroke(); }
  g.fillStyle = col; g.beginPath(); g.ellipse(0, -6.5, 6.2, 3, 0, 0, 7); g.fill();
  g.beginPath(); g.moveTo(4, -8); g.lineTo(7, -12.5); g.lineTo(9.5, -11.5); g.lineTo(6.5, -6.5); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(9, -11.3, 2.2, 1.2, .5, 0, 7); g.fill();
  g.strokeStyle = 'rgba(20,15,10,.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-6, -7); g.quadraticCurveTo(-8.5, -5, -8, -2); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.ellipse(-1, -8, 4, 1.2, 0, 0, 7); g.fill();
  g.restore();
}
function drawAnims(g, t, night, v) {
  for (const a of SC.anims) {
    if (a.k === 'smoke') {
      for (let i = 0; i < 5; i++) { const p = (t / 3400 + i / 5 + a.ph) % 1; g.fillStyle = `rgba(228,224,216,${.34 * (1 - p)})`; g.beginPath(); g.arc(a.x + Math.sin(p * 5 + a.ph * 9) * 3 + p * 12, a.y - p * 30, 2 + p * 6, 0, 7); g.fill(); }
    } else if (a.k === 'flag') {
      const w = 13 * a.s, h = 8 * a.s;
      g.beginPath(); g.moveTo(a.x, a.y);
      for (let i = 1; i <= 6; i++) g.lineTo(a.x + w * i / 6, a.y + Math.sin(t / 240 + i * .9 + a.x) * 1.5 * i / 6);
      for (let i = 6; i >= 0; i--) g.lineTo(a.x + w * i / 6, a.y + h - i * .4 * a.s + Math.sin(t / 240 + i * .9 + a.x) * 1.5 * i / 6);
      g.closePath(); g.fillStyle = a.col; g.fill(); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill('evenodd');
      const mx = a.x + w * .42, my = a.y + h * .5 + Math.sin(t / 240 + 3 + a.x) * .6, rr = 2.3 * a.s;
      g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.arc(mx, my, rr, 0, 7); g.fill();
      g.fillStyle = a.col; g.beginPath(); g.arc(mx + rr * .38, my - rr * .05, rr * .82, 0, 7); g.fill();
    } else if (a.k === 'water') {
      const pts = a.pts;
      for (let i = 0; i < 22; i++) {
        const f = ((t / 16000 + i / 22) % 1) * (pts.length - 1), j = Math.floor(f), q = f - j, p0 = pts[j], p1 = pts[Math.min(j + 1, pts.length - 1)];
        const x = p0.x + (p1.x - p0.x) * q + ((i * 37) % 11 - 5) * 1.3, y = p0.y + (p1.y - p0.y) * q + ((i * 53) % 7 - 3);
        g.strokeStyle = `rgba(225,245,250,${.22 + .2 * Math.sin(t / 380 + i)})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 3, y + .8); g.stroke();
      }
    } else if (a.k === 'crane') {
      const ang = Math.sin(t / 1800) * .9, jx = a.x - Math.cos(ang) * 22, jy = a.y + Math.sin(ang) * 5;
      g.strokeStyle = '#8a6a3a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(jx, jy); g.stroke();
      const ly = jy + 14 + Math.sin(t / 700) * 3; g.lineWidth = .6; g.beginPath(); g.moveTo(jx, jy); g.lineTo(jx, ly); g.stroke();
      g.fillStyle = '#b3a88f'; g.fillRect(jx - 3, ly, 6, 4);
    } else if (a.k === 'horses') {
      for (let i = 0; i < a.n; i++) {
        const ph = i * 2.3, fu = .5 + .42 * Math.sin(t / 6200 + ph), fv = .5 + .42 * Math.sin(t / 8300 + ph * 1.7);
        const dir = Math.cos(t / 6200 + ph) - Math.cos(t / 8300 + ph * 1.7) * .4 >= 0 ? 1 : -1;
        const p = Pq(a.u0 + a.w * fu, a.v0 + a.d * fv); horse(g, p.x, p.y, dir, t, i);
      }
    } else if (a.k === 'cart') {
      const f = (Math.sin(t / 3200) + 1) / 2, x = a.a.x + (a.b.x - a.a.x) * f, y = a.a.y + (a.b.y - a.a.y) * f;
      g.fillStyle = '#5a4030'; g.fillRect(x - 5, y - 6, 10, 5); g.fillStyle = '#6f7f96'; g.beginPath(); g.ellipse(x, y - 6, 4.5, 2, 0, 0, 7); g.fill();
      g.fillStyle = '#222'; g.beginPath(); g.arc(x - 3, y, 1.6, 0, 7); g.arc(x + 3, y, 1.6, 0, 7); g.fill();
    } else if (a.k === 'mill') {
      const r = 20, ang = t / 1600;
      g.save(); g.translate(a.x, a.y); g.scale(1, .82);
      for (let i = 0; i < 4; i++) {
        const q = ang + i * Math.PI / 2, cx = Math.cos(q), sy = Math.sin(q);
        g.strokeStyle = '#5e3b1f'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(0, 0); g.lineTo(cx * r, sy * r); g.stroke();
        g.fillStyle = 'rgba(238,230,210,.9)'; g.beginPath(); g.moveTo(cx * 4, sy * 4); g.lineTo(cx * r, sy * r);
        g.lineTo(cx * r - sy * 5, sy * r + cx * 5); g.lineTo(cx * 4 - sy * 4, sy * 4 + cx * 4); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(90,60,30,.5)'; g.lineWidth = .5; g.stroke();
      }
      g.fillStyle = '#3a2a1e'; g.beginPath(); g.arc(0, 0, 2, 0, 7); g.fill(); g.restore();
    } else if (a.k === 'birds') {
      for (let i = 0; i < 3; i++) {
        const x = ((t / 45 + i * 60) % (SC.W + 80)) - 40, y = 60 + i * 9 + Math.sin(t / 900 + i) * 6, f = Math.sin(t / 110 + i * 2) * 3;
        g.strokeStyle = 'rgba(30,30,35,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 4, y - f); g.quadraticCurveTo(x - 2, y - 1, x, y); g.quadraticCurveTo(x + 2, y - 1, x + 4, y - f); g.stroke();
      }
    } else if (a.k === 'clouds' && !night) {
      for (let i = 0; i < 3; i++) {
        const x = ((t / 90 + i * 300) % (SC.W + 400)) - 200, y = 140 + i * 260;
        const gr = g.createRadialGradient(x, y, 10, x, y, 150); gr.addColorStop(0, 'rgba(10,20,30,.10)'); gr.addColorStop(1, 'rgba(10,20,30,0)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 150, 70, 0, 0, 7); g.fill();
      }
    }
  }
  drawWorkers(g, t, v);
}
const routeLen = pts => { let L = 0; for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); return L; };
function workerRoutes(v) {
  const inside = v.b.ambar > 0 ? [[GC, 12.6], [GC, 10.8], [8.9, 10.8], [8.9, 3.3], [9.95, 3.3]] : [[GC, 12.6], [GC, 8.2]];
  return {
    kereste: [[-1.1, 9.9], [.45, 9.9], [.45, 12.6], ...inside],
    tas: [[.45, -.9], [.45, 12.6], ...inside],
    demir: [[12.6, -.1], [11.9, -.1], [11.9, 12.6], ...inside],
  };
}
function drawWorkers(g, t, v) {
  const R = workerRoutes(v), sec = t / 1000, speed = .55, zoomed = SC.cam && SC.cam.z >= 1.9;
  let idx = 0;
  for (const res of ['kereste', 'tas', 'demir']) {
    const l = v.b[res]; if (!l) continue;
    const route = R[res], L = routeLen(route), n = Math.min(3, 1 + Math.floor(l / 7));
    for (let k = 0; k < n; k++) {
      const cyc = (sec * speed + k * (2 * L / n) + idx * 3.1) % (2 * L), going = cyc < L;
      const [u, vv] = routeAt(route, going ? cyc / L : 1 - (cyc - L) / L), p = Pq(u, vv);
      person(g, p.x, p.y, t, 3 + idx + k, going ? res : null);
      if (going && zoomed) { g.font = '600 4.5px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,250,235,.95)'; g.fillText(LOAD_NAME[res], p.x, p.y - 17.5); }
      const since = cyc - L;
      if (since >= 0 && since < 1.6) {
        const end = route[route.length - 1], e = Pq(end[0], end[1], .4), a = 1 - since / 1.6;
        g.globalAlpha = a; loadIcon(g, e.x - 6, e.y - since * 9, res);
        g.font = '800 7px system-ui, sans-serif'; g.textAlign = 'left'; g.fillStyle = '#f4cf6a'; g.fillText('+', e.x - 1, e.y - since * 9 + 2.5); g.globalAlpha = 1;
      }
    }
    idx++;
  }
  // kapı nöbetçileri
  if (v.b.sur > 0) for (const [du, i] of [[-.55, 1], [.55, 2]]) {
    const p = Pq(GC + du, WB + .45); person(g, p.x, p.y, t, i, null, false);
    g.strokeStyle = '#5e3b1f'; g.lineWidth = .9; g.beginPath(); g.moveTo(p.x + 3, p.y); g.lineTo(p.x + 3, p.y - 17); g.stroke();
    g.fillStyle = '#c9ccd2'; g.beginPath(); g.moveTo(p.x + 2, p.y - 17); g.lineTo(p.x + 3, p.y - 20); g.lineTo(p.x + 4, p.y - 17); g.fill();
  }
  // yolda gelip giden birkaç köylü
  for (let i = 0; i < 2; i++) {
    const r = [[GC, 17.5], [GC, 12.9]], per = 30000 + i * 7000, f0 = ((t + i * 11000) % per) / per, f = f0 < .5 ? f0 * 2 : 2 - f0 * 2;
    const [u, vv] = routeAt(r, f), p = Pq(u + (i ? .15 : -.15), vv); person(g, p.x, p.y, t, i);
  }
}
function drawNight(g, t) {
  g.fillStyle = 'rgba(10,20,52,.55)'; g.fillRect(0, 0, SC.W, SC.H);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const w of SC.wins) {
    g.beginPath(); g.moveTo(w.s3.x, w.s3.y); g.lineTo(w.s0.x, w.s0.y); if (w.arch) g.quadraticCurveTo(w.c.x, w.c.y, w.s1.x, w.s1.y); else g.lineTo(w.s1.x, w.s1.y); g.lineTo(w.s2.x, w.s2.y); g.closePath();
    g.fillStyle = 'rgba(255,190,90,.85)'; g.fill();
    const cx = (w.s0.x + w.s2.x) / 2, cy = (w.s0.y + w.s2.y) / 2, gr = g.createRadialGradient(cx, cy, 1, cx, cy, 11);
    gr.addColorStop(0, 'rgba(255,170,70,.35)'); gr.addColorStop(1, 'rgba(255,170,70,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 11, 0, 7); g.fill();
  }
  for (const a of SC.anims) if (a.k === 'torch') {
    const fl = 1 + Math.sin(t / 90 + a.x) * .12 + Math.sin(t / 37 + a.y) * .06, gr = g.createRadialGradient(a.x, a.y, 1, a.x, a.y, 22 * fl);
    gr.addColorStop(0, 'rgba(255,200,110,.75)'); gr.addColorStop(.3, 'rgba(255,150,60,.3)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(a.x, a.y, 22 * fl, 0, 7); g.fill();
  }
  g.restore();
}
// ---------- bina gövdeleri: etiket ve dokunma için ----------
const BODY_Z = { konak: 1.9, kisla: 1.0, ambar: 1.25, medrese: 1.15, divan: 1.2, tophane: 1.15, kervansaray: .95, ahir: .95, kereste: .8, tas: 1.4, demir: 1.7, ciftlik: .5, sur: 1.6 };
function bodyRects(v) {
  const out = [];
  for (const b of Object.keys(LOTS)) {
    let [u0, v0, w, d] = LOTS[b], o = SH[b] || [0, 0];
    if (b === 'sur') { if (!v.b.sur && !v.bq.some(q => q.b === 'sur')) continue; u0 = G0 - .45; v0 = WB - .35; w = G1 - G0 + .9; d = .7; o = [0, 0]; }
    if (b === 'demir') { u0 = 9.6; v0 = .2; w = 1.8; d = 1.6; }
    const built = v.b[b] > 0 || v.bq.some(q => q.b === b), z = built ? BODY_Z[b] : .15;
    const pts = [];
    for (const [uu, vv] of [[u0, v0], [u0 + w, v0], [u0 + w, v0 + d], [u0, v0 + d]]) for (const zz of [0, z]) { OFF = [0, 0]; pts.push(Pq(uu + o[0], vv + o[1], zz)); }
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y), top = Pq(u0 + w / 2 + o[0], v0 + d / 2 + o[1], z);
    out.push({ b, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), lx: top.x, ly: top.y, built });
  }
  return out;
}

// ---------- kamera ----------
SC.cam = SC.cam || { z: 1.55, x: 330, y: 525 }; SC.idle = 0; SC.ptrs = new Map(); SC.sel = null;
function viewInfo() {
  const cv = $('scene'); if (!cv) return null;
  const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const cover = Math.max(r.width / SC.W, r.height / SC.H), k = cover * SC.cam.z;
  return { cv, r, dpr, cover, k, ox: r.width / 2 - SC.cam.x * k, oy: r.height / 2 - SC.cam.y * k };
}
function clampCam() {
  const vi = viewInfo(); if (!vi) return;
  const zmin = 1;
  SC.cam.z = Math.max(zmin, Math.min(4.5, SC.cam.z));
  const k = vi.cover * SC.cam.z, hw = vi.r.width / k / 2, hh = vi.r.height / k / 2;
  SC.cam.x = hw * 2 >= SC.W ? SC.W / 2 : Math.max(hw, Math.min(SC.W - hw, SC.cam.x));
  SC.cam.y = hh * 2 >= SC.H ? SC.H / 2 : Math.max(hh, Math.min(SC.H - hh, SC.cam.y));
}
function toLogical(cx, cy) { const vi = viewInfo(); return { x: (cx - vi.r.left - vi.ox) / vi.k, y: (cy - vi.r.top - vi.oy) / vi.k }; }
function zoomAt(f, cx, cy) {
  const vi = viewInfo(); if (!vi) return;
  const before = toLogical(cx, cy);
  SC.cam.z *= f; clampCam();
  const after = toLogical(cx, cy);
  SC.cam.x += before.x - after.x; SC.cam.y += before.y - after.y; clampCam(); SC.idle = SC.zoomT = performance.now();
}

// ---------- etiketler ----------
function pill(g, x, y, name, lvl, state) {
  g.font = '700 13.5px system-ui, sans-serif';
  const tw = g.measureText(name).width, lv = lvl ? String(lvl) : '+', lw = Math.max(20, g.measureText(lv).width + 11), w = tw + lw + 18, h = 25;
  const x0 = x - w / 2, y0 = y - h;
  g.fillStyle = state === 'empty' ? 'rgba(15,24,41,.55)' : 'rgba(15,24,41,.86)';
  g.beginPath(); g.roundRect ? g.roundRect(x0, y0, w, h, 12) : g.rect(x0, y0, w, h); g.fill();
  g.strokeStyle = state === 'build' ? '#3cb4a6' : 'rgba(220,170,69,.45)'; g.lineWidth = 1.2; g.stroke();
  if (state === 'build') { g.strokeStyle = '#3cb4a6'; g.lineWidth = 1.5; g.stroke(); }
  g.fillStyle = state === 'empty' ? 'rgba(239,230,210,.75)' : '#efe6d2'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(name, x0 + 10, y0 + h / 2 + .5);
  g.fillStyle = state === 'build' ? '#3cb4a6' : state === 'empty' ? 'rgba(220,170,69,.6)' : '#dcaa45';
  g.beginPath(); g.roundRect ? g.roundRect(x0 + w - lw - 4, y0 + 4, lw, h - 8, 8) : g.rect(x0 + w - lw - 4, y0 + 4, lw, h - 8); g.fill();
  g.fillStyle = '#1a1206'; g.textAlign = 'center'; g.font = '800 12px system-ui, sans-serif'; g.fillText(lv, x0 + w - 4 - lw / 2, y0 + h / 2 + .5);
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}
const EYE_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 3.9M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 004.4-1.1M9.9 9.9a3 3 0 004.2 4.2"/></svg>';
try { SC.showLabels = localStorage.getItem('ub-labels') !== '0'; } catch (e) { SC.showLabels = true; }
function setLabelBtn() { const b = $('lblT'); if (!b) return; b.innerHTML = SC.showLabels ? EYE_ON : EYE_OFF; b.setAttribute('aria-pressed', SC.showLabels ? 'true' : 'false'); b.setAttribute('aria-label', SC.showLabels ? 'Bina isimlerini gizle' : 'Bina isimlerini göster'); b.classList.toggle('off', !SC.showLabels); }
function drawLabels(g, v, vi) {
  if (!SC.showLabels) {
    SC.labelHits = [];
    if (!SC.sel) return;
  }
  const bq = new Set(v.bq.map(q => q.b)), placed = [], W = vi.r.width, H = vi.r.height; SC.labelHits = [];
  for (const sel of ['.vtitle', '#hProt > *', '.zoomctl', '.hud-bot > *']) for (const el of document.querySelectorAll(sel)) { const r = el.getBoundingClientRect(); if (r.width) placed.push({ x0: r.left - vi.r.left, x1: r.right - vi.r.left, y0: r.top - vi.r.top, y1: r.bottom - vi.r.top }); }
  const pri = b => (b === SC.sel ? 0 : bq.has(b) ? 1 : v.b[b] > 0 ? 2 : 3);
  const items = (SC.body || []).map(h => ({ h, sx: vi.ox + h.lx * vi.k, sy: vi.oy + h.ly * vi.k - 8, sb: vi.oy + h.y1 * vi.k }))
    .filter(it => it.sx > -20 && it.sx < W + 20 && it.sb > 10 && it.sy < H)
    .sort((a, b) => pri(a.h.b) - pri(b.h.b) || a.sy - b.sy);
  g.save(); g.font = '700 13.5px system-ui, sans-serif';
  for (const it of items) {
    const b = it.h.b, l = v.b[b], st = bq.has(b) ? 'build' : l > 0 ? 'ok' : 'empty';
    if (!SC.showLabels && b !== SC.sel) continue;
    if (st === 'empty' && SC.cam.z < .8 && b !== SC.sel) continue;
    const w = g.measureText(C.B[b].n).width + 50;
    let ok = null;
    for (const [dx, dy] of [[0, 0], [0, -27], [w * .55, 0], [-w * .55, 0], [0, 27]]) {
      const cx = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, it.sx + dx)), y = Math.max(22, it.sy + dy);
      const box = { x0: cx - w / 2, x1: cx + w / 2, y0: y - 25, y1: y };
      if (!placed.some(p => box.x0 < p.x1 + 2 && box.x1 > p.x0 - 2 && box.y0 < p.y1 + 2 && box.y1 > p.y0 - 2)) { ok = { cx, y, box }; break; }
    }
    if (!ok && pri(b) > 1) continue;
    if (!ok) ok = { cx: it.sx, y: it.sy };
    const pb = pill(g, ok.cx, ok.y, C.B[b].n, l, st); placed.push(pb); SC.labelHits.push(Object.assign({ b }, pb));
  }
  g.restore();
}

function drawScene(t) {
  const vi = viewInfo(); if (!vi || !S) return;
  const v = cur(), cv = vi.cv, g = cv.getContext('2d');
  const W = Math.round(vi.r.width * vi.dpr), H = Math.round(vi.r.height * vi.dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; clampCam(); }
  const hr = SC.hour != null ? SC.hour : new Date().getHours(), night = hr >= 20 || hr < 6;
  const sig = v.id + '|' + S.seed + '|' + JSON.stringify(v.b) + '|' + v.bq.map(q => q.b).join() + '|' + S.player.color;
  if (!SC.G || sig !== SC.sig) { SC.sig = sig; TILES.clear(); SC.G = buildStatic(v, vi); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0c1422'; g.fillRect(0, 0, W, H);
  const d = vi.dpr, pinching = SC.ptrs.size >= 2 || performance.now() - (SC.zoomT || 0) < 140, panning = SC.ptrs.size === 1 && SC.moved;
  drawStatic(g, vi, pinching, panning);
  g.setTransform(vi.k * d, 0, 0, vi.k * d, vi.ox * d, vi.oy * d);
  if (SC.bodySig !== sig) { SC.bodySig = sig; SC.body = bodyRects(v); }
  drawAnims(g, t, night, v);
  if (night) drawNight(g, t);
  if (SC.sel) {
    const h = (SC.body || []).find(x => x.b === SC.sel);
    if (h) { g.strokeStyle = 'rgba(220,170,69,' + (.6 + .3 * Math.sin(t / 250)) + ')'; g.lineWidth = 2 / vi.k; g.setLineDash([6 / vi.k, 4 / vi.k]); g.strokeRect(h.x0 - 3, h.y0 - 3, h.x1 - h.x0 + 6, h.y1 - h.y0 + 6); g.setLineDash([]); }
  }
  g.setTransform(d, 0, 0, d, 0, 0);
  drawLabels(g, v, vi);
  placePop(vi);
}
function placePop(vi) {
  const pop = $('pop'); if (!pop) return;
  if (!SC.sel) { if (!pop.hidden) pop.hidden = true; return; }
  const h = (SC.body || []).find(x => x.b === SC.sel); if (!h) return;
  if (pop.hidden) pop.hidden = false;
  const pw = pop.offsetWidth, ph = pop.offsetHeight, W = vi.r.width, Hh = vi.r.height;
  const cx = vi.ox + (h.x0 + h.x1) / 2 * vi.k, top = vi.oy + h.y0 * vi.k, bot = vi.oy + h.y1 * vi.k;
  let x = Math.max(8, Math.min(W - pw - 8, cx - pw / 2)), y = top - ph - 30;
  if (y < 56) y = Math.min(Hh - ph - 8, bot + 12);
  if (y < 56) y = 56;
  const tf = `translate(${Math.round(x)}px,${Math.round(y)}px)`; if (pop.style.transform !== tf) pop.style.transform = tf;
}
function sceneLoop(ts) {
  SC.raf = 0;
  if (tab !== 'koy' || !$('scene')) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (ts - SC.last > (reduce ? 500 : 33)) { SC.last = ts; drawScene(reduce ? 0 : ts); }
  SC.raf = requestAnimationFrame(sceneLoop);
}
function sceneTap(cx, cy) {
  const vi = viewInfo(), sx = cx - vi.r.left, sy = cy - vi.r.top;
  const lab = (SC.labelHits || []).find(h => sx >= h.x0 - 8 && sx <= h.x1 + 8 && sy >= h.y0 - 8 && sy <= h.y1 + 8);
  if (lab) { selectBuilding(lab.b); return; }
  const p = toLogical(cx, cy), pad = 8 / vi.k, B = SC.body || [];
  const cand = B.filter(h => p.x >= h.x0 - pad && p.x <= h.x1 + pad && p.y >= h.y0 - pad && p.y <= h.y1 + pad);
  if (cand.length) {
    const sc = h => (h.x1 - h.x0) * (h.y1 - h.y0) * (h.built ? 1 : 1.6) + Math.hypot(p.x - (h.x0 + h.x1) / 2, p.y - (h.y0 + h.y1) / 2) * 20;
    selectBuilding(cand.sort((a, b) => sc(a) - sc(b))[0].b); return;
  }
  // kışla önündeki askerler de kışlayı açar
  const kh = SC.hits.find(h => h.b === 'kisla');
  if (kh && p.x >= kh.x0 && p.x <= kh.x1 && p.y >= kh.y0 && p.y <= kh.y1) { selectBuilding('kisla'); return; }
  let best = null, bd = 48 / vi.k;
  for (const h of B) { const dx = Math.max(h.x0 - p.x, 0, p.x - h.x1), dy = Math.max(h.y0 - p.y, 0, p.y - h.y1), d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = h; } }
  selectBuilding(best ? best.b : null);
}
function sceneStart() {
  const cv = $('scene'); clampCam();
  cv.addEventListener('pointerdown', e => {
    if (e.isPrimary) SC.ptrs.clear();
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    SC.downT = performance.now();
    SC.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    if (SC.ptrs.size === 2) { const [a, b] = [...SC.ptrs.values()]; SC.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: SC.cam.z }; }
    SC.moved = false;
  });
  cv.addEventListener('pointermove', e => {
    const p = SC.ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 12) SC.moved = true;
    if (SC.ptrs.size >= 2 && SC.pinch) {
      const [a, b] = [...SC.ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(SC.pinch.z * d / SC.pinch.d / SC.cam.z, (a.x + b.x) / 2, (a.y + b.y) / 2);
    } else if (SC.moved) {
      const vi = viewInfo(); SC.cam.x -= dx / vi.k; SC.cam.y -= dy / vi.k; clampCam(); SC.idle = performance.now();
    }
  });
  const up = e => {
    const had = SC.ptrs.has(e.pointerId); SC.ptrs.delete(e.pointerId);
    if (SC.ptrs.size < 2) SC.pinch = null;
    if (had && !SC.moved && SC.ptrs.size === 0 && e.type === 'pointerup') sceneTap(e.clientX, e.clientY);
    SC.idle = performance.now();
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', e => { SC.ptrs.delete(e.pointerId); if (SC.ptrs.size < 2) SC.pinch = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * .0015), e.clientX, e.clientY); }, { passive: false });
  const zb = (f) => () => { const r = cv.getBoundingClientRect(); zoomAt(f, r.left + r.width / 2, r.top + r.height / 2); };
  setLabelBtn();
  $('lblT').onclick = () => { SC.showLabels = !SC.showLabels; try { localStorage.setItem('ub-labels', SC.showLabels ? '1' : '0'); } catch (e) {} setLabelBtn(); toast(SC.showLabels ? 'Bina isimleri açık' : 'Bina isimleri gizlendi', 'info'); };
  $('zIn').onclick = zb(1.35); $('zOut').onclick = zb(1 / 1.35);
  $('zFit').onclick = () => { const f = SC.cam.z > 1.05; SC.cam.z = f ? 1 : 1.55; SC.cam.x = 330; SC.cam.y = f ? 530 : 525; clampCam(); SC.idle = performance.now(); };
  drawScene(performance.now());
  if (!SC.raf) SC.raf = requestAnimationFrame(sceneLoop);
}
function sceneSize() {}
