// ---------- HARİTA: yürüyen ordular, çatışma efektleri, hareket paneli ----------
const MV = { raf: 0, last: 0, seen: new Map(), fx: [], sig: '', open: true };
const MCOL = { attack: '#e8b64a', spy: '#3cb4a6', support: '#8fb0e8', return: '#6cc08b', inc: '#ff5a44', trade: '#d9a25a', tradeback: '#b58a55', gift: '#9fd07a' };
const MICON = {
  attack: '<path d="M5 19L17 7M14 7h3v3M19 19L7 7M7 7h3M7 7v3"/>',
  spy: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  support: '<path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z"/>',
  return: '<path d="M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3"/>',
  inc: '<path d="M12 3L2 20h20zM12 9v5M12 17v.5"/>',
  trade: '<path d="M4 8h16l-1.5 11h-13zM8 8a4 4 0 018 0"/>',
  tradeback: '<path d="M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3"/>',
  gift: '<path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0"/>',
};
const mvKind = m => (m.type === 'trade' && m.owner !== 'P' ? 'gift' : m.type === 'trade' || m.type === 'tradeback' ? m.type : m.owner !== 'P' ? 'inc' : m.type);
function mvRelevant(m) { return m.owner === 'P' || (S.vil[m.to] && S.vil[m.to].owner === 'P'); }
// çok oyunculuda başka oyuncuların seferleri: yalnızca yol çizgisi (asker sayısı ve figür gösterilmez)
function mvOther(m) { return !!S.mp && !mvRelevant(m) && C.isHuman(m.owner) && (m.type === 'attack' || m.type === 'spy' || m.type === 'support'); }
function mvGeom(m, T) {
  const a = S.vil[m.type === 'return' || m.type === 'tradeback' ? m.via : m.from], b = S.vil[m.to];
  const pa = mapPt(a.x + .5, a.y + (map.three ? .5 : .62)), pb = mapPt(b.x + .5, b.y + (map.three ? .5 : .62)), ax = pa.x, ay = pa.y, bx = pb.x, by = pb.y;
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, bend = Math.min(60, L * .18) * (m.id % 2 ? 1 : -1);
  const cx = (ax + bx) / 2 - dy / L * bend, cy = (ay + by) / 2 + dx / L * bend;
  return { ax, ay, bx, by, cx, cy };
}
const qpt = (G, k) => { const u = 1 - k; return { x: u * u * G.ax + 2 * u * k * G.cx + k * k * G.bx, y: u * u * G.ay + 2 * u * k * G.cy + k * k * G.by }; };
const qtan = (G, k) => { const x = 2 * (1 - k) * (G.cx - G.ax) + 2 * k * (G.bx - G.cx), y = 2 * (1 - k) * (G.cy - G.ay) + 2 * k * (G.by - G.cy); const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };

