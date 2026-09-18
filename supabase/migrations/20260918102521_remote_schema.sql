drop extension if exists "pg_net";

create type "public"."credit_model_type" as enum ('stt', 'llm', 'tts', 'realtime', 'tool', 'memory');

create type "public"."credit_transaction_type" as enum ('purchase', 'usage', 'bonus', 'refund');

create type "public"."kwami_calendar_event_type" as enum ('meeting', 'task', 'personal', 'reminder', 'focus', 'other');

create type "public"."kwami_channel_kind" as enum ('voice_phone', 'whatsapp', 'sms');

create type "public"."kwami_conversation_kind" as enum ('call', 'whatsapp');

create type "public"."kwami_email_category" as enum ('travel', 'bills', 'events', 'newsletters', 'personal', 'notifications', 'shopping', 'work', 'uncategorized');

create type "public"."kwami_event_direction" as enum ('inbound', 'outbound');

create type "public"."kwami_wallet_custody_type" as enum ('custodial_hsm_mpc', 'external', 'non_custodial_link');

create type "public"."kwami_wallet_status" as enum ('pending', 'active', 'rotating', 'disabled');

create type "public"."wallet_event_type" as enum ('intent_created', 'provider_update', 'confirmed', 'failed');

create type "public"."wallet_funding_provider" as enum ('phantom_transfer', 'card_provider');

create type "public"."wallet_funding_status" as enum ('pending', 'submitted', 'confirmed', 'failed', 'expired');


  create table "public"."credit_transactions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "type" public.credit_transaction_type not null,
    "amount" bigint not null,
    "balance_after" bigint not null,
    "description" text,
    "metadata" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."credit_transactions" enable row level security;


  create table "public"."credit_usage_logs" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "session_id" text not null,
    "model_type" public.credit_model_type not null,
    "model_id" text not null,
    "units_used" double precision not null,
    "cost_usd" double precision not null,
    "credits_charged" bigint not null,
    "created_at" timestamp with time zone not null default now(),
    "provider_cost_usd" double precision not null,
    "billed_cost_usd" double precision not null,
    "margin_usd" double precision not null,
    "requested_credits" bigint not null default 0,
    "settlement_status" text not null default 'charged'::text,
    "pricing_version" text not null,
    "pricing_source" text not null,
    "usage_metadata" jsonb not null default '{}'::jsonb
      );


alter table "public"."credit_usage_logs" enable row level security;


  create table "public"."kwami_calendar_events" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "kwami_id" uuid not null,
    "title" text not null,
    "description" text not null default ''::text,
    "starts_at" timestamp with time zone not null,
    "ends_at" timestamp with time zone not null,
    "all_day" boolean not null default false,
    "event_type" public.kwami_calendar_event_type not null default 'other'::public.kwami_calendar_event_type,
    "color" text not null default '#6366f1'::text,
    "location" text not null default ''::text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."kwami_calendar_events" enable row level security;


  create table "public"."kwami_call_events" (
    "id" uuid not null default gen_random_uuid(),
    "conversation_id" uuid,
    "channel_id" uuid not null,
    "user_id" uuid not null,
    "kwami_id" uuid not null,
    "direction" public.kwami_event_direction not null,
    "provider_call_sid" text,
    "livekit_room_name" text,
    "participant_identity" text,
    "from_number" text,
    "to_number" text,
    "status" text not null default 'queued'::text,
    "duration_seconds" integer,
    "error_code" text,
    "error_message" text,
    "provider_payload" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."kwami_call_events" enable row level security;


  create table "public"."kwami_channels" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "kwami_id" uuid not null,
    "kind" public.kwami_channel_kind not null,
    "provider" text not null default 'twilio'::text,
    "status" text not null default 'pending'::text,
    "phone_number" text not null,
    "display_name" text,
    "country_code" text not null default 'US'::text,
    "capabilities" jsonb not null default '{}'::jsonb,
    "provider_channel_sid" text,
    "provider_subresource_sid" text,
    "provider_sender" text,
    "livekit_outbound_trunk_id" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."kwami_channels" enable row level security;


  create table "public"."kwami_contacts" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "kwami_id" uuid not null,
    "display_name" text,
    "phone_number" text not null,
    "whatsapp_address" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "email" text,
    "notes" text,
    "instagram" text,
    "tiktok" text
      );


