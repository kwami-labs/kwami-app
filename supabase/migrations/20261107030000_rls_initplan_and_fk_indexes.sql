-- What Supabase's performance advisor flags in the tables this repo creates. The API's
-- migration 031 does the same for its own.
--
-- auth_rls_initplan (0003): a policy that calls auth.uid() bare runs it once per row.
-- Wrapped in a sub-select, Postgres runs it once per statement. Same value, same rows
-- visible: only the plan changes. The expressions below are the live ones, read from
-- pg_policies on 2026-11-07, with nothing else touched.
--
-- multiple_permissive_policies (0006): kwami_programs had programs_read_own (SELECT)
-- beside programs_write_own (ALL), both with `auth.uid() = author_id`. ALL already
-- covers SELECT with that same condition, so the first one only made every read check
-- the condition twice. Dropping it leaves exactly the same rows visible.
--
-- unindexed_foreign_keys (0001): three foreign keys to auth.users with no index, so
-- deleting a user scanned each whole child table.

alter policy account_energy_read_own on public.account_energy
  using ((select auth.uid()) = user_id);

alter policy "Users can view own agent usage" on public.agent_usage
  using ((select auth.uid()) = user_id);

alter policy "Users can view own brain results" on public.brain_pending
  using ((select auth.uid()) = user_id);

alter policy "Users can view own brain spend" on public.brain_spend
  using ((select auth.uid()) = user_id);

alter policy energy_ledger_read_own on public.energy_ledger
  using (
    ((select auth.uid()) = user_id)
    or exists (
      select 1 from public.kwamis k
       where k.id = energy_ledger.kwami_id and k.author_id = (select auth.uid())
    )
  );

alter policy sessions_read on public.game_sessions
  using (
    ((select auth.uid()) = player_id)
    or exists (
      select 1 from public.kwamis k
       where k.id = game_sessions.kwami_id and k.author_id = (select auth.uid())
    )
  );

drop policy if exists programs_read_own on public.kwami_programs;

alter policy programs_write_own on public.kwami_programs
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

alter policy kwamis_insert_own on public.kwamis
  with check ((select auth.uid()) = author_id);

alter policy kwamis_read_published on public.kwamis
  using ((state <> 'draft'::kwami_state) or ((select auth.uid()) = author_id));

alter policy kwamis_update_own on public.kwamis
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

alter policy profiles_insert on public.profiles
  with check ((select auth.uid()) = id);

alter policy profiles_write on public.profiles
  using ((select auth.uid()) = id);

alter policy transcripts_read on public.transcript_turns
  using (
    exists (
      select 1 from public.game_sessions s
       where s.id = transcript_turns.session_id and s.player_id = (select auth.uid())
    )
  );

alter policy wallets_delete on public.wallet_identities
  using ((select auth.uid()) = user_id);

alter policy wallets_insert on public.wallet_identities
  with check ((select auth.uid()) = user_id);

alter policy wallets_own on public.wallet_identities
  using ((select auth.uid()) = user_id);

create index if not exists brain_pending_user_idx on public.brain_pending (user_id);
-- game_sessions_player_idx already exists, on player_wallet.
create index if not exists game_sessions_player_id_idx on public.game_sessions (player_id);
create index if not exists kwami_programs_author_idx on public.kwami_programs (author_id);
