-- Uç Beyleri: yönetim paneli (yöneticiler, yasaklar, dünya düzenleme)
-- Supabase > SQL Editor'e yapıştır, EN ALTTAKİ kullanıcı adını kendi adınla değiştir, Run'a bas.
-- Tekrar çalıştırmak zararsızdır.

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
create table if not exists public.bans (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  reason     text not null default '',
  until      timestamptz,                 -- boş = kalıcı
  by_admin   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
alter table public.bans enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
create or replace function public.is_banned(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bans b where b.user_id = u and (b.until is null or b.until > now()));
$$;

-- yasaklı oyuncu hiçbir dünyayı göremez ve kaydedemez
create or replace function public.is_member(w uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.world_players p where p.world_id = w and p.user_id = auth.uid())
     and not public.is_banned(auth.uid());
$$;

-- oyuncu kendi yasağını görebilsin (uygulama sebebini gösterir)
create or replace function public.my_ban() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('reason', b.reason, 'until', b.until)
  from public.bans b where b.user_id = auth.uid() and (b.until is null or b.until > now());
$$;
create or replace function public.am_admin() returns boolean
language sql stable security definer set search_path = '' as $$ select public.is_admin(); $$;

-- ---------- yönetici işlemleri ----------
create or replace function public.admin_worlds()
returns table (id uuid, code text, name text, speed int, version int, updated_at timestamptz, players bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Yetkin yok'; end if;
  return query select w.id, w.code, w.name, w.speed, w.version, w.updated_at,
    (select count(*) from public.world_players p where p.world_id = w.id)
  from public.worlds w order by w.updated_at desc limit 200;
end $$;

create or replace function public.admin_players(p_world uuid)
returns table (user_id uuid, hid text, name text, username text, joined_at timestamptz, banned boolean, ban_reason text, ban_until timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Yetkin yok'; end if;
  return query select p.user_id, p.hid, p.name, a.username, p.joined_at,
    public.is_banned(p.user_id), b.reason, b.until
  from public.world_players p
  left join public.accounts a on a.user_id = p.user_id
  left join public.bans b on b.user_id = p.user_id
  where p.world_id = p_world order by p.joined_at;
end $$;

create or replace function public.admin_load(p_world uuid)
returns table (state text, version int, code text, name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Yetkin yok'; end if;
  return query select w.state, w.version, w.code, w.name from public.worlds w where w.id = p_world;
end $$;

create or replace function public.admin_save(p_world uuid, p_state text, p_version int)
returns int language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  if not public.is_admin() then raise exception 'Yetkin yok'; end if;
  update public.worlds w set state = p_state, version = w.version + 1, updated_at = now()
  where w.id = p_world and w.version = p_version returning w.version into v;
  return v;   -- boşsa başka biri araya girdi, yeniden dene
end $$;

create or replace function public.admin_ban(p_user uuid, p_reason text, p_hours int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Yetkin yok'; end if;
  if exists (select 1 from public.admins a where a.user_id = p_user) then raise exception 'Yönetici yasaklanamaz'; end if;
  insert into public.bans (user_id, reason, until, by_admin)
  values (p_user, left(coalesce(p_reason, ''), 200), case when coalesce(p_hours, 0) > 0 then now() + make_interval(hours => p_hours) end, auth.uid())
  on conflict (user_id) do update set reason = excluded.reason, until = excluded.until, by_admin = excluded.by_admin, created_at = now();
  delete from public.push_tokens t where t.user_id = p_user;
end $$;

create or replace function public.admin_unban(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Yetkin yok'; end if;
  delete from public.bans b where b.user_id = p_user;
end $$;

create or replace function public.admin_bans()
returns table (user_id uuid, username text, reason text, until timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Yetkin yok'; end if;
  return query select b.user_id, coalesce(a.username, (select p.name from public.world_players p where p.user_id = b.user_id limit 1)), b.reason, b.until, b.created_at
  from public.bans b left join public.accounts a on a.user_id = b.user_id
  where b.until is null or b.until > now() order by b.created_at desc;
end $$;

create or replace function public.admin_kick(p_world uuid, p_hid text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Yetkin yok'; end if;
  delete from public.world_players p where p.world_id = p_world and p.hid = p_hid;
end $$;

create or replace function public.admin_delete_world(p_world uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Yetkin yok'; end if;
  delete from public.worlds w where w.id = p_world;
end $$;

-- bütün dünyalarda oyuncu ara (ad ya da kullanıcı adı)
create or replace function public.admin_search(p_q text)
returns table (user_id uuid, username text, name text, world_id uuid, world_name text, code text, hid text, banned boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Yetkin yok'; end if;
  return query select p.user_id, a.username, p.name, w.id, w.name, w.code, p.hid, public.is_banned(p.user_id)
  from public.world_players p join public.worlds w on w.id = p.world_id
  left join public.accounts a on a.user_id = p.user_id
  where coalesce(p_q, '') = '' or p.name ilike '%' || p_q || '%' or a.username ilike '%' || p_q || '%' or w.code ilike p_q
  order by p.joined_at desc limit 100;
end $$;

-- genel bakış sayıları
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Yetkin yok'; end if;
  return jsonb_build_object(
    'worlds', (select count(*) from public.worlds),
    'active', (select count(*) from public.worlds w where w.updated_at > now() - interval '1 day'),
    'players', (select count(distinct p.user_id) from public.world_players p),
    'accounts', (select count(*) from public.accounts),
    'bans', (select count(*) from public.bans b where b.until is null or b.until > now()),
    'push', (select count(*) from public.push_tokens));
end $$;

-- katılma ve dünya kurma da yasaklıya kapalı
create or replace function public.join_world_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_banned(new.user_id) then raise exception 'Hesabın yasaklı'; end if;
  return new;
end $$;
drop trigger if exists world_players_ban on public.world_players;
create trigger world_players_ban before insert on public.world_players for each row execute function public.join_world_guard();

do $$ declare f text; begin
  foreach f in array array['is_admin()','is_banned(uuid)','my_ban()','am_admin()','admin_worlds()','admin_players(uuid)','admin_load(uuid)',
    'admin_save(uuid, text, int)','admin_ban(uuid, text, int)','admin_unban(uuid)','admin_bans()','admin_kick(uuid, text)','admin_delete_world(uuid)','admin_search(text)','admin_overview()'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;

-- ===== KENDİNİ YÖNETİCİ YAP: tırnak içine oyundaki kullanıcı adını yaz =====
insert into public.admins (user_id)
select a.user_id from public.accounts a where a.username = lower('KULLANICI_ADIN')
on conflict do nothing;
select a.username as yonetici from public.admins x join public.accounts a on a.user_id = x.user_id;
