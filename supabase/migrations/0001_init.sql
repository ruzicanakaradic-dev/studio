-- Ružini domaći kolači — Studio: inicijalna šema
-- Pokreni u Supabase: Dashboard → SQL Editor → New query → Run
-- (ili preko Supabase CLI: supabase db push)

-- ============ PROJECTS ============
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner uuid references auth.users (id) on delete cascade,
  name text not null default 'Bez naziva',
  format text not null default 'post' check (format in ('post','story','reels','carousel')),
  cover_media_id text,
  data jsonb not null default '{}'::jsonb,      -- { slides: [...], chrome: bool }
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists projects_owner_idx on public.projects (owner);
create index if not exists projects_updated_idx on public.projects (updated_at desc);

-- auto owner = ulogovani korisnik
create or replace function public.set_project_owner()
returns trigger language plpgsql security definer as $$
begin
  if new.owner is null then
    new.owner := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_project_owner on public.projects;
create trigger trg_set_project_owner
  before insert or update on public.projects
  for each row execute function public.set_project_owner();

-- ============ RLS ============
alter table public.projects enable row level security;

drop policy if exists "own projects - select" on public.projects;
create policy "own projects - select" on public.projects
  for select using (auth.uid() = owner);

drop policy if exists "own projects - insert" on public.projects;
create policy "own projects - insert" on public.projects
  for insert with check (auth.uid() = owner or owner is null);

drop policy if exists "own projects - update" on public.projects;
create policy "own projects - update" on public.projects
  for update using (auth.uid() = owner);

drop policy if exists "own projects - delete" on public.projects;
create policy "own projects - delete" on public.projects
  for delete using (auth.uid() = owner);

-- ============ STORAGE (media bucket) ============
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media - public read" on storage.objects;
create policy "media - public read" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "media - auth upload" on storage.objects;
create policy "media - auth upload" on storage.objects
  for insert with check (bucket_id = 'media' and auth.role() = 'authenticated');

drop policy if exists "media - auth update" on storage.objects;
create policy "media - auth update" on storage.objects
  for update using (bucket_id = 'media' and auth.role() = 'authenticated');

drop policy if exists "media - auth delete" on storage.objects;
create policy "media - auth delete" on storage.objects
  for delete using (bucket_id = 'media' and auth.role() = 'authenticated');
