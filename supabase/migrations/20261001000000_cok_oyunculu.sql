-- Uç Beyleri: çok oyunculu dünyalar
-- Supabase > SQL Editor'e yapıştırıp Run'a bas. Tekrar çalıştırmak zararsızdır.

create table if not exists public.worlds (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null default 'Dünya',
  speed       int  not null default 10,
  state       text not null,
  version     int  not null default 1,
  next_hid    int  not null default 2,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint state_size check (length(state) < 3000000)
);

create table if not exists public.world_players (
  world_id   uuid not null references public.worlds(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  hid        text not null,
  name       text not null,
  joined_at  timestamptz not null default now(),
  primary key (world_id, user_id),
  unique (world_id, hid)
);
create index if not exists world_players_user on public.world_players(user_id);

alter table public.worlds enable row level security;
alter table public.world_players enable row level security;

-- üyelik kontrolü (politikalarda kullanılır)
create or replace function public.is_member(w uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.world_players p where p.world_id = w and p.user_id = auth.uid());
$$;

drop policy if exists worlds_select on public.worlds;
drop policy if exists worlds_update on public.worlds;
create policy worlds_select on public.worlds for select to authenticated using (public.is_member(id));
create policy worlds_update on public.worlds for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

drop policy if exists players_select on public.world_players;
drop policy if exists players_delete on public.world_players;
create policy players_select on public.world_players for select to authenticated using (public.is_member(world_id));
create policy players_delete on public.world_players for delete to authenticated using (user_id = auth.uid());

-- dünya kur: dünyayı ve kurucuyu (H1) birlikte ekler
create or replace function public.create_world(p_code text, p_name text, p_speed int, p_state text, p_pname text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare w uuid;
begin
  if auth.uid() is null then raise exception 'Giriş yapılmamış'; end if;
  if (select count(*) from public.worlds x where x.created_by = auth.uid() and x.created_at > now() - interval '1 day') >= 10 then
    raise exception 'Bugün çok fazla dünya kurdun, yarın tekrar dene';
  end if;
  insert into public.worlds (code, name, speed, state, created_by)
  values (upper(p_code), left(coalesce(nullif(trim(p_name), ''), 'Dünya'), 40), greatest(1, least(p_speed, 1000)), p_state, auth.uid())
  returning id into w;
  insert into public.world_players (world_id, user_id, hid, name) values (w, auth.uid(), 'H1', left(coalesce(nullif(trim(p_pname), ''), 'Bey'), 28));
  return w;
end $$;

-- koda katıl: zaten üyeysen mevcut kimliğini döner
create or replace function public.join_world(p_code text, p_pname text)
returns table (r_world uuid, r_hid text) language plpgsql security definer set search_path = '' as $$
declare w uuid; h text; n int;
begin
  if auth.uid() is null then raise exception 'Giriş yapılmamış'; end if;
  select x.id into w from public.worlds x where x.code = upper(p_code);
  if w is null then return; end if;
  select p.hid into h from public.world_players p where p.world_id = w and p.user_id = auth.uid();
  if h is null then
    select count(*) into n from public.world_players p where p.world_id = w;
    if n >= 8 then raise exception 'Bu dünya dolu (en fazla 8 oyuncu)'; end if;
    update public.worlds x set next_hid = x.next_hid + 1 where x.id = w returning x.next_hid - 1 into n;
    h := 'H' || n;
    insert into public.world_players (world_id, user_id, hid, name) values (w, auth.uid(), h, left(coalesce(nullif(trim(p_pname), ''), 'Bey'), 28));
  end if;
  return query select w, h;
end $$;

revoke all on table public.worlds, public.world_players from anon, authenticated;
grant select on table public.worlds to authenticated;
grant update (state, version, updated_at) on table public.worlds to authenticated;
grant select, delete on table public.world_players to authenticated;

revoke execute on function public.is_member(uuid), public.create_world(text, text, int, text, text), public.join_world(text, text) from public, anon;
grant execute on function public.is_member(uuid), public.create_world(text, text, int, text, text), public.join_world(text, text) to authenticated;
