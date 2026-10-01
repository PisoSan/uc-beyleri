-- Uç Beyleri: kullanıcı adı + şifre ile hesap
-- Supabase > SQL Editor'e yapıştırıp Run'a bas. Tekrar çalıştırmak zararsızdır.
create table if not exists public.accounts (
  username   text primary key check (username ~ '^[a-z0-9_.]{3,20}$'),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.accounts enable row level security;   -- sadece "account" fonksiyonu (sunucu anahtarıyla) yazar/okur
