// ============================================================
//  UÇ BEYLERİ — çok oyunculu katman (Supabase)
//  Dünya durumu sunucuda tek satırda (sıkıştırılmış JSON) durur.
//  Her cihaz kendi hamlesini uygular ve sürüm kontrolüyle kaydeder;
//  iki kişi aynı anda kaydederse hamle yeni durum üzerine yeniden uygulanır.
// ============================================================
const Net = (() => {
'use strict';
const URL = 'https://tgiqiybqfbikmdoblwba.supabase.co';
const KEY = 'sb_publishable__r4MnoM3ecwE4T5RQR-2zw_7W046pR4';
const AUTH_K = 'ub-auth';
const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };

// ---------- kimlik (anonim giriş) ----------
let auth = ls.get(AUTH_K);
async function raw(path, { method = 'GET', body, headers = {}, token } = {}) {
  const h = Object.assign({ apikey: KEY, 'Content-Type': 'application/json' }, headers);
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(URL + path, { method, headers: h, body: body != null ? JSON.stringify(body) : undefined });
  const txt = await r.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
  if (!r.ok) { const err = new Error((data && (data.message || data.msg || data.error_description || data.error)) || ('HTTP ' + r.status)); err.status = r.status; err.code = data && data.code; throw err; }
  return data;
}
function keep(d) { auth = { access: d.access_token, refresh: d.refresh_token, exp: Date.now() + (d.expires_in || 3600) * 1000, uid: d.user && d.user.id }; ls.set(AUTH_K, auth); }
async function session() {
  if (auth && auth.access && Date.now() < auth.exp - 60000) return auth;
  if (auth && auth.refresh) {
    try { keep(await raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: auth.refresh } })); return auth; }
    catch (e) { if (e.status && e.status < 500 && e.status !== 429) { auth = null; ls.del(AUTH_K); } else throw e; }
  }
  keep(await raw('/auth/v1/signup', { method: 'POST', body: { data: {} } }));
  return auth;
}
async function api(path, opts = {}) { const a = await session(); return raw(path, Object.assign({}, opts, { token: a.access })); }
const rpc = (fn, args) => api('/rest/v1/rpc/' + fn, { method: 'POST', body: args });

