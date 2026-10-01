// Uç Beyleri — send-push
// Zamanı gelen bildirimleri Firebase Cloud Messaging (HTTP v1) ile telefonlara yollar.
// Her dakika pg_cron tarafından çağrılır. Gizli anahtar: FCM_SERVICE_ACCOUNT (Firebase hizmet hesabı JSON'u).
// SUPABASE_URL ve sunucu anahtarı Supabase tarafından otomatik verilir (yeni SUPABASE_SECRET_KEYS, yoksa eski SERVICE_ROLE_KEY).
import { createClient } from 'npm:@supabase/supabase-js@2';

function serverKey(): string {
  try { const k = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'); const v = k.default || Object.values(k)[0]; if (v) return String(v); } catch (_) { /* eski anahtara düş */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}
const db = createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), { auth: { persistSession: false } });
const sa = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') || '{}');

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

let cached = { tok: '', exp: 0 };
async function googleToken(): Promise<string> {
  if (cached.exp > Date.now() + 60_000) return cached.tok;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  });
  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + b64url(sig) }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google oturumu alınamadı: ' + JSON.stringify(j));
  cached = { tok: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.tok;
}

type Job = { id: number; title: string; body: string; tag: string | null; ch: string; tokens: string[] };

Deno.serve(async () => {
  if (!sa.client_email) return new Response('FCM_SERVICE_ACCOUNT eksik', { status: 500 });
  const { data, error } = await db.rpc('claim_push_jobs', { p_limit: 300 });
  if (error) return new Response(error.message, { status: 500 });
  const jobs = (data || []) as Job[];
  if (!jobs.length) return Response.json({ sent: 0 });

  const access = await googleToken();
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  let sent = 0, dropped = 0;
  await Promise.all(jobs.flatMap(j => (j.tokens || []).map(async token => {
    const r = await fetch(url, {
      method: 'POST', headers: { Authorization: 'Bearer ' + access, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: {
        token,
        data: { title: j.title, body: j.body, tag: j.tag || ('job-' + j.id), ch: j.ch || 'saldiri' },
        android: { priority: 'HIGH', ttl: '86400s' },
      } }),
    });
    if (r.ok) { sent++; return; }
    const t = await r.text();
    // uygulama silinmiş / kimlik geçersiz: bir daha deneme
    if (r.status === 404 || /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/.test(t)) { dropped++; await db.rpc('drop_push_token', { p_token: token }); }
    else console.error('FCM', r.status, t);
  })));
  return Response.json({ jobs: jobs.length, sent, dropped });
});
