// Uç Beyleri — account
// Misafir (anonim) hesaba kullanıcı adı + şifre ekler ya da şifreyi değiştirir.
// Giriş, Supabase'in kendi şifre girişiyle yapılır: kullanıcı adı → <ad>@ucbeyleri.app
// Hesabın kimliği değişmez; oyuncunun bütün dünyaları aynen kalır.
import { createClient } from 'npm:@supabase/supabase-js@2';

function serverKey(): string {
  try { const k = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'); const v = k.default || Object.values(k)[0]; if (v) return String(v); } catch (_) { /* eski anahtar */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}
const db = createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), { auth: { persistSession: false, autoRefreshToken: false } });
const DOMAIN = 'ucbeyleri.app';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const out = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: who, error: we } = await db.auth.getUser(jwt);
    if (we || !who?.user) return out({ error: 'Oturum geçersiz, uygulamayı yeniden aç' }, 401);
    const user = who.user;
    const body = await req.json().catch(() => ({}));
    const password = String(body.password || '');
    if (password.length < 6 || password.length > 72) return out({ error: 'Şifre en az 6 karakter olmalı' }, 400);

    if (body.action === 'register') {
      const username = String(body.username || '').trim().toLowerCase();
      if (!/^[a-z0-9_.]{3,20}$/.test(username)) return out({ error: 'Kullanıcı adı 3-20 karakter olmalı; harf, rakam, _ ve . kullanılabilir' }, 400);
      const { data: mine } = await db.from('accounts').select('username').eq('user_id', user.id).maybeSingle();
      if (mine) return out({ error: 'Bu hesap zaten kayıtlı: ' + mine.username }, 400);
      const { error: ie } = await db.from('accounts').insert({ username, user_id: user.id });
      if (ie) return out({ error: ie.code === '23505' ? 'Bu kullanıcı adı alınmış' : ie.message }, 400);
      const { error: ue } = await db.auth.admin.updateUserById(user.id, { email: `${username}@${DOMAIN}`, password, email_confirm: true, user_metadata: { username } });
      if (ue) { await db.from('accounts').delete().eq('user_id', user.id); return out({ error: ue.message }, 400); }
      return out({ ok: true, username });
    }
    if (body.action === 'password') {
      const { data: mine } = await db.from('accounts').select('username').eq('user_id', user.id).maybeSingle();
      if (!mine) return out({ error: 'Önce hesabını kaydet' }, 400);
      const { error: ue } = await db.auth.admin.updateUserById(user.id, { password });
      if (ue) return out({ error: ue.message }, 400);
      return out({ ok: true });
    }
    return out({ error: 'Bilinmeyen işlem' }, 400);
  } catch (e) {
    return out({ error: String((e as Error).message || e) }, 500);
  }
});
