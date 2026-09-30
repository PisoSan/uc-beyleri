// ============================================================
//  UÇ BEYLERİ — oyun çekirdeği
//  Bütün kurallar burada. Arayüzden bağımsızdır; ileride aynı dosya
//  sunucuda çalışacak. Zaman her yerde gerçek milisaniye (Date.now()),
//  süreler dünya hızına (S.speed) bölünür.
// ============================================================
const Core = (() => {
'use strict';

const HOUR = 3600000;
const RES_NAMES = ['Kereste', 'Taş', 'Demir'];
const MINES = ['kereste', 'tas', 'demir'];

// ---------- binalar ----------
const B = {
  konak:   { n: 'Konak',          d: 'Beyliğin merkezi. Seviyesi arttıkça bütün inşaatlar hızlanır.', max: 25, c: [90, 80, 70],    f: 1.26,  t: 90,   pop: 5, req: {} },
  kereste: { n: 'Kereste Ocağı',  d: 'Kereste üretir.',                                                max: 30, c: [50, 60, 40],    f: 1.25,  t: 60,   pop: 1, req: {} },
  tas:     { n: 'Taş Ocağı',      d: 'Taş üretir.',                                                    max: 30, c: [65, 50, 40],    f: 1.27,  t: 60,   pop: 1, req: {} },
  demir:   { n: 'Demir Madeni',   d: 'Demir üretir.',                                                  max: 30, c: [75, 65, 70],    f: 1.252, t: 75,   pop: 1, req: {} },
  ambar:   { n: 'Ambar',          d: 'Her kaynaktan ne kadar biriktirebileceğini belirler.',           max: 30, c: [60, 50, 40],    f: 1.265, t: 70,   pop: 0, req: {} },
  ciftlik: { n: 'Çiftlik',        d: 'Nüfus sınırını artırır. Binalar ve askerler nüfus ister.',       max: 30, c: [45, 40, 30],    f: 1.3,   t: 80,   pop: 0, req: {} },
  kisla:   { n: 'Kışla',          d: 'Piyade eğitir. Seviyesi eğitimi hızlandırır.',                   max: 25, c: [200, 170, 90],  f: 1.26,  t: 120,  pop: 7, req: { konak: 3 } },
  sur:     { n: 'Sur',            d: 'Köyün savunmasını güçlendirir.',                                 max: 20, c: [50, 100, 20],   f: 1.26,  t: 150,  pop: 2, req: { kisla: 1 } },
  ahir:    { n: 'Ahır',           d: 'Süvari ve çaşıt yetiştirir.',                                    max: 20, c: [270, 240, 260], f: 1.26,  t: 240,  pop: 8, req: { konak: 5, kisla: 3 } },
  tophane: { n: 'Tophane',        d: 'Surları yıkan mancınıklar üretir.',                             max: 15, c: [300, 240, 260], f: 1.26,  t: 360,  pop: 8, req: { konak: 7, kisla: 5 } },
  kervansaray: { n: 'Kervansaray', d: 'Tüccarların hanı. Her seviye bir tüccar verir; her tüccar 1.000 kaynak taşır. Haritadaki herhangi bir köye kaynak gönderebilirsin.', max: 20, c: [100, 100, 100], f: 1.26, t: 180, pop: 3, req: { konak: 2, ambar: 2 } },
  medrese: { n: 'Medrese',        d: 'Âlimler burada teknoloji araştırır. Seviyesi araştırmaları hızlandırır ve yeni teknolojileri açar.', max: 20, c: [220, 200, 180], f: 1.26, t: 300, pop: 6, req: { konak: 4 } },
  divan:   { n: 'Divan',          d: 'Köy fethetmek için gereken Sancakbeyini yetiştirir.',            max: 1,  c: [8000, 10000, 8000], f: 1, t: 2400, pop: 40, req: { konak: 10, ahir: 3, ambar: 12 } },
};
const B_ORDER = ['konak', 'kereste', 'tas', 'demir', 'ambar', 'ciftlik', 'kisla', 'sur', 'ahir', 'tophane', 'kervansaray', 'medrese', 'divan'];
const B_PTS = { konak: 10, kereste: 6, tas: 6, demir: 6, ambar: 6, ciftlik: 5, kisla: 16, sur: 8, ahir: 20, tophane: 24, medrese: 18, kervansaray: 10, divan: 512 };

// ---------- birlikler ----------
// a: saldırı, di: piyadeye karşı savunma, dc: süvariye karşı savunma,
// sp: bir kareyi kaç dakikada geçer (dünya hızı 1'de), cr: taşıma, t: eğitim saniyesi
const U = {
  mizrakli:   { n: 'Mızraklı',   b: 'kisla',   lv: 1, c: [50, 30, 10],   pop: 1,   a: 10,  di: 15,  dc: 45,  sp: 18, cr: 25, t: 90,   cls: 'inf', d: 'Süvariye karşı sağlam savunma' },
  baltaci:    { n: 'Baltacı',    b: 'kisla',   lv: 2, c: [60, 30, 40],   pop: 1,   a: 40,  di: 10,  dc: 5,   sp: 18, cr: 10, t: 110,  cls: 'inf', d: 'Ucuz saldırı piyadesi' },
  okcu:       { n: 'Okçu',       b: 'kisla',   lv: 3, c: [100, 30, 60],  pop: 1,   a: 15,  di: 50,  dc: 40,  sp: 18, cr: 10, t: 120,  cls: 'inf', d: 'Piyadeye karşı sağlam savunma' },
  casus:      { n: 'Çaşıt',      b: 'ahir',    lv: 1, c: [50, 50, 20],   pop: 2,   a: 0,   di: 2,   dc: 1,   sp: 9,  cr: 0,  t: 60,   cls: 'spy', d: 'Düşman köyünü keşfeder' },
  akinci:     { n: 'Akıncı',     b: 'ahir',    lv: 1, c: [125, 100, 250],pop: 4,   a: 130, di: 30,  dc: 40,  sp: 10, cr: 80, t: 240,  cls: 'cav', d: 'Hızlı yağmacı, çok ganimet taşır' },
  sipahi:     { n: 'Sipahi',     b: 'ahir',    lv: 5, c: [200, 150, 600],pop: 6,   a: 150, di: 200, dc: 80,  sp: 11, cr: 50, t: 400,  cls: 'cav', d: 'Ağır süvari, hem saldırır hem savunur' },
  mancinik:   { n: 'Mancınık',   b: 'tophane', lv: 1, c: [300, 200, 200],pop: 5,   a: 2,   di: 20,  dc: 50,  sp: 30, cr: 0,  t: 500,  cls: 'inf', d: 'Her 3 mancınık suru 1 seviye düşürür' },
  sancakbeyi: { n: 'Sancakbeyi', b: 'divan',   lv: 1, c: [15000, 18000, 15000], pop: 100, a: 30, di: 100, dc: 50, sp: 35, cr: 0, t: 3000, cls: 'inf', d: 'Kazanılan her saldırıda bağlılığı 20–35 düşürür' },
};
const U_ORDER = ['mizrakli', 'baltaci', 'okcu', 'casus', 'akinci', 'sipahi', 'mancinik', 'sancakbeyi'];
const REC_B = ['kisla', 'ahir', 'tophane', 'divan'];

const BEY_DEFS = [
  { name: 'Karamanoğulları',  color: '#c9503b', aggr: .85 },
  { name: 'Germiyanoğulları', color: '#8a5cc2', aggr: .6 },
  { name: 'Saruhanoğulları',  color: '#d98a2b', aggr: .5 },
  { name: 'Aydınoğulları',    color: '#3a9bd1', aggr: .7 },
  { name: 'Menteşeoğulları',  color: '#2f9e76', aggr: .45 },
  { name: 'Hamidoğulları',    color: '#b8406f', aggr: .55 },
  { name: 'Candaroğulları',   color: '#7f8f3a', aggr: .65 },
];
const PLACE = ['Karapınar', 'Akçakale', 'Yenice', 'Kızılcaköy', 'Sarıçam', 'Ulubey', 'Gökçeören', 'Taşpınar', 'Çamlıbel', 'Kuyucak',
  'Ortaköy', 'Ilıca', 'Dereköy', 'Hisarcık', 'Akbaş', 'Karahisar', 'Beyören', 'Söğütlü', 'Kavaklı', 'Pınarbaşı', 'Kayalı', 'Güzelyurt',
  'Bademli', 'Çınarlı', 'Eskiköy', 'Yassıören', 'Kırkpınar', 'Bozdağ', 'Alaçam', 'Kozluca', 'Değirmendere', 'Tepecik', 'Karaağaç',
  'Kestanelik', 'Yeşilova', 'Göller', 'Akpınar', 'Çayırlı', 'Sultanhanı', 'Kuşadası', 'Oğuzlar', 'Beypazarı', 'Karacasu', 'Elmalı', 'Ardıçlı'];

const WORLD = 25;

// ---------- seviyeye bağlı bina şartları ----------
function reqFor(b, lvl) {
  const r = Object.assign({}, B[b].req);
  const need = (k, x) => { x = Math.min(x, B[k].max); if (x > 0) r[k] = Math.max(r[k] || 0, x); };
  if (b === 'konak') {
    if (lvl >= 3) for (const m of MINES) need(m, lvl - 1);
    if (lvl >= 4) { need('ambar', lvl - 2); need('ciftlik', lvl - 2); }
    if (lvl >= 5) need('sur', lvl - 4);
    if (lvl >= 6) need('kisla', Math.floor(lvl / 3));
    if (lvl >= 12) need('medrese', Math.floor((lvl - 8) / 2));
  } else if (b === 'medrese') need('konak', 3 + lvl);
  else if (lvl >= 5) need('konak', Math.floor(lvl / 2));
  return r;
}

// ---------- klanlar ve sohbet ----------
// Bu sürümde klan üyeleri ve sohbetteki diğer beyler bilgisayar tarafından yönetilir.
// Online sürümde aynı veri yapısı sunucudan gelen gerçek oyuncu mesajlarıyla dolacak.
const CHAT_MAX = 150, CLAN_MAX = 5;
const AI_CLANS = [{ tag: 'KRM', name: 'Konya Divanı', m: ['B0', 'B5'] }, { tag: 'EGE', name: 'Ege Uçları', m: ['B2', 'B3', 'B4'] }];
function clanOf(o) { if (!o) return null; if (o === 'P') return S.clan ? S.clan.tag : null; const b = beyOf(o); return b ? b.clan || null : null; }
function sameClan(a, b) { const ca = clanOf(a), cb = clanOf(b); return !!ca && ca === cb; }
function clanList() {
  const tags = {};
  for (const b of S.beys) if (b.clan) (tags[b.clan] = tags[b.clan] || { tag: b.clan, name: b.clanName, m: [] }).m.push(b.id);
  if (S.clan) tags[S.clan.tag] = { tag: S.clan.tag, name: S.clan.name, m: ['P', ...S.beys.filter(b => b.clan === S.clan.tag).map(b => b.id)], mine: true };
  return Object.values(tags);
}
function ownerPts(o) { return S.vil.filter(v => v.owner === o).reduce((a, v) => a + vPoints(v), 0); }
function say(ch, from, text, t) {
  const a = S.chat[ch]; a.push({ id: ++S.uid, t, from, text });
  if (a.length > CHAT_MAX) a.splice(0, a.length - CHAT_MAX);
}
const pick = a => a[Math.floor(R() * a.length)];
// tohumlu rastgelelik: aynı durumdan başlayan her cihaz aynı sonucu bulur (çok oyunculu için şart)
function R() { let a = (S.rs = (S.rs + 0x6D2B79F5) | 0); let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
// gerçek oyuncular: yerel oyuncu her zaman 'P'; diğer insanlar beys içinde human:true
const beyOf = o => (o && o !== 'P' ? S.beys.find(x => x.id === o) : null);
const isHuman = o => o === 'P' || !!(beyOf(o) || {}).human;
const protectOf = o => (o === 'P' ? S.protectUntil : ((beyOf(o) || {}).human ? beyOf(o).protectUntil || 0 : 0));
function statsOf(o) { if (o === 'P') return S.stats; const b = beyOf(o); if (!b || !b.human) return null; return b.stats || (b.stats = { trained: {}, barbWins: 0, spies: 0 }); }
const lastVillage = o => S.vil.filter(v => v.owner === o).length < 2;
const beyShort = o => (o === 'P' ? S.player.name : ownerName(o).replace('oğulları', ''));
function createClan(name, tag, t) {
  name = String(name || '').trim().slice(0, 24); tag = String(tag || '').trim().toUpperCase().replace(/[^A-ZÇĞİÖŞÜ0-9]/g, '').slice(0, 4);
  if (S.clan) return 'already'; if (name.length < 3) return 'name'; if (tag.length < 2) return 'tag';
  if (S.beys.some(b => b.clan === tag)) return 'taken';
  S.clan = { name, tag, created: t }; S.clanJoinedAi = false;
  if (S.clanChat) S.chat.klan = S.clanChat[tag] = S.clanChat[tag] || [];
  say('genel', 'SYS', S.player.name + ' [' + tag + '] ' + name + ' klanını kurdu.', t);
  say('klan', 'SYS', 'Klan kuruldu. Bağımsız beylere davet göndererek klanını büyüt.', t);
  return 'ok';
}
function inviteBey(id, t) {
  const b = S.beys.find(x => x.id === id);
  if (!S.clan) return 'noclan'; if (!b || b.clan) return 'taken';
  if (1 + S.beys.filter(x => x.clan === S.clan.tag).length >= CLAN_MAX) return 'full';
  if (b.human) return 'human';
  if (b.refusedUntil && t < b.refusedUntil) return 'wait';
  const ratio = (ownerPts('P') + 1) / (ownerPts(b.id) + 1);
  if (ratio >= .55 && R() < .35 + ratio * .4) {
    b.clan = S.clan.tag; b.clanName = S.clan.name;
    say('klan', b.id, pick(['Davetin için sağ ol beyim, sancağımız bir olsun.', 'Kabul ediyorum. Düşmanımız ortak, ganimetimiz ortak!', 'Bu ittifak iki beyliğe de hayırlı olsun.']), t);
    say('genel', 'SYS', b.name + ', [' + S.clan.tag + '] klanına katıldı.', t);
    return 'ok';
  }
  b.refusedUntil = t + 6 * HOUR / S.speed;
  return 'refused';
}
function joinClan(tag, t) {
  if (S.clan) return 'already';
  const mem = S.beys.filter(b => b.clan === tag); if (!mem.length) return 'none';
  if (mem.length + 1 > CLAN_MAX) return 'full';
  const avg = mem.reduce((a, b) => a + ownerPts(b.id), 0) / mem.length;
  if (!mem.some(b => b.human) && ownerPts('P') < avg * .5) return 'weak';
  S.clan = { name: mem[0].clanName, tag, created: t }; S.clanJoinedAi = true;
  if (S.clanChat) S.chat.klan = S.clanChat[tag] = S.clanChat[tag] || [];
  const greet = mem.find(b => !b.human);
  if (greet) say('klan', greet.id, 'Hoş geldin ' + S.player.name + '! Kışlanı büyüt, sınırlarımızı birlikte koruyalım.', t);
  say('genel', 'SYS', S.player.name + ', [' + tag + '] klanına katıldı.', t);
  return 'ok';
}
function leaveClan(t) {
  if (!S.clan) return 'none';
  const tag = S.clan.tag, mine = S.beys.filter(b => b.clan === tag);
  const own = !S.clanJoinedAi;
  if (own) for (const b of mine) if (!b.human) { b.clan = null; b.clanName = null; }
  say('genel', 'SYS', S.player.name + ', [' + tag + '] klanından ayrıldı.', t);
  S.clan = null; S.chat.klan = []; return 'ok';
}
const CHAT_GENEL = [
  '{v} tarafında bol ganimetli terk edilmiş köyler var, akıncılar hazır olsun.', 'Bu sabah hasat iyi geçti, ambarlar dolu.',
  'Kim ittifak arıyor? Güçlü beyler bize yazsın.', 'Karamanoğulları yine sınırda dolaşıyor, dikkatli olun.',
  'Sancakbeyimiz yetişti, yakında yeni bir köy bizim olacak.', 'Demir fiyatı yine arttı, madenciler zengin oldu.',
  'Surlarını yükseltmeyen beyler çok ağlar, benden söylemesi.', 'Selam olsun uç beylerine!',
  'Gece akın yapan akıncıları gördüm, köyünüzü yalnız bırakmayın.', 'Kervan yolları güvenli mi, bilen var mı?',
  'Medresede Nalbantlık araştırıyoruz, atlılar artık rüzgâr gibi.', 'Taş ocağım tükenmez, isteyen takas edelim.',
];
const CHAT_KLAN = [
  'Kışlayı büyüttüm, yarın akına çıkıyorum.', 'Okçu sayımız yetersiz, herkes biraz okçu eğitsin.',
  'Doğudaki terk edilmiş köyleri yağmalamaya ne dersiniz?', 'Surları 10. seviyeye çıkardım, gelsinler bakalım.',
  'Birimiz saldırıya uğrarsa hemen destek yollayalım.', 'Medresemde Zırh Yapımı bitmek üzere.',
  'Bu hafta sıralamada ilk üçe gireriz inşallah.', 'Yeni Divan kuruldu, Sancakbeyi yetiştiriyorum.',
];
const aiBeys = () => S.beys.filter(b => !b.human);
function aiChat(t, fresh) {
  if (R() < .55) { const b = pick(aiBeys()); const vv = pick(S.vil.filter(v => v.owner === null)) || S.vil[0]; const txt = pick(CHAT_GENEL).replace('{v}', vv.name); if (fresh) say('genel', b.id, txt, t); }
  const allies = S.clan ? S.beys.filter(b => !b.human && b.clan === S.clan.tag) : [];
  if (allies.length && R() < .45) { const b = pick(allies), txt = pick(CHAT_KLAN); if (fresh && !S.mp) say('klan', b.id, txt, t); }
}
function allySupport(target, attacker, t) {
  const tag = clanOf(target.owner); if (!tag || !isHuman(target.owner)) return;
  const myClan = S.clan && S.clan.tag === tag && !S.mp;
  for (const b of S.beys.filter(x => !x.human && x.clan === tag)) {
    if (R() > .6) continue;
    const src = S.vil.filter(v => v.owner === b.id).sort((a, c) => dist(a, target) - dist(c, target))[0]; if (!src) continue;
    const units = {}; let n = 0;
    for (const u of ['mizrakli', 'okcu']) { const k = Math.floor((src.units[u] || 0) * .3); if (k > 0) { units[u] = k; src.units[u] -= k; n += k; } }
    if (!n) continue;
    const dur = travelTime(src, target, units);
    S.moves.push({ id: ++S.uid, type: 'support', owner: b.id, from: src.id, to: target.id, units, loot: [0, 0, 0], depart: t, arrive: t + dur });
    if (myClan) say('klan', b.id, target.name + ' köyüne ' + n + ' asker destek gönderdim, yolda.', t);
  }
  const al = S.beys.filter(x => !x.human && x.clan === tag);
  if (al.length && myClan) say('klan', pick(al).id, 'Dikkat! ' + ownerName(attacker) + ' ' + target.name + ' köyüne ordu gönderdi.', t);
}
const fmtN = n => Math.floor(n).toLocaleString('tr-TR');
function allyResources(t) {
  const al = S.clan ? S.beys.filter(b => !b.human && b.clan === S.clan.tag) : []; if (!al.length) return;
  const b = pick(al), src = S.vil.filter(v => v.owner === b.id)[0], dst = S.vil.find(v => v.id === S.cur && v.owner === 'P') || S.vil.find(v => v.owner === 'P');
  if (!src || !dst) return;
  syncRes(src, t);
  const res = src.res.map(x => Math.floor(Math.min(x * .25, 800 + R() * 700)));
  if (res.every(x => x < 50)) { say('klan', b.id, 'Ambarım boş beyim, şu an gönderemem.', t); return; }
  for (let i = 0; i < 3; i++) src.res[i] -= res[i];
  S.moves.push({ id: ++S.uid, type: 'trade', owner: b.id, from: src.id, to: dst.id, units: {}, res, merchants: Math.ceil((res[0] + res[1] + res[2]) / CARRY), loot: [0, 0, 0], depart: t, arrive: t + tradeTime(src, dst) });
  say('klan', b.id, dst.name + ' köyüne kervan yolladım: ' + res.map(fmtN).join(' / ') + '. Yolda!', t);
}
function playerSay(ch, text, t) {
  text = String(text || '').trim().slice(0, 200); if (!text) return 'empty';
  if (ch === 'klan' && !S.clan) return 'noclan';
  say(ch, 'P', text, t);
  const low = text.toLocaleLowerCase('tr');
  const pool = ch === 'klan' ? S.beys.filter(b => !b.human && S.clan && b.clan === S.clan.tag) : aiBeys();
  if (!pool.length || (S.mp && ch === 'klan')) return 'ok';
  const who = pick(pool), delay = (4 + R() * 10) * 1000;
  let reply = null;
  if (/selam|merhaba|sa\b|slm/.test(low)) reply = pick(['Aleykümselam ' + S.player.name + '!', 'Selam beyim, hoş geldin.', 'Aleykümselam, bereketli günler.']);
  else if (ch === 'klan' && /kaynak|kereste|taş|demir|maden|kervan|erzak/.test(low)) { reply = 'Ambarıma bakıp kervan hazırlıyorum.'; S.pendingRes = !S.mp; }
  else if (ch === 'klan' && /yardım|destek|imdat|saldır/.test(low)) { reply = 'Hemen asker yolluyorum beyim, dayan!'; S.pendingSupport = !S.mp; }
  else if (/ittifak|klan/.test(low) && ch === 'genel') reply = 'Klanın güçlüyse konuşuruz, sıralamaya bakarız.';
  else if (R() < (ch === 'klan' ? .8 : .35)) reply = pick(['Doğru söylersin.', 'Anlaşıldı beyim.', 'Hele bir bakalım.', 'Ben de öyle düşünüyorum.', 'Bunu Divan’da konuşalım.', 'İyi fikir, hazırlanalım.']);
  if (reply) S.chatq.push({ t: t + delay, ch, from: who.id, text: reply });
  return 'ok';
}

// ---------- teknoloji ağacı ----------
// e: seviye başına etki. Araştırmalar oyuncuya aittir (bütün köylerine uygulanır).
const TECH = {
  ocak:     { n: 'Ocak Teknikleri',   d: 'Kaynak üretimi seviye başına +%6',          max: 5, c: [400, 350, 300],  t: 900,  e: .06, req: { medrese: 1 } },
  mimari:   { n: 'Mimarî',            d: 'İnşaat süresi seviye başına −%5',           max: 5, c: [450, 500, 300],  t: 1000, e: .05, req: { medrese: 1 } },
  depo:     { n: 'Depolama',          d: 'Ambar sınırı seviye başına +%8',            max: 5, c: [500, 400, 300],  t: 1100, e: .08, req: { medrese: 2, ocak: 1 } },
  talim:    { n: 'Talim Usulü',       d: 'Asker eğitim süresi seviye başına −%6',     max: 5, c: [500, 400, 550],  t: 1200, e: .06, req: { medrese: 2 } },
  nal:      { n: 'Nalbantlık',        d: 'Askerlerin yol hızı seviye başına +%6',     max: 5, c: [600, 500, 700],  t: 1400, e: .06, req: { medrese: 3, talim: 1 } },
  kervan:   { n: 'Kervancılık',       d: 'Taşınan ganimet seviye başına +%10',        max: 5, c: [700, 600, 500],  t: 1400, e: .10, req: { medrese: 3, depo: 1 } },
  demirci:  { n: 'Demircilik',        d: 'Saldırı gücü seviye başına +%5',            max: 5, c: [700, 600, 900],  t: 1800, e: .05, req: { medrese: 4, talim: 2 } },
  zirh:     { n: 'Zırh Yapımı',       d: 'Asker savunması seviye başına +%5',         max: 5, c: [800, 700, 900],  t: 1800, e: .05, req: { medrese: 4, demirci: 1 } },
  burc:     { n: 'Burç Mühendisliği', d: 'Sur savunma bonusu seviye başına +%10',     max: 5, c: [600, 1100, 500], t: 2000, e: .10, req: { medrese: 5, mimari: 2 } },
  sancak:   { n: 'Sancak Töresi',     d: 'Sancakbeyi bağlılığı seviye başına 3 fazla düşürür', max: 3, c: [3000, 3000, 3000], t: 4000, e: 3, req: { medrese: 8, zirh: 2, nal: 2 } },
};
const TECH_ORDER = ['ocak', 'mimari', 'depo', 'talim', 'nal', 'kervan', 'demirci', 'zirh', 'burc', 'sancak'];
const techCost = (id, l) => TECH[id].c.map(x => Math.round(x * Math.pow(1.45, l - 1)));
const techTime = (id, l, med) => TECH[id].t * 1000 * Math.pow(1.35, l - 1) * Math.pow(.95, Math.max(0, med - 1)) / S.speed;
const TL = (o, id) => { if (o === 'P') return S.tech ? (S.tech[id] || 0) : 0; if (!o) return 0; const b = beyOf(o); return b && b.human && b.tech ? (b.tech[id] || 0) : 0; };
const TX = (o, id) => TL(o, id) * TECH[id].e;

// ---------- formüller ----------
const bCost = (b, l) => B[b].c.map(x => Math.round(x * Math.pow(B[b].f, l - 1)));
const prodL = l => (l <= 0 ? 5 : 30 * Math.pow(1.163, l - 1));
const capL = l => Math.round(1000 * Math.pow(1.2294, Math.max(0, l - 1)));
const popL = l => Math.round(240 * Math.pow(1.172, Math.max(0, l - 1)));
function vPoints(v) { let p = 0; for (const b of B_ORDER) for (let l = 1; l <= v.b[b]; l++) p += Math.round(B_PTS[b] * Math.pow(1.2, l - 1)); return p; }
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- durum ----------
let S = null;
let log = () => {};          // arayüz bildirimleri için kanca
const hooks = { notify: (kind, msg) => log(kind, msg) };

const bTime = (b, l, k, o) => B[b].t * 1000 * Math.pow(1.2, l - 1) * Math.pow(0.95, Math.max(0, k - 1)) * (1 - TX(o, 'mimari')) / S.speed;
const uTime = (u, l, o) => U[u].t * 1000 * Math.pow(0.94, Math.max(0, l - 1)) * (1 - TX(o, 'talim')) / S.speed;
const rateH = (v, i) => prodL(v.b[MINES[i]]) * S.speed * (1 + TX(v.owner, 'ocak'));       // saatlik
const cap = v => Math.round(capL(v.b.ambar) * (1 + TX(v.owner, 'depo')));
const popMax = v => popL(v.b.ciftlik);

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function mkVillage(id, x, y, name, owner, b, units, res, t) {
  const bb = {}; for (const k of B_ORDER) bb[k] = 0; Object.assign(bb, b);
  return { id, x, y, name, owner, b: bb, res: res.slice(), rt: t, loy: 100, lt: t, units: Object.assign({}, units),
    bq: [], rq: { kisla: [], ahir: [], tophane: [], divan: [] }, base: null };
}

function newGame(opts) {
  const t = opts.now;
  const seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 1e9);
  const rnd = mulberry32(seed);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  S = { ver: 1, rs: seed ^ 0x5bd1e995, mp: !!opts.mp, market: [], tech: {}, techq: null, clan: null, chat: { genel: [], klan: [] }, chatq: [], chatSeen: { genel: 0, klan: 0 }, nextChat: t + 30000, seed, speed: opts.speed, created: t, lastT: t, protectUntil: t + 3 * 24 * HOUR / opts.speed,
    nextAi: t + HOUR / opts.speed, uid: 100, player: { name: opts.name || 'Kızılırmak Beyliği', color: '#e3b341' },
    beys: [], vil: [], moves: [], reports: [], quests: { claimed: [] },
    stats: { trained: {}, barbWins: 0, spies: 0 }, cur: 0, over: false };
  const names = PLACE.slice().sort(() => rnd() - .5);
  const taken = [];
  const free = (x, y, min) => x >= 0 && y >= 0 && x < WORLD && y < WORLD && taken.every(p => Math.hypot(p.x - x, p.y - y) >= min);
  const place = (test, min) => { for (let i = 0; i < 4000; i++) { const x = ri(0, WORLD - 1), y = ri(0, WORLD - 1); if (free(x, y, min) && test(x, y)) { taken.push({ x, y }); return { x, y }; } } return null; };

  const pp = place((x, y) => Math.abs(x - 12) <= 2 && Math.abs(y - 12) <= 2, 0);
  const pv = mkVillage(0, pp.x, pp.y, opts.village || 'Kızılcahamam', 'P',
    { konak: 1, kereste: 1, tas: 1, demir: 1, ambar: 1, ciftlik: 1 }, {}, [500, 500, 400], t);
  S.vil.push(pv);
  S.test = opts.test || null;
  if (opts.test === 'full') { for (const m of MINES) pv.b[m] = B[m].max; pv.b.ambar = B.ambar.max; pv.b.ciftlik = 20; }
  if (opts.test === 'max') { for (const b of B_ORDER) pv.b[b] = B[b].max; }
  if (opts.test) pv.res = [1e9, 1e9, 1e9];   // syncRes ambar sınırına indirir

  BEY_DEFS.forEach((d, i) => {
    const ac = AI_CLANS.find(c => c.m.includes('B' + i));
    S.beys.push({ id: 'B' + i, name: d.name, color: d.color, aggr: d.aggr, lastHitP: 0, clan: ac ? ac.tag : null, clanName: ac ? ac.name : null });
    const p = place((x, y) => { const dd = Math.hypot(x - pp.x, y - pp.y); return dd >= 5 && dd <= 11; }, 4);
    if (!p) return;
    const v = mkVillage(S.vil.length, p.x, p.y, d.name.replace('oğulları', '') + ' Hisarı', 'B' + i,
      { konak: 3, kereste: ri(3, 4), tas: ri(3, 4), demir: 3, ambar: 3, ciftlik: 3, kisla: 2, sur: 1 },
      { mizrakli: 20, baltaci: 10 }, [800, 800, 700], t);
    S.vil.push(v);
  });

  let n = 0;
  while (n < 34) {
    const p = place(() => true, 1.9); if (!p) break;
    const dd = Math.hypot(p.x - pp.x, p.y - pp.y), far = Math.min(1, dd / 12);
    const v = mkVillage(S.vil.length, p.x, p.y, names[n % names.length], null,
      { konak: ri(1, 3), kereste: ri(1, 3 + Math.round(far * 4)), tas: ri(1, 3 + Math.round(far * 4)), demir: ri(1, 2 + Math.round(far * 4)),
        ambar: ri(2, 3 + Math.round(far * 3)), ciftlik: ri(2, 4), sur: ri(0, Math.round(far * 3)) },
      {}, [ri(200, 900), ri(200, 900), ri(150, 700)], t);
    v.base = { mizrakli: ri(2, 6 + Math.round(far * 20)), okcu: ri(0, Math.round(far * 10)) };
    Object.assign(v.units, v.base);
    S.vil.push(v); n++;
  }
  // köy adları tekil olsun
  S.vil.forEach((v, i) => { if (v.owner === null) v.name = names[(i + 3) % names.length]; });
  aiMarket(t); aiMarket(t);
  return S;
}

// ---------- tembel (lazy) hesaplama ----------
function syncRes(v, t) {
  const c = cap(v);
  for (let i = 0; i < 3; i++) if (v.res[i] > c * 50) v.res[i] = c;
  const dt = t - v.rt; if (dt <= 0) return;
  for (let i = 0; i < 3; i++) if (v.res[i] < c) v.res[i] = Math.min(c, v.res[i] + rateH(v, i) * dt / HOUR);
  v.rt = t;
}
function syncLoy(v, t) { const dt = t - v.lt; if (dt > 0) { v.loy = Math.min(100, v.loy + dt * S.speed / HOUR); v.lt = t; } }
const afford = (v, c) => c.every((x, i) => v.res[i] >= x);
const pay = (v, c, k = 1) => { for (let i = 0; i < 3; i++) v.res[i] -= c[i] * k; };
const vil = id => S.vil[id];
const unitSum = u => Object.values(u).reduce((a, b) => a + (b || 0), 0);

function popUsed(v) {
  let p = 0;
  for (const b of B_ORDER) p += B[b].pop * v.b[b];
  for (const q of v.bq) p += B[q.b].pop;
  for (const [u, n] of Object.entries(v.units)) p += U[u].pop * n;
  for (const m of S.moves) if (m.from === v.id && m.owner === v.owner && m.type !== 'support') for (const [u, n] of Object.entries(m.units)) p += U[u].pop * n;
  for (const k of REC_B) for (const q of v.rq[k]) p += U[q.u].pop * q.n;
  return p;
}
const popFree = v => popMax(v) - popUsed(v);
const effLevel = (v, b) => v.b[b] + v.bq.filter(q => q.b === b).length;
const reqMet = (v, req) => Object.entries(req).every(([k, l]) => v.b[k] >= l);

// ---------- oyuncu (ve yapay zekâ) hamleleri ----------
// Her hamle hata kodu ya da 'ok' döner. Online sürümde bu fonksiyonlar sunucuda çalışır.
function medreseMax() { return Math.max(0, ...S.vil.filter(v => v.owner === 'P').map(v => v.b.medrese || 0)); }
function canResearch(v, id) {
  const T = TECH[id], l = (S.tech[id] || 0) + 1;
  if (l > T.max) return { ok: false, why: 'max' };
  const med = v.b.medrese || 0;
  for (const [k, x] of Object.entries(T.req)) { if (k === 'medrese' ? med < x : (S.tech[k] || 0) < x) return { ok: false, why: 'req', lvl: l }; }
  if (S.techq) return { ok: false, why: 'busy', lvl: l };
  const c = techCost(id, l);
  if (c.some(x => x > cap(v))) return { ok: false, why: 'cap', c, lvl: l };
  if (!afford(v, c)) return { ok: false, why: 'res', c, lvl: l };
  return { ok: true, c, lvl: l };
}
function research(v, id, t) {
  syncRes(v, t);
  const r = canResearch(v, id); if (!r.ok) return r.why;
  pay(v, r.c);
  S.techq = { id, lvl: r.lvl, vil: v.id, start: t, done: t + techTime(id, r.lvl, v.b.medrese) };
  return 'ok';
}
// eski kayıtları yeni sürüme taşır
function migrate(st) {
  if (!st.market) st.market = [];
  if (!st.tech) st.tech = {};
  if (!st.chat) { st.chat = { genel: [], klan: [] }; st.chatq = []; st.chatSeen = { genel: 0, klan: 0 }; st.nextChat = st.lastT + 30000; st.clan = null;
    st.beys.forEach((b, i) => { const ac = AI_CLANS.find(c => c.m.includes('B' + i)); b.clan = ac ? ac.tag : null; b.clanName = ac ? ac.name : null; }); }
  if (st.techq === undefined) st.techq = null;
  if (st.rs == null) st.rs = (st.seed || 1) ^ 0x5bd1e995;
  for (const v of st.vil) { if (v.b.medrese == null) v.b.medrese = 0; if (v.b.kervansaray == null) v.b.kervansaray = 0; }
  return st;
}
function canUpgrade(v, b) {
  const lvl = effLevel(v, b) + 1;
  if (lvl > B[b].max) return { ok: false, why: 'max' };
  if (!reqMet(v, reqFor(b, lvl))) return { ok: false, why: 'req', lvl };
  if (v.bq.length >= 2) return { ok: false, why: 'queue' };
  const c = bCost(b, lvl);
  if (c.some(x => x > cap(v))) return { ok: false, why: 'cap', c, lvl };
  if (B[b].pop > popFree(v)) return { ok: false, why: 'pop', c, lvl };
  if (!afford(v, c)) return { ok: false, why: 'res', c, lvl };
  return { ok: true, c, lvl };
}
function upgrade(v, b, t) {
  syncRes(v, t);
  const r = canUpgrade(v, b); if (!r.ok) return r.why;
  pay(v, r.c);
  const start = v.bq.length ? v.bq[v.bq.length - 1].done : t;
  v.bq.push({ b, lvl: r.lvl, start, done: start + bTime(b, r.lvl, v.b.konak, v.owner), c: r.c });
  return 'ok';
}
function cancelLast(v, t) {
  const q = v.bq[v.bq.length - 1]; if (!q) return 'none';
  syncRes(v, t);
  const c = cap(v);
  for (let i = 0; i < 3; i++) v.res[i] = Math.min(c, v.res[i] + q.c[i] * 0.9);
  v.bq.pop(); return 'ok';
}
function unitUnlocked(v, u) { return v.b[U[u].b] >= U[u].lv; }
function maxTrain(v, u) {
  if (!unitUnlocked(v, u)) return 0;
  const c = U[u].c; let n = Infinity;
  for (let i = 0; i < 3; i++) if (c[i]) n = Math.min(n, Math.floor(v.res[i] / c[i]));
  n = Math.min(n, Math.floor(popFree(v) / U[u].pop));
  if (u === 'sancakbeyi') n = Math.min(n, 1);
  return Math.max(0, n);
}
function train(v, u, n, t) {
  syncRes(v, t);
  n = Math.floor(n); if (!(n > 0)) return 'zero';
  if (!unitUnlocked(v, u)) return 'req';
  if (n > maxTrain(v, u)) return afford(v, U[u].c.map(x => x * n)) ? 'pop' : 'res';
  pay(v, U[u].c, n);
  const q = v.rq[U[u].b], each = uTime(u, v.b[U[u].b], v.owner);
  q.push({ u, n, each, next: q.length ? null : t + each, total: n });
  return 'ok';
}
function travelTime(from, to, units) {
  let sp = 0; for (const [u, n] of Object.entries(units)) if (n > 0) sp = Math.max(sp, U[u].sp);
  return dist(from, to) * sp * 60000 / S.speed / (1 + TX(from.owner, 'nal'));
}
function send(from, to, units, type, t) {
  const clean = {};
  for (const [u, n] of Object.entries(units)) { const k = Math.floor(n || 0); if (k > 0) { if ((from.units[u] || 0) < k) return 'units'; clean[u] = k; } }
  if (!unitSum(clean)) return 'empty';
  if (from.id === to.id) return 'self';
  if (type === 'spy' && Object.keys(clean).some(u => u !== 'casus')) return 'spyonly';
  if (type === 'support' && to.owner !== from.owner) return 'notown';
  if (type === 'attack' && to.owner === from.owner) return 'own';
  if (type === 'attack' && sameClan(to.owner, from.owner)) return 'ally';
  if (isHuman(to.owner) && from.owner !== to.owner && t < protectOf(to.owner)) return 'protected';
  for (const [u, k] of Object.entries(clean)) from.units[u] -= k;
  const dur = travelTime(from, to, clean);
  S.moves.push({ id: ++S.uid, type, owner: from.owner, from: from.id, to: to.id, units: clean, loot: [0, 0, 0], depart: t, arrive: t + dur });
  if (type === 'spy' && statsOf(from.owner)) statsOf(from.owner).spies++;
  return 'ok';
}

// ---------- savaş ----------
function battle(m, t) {
  const dv = vil(m.to), av = vil(m.from), att = Object.assign({}, m.units);
  syncRes(dv, t); syncLoy(dv, t);
  const rep = { id: ++S.uid, t, type: m.type, from: m.from, to: m.to, attOwner: m.owner, defOwner: dv.owner,
    attName: av.name, defName: dv.name, aUnits: Object.assign({}, att), aLost: {}, dUnits: Object.assign({}, dv.units), dLost: {},
    win: false, luck: 0, loot: [0, 0, 0], wall: [dv.b.sur, dv.b.sur], loy: null, spy: null, conquered: false, read: false };

  // çaşıtlar
  const as = att.casus || 0, ds = dv.units.casus || 0; let spyOk = false;
  if (as > 0) {
    if (as > ds) { spyOk = true; const lost = Math.round(as * Math.pow(ds / as, 1.5)); if (lost) rep.aLost.casus = lost; att.casus = as - lost; }
    else { rep.aLost.casus = as; att.casus = 0; }
  }
  if (spyOk) rep.spy = { res: dv.res.map(Math.floor), b: Object.assign({}, dv.b), units: Object.assign({}, dv.units), loy: Math.floor(dv.loy) };

  if (m.type === 'spy') {
    rep.win = spyOk;
    if (!spyOk) rep.dUnits = null;
    finishBattle(m, rep, att, dv, t);
    return;
  }

  let Ai = 0, Ac = 0;
  for (const [u, n] of Object.entries(att)) { if (U[u].cls === 'cav') Ac += U[u].a * n; else if (U[u].cls === 'inf') Ai += U[u].a * n; }
  const A0 = Ai + Ac;
  const rams = att.mancinik || 0;
  const wallEff = Math.max(0, dv.b.sur - Math.floor(rams / 3));
  let Di = 0, Dc = 0;
  for (const [u, n] of Object.entries(dv.units)) { if (U[u].cls === 'spy') continue; Di += U[u].di * n; Dc += U[u].dc * n; }
  for (const [u, n] of Object.entries(dv.guest || {})) { Di += U[u].di * n; Dc += U[u].dc * n; }
  if (dv.guest && unitSum(dv.guest)) rep.guest = Object.assign({}, dv.guest);
  const Dmix = A0 > 0 ? (Di * Ai + Dc * Ac) / A0 : Di;
  const D = (Dmix * (1 + TX(dv.owner, 'zirh')) + 20 + 40 * wallEff) * Math.pow(1.037, wallEff * (1 + TX(dv.owner, 'burc')));
  const luck = R() * 0.3 - 0.15; rep.luck = luck;
  const A = A0 * (1 + luck) * (1 + TX(m.owner, 'demirci'));

  if (A0 > 0 && A > D) {
    rep.win = true;
    const r = Math.pow(D / A, 1.5);
    for (const [u, n] of Object.entries(att)) { if (u === 'casus') continue; const lost = Math.round(n * r); if (lost) { rep.aLost[u] = (rep.aLost[u] || 0) + lost; att[u] = n - lost; } }
    for (const [u, n] of Object.entries(dv.units)) { if (u === 'casus' || !n) continue; rep.dLost[u] = n; dv.units[u] = 0; }
    dv.guest = {};
    if (rams > 0) { dv.b.sur = wallEff; rep.wall = [rep.wall[0], wallEff]; }
    // ganimet
    let capy = 0; for (const [u, n] of Object.entries(att)) capy += U[u].cr * n * (1 + TX(m.owner, 'kervan'));
    const avail = dv.res.map(Math.floor), loot = [0, 0, 0]; let left = capy;
    for (let pass = 0; pass < 4 && left >= 1; pass++) {
      const open = [0, 1, 2].filter(i => avail[i] - loot[i] >= 1); if (!open.length) break;
      const each = left / open.length; let used = 0;
      for (const i of open) { const k = Math.min(each, avail[i] - loot[i]); loot[i] += k; used += k; }
      left -= used;
    }
    for (let i = 0; i < 3; i++) { loot[i] = Math.floor(loot[i]); dv.res[i] -= loot[i]; }
    rep.loot = loot; m.loot = loot;
    if (dv.owner === null && statsOf(m.owner)) statsOf(m.owner).barbWins++;
    // fetih
    if ((att.sancakbeyi || 0) > 0 && dv.owner !== m.owner) {
      const before = dv.loy; let drop = 0;
      for (let i = 0; i < att.sancakbeyi; i++) drop += 20 + R() * 15 + TX(m.owner, 'sancak');
      dv.loy = Math.max(0, dv.loy - drop); rep.loy = [Math.floor(before), Math.floor(dv.loy)];
      if (dv.loy <= 0 && isHuman(dv.owner) && lastVillage(dv.owner)) { dv.loy = 1; rep.loy[1] = 1; }   // oyuncunun son köyü fethedilmez
      if (dv.loy <= 0) {
        const prev = dv.owner;
        att.sancakbeyi--;
        dv.owner = m.owner; dv.loy = 25; dv.lt = t; dv.base = null;
        dv.units = {}; for (const [u, n] of Object.entries(att)) if (n > 0) dv.units[u] = n;
        dv.bq = []; for (const k of REC_B) dv.rq[k] = [];
        rep.conquered = true;
        say('genel', 'SYS', ownerName(m.owner) + ', ' + dv.name + ' köyünü fethetti.', t);
        hooks.notify(m.owner === 'P' ? 'good' : (prev === 'P' ? 'bad' : 'info'),
          m.owner === 'P' ? dv.name + ' artık senin!' : (prev === 'P' ? dv.name + ' düştü!' : ownerName(m.owner) + ', ' + dv.name + ' köyünü fethetti'));
        if (prev === 'P' && !S.mp) { if (S.cur === dv.id) { const mine = S.vil.find(x => x.owner === 'P'); if (mine) S.cur = mine.id; } if (!S.vil.some(x => x.owner === 'P')) S.over = true; }
        pushReport(rep);
        return;
      }
    }
  } else {
    rep.win = false;
    for (const [u, n] of Object.entries(att)) { if (u === 'casus' || !n) continue; rep.aLost[u] = (rep.aLost[u] || 0) + n; att[u] = 0; }
    const r = A0 > 0 ? Math.pow(A / D, 1.5) : 0;
    for (const [u, n] of Object.entries(dv.units)) { if (u === 'casus' || !n) continue; const lost = Math.round(n * r); if (lost) { rep.dLost[u] = lost; dv.units[u] = n - lost; } }
    if (dv.guest) for (const u in dv.guest) dv.guest[u] -= Math.round(dv.guest[u] * r);
    const survivors = unitSum(att);
    if (!survivors && isHuman(m.owner) && !spyOk) rep.dUnits = null;   // kimse dönmedi, rakibi göremedik
  }
  finishBattle(m, rep, att, dv, t);
}
function finishBattle(m, rep, att, dv, t) {
  const back = {}; for (const [u, n] of Object.entries(att)) if (n > 0) back[u] = n;
  if (unitSum(back)) {
    const from = vil(m.from);
    S.moves.push({ id: ++S.uid, type: 'return', owner: m.owner, from: m.from, to: m.from, via: m.to, units: back, loot: rep.loot.slice(), depart: t, arrive: t + travelTime(dv, from, back) });
  }
  pushReport(rep);
}
function pushReport(rep) {
  const lim = S.mp ? 40 : 80;
  for (const o of new Set([rep.attOwner, rep.defOwner])) {
    const b = beyOf(o); if (!b || !b.human) continue;
    b.reports = b.reports || []; b.reports.unshift(JSON.parse(JSON.stringify(rep))); if (b.reports.length > lim) b.reports.length = lim;
  }
  if (rep.attOwner !== 'P' && rep.defOwner !== 'P') return;
  S.reports.unshift(rep);
  if (S.reports.length > lim) S.reports.length = lim;
  if (rep.defOwner === 'P' && rep.attOwner !== 'P') hooks.notify(rep.win ? 'bad' : 'good', rep.defName + (rep.win ? ' yağmalandı' : ' saldırıyı püskürttü'));
  else if (rep.attOwner === 'P') hooks.notify(rep.win ? 'good' : 'bad', (rep.type === 'spy' ? 'Keşif: ' : 'Saldırı: ') + rep.defName + (rep.win ? ' — başarılı' : ' — başarısız'));
}
// ---------- kervan: kaynak gönderme ----------
const CARRY = 1000, TRADE_SP = 12;
function merchantsTotal(v) { return v.b.kervansaray || 0; }
function merchantsBusy(v) { let n = 0; for (const m of S.moves) if ((m.type === 'trade' || m.type === 'tradeback') && m.from === v.id) n += m.merchants || 0; for (const o of (S.market || [])) if (o.vil === v.id) n += o.merchants || 0; return n; }
function merchantsFree(v) { return Math.max(0, merchantsTotal(v) - merchantsBusy(v)); }
function tradeTime(from, to) { return dist(from, to) * TRADE_SP * 60000 / S.speed; }
function sendRes(from, to, res, t) {
  syncRes(from, t);
  res = res.map(x => Math.max(0, Math.floor(x || 0)));
  const tot = res[0] + res[1] + res[2];
  if (!tot) return 'empty';
  if (from.id === to.id) return 'self';
  if (!merchantsTotal(from)) return 'nobuild';
  if (res.some((x, i) => x > from.res[i])) return 'res';
  const need = Math.ceil(tot / CARRY);
  if (need > merchantsFree(from)) return 'merchants';
  pay(from, res);
  S.moves.push({ id: ++S.uid, type: 'trade', owner: from.owner, from: from.id, to: to.id, units: {}, res, merchants: need, loot: [0, 0, 0], depart: t, arrive: t + tradeTime(from, to) });
  return 'ok';
}
// ---------- pazar: takas teklifleri ----------
// Teklif: { id, owner, vil, give:[i,n], want:[i,n], t, exp, merchants }
function tradeMove(from, to, res, owner, t, merchants, deal) {
  S.moves.push({ id: ++S.uid, type: 'trade', owner, from: from.id, to: to.id, units: {}, res, merchants: merchants != null ? merchants : Math.ceil((res[0] + res[1] + res[2]) / CARRY), deal: !!deal, loot: [0, 0, 0], depart: t, arrive: t + tradeTime(from, to) });
}
const resArr = (i, n) => { const r = [0, 0, 0]; r[i] = n; return r; };
function createOffer(v, gi, gn, wi, wn, t) {
  syncRes(v, t); gn = Math.floor(gn); wn = Math.floor(wn);
  if (gi === wi) return 'same'; if (!(gn > 0 && wn > 0)) return 'empty';
  if (wn > gn * 3 || gn > wn * 3) return 'ratio';
  if (!merchantsTotal(v)) return 'nobuild';
  if (v.res[gi] < gn) return 'res';
  const need = Math.ceil(gn / CARRY); if (need > merchantsFree(v)) return 'merchants';
  if (S.market.filter(o => o.owner === v.owner).length >= 6) return 'limit';
  v.res[gi] -= gn;
  S.market.push({ id: ++S.uid, owner: v.owner, vil: v.id, give: [gi, gn], want: [wi, wn], t, exp: t + 48 * HOUR / S.speed, merchants: need });
  return 'ok';
}
function cancelOffer(id, t) {
  const o = S.market.find(x => x.id === id); if (!o) return 'none';
  const v = vil(o.vil); syncRes(v, t); v.res[o.give[0]] = Math.min(Math.max(cap(v), v.res[o.give[0]]), v.res[o.give[0]] + o.give[1]);
  S.market.splice(S.market.indexOf(o), 1); return 'ok';
}
function acceptOffer(v, id, t) {
  const o = S.market.find(x => x.id === id); if (!o) return 'gone';
  if (o.owner === v.owner) return 'own';
  syncRes(v, t);
  const [wi, wn] = o.want;
  if (!merchantsTotal(v)) return 'nobuild';
  if (v.res[wi] < wn) return 'res';
  const need = Math.ceil(wn / CARRY); if (need > merchantsFree(v)) return 'merchants';
  const ov = vil(o.vil);
  S.market.splice(S.market.indexOf(o), 1);
  v.res[wi] -= wn;
  tradeMove(v, ov, resArr(wi, wn), v.owner, t, need, true);
  tradeMove(ov, v, resArr(o.give[0], o.give[1]), o.owner, t, o.merchants, true);
  if (o.owner === 'P') hooks.notify('good', 'Takas teklifin kabul edildi: ' + ownerName(v.owner));
  return 'ok';
}
function aiMarket(t) {
  S.market = S.market.filter(o => { if (t < o.exp) return true; const v = vil(o.vil); if (v.owner === o.owner) v.res[o.give[0]] += o.give[1]; if (o.owner === 'P') hooks.notify('info', 'Pazardaki teklifinin süresi doldu, kaynaklar geri döndü'); return false; });
  for (const b of aiBeys()) {
    const v = S.vil.find(x => x.owner === b.id); if (!v) continue;
    syncRes(v, t);
    const r = v.res, hi = r.indexOf(Math.max(...r)), lo = r.indexOf(Math.min(...r));
    // oyuncunun tekliflerini değerlendir
    for (const o of S.market.filter(x => isHuman(x.owner))) {
      const [wi, wn] = o.want, [gi, gn] = o.give, fair = wn / gn;
      if (r[wi] > wn * 1.5 && r[wi] > r[gi] && fair <= 1.25 && R() < (fair <= 1 ? .55 : .3)) {
        r[wi] -= wn; const pv = vil(o.vil);
        S.market.splice(S.market.indexOf(o), 1);
        tradeMove(pv, v, resArr(gi, gn), o.owner, t, o.merchants, true);
        tradeMove(v, pv, resArr(wi, wn), b.id, t, null, true);
        if (o.owner === 'P') hooks.notify('good', b.name + ' takas teklifini kabul etti');
        say('genel', b.id, pick(['Pazardaki teklifini aldım, kervan yolda.', 'Adil bir takas, anlaştık.', 'Tam ihtiyacım olan şey, kabul!']), t);
        break;
      }
    }
    // kendi teklifini koy
    if (hi !== lo && r[hi] > 500 && r[hi] > r[lo] * 1.08 && S.market.filter(o => o.owner === b.id).length < 2 && R() < .6) {
      const gn = Math.max(200, Math.round(Math.min(r[hi] * .4, 400 + R() * 2500) / 100) * 100);
      const wn = Math.round(gn * (.8 + R() * .45) / 100) * 100;
      if (gn >= 200 && wn >= 100) { r[hi] -= gn; S.market.push({ id: ++S.uid, owner: b.id, vil: v.id, give: [hi, gn], want: [lo, wn], t, exp: t + 36 * HOUR / S.speed, merchants: Math.ceil(gn / CARRY) }); }
    }
  }
}
function arrive(m, t) {
  const to = vil(m.to), from = vil(m.from);
  if (m.type === 'tradeback') return;
  if (m.type === 'trade') {
    syncRes(to, t);
    const c = cap(to); let lost = 0;
    for (let i = 0; i < 3; i++) { const nv = to.res[i] + m.res[i]; lost += Math.max(0, nv - Math.max(c, to.res[i])); to.res[i] = Math.min(Math.max(c, to.res[i]), nv); }
    const txt = m.res.map((x, i) => x ? fmtN(x) + ' ' + RES_NAMES[i].toLocaleLowerCase('tr') : '').filter(Boolean).join(', ');
    if (m.deal) { if (to.owner === 'P') hooks.notify('good', 'Takas kervanı ' + to.name + ' köyüne ulaştı: ' + txt); }
    else if (m.owner === 'P') {
      hooks.notify('good', 'Kervan ' + to.name + ' köyüne ulaştı: ' + txt + (lost > 0 ? ' (ambar doluydu, ' + fmtN(lost) + ' kaybedildi)' : ''));
      if (to.owner && to.owner !== 'P') {
        const b = S.beys.find(x => x.id === to.owner);
        if (b && !b.human) { b.gifts = (b.gifts || 0) + m.res[0] + m.res[1] + m.res[2]; b.refusedUntil = 0;
          say(sameClan('P', b.id) ? 'klan' : 'genel', b.id, pick(['Gönderdiğin kervan ulaştı, cömertliğin unutulmayacak ' + S.player.name + '.', 'Kaynaklar için sağ ol beyim, ambarlarımız doldu.', 'Bu hediye dostluğumuzu pekiştirdi.']), t); }
      }
    } else if (to.owner === 'P') hooks.notify('good', ownerName(m.owner) + ' kervanı ' + to.name + ' köyüne ulaştı: ' + txt);
    if (from.owner === m.owner) S.moves.push({ id: ++S.uid, type: 'tradeback', owner: m.owner, from: m.from, to: m.from, via: m.to, units: {}, merchants: m.merchants, loot: [0, 0, 0], depart: t, arrive: t + tradeTime(to, from) });
    return;
  }
  if (m.type === 'return') {
    if (from.owner !== m.owner) return;           // köy el değiştirmiş, askerler dağıldı
    syncRes(from, t);
    for (const [u, n] of Object.entries(m.units)) from.units[u] = (from.units[u] || 0) + n;
    const c = cap(from); for (let i = 0; i < 3; i++) from.res[i] = Math.min(Math.max(c, from.res[i]), from.res[i] + m.loot[i]);
    return;
  }
  if (m.type === 'support') {
    if (to.owner === m.owner) { for (const [u, n] of Object.entries(m.units)) to.units[u] = (to.units[u] || 0) + n; }
    else if (sameClan(to.owner, m.owner)) { to.guest = to.guest || {}; for (const [u, n] of Object.entries(m.units)) to.guest[u] = (to.guest[u] || 0) + n; hooks.notify('good', ownerName(m.owner) + ' destek askerleri ' + to.name + ' köyüne ulaştı'); }
    else S.moves.push({ id: ++S.uid, type: 'return', owner: m.owner, from: m.from, to: m.from, via: m.to, units: m.units, loot: [0, 0, 0], depart: t, arrive: t + travelTime(to, from, m.units) });
    return;
  }
  if (to.owner === m.owner) {  // hedef bu arada bizim olduysa destek say
    for (const [u, n] of Object.entries(m.units)) to.units[u] = (to.units[u] || 0) + n; return;
  }
  battle(m, t);
}

// ---------- zaman akışı ----------
function nextEvent() {
  let best = { t: Infinity };
  for (const v of S.vil) {
    if (v.bq.length && v.bq[0].done < best.t) best = { t: v.bq[0].done, k: 'b', v };
    for (const b of REC_B) { const q = v.rq[b]; if (q.length && q[0].next < best.t) best = { t: q[0].next, k: 'u', v, b }; }
  }
  for (const m of S.moves) if (m.arrive < best.t) best = { t: m.arrive, k: 'm', m };
  if (S.nextAi < best.t) best = { t: S.nextAi, k: 'ai' };
  if (S.techq && S.techq.done < best.t) best = { t: S.techq.done, k: 'tech' };
  for (const b of S.beys) if (b.techq && b.techq.done < best.t) best = { t: b.techq.done, k: 'htech', b };
  if (S.nextChat < best.t) best = { t: S.nextChat, k: 'chat' };
  for (const c of S.chatq) if (c.t < best.t) best = { t: c.t, k: 'chatq', c };
  return best;
}
function processUntil(now) {
  let n = 0;
  if (S.over && !S.mp) return 0;
  for (let guard = 0; guard < 500000; guard++) {
    const e = nextEvent(); if (e.t > now) break;
    n++;
    if (e.k === 'b') {
      const v = e.v, q = v.bq.shift(); syncRes(v, e.t); v.b[q.b] = q.lvl;
      if (v.owner === 'P') hooks.notify('build', v.name + ': ' + B[q.b].n + ' ' + q.lvl + '. seviye');
    } else if (e.k === 'u') {
      const v = e.v, q = v.rq[e.b], it = q[0];
      v.units[it.u] = (v.units[it.u] || 0) + 1; it.n--;
      const st = statsOf(v.owner); if (st) st.trained[it.u] = (st.trained[it.u] || 0) + 1;
      if (it.n <= 0) { q.shift(); if (q.length) q[0].next = e.t + q[0].each; } else it.next += it.each;
    } else if (e.k === 'm') {
      S.moves.splice(S.moves.indexOf(e.m), 1); arrive(e.m, e.t);
    } else if (e.k === 'chat') {
      S.nextChat = e.t + (45 + R() * 100) * 1000;
      aiChat(e.t, now - e.t < 15 * 60000);
    } else if (e.k === 'chatq') {
      S.chatq.splice(S.chatq.indexOf(e.c), 1); say(e.c.ch, e.c.from, e.c.text, e.t);
      if (S.pendingRes) { S.pendingRes = false; allyResources(e.t); }
      if (S.pendingSupport) { S.pendingSupport = false; const v = S.vil.find(x => x.owner === 'P'); if (v) allySupport(v, S.beys[0].id, e.t); S.chat.klan.pop(); }
    } else if (e.k === 'tech') {
      const q = S.techq; S.techq = null; S.tech[q.id] = q.lvl;
      hooks.notify('good', 'Araştırma bitti: ' + TECH[q.id].n + ' ' + q.lvl + '. seviye');
    } else if (e.k === 'htech') {
      const b = e.b, q = b.techq; b.techq = null; b.tech = b.tech || {}; b.tech[q.id] = q.lvl;
    } else if (e.k === 'ai') {
      AI.tick(e.t); aiMarket(e.t); S.nextAi = e.t + HOUR / S.speed;
    }
    if (S.over && !S.mp) break;
  }
  S.lastT = now;
  return n;
}

function ownerName(o) { if (o === 'P') return S.player.name; if (o === null) return 'Terk edilmiş'; const b = beyOf(o); return b ? b.name : '?'; }
function ownerColor(o) { if (o === 'P') return S.player.color; if (o === null) return '#8d8a80'; const b = beyOf(o); return b ? b.color : '#888'; }
function ranking() {
  const rows = [{ id: 'P', name: S.player.name, color: S.player.color, pts: 0, n: 0 }, ...S.beys.map(b => ({ id: b.id, name: b.name, color: b.color, pts: 0, n: 0, human: !!b.human }))];
  for (const v of S.vil) { const r = rows.find(x => x.id === v.owner); if (r) { r.pts += vPoints(v); r.n++; } }
  return rows.filter(r => r.n > 0 || r.id === 'P').sort((a, b) => b.pts - a.pts);
}
// ne zaman karşılanabilir (ms), mümkün değilse Infinity
function timeToAfford(v, c) {
  let w = 0;
  for (let i = 0; i < 3; i++) { const need = c[i] - v.res[i]; if (need > 0) w = Math.max(w, need / rateH(v, i) * HOUR); }
  return w;
}

// ============================================================
//  RAKİP BEYLİKLER (yapay zekâ)
// ============================================================
const AI = (() => {
  const OFF = ['baltaci', 'akinci', 'sipahi', 'mancinik'];
  function offPower(units) { let a = 0; for (const u of OFF) a += U[u].a * (units[u] || 0); return a; }
  function defPower(v) {
    let di = 0, dc = 0; for (const [u, n] of Object.entries(v.units)) { if (U[u].cls === 'spy') continue; di += U[u].di * n; dc += U[u].dc * n; }
    return ((di + dc) / 2 + 20 + 40 * v.b.sur) * Math.pow(1.037, v.b.sur);
  }
  function pickBuild(v) {
    const used = popUsed(v), pm = popMax(v), c = cap(v), full = Math.max(...v.res) / c;
    let best = null, bs = -1;
    const kr = reqFor('konak', v.b.konak + 1), boost = {};
    for (const [k, x] of Object.entries(kr)) if (v.b[k] < x) boost[k] = 7;
    const K = v.b.konak, mineAvg = (v.b.kereste + v.b.tas + v.b.demir) / 3;
    for (const b of B_ORDER) {
      if (v.b[b] >= B[b].max || !reqMet(v, reqFor(b, v.b[b] + 1))) continue;
      const l = v.b[b];
      let s = 0;
      if (MINES.includes(b)) s = (2 + K * 1.5) - l;
      else if (b === 'konak') s = 2.5 + mineAvg / 1.5 - K;
      else if (b === 'ambar') s = (full > .8 ? 5 : 0) + (bCost('konak', K + 1).some(x => x > c * .9) ? 6 : 0);
      else if (b === 'ciftlik') s = (used / pm - 0.55) * 22;
      else if (b === 'kisla') s = 1.5 + K * 0.7 - l;
      else if (b === 'sur') s = K * 0.5 - l;
      else if (b === 'ahir') s = 1 + K * 0.5 - l;
      else if (b === 'tophane') s = K * 0.3 - l;
      else if (b === 'divan') s = 8;
      else if (b === 'medrese') s = K * 0.3 - l;
      else if (b === 'kervansaray') s = K * 0.2 - l;
      s += boost[b] || 0;
      s += R() * 1.5;
      const cc = bCost(b, l + 1);
      if (cc.some(x => x > c)) { if (b !== 'ambar') continue; }
      if (B[b].pop > pm - used && b !== 'ciftlik') continue;
      if (s > bs) { bs = s; best = b; }
    }
    return best;
  }
  function mix(v, bey) {
    const w = [];
    if (unitUnlocked(v, 'mizrakli')) w.push(['mizrakli', 3]);
    if (unitUnlocked(v, 'okcu')) w.push(['okcu', 2]);
    if (unitUnlocked(v, 'baltaci')) w.push(['baltaci', 0.6 + 2.4 * bey.aggr]);
    if (unitUnlocked(v, 'akinci')) w.push(['akinci', 1.6 * bey.aggr]);
    if (unitUnlocked(v, 'sipahi')) w.push(['sipahi', 0.8]);
    if (unitUnlocked(v, 'mancinik')) w.push(['mancinik', 0.25]);
    if (unitUnlocked(v, 'casus') && (v.units.casus || 0) < 10) w.push(['casus', 0.3]);
    return w;
  }
  function pickW(w) { const tot = w.reduce((a, x) => a + x[1], 0); let r = R() * tot; for (const [k, x] of w) { r -= x; if (r <= 0) return k; } return w.length ? w[w.length - 1][0] : null; }

  function village(v, t, bey) {
    let reserve = [0, 0, 0];
    if (!v.bq.length) {
      const b = pickBuild(v);
      if (b) {
        const lvl = v.b[b] + 1, c = bCost(b, lvl);
        if (afford(v, c)) { pay(v, c); v.bq.push({ b, lvl, start: t, done: t + bTime(b, lvl, v.b.konak, v.owner), c }); }
        else reserve = c;
      }
    }
    if (v.b.divan >= 1 && !(v.units.sancakbeyi > 0)) {
      // fetih için biriktir: sancakbeyi alınana kadar askere daha az harca
      if (afford(v, U.sancakbeyi.c) && popFree(v) >= 100) { pay(v, U.sancakbeyi.c); v.units.sancakbeyi = 1; }
      else reserve = reserve.map((x, i) => Math.max(x, U.sancakbeyi.c[i]));
    }
    let budget = v.res.map((r, i) => Math.max(0, (r - reserve[i]) * 0.55));
    const w = mix(v, bey); if (!w.length) return;
    let pf = popFree(v);
    for (let k = 0; k < 60; k++) {
      const u = pickW(w), c = U[u].c;
      if (c.some((x, i) => budget[i] < x) || pf < U[u].pop) break;
      for (let i = 0; i < 3; i++) { budget[i] -= c[i]; v.res[i] -= c[i]; }
      pf -= U[u].pop; v.units[u] = (v.units[u] || 0) + 1;
    }
  }
  function barbarian(v) {
    for (const [u, n] of Object.entries(v.base)) { const h = v.units[u] || 0; if (h < n) v.units[u] = Math.min(n, h + Math.max(1, Math.round(n * .05))); }
    if (R() < .015) { const m = MINES[Math.floor(R() * 3)]; if (v.b[m] < 14) v.b[m]++; }
  }
  function attack(bey, t) {
    if (R() > 0.35 * bey.aggr) return;
    const mine = S.vil.filter(v => v.owner === bey.id);
    for (const v of mine.sort(() => R() - .5)) {
      const off = offPower(v.units); if (off < 250) continue;
      const busy = new Set(S.moves.filter(m => m.owner === bey.id && m.type !== 'return').map(m => m.to));
      const canHitP = t - bey.lastHitP > 6 * HOUR / S.speed;
      const cand = S.vil.filter(o => o.owner !== bey.id && !sameClan(o.owner, bey.id) && !busy.has(o.id) && dist(v, o) <= 9 &&
        (o.owner === null || (isHuman(o.owner) && t >= protectOf(o.owner) && canHitP && R() < bey.aggr * .55)));
      let best = null, bscore = -Infinity;
      for (const o of cand) {
        syncRes(o, t);
        const d = defPower(o); if (off < d * 1.25) continue;
        const score = (o.res[0] + o.res[1] + o.res[2]) / 500 - dist(v, o) + (isHuman(o.owner) ? 3 * bey.aggr : 0);
        if (score > bscore) { bscore = score; best = o; }
      }
      if (!best) continue;
      const units = {}; for (const u of OFF) if (v.units[u] > 0) units[u] = v.units[u];
      // oyuncunun son köyü fethedilmez: yağmalanabilir ama beylik yok olmaz
      const pLast = isHuman(best.owner) && lastVillage(best.owner);
      if ((v.units.sancakbeyi || 0) > 0 && off > defPower(best) * 2 && !pLast && (best.owner === null || bey.aggr > .6)) units.sancakbeyi = 1;
      if (send(v, best, units, 'attack', t) === 'ok') { if (isHuman(best.owner)) { bey.lastHitP = t; allySupport(best, bey.id, t); } return; }
    }
  }
  function tick(t) {
    for (const v of S.vil) {
      if (isHuman(v.owner)) continue;
      syncRes(v, t);
      if (v.owner === null) { if (v.base) barbarian(v); continue; }
      const bey = beyOf(v.owner); if (!bey) continue;
      village(v, t, bey);
    }
    for (const bey of aiBeys()) attack(bey, t);
  }
  return { tick, offPower, defPower };
})();

return {
  HOUR, RES_NAMES, MINES, B, B_ORDER, U, U_ORDER, REC_B, WORLD, TECH, TECH_ORDER,
  reqFor, isHuman, protectOf, mkVillage, clanOf, sameClan, clanList, ownerPts, createClan, inviteBey, joinClan, leaveClan, playerSay, CLAN_MAX, techCost, techTime, canResearch, research, migrate, medreseMax, TL,
  get S() { return S; }, set S(x) { S = x; },
  onNotify(fn) { log = fn; },
  maxAll(v, t) { syncRes(v, t); for (const b of B_ORDER) v.b[b] = B[b].max; v.bq = []; const c = cap(v); v.res = [c, c, c]; },
  fillRes(v, t) { syncRes(v, t); const c = cap(v); v.res = [c, c, c]; },
  newGame, processUntil, syncRes, syncLoy, upgrade, canUpgrade, cancelLast, train, maxTrain, unitUnlocked, send, travelTime, sendRes, createOffer, cancelOffer, acceptOffer, aiMarket, tradeTime, merchantsTotal, merchantsFree, merchantsBusy, CARRY,
  bCost, bTime, uTime, rateH, cap, popMax, popUsed, popFree, effLevel, reqMet, vPoints, dist, ownerName, ownerColor, ranking, timeToAfford, unitSum, vil, AI,
};
})();
if (typeof module !== 'undefined') module.exports = Core;
