-- Urdu Novel Bank — Response Collector
-- Safe to re-run: uses "if not exists" / "or replace" / "drop policy if exists"
-- throughout, so applying this file again after edits will not error.

create extension if not exists pgcrypto;

-- ============================================================================
-- TABLES
-- ============================================================================

create table if not exists public.questions (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  question_text text not null,
  is_active     boolean not null default true,
  accepting_responses boolean not null default true,
  last_viewed_at timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.questions add column if not exists is_pinned boolean not null default false;
alter table public.questions add column if not exists pinned_at timestamptz;
alter table public.questions add column if not exists icon_emoji text;

-- Raw responses. Contains PII (reader_name, reader_email) — never exposed to
-- anon directly. Public visitors only ever see safe columns via the
-- get_public_feed()/get_response_count() RPCs below, and only for rows that
-- already have a reply.
create table if not exists public.responses (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.questions(id) on delete cascade,
  reader_name  text,
  reader_email text not null,
  message      text not null,
  reply_text   text,
  replied_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists responses_question_id_idx on public.responses(question_id);
create index if not exists responses_created_at_idx on public.responses(created_at desc);
create index if not exists questions_slug_idx on public.questions(slug);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.questions enable row level security;
alter table public.responses enable row level security;

-- ---- questions -------------------------------------------------------------

-- Anyone (including anonymous visitors) can see active questions — needed so
-- the /r/:slug public page can load the question text without an account.
drop policy if exists "public can view active questions" on public.questions;
create policy "public can view active questions"
  on public.questions
  for select
  to anon, authenticated
  using (is_active = true);

-- Signed-in admins can see every question, active or not.
drop policy if exists "authenticated can view all questions" on public.questions;
create policy "authenticated can view all questions"
  on public.questions
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated can insert questions" on public.questions;
create policy "authenticated can insert questions"
  on public.questions
  for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated can update questions" on public.questions;
create policy "authenticated can update questions"
  on public.questions
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated can delete questions" on public.questions;
create policy "authenticated can delete questions"
  on public.questions
  for delete
  to authenticated
  using (true);

-- ---- responses --------------------------------------------------------------

-- Anonymous (and signed-in) visitors can submit a new response to any
-- currently-active question. They can NEVER select rows back out of this
-- table directly — that's the whole point of keeping responses private.
drop policy if exists "anyone can submit a response to an active question" on public.responses;
create policy "anyone can submit a response to an active question"
  on public.responses
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.questions q
      where q.id = question_id and q.is_active = true and q.accepting_responses = true
    )
  );

-- Only signed-in admins can read raw response rows (name/email/message).
drop policy if exists "authenticated can view all responses" on public.responses;
create policy "authenticated can view all responses"
  on public.responses
  for select
  to authenticated
  using (true);

-- Only signed-in admins can reply — and only once: the row must not already
-- have a reply_text. This blocks edits/second replies at the database level,
-- not just in the UI.
drop policy if exists "authenticated can reply once" on public.responses;
create policy "authenticated can reply once"
  on public.responses
  for update
  to authenticated
  using (reply_text is null)
  with check (true);

