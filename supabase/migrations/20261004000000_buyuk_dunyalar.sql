-- Uç Beyleri: büyük dünyalar (bir dünyada en fazla 100 oyuncu)
-- Supabase > SQL Editor'e yapıştırıp Run'a bas. Tekrar çalıştırmak zararsızdır.
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
    if n >= 100 then raise exception 'Bu dünya dolu (en fazla 100 oyuncu)'; end if;
    update public.worlds x set next_hid = x.next_hid + 1 where x.id = w returning x.next_hid - 1 into n;
    h := 'H' || n;
    insert into public.world_players (world_id, user_id, hid, name) values (w, auth.uid(), h, left(coalesce(nullif(trim(p_pname), ''), 'Bey'), 28));
  end if;
  return query select w, h;
end $$;
revoke all on function public.join_world(text, text) from public, anon;
grant execute on function public.join_world(text, text) to authenticated;
-- büyük dünyanın kaydı da sığsın (gzip'li durum)
alter table public.worlds drop constraint if exists state_size;
alter table public.worlds add constraint state_size check (length(state) < 8000000);
