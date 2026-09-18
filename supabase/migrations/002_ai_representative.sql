-- VSP Connect V2: AI Business Representative.
-- Apply after 001_initial.sql. Transactional; do not rerun over an existing V2 schema.
begin;

-- ---------------------------------------------------------------- knowledge
-- Approved business knowledge. The assistant may only answer company/founder/
-- product questions from these rows. Never publicly readable: retrieval runs
-- through the server with the service key.
create table public.knowledge_sources (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 profile_id uuid references public.profiles(id) on delete cascade,
 title text not null check(length(title) between 1 and 200),
 content text not null check(length(content) between 1 and 8000),
 category text not null check(category in ('company','founder','product','service','case_study','faq','policy','contact')),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 search tsvector generated always as (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,''))) stored
);
create index knowledge_search_idx on public.knowledge_sources using gin(search);
create index knowledge_scope_idx on public.knowledge_sources(company_id, profile_id) where active;

-- ---------------------------------------------------------------- solutions
create table public.solutions (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text not null check(length(name) between 1 and 120),
 short_description text not null default '' check(length(short_description) <= 400),
 full_description text not null default '' check(length(full_description) <= 4000),
 target_industries text[] not null default '{}',
 active boolean not null default true,
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(company_id, slug)
);
create index solutions_company_idx on public.solutions(company_id) where active;

