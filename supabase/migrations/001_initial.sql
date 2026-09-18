begin;
create table public.companies (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), logo text, website text,
 description text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and slug not in ('admin','login','api','vsp-innovations')),
 first_name text not null, last_name text not null, display_name text not null, title text not null,
 headline text not null default '', bio text not null default '', profile_image text, phone text, email text, whatsapp text,
 linkedin_url text, website_url text, booking_url text, active boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (linkedin_url is null or linkedin_url ~ '^https://'), check (website_url is null or website_url ~ '^https://'),
 check (booking_url is null or booking_url ~ '^https://cal.com/'), check (profile_image is null or profile_image ~ '^https://')
);
create table public.social_links(id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade, platform text not null, label text not null, url text not null check(url ~ '^https://'), sort_order integer not null default 0);
create table public.expertise(id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade, name text not null, sort_order integer not null default 0);
create table public.admin_users(user_id uuid primary key references auth.users(id) on delete cascade);
create table public.analytics_events (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade,
 event_type text not null check(event_type in ('profile_view','save_contact','call_clicked','email_clicked','whatsapp_clicked','linkedin_clicked','website_clicked','booking_clicked','profile_shared','qr_view')),
 referrer text check(length(referrer)<=253), metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'), created_at timestamptz not null default now()
);
create index analytics_profile_created_idx on public.analytics_events(profile_id,created_at desc);
create index social_profile_idx on public.social_links(profile_id);
create index expertise_profile_idx on public.expertise(profile_id);
create index profiles_company_idx on public.profiles(company_id);
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.admin_users where user_id=(select auth.uid())); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon,authenticated;
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.social_links enable row level security;
alter table public.expertise enable row level security;
alter table public.analytics_events enable row level security;
alter table public.admin_users enable row level security;
create policy company_read on public.companies for select to anon,authenticated using(true);
create policy profile_read on public.profiles for select to anon,authenticated using(active or public.is_admin());
create policy social_read on public.social_links for select to anon,authenticated using(exists(select 1 from public.profiles p where p.id=profile_id and (p.active or public.is_admin())));
create policy expertise_read on public.expertise for select to anon,authenticated using(exists(select 1 from public.profiles p where p.id=profile_id and (p.active or public.is_admin())));
create policy admin_self on public.admin_users for select to authenticated using(user_id=(select auth.uid()));
create policy analytics_admin_read on public.analytics_events for select to authenticated using(public.is_admin());
create policy company_admin on public.companies for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy profile_admin on public.profiles for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy social_admin on public.social_links for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy expertise_admin on public.expertise for all to authenticated using(public.is_admin()) with check(public.is_admin());
-- Anonymous clients cannot insert analytics directly. The validated server endpoint is the only writer.
revoke all on public.analytics_events from anon,authenticated;
grant select on public.analytics_events to authenticated;
revoke all on public.admin_users from anon,authenticated;
grant select on public.admin_users to authenticated;
grant select on public.companies,public.profiles,public.social_links,public.expertise to anon;
grant select,insert,update,delete on public.companies,public.profiles,public.social_links,public.expertise to authenticated;
create function public.analytics_summary() returns table(profile_id uuid,display_name text,event_type text,total bigint) language sql stable security invoker set search_path='' as $$
 select p.id,p.display_name,e.event_type,count(e.id) from public.profiles p left join public.analytics_events e on e.profile_id=p.id and e.created_at>=now()-interval '30 days' where public.is_admin() group by p.id,p.display_name,e.event_type order by p.display_name;
$$;
revoke all on function public.analytics_summary() from public;
grant execute on function public.analytics_summary() to authenticated;
create function public.set_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger companies_updated before update on public.companies for each row execute function public.set_updated_at();
-- Durable per-profile ingestion cap; serializes only this short database operation.
create function public.record_analytics_event(p_profile_id uuid, p_event_type text, p_referrer text, p_source text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text, 0));
 if not exists(select 1 from public.profiles where id=p_profile_id and active) then return false; end if;
 if (select count(*) from public.analytics_events where profile_id=p_profile_id and created_at>now()-interval '1 minute') >= 120 then return false; end if;
 insert into public.analytics_events(profile_id,event_type,referrer,metadata)
 values(p_profile_id,p_event_type,p_referrer,case when p_source in ('nfc','qr','direct') then jsonb_build_object('source',p_source) else '{}'::jsonb end);
 return true;
end;
$$;
revoke all on function public.record_analytics_event(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.record_analytics_event(uuid,text,text,text) to service_role;
commit;
