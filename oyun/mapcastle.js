// ---------- HARİTA KALELERİ: puana göre 6 kademe ----------
const TIERS = [
  { n: 'Oba',          min: 0 },
  { n: 'Köy',          min: 350 },
  { n: 'Palanka',      min: 1200 },
  { n: 'Hisar',        min: 3000 },
  { n: 'Kale',         min: 7000 },
  { n: 'Başkent Kalesi', min: 14000 },
];
function tierOf(pts) { let k = 0; for (let i = 0; i < TIERS.length; i++) if (pts >= TIERS[i].min) k = i; return k; }
const SPRITES = new Map();
function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = x => Math.max(0, Math.min(255, Math.round(f >= 0 ? x + (255 - x) * f : x * (1 + f))));
  return '#' + ((1 << 24) + (m(r) << 16) + (m(g) << 8) + m(b)).toString(16).slice(1);
}
function castleSprite(tier, col, barb, T) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), key = tier + '|' + col + '|' + barb + '|' + T + '|' + dpr;
  if (SPRITES.has(key)) return SPRITES.get(key);
  const W = T * 2.3, H = T * 2.5, c = document.createElement('canvas');
  c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  drawCastle(g, W / 2, H * .66, T / 3.4, tier, col, barb);
  const sp = { c, W, H, ax: W / 2, ay: H * .66 };
  SPRITES.set(key, sp); return sp;
}
function drawCastle(g, cx, cy, a, tier, col, barb) {
  const P = (u, v, z = 0) => [cx + (u - v) * a, cy + (u + v) * a / 2 - z * a];
  const poly = (pts, fill, stroke) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = fill; g.fill(); if (stroke !== false) { g.strokeStyle = 'rgba(25,18,10,.35)'; g.lineWidth = .6; g.stroke(); } };
  const pal = barb
    ? { stone: '#8f8a80', wood: '#6e5a44', roof: '#5d544a', plaster: '#a39d90', dome: '#6f7a78' }
    : { stone: '#cdbf9f', wood: '#8a5a32', roof: '#b04a31', plaster: '#e6dbc2', dome: '#2fa596' };
  const box = (u0, v0, w, d, z0, h, c0, top) => {
    const z1 = z0 + h;
    poly([P(u0, v0 + d, z1), P(u0 + w, v0 + d, z1), P(u0 + w, v0 + d, z0), P(u0, v0 + d, z0)], shadeHex(c0, .02));
    poly([P(u0 + w, v0 + d, z1), P(u0 + w, v0, z1), P(u0 + w, v0, z0), P(u0 + w, v0 + d, z0)], shadeHex(c0, -.3));
    if (top !== null) poly([P(u0, v0, z1), P(u0 + w, v0, z1), P(u0 + w, v0 + d, z1), P(u0, v0 + d, z1)], top || shadeHex(c0, .18));
  };
  const hip = (u0, v0, w, d, z, rh, c0) => {
    const o = .06; u0 -= o; v0 -= o; w += 2 * o; d += 2 * o;
    const A = P(u0, v0, z), B = P(u0 + w, v0, z), Cc = P(u0 + w, v0 + d, z), D = P(u0, v0 + d, z);
    const r1 = P(u0 + Math.min(w, d) / 2, v0 + Math.min(w, d) / 2, z + rh), r2 = P(u0 + w - Math.min(w, d) / 2, v0 + d - Math.min(w, d) / 2, z + rh);
    if (barb) { poly([D, Cc, B, P(u0 + w * .6, v0 + d * .5, z + rh * .5)], shadeHex(c0, -.15)); return; }
    poly([D, Cc, r2, r1], shadeHex(c0, .08)); poly([Cc, B, r2], shadeHex(c0, -.28));
    if (w > d) poly([D, A, r1], shadeHex(c0, .15)); else poly([B, A, r1, r2], shadeHex(c0, -.1));
  };
  const cyl = (u, v, z0, h, r, c0, roof, rh) => {
    const b = P(u, v, z0), t = P(u, v, z0 + h), rx = r * a * 1.414, ry = rx / 2;
    const gr = g.createLinearGradient(b[0] - rx, 0, b[0] + rx, 0); gr.addColorStop(0, shadeHex(c0, .1)); gr.addColorStop(.55, shadeHex(c0, -.05)); gr.addColorStop(1, shadeHex(c0, -.4));
    g.beginPath(); g.moveTo(t[0] - rx, t[1]); g.lineTo(b[0] - rx, b[1]); g.ellipse(b[0], b[1], rx, ry, 0, Math.PI, 0, true); g.lineTo(t[0] + rx, t[1]); g.closePath();
    g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(25,18,10,.35)'; g.lineWidth = .6; g.stroke();
    g.beginPath(); g.ellipse(t[0], t[1], rx, ry, 0, 0, 7); g.fillStyle = shadeHex(c0, .15); g.fill(); g.stroke();
    if (roof && !barb) {
      const tip = [t[0], t[1] - rh * a], rr = rx * 1.2;
      const gr2 = g.createLinearGradient(t[0] - rr, 0, t[0] + rr, 0); gr2.addColorStop(0, shadeHex(roof, .15)); gr2.addColorStop(1, shadeHex(roof, -.35));
      g.beginPath(); g.moveTo(t[0] - rr, t[1]); g.lineTo(tip[0], tip[1]); g.lineTo(t[0] + rr, t[1]); g.ellipse(t[0], t[1], rr, rr / 2, 0, 0, Math.PI); g.closePath(); g.fillStyle = gr2; g.fill(); g.stroke();
      return tip;
    }
    if (barb) { g.fillStyle = shadeHex(c0, -.2); for (let i = -1; i <= 1; i += 2) g.fillRect(t[0] + i * rx * .55 - 1.2, t[1] - 3, 2.4, 3); }
    return t;
  };
  const dome = (u, v, z, r, c0) => {
    const b = P(u, v, z), rx = r * a * 1.414;
    const gr = g.createRadialGradient(b[0] - rx * .4, b[1] - rx * .6, 1, b[0], b[1] - rx * .3, rx * 1.2); gr.addColorStop(0, shadeHex(c0, .6)); gr.addColorStop(.5, c0); gr.addColorStop(1, shadeHex(c0, -.5));
    g.beginPath(); g.ellipse(b[0], b[1], rx, rx / 2, 0, 0, Math.PI); g.ellipse(b[0], b[1], rx, rx * .95, 0, Math.PI, 0); g.fillStyle = gr; g.fill();
    if (!barb) { g.strokeStyle = '#d8b04a'; g.lineWidth = 1; g.beginPath(); g.moveTo(b[0], b[1] - rx * .95); g.lineTo(b[0], b[1] - rx * 1.35); g.stroke(); g.fillStyle = '#e8c15a'; g.beginPath(); g.arc(b[0], b[1] - rx * 1.4, 1.3, 0, 7); g.fill(); }
  };
  const flag = (p, h, s = 1) => {
    if (barb) return;
    g.strokeStyle = '#3b3a35'; g.lineWidth = 1; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0], p[1] - h); g.stroke();
    g.fillStyle = col; g.beginPath(); g.moveTo(p[0], p[1] - h); g.quadraticCurveTo(p[0] + 5 * s, p[1] - h + 1.5, p[0] + 10 * s, p[1] - h + 1); g.lineTo(p[0] + 9 * s, p[1] - h + 6 * s); g.quadraticCurveTo(p[0] + 4 * s, p[1] - h + 7 * s, p[0], p[1] - h + 6 * s); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = .5; g.stroke();
  };
  const stakes = (r, h) => {
    const pts = []; const n = 7;
    for (let i = 0; i <= n; i++) { pts.push([-r + 2 * r * i / n, r]); pts.push([r, -r + 2 * r * i / n]); }
    const back = []; for (let i = 0; i <= n; i++) { back.push([-r + 2 * r * i / n, -r]); back.push([-r, -r + 2 * r * i / n]); }
    return { front: pts, back };
  };
  const stake = (u, v, h) => { const b = P(u, v, 0), t = P(u, v, h); g.strokeStyle = barb ? '#5c4a38' : '#6e4a26'; g.lineWidth = Math.max(1.6, a * .22); g.lineCap = 'round'; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(t[0], t[1] - 1.5); g.stroke(); g.lineCap = 'butt'; };
  const wallRing = (r, h, th, c0, towers, troof) => {
    // arka duvarlar
    box(-r, -r, 2 * r, th, 0, h, c0); box(-r, -r, th, 2 * r, 0, h, c0);
    if (towers) { cyl(-r, -r, 0, h * 1.5, .22, c0, troof, .55); }
    return () => {
      box(r - th, -r, th, 2 * r, 0, h, c0);
      box(-r, r - th, r - .22, th, 0, h, c0); box(.22, r - th, r - .22, th, 0, h, c0);
      // mazgallar
      for (let i = 0; i < 6; i++) { if (barb && i % 3 === 1) continue; box(-r + .05 + i * 2 * r / 6, r - th, .12, th, h, .12, c0, null); }
      for (let i = 0; i < 6; i++) { if (barb && i % 2 === 0) continue; box(r - th, -r + .05 + i * 2 * r / 6, th, .12, h, .12, c0, null); }
      // kapı
      box(-.28, r - th - .04, .56, th + .08, 0, h * 1.25, c0);
      const gl = P(-.12, r + .04, 0), gr = P(.12, r + .04, 0), top = P(0, r + .04, h * .9);
      g.fillStyle = '#2a211a'; g.beginPath(); g.moveTo(gl[0], gl[1]); g.lineTo(gl[0], gl[1] - (gl[1] - top[1]) * .6); g.quadraticCurveTo(top[0], top[1], gr[0], gr[1] - (gr[1] - top[1]) * .6); g.lineTo(gr[0], gr[1]); g.fill();
      if (towers) { cyl(r, -r, 0, h * 1.5, .22, c0, troof, .55); cyl(-r, r, 0, h * 1.5, .22, c0, troof, .55); cyl(r, r, 0, h * 1.5, .22, c0, troof, .55); }
    };
  };
  const ground = (r, c0) => { const q = [P(-r, -r), P(r, -r), P(r, r), P(-r, r)]; poly(q, c0, false); };
  const house = (u, v, s = 1) => { box(u, v, .42 * s, .34 * s, 0, .32 * s, pal.plaster); hip(u, v, .42 * s, .34 * s, .32 * s, .26 * s, pal.roof); const w = P(u + .21 * s, v + .34 * s, .14 * s); g.fillStyle = '#3a2a1e'; g.fillRect(w[0] - 1, w[1] - 2.5, 2, 3); };
  const yurt = (u, v, s = 1) => {
    const b = P(u, v, 0), rx = .3 * s * a * 1.414, hh = .28 * s * a;
    g.fillStyle = barb ? '#8a8378' : '#e9dcc0'; g.beginPath(); g.ellipse(b[0], b[1], rx, rx / 2, 0, 0, Math.PI); g.lineTo(b[0] - rx, b[1] - hh); g.lineTo(b[0] + rx, b[1] - hh); g.closePath();
    g.moveTo(b[0] - rx, b[1]); g.lineTo(b[0] - rx, b[1] - hh); g.lineTo(b[0] + rx, b[1] - hh); g.lineTo(b[0] + rx, b[1]); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(b[0] + rx * .2, b[1] - hh, rx * .8, hh + rx * .3);
    g.fillStyle = barb ? '#6e675d' : '#c9b691'; g.beginPath(); g.ellipse(b[0], b[1] - hh, rx, rx * .6, 0, Math.PI, 0); g.fill();
    g.fillStyle = barb ? '#5a4632' : '#9a4a2f'; g.fillRect(b[0] - rx, b[1] - hh * .55, rx * 2, 1.4);
    g.fillStyle = '#3a2a1e'; g.fillRect(b[0] - 1.6, b[1] - hh * .75, 3.2, hh * .75 + 1);
  };

  // gölge
  const sr = [.75, .85, 1.0, 1.05, 1.2, 1.4][tier];
  g.fillStyle = 'rgba(10,20,5,.28)'; g.beginPath(); g.ellipse(cx + a * .4, cy + a * .25, sr * a * 1.7, sr * a * .85, 0, 0, 7); g.fill();

  if (tier === 0) {
    ground(.7, barb ? '#8e8466' : '#b39a6b');
    yurt(-.35, -.3, .9); yurt(.3, .1, 1);
    const f = P(-.2, .45, 0); g.fillStyle = '#4a3524'; g.fillRect(f[0] - 3, f[1] - 1, 6, 2);
    if (!barb) { g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(f[0] - 2, f[1] - 1); g.quadraticCurveTo(f[0], f[1] - 7, f[0] + 2, f[1] - 1); g.fill(); }
    flag(P(.45, -.35, 0), a * 1.4, .8);
  } else if (tier === 1) {
    ground(.8, barb ? '#8e8466' : '#b39a6b');
    house(-.6, -.55); house(.1, -.6, .9); house(-.55, .15, .9);
    // gözetleme kulesi
    const u = .35, v = .3;
    for (const [du, dv] of [[0, 0], [.2, 0], [0, .2], [.2, .2]]) stake(u + du, v + dv, .9);
    box(u - .04, v - .04, .28, .28, .85, .1, pal.wood);
    hip(u - .04, v - .04, .28, .28, .95, .3, pal.roof);
    flag(P(u + .1, v + .1, 1.25), a * 1.3, .8);
  } else if (tier === 2) {
    ground(.95, barb ? '#8a7f62' : '#a98f62');
    const s = stakes(.9);
    for (const [u, v] of s.back) stake(u, v, .55);
    house(-.55, -.5); house(.05, -.55, .9);
    const tu = -.1, tv = .05;
    box(tu, tv, .45, .45, 0, .9, pal.wood); hip(tu, tv, .45, .45, .9, .35, pal.roof);
    flag(P(tu + .22, tv + .22, 1.25), a * 1.4, .85);
    house(.35, .2, .8);
    for (const [u, v] of s.front) { if (Math.abs(u) < .2 && v > .8) continue; stake(u, v, .55); }
  } else if (tier === 3) {
    ground(.95, barb ? '#8a8270' : '#b4a27c');
    const front = wallRing(.9, .5, .16, pal.stone, false);
    box(-.4, -.45, .75, .7, 0, 1.2, pal.stone); hip(-.4, -.45, .75, .7, 1.2, .45, pal.roof);
    for (const k of [.15, .45]) { const w = P(-.4 + k * .75 + .1, .25, .75); g.fillStyle = '#2a211a'; g.fillRect(w[0] - 1, w[1] - 3, 2, 4); }
    flag(P(-.03, -.1, 1.65), a * 1.5);
    house(.3, .15, .8);
    front();
  } else if (tier === 4) {
    ground(1.05, barb ? '#8a8270' : '#b4a27c');
    const front = wallRing(1.0, .55, .17, pal.stone, true, pal.roof);
    box(-.2, -.55, .5, .45, 0, .5, pal.plaster); hip(-.2, -.55, .5, .45, .5, .3, pal.roof);
    box(-.5, -.3, .7, .7, 0, 1.35, pal.stone);
    for (let i = 0; i < 4; i++) box(-.5 + .02 + i * .18, .28, .1, .12, 1.35, .12, pal.stone, null);
    hip(-.5, -.3, .7, .7, 1.35, .5, pal.roof);
    flag(P(-.15, .05, 1.85), a * 1.6);
    house(.35, .2, .75);
    front();
  } else {
    const big = tier === 5;
    ground(big ? 1.3 : 1.15, barb ? '#8a8270' : '#bba986');
    const front = wallRing(big ? 1.22 : 1.08, .62, .18, pal.stone, true, pal.roof);
    if (big) { box(-.9, -.9, 1.8, .14, 0, .75, pal.stone); box(-.9, -.9, .14, 1.8, 0, .75, pal.stone); }
    box(.2, -.6, .5, .4, 0, .55, pal.plaster); hip(.2, -.6, .5, .4, .55, .3, pal.roof);
    box(-.55, -.45, .95, .95, 0, 1.0, pal.plaster);
    g.fillStyle = barb ? '#6f7a78' : '#2c8f86'; const s1 = P(-.55, .5, .82), s2 = P(.4, .5, .82); g.fillRect(s1[0], s1[1] - 1.5, s2[0] - s1[0], 2.2);
    if (big) { cyl(-.55, .5, 0, 2.0, .09, pal.plaster, '#8d99a3', .5); cyl(.4, -.45, 0, 2.0, .09, pal.plaster, '#8d99a3', .5); }
    dome(-.07, .03, 1.0, .42, pal.dome);
    flag(P(-.55, -.45, 1.0), a * 1.5);
    flag(P(.4, .5, 1.0), a * 1.5);
    if (big) { box(-.9, .76, 1.8, .14, 0, .75, pal.stone); box(.76, -.9, .14, 1.8, 0, .75, pal.stone); }
    front();
  }
  // yıkıntı: terk edilmiş köylerde otlar
  if (barb) { g.fillStyle = 'rgba(70,95,45,.8)'; for (let i = 0; i < 6; i++) { const p = P(-.8 + (i * .37) % 1.6, -.6 + (i * .53) % 1.4, 0); g.beginPath(); g.arc(p[0], p[1], 1.4, 0, 7); g.fill(); } }
}
function powerPlaque(g, x, y, v, tier, T) {
  const pts = C.vPoints(v), txt = fmtC(pts), own = v.owner === 'P', barb = v.owner === null;
  g.save(); g.font = '800 ' + Math.max(9, Math.round(T * .21)) + 'px system-ui, sans-serif';
  const tw = g.measureText(txt).width, pw = 6 * 5 + 4, w = tw + pw + 12, h = Math.max(13, T * .3);
  const x0 = x - w / 2, y0 = y;
  g.fillStyle = barb ? 'rgba(40,40,40,.72)' : 'rgba(15,24,41,.88)';
  g.beginPath(); g.roundRect ? g.roundRect(x0, y0, w, h, h / 2) : g.rect(x0, y0, w, h); g.fill();
  g.strokeStyle = own ? '#dcaa45' : barb ? 'rgba(255,255,255,.15)' : C.ownerColor(v.owner); g.lineWidth = own ? 1.5 : 1; g.stroke();
  for (let i = 0; i < 6; i++) {
    const px = x0 + 7 + i * 5, py = y0 + h / 2;
    g.fillStyle = i <= tier ? (barb ? '#b8b3a8' : ['#9fc27a', '#c8d46a', '#e8c15a', '#f0a04a', '#f07a4a', '#ff5a5a'][tier]) : 'rgba(255,255,255,.14)';
    g.beginPath(); g.moveTo(px, py - 2.8); g.lineTo(px + 2, py); g.lineTo(px, py + 2.8); g.lineTo(px - 2, py); g.fill();
  }
  g.fillStyle = barb ? '#d6d2c8' : '#efe6d2'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, x0 + pw + 6, y0 + h / 2 + .5);
  g.restore();
}
function drawVillage(g, v, px, py, T) {
  const pts = C.vPoints(v), tier = tierOf(pts), barb = v.owner === null, cx = px + T / 2, cy = py + T * .62;
  if (v.owner === 'P' || v.id === map.sel) {
    g.save(); g.strokeStyle = v.id === map.sel ? '#ffffff' : '#dcaa45'; g.lineWidth = 2; if (v.id === map.sel) g.setLineDash([4, 3]);
    g.beginPath(); g.ellipse(cx, cy, T * .72, T * .36, 0, 0, 7); g.stroke();
    if (v.owner === 'P') { g.fillStyle = 'rgba(220,170,69,.14)'; g.fill(); }
    g.restore();
  }
  const sp = castleSprite(tier, C.ownerColor(v.owner), barb, T);
  g.drawImage(sp.c, cx - sp.ax, cy - sp.ay, sp.W, sp.H);
  powerPlaque(g, cx, cy + T * .36, v, tier, T);
}
function tierLegendHTML() {
  const T = 60;
  return TIERS.map((t, i) => `<div class="tl"><canvas data-tier="${i}" width="10" height="10"></canvas><div><b>${t.n}</b><div class="muted small num">${i < TIERS.length - 1 ? fmt(t.min) + '–' + fmt(TIERS[i + 1].min - 1) : fmt(t.min) + '+'} puan</div></div></div>`).join('');
}
function paintTierLegend(box) {
  for (const cv of box.querySelectorAll('canvas[data-tier]')) {
    const sp = castleSprite(+cv.dataset.tier, S.player.color, false, 56);
    cv.width = sp.c.width; cv.height = sp.c.height; cv.style.width = sp.W + 'px'; cv.style.height = sp.H + 'px';
    cv.getContext('2d').drawImage(sp.c, 0, 0);
  }
}
