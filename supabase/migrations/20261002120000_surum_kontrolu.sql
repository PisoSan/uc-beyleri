-- Uç Beyleri: eski oyun sürümlerinin dünyayı bozmasını engelle
-- Savaşları oyunu açık olan telefon hesaplar. Eski kurallı bir telefon kaydedemesin diye her kayıt
-- sürüm numarası ve tek seferlik damga taşır; taşımayan (eski) sürümün kaydı reddedilir.
-- Supabase > SQL Editor'e yapıştırıp Run'a bas. Tekrar çalıştırmak zararsızdır.

alter table public.worlds add column if not exists client_ver int not null default 0;
alter table public.worlds add column if not exists stamp text;

create table if not exists public.app_config (key text primary key, value text not null);
alter table public.app_config enable row level security;
insert into public.app_config (key, value) values ('min_client', '23') on conflict (key) do nothing;

create or replace function public.worlds_version_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare minv int;
begin
  if new.state is distinct from old.state then
    select coalesce((select c.value::int from public.app_config c where c.key = 'min_client'), 0) into minv;
    if new.stamp is null or new.stamp is not distinct from old.stamp or coalesce(new.client_ver, 0) < minv then
      raise exception 'ESKI_SURUM: Oyunun yeni sürümü gerekli (en az %)', minv;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists worlds_version_guard on public.worlds;
create trigger worlds_version_guard before update on public.worlds for each row execute function public.worlds_version_guard();

grant update (state, version, updated_at, client_ver, stamp) on table public.worlds to authenticated;

-- uygulamanın sorabileceği en düşük sürüm
create or replace function public.min_client() returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.value::int from public.app_config c where c.key = 'min_client'), 0);
$$;

-- yönetim paneli kaydı da damga taşır
create or replace function public.admin_save(p_world uuid, p_state text, p_version int)
returns int language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  if not public.is_admin() then raise exception 'Yetkin yok'; end if;
  update public.worlds w set state = p_state, version = w.version + 1, updated_at = now(),
    stamp = gen_random_uuid()::text, client_ver = 999999
  where w.id = p_world and w.version = p_version returning w.version into v;
  return v;
end $$;

-- yönetici: zorunlu güncelleme sürümünü ayarla
create or replace function public.admin_set_min_client(p_ver int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Yetkin yok'; end if;
  insert into public.app_config (key, value) values ('min_client', greatest(0, p_ver)::text)
  on conflict (key) do update set value = excluded.value;
end $$;

revoke all on function public.min_client() from public, anon;
revoke all on function public.admin_set_min_client(int) from public, anon;
grant execute on function public.min_client() to authenticated;
grant execute on function public.admin_set_min_client(int) to authenticated;
select public.min_client() as en_dusuk_surum;