// ---------- sıkıştırma ----------
function b64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
async function pack(obj) {
  const str = JSON.stringify(obj);
  if (typeof CompressionStream === 'undefined') return 'js:' + str;
  const buf = await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  return 'gz:' + b64(buf);
}
async function unpack(s) {
  if (s.startsWith('js:')) return JSON.parse(s.slice(3));
  const txt = await new Response(new Blob([unb64(s.slice(3))]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  return JSON.parse(txt);
}

// ---------- dünya ↔ yerel görünüm ----------
// Sunucudaki dünyada her gerçek oyuncunun kimliği H1, H2...; yerel oyuncu her cihazda 'P' olarak görünür.
const OWN_KEYS = new Set(['owner', 'attOwner', 'defOwner', 'from']);
function swapIds(x, a, b) {
  if (Array.isArray(x)) { for (const y of x) if (y && typeof y === 'object') swapIds(y, a, b); return; }
  for (const k in x) { const v = x[k]; if (v === a && OWN_KEYS.has(k)) x[k] = b; else if (v && typeof v === 'object') swapIds(v, a, b); }
}
const HCOL = ['#e3b341', '#4fc3f7', '#f06292', '#aed581', '#ffb74d', '#ce93d8', '#4db6ac', '#ff8a65'];
function localize(W, hid) {
  const S = JSON.parse(JSON.stringify(W));
  const i = S.beys.findIndex(b => b.id === hid); if (i < 0) return null;
  const me = S.beys.splice(i, 1)[0];
  swapIds(S, hid, 'P');
  S.player = { name: me.name, color: me.color };
  S.tech = me.tech || {}; S.techq = me.techq || null;
  S.clan = me.clan ? { name: me.clanName, tag: me.clan, created: me.clanAt || 0 } : null; S.clanJoinedAi = !!me.clanJoinedAi;
  S.stats = me.stats || { trained: {}, barbWins: 0, spies: 0 };
  S.protectUntil = me.protectUntil || 0; S.reports = me.reports || []; S.quests = me.quests || { claimed: [] };
  S.cur = me.cur != null && S.vil[me.cur] && S.vil[me.cur].owner === 'P' ? me.cur : (S.vil.find(v => v.owner === 'P') || { id: 0 }).id;
  S.clanChat = S.clanChat || {}; if (S.clan) S.clanChat[S.clan.tag] = S.clanChat[S.clan.tag] || [];
  S.chat = { genel: (S.chat && S.chat.genel) || [], klan: S.clan ? S.clanChat[S.clan.tag] : [] };
  S.chatq = S.chatq || []; S.chatSeen = { genel: 0, klan: 0 };
  S.over = !S.vil.some(v => v.owner === 'P');
  S._me = { hid, idx: i, uid: me.uid };
  return S;
}
function delocalize(S0) {
  const S = JSON.parse(JSON.stringify(S0)), m = S._me;
  const me = { id: m.hid, human: true, uid: m.uid, name: S.player.name, color: S.player.color, aggr: 0, lastHitP: 0,
    clan: S.clan ? S.clan.tag : null, clanName: S.clan ? S.clan.name : null, clanAt: S.clan ? S.clan.created : 0, clanJoinedAi: !!S.clanJoinedAi,
    tech: S.tech, techq: S.techq, stats: S.stats, protectUntil: S.protectUntil, reports: S.reports, quests: S.quests, cur: S.cur };
  swapIds(S, 'P', m.hid);
  if (S.clan) S.clanChat[S.clan.tag] = S.chat.klan;
  S.chat = { genel: S.chat.genel, klan: [] };
  S.beys.splice(Math.min(m.idx, S.beys.length), 0, me);
  for (const k of ['_me', 'player', 'tech', 'techq', 'clan', 'clanJoinedAi', 'stats', 'protectUntil', 'reports', 'quests', 'cur', 'chatSeen', 'over', 'pendingRes', 'pendingSupport']) delete S[k];
  return S;
}
// yeni oyuncuya haritada boş bir köy verir (diğer oyunculardan ve beylerden uzakta)
function addHuman(W, hid, uid, name, village, t) {
  if (W.beys.some(b => b.id === hid)) return W;
  const occupied = W.vil.filter(v => v.owner !== null);
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let best = null, bs = Infinity;
  for (const v of W.vil) {
    if (v.owner !== null) continue;
    const near = Math.min(...occupied.map(o => d(o, v)));
    if (near < 3.5) continue;
    const s = Math.abs(near - 5) * 2 + d(v, { x: 12, y: 12 }) * .4;
    if (s < bs) { bs = s; best = v; }
  }
  if (!best) best = W.vil.find(v => v.owner === null);
  if (!best) throw new Error('Haritada boş köy kalmadı');
  const nv = Core.mkVillage(best.id, best.x, best.y, String(village || best.name).slice(0, 22), hid,
    { konak: 1, kereste: 1, tas: 1, demir: 1, ambar: 1, ciftlik: 1 }, {}, [500, 500, 400], t);
  W.vil[best.id] = nv;
  W.moves = W.moves.filter(m => m.to !== best.id || m.type === 'return' || m.type === 'tradeback');
  const n = W.beys.filter(b => b.human).length;
  W.beys.push({ id: hid, human: true, uid, name: String(name || 'Beylik').slice(0, 28), color: HCOL[n % HCOL.length], aggr: 0, lastHitP: 0,
    clan: null, clanName: null, clanJoinedAi: false, tech: {}, techq: null, stats: { trained: {}, barbWins: 0, spies: 0 },
    protectUntil: t + 3 * 24 * Core.HOUR / W.speed, reports: [], quests: { claimed: [] }, cur: best.id });
  W.chat.genel.push({ id: ++W.uid, t, from: 'SYS', text: String(name || 'Yeni bir bey') + ' dünyaya katıldı.' });
  return W;
}

// ---------- sunucu işlemleri ----------
const CODE_CH = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
const newCode = () => Array.from({ length: 6 }, () => CODE_CH[Math.floor(Math.random() * CODE_CH.length)]).join('');
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

async function createWorld(W, name, pname) {
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    try {
      const id = await rpc('create_world', { p_code: code, p_name: name, p_speed: W.speed, p_state: await pack(W), p_pname: pname });
      return { id, code, hid: 'H1', version: 1 };
    } catch (e) { if (e.code !== '23505') throw e; }
  }
  throw new Error('Kod üretilemedi, tekrar dene');
}
async function joinWorld(code, pname) {
  const r = await rpc('join_world', { p_code: normCode(code), p_pname: pname });
  const row = Array.isArray(r) ? r[0] : r;
  if (!row || !row.r_world) throw new Error('Bu kodla bir dünya bulunamadı');
  return { id: row.r_world, hid: row.r_hid, code: normCode(code) };
}
async function load(id) {
  const rows = await api('/rest/v1/worlds?id=eq.' + id + '&select=state,version,code,name,speed');
  if (!rows || !rows.length) throw new Error('Dünya bulunamadı ya da erişimin yok');
  const r = rows[0];
  return { W: await unpack(r.state), version: r.version, code: r.code, name: r.name };
}
// sürüm tutarsa kaydeder ve yeni sürümü döner; başka biri önce kaydettiyse null
async function save(id, W, version) {
  const rows = await api('/rest/v1/worlds?id=eq.' + id + '&version=eq.' + version + '&select=version', {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: { state: await pack(W), version: version + 1, updated_at: new Date().toISOString() } });
  return rows && rows.length ? rows[0].version : null;
}
async function version(id) { const rows = await api('/rest/v1/worlds?id=eq.' + id + '&select=version'); return rows && rows.length ? rows[0].version : null; }
async function myWorlds() {
  const a = await session();
  const rows = await api('/rest/v1/world_players?select=hid,name,world_id,worlds(code,name,speed,updated_at)&user_id=eq.' + a.uid);
  return (rows || []).filter(r => r.worlds).map(r => ({ id: r.world_id, hid: r.hid, pname: r.name, code: r.worlds.code, name: r.worlds.name, speed: r.worlds.speed, updated: r.worlds.updated_at }))
    .sort((x, y) => String(y.updated).localeCompare(String(x.updated)));
}
async function players(id) { return api('/rest/v1/world_players?select=hid,name,joined_at&world_id=eq.' + id + '&order=joined_at'); }
async function leaveWorld(id) { const a = await session(); return api('/rest/v1/world_players?world_id=eq.' + id + '&user_id=eq.' + a.uid, { method: 'DELETE' }); }

return { session, createWorld, joinWorld, load, save, version, myWorlds, players, leaveWorld, localize, delocalize, addHuman, normCode, get uid() { return auth && auth.uid; } };
})();
