-- LoanShark v3.2.32
-- Apply this once in Supabase SQL Editor before using the new Save/Load snapshot history UI.

create extension if not exists pgcrypto;

create table if not exists public.app_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  app_version text null,
  note text null,
  state_json jsonb not null
);

create index if not exists idx_app_snapshots_owner_created_at
  on public.app_snapshots (owner_id, created_at desc);

alter table public.app_snapshots enable row level security;

grant select, insert, delete on public.app_snapshots to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_snapshots'
      and policyname = 'app_snapshots_select_owner_or_shared'
  ) then
    create policy app_snapshots_select_owner_or_shared
      on public.app_snapshots
      for select
      to authenticated
      using (
        auth.uid() = owner_id
        or exists (
          select 1
          from public.state_shares ss
          where ss.owner_id = app_snapshots.owner_id
            and ss.viewer_id = auth.uid()
            and coalesce(ss.role, 'read') in ('read', 'owner', 'edit')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_snapshots'
      and policyname = 'app_snapshots_insert_owner_only'
  ) then
    create policy app_snapshots_insert_owner_only
      on public.app_snapshots
      for insert
      to authenticated
      with check (auth.uid() = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_snapshots'
      and policyname = 'app_snapshots_delete_owner_only'
  ) then
    create policy app_snapshots_delete_owner_only
      on public.app_snapshots
      for delete
      to authenticated
      using (auth.uid() = owner_id);
  end if;
end
$$;