-- No delete policy on responses: individual responses are never deleted
-- directly. They are removed only via "on delete cascade" when their parent
-- question is deleted (requirement #9), which is enforced by the foreign key
-- above and is not subject to these RLS policies.

-- ============================================================================
-- PUBLIC RPCS (SECURITY DEFINER)
-- ============================================================================
-- These run with the privileges of the function owner, bypassing RLS
-- internally, but only ever return the specific safe columns selected below —
-- never reader_name or reader_email, and never a row without a reply.

create or replace function public.get_public_feed(p_slug text)
returns table (
  message     text,
  reply_text  text,
  replied_at  timestamptz,
  reader_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select r.message, r.reply_text, r.replied_at, r.reader_name
  from public.responses r
  join public.questions q on q.id = r.question_id
  where q.slug = p_slug
    and r.reply_text is not null
  order by r.replied_at asc;
$$;

grant execute on function public.get_public_feed(text) to anon, authenticated;

create or replace function public.get_response_count(p_slug text)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer
  from public.responses r
  join public.questions q on q.id = r.question_id
  where q.slug = p_slug;
$$;

grant execute on function public.get_response_count(text) to anon, authenticated;

drop function if exists public.get_active_questions_with_counts();
create or replace function public.get_active_questions_with_counts(
  p_limit int default null,
  p_offset int default null
)
returns table (
  slug text,
  question_text text,
  response_count integer,
  published_reply_count integer,
  accepting_responses boolean,
  created_at timestamptz,
  is_pinned boolean,
  pinned_at timestamptz,
  icon_emoji text
)
language sql
security definer
set search_path = public
stable
as $$
  select 
    q.slug, 
    q.question_text,
    count(r.id)::integer as response_count,
    count(r.id) filter (where r.reply_text is not null)::integer as published_reply_count,
    q.accepting_responses,
    q.created_at,
    q.is_pinned,
    q.pinned_at,
    q.icon_emoji
  from public.questions q
  left join public.responses r on r.question_id = q.id
  where q.is_active = true
  group by q.id
  order by q.is_pinned desc, q.pinned_at desc nulls last, q.created_at desc
  limit p_limit
  offset p_offset;
$$;

grant execute on function public.get_active_questions_with_counts() to anon, authenticated;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

create or replace function public.enforce_max_pinned()
returns trigger
language plpgsql
as $$
declare
  pinned_count int;
begin
  if NEW.is_pinned = true and (TG_OP = 'INSERT' or OLD.is_pinned = false) then
    execute format('select count(*) from public.%I where is_pinned = true', TG_TABLE_NAME) into pinned_count;
    if pinned_count >= 3 then
      raise exception 'You can only pin up to 3 %', (case when TG_TABLE_NAME = 'questions' then 'chats' else 'updates' end);
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists enforce_max_pinned_questions on public.questions;
create trigger enforce_max_pinned_questions
  before insert or update on public.questions
  for each row execute function public.enforce_max_pinned();

-- 1. Create the trigger function
create or replace function public.lock_reader_name_by_email()
returns trigger
language plpgsql
security definer -- Crucial: allows anon visitors to query existing responses internally
set search_path = public -- Security best practice for SECURITY DEFINER
as $$
declare
  existing_name text;
begin
  -- Normalize the incoming email to lowercase
  NEW.reader_email := lower(NEW.reader_email);

  -- Find the earliest non-null name associated with this email
  select reader_name into existing_name
  from public.responses
  where lower(reader_email) = NEW.reader_email
    and reader_name is not null
  order by created_at asc
  limit 1;

  -- If a previous name was found, silently overwrite the incoming name
  if found then
    NEW.reader_name := existing_name;
  end if;

  return NEW;
end;
$$;

-- 2. Attach the trigger to the responses table
drop trigger if exists tr_lock_reader_name on public.responses;
create trigger tr_lock_reader_name
  before insert on public.responses
  for each row
  execute function public.lock_reader_name_by_email();

-- 3. Add an index to keep the lookup lightning fast
create index if not exists responses_lower_email_idx on public.responses(lower(reader_email));

-- ============================================================================
-- NOTES
-- ============================================================================
-- Admin accounts are created directly in Supabase Auth (Dashboard → Authentication
-- → Users → Add user, or via the Auth API) — there is no public sign-up flow in
-- this app, so anyone who can sign in is trusted as an admin.

-- Enable Realtime for the admin panel
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.questions, public.responses;

-- ============================================================================
-- PHASE 1: UPDATES
-- ============================================================================

create table if not exists public.updates (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  content       text not null,
  created_at    timestamptz not null default now()
);

alter table public.updates add column if not exists is_pinned boolean not null default false;
alter table public.updates add column if not exists pinned_at timestamptz;

drop trigger if exists enforce_max_pinned_updates on public.updates;
create trigger enforce_max_pinned_updates
  before insert or update on public.updates
  for each row execute function public.enforce_max_pinned();

create table if not exists public.update_reactions (
  id          uuid primary key default gen_random_uuid(),
  update_id   uuid not null references public.updates(id) on delete cascade,
  visitor_id  uuid not null,
  reaction    text not null,
  created_at  timestamptz not null default now(),
  unique (update_id, visitor_id, reaction)
);

create index if not exists updates_created_at_idx on public.updates(created_at desc);
create index if not exists update_reactions_update_id_idx on public.update_reactions(update_id);

-- RLS
alter table public.updates enable row level security;
alter table public.update_reactions enable row level security;

-- updates table policies
drop policy if exists "public can view updates" on public.updates;
create policy "public can view updates" on public.updates for select to anon, authenticated using (true);

drop policy if exists "admin can insert updates" on public.updates;
create policy "admin can insert updates" on public.updates for insert to authenticated with check (true);

drop policy if exists "admin can update updates" on public.updates;
create policy "admin can update updates" on public.updates for update to authenticated using (true) with check (true);

drop policy if exists "admin can delete updates" on public.updates;
create policy "admin can delete updates" on public.updates for delete to authenticated using (true);

-- update_reactions table policies
-- Visitors only interact via RPCs to prevent reading all rows or inserting-then-selecting
drop policy if exists "admin can view all reactions" on public.update_reactions;
create policy "admin can view all reactions" on public.update_reactions for select to authenticated using (true);

-- RPC: Toggle reaction
drop function if exists public.toggle_update_reaction(uuid, uuid, text);
create function public.toggle_update_reaction(p_update_id uuid, p_visitor_id uuid, p_reaction text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
begin
  select id into existing_id 
  from public.update_reactions
  where update_id = p_update_id and visitor_id = p_visitor_id and reaction = p_reaction;

  if existing_id is not null then
    delete from public.update_reactions where id = existing_id;
  else
    insert into public.update_reactions (update_id, visitor_id, reaction)
    values (p_update_id, p_visitor_id, p_reaction);
  end if;
end;
$$;
grant execute on function public.toggle_update_reaction(uuid, uuid, text) to anon, authenticated;

-- RPC: Get updates with reaction counts (Returns JSON aggregated reaction counts)
drop function if exists public.get_updates_with_reactions();
create or replace function public.get_updates_with_reactions(
  p_limit int default null,
  p_offset int default null
)
returns table (
  id uuid,
  title text,
  content text,
  created_at timestamptz,
  reactions jsonb,
  is_pinned boolean,
  pinned_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select 
    u.id, 
    u.title,
    u.content, 
    u.created_at,
    coalesce(
      (
        select jsonb_object_agg(r.reaction, r.count)
        from (
          select reaction, count(*)::int
          from public.update_reactions
          where update_id = u.id
          group by reaction
        ) r
      ), 
      '{}'::jsonb
    ) as reactions,
    u.is_pinned,
    u.pinned_at
  from public.updates u
  order by u.is_pinned desc, u.pinned_at desc nulls last, u.created_at desc
  limit p_limit
  offset p_offset;
$$;
grant execute on function public.get_updates_with_reactions() to anon, authenticated;

-- Add new tables to Realtime
alter publication supabase_realtime add table public.updates, public.update_reactions;

-- ============================================================================
-- SITE SETTINGS
-- ============================================================================

create table if not exists public.site_settings (
  id integer primary key check (id = 1),
  maintenance_mode boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Insert the single row if it doesn't exist
insert into public.site_settings (id, maintenance_mode)
values (1, false)
on conflict (id) do nothing;

-- RLS
alter table public.site_settings enable row level security;

drop policy if exists "public can view site settings" on public.site_settings;
create policy "public can view site settings" on public.site_settings for select to anon, authenticated using (true);

drop policy if exists "admin can update site settings" on public.site_settings;
create policy "admin can update site settings" on public.site_settings for update to authenticated using (true) with check (true);

-- Add to realtime
alter publication supabase_realtime add table public.site_settings;
-- ============================================================================
-- PHASE 2: RESPONSE REACTIONS
-- ============================================================================

create table if not exists public.response_reactions (
  id          uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses(id) on delete cascade,
  visitor_id  uuid not null,
  reaction    text not null,
  created_at  timestamptz not null default now(),
  unique (response_id, visitor_id, reaction)
);

create index if not exists response_reactions_response_id_idx on public.response_reactions(response_id);

alter table public.response_reactions enable row level security;

drop policy if exists "admin can view all response reactions" on public.response_reactions;
create policy "admin can view all response reactions" on public.response_reactions for select to authenticated using (true);

drop function if exists public.toggle_response_reaction(uuid, uuid, text);
create function public.toggle_response_reaction(p_response_id uuid, p_visitor_id uuid, p_reaction text)
returns void
language plpgsql
security definer
set search_path = public
as $body
declare
  existing_id uuid;
begin
  select id into existing_id 
  from public.response_reactions
  where response_id = p_response_id and visitor_id = p_visitor_id and reaction = p_reaction;

  if existing_id is not null then
    delete from public.response_reactions where id = existing_id;
  else
    insert into public.response_reactions (response_id, visitor_id, reaction)
    values (p_response_id, p_visitor_id, p_reaction);
  end if;
end;
$body;
grant execute on function public.toggle_response_reaction(uuid, uuid, text) to anon, authenticated;

drop function if exists public.get_public_feed(text);
create or replace function public.get_public_feed(p_slug text)
returns table (
  id          uuid,
  message     text,
  reply_text  text,
  replied_at  timestamptz,
  reader_name text,
  reactions   jsonb
)
language sql
security definer
set search_path = public
stable
as $body
  select 
    r.id,
    r.message, 
    r.reply_text, 
    r.replied_at, 
    r.reader_name,
    coalesce(
      (
        select jsonb_object_agg(rr.reaction, rr.count)
        from (
          select reaction, count(*)::int
          from public.response_reactions
          where response_id = r.id
          group by reaction
        ) rr
      ), 
      '{}'::jsonb
    ) as reactions
  from public.responses r
  join public.questions q on q.id = r.question_id
  where q.slug = p_slug
    and r.reply_text is not null
  order by r.replied_at asc;
$body;

grant execute on function public.get_public_feed(text) to anon, authenticated;

-- Add new table to Realtime
alter publication supabase_realtime add table public.response_reactions;

-- ============================================================================
-- ADMIN: READER STATS PER QUESTION
-- ============================================================================
-- Returns per-reader message counts for a given question, used by the admin
-- Responses tab to show context like "Usman has sent 5 messages, 3 replied".
-- SECURITY DEFINER + GRANT to authenticated only — reader_email is PII.

DROP FUNCTION IF EXISTS public.get_reader_stats_for_question(uuid);
CREATE OR REPLACE FUNCTION public.get_reader_stats_for_question(p_question_id uuid)
RETURNS TABLE(reader_email text, total_count bigint, replied_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    r.reader_email,
    COUNT(*)::bigint        AS total_count,
    COUNT(r.reply_text)::bigint AS replied_count
  FROM public.responses r
  WHERE r.question_id = p_question_id
  GROUP BY r.reader_email;
$$;

GRANT EXECUTE ON FUNCTION public.get_reader_stats_for_question(uuid) TO authenticated;

-- ============================================================================
-- ADMIN: OVERVIEW STATS
-- ============================================================================
-- Returns a single JSON object with high-level stats and leaderboard for the 
-- admin dashboard overview tab, parameterized for filtering.

CREATE INDEX IF NOT EXISTS questions_created_at_idx ON public.questions(created_at desc);

DROP FUNCTION IF EXISTS public.get_admin_overview_stats();
CREATE OR REPLACE FUNCTION public.get_admin_overview_stats(
  p_time_global text,
  p_time_leaderboard text,
  p_question_status text,
  p_reader_type text
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH time_bounds AS (
    SELECT 
      CASE 
        WHEN p_time_global = 'today' THEN date_trunc('day', now())
        WHEN p_time_global = 'last_7_days' THEN now() - interval '7 days'
        WHEN p_time_global = 'last_30_days' THEN now() - interval '30 days'
        ELSE '1970-01-01'::timestamptz 
      END as global_start,
      CASE 
        WHEN p_time_leaderboard = 'this_week' THEN date_trunc('week', now())
        WHEN p_time_leaderboard = 'this_month' THEN date_trunc('month', now())
        ELSE '1970-01-01'::timestamptz 
      END as leaderboard_start
  ),
  filtered_questions AS (
    SELECT id, is_active
    FROM public.questions q, time_bounds tb
    WHERE q.created_at >= tb.global_start
      AND (p_question_status = 'all' 
           OR (p_question_status = 'active' AND q.is_active = true)
           OR (p_question_status = 'inactive' AND q.is_active = false))
  ),
  question_stats AS (
    SELECT 
      COUNT(*) AS total_questions,
      COUNT(*) FILTER (WHERE is_active = true) AS active_questions
    FROM filtered_questions
  ),
  filtered_responses AS (
    SELECT r.reader_email, r.reply_text
    FROM public.responses r
    JOIN public.questions q ON q.id = r.question_id,
    time_bounds tb
    WHERE r.created_at >= tb.global_start
      AND (p_question_status = 'all' 
           OR (p_question_status = 'active' AND q.is_active = true)
           OR (p_question_status = 'inactive' AND q.is_active = false))
  ),
  response_stats AS (
    SELECT
      COUNT(DISTINCT reader_email) AS unique_readers,
      COUNT(*) FILTER (WHERE reply_text IS NOT NULL) AS published_replies,
      COUNT(*) FILTER (WHERE reply_text IS NULL) AS pending_replies
    FROM filtered_responses
  ),
  update_stats AS (
    SELECT COUNT(*) AS total_updates
    FROM public.updates, time_bounds tb
    WHERE created_at >= tb.global_start
  ),
  loyal_readers AS (
    SELECT 
      (array_agg(reader_name ORDER BY created_at ASC) FILTER (WHERE reader_name IS NOT NULL))[1] AS reader_name,
      reader_email,
      COUNT(*) AS response_count
    FROM public.responses, time_bounds tb
    WHERE created_at >= tb.leaderboard_start
    GROUP BY reader_email
    HAVING (p_reader_type = 'all'
            OR (p_reader_type = 'named' AND (array_agg(reader_name ORDER BY created_at ASC) FILTER (WHERE reader_name IS NOT NULL))[1] IS NOT NULL)
            OR (p_reader_type = 'anonymous' AND (array_agg(reader_name ORDER BY created_at ASC) FILTER (WHERE reader_name IS NOT NULL))[1] IS NULL))
    ORDER BY response_count DESC
    LIMIT 20
  )
  SELECT json_build_object(
    'total_questions', (SELECT total_questions FROM question_stats),
    'active_questions', (SELECT active_questions FROM question_stats),
    'unique_readers', (SELECT unique_readers FROM response_stats),
    'published_replies', (SELECT published_replies FROM response_stats),
    'pending_replies', (SELECT pending_replies FROM response_stats),
    'total_updates', (SELECT total_updates FROM update_stats),
    'loyal_readers', coalesce((SELECT json_agg(row_to_json(loyal_readers)) FROM loyal_readers), '[]'::json)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_overview_stats(text, text, text, text) TO authenticated;