-- ------------------------------------------------------- suggested questions
-- profile_id null = shown on every founder profile in the company.
create table public.suggested_questions (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 profile_id uuid references public.profiles(id) on delete cascade,
 question text not null check(length(question) between 1 and 160),
 sort_order integer not null default 0,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index questions_scope_idx on public.suggested_questions(company_id, profile_id) where active;

-- ------------------------------------------------------ founder AI identity
-- persona_instructions is an internal system prompt fragment and is never
-- exposed to anonymous clients. Public pages read ai_public_config() instead.
create table public.profile_ai_config (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 enabled boolean not null default true,
 intro text not null default '' check(length(intro) <= 400),
 persona_instructions text not null default '' check(length(persona_instructions) <= 4000),
 focus_areas text[] not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------------- leads
create table public.leads (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete cascade,
 company_id uuid not null references public.companies(id) on delete cascade,
 name text check(length(name) <= 120),
 company_name text check(length(company_name) <= 160),
 email text check(email is null or (length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$')),
 phone text check(phone is null or phone ~ '^[-+0-9 ()]{6,24}$'),
 business_type text check(length(business_type) <= 120),
 interest text check(length(interest) <= 200),
 problem_summary text check(length(problem_summary) <= 1000),
 source text not null default 'ai_chat' check(source in ('ai_chat','nfc','qr','direct')),
 status text not null default 'new' check(status in ('new','qualified','meeting_requested','contacted','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index leads_profile_idx on public.leads(profile_id, created_at desc);

-- ------------------------------------------------------------ conversations
create table public.conversations (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete cascade,
 anonymous_session_id text not null check(length(anonymous_session_id) between 16 and 64),
 lead_id uuid references public.leads(id) on delete set null,
 started_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 message_count integer not null default 0
);
create index conversations_profile_idx on public.conversations(profile_id, started_at desc);
create index conversations_session_idx on public.conversations(anonymous_session_id, started_at desc);

-- Visitor and assistant turns only. Prompts and internal instructions are never stored.
create table public.messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 role text not null check(role in ('user','assistant')),
 content text not null check(length(content) between 1 and 8000),
 created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);

-- ----------------------------------------------------------------- ai usage
create table public.ai_usage (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete cascade,
 conversation_id uuid references public.conversations(id) on delete set null,
 provider text not null check(length(provider) <= 40),
 model text not null check(length(model) <= 80),
 input_tokens integer not null default 0 check(input_tokens >= 0),
 output_tokens integer not null default 0 check(output_tokens >= 0),
 estimated_cost numeric(12,6) not null default 0 check(estimated_cost >= 0),
 created_at timestamptz not null default now()
);
create index ai_usage_profile_idx on public.ai_usage(profile_id, created_at desc);
create index ai_usage_created_idx on public.ai_usage(created_at desc);

-- ------------------------------------------------------------- analytics V2
alter table public.analytics_events drop constraint analytics_events_event_type_check;
alter table public.analytics_events add constraint analytics_events_event_type_check check(event_type in (
 'profile_view','save_contact','call_clicked','email_clicked','whatsapp_clicked','linkedin_clicked',
 'website_clicked','booking_clicked','profile_shared','qr_view',
 'ai_opened','ai_message_sent','suggested_question_clicked','lead_started','lead_created',
 'meeting_intent','solution_viewed','booking_from_ai'));

-- Replaces the V1 four-argument ingestion function. Same per-profile transaction
-- lock and validation; adds one allowlisted metadata key so solution_viewed can
-- name a solution. The cap rises to 240/minute because V2 adds AI events.
drop function public.record_analytics_event(uuid,text,text,text);
create function public.record_analytics_event(p_profile_id uuid, p_event_type text, p_referrer text, p_source text, p_solution_slug text)
returns boolean language plpgsql security invoker set search_path='' as $fn$
declare v_metadata jsonb := '{}'::jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text, 0));
 if not exists(select 1 from public.profiles where id=p_profile_id and active) then return false; end if;
 if (select count(*) from public.analytics_events where profile_id=p_profile_id and created_at>now()-interval '1 minute') >= 240 then return false; end if;
 if p_source in ('nfc','qr','direct') then v_metadata := v_metadata || jsonb_build_object('source',p_source); end if;
 if p_solution_slug is not null and p_solution_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(p_solution_slug) <= 60
  then v_metadata := v_metadata || jsonb_build_object('solution',p_solution_slug); end if;
 insert into public.analytics_events(profile_id,event_type,referrer,metadata) values(p_profile_id,p_event_type,p_referrer,v_metadata);
 return true;
end;
$fn$;
revoke all on function public.record_analytics_event(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_analytics_event(uuid,text,text,text,text) to service_role;

-- -------------------------------------------------------------------- RLS
alter table public.knowledge_sources enable row level security;
alter table public.solutions enable row level security;
alter table public.suggested_questions enable row level security;
alter table public.profile_ai_config enable row level security;
alter table public.leads enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.ai_usage enable row level security;

-- Public marketing content only.
create policy solutions_read on public.solutions for select to anon,authenticated using(active or public.is_admin());
create policy questions_read on public.suggested_questions for select to anon,authenticated using(active or public.is_admin());
-- Everything else is administrator-only; the server uses its service key.
create policy knowledge_admin on public.knowledge_sources for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy solutions_admin on public.solutions for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy questions_admin on public.suggested_questions for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy ai_config_admin on public.profile_ai_config for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy leads_admin on public.leads for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy conversations_admin on public.conversations for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy messages_admin on public.messages for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy ai_usage_admin on public.ai_usage for select to authenticated using(public.is_admin());

revoke all on public.knowledge_sources,public.solutions,public.suggested_questions,public.profile_ai_config,
 public.leads,public.conversations,public.messages,public.ai_usage from anon,authenticated;
grant select on public.solutions,public.suggested_questions to anon;
grant select,insert,update,delete on public.knowledge_sources,public.solutions,public.suggested_questions,
 public.profile_ai_config,public.leads,public.conversations,public.messages to authenticated;
grant select on public.ai_usage to authenticated;

-- -------------------------------------------------------------- functions
-- Public pages need to know whether a founder's assistant is on and how it
-- introduces itself. persona_instructions deliberately never leaves the server.
create function public.ai_public_config(p_profile_id uuid)
returns table(enabled boolean, intro text) language sql stable security definer set search_path='' as $fn$
 select coalesce(c.enabled,false), coalesce(c.intro,'')
 from public.profiles p left join public.profile_ai_config c on c.profile_id=p.id
 where p.id=p_profile_id and p.active;
$fn$;
revoke all on function public.ai_public_config(uuid) from public;
grant execute on function public.ai_public_config(uuid) to anon,authenticated,service_role;

-- Scoped retrieval. Returns company knowledge plus this founder's own rows,
-- never another founder's. Core identity categories stay eligible so the
-- assistant can introduce itself even when a query matches no text.
create function public.search_knowledge(p_profile_id uuid, p_query text, p_limit integer)
returns table(id uuid, title text, content text, category text, scope text, score real)
language plpgsql stable security definer set search_path='' as $fn$
declare v_company uuid; v_query tsquery; v_text text;
begin
 -- Qualify every reference: this function RETURNS TABLE(id ...), so a bare
 -- "id" would resolve to the output column rather than the profiles column.
 select p.company_id into v_company from public.profiles p where p.id=p_profile_id and p.active;
 if v_company is null then return; end if;
 -- Bag-of-words matching with rank ordering. AND semantics (plainto/websearch)
 -- would miss a row that answers most of a natural question, so the query
 -- lexemes are combined with OR and ts_rank decides which rows win.
 begin
  select string_agg(quote_literal(lexeme), ' | ') into v_text
   from unnest(to_tsvector('english', left(coalesce(p_query,''), 1000)));
  if v_text is not null then v_query := to_tsquery('english', v_text); end if;
 exception when others then v_query := null; end;
 return query
 select k.id, k.title, k.content, k.category,
  (case when k.profile_id is null then 'company' else 'founder' end)::text,
  (coalesce(ts_rank(k.search, v_query), 0)
   + (case when k.profile_id = p_profile_id then 0.35 else 0 end)
   + (case when k.category in ('company','founder','contact') then 0.12 else 0 end))::real
 from public.knowledge_sources k
 where k.active and k.company_id = v_company
  and (k.profile_id is null or k.profile_id = p_profile_id)
  and (v_query is null or k.search @@ v_query or k.category in ('company','founder','contact'))
 order by 6 desc, k.category, k.title
 limit greatest(1, least(coalesce(p_limit,6), 12));
end;
$fn$;
revoke all on function public.search_knowledge(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.search_knowledge(uuid,text,integer) to service_role;

-- Server-side abuse protection. Limits are passed in so they stay configurable
-- without a migration. Counts visitor turns only.
create function public.ai_rate_check(p_profile_id uuid, p_session_id text, p_conversation_id uuid,
 p_max_conversation integer, p_max_session_hour integer, p_max_profile_minute integer)
returns text language plpgsql security definer set search_path='' as $fn$
declare v_count integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('ai:'||p_profile_id::text, 0));
 if not exists(select 1 from public.profiles where id=p_profile_id and active) then return 'unavailable'; end if;
 if p_conversation_id is not null then
  select count(*) into v_count from public.messages m where m.conversation_id=p_conversation_id and m.role='user';
  if v_count >= p_max_conversation then return 'conversation'; end if;
 end if;
 select count(*) into v_count from public.messages m join public.conversations c on c.id=m.conversation_id
  where c.anonymous_session_id=p_session_id and m.role='user' and m.created_at > now()-interval '1 hour';
 if v_count >= p_max_session_hour then return 'session'; end if;
 select count(*) into v_count from public.messages m join public.conversations c on c.id=m.conversation_id
  where c.profile_id=p_profile_id and m.role='user' and m.created_at > now()-interval '1 minute';
 if v_count >= p_max_profile_minute then return 'busy'; end if;
 return 'ok';
end;
$fn$;
revoke all on function public.ai_rate_check(uuid,text,uuid,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.ai_rate_check(uuid,text,uuid,integer,integer,integer) to service_role;

-- Rolling spend guard consulted before each generation.
create function public.ai_spend_today() returns numeric language sql stable security definer set search_path='' as $fn$
 select coalesce(sum(estimated_cost),0) from public.ai_usage where created_at >= date_trunc('day', now());
$fn$;
revoke all on function public.ai_spend_today() from public,anon,authenticated;
grant execute on function public.ai_spend_today() to service_role;

-- Admin dashboard aggregate for AI activity, alongside V1 analytics_summary().
create function public.ai_summary() returns table(
 profile_id uuid, display_name text, conversations bigint, visitor_messages bigint,
 leads bigint, input_tokens bigint, output_tokens bigint, estimated_cost numeric)
language sql stable security invoker set search_path='' as $fn$
 select p.id, p.display_name,
  (select count(*) from public.conversations c where c.profile_id=p.id and c.started_at>=now()-interval '30 days'),
  (select count(*) from public.messages m join public.conversations c on c.id=m.conversation_id
    where c.profile_id=p.id and m.role='user' and m.created_at>=now()-interval '30 days'),
  (select count(*) from public.leads l where l.profile_id=p.id and l.created_at>=now()-interval '30 days'),
  (select coalesce(sum(u.input_tokens),0) from public.ai_usage u where u.profile_id=p.id and u.created_at>=now()-interval '30 days'),
  (select coalesce(sum(u.output_tokens),0) from public.ai_usage u where u.profile_id=p.id and u.created_at>=now()-interval '30 days'),
  (select coalesce(sum(u.estimated_cost),0) from public.ai_usage u where u.profile_id=p.id and u.created_at>=now()-interval '30 days')
 from public.profiles p where public.is_admin() order by p.display_name;
$fn$;
revoke all on function public.ai_summary() from public;
grant execute on function public.ai_summary() to authenticated;

create trigger knowledge_updated before update on public.knowledge_sources for each row execute function public.set_updated_at();
create trigger solutions_updated before update on public.solutions for each row execute function public.set_updated_at();
create trigger questions_updated before update on public.suggested_questions for each row execute function public.set_updated_at();
create trigger ai_config_updated before update on public.profile_ai_config for each row execute function public.set_updated_at();
create trigger leads_updated before update on public.leads for each row execute function public.set_updated_at();
create trigger conversations_updated before update on public.conversations for each row execute function public.set_updated_at();
commit;