function drawRoute(g, G, k, col, T) {
  const seg = (k0, k1, dash, alpha, w) => {
    g.save(); g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash); g.lineCap = 'round';
    g.beginPath(); for (let i = 0; i <= 24; i++) { const p = qpt(G, k0 + (k1 - k0) * i / 24); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); } g.stroke(); g.restore();
  };
  g.save(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 5; g.globalAlpha = .5; g.beginPath(); for (let i = 0; i <= 24; i++) { const p = qpt(G, i / 24); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); } g.stroke(); g.restore();
  seg(0, k, [], .35, 2.5);
  seg(k, 1, [7, 6], .95, 2.5);
  const e = qpt(G, .97), tn = qtan(G, .97), s = Math.max(6, T * .16);
  g.fillStyle = col; g.beginPath(); g.moveTo(e.x + tn.x * s, e.y + tn.y * s); g.lineTo(e.x - tn.y * s * .6, e.y + tn.x * s * .6); g.lineTo(e.x + tn.y * s * .6, e.y - tn.x * s * .6); g.fill();
}
function mvFigure(g, x, y, s, cav, col, t, i, loot) {
  const bob = Math.abs(Math.sin(t / 130 + i * 1.3)) * s * .25;
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + s * .2, y, s * .9, s * .3, 0, 0, 7); g.fill();
  if (cav) {
    const leg = Math.sin(t / 110 + i) * s * .35;
    g.strokeStyle = '#4a2e18'; g.lineWidth = Math.max(1, s * .22);
    for (const [lx, o] of [[-.55, leg], [-.25, -leg], [.35, leg], [.6, -leg]]) { g.beginPath(); g.moveTo(x + lx * s, y - s * .75 - bob); g.lineTo(x + lx * s + o, y); g.stroke(); }
    g.fillStyle = '#6b3f22'; g.beginPath(); g.ellipse(x, y - s * .95 - bob, s * .85, s * .42, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x + s * .55, y - s * 1.1 - bob); g.lineTo(x + s * 1.1, y - s * 1.6 - bob); g.lineTo(x + s * 1.3, y - s * 1.4 - bob); g.lineTo(x + s * .8, y - s * .9 - bob); g.fill();
    g.fillStyle = col; g.fillRect(x - s * .2, y - s * 1.75 - bob, s * .45, s * .65);
    g.fillStyle = '#d9b48c'; g.beginPath(); g.arc(x, y - s * 1.95 - bob, s * .22, 0, 7); g.fill();
    g.strokeStyle = '#ccd'; g.lineWidth = Math.max(.8, s * .12); g.beginPath(); g.moveTo(x + s * .15, y - s * 1.4 - bob); g.lineTo(x + s * 1.2, y - s * 2.6 - bob); g.stroke();
  } else {
    const leg = Math.sin(t / 150 + i) * s * .25;
    g.strokeStyle = '#2e2419'; g.lineWidth = Math.max(1, s * .2);
    g.beginPath(); g.moveTo(x - s * .12, y - s * .6); g.lineTo(x - s * .12 + leg, y); g.moveTo(x + s * .12, y - s * .6); g.lineTo(x + s * .12 - leg, y); g.stroke();
    g.fillStyle = col; g.fillRect(x - s * .3, y - s * 1.35 - bob * .4, s * .6, s * .8);
    g.fillStyle = '#d9b48c'; g.beginPath(); g.arc(x, y - s * 1.6 - bob * .4, s * .24, 0, 7); g.fill();
    g.fillStyle = '#b9bcc4'; g.beginPath(); g.arc(x, y - s * 1.66 - bob * .4, s * .26, Math.PI, 0); g.fill();
    g.strokeStyle = '#6e4a26'; g.lineWidth = Math.max(.8, s * .12); g.beginPath(); g.moveTo(x + s * .42, y - s * .1); g.lineTo(x + s * .42, y - s * 2.5); g.stroke();
    g.fillStyle = '#dde'; g.beginPath(); g.moveTo(x + s * .3, y - s * 2.5); g.lineTo(x + s * .42, y - s * 2.9); g.lineTo(x + s * .54, y - s * 2.5); g.fill();
  }
  if (loot) { g.fillStyle = '#c9a15a'; g.beginPath(); g.ellipse(x - s * .45, y - s * 1.2 - bob, s * .32, s * .38, 0, 0, 7); g.fill(); g.strokeStyle = '#7a5a2a'; g.lineWidth = .8; g.stroke(); }
}
function camel(g, x, y, s, t, i, loaded) {
  const w = Math.sin(t / 170 + i * 1.7) * s * .3;
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x, y, s * 1.2, s * .35, 0, 0, 7); g.fill();
  g.strokeStyle = '#8a6a3e'; g.lineWidth = Math.max(1, s * .2);
  for (const [lx, o] of [[-.7, w], [-.4, -w], [.45, w], [.75, -w]]) { g.beginPath(); g.moveTo(x + lx * s, y - s * .9); g.lineTo(x + lx * s + o, y); g.stroke(); }
  g.fillStyle = '#c79a5e'; g.beginPath(); g.ellipse(x, y - s * 1.1, s * 1.05, s * .45, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(x - s * .1, y - s * 1.5, s * .45, s * .4, 0, 0, 7); g.fill();
  g.beginPath(); g.moveTo(x + s * .8, y - s * 1.2); g.quadraticCurveTo(x + s * 1.5, y - s * 1.4, x + s * 1.45, y - s * 2.2); g.lineTo(x + s * 1.8, y - s * 2.25); g.lineTo(x + s * 1.75, y - s * 1.95); g.quadraticCurveTo(x + s * 1.3, y - s * 1.2, x + s * 1.0, y - s * .9); g.fill();
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x + s * .3, y - s * .95, s * .6, s * .22, 0, 0, 7); g.fill();
  if (loaded) {
    g.fillStyle = ['#a8743e', '#8f9aa6', '#6f7f96'][i % 3]; g.fillRect(x - s * .75, y - s * 1.85, s * .6, s * .7); g.fillRect(x + s * .05, y - s * 1.85, s * .6, s * .7);
    g.fillStyle = '#b8403a'; g.fillRect(x - s * .8, y - s * 1.95, s * 1.5, s * .22);
  }
}
function drawCaravan(g, m, G, k, T, t) {
  const kind = mvKind(m), col = MCOL[kind], p = qpt(G, k), tn = qtan(G, k), s = Math.max(3.6, T * .1), dir = tn.x >= 0 ? 1 : -1;
  const loaded = m.type === 'trade', n = Math.min(4, Math.max(1, m.merchants || 1));
  for (let i = 0; i < 5; i++) { const f = ((t / 1100 + i / 5) % 1), q = qpt(G, Math.max(0, k - .01 - f * .04)); g.fillStyle = `rgba(214,196,150,${.3 * (1 - f)})`; g.beginPath(); g.arc(q.x, q.y - s * .2, s * (.4 + f * 1.2), 0, 7); g.fill(); }
  if (!map.three) {
  const pts = []; for (let i = 0; i < n; i++) pts.push({ x: p.x - tn.x * i * s * 2.6, y: p.y - tn.y * i * s * 2.6, i });
  pts.sort((a, b) => a.y - b.y);
  for (const q of pts) { g.save(); g.translate(q.x, q.y); g.scale(dir, 1); camel(g, 0, 0, s, t, q.i, loaded); g.restore(); }
  // kervanbaşı
  const hx = p.x + tn.x * s * 2, hy = p.y + tn.y * s * 2;
  g.save(); g.translate(hx, hy); g.scale(dir, 1); mvFigure(g, 0, 0, s * .9, false, kind === 'gift' ? C.ownerColor(m.owner) : '#8a5a32', t, 7, false); g.restore();
  }
  const tot = m.res ? m.res.reduce((a, b) => a + b, 0) : 0, label = loaded ? fmtC(tot) : '';
  if (label) {
    g.font = `800 ${Math.max(9, Math.round(T * .2))}px system-ui, sans-serif`; const w = g.measureText(label).width + 16, bx = p.x, by = p.y + s * 1.1;
    g.fillStyle = 'rgba(12,18,32,.9)'; g.beginPath(); g.roundRect ? g.roundRect(bx - w / 2, by, w, s * 2.6, s * 1.3) : g.rect(bx - w / 2, by, w, s * 2.6); g.fill();
    g.strokeStyle = col; g.lineWidth = 1.4; g.stroke(); g.fillStyle = col; g.beginPath(); g.arc(bx - w / 2 + 6, by + s * 1.3, 2.3, 0, 7); g.fill();
    g.fillStyle = '#f1ece0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, bx + 3, by + s * 1.35);
  }
}
function drawArmy(g, m, G, k, T, t) {
  const kind = mvKind(m), col = MCOL[kind], p = qpt(G, k), tn = qtan(G, k), nx = -tn.y, ny = tn.x;
  const s = Math.max(4, T * .12), units = m.units || {};
  let cav = 0, tot = 0; for (const [u, n] of Object.entries(units)) { tot += n; if (C.U[u] && (C.U[u].cls === 'cav' || C.U[u].cls === 'spy')) cav += n; }
  const isCav = cav > tot / 2, loot = m.type === 'return' && m.loot && m.loot.some(x => x > 0);
  const n = kind === 'spy' ? 1 : Math.min(5, 2 + Math.floor(Math.log10(tot + 1) * 1.3));
  const dir = tn.x >= 0 ? 1 : -1, uc = kind === 'inc' ? C.ownerColor(m.owner) : kind === 'support' && m.owner !== 'P' ? C.ownerColor(m.owner) : S.player.color;
  // toz
  for (let i = 0; i < 6; i++) {
    const f = ((t / 900 + i / 6) % 1), q = qpt(G, Math.max(0, k - .012 - f * .05));
    g.fillStyle = `rgba(214,196,150,${.38 * (1 - f)})`; g.beginPath(); g.arc(q.x + nx * Math.sin(i * 2) * s, q.y + ny * Math.sin(i * 2) * s - s * .3, s * (.5 + f * 1.4), 0, 7); g.fill();
  }
  if (!map.three) {
  const slots = [[0, 0], [-1, 1], [-1, -1], [-2, 0], [-2, 2], [-2, -2]].slice(0, n);
  const pts = slots.map(([a, b], i) => ({ x: p.x + tn.x * a * s * 1.5 + nx * b * s * .9, y: p.y + tn.y * a * s * 1.5 + ny * b * s * .9, i })).sort((u, v) => u.y - v.y);
  for (const q of pts) { g.save(); g.translate(q.x, q.y); g.scale(dir, 1); mvFigure(g, 0, 0, s, isCav, uc, t, q.i, loot && q.i < 2); g.restore(); }
  // sancak
  const fx = p.x + tn.x * s * .8, fy = p.y + tn.y * s * .8, fh = s * 4.2;
  g.strokeStyle = '#3b2e22'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy - fh); g.stroke();
  g.beginPath(); g.moveTo(fx, fy - fh);
  for (let i = 1; i <= 5; i++) g.lineTo(fx + dir * s * 2.2 * i / 5, fy - fh + Math.sin(t / 200 + i) * s * .15 * i / 5);
  for (let i = 5; i >= 0; i--) g.lineTo(fx + dir * s * 2.2 * i / 5, fy - fh + s * 1.3 - i * s * .08 + Math.sin(t / 200 + i) * s * .15 * i / 5);
  g.closePath(); g.fillStyle = uc; g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = .6; g.stroke();
  }
  // rozet
  const label = kind === 'inc' ? '?' : String(tot), bx = p.x, by = p.y + s * 1.2;
  g.font = `800 ${Math.max(9, Math.round(T * .2))}px system-ui, sans-serif`; const w = g.measureText(label).width + 16;
  g.fillStyle = 'rgba(12,18,32,.9)'; g.beginPath(); g.roundRect ? g.roundRect(bx - w / 2, by, w, s * 2.6, s * 1.3) : g.rect(bx - w / 2, by, w, s * 2.6); g.fill();
  g.strokeStyle = col; g.lineWidth = 1.4; g.stroke();
  g.fillStyle = col; g.beginPath(); g.arc(bx - w / 2 + 6, by + s * 1.3, 2.3, 0, 7); g.fill();
  g.fillStyle = '#f1ece0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, bx + 3, by + s * 1.35);
}
function drawTargetAlert(g, G, t, T) {
  const ph = (t / 900) % 1;
  for (const k of [ph, (ph + .5) % 1]) { g.strokeStyle = `rgba(255,80,60,${.8 * (1 - k)})`; g.lineWidth = 2.5; g.beginPath(); g.ellipse(G.bx, G.by, T * (.45 + k * .5), T * (.22 + k * .25), 0, 0, 7); g.stroke(); }
}
function drawClash(g, fx, T, t) {
  const age = (t - fx.t0) / 2400; if (age > 1) return false;
  const cp = mapPt(S.vil[fx.v].x + .5, S.vil[fx.v].y + (map.three ? .4 : .45)), x = cp.x, y = cp.y, s = T * .5;
  g.save();
  g.globalAlpha = 1 - age * age;
  const rg = g.createRadialGradient(x, y, 1, x, y, s * (1 + age));
  rg.addColorStop(0, fx.good ? 'rgba(255,230,140,.9)' : 'rgba(255,120,80,.9)'); rg.addColorStop(1, 'rgba(255,120,60,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(x, y, s * (1 + age), 0, 7); g.fill();
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 + i, r = s * (.3 + age * 1.3); g.strokeStyle = i % 2 ? '#ffd27a' : '#fff'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + Math.cos(a) * r * .6, y + Math.sin(a) * r * .6 * .6); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * .6); g.stroke(); }
  // çapraz kılıçlar
  const sw = s * .55, rot = Math.sin(age * 12) * .25 * (1 - age);
  g.translate(x, y - s * .55 - age * s * .3); g.lineCap = 'round';
  for (const d of [-1, 1]) { g.save(); g.rotate(d * (.75 + rot)); g.strokeStyle = '#e8ecf2'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -sw); g.lineTo(0, sw * .6); g.stroke(); g.strokeStyle = '#c9a14a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-sw * .3, sw * .55); g.lineTo(sw * .3, sw * .55); g.stroke(); g.restore(); }
  g.restore();
  return true;
}
function drawMoves(g, T) {
  const t = now(), at = performance.now();
  const rel = S.moves.filter(mvRelevant);
  for (const m of rel) { const G = mvGeom(m, T), k = Math.min(1, Math.max(0, (t - m.depart) / (m.arrive - m.depart))); drawRoute(g, G, k, MCOL[mvKind(m)], T); }
  for (const m of S.moves.filter(mvOther)) { const G = mvGeom(m, T), k = Math.min(1, Math.max(0, (t - m.depart) / (m.arrive - m.depart))); g.save(); g.globalAlpha = .8; drawRoute(g, G, k, C.ownerColor(m.owner), T); g.restore(); }
  for (const m of rel) if (mvKind(m) === 'inc' && m.type === 'attack') drawTargetAlert(g, mvGeom(m, T), at, T);
  return () => {
    for (const m of rel.slice().sort((a, b) => qpt(mvGeom(a, T), .5).y - qpt(mvGeom(b, T), .5).y)) {
      const G = mvGeom(m, T), k = Math.min(1, Math.max(0, (t - m.depart) / (m.arrive - m.depart)));
      if (m.type === 'trade' || m.type === 'tradeback') drawCaravan(g, m, G, k, T, at); else drawArmy(g, m, G, k, T, at);
    }
    MV.fx = MV.fx.filter(fx => drawClash(g, fx, T, at));
  };
}
// hareket bitince çatışma efekti
function trackArrivals() {
  const cur = new Map(S.moves.filter(mvRelevant).map(m => [m.id, m]));
  for (const [id, m] of MV.seen) if (!cur.has(id) && (m.type === 'attack' || m.type === 'spy') && now() >= m.arrive - 1500) MV.fx.push({ v: m.to, t0: performance.now(), good: m.owner === 'P' });
  MV.seen = cur;
}
// sol üstteki hareket paneli
function movePanelHTML() {
  const t = now(), list = S.moves.filter(mvRelevant).sort((a, b) => (mvKind(b) === 'inc') - (mvKind(a) === 'inc') || a.arrive - b.arrive);
  if (!list.length) return '';
  const name = { attack: 'Saldırı', spy: 'Keşif', support: 'Destek', return: 'Dönüş', inc: 'Gelen saldırı', trade: 'Kervan', tradeback: 'Kervan dönüşü', gift: 'Gelen kervan' };
  const inc = list.filter(m => mvKind(m) === 'inc').length;
  let h = `<button class="mvhead" data-mvtoggle><span>Yoldaki birlikler</span><b class="num">${list.length}</b>${inc ? `<b class="mvinc num">${inc} gelen</b>` : ''}<i>${MV.open ? '▴' : '▾'}</i></button>`;
  if (!MV.open) return h;
  h += list.slice(0, 4).map(m => {
    const kind = mvKind(m), to = S.vil[m.to];
    let tot = 0; for (const n of Object.values(m.units || {})) tot += n;
    const who = kind === 'inc' || kind === 'gift' ? to.name : m.type === 'return' || m.type === 'tradeback' ? S.vil[m.via].name + ' ›' : to.name;
    if (m.res) tot = m.res.reduce((a, b) => a + b, 0);
    return `<button class="mvrow ${kind}" data-mv="${m.id}" title="${name[kind]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${MICON[kind]}</svg>
      <span class="mvt">${esc(who)}${kind === 'inc' || !tot ? '' : ` <em class="num">${m.res ? fmtC(tot) : tot}</em>`}</span><b class="num" data-end="${m.arrive}">${dur(m.arrive - t)}</b>
      <i class="mvbar"><i data-s="${m.depart}" data-e="${m.arrive}"></i></i></button>`;
  }).join('');
  if (list.length > 4) h += `<div class="mvmore">+${list.length - 4} hareket daha</div>`;
  return h;
}
function liveMovePanel() {
  const el = $('mvpanel'); if (!el) return;
  const s = S.moves.filter(mvRelevant).map(m => m.id).join() + '|' + MV.open;
  if (s !== MV.sig) { MV.sig = s; el.innerHTML = movePanelHTML(); el.hidden = s.startsWith('|'); }
  const t = now();
  for (const b of el.querySelectorAll('[data-end]')) b.textContent = dur(+b.dataset.end - t);
  for (const b of el.querySelectorAll('[data-e]')) { const s0 = +b.dataset.s, e = +b.dataset.e; b.style.width = Math.min(100, Math.max(0, (t - s0) / (e - s0) * 100)) + '%'; }
}
function focusMove(id) {
  const m = S.moves.find(x => x.id === id), cv = $('map'); if (!m || !cv) return;
  if (map.three) { const a = S.vil[m.type === 'return' || m.type === 'tradeback' ? m.via : m.from], b = S.vil[m.to], k = Math.min(1, Math.max(0, (now() - m.depart) / (m.arrive - m.depart))); V3.map.focus(a.x + .5 + (b.x - a.x) * k, a.y + .5 + (b.y - a.y) * k); map.sel = m.to; mapCard(); return; }
  const G = mvGeom(m, map.T), k = Math.min(1, Math.max(0, (now() - m.depart) / (m.arrive - m.depart))), p = qpt(G, k), r = cv.getBoundingClientRect();
  map.ox += p.x - r.width * .55; map.oy += p.y - r.height * .58; clampMap(); map.sel = m.to; mapCard();
}
function mapLoop(ts) {
  MV.raf = 0;
  if (tab !== 'harita' || !$('map')) return;
  if (ts - MV.last > 33) { MV.last = ts; trackArrivals(); drawMap(); liveMovePanel(); }
  MV.raf = requestAnimationFrame(mapLoop);
}
