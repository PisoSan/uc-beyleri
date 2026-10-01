-- Uç Beyleri: sunucu saati (bütün cihazlar aynı saati kullansın diye)
create or replace function public.server_now() returns double precision
language sql stable as $$ select extract(epoch from clock_timestamp()) * 1000 $$;
revoke execute on function public.server_now() from public;
grant execute on function public.server_now() to anon, authenticated;
