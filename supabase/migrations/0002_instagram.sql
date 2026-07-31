-- Ružini domaći kolači — Studio: Instagram povezivanje (token se čuva serverski)
-- Pokreni u Supabase: Dashboard → SQL Editor → New query → Run

-- Jedan red za ceo brend (id='default'). Token NIKAD ne sme da bude čitljiv sa klijenta,
-- zato tabela ima RLS uključen BEZ ijedne policy — pristupa joj samo server (service_role,
-- koji zaobilazi RLS). Anon/authenticated ključ ne može ni da pročita ni da upiše token.
create table if not exists public.ig_connection (
  id text primary key default 'default',
  ig_user_id text,
  username text,
  access_token text,
  token_type text not null default 'long_lived',
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ig_connection enable row level security;
-- namerno bez policy-ja — samo service_role (server) sme da čita/piše