alter table "public"."kwami_contacts" enable row level security;


  create table "public"."kwami_conversations" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "kwami_id" uuid not null,
    "channel_id" uuid not null,
    "contact_id" uuid,
    "kind" public.kwami_conversation_kind not null,
    "status" text not null default 'active'::text,
    "external_thread_id" text,
    "last_inbound_at" timestamp with time zone,
    "last_outbound_at" timestamp with time zone,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."kwami_conversations" enable row level security;


  create table "public"."kwami_email_accounts" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "kwami_id" uuid not null,
    "username" text not null,
    "email_address" text generated always as ((username || '@kwami.io'::text)) stored,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."kwami_email_accounts" enable row level security;


  create table "public"."kwami_email_messages" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "user_id" uuid not null,
    "kwami_id" uuid not null,
    "direction" public.kwami_event_direction not null,
    "from_address" text not null,
    "to_addresses" jsonb not null default '[]'::jsonb,
    "cc_addresses" jsonb not null default '[]'::jsonb,
    "subject" text not null default ''::text,
    "body_text" text not null default ''::text,
    "body_html" text not null default ''::text,
    "headers" jsonb not null default '{}'::jsonb,
    "sendgrid_message_id" text,
    "category" public.kwami_email_category not null default 'uncategorized'::public.kwami_email_category,
    "action_card_data" jsonb not null default '{}'::jsonb,
    "is_read" boolean not null default false,
    "is_archived" boolean not null default false,
    "is_starred" boolean not null default false,
    "received_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."kwami_email_messages" enable row level security;


  create table "public"."kwami_message_events" (
    "id" uuid not null default gen_random_uuid(),
    "conversation_id" uuid,
    "channel_id" uuid not null,
    "contact_id" uuid,
    "user_id" uuid not null,
    "kwami_id" uuid not null,
    "direction" public.kwami_event_direction not null,
    "provider_message_sid" text,
    "provider_status" text,
    "from_address" text,
    "to_address" text,
    "body" text,
    "error_code" text,
    "error_message" text,
    "requires_followup" boolean not null default false,
    "provider_payload" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."kwami_message_events" enable row level security;


  create table "public"."kwami_wallet_key_refs" (
    "id" uuid not null default gen_random_uuid(),
    "wallet_id" uuid not null,
    "user_id" uuid not null,
    "kwami_id" uuid not null,
    "custody_provider" text not null,
    "key_ref" text not null,
    "key_version" integer not null default 1,
    "encryption_context" jsonb not null default '{}'::jsonb,
    "rotation_state" text not null default 'current'::text,
    "rotated_at" timestamp with time zone,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."kwami_wallet_key_refs" enable row level security;


  create table "public"."kwami_wallets" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "kwami_id" uuid not null,
    "chain" text not null default 'solana'::text,
    "network" text not null default 'mainnet-beta'::text,
    "custody_type" public.kwami_wallet_custody_type not null default 'custodial_hsm_mpc'::public.kwami_wallet_custody_type,
    "status" public.kwami_wallet_status not null default 'pending'::public.kwami_wallet_status,
    "public_key" text not null,
    "connected_wallet_pubkey" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."kwami_wallets" enable row level security;


  create table "public"."livekit_sessions" (
    "id" uuid not null default gen_random_uuid(),
    "room_name" text not null,
    "user_id" uuid not null,
    "kwami_id" uuid,
    "source" text not null default 'web'::text,
    "status" text not null default 'issued'::text,
    "hold_micro" bigint not null default 0,
    "issued_at" timestamp with time zone not null default now(),
    "last_seen_at" timestamp with time zone,
    "ended_at" timestamp with time zone
      );


alter table "public"."livekit_sessions" enable row level security;


  create table "public"."user_app_settings" (
    "user_id" uuid not null,
    "locale" text not null default 'en'::text,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."user_app_settings" enable row level security;


  create table "public"."user_credits" (
    "user_id" uuid not null,
    "balance" bigint not null default 0,
    "lifetime_purchased" bigint not null default 0,
    "lifetime_used" bigint not null default 0,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."user_credits" enable row level security;


  create table "public"."user_kwamis" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "name" text not null default 'Kwami'::text,
    "emoji" text not null default '🌸'::text,
    "colors" jsonb not null default '{"x": "#00d9ff", "y": "#a855f7", "z": "#22c55e"}'::jsonb,
    "config" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."user_kwamis" enable row level security;


  create table "public"."waitlist_signups" (
    "id" uuid not null default gen_random_uuid(),
    "email" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."waitlist_signups" enable row level security;


  create table "public"."wallet_balances_cache" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "kwami_id" uuid not null,
    "wallet_id" uuid not null,
    "mint_address" text not null,
    "symbol" text not null,
    "amount" numeric(36,12) not null default 0,
    "amount_usd" numeric(36,12),
    "last_onchain_slot" bigint,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."wallet_balances_cache" enable row level security;


  create table "public"."wallet_funding_events" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "kwami_id" uuid not null,
    "wallet_id" uuid not null,
    "intent_id" uuid not null,
    "event_type" public.wallet_event_type not null,
    "provider" public.wallet_funding_provider not null,
    "provider_event_id" text,
    "transaction_signature" text,
    "amount_received" numeric(36,12),
    "confirmed_at" timestamp with time zone,
    "payload" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."wallet_funding_events" enable row level security;


  create table "public"."wallet_funding_intents" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "kwami_id" uuid not null,
    "wallet_id" uuid not null,
    "provider" public.wallet_funding_provider not null,
    "status" public.wallet_funding_status not null default 'pending'::public.wallet_funding_status,
    "asset_mint" text not null,
    "asset_symbol" text not null,
    "expected_amount" numeric(36,12) not null,
    "expected_amount_usd" numeric(36,12),
    "sender_wallet_pubkey" text,
    "destination_wallet_pubkey" text not null,
    "provider_intent_id" text,
    "provider_redirect_url" text,
    "idempotency_key" text not null,
    "expires_at" timestamp with time zone,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."wallet_funding_intents" enable row level security;


  create table "public"."wallet_token_allowlist" (
    "id" uuid not null default gen_random_uuid(),
    "chain" text not null default 'solana'::text,
    "mint_address" text not null,
    "symbol" text not null,
    "decimals" integer not null default 0,
    "is_stablecoin" boolean not null default false,
    "is_default" boolean not null default false,
    "created_by_user_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."wallet_token_allowlist" enable row level security;


  create table "public"."wallet_transactions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "kwami_id" uuid not null,
    "wallet_id" uuid not null,
    "mint_address" text not null,
    "symbol" text not null,
    "direction" text not null,
    "amount" numeric(36,12) not null,
    "amount_usd" numeric(36,12),
    "transaction_signature" text not null,
    "related_intent_id" uuid,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."wallet_transactions" enable row level security;

CREATE UNIQUE INDEX credit_transactions_pkey ON public.credit_transactions USING btree (id);

CREATE UNIQUE INDEX credit_usage_logs_pkey ON public.credit_usage_logs USING btree (id);

CREATE INDEX idx_credit_transactions_user ON public.credit_transactions USING btree (user_id, created_at DESC);

CREATE INDEX idx_credit_usage_logs_session ON public.credit_usage_logs USING btree (session_id);

CREATE INDEX idx_credit_usage_logs_settlement ON public.credit_usage_logs USING btree (user_id, settlement_status, created_at DESC);

CREATE INDEX idx_credit_usage_logs_user ON public.credit_usage_logs USING btree (user_id, created_at DESC);

CREATE INDEX idx_kwami_calendar_events_user_kwami_end ON public.kwami_calendar_events USING btree (user_id, kwami_id, ends_at);

CREATE INDEX idx_kwami_calendar_events_user_kwami_start ON public.kwami_calendar_events USING btree (user_id, kwami_id, starts_at);

CREATE UNIQUE INDEX idx_kwami_call_events_provider_sid ON public.kwami_call_events USING btree (provider_call_sid) WHERE (provider_call_sid IS NOT NULL);

CREATE INDEX idx_kwami_call_events_user_kwami ON public.kwami_call_events USING btree (user_id, kwami_id, created_at DESC);

CREATE UNIQUE INDEX idx_kwami_channels_provider_unique ON public.kwami_channels USING btree (provider, kind, phone_number);

CREATE INDEX idx_kwami_channels_user_kwami ON public.kwami_channels USING btree (user_id, kwami_id, kind);

CREATE UNIQUE INDEX idx_kwami_contacts_unique_phone ON public.kwami_contacts USING btree (user_id, kwami_id, phone_number);

CREATE INDEX idx_kwami_contacts_user_kwami_updated ON public.kwami_contacts USING btree (user_id, kwami_id, updated_at DESC);

CREATE INDEX idx_kwami_conversations_user_kwami ON public.kwami_conversations USING btree (user_id, kwami_id, updated_at DESC);

CREATE UNIQUE INDEX idx_kwami_email_accounts_user_kwami ON public.kwami_email_accounts USING btree (user_id, kwami_id);

CREATE UNIQUE INDEX idx_kwami_email_accounts_username ON public.kwami_email_accounts USING btree (username);

CREATE INDEX idx_kwami_email_messages_category ON public.kwami_email_messages USING btree (user_id, kwami_id, category, received_at DESC);

CREATE INDEX idx_kwami_email_messages_inbox ON public.kwami_email_messages USING btree (user_id, kwami_id, is_archived, received_at DESC);

CREATE UNIQUE INDEX idx_kwami_email_messages_sendgrid_id ON public.kwami_email_messages USING btree (sendgrid_message_id) WHERE (sendgrid_message_id IS NOT NULL);

CREATE UNIQUE INDEX idx_kwami_message_events_provider_sid ON public.kwami_message_events USING btree (provider_message_sid) WHERE (provider_message_sid IS NOT NULL);

CREATE INDEX idx_kwami_message_events_user_kwami ON public.kwami_message_events USING btree (user_id, kwami_id, created_at DESC);

CREATE INDEX idx_kwami_wallet_key_refs_user_kwami ON public.kwami_wallet_key_refs USING btree (user_id, kwami_id);

CREATE UNIQUE INDEX idx_kwami_wallets_public_key_unique ON public.kwami_wallets USING btree (public_key);

CREATE INDEX idx_kwami_wallets_user_kwami ON public.kwami_wallets USING btree (user_id, kwami_id);

CREATE INDEX idx_livekit_sessions_kwami ON public.livekit_sessions USING btree (kwami_id, issued_at DESC);

CREATE INDEX idx_livekit_sessions_user_active ON public.livekit_sessions USING btree (user_id, status) WHERE (status = ANY (ARRAY['issued'::text, 'active'::text]));

CREATE INDEX idx_user_kwamis_updated ON public.user_kwamis USING btree (user_id, updated_at DESC);

CREATE INDEX idx_user_kwamis_user ON public.user_kwamis USING btree (user_id);

CREATE INDEX idx_wallet_balances_cache_user_kwami ON public.wallet_balances_cache USING btree (user_id, kwami_id, updated_at DESC);

CREATE INDEX idx_wallet_funding_events_user_kwami ON public.wallet_funding_events USING btree (user_id, kwami_id, created_at DESC);

CREATE UNIQUE INDEX idx_wallet_funding_intents_provider_intent ON public.wallet_funding_intents USING btree (provider, provider_intent_id) WHERE (provider_intent_id IS NOT NULL);

CREATE INDEX idx_wallet_funding_intents_user_kwami ON public.wallet_funding_intents USING btree (user_id, kwami_id, created_at DESC);

CREATE INDEX idx_wallet_token_allowlist_symbol ON public.wallet_token_allowlist USING btree (symbol);

CREATE INDEX idx_wallet_transactions_user_kwami ON public.wallet_transactions USING btree (user_id, kwami_id, created_at DESC);

CREATE INDEX idx_wallet_transactions_wallet_mint ON public.wallet_transactions USING btree (wallet_id, mint_address, created_at DESC);

CREATE UNIQUE INDEX kwami_calendar_events_pkey ON public.kwami_calendar_events USING btree (id);

CREATE UNIQUE INDEX kwami_call_events_pkey ON public.kwami_call_events USING btree (id);

CREATE UNIQUE INDEX kwami_channels_pkey ON public.kwami_channels USING btree (id);

CREATE UNIQUE INDEX kwami_contacts_pkey ON public.kwami_contacts USING btree (id);

CREATE UNIQUE INDEX kwami_conversations_pkey ON public.kwami_conversations USING btree (id);

CREATE UNIQUE INDEX kwami_email_accounts_pkey ON public.kwami_email_accounts USING btree (id);

CREATE UNIQUE INDEX kwami_email_messages_pkey ON public.kwami_email_messages USING btree (id);

CREATE UNIQUE INDEX kwami_message_events_pkey ON public.kwami_message_events USING btree (id);

CREATE UNIQUE INDEX kwami_wallet_key_refs_pkey ON public.kwami_wallet_key_refs USING btree (id);

CREATE UNIQUE INDEX kwami_wallet_key_refs_wallet_id_key_version_key ON public.kwami_wallet_key_refs USING btree (wallet_id, key_version);

CREATE UNIQUE INDEX kwami_wallets_kwami_id_key ON public.kwami_wallets USING btree (kwami_id);

CREATE UNIQUE INDEX kwami_wallets_pkey ON public.kwami_wallets USING btree (id);

CREATE UNIQUE INDEX livekit_sessions_pkey ON public.livekit_sessions USING btree (id);

CREATE UNIQUE INDEX livekit_sessions_room_name_key ON public.livekit_sessions USING btree (room_name);

CREATE UNIQUE INDEX user_app_settings_pkey ON public.user_app_settings USING btree (user_id);

CREATE UNIQUE INDEX user_credits_pkey ON public.user_credits USING btree (user_id);

CREATE UNIQUE INDEX user_kwamis_pkey ON public.user_kwamis USING btree (id);

CREATE UNIQUE INDEX waitlist_signups_email_lower_key ON public.waitlist_signups USING btree (lower(email));

CREATE UNIQUE INDEX waitlist_signups_pkey ON public.waitlist_signups USING btree (id);

CREATE UNIQUE INDEX wallet_balances_cache_pkey ON public.wallet_balances_cache USING btree (id);

CREATE UNIQUE INDEX wallet_balances_cache_wallet_id_mint_address_key ON public.wallet_balances_cache USING btree (wallet_id, mint_address);

CREATE UNIQUE INDEX wallet_funding_events_pkey ON public.wallet_funding_events USING btree (id);

CREATE UNIQUE INDEX wallet_funding_events_provider_provider_event_id_key ON public.wallet_funding_events USING btree (provider, provider_event_id);

CREATE UNIQUE INDEX wallet_funding_intents_idempotency_key_key ON public.wallet_funding_intents USING btree (idempotency_key);

CREATE UNIQUE INDEX wallet_funding_intents_pkey ON public.wallet_funding_intents USING btree (id);

CREATE UNIQUE INDEX wallet_token_allowlist_chain_mint_address_key ON public.wallet_token_allowlist USING btree (chain, mint_address);

CREATE UNIQUE INDEX wallet_token_allowlist_pkey ON public.wallet_token_allowlist USING btree (id);

CREATE UNIQUE INDEX wallet_transactions_pkey ON public.wallet_transactions USING btree (id);

CREATE UNIQUE INDEX wallet_transactions_transaction_signature_mint_address_amou_key ON public.wallet_transactions USING btree (transaction_signature, mint_address, amount, direction);

alter table "public"."credit_transactions" add constraint "credit_transactions_pkey" PRIMARY KEY using index "credit_transactions_pkey";

alter table "public"."credit_usage_logs" add constraint "credit_usage_logs_pkey" PRIMARY KEY using index "credit_usage_logs_pkey";

alter table "public"."kwami_calendar_events" add constraint "kwami_calendar_events_pkey" PRIMARY KEY using index "kwami_calendar_events_pkey";

alter table "public"."kwami_call_events" add constraint "kwami_call_events_pkey" PRIMARY KEY using index "kwami_call_events_pkey";

alter table "public"."kwami_channels" add constraint "kwami_channels_pkey" PRIMARY KEY using index "kwami_channels_pkey";

alter table "public"."kwami_contacts" add constraint "kwami_contacts_pkey" PRIMARY KEY using index "kwami_contacts_pkey";

alter table "public"."kwami_conversations" add constraint "kwami_conversations_pkey" PRIMARY KEY using index "kwami_conversations_pkey";

alter table "public"."kwami_email_accounts" add constraint "kwami_email_accounts_pkey" PRIMARY KEY using index "kwami_email_accounts_pkey";

alter table "public"."kwami_email_messages" add constraint "kwami_email_messages_pkey" PRIMARY KEY using index "kwami_email_messages_pkey";

alter table "public"."kwami_message_events" add constraint "kwami_message_events_pkey" PRIMARY KEY using index "kwami_message_events_pkey";

alter table "public"."kwami_wallet_key_refs" add constraint "kwami_wallet_key_refs_pkey" PRIMARY KEY using index "kwami_wallet_key_refs_pkey";

alter table "public"."kwami_wallets" add constraint "kwami_wallets_pkey" PRIMARY KEY using index "kwami_wallets_pkey";

alter table "public"."livekit_sessions" add constraint "livekit_sessions_pkey" PRIMARY KEY using index "livekit_sessions_pkey";

alter table "public"."user_app_settings" add constraint "user_app_settings_pkey" PRIMARY KEY using index "user_app_settings_pkey";

alter table "public"."user_credits" add constraint "user_credits_pkey" PRIMARY KEY using index "user_credits_pkey";

alter table "public"."user_kwamis" add constraint "user_kwamis_pkey" PRIMARY KEY using index "user_kwamis_pkey";

alter table "public"."waitlist_signups" add constraint "waitlist_signups_pkey" PRIMARY KEY using index "waitlist_signups_pkey";

alter table "public"."wallet_balances_cache" add constraint "wallet_balances_cache_pkey" PRIMARY KEY using index "wallet_balances_cache_pkey";

alter table "public"."wallet_funding_events" add constraint "wallet_funding_events_pkey" PRIMARY KEY using index "wallet_funding_events_pkey";

alter table "public"."wallet_funding_intents" add constraint "wallet_funding_intents_pkey" PRIMARY KEY using index "wallet_funding_intents_pkey";

alter table "public"."wallet_token_allowlist" add constraint "wallet_token_allowlist_pkey" PRIMARY KEY using index "wallet_token_allowlist_pkey";

alter table "public"."wallet_transactions" add constraint "wallet_transactions_pkey" PRIMARY KEY using index "wallet_transactions_pkey";

alter table "public"."credit_transactions" add constraint "credit_transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."credit_transactions" validate constraint "credit_transactions_user_id_fkey";

alter table "public"."credit_usage_logs" add constraint "credit_usage_logs_settlement_status_check" CHECK ((settlement_status = ANY (ARRAY['pending'::text, 'charged'::text, 'insufficient_credits'::text, 'skipped'::text]))) not valid;

alter table "public"."credit_usage_logs" validate constraint "credit_usage_logs_settlement_status_check";

alter table "public"."credit_usage_logs" add constraint "credit_usage_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."credit_usage_logs" validate constraint "credit_usage_logs_user_id_fkey";

alter table "public"."kwami_calendar_events" add constraint "kwami_calendar_events_kwami_id_fkey" FOREIGN KEY (kwami_id) REFERENCES public.user_kwamis(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_calendar_events" validate constraint "kwami_calendar_events_kwami_id_fkey";

alter table "public"."kwami_calendar_events" add constraint "kwami_calendar_events_time_range" CHECK ((ends_at >= starts_at)) not valid;

alter table "public"."kwami_calendar_events" validate constraint "kwami_calendar_events_time_range";

alter table "public"."kwami_calendar_events" add constraint "kwami_calendar_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_calendar_events" validate constraint "kwami_calendar_events_user_id_fkey";

alter table "public"."kwami_call_events" add constraint "kwami_call_events_channel_id_fkey" FOREIGN KEY (channel_id) REFERENCES public.kwami_channels(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_call_events" validate constraint "kwami_call_events_channel_id_fkey";

alter table "public"."kwami_call_events" add constraint "kwami_call_events_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.kwami_conversations(id) ON DELETE SET NULL not valid;

alter table "public"."kwami_call_events" validate constraint "kwami_call_events_conversation_id_fkey";

alter table "public"."kwami_call_events" add constraint "kwami_call_events_kwami_id_fkey" FOREIGN KEY (kwami_id) REFERENCES public.user_kwamis(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_call_events" validate constraint "kwami_call_events_kwami_id_fkey";

alter table "public"."kwami_call_events" add constraint "kwami_call_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_call_events" validate constraint "kwami_call_events_user_id_fkey";

alter table "public"."kwami_channels" add constraint "kwami_channels_kwami_id_fkey" FOREIGN KEY (kwami_id) REFERENCES public.user_kwamis(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_channels" validate constraint "kwami_channels_kwami_id_fkey";

alter table "public"."kwami_channels" add constraint "kwami_channels_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_channels" validate constraint "kwami_channels_user_id_fkey";

alter table "public"."kwami_contacts" add constraint "kwami_contacts_kwami_id_fkey" FOREIGN KEY (kwami_id) REFERENCES public.user_kwamis(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_contacts" validate constraint "kwami_contacts_kwami_id_fkey";

alter table "public"."kwami_contacts" add constraint "kwami_contacts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_contacts" validate constraint "kwami_contacts_user_id_fkey";

alter table "public"."kwami_conversations" add constraint "kwami_conversations_channel_id_fkey" FOREIGN KEY (channel_id) REFERENCES public.kwami_channels(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_conversations" validate constraint "kwami_conversations_channel_id_fkey";

alter table "public"."kwami_conversations" add constraint "kwami_conversations_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES public.kwami_contacts(id) ON DELETE SET NULL not valid;

alter table "public"."kwami_conversations" validate constraint "kwami_conversations_contact_id_fkey";

alter table "public"."kwami_conversations" add constraint "kwami_conversations_kwami_id_fkey" FOREIGN KEY (kwami_id) REFERENCES public.user_kwamis(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_conversations" validate constraint "kwami_conversations_kwami_id_fkey";

alter table "public"."kwami_conversations" add constraint "kwami_conversations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_conversations" validate constraint "kwami_conversations_user_id_fkey";

alter table "public"."kwami_email_accounts" add constraint "kwami_email_accounts_kwami_id_fkey" FOREIGN KEY (kwami_id) REFERENCES public.user_kwamis(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_email_accounts" validate constraint "kwami_email_accounts_kwami_id_fkey";

alter table "public"."kwami_email_accounts" add constraint "kwami_email_accounts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_email_accounts" validate constraint "kwami_email_accounts_user_id_fkey";

alter table "public"."kwami_email_messages" add constraint "kwami_email_messages_account_id_fkey" FOREIGN KEY (account_id) REFERENCES public.kwami_email_accounts(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_email_messages" validate constraint "kwami_email_messages_account_id_fkey";

alter table "public"."kwami_email_messages" add constraint "kwami_email_messages_kwami_id_fkey" FOREIGN KEY (kwami_id) REFERENCES public.user_kwamis(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_email_messages" validate constraint "kwami_email_messages_kwami_id_fkey";

alter table "public"."kwami_email_messages" add constraint "kwami_email_messages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_email_messages" validate constraint "kwami_email_messages_user_id_fkey";

alter table "public"."kwami_message_events" add constraint "kwami_message_events_channel_id_fkey" FOREIGN KEY (channel_id) REFERENCES public.kwami_channels(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_message_events" validate constraint "kwami_message_events_channel_id_fkey";

alter table "public"."kwami_message_events" add constraint "kwami_message_events_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES public.kwami_contacts(id) ON DELETE SET NULL not valid;

alter table "public"."kwami_message_events" validate constraint "kwami_message_events_contact_id_fkey";

alter table "public"."kwami_message_events" add constraint "kwami_message_events_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.kwami_conversations(id) ON DELETE SET NULL not valid;

alter table "public"."kwami_message_events" validate constraint "kwami_message_events_conversation_id_fkey";

alter table "public"."kwami_message_events" add constraint "kwami_message_events_kwami_id_fkey" FOREIGN KEY (kwami_id) REFERENCES public.user_kwamis(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_message_events" validate constraint "kwami_message_events_kwami_id_fkey";

alter table "public"."kwami_message_events" add constraint "kwami_message_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_message_events" validate constraint "kwami_message_events_user_id_fkey";

alter table "public"."kwami_wallet_key_refs" add constraint "kwami_wallet_key_refs_kwami_id_fkey" FOREIGN KEY (kwami_id) REFERENCES public.user_kwamis(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_wallet_key_refs" validate constraint "kwami_wallet_key_refs_kwami_id_fkey";

alter table "public"."kwami_wallet_key_refs" add constraint "kwami_wallet_key_refs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_wallet_key_refs" validate constraint "kwami_wallet_key_refs_user_id_fkey";

alter table "public"."kwami_wallet_key_refs" add constraint "kwami_wallet_key_refs_wallet_id_fkey" FOREIGN KEY (wallet_id) REFERENCES public.kwami_wallets(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_wallet_key_refs" validate constraint "kwami_wallet_key_refs_wallet_id_fkey";

alter table "public"."kwami_wallet_key_refs" add constraint "kwami_wallet_key_refs_wallet_id_key_version_key" UNIQUE using index "kwami_wallet_key_refs_wallet_id_key_version_key";

alter table "public"."kwami_wallets" add constraint "kwami_wallets_kwami_id_fkey" FOREIGN KEY (kwami_id) REFERENCES public.user_kwamis(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_wallets" validate constraint "kwami_wallets_kwami_id_fkey";

alter table "public"."kwami_wallets" add constraint "kwami_wallets_kwami_id_key" UNIQUE using index "kwami_wallets_kwami_id_key";

alter table "public"."kwami_wallets" add constraint "kwami_wallets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."kwami_wallets" validate constraint "kwami_wallets_user_id_fkey";

alter table "public"."livekit_sessions" add constraint "livekit_sessions_hold_micro_check" CHECK ((hold_micro >= 0)) not valid;

alter table "public"."livekit_sessions" validate constraint "livekit_sessions_hold_micro_check";

alter table "public"."livekit_sessions" add constraint "livekit_sessions_kwami_id_fkey" FOREIGN KEY (kwami_id) REFERENCES public.user_kwamis(id) ON DELETE SET NULL not valid;

alter table "public"."livekit_sessions" validate constraint "livekit_sessions_kwami_id_fkey";

alter table "public"."livekit_sessions" add constraint "livekit_sessions_room_name_key" UNIQUE using index "livekit_sessions_room_name_key";

alter table "public"."livekit_sessions" add constraint "livekit_sessions_source_check" CHECK ((source = ANY (ARRAY['web'::text, 'sip_inbound'::text, 'sip_outbound'::text]))) not valid;

alter table "public"."livekit_sessions" validate constraint "livekit_sessions_source_check";

alter table "public"."livekit_sessions" add constraint "livekit_sessions_status_check" CHECK ((status = ANY (ARRAY['issued'::text, 'active'::text, 'ended'::text, 'abandoned'::text]))) not valid;

alter table "public"."livekit_sessions" validate constraint "livekit_sessions_status_check";

alter table "public"."livekit_sessions" add constraint "livekit_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."livekit_sessions" validate constraint "livekit_sessions_user_id_fkey";

alter table "public"."user_app_settings" add constraint "user_app_settings_locale_check" CHECK ((locale = ANY (ARRAY['en'::text, 'es'::text]))) not valid;

alter table "public"."user_app_settings" validate constraint "user_app_settings_locale_check";

alter table "public"."user_app_settings" add constraint "user_app_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_app_settings" validate constraint "user_app_settings_user_id_fkey";

alter table "public"."user_credits" add constraint "user_credits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_credits" validate constraint "user_credits_user_id_fkey";

alter table "public"."user_kwamis" add constraint "user_kwamis_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_kwamis" validate constraint "user_kwamis_user_id_fkey";

alter table "public"."wallet_balances_cache" add constraint "wallet_balances_cache_kwami_id_fkey" FOREIGN KEY (kwami_id) REFERENCES public.user_kwamis(id) ON DELETE CASCADE not valid;

alter table "public"."wallet_balances_cache" validate constraint "wallet_balances_cache_kwami_id_fkey";

alter table "public"."wallet_balances_cache" add constraint "wallet_balances_cache_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."wallet_balances_cache" validate constraint "wallet_balances_cache_user_id_fkey";

alter table "public"."wallet_balances_cache" add constraint "wallet_balances_cache_wallet_id_fkey" FOREIGN KEY (wallet_id) REFERENCES public.kwami_wallets(id) ON DELETE CASCADE not valid;

alter table "public"."wallet_balances_cache" validate constraint "wallet_balances_cache_wallet_id_fkey";

alter table "public"."wallet_balances_cache" add constraint "wallet_balances_cache_wallet_id_mint_address_key" UNIQUE using index "wallet_balances_cache_wallet_id_mint_address_key";

alter table "public"."wallet_funding_events" add constraint "wallet_funding_events_intent_id_fkey" FOREIGN KEY (intent_id) REFERENCES public.wallet_funding_intents(id) ON DELETE CASCADE not valid;

alter table "public"."wallet_funding_events" validate constraint "wallet_funding_events_intent_id_fkey";

alter table "public"."wallet_funding_events" add constraint "wallet_funding_events_kwami_id_fkey" FOREIGN KEY (kwami_id) REFERENCES public.user_kwamis(id) ON DELETE CASCADE not valid;

alter table "public"."wallet_funding_events" validate constraint "wallet_funding_events_kwami_id_fkey";

alter table "public"."wallet_funding_events" add constraint "wallet_funding_events_provider_provider_event_id_key" UNIQUE using index "wallet_funding_events_provider_provider_event_id_key";

alter table "public"."wallet_funding_events" add constraint "wallet_funding_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."wallet_funding_events" validate constraint "wallet_funding_events_user_id_fkey";

alter table "public"."wallet_funding_events" add constraint "wallet_funding_events_wallet_id_fkey" FOREIGN KEY (wallet_id) REFERENCES public.kwami_wallets(id) ON DELETE CASCADE not valid;

alter table "public"."wallet_funding_events" validate constraint "wallet_funding_events_wallet_id_fkey";

alter table "public"."wallet_funding_intents" add constraint "wallet_funding_intents_idempotency_key_key" UNIQUE using index "wallet_funding_intents_idempotency_key_key";

alter table "public"."wallet_funding_intents" add constraint "wallet_funding_intents_kwami_id_fkey" FOREIGN KEY (kwami_id) REFERENCES public.user_kwamis(id) ON DELETE CASCADE not valid;

alter table "public"."wallet_funding_intents" validate constraint "wallet_funding_intents_kwami_id_fkey";

alter table "public"."wallet_funding_intents" add constraint "wallet_funding_intents_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."wallet_funding_intents" validate constraint "wallet_funding_intents_user_id_fkey";

alter table "public"."wallet_funding_intents" add constraint "wallet_funding_intents_wallet_id_fkey" FOREIGN KEY (wallet_id) REFERENCES public.kwami_wallets(id) ON DELETE CASCADE not valid;

alter table "public"."wallet_funding_intents" validate constraint "wallet_funding_intents_wallet_id_fkey";

alter table "public"."wallet_token_allowlist" add constraint "wallet_token_allowlist_chain_mint_address_key" UNIQUE using index "wallet_token_allowlist_chain_mint_address_key";

alter table "public"."wallet_token_allowlist" add constraint "wallet_token_allowlist_created_by_user_id_fkey" FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."wallet_token_allowlist" validate constraint "wallet_token_allowlist_created_by_user_id_fkey";

alter table "public"."wallet_transactions" add constraint "wallet_transactions_kwami_id_fkey" FOREIGN KEY (kwami_id) REFERENCES public.user_kwamis(id) ON DELETE CASCADE not valid;

alter table "public"."wallet_transactions" validate constraint "wallet_transactions_kwami_id_fkey";

alter table "public"."wallet_transactions" add constraint "wallet_transactions_related_intent_id_fkey" FOREIGN KEY (related_intent_id) REFERENCES public.wallet_funding_intents(id) ON DELETE SET NULL not valid;

alter table "public"."wallet_transactions" validate constraint "wallet_transactions_related_intent_id_fkey";

alter table "public"."wallet_transactions" add constraint "wallet_transactions_transaction_signature_mint_address_amou_key" UNIQUE using index "wallet_transactions_transaction_signature_mint_address_amou_key";

alter table "public"."wallet_transactions" add constraint "wallet_transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."wallet_transactions" validate constraint "wallet_transactions_user_id_fkey";

alter table "public"."wallet_transactions" add constraint "wallet_transactions_wallet_id_fkey" FOREIGN KEY (wallet_id) REFERENCES public.kwami_wallets(id) ON DELETE CASCADE not valid;

alter table "public"."wallet_transactions" validate constraint "wallet_transactions_wallet_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.add_credits(p_user_id uuid, p_amount bigint, p_type public.credit_transaction_type DEFAULT 'purchase'::public.credit_transaction_type, p_description text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    new_balance bigint;
BEGIN
    -- Upsert: create row if user doesn't have one yet (edge case)
    INSERT INTO user_credits (user_id, balance, lifetime_purchased, lifetime_used)
    VALUES (p_user_id, p_amount, p_amount, 0)
    ON CONFLICT (user_id) DO UPDATE
    SET balance            = user_credits.balance + p_amount,
        lifetime_purchased = user_credits.lifetime_purchased + p_amount,
        updated_at         = now()
    RETURNING balance INTO new_balance;

    INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, metadata)
    VALUES (p_user_id, p_type, p_amount, new_balance, p_description, p_metadata);

    RETURN new_balance;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.deduct_credits(p_user_id uuid, p_amount bigint, p_description text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    new_balance bigint;
BEGIN
    UPDATE user_credits
    SET balance     = balance - p_amount,
        lifetime_used = lifetime_used + p_amount,
        updated_at  = now()
    WHERE user_id   = p_user_id
      AND balance  >= p_amount
    RETURNING balance INTO new_balance;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;

    INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, metadata)
    VALUES (p_user_id, 'usage', -p_amount, new_balance, p_description, p_metadata);

    RETURN new_balance;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    welcome_bonus bigint := 500000;  -- 500 credits in micro-credits
BEGIN
    INSERT INTO user_credits (user_id, balance, lifetime_purchased, lifetime_used)
    VALUES (NEW.id, welcome_bonus, 0, 0);

    INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, metadata)
    VALUES (
        NEW.id,
        'bonus',
        welcome_bonus,
        welcome_bonus,
        'Welcome bonus - 500 free credits',
        '{"reason": "welcome_bonus"}'::jsonb
    );

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_kwami_communications_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_user_app_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_user_kwamis_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_wallet_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."account_energy" to "anon";

grant insert on table "public"."account_energy" to "anon";

grant select on table "public"."account_energy" to "anon";

grant update on table "public"."account_energy" to "anon";

grant delete on table "public"."account_energy" to "authenticated";

grant insert on table "public"."account_energy" to "authenticated";

grant select on table "public"."account_energy" to "authenticated";

grant update on table "public"."account_energy" to "authenticated";

grant delete on table "public"."account_energy" to "service_role";

grant insert on table "public"."account_energy" to "service_role";

grant select on table "public"."account_energy" to "service_role";

grant update on table "public"."account_energy" to "service_role";

grant delete on table "public"."credit_transactions" to "anon";

grant insert on table "public"."credit_transactions" to "anon";

grant references on table "public"."credit_transactions" to "anon";

grant select on table "public"."credit_transactions" to "anon";

grant trigger on table "public"."credit_transactions" to "anon";

grant truncate on table "public"."credit_transactions" to "anon";

grant update on table "public"."credit_transactions" to "anon";

grant delete on table "public"."credit_transactions" to "authenticated";

grant insert on table "public"."credit_transactions" to "authenticated";

grant references on table "public"."credit_transactions" to "authenticated";

grant select on table "public"."credit_transactions" to "authenticated";

grant trigger on table "public"."credit_transactions" to "authenticated";

grant truncate on table "public"."credit_transactions" to "authenticated";

grant update on table "public"."credit_transactions" to "authenticated";

grant delete on table "public"."credit_transactions" to "service_role";

grant insert on table "public"."credit_transactions" to "service_role";

grant references on table "public"."credit_transactions" to "service_role";

grant select on table "public"."credit_transactions" to "service_role";

grant trigger on table "public"."credit_transactions" to "service_role";

grant truncate on table "public"."credit_transactions" to "service_role";

grant update on table "public"."credit_transactions" to "service_role";

grant delete on table "public"."credit_usage_logs" to "anon";

grant insert on table "public"."credit_usage_logs" to "anon";

grant references on table "public"."credit_usage_logs" to "anon";

grant select on table "public"."credit_usage_logs" to "anon";

grant trigger on table "public"."credit_usage_logs" to "anon";

grant truncate on table "public"."credit_usage_logs" to "anon";

grant update on table "public"."credit_usage_logs" to "anon";

grant delete on table "public"."credit_usage_logs" to "authenticated";

grant insert on table "public"."credit_usage_logs" to "authenticated";

grant references on table "public"."credit_usage_logs" to "authenticated";

grant select on table "public"."credit_usage_logs" to "authenticated";

grant trigger on table "public"."credit_usage_logs" to "authenticated";

grant truncate on table "public"."credit_usage_logs" to "authenticated";

grant update on table "public"."credit_usage_logs" to "authenticated";

grant delete on table "public"."credit_usage_logs" to "service_role";

grant insert on table "public"."credit_usage_logs" to "service_role";

grant references on table "public"."credit_usage_logs" to "service_role";

grant select on table "public"."credit_usage_logs" to "service_role";

grant trigger on table "public"."credit_usage_logs" to "service_role";

grant truncate on table "public"."credit_usage_logs" to "service_role";

grant update on table "public"."credit_usage_logs" to "service_role";

grant delete on table "public"."energy_ledger" to "anon";

grant insert on table "public"."energy_ledger" to "anon";

grant select on table "public"."energy_ledger" to "anon";

grant update on table "public"."energy_ledger" to "anon";

grant delete on table "public"."energy_ledger" to "authenticated";

grant insert on table "public"."energy_ledger" to "authenticated";

grant select on table "public"."energy_ledger" to "authenticated";

grant update on table "public"."energy_ledger" to "authenticated";

grant delete on table "public"."energy_ledger" to "service_role";

grant insert on table "public"."energy_ledger" to "service_role";

grant select on table "public"."energy_ledger" to "service_role";

grant update on table "public"."energy_ledger" to "service_role";

grant delete on table "public"."game_sessions" to "anon";

grant insert on table "public"."game_sessions" to "anon";

grant select on table "public"."game_sessions" to "anon";

grant update on table "public"."game_sessions" to "anon";

grant delete on table "public"."game_sessions" to "authenticated";

grant insert on table "public"."game_sessions" to "authenticated";

grant select on table "public"."game_sessions" to "authenticated";

grant update on table "public"."game_sessions" to "authenticated";

grant delete on table "public"."game_sessions" to "service_role";

grant insert on table "public"."game_sessions" to "service_role";

grant select on table "public"."game_sessions" to "service_role";

grant update on table "public"."game_sessions" to "service_role";

grant delete on table "public"."kwami_calendar_events" to "anon";

grant insert on table "public"."kwami_calendar_events" to "anon";

grant references on table "public"."kwami_calendar_events" to "anon";

grant select on table "public"."kwami_calendar_events" to "anon";

grant trigger on table "public"."kwami_calendar_events" to "anon";

grant truncate on table "public"."kwami_calendar_events" to "anon";

grant update on table "public"."kwami_calendar_events" to "anon";

grant delete on table "public"."kwami_calendar_events" to "authenticated";

grant insert on table "public"."kwami_calendar_events" to "authenticated";

grant references on table "public"."kwami_calendar_events" to "authenticated";

grant select on table "public"."kwami_calendar_events" to "authenticated";

grant trigger on table "public"."kwami_calendar_events" to "authenticated";

grant truncate on table "public"."kwami_calendar_events" to "authenticated";

grant update on table "public"."kwami_calendar_events" to "authenticated";

grant delete on table "public"."kwami_calendar_events" to "service_role";

grant insert on table "public"."kwami_calendar_events" to "service_role";

grant references on table "public"."kwami_calendar_events" to "service_role";

grant select on table "public"."kwami_calendar_events" to "service_role";

grant trigger on table "public"."kwami_calendar_events" to "service_role";

grant truncate on table "public"."kwami_calendar_events" to "service_role";

grant update on table "public"."kwami_calendar_events" to "service_role";

grant delete on table "public"."kwami_call_events" to "anon";

grant insert on table "public"."kwami_call_events" to "anon";

grant references on table "public"."kwami_call_events" to "anon";

grant select on table "public"."kwami_call_events" to "anon";

grant trigger on table "public"."kwami_call_events" to "anon";

grant truncate on table "public"."kwami_call_events" to "anon";

grant update on table "public"."kwami_call_events" to "anon";

grant delete on table "public"."kwami_call_events" to "authenticated";

grant insert on table "public"."kwami_call_events" to "authenticated";

grant references on table "public"."kwami_call_events" to "authenticated";

grant select on table "public"."kwami_call_events" to "authenticated";

grant trigger on table "public"."kwami_call_events" to "authenticated";

grant truncate on table "public"."kwami_call_events" to "authenticated";

grant update on table "public"."kwami_call_events" to "authenticated";

grant delete on table "public"."kwami_call_events" to "service_role";

grant insert on table "public"."kwami_call_events" to "service_role";

grant references on table "public"."kwami_call_events" to "service_role";

grant select on table "public"."kwami_call_events" to "service_role";

grant trigger on table "public"."kwami_call_events" to "service_role";

grant truncate on table "public"."kwami_call_events" to "service_role";

grant update on table "public"."kwami_call_events" to "service_role";

grant delete on table "public"."kwami_channels" to "anon";

grant insert on table "public"."kwami_channels" to "anon";

grant references on table "public"."kwami_channels" to "anon";

grant select on table "public"."kwami_channels" to "anon";

grant trigger on table "public"."kwami_channels" to "anon";

grant truncate on table "public"."kwami_channels" to "anon";

grant update on table "public"."kwami_channels" to "anon";

grant delete on table "public"."kwami_channels" to "authenticated";

grant insert on table "public"."kwami_channels" to "authenticated";

grant references on table "public"."kwami_channels" to "authenticated";

grant select on table "public"."kwami_channels" to "authenticated";

grant trigger on table "public"."kwami_channels" to "authenticated";

grant truncate on table "public"."kwami_channels" to "authenticated";

grant update on table "public"."kwami_channels" to "authenticated";

grant delete on table "public"."kwami_channels" to "service_role";

grant insert on table "public"."kwami_channels" to "service_role";

grant references on table "public"."kwami_channels" to "service_role";

grant select on table "public"."kwami_channels" to "service_role";

grant trigger on table "public"."kwami_channels" to "service_role";

grant truncate on table "public"."kwami_channels" to "service_role";

grant update on table "public"."kwami_channels" to "service_role";

grant delete on table "public"."kwami_contacts" to "anon";

grant insert on table "public"."kwami_contacts" to "anon";

grant references on table "public"."kwami_contacts" to "anon";

grant select on table "public"."kwami_contacts" to "anon";

grant trigger on table "public"."kwami_contacts" to "anon";

grant truncate on table "public"."kwami_contacts" to "anon";

grant update on table "public"."kwami_contacts" to "anon";

grant delete on table "public"."kwami_contacts" to "authenticated";

grant insert on table "public"."kwami_contacts" to "authenticated";

grant references on table "public"."kwami_contacts" to "authenticated";

grant select on table "public"."kwami_contacts" to "authenticated";

grant trigger on table "public"."kwami_contacts" to "authenticated";

grant truncate on table "public"."kwami_contacts" to "authenticated";

grant update on table "public"."kwami_contacts" to "authenticated";

grant delete on table "public"."kwami_contacts" to "service_role";

grant insert on table "public"."kwami_contacts" to "service_role";

grant references on table "public"."kwami_contacts" to "service_role";

grant select on table "public"."kwami_contacts" to "service_role";

grant trigger on table "public"."kwami_contacts" to "service_role";

grant truncate on table "public"."kwami_contacts" to "service_role";

grant update on table "public"."kwami_contacts" to "service_role";

grant delete on table "public"."kwami_conversations" to "anon";

grant insert on table "public"."kwami_conversations" to "anon";

grant references on table "public"."kwami_conversations" to "anon";

grant select on table "public"."kwami_conversations" to "anon";

grant trigger on table "public"."kwami_conversations" to "anon";

grant truncate on table "public"."kwami_conversations" to "anon";

grant update on table "public"."kwami_conversations" to "anon";

grant delete on table "public"."kwami_conversations" to "authenticated";

grant insert on table "public"."kwami_conversations" to "authenticated";

grant references on table "public"."kwami_conversations" to "authenticated";

grant select on table "public"."kwami_conversations" to "authenticated";

grant trigger on table "public"."kwami_conversations" to "authenticated";

grant truncate on table "public"."kwami_conversations" to "authenticated";

grant update on table "public"."kwami_conversations" to "authenticated";

grant delete on table "public"."kwami_conversations" to "service_role";

grant insert on table "public"."kwami_conversations" to "service_role";

grant references on table "public"."kwami_conversations" to "service_role";

grant select on table "public"."kwami_conversations" to "service_role";

grant trigger on table "public"."kwami_conversations" to "service_role";

grant truncate on table "public"."kwami_conversations" to "service_role";

grant update on table "public"."kwami_conversations" to "service_role";

grant delete on table "public"."kwami_email_accounts" to "anon";

grant insert on table "public"."kwami_email_accounts" to "anon";

grant references on table "public"."kwami_email_accounts" to "anon";

grant select on table "public"."kwami_email_accounts" to "anon";

grant trigger on table "public"."kwami_email_accounts" to "anon";

grant truncate on table "public"."kwami_email_accounts" to "anon";

grant update on table "public"."kwami_email_accounts" to "anon";

grant delete on table "public"."kwami_email_accounts" to "authenticated";

grant insert on table "public"."kwami_email_accounts" to "authenticated";

grant references on table "public"."kwami_email_accounts" to "authenticated";

grant select on table "public"."kwami_email_accounts" to "authenticated";

grant trigger on table "public"."kwami_email_accounts" to "authenticated";

grant truncate on table "public"."kwami_email_accounts" to "authenticated";

grant update on table "public"."kwami_email_accounts" to "authenticated";

grant delete on table "public"."kwami_email_accounts" to "service_role";

grant insert on table "public"."kwami_email_accounts" to "service_role";

grant references on table "public"."kwami_email_accounts" to "service_role";

grant select on table "public"."kwami_email_accounts" to "service_role";

grant trigger on table "public"."kwami_email_accounts" to "service_role";

grant truncate on table "public"."kwami_email_accounts" to "service_role";

grant update on table "public"."kwami_email_accounts" to "service_role";

grant delete on table "public"."kwami_email_messages" to "anon";

grant insert on table "public"."kwami_email_messages" to "anon";

grant references on table "public"."kwami_email_messages" to "anon";

grant select on table "public"."kwami_email_messages" to "anon";

grant trigger on table "public"."kwami_email_messages" to "anon";

grant truncate on table "public"."kwami_email_messages" to "anon";

grant update on table "public"."kwami_email_messages" to "anon";

grant delete on table "public"."kwami_email_messages" to "authenticated";

grant insert on table "public"."kwami_email_messages" to "authenticated";

grant references on table "public"."kwami_email_messages" to "authenticated";

grant select on table "public"."kwami_email_messages" to "authenticated";

grant trigger on table "public"."kwami_email_messages" to "authenticated";

grant truncate on table "public"."kwami_email_messages" to "authenticated";

grant update on table "public"."kwami_email_messages" to "authenticated";

grant delete on table "public"."kwami_email_messages" to "service_role";

grant insert on table "public"."kwami_email_messages" to "service_role";

grant references on table "public"."kwami_email_messages" to "service_role";

grant select on table "public"."kwami_email_messages" to "service_role";

grant trigger on table "public"."kwami_email_messages" to "service_role";

grant truncate on table "public"."kwami_email_messages" to "service_role";

grant update on table "public"."kwami_email_messages" to "service_role";

grant delete on table "public"."kwami_message_events" to "anon";

grant insert on table "public"."kwami_message_events" to "anon";

grant references on table "public"."kwami_message_events" to "anon";

grant select on table "public"."kwami_message_events" to "anon";

grant trigger on table "public"."kwami_message_events" to "anon";

grant truncate on table "public"."kwami_message_events" to "anon";

grant update on table "public"."kwami_message_events" to "anon";

grant delete on table "public"."kwami_message_events" to "authenticated";

grant insert on table "public"."kwami_message_events" to "authenticated";

grant references on table "public"."kwami_message_events" to "authenticated";

grant select on table "public"."kwami_message_events" to "authenticated";

grant trigger on table "public"."kwami_message_events" to "authenticated";

grant truncate on table "public"."kwami_message_events" to "authenticated";

grant update on table "public"."kwami_message_events" to "authenticated";

grant delete on table "public"."kwami_message_events" to "service_role";

grant insert on table "public"."kwami_message_events" to "service_role";

grant references on table "public"."kwami_message_events" to "service_role";

grant select on table "public"."kwami_message_events" to "service_role";

grant trigger on table "public"."kwami_message_events" to "service_role";

grant truncate on table "public"."kwami_message_events" to "service_role";

grant update on table "public"."kwami_message_events" to "service_role";

grant delete on table "public"."kwami_programs" to "anon";

grant insert on table "public"."kwami_programs" to "anon";

grant select on table "public"."kwami_programs" to "anon";

grant update on table "public"."kwami_programs" to "anon";

grant delete on table "public"."kwami_programs" to "authenticated";

grant insert on table "public"."kwami_programs" to "authenticated";

grant select on table "public"."kwami_programs" to "authenticated";

grant update on table "public"."kwami_programs" to "authenticated";

grant delete on table "public"."kwami_programs" to "service_role";

grant insert on table "public"."kwami_programs" to "service_role";

grant select on table "public"."kwami_programs" to "service_role";

grant update on table "public"."kwami_programs" to "service_role";

grant delete on table "public"."kwami_secrets" to "anon";

grant insert on table "public"."kwami_secrets" to "anon";

grant select on table "public"."kwami_secrets" to "anon";

grant update on table "public"."kwami_secrets" to "anon";

grant delete on table "public"."kwami_secrets" to "authenticated";

grant insert on table "public"."kwami_secrets" to "authenticated";

grant select on table "public"."kwami_secrets" to "authenticated";

grant update on table "public"."kwami_secrets" to "authenticated";

grant delete on table "public"."kwami_secrets" to "service_role";

grant insert on table "public"."kwami_secrets" to "service_role";

grant select on table "public"."kwami_secrets" to "service_role";

grant update on table "public"."kwami_secrets" to "service_role";

grant delete on table "public"."kwami_wallet_key_refs" to "anon";

grant insert on table "public"."kwami_wallet_key_refs" to "anon";

grant references on table "public"."kwami_wallet_key_refs" to "anon";

grant select on table "public"."kwami_wallet_key_refs" to "anon";

grant trigger on table "public"."kwami_wallet_key_refs" to "anon";

grant truncate on table "public"."kwami_wallet_key_refs" to "anon";

grant update on table "public"."kwami_wallet_key_refs" to "anon";

grant delete on table "public"."kwami_wallet_key_refs" to "authenticated";

grant insert on table "public"."kwami_wallet_key_refs" to "authenticated";

grant references on table "public"."kwami_wallet_key_refs" to "authenticated";

grant select on table "public"."kwami_wallet_key_refs" to "authenticated";

grant trigger on table "public"."kwami_wallet_key_refs" to "authenticated";

grant truncate on table "public"."kwami_wallet_key_refs" to "authenticated";

grant update on table "public"."kwami_wallet_key_refs" to "authenticated";

grant delete on table "public"."kwami_wallet_key_refs" to "service_role";

grant insert on table "public"."kwami_wallet_key_refs" to "service_role";

grant references on table "public"."kwami_wallet_key_refs" to "service_role";

grant select on table "public"."kwami_wallet_key_refs" to "service_role";

grant trigger on table "public"."kwami_wallet_key_refs" to "service_role";

grant truncate on table "public"."kwami_wallet_key_refs" to "service_role";

grant update on table "public"."kwami_wallet_key_refs" to "service_role";

grant delete on table "public"."kwami_wallets" to "anon";

grant insert on table "public"."kwami_wallets" to "anon";

grant references on table "public"."kwami_wallets" to "anon";

grant select on table "public"."kwami_wallets" to "anon";

grant trigger on table "public"."kwami_wallets" to "anon";

grant truncate on table "public"."kwami_wallets" to "anon";

grant update on table "public"."kwami_wallets" to "anon";

grant delete on table "public"."kwami_wallets" to "authenticated";

grant insert on table "public"."kwami_wallets" to "authenticated";

grant references on table "public"."kwami_wallets" to "authenticated";

grant select on table "public"."kwami_wallets" to "authenticated";

grant trigger on table "public"."kwami_wallets" to "authenticated";

grant truncate on table "public"."kwami_wallets" to "authenticated";

grant update on table "public"."kwami_wallets" to "authenticated";

grant delete on table "public"."kwami_wallets" to "service_role";

grant insert on table "public"."kwami_wallets" to "service_role";

grant references on table "public"."kwami_wallets" to "service_role";

grant select on table "public"."kwami_wallets" to "service_role";

grant trigger on table "public"."kwami_wallets" to "service_role";

grant truncate on table "public"."kwami_wallets" to "service_role";

grant update on table "public"."kwami_wallets" to "service_role";

grant delete on table "public"."kwamis" to "anon";

grant insert on table "public"."kwamis" to "anon";

grant select on table "public"."kwamis" to "anon";

grant update on table "public"."kwamis" to "anon";

grant delete on table "public"."kwamis" to "authenticated";

grant insert on table "public"."kwamis" to "authenticated";

grant select on table "public"."kwamis" to "authenticated";

grant update on table "public"."kwamis" to "authenticated";

grant delete on table "public"."kwamis" to "service_role";

grant insert on table "public"."kwamis" to "service_role";

grant select on table "public"."kwamis" to "service_role";

grant update on table "public"."kwamis" to "service_role";

grant delete on table "public"."livekit_sessions" to "anon";

grant insert on table "public"."livekit_sessions" to "anon";

grant references on table "public"."livekit_sessions" to "anon";

grant select on table "public"."livekit_sessions" to "anon";

grant trigger on table "public"."livekit_sessions" to "anon";

grant truncate on table "public"."livekit_sessions" to "anon";

grant update on table "public"."livekit_sessions" to "anon";

grant delete on table "public"."livekit_sessions" to "authenticated";

grant insert on table "public"."livekit_sessions" to "authenticated";

grant references on table "public"."livekit_sessions" to "authenticated";

grant select on table "public"."livekit_sessions" to "authenticated";

grant trigger on table "public"."livekit_sessions" to "authenticated";

grant truncate on table "public"."livekit_sessions" to "authenticated";

grant update on table "public"."livekit_sessions" to "authenticated";

grant delete on table "public"."livekit_sessions" to "service_role";

grant insert on table "public"."livekit_sessions" to "service_role";

grant references on table "public"."livekit_sessions" to "service_role";

grant select on table "public"."livekit_sessions" to "service_role";

grant trigger on table "public"."livekit_sessions" to "service_role";

grant truncate on table "public"."livekit_sessions" to "service_role";

grant update on table "public"."livekit_sessions" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."transcript_turns" to "anon";

grant insert on table "public"."transcript_turns" to "anon";

grant select on table "public"."transcript_turns" to "anon";

grant update on table "public"."transcript_turns" to "anon";

grant delete on table "public"."transcript_turns" to "authenticated";

grant insert on table "public"."transcript_turns" to "authenticated";

grant select on table "public"."transcript_turns" to "authenticated";

grant update on table "public"."transcript_turns" to "authenticated";

grant delete on table "public"."transcript_turns" to "service_role";

grant insert on table "public"."transcript_turns" to "service_role";

grant select on table "public"."transcript_turns" to "service_role";

grant update on table "public"."transcript_turns" to "service_role";

grant delete on table "public"."user_app_settings" to "anon";

grant insert on table "public"."user_app_settings" to "anon";

grant references on table "public"."user_app_settings" to "anon";

grant select on table "public"."user_app_settings" to "anon";

grant trigger on table "public"."user_app_settings" to "anon";

grant truncate on table "public"."user_app_settings" to "anon";

grant update on table "public"."user_app_settings" to "anon";

grant delete on table "public"."user_app_settings" to "authenticated";

grant insert on table "public"."user_app_settings" to "authenticated";

grant references on table "public"."user_app_settings" to "authenticated";

grant select on table "public"."user_app_settings" to "authenticated";

grant trigger on table "public"."user_app_settings" to "authenticated";

grant truncate on table "public"."user_app_settings" to "authenticated";

grant update on table "public"."user_app_settings" to "authenticated";

grant delete on table "public"."user_app_settings" to "service_role";

grant insert on table "public"."user_app_settings" to "service_role";

grant references on table "public"."user_app_settings" to "service_role";

grant select on table "public"."user_app_settings" to "service_role";

grant trigger on table "public"."user_app_settings" to "service_role";

grant truncate on table "public"."user_app_settings" to "service_role";

grant update on table "public"."user_app_settings" to "service_role";

grant delete on table "public"."user_credits" to "anon";

grant insert on table "public"."user_credits" to "anon";

grant references on table "public"."user_credits" to "anon";

grant select on table "public"."user_credits" to "anon";

grant trigger on table "public"."user_credits" to "anon";

grant truncate on table "public"."user_credits" to "anon";

grant update on table "public"."user_credits" to "anon";

grant delete on table "public"."user_credits" to "authenticated";

grant insert on table "public"."user_credits" to "authenticated";

grant references on table "public"."user_credits" to "authenticated";

grant select on table "public"."user_credits" to "authenticated";

grant trigger on table "public"."user_credits" to "authenticated";

grant truncate on table "public"."user_credits" to "authenticated";

grant update on table "public"."user_credits" to "authenticated";

grant delete on table "public"."user_credits" to "service_role";

grant insert on table "public"."user_credits" to "service_role";

grant references on table "public"."user_credits" to "service_role";

grant select on table "public"."user_credits" to "service_role";

grant trigger on table "public"."user_credits" to "service_role";

grant truncate on table "public"."user_credits" to "service_role";

grant update on table "public"."user_credits" to "service_role";

grant delete on table "public"."user_kwamis" to "anon";

grant insert on table "public"."user_kwamis" to "anon";

grant references on table "public"."user_kwamis" to "anon";

grant select on table "public"."user_kwamis" to "anon";

grant trigger on table "public"."user_kwamis" to "anon";

grant truncate on table "public"."user_kwamis" to "anon";

grant update on table "public"."user_kwamis" to "anon";

grant delete on table "public"."user_kwamis" to "authenticated";

grant insert on table "public"."user_kwamis" to "authenticated";

grant references on table "public"."user_kwamis" to "authenticated";

grant select on table "public"."user_kwamis" to "authenticated";

grant trigger on table "public"."user_kwamis" to "authenticated";

grant truncate on table "public"."user_kwamis" to "authenticated";

grant update on table "public"."user_kwamis" to "authenticated";

grant delete on table "public"."user_kwamis" to "service_role";

grant insert on table "public"."user_kwamis" to "service_role";

grant references on table "public"."user_kwamis" to "service_role";

grant select on table "public"."user_kwamis" to "service_role";

grant trigger on table "public"."user_kwamis" to "service_role";

grant truncate on table "public"."user_kwamis" to "service_role";

grant update on table "public"."user_kwamis" to "service_role";

grant delete on table "public"."valuations" to "anon";

grant insert on table "public"."valuations" to "anon";

grant select on table "public"."valuations" to "anon";

grant update on table "public"."valuations" to "anon";

grant delete on table "public"."valuations" to "authenticated";

grant insert on table "public"."valuations" to "authenticated";

grant select on table "public"."valuations" to "authenticated";

grant update on table "public"."valuations" to "authenticated";

grant delete on table "public"."valuations" to "service_role";

grant insert on table "public"."valuations" to "service_role";

grant select on table "public"."valuations" to "service_role";

grant update on table "public"."valuations" to "service_role";

grant delete on table "public"."waitlist_signups" to "anon";

grant insert on table "public"."waitlist_signups" to "anon";

grant references on table "public"."waitlist_signups" to "anon";

grant select on table "public"."waitlist_signups" to "anon";

grant trigger on table "public"."waitlist_signups" to "anon";

grant truncate on table "public"."waitlist_signups" to "anon";

grant update on table "public"."waitlist_signups" to "anon";

grant delete on table "public"."waitlist_signups" to "authenticated";

grant insert on table "public"."waitlist_signups" to "authenticated";

grant references on table "public"."waitlist_signups" to "authenticated";

grant select on table "public"."waitlist_signups" to "authenticated";

grant trigger on table "public"."waitlist_signups" to "authenticated";

grant truncate on table "public"."waitlist_signups" to "authenticated";

grant update on table "public"."waitlist_signups" to "authenticated";

grant delete on table "public"."waitlist_signups" to "service_role";

grant insert on table "public"."waitlist_signups" to "service_role";

grant references on table "public"."waitlist_signups" to "service_role";

grant select on table "public"."waitlist_signups" to "service_role";

grant trigger on table "public"."waitlist_signups" to "service_role";

grant truncate on table "public"."waitlist_signups" to "service_role";

grant update on table "public"."waitlist_signups" to "service_role";

grant delete on table "public"."wallet_balances_cache" to "anon";

grant insert on table "public"."wallet_balances_cache" to "anon";

grant references on table "public"."wallet_balances_cache" to "anon";

grant select on table "public"."wallet_balances_cache" to "anon";

grant trigger on table "public"."wallet_balances_cache" to "anon";

grant truncate on table "public"."wallet_balances_cache" to "anon";

grant update on table "public"."wallet_balances_cache" to "anon";

grant delete on table "public"."wallet_balances_cache" to "authenticated";

grant insert on table "public"."wallet_balances_cache" to "authenticated";

grant references on table "public"."wallet_balances_cache" to "authenticated";

grant select on table "public"."wallet_balances_cache" to "authenticated";

grant trigger on table "public"."wallet_balances_cache" to "authenticated";

grant truncate on table "public"."wallet_balances_cache" to "authenticated";

grant update on table "public"."wallet_balances_cache" to "authenticated";

grant delete on table "public"."wallet_balances_cache" to "service_role";

grant insert on table "public"."wallet_balances_cache" to "service_role";

grant references on table "public"."wallet_balances_cache" to "service_role";

grant select on table "public"."wallet_balances_cache" to "service_role";

grant trigger on table "public"."wallet_balances_cache" to "service_role";

grant truncate on table "public"."wallet_balances_cache" to "service_role";

grant update on table "public"."wallet_balances_cache" to "service_role";

grant delete on table "public"."wallet_funding_events" to "anon";

grant insert on table "public"."wallet_funding_events" to "anon";

grant references on table "public"."wallet_funding_events" to "anon";

grant select on table "public"."wallet_funding_events" to "anon";

grant trigger on table "public"."wallet_funding_events" to "anon";

grant truncate on table "public"."wallet_funding_events" to "anon";

grant update on table "public"."wallet_funding_events" to "anon";

grant delete on table "public"."wallet_funding_events" to "authenticated";

grant insert on table "public"."wallet_funding_events" to "authenticated";

grant references on table "public"."wallet_funding_events" to "authenticated";

grant select on table "public"."wallet_funding_events" to "authenticated";

grant trigger on table "public"."wallet_funding_events" to "authenticated";

grant truncate on table "public"."wallet_funding_events" to "authenticated";

grant update on table "public"."wallet_funding_events" to "authenticated";

grant delete on table "public"."wallet_funding_events" to "service_role";

grant insert on table "public"."wallet_funding_events" to "service_role";

grant references on table "public"."wallet_funding_events" to "service_role";

grant select on table "public"."wallet_funding_events" to "service_role";

grant trigger on table "public"."wallet_funding_events" to "service_role";

grant truncate on table "public"."wallet_funding_events" to "service_role";

grant update on table "public"."wallet_funding_events" to "service_role";

grant delete on table "public"."wallet_funding_intents" to "anon";

grant insert on table "public"."wallet_funding_intents" to "anon";

grant references on table "public"."wallet_funding_intents" to "anon";

grant select on table "public"."wallet_funding_intents" to "anon";

grant trigger on table "public"."wallet_funding_intents" to "anon";

grant truncate on table "public"."wallet_funding_intents" to "anon";

grant update on table "public"."wallet_funding_intents" to "anon";

grant delete on table "public"."wallet_funding_intents" to "authenticated";

grant insert on table "public"."wallet_funding_intents" to "authenticated";

grant references on table "public"."wallet_funding_intents" to "authenticated";

grant select on table "public"."wallet_funding_intents" to "authenticated";

grant trigger on table "public"."wallet_funding_intents" to "authenticated";

grant truncate on table "public"."wallet_funding_intents" to "authenticated";

grant update on table "public"."wallet_funding_intents" to "authenticated";

grant delete on table "public"."wallet_funding_intents" to "service_role";

grant insert on table "public"."wallet_funding_intents" to "service_role";

grant references on table "public"."wallet_funding_intents" to "service_role";

grant select on table "public"."wallet_funding_intents" to "service_role";

grant trigger on table "public"."wallet_funding_intents" to "service_role";

grant truncate on table "public"."wallet_funding_intents" to "service_role";

grant update on table "public"."wallet_funding_intents" to "service_role";

grant delete on table "public"."wallet_identities" to "anon";

grant insert on table "public"."wallet_identities" to "anon";

grant select on table "public"."wallet_identities" to "anon";

grant update on table "public"."wallet_identities" to "anon";

grant delete on table "public"."wallet_identities" to "authenticated";

grant insert on table "public"."wallet_identities" to "authenticated";

grant select on table "public"."wallet_identities" to "authenticated";

grant update on table "public"."wallet_identities" to "authenticated";

grant delete on table "public"."wallet_identities" to "service_role";

grant insert on table "public"."wallet_identities" to "service_role";

grant select on table "public"."wallet_identities" to "service_role";

grant update on table "public"."wallet_identities" to "service_role";

grant delete on table "public"."wallet_token_allowlist" to "anon";

grant insert on table "public"."wallet_token_allowlist" to "anon";

grant references on table "public"."wallet_token_allowlist" to "anon";

grant select on table "public"."wallet_token_allowlist" to "anon";

grant trigger on table "public"."wallet_token_allowlist" to "anon";

grant truncate on table "public"."wallet_token_allowlist" to "anon";

grant update on table "public"."wallet_token_allowlist" to "anon";

grant delete on table "public"."wallet_token_allowlist" to "authenticated";

grant insert on table "public"."wallet_token_allowlist" to "authenticated";

grant references on table "public"."wallet_token_allowlist" to "authenticated";

grant select on table "public"."wallet_token_allowlist" to "authenticated";

grant trigger on table "public"."wallet_token_allowlist" to "authenticated";

grant truncate on table "public"."wallet_token_allowlist" to "authenticated";

grant update on table "public"."wallet_token_allowlist" to "authenticated";

grant delete on table "public"."wallet_token_allowlist" to "service_role";

grant insert on table "public"."wallet_token_allowlist" to "service_role";

grant references on table "public"."wallet_token_allowlist" to "service_role";

grant select on table "public"."wallet_token_allowlist" to "service_role";

grant trigger on table "public"."wallet_token_allowlist" to "service_role";

grant truncate on table "public"."wallet_token_allowlist" to "service_role";

grant update on table "public"."wallet_token_allowlist" to "service_role";

grant delete on table "public"."wallet_transactions" to "anon";

grant insert on table "public"."wallet_transactions" to "anon";

grant references on table "public"."wallet_transactions" to "anon";

grant select on table "public"."wallet_transactions" to "anon";

grant trigger on table "public"."wallet_transactions" to "anon";

grant truncate on table "public"."wallet_transactions" to "anon";

grant update on table "public"."wallet_transactions" to "anon";

grant delete on table "public"."wallet_transactions" to "authenticated";

grant insert on table "public"."wallet_transactions" to "authenticated";

grant references on table "public"."wallet_transactions" to "authenticated";

grant select on table "public"."wallet_transactions" to "authenticated";

grant trigger on table "public"."wallet_transactions" to "authenticated";

grant truncate on table "public"."wallet_transactions" to "authenticated";

grant update on table "public"."wallet_transactions" to "authenticated";

grant delete on table "public"."wallet_transactions" to "service_role";

grant insert on table "public"."wallet_transactions" to "service_role";

grant references on table "public"."wallet_transactions" to "service_role";

grant select on table "public"."wallet_transactions" to "service_role";

grant trigger on table "public"."wallet_transactions" to "service_role";

grant truncate on table "public"."wallet_transactions" to "service_role";

grant update on table "public"."wallet_transactions" to "service_role";


  create policy "Users can view own transactions"
  on "public"."credit_transactions"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own usage"
  on "public"."credit_usage_logs"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own calendar events"
  on "public"."kwami_calendar_events"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own kwami call events"
  on "public"."kwami_call_events"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own kwami channels"
  on "public"."kwami_channels"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own kwami contacts"
  on "public"."kwami_contacts"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own kwami conversations"
  on "public"."kwami_conversations"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own email accounts"
  on "public"."kwami_email_accounts"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own email messages"
  on "public"."kwami_email_messages"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own kwami message events"
  on "public"."kwami_message_events"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can manage own wallet key refs"
  on "public"."kwami_wallet_key_refs"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Users can manage own kwami wallets"
  on "public"."kwami_wallets"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Users can view own sessions"
  on "public"."livekit_sessions"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert own app settings"
  on "public"."user_app_settings"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can read own app settings"
  on "public"."user_app_settings"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can update own app settings"
  on "public"."user_app_settings"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Users can view own credits"
  on "public"."user_credits"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can delete own kwamis"
  on "public"."user_kwamis"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert own kwamis"
  on "public"."user_kwamis"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update own kwamis"
  on "public"."user_kwamis"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Users can view own kwamis"
  on "public"."user_kwamis"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "waitlist_anon_insert"
  on "public"."waitlist_signups"
  as permissive
  for insert
  to anon
with check (true);



  create policy "waitlist_anon_no_select"
  on "public"."waitlist_signups"
  as permissive
  for select
  to anon
using (false);



  create policy "waitlist_authenticated_insert"
  on "public"."waitlist_signups"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "waitlist_authenticated_no_select"
  on "public"."waitlist_signups"
  as permissive
  for select
  to authenticated
using (false);



  create policy "Users can manage own balance cache"
  on "public"."wallet_balances_cache"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Users can view own funding events"
  on "public"."wallet_funding_events"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can manage own funding intents"
  on "public"."wallet_funding_intents"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Users can add custom allowlist tokens"
  on "public"."wallet_token_allowlist"
  as permissive
  for insert
  to public
with check ((auth.uid() = created_by_user_id));



  create policy "Users can delete custom allowlist tokens"
  on "public"."wallet_token_allowlist"
  as permissive
  for delete
  to public
using ((auth.uid() = created_by_user_id));



  create policy "Users can update custom allowlist tokens"
  on "public"."wallet_token_allowlist"
  as permissive
  for update
  to public
using ((auth.uid() = created_by_user_id))
with check ((auth.uid() = created_by_user_id));



  create policy "Users can view token allowlist"
  on "public"."wallet_token_allowlist"
  as permissive
  for select
  to public
using (true);



  create policy "Users can manage own wallet transactions"
  on "public"."wallet_transactions"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


CREATE TRIGGER kwami_calendar_events_updated_at BEFORE UPDATE ON public.kwami_calendar_events FOR EACH ROW EXECUTE FUNCTION public.set_kwami_communications_updated_at();

CREATE TRIGGER kwami_call_events_updated_at BEFORE UPDATE ON public.kwami_call_events FOR EACH ROW EXECUTE FUNCTION public.set_kwami_communications_updated_at();

CREATE TRIGGER kwami_channels_updated_at BEFORE UPDATE ON public.kwami_channels FOR EACH ROW EXECUTE FUNCTION public.set_kwami_communications_updated_at();

CREATE TRIGGER kwami_contacts_updated_at BEFORE UPDATE ON public.kwami_contacts FOR EACH ROW EXECUTE FUNCTION public.set_kwami_communications_updated_at();

CREATE TRIGGER kwami_conversations_updated_at BEFORE UPDATE ON public.kwami_conversations FOR EACH ROW EXECUTE FUNCTION public.set_kwami_communications_updated_at();

CREATE TRIGGER kwami_email_accounts_updated_at BEFORE UPDATE ON public.kwami_email_accounts FOR EACH ROW EXECUTE FUNCTION public.set_kwami_communications_updated_at();

CREATE TRIGGER kwami_email_messages_updated_at BEFORE UPDATE ON public.kwami_email_messages FOR EACH ROW EXECUTE FUNCTION public.set_kwami_communications_updated_at();

CREATE TRIGGER kwami_message_events_updated_at BEFORE UPDATE ON public.kwami_message_events FOR EACH ROW EXECUTE FUNCTION public.set_kwami_communications_updated_at();

CREATE TRIGGER kwami_wallets_updated_at BEFORE UPDATE ON public.kwami_wallets FOR EACH ROW EXECUTE FUNCTION public.set_wallet_updated_at();

CREATE TRIGGER user_app_settings_updated_at BEFORE UPDATE ON public.user_app_settings FOR EACH ROW EXECUTE FUNCTION public.set_user_app_settings_updated_at();

CREATE TRIGGER user_kwamis_updated_at BEFORE UPDATE ON public.user_kwamis FOR EACH ROW EXECUTE FUNCTION public.set_user_kwamis_updated_at();

CREATE TRIGGER wallet_funding_intents_updated_at BEFORE UPDATE ON public.wallet_funding_intents FOR EACH ROW EXECUTE FUNCTION public.set_wallet_updated_at();

CREATE TRIGGER on_auth_user_created_credits AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();


