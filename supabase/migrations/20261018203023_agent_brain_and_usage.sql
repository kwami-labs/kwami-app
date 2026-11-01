-- =============================================================================
-- What the voice agent keeps once it runs on LiveKit Cloud.
--
-- The agent's brain used to keep its monthly spend and its undelivered results
-- in `agent/.data/brain` on local disk, which a cloud worker loses on every
-- restart. Session usage went to the Kwami API's credits route, and on the
-- cloud there is no API to reach. These tables are written by the agent
-- directly with the service-role key; users can only read their own rows.
--
-- Reused rather than duplicated: user_kwamis (owner of a kwami), and
-- browser_contexts (previous migration). Not reused: credit_usage_logs, whose
-- NOT NULL pricing and settlement columns belong to the credits system; usage
-- that is only recorded, not billed, would fill them with invented numbers.
--
-- kwami_id is text with no foreign key, as in browser_contexts: for telephony
-- the agent may only know the LiveKit participant identity.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- brain_spend: dollars per user, kwami, calendar month and model.
-- -----------------------------------------------------------------------------
create table if not exists public.brain_spend (
    user_id    uuid not null references auth.users(id) on delete cascade,
    kwami_id   text not null default '',
    month      text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
    model_id   text not null,
    usd        numeric(14, 6) not null default 0 check (usd >= 0),
    updated_at timestamptz not null default now(),
    primary key (user_id, month, kwami_id, model_id)
);

comment on table public.brain_spend is
    'Brain (delegated model) spend in USD, accumulated per user, kwami, month (YYYY-MM) and model.';

alter table public.brain_spend enable row level security;

drop policy if exists "Users can view own brain spend" on public.brain_spend;
create policy "Users can view own brain spend"
    on public.brain_spend for select
    using (auth.uid() = user_id);

-- Additive upsert in one statement. Two sessions of the same user can finish a
-- task at the same moment; a read-then-write from the agent would lose one.
create or replace function public.brain_add_spend(
    p_user_id  uuid,
    p_kwami_id text,
    p_month    text,
    p_model_id text,
    p_usd      numeric
) returns numeric
language sql
set search_path = public
as $$
    insert into public.brain_spend as s (user_id, kwami_id, month, model_id, usd, updated_at)
    values (p_user_id, coalesce(p_kwami_id, ''), p_month, p_model_id, greatest(p_usd, 0), now())
    on conflict (user_id, month, kwami_id, model_id)
    do update set usd = s.usd + excluded.usd, updated_at = now()
    returning usd;
$$;

revoke all on function public.brain_add_spend(uuid, text, text, text, numeric)
    from public, anon, authenticated;
grant execute on function public.brain_add_spend(uuid, text, text, text, numeric)
    to service_role;

-- -----------------------------------------------------------------------------
-- brain_pending: results that finished after the call ended. The next greeting
-- reads them out and stamps taken_at.
-- -----------------------------------------------------------------------------
create table if not exists public.brain_pending (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid references auth.users(id) on delete cascade,
    kwami_id   text not null,
    task_id    text not null,
    title      text not null default '',
    text       text not null,
    models     text[] not null default '{}',
    created_at timestamptz not null default now(),
    taken_at   timestamptz
);

create index if not exists idx_brain_pending_untaken
    on public.brain_pending (kwami_id, created_at)
    where taken_at is null;

comment on table public.brain_pending is
    'Brain results owed to the user. Untaken rows (taken_at is null) are read by the next greeting.';

alter table public.brain_pending enable row level security;

drop policy if exists "Users can view own brain results" on public.brain_pending;
create policy "Users can view own brain results"
    on public.brain_pending for select
    using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- agent_usage: one row per model and session, written when the session ends.
-- -----------------------------------------------------------------------------
create table if not exists public.agent_usage (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid references auth.users(id) on delete cascade,
    kwami_id   text,
    session_id text not null,
    provider   text not null default '',
    model      text not null,
    kind       text not null check (kind in ('stt', 'llm', 'tts', 'realtime', 'tool', 'memory')),
    -- Tokens for llm, minutes for stt and realtime, characters for tts,
    -- requests for tool and memory.
    units      double precision not null default 0,
    details    jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_agent_usage_user
    on public.agent_usage (user_id, created_at desc);
create index if not exists idx_agent_usage_session
    on public.agent_usage (session_id);

comment on table public.agent_usage is
    'Voice agent usage per session and model, recorded (not billed) when the agent has no Kwami API.';
comment on column public.agent_usage.units is
    'Tokens for llm, minutes for stt/realtime, characters for tts, requests for tool/memory.';

alter table public.agent_usage enable row level security;

drop policy if exists "Users can view own agent usage" on public.agent_usage;
create policy "Users can view own agent usage"
    on public.agent_usage for select
    using (auth.uid() = user_id);
