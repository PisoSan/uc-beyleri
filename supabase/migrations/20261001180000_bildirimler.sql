-- Uç Beyleri: anlık bildirimler (Firebase Cloud Messaging)
-- Supabase > SQL Editor'e yapıştırıp Run'a bas. Tekrar çalıştırmak zararsızdır.

-- 1) Telefonların bildirim kimlikleri
create table if not exists public.push_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user on public.push_tokens(user_id);
alter table public.push_tokens enable row level security;   -- doğrudan erişim yok, sadece aşağıdaki fonksiyonlar

-- 2) Gönderilecek bildirimler (zamanı gelince send-push fonksiyonu yollar)
create table if not exists public.push_jobs (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,   -- alıcı
  created_by uuid not null references auth.users(id) on delete cascade,   -- gönderen
  world_id   uuid references public.worlds(id) on delete cascade,
  due_at     timestamptz not null,
  title      text not null,
  body       text not null,
  tag        text,
  ch         text not null default 'saldiri',
  sent_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists push_jobs_due on public.push_jobs(due_at) where sent_at is null;
create index if not exists push_jobs_by on public.push_jobs(created_by, created_at);
alter table public.push_jobs enable row level security;

-- telefon kimliğini kaydet (aynı telefon başka hesaba geçtiyse eskisini siler)
create or replace function public.register_push(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_token is null or length(p_token) < 20 or length(p_token) > 4096 then return; end if;
  delete from public.push_tokens t where t.token = p_token;
  insert into public.push_tokens (token, user_id) values (p_token, auth.uid());
  -- bir hesapta en fazla 5 telefon
  delete from public.push_tokens t where t.user_id = auth.uid() and t.token in (
    select x.token from public.push_tokens x where x.user_id = auth.uid() order by x.updated_at desc offset 5);
end $$;

create or replace function public.unregister_push(p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_tokens t where t.token = p_token and t.user_id = auth.uid();
$$;

-- aynı dünyadaki bir oyuncuya bildirim sıraya koy (p_delay: kaç saniye sonra)
create or replace function public.queue_push(p_world uuid, p_hid text, p_delay int, p_title text, p_body text, p_tag text, p_ch text)
returns void language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if auth.uid() is null or not public.is_member(p_world) then return; end if;
  select p.user_id into target from public.world_players p where p.world_id = p_world and p.hid = p_hid;
  if target is null or target = auth.uid() then return; end if;
  -- istenmeyen bildirim yağmuruna karşı: saatte en fazla 120
  if (select count(*) from public.push_jobs j where j.created_by = auth.uid() and j.created_at > now() - interval '1 hour') >= 120 then return; end if;
  insert into public.push_jobs (user_id, created_by, world_id, due_at, title, body, tag, ch)
  values (target, auth.uid(), p_world,
          now() + make_interval(secs => greatest(0, least(coalesce(p_delay, 0), 30 * 86400))),
          left(coalesce(p_title, ''), 80), left(coalesce(p_body, ''), 240), left(p_tag, 80),
          case when p_ch in ('saldiri', 'zaman', 'klan') then p_ch else 'saldiri' end);
end $$;

-- send-push fonksiyonunun kullandığı: zamanı gelenleri al ve gönderildi say
create or replace function public.claim_push_jobs(p_limit int default 300)
returns table (id bigint, title text, body text, tag text, ch text, tokens text[])
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.push_jobs j where j.sent_at < now() - interval '2 days';
  return query
  with due as (
    update public.push_jobs j set sent_at = now()
    where j.id in (select x.id from public.push_jobs x where x.sent_at is null and x.due_at <= now()
                   order by x.due_at limit p_limit for update skip locked)
    returning j.id, j.user_id, j.title, j.body, j.tag, j.ch)
  select d.id, d.title, d.body, d.tag, d.ch, array(select t.token from public.push_tokens t where t.user_id = d.user_id)
  from due d;
end $$;

create or replace function public.drop_push_token(p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_tokens t where t.token = p_token;
$$;

revoke all on function public.register_push(text) from public, anon;
revoke all on function public.unregister_push(text) from public, anon;
revoke all on function public.queue_push(uuid, text, int, text, text, text, text) from public, anon;
revoke all on function public.claim_push_jobs(int) from public, anon, authenticated;
revoke all on function public.drop_push_token(text) from public, anon, authenticated;
grant execute on function public.register_push(text) to authenticated;
grant execute on function public.unregister_push(text) to authenticated;
grant execute on function public.queue_push(uuid, text, int, text, text, text, text) to authenticated;
grant execute on function public.claim_push_jobs(int) to service_role;
grant execute on function public.drop_push_token(text) to service_role;

-- 3) Her dakika send-push fonksiyonunu tetikle
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'ub-push') then perform cron.unschedule('ub-push'); end if;
end $$;
select cron.schedule('ub-push', '* * * * *', $cron$
  select net.http_post(
    url := 'https://tgiqiybqfbikmdoblwba.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 20000);
$cron$);
