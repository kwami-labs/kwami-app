-- =============================================================================
-- browser_contexts, owned by the app's migrations as well as the API's.
--
-- The table comes from kwami-lk-api `migrations/018_browser_contexts.sql`. The
-- voice agent on LiveKit Cloud now writes it directly (it has no API to go
-- through), so the app's history must guarantee it exists whether or not the
-- API's runner ever reached 018 on this database. Same shape as 018, and
-- idempotent, so applying both is harmless.
-- =============================================================================

create table if not exists public.browser_contexts (
    id           uuid primary key default gen_random_uuid(),
    owner_key    text not null,
    vendor       text not null check (vendor in ('browserbase', 'browser_use')),
    context_id   text not null,
    user_id      uuid references auth.users(id) on delete cascade,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    last_used_at timestamptz,
    unique (owner_key, vendor)
);

create index if not exists idx_browser_contexts_user
    on public.browser_contexts (user_id, updated_at desc);

comment on table public.browser_contexts is
    'Maps a kwami/participant to its persisted cloud-browser profile. One row per (owner_key, vendor).';

alter table public.browser_contexts enable row level security;

-- Writes are service-role only. A user may audit and clear their own rows.
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'browser_contexts'
          and policyname = 'Users can view own browser contexts'
    ) then
        create policy "Users can view own browser contexts"
            on public.browser_contexts for select
            using (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'browser_contexts'
          and policyname = 'Users can delete own browser contexts'
    ) then
        create policy "Users can delete own browser contexts"
            on public.browser_contexts for delete
            using (auth.uid() = user_id);
    end if;
end
$$;
