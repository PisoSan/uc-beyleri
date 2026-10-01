-- Uç Beyleri: oyuncu istatistikleri (dünya başına + tüm dünyaların toplamı)
-- Supabase > SQL Editor'e yapıştırıp Run'a bas. Tekrar çalıştırmak zararsızdır.

create table if not exists public.player_stats (
  user_id    uuid not null references auth.users(id) on delete cascade,
  world_id   uuid not null references public.worlds(id) on delete cascade,
  name       text not null default '',
  stats      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, world_id)
);
alter table public.player_stats enable row level security;   -- doğrudan erişim yok, aşağıdaki fonksiyonlar

-- kendi dünyadaki istatistiğini kaydet (sadece üyesi olduğun dünya)
create or replace function public.put_stats(p_world uuid, p_name text, p_stats jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_member(p_world) then return; end if;
  if pg_column_size(p_stats) > 4000 then return; end if;
  insert into public.player_stats (user_id, world_id, name, stats, updated_at)
  values (auth.uid(), p_world, left(coalesce(p_name, ''), 28), p_stats, now())
  on conflict (user_id, world_id) do update set name = excluded.name, stats = excluded.stats, updated_at = now();
end $$;

-- bir oyuncunun tüm dünyalardaki toplamı (oyuncu kartında "Tüm dünyalar")
create or replace function public.global_stats(p_uid uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'worlds',   count(*),
    'kills',    coalesce(sum((s.stats->>'kills')::bigint), 0),
    'lost',     coalesce(sum((s.stats->>'lost')::bigint), 0),
    'conq',     coalesce(sum((s.stats->>'conq')::bigint), 0),
    'lostVil',  coalesce(sum((s.stats->>'lostVil')::bigint), 0),
    'wins',     coalesce(sum((s.stats->>'wins')::bigint), 0),
    'defWins',  coalesce(sum((s.stats->>'defWins')::bigint), 0),
    'attacks',  coalesce(sum((s.stats->>'attacks')::bigint), 0),
    'loot',     coalesce(sum((s.stats->>'loot')::bigint), 0),
    'fell',     coalesce(sum((s.stats->>'fell')::bigint), 0),
    'bestPts',  coalesce(max((s.stats->>'pts')::bigint), 0),
    'bestVil',  coalesce(max((s.stats->>'vil')::bigint), 0))
  from public.player_stats s where s.user_id = p_uid and auth.uid() is not null;
$$;

revoke all on function public.put_stats(uuid, text, jsonb) from public, anon;
revoke all on function public.global_stats(uuid) from public, anon;
grant execute on function public.put_stats(uuid, text, jsonb) to authenticated;
grant execute on function public.global_stats(uuid) to authenticated;
